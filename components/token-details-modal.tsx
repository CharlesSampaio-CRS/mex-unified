import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator } from "react-native"
import { useTheme } from "@/contexts/ThemeContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { useAuth } from "@/contexts/AuthContext"
import { useBalance } from "@/contexts/BalanceContext"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { capitalizeExchangeName, getExchangeName, getExchangeId } from "@/lib/exchange-helpers"
import { typography, fontWeights } from "@/lib/typography"
import { apiService } from "@/services/api"

interface TokenDetailsModalProps {
  visible: boolean
  onClose: () => void
  exchangeId: string
  symbol: string
}

interface TokenDetails {
  symbol: string
  pair: string
  quote: string
  exchange: {
    id: string
    name: string
    ccxt_id: string
  }
  price: {
    current: string
    bid: string
    ask: string
    high_24h: string
    low_24h: string
  }
  change: {
    "1h": {
      price_change: string
      price_change_percent: string
    }
    "4h": {
      price_change: string
      price_change_percent: string
    }
    "24h": {
      price_change: string
      price_change_percent: string
    }
  }
  volume: {
    base_24h: string
    quote_24h: string
  }
  market_info: {
    active: boolean
    limits: {
      amount: {
        min: number | null
        max: number | null
      }
      cost: {
        min: number | null
        max: number | null
      }
      price: {
        min: number | null
        max: number | null
      }
      leverage?: {
        min: number | null
        max: number | null
      }
    }
    precision: {
      amount: number
      price: number
    }
  }
  timestamp: number
  datetime: string
}

export function TokenDetailsModal({ visible, onClose, exchangeId, symbol }: TokenDetailsModalProps) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { user } = useAuth()
  const { data: balanceData } = useBalance()
  const { hideValue } = usePrivacy()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenData, setTokenData] = useState<TokenDetails | null>(null)
  const [userTotalAmount, setUserTotalAmount] = useState<number>(0)
  const [userTotalValue, setUserTotalValue] = useState<number>(0)
  const [exchangeBreakdown, setExchangeBreakdown] = useState<Array<{
    exchangeId: string
    exchangeName: string
    amount: number
    free: number
    used: number
    valueUsd: number
    priceUsd: number
  }>>([])

  useEffect(() => {
    if (visible && exchangeId && symbol) {
      loadTokenDetails()
      calculateUserTotals()
    }
  }, [visible, exchangeId, symbol, balanceData])

  const calculateUserTotals = () => {
    if (!balanceData?.exchanges || !symbol) {
      setUserTotalAmount(0)
      setUserTotalValue(0)
      setExchangeBreakdown([])
      return
    }

    let totalAmount = 0
    let totalValue = 0
    const breakdown: typeof exchangeBreakdown = []

    balanceData.exchanges.forEach((exchange: any) => {
      const balances = exchange.balances || exchange.tokens || {}
      const token = balances[symbol]
      
      if (token) {
        const amount = token.total || parseFloat(token.amount || '0')
        const free = parseFloat(token.free || '0')
        const used = parseFloat(token.used || token.locked || '0')
        const valueUsd = token.usd_value || parseFloat(token.value_usd || '0')
        const priceUsd = parseFloat(token.price_usd || '0')
        
        totalAmount += amount || 0
        totalValue += valueUsd || 0

        if (amount > 0 || valueUsd > 0) {
          breakdown.push({
            exchangeId: getExchangeId(exchange),
            exchangeName: capitalizeExchangeName(getExchangeName(exchange)),
            amount: amount || 0,
            free: free || 0,
            used: used || 0,
            valueUsd: valueUsd || 0,
            priceUsd: priceUsd || 0,
          })
        }
      }
    })

    // Sort by value descending
    breakdown.sort((a, b) => b.valueUsd - a.valueUsd)

    setUserTotalAmount(totalAmount)
    setUserTotalValue(totalValue)
    setExchangeBreakdown(breakdown)
  }

  const loadTokenDetails = async () => {
    if (!user?.id) {
      setError('Usuário não autenticado')
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      // 🔐 Usa endpoint secure — backend busca credenciais do MongoDB via JWT
      // Não precisa descriptografar credenciais no frontend
      const symbolToSend = symbol.toUpperCase()
      
      const response = await apiService.getTokenDetailsSecure(exchangeId, symbolToSend)
      
      if (!response.success) {
        throw new Error(response.error || 'Erro ao carregar detalhes do token')
      }
      
      setTokenData(response)
    } catch (err: any) {
      console.warn('❌ Erro ao carregar token:', err)
      setError(err.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: string | number | null) => {
    if (!price) return 'N/A'
    const numPrice = typeof price === 'string' ? parseFloat(price) : price
    
    // Se o preço for muito pequeno (< 0.01), usa notação científica
    if (numPrice < 0.01) {
      return numPrice.toFixed(10).replace(/\.?0+$/, '')
    }
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(numPrice)
  }

  const formatVolume = (volume: string | number | null) => {
    if (!volume) return 'N/A'
    const numVolume = typeof volume === 'string' ? parseFloat(volume) : volume
    
    if (numVolume >= 1_000_000_000) {
      return `${(numVolume / 1_000_000_000).toFixed(2)}B`
    }
    if (numVolume >= 1_000_000) {
      return `${(numVolume / 1_000_000).toFixed(2)}M`
    }
    if (numVolume >= 1_000) {
      return `${(numVolume / 1_000).toFixed(2)}K`
    }
    return numVolume.toFixed(2)
  }

  const formatPercent = (percent: string | number | null) => {
    if (!percent) return 'N/A'
    const numPercent = typeof percent === 'string' ? parseFloat(percent) : percent
    if (isNaN(numPercent)) return 'N/A'
    const arrow = numPercent >= 0 ? '▲' : '▼'
    return `${arrow} ${Math.abs(numPercent).toFixed(2)}%`
  }

  const getChangeColor = (percent: string | number | null) => {
    if (!percent) return colors.textSecondary
    const numPercent = typeof percent === 'string' ? parseFloat(percent) : percent
    return numPercent >= 0 ? '#10b981' : '#ef4444'
  }

  const getBidAskColor = (type: 'bid' | 'ask') => {
    return type === 'bid' ? '#10b981' : '#ef4444'
  }

  // Retorna o símbolo correto da moeda quote (ex: R$, $, €)
  const getQuoteSymbol = () => {
    const quote = tokenData?.quote?.toUpperCase()
    if (quote === 'BRL') return 'R$'
    if (quote === 'EUR') return '€'
    if (quote === 'BTC') return '₿'
    return '$' // USDT, USDC, USD
  }

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const calculateSpread = (bid: string, ask: string) => {
    const bidNum = parseFloat(bid)
    const askNum = parseFloat(ask)
    if (!bidNum || !askNum) return 'N/A'
    
    const spread = ((askNum - bidNum) / bidNum) * 100
    return `${spread.toFixed(4)}%`
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {symbol?.toUpperCase() || 'Token'}
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {tokenData
                  ? `${capitalizeExchangeName(tokenData.exchange?.name || 'Exchange')}${tokenData.pair ? ` · ${tokenData.pair}` : ''}${tokenData.price?.current ? ` · ${getQuoteSymbol()}${formatPrice(tokenData.price.current)}` : ''}`
                  : capitalizeExchangeName(exchangeId) }
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  {t('common.loading')}
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={[styles.errorText, { color: '#ef4444' }]}>
                  {error}
                </Text>
                <TouchableOpacity
                  style={[styles.retryButton, { backgroundColor: colors.primary }]}
                  onPress={loadTokenDetails}
                >
                  <Text style={styles.retryButtonText}>{t('common.refresh')}</Text>
                </TouchableOpacity>
              </View>
            ) : tokenData ? (
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>

                {/* Seus Saldos */}
                {(userTotalAmount > 0 || userTotalValue > 0) && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                      Seus Saldos
                    </Text>
                    <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('tokenDetails.totalQuantity')}</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>
                          {hideValue(apiService.formatTokenAmount(userTotalAmount.toString()))} {symbol?.toUpperCase()}
                        </Text>
                      </View>
                      <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('tokenDetails.totalValueUsd')}</Text>
                        <Text style={[styles.infoValue, { color: colors.primary, fontWeight: fontWeights.bold }]}>
                          {hideValue(`$${apiService.formatUSD(userTotalValue)}`)}
                        </Text>
                      </View>
                    </View>

                    {/* Distribuição por Exchange */}
                    {exchangeBreakdown.length > 1 && (
                      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 8 }]}>
                        {exchangeBreakdown.map((ex, idx) => (
                          <React.Fragment key={ex.exchangeId}>
                            {idx > 0 && <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />}
                            <View style={styles.infoRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.infoLabel, { color: colors.text, fontWeight: fontWeights.medium }]}>
                                  {ex.exchangeName}
                                </Text>
                                <Text style={[{ fontSize: typography.caption, color: colors.textSecondary, marginTop: 1 }]}>
                                  {hideValue(apiService.formatTokenAmount(ex.amount.toString()))} {symbol?.toUpperCase()}
                                  {ex.used > 0 ? ` · ${hideValue(apiService.formatTokenAmount(ex.free.toString()))} livre` : ''}
                                </Text>
                              </View>
                              <Text style={[styles.infoValue, { color: colors.primary }]}>
                                {hideValue(`$${apiService.formatUSD(ex.valueUsd)}`)}
                              </Text>
                            </View>
                          </React.Fragment>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Variações de Preço */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {t('token.priceVariation')}
                  </Text>
                  <View style={styles.changeContainer}>
                    {(['1h', '4h', '24h'] as const).map((period) => (
                      <View key={period} style={[styles.changeItem, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }]}>
                        <Text style={[styles.changeLabel, { color: colors.textSecondary }]}>{period}</Text>
                        <Text style={[styles.changeValue, { color: getChangeColor(tokenData.change?.[period]?.price_change_percent) }]}>
                          {formatPercent(tokenData.change?.[period]?.price_change_percent)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Preços e Spread */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Preços 24h</Text>
                  <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Máxima</Text>
                      <Text style={[styles.infoValue, { color: '#10b981' }]}>
                        {getQuoteSymbol()}{formatPrice(tokenData.price?.high_24h || '0')}
                      </Text>
                    </View>
                    <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Mínima</Text>
                      <Text style={[styles.infoValue, { color: '#ef4444' }]}>
                        {getQuoteSymbol()}{formatPrice(tokenData.price?.low_24h || '0')}
                      </Text>
                    </View>
                    {tokenData.price?.bid && (
                      <>
                        <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.infoRow}>
                          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Bid (Compra)</Text>
                          <Text style={[styles.infoValue, { color: '#10b981' }]}>
                            {getQuoteSymbol()}{formatPrice(tokenData.price.bid)}
                          </Text>
                        </View>
                      </>
                    )}
                    {tokenData.price?.ask && (
                      <>
                        <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.infoRow}>
                          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Ask (Venda)</Text>
                          <Text style={[styles.infoValue, { color: '#ef4444' }]}>
                            {getQuoteSymbol()}{formatPrice(tokenData.price.ask)}
                          </Text>
                        </View>
                      </>
                    )}
                    {tokenData.price?.bid && tokenData.price?.ask && (
                      <>
                        <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.infoRow}>
                          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Spread</Text>
                          <Text style={[styles.infoValue, { color: colors.text }]}>
                            {calculateSpread(tokenData.price.bid, tokenData.price.ask)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                {/* Volume 24h */}
                {(tokenData.volume?.base_24h || tokenData.volume?.quote_24h) && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Volume 24h</Text>
                    <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                          Base ({symbol?.toUpperCase()})
                        </Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>
                          {formatVolume(tokenData.volume.base_24h)}
                        </Text>
                      </View>
                      <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                          Quote ({tokenData.quote || 'USDT'})
                        </Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>
                          {getQuoteSymbol()}{formatVolume(tokenData.volume.quote_24h)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Informações de Mercado */}
                {tokenData.market_info && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                      Informações de Mercado
                    </Text>
                    <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Status do par</Text>
                        <Text style={[styles.infoValue, { color: tokenData.market_info.active ? '#10b981' : '#ef4444' }]}>
                          {tokenData.market_info.active ? '● Ativo' : '● Inativo'}
                        </Text>
                      </View>
                      {tokenData.market_info.precision && (
                        <>
                          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                          <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Precisão (Qtd.)</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>
                              {tokenData.market_info.precision.amount != null ? `${tokenData.market_info.precision.amount} dec.` : 'N/A'}
                            </Text>
                          </View>
                          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                          <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Precisão (Preço)</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>
                              {tokenData.market_info.precision.price != null ? `${tokenData.market_info.precision.price} dec.` : 'N/A'}
                            </Text>
                          </View>
                        </>
                      )}
                      {tokenData.market_info.limits?.amount?.min != null && (
                        <>
                          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                          <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Qtd. Mínima</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>
                              {apiService.formatTokenAmount(tokenData.market_info.limits.amount.min!.toString())}
                            </Text>
                          </View>
                        </>
                      )}
                      {tokenData.market_info.limits?.cost?.min != null && (
                        <>
                          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                          <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Custo Mínimo</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>
                              {getQuoteSymbol()}{apiService.formatUSD(tokenData.market_info.limits.cost.min!)}
                            </Text>
                          </View>
                        </>
                      )}
                      {tokenData.market_info.limits?.leverage?.max != null && (
                        <>
                          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                          <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Alavancagem Máx.</Text>
                            <Text style={[styles.infoValue, { color: colors.text }]}>{tokenData.market_info.limits.leverage.max}x</Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                )}

                {/* Última Atualização */}
                <Text style={[styles.lastUpdate, { color: colors.textSecondary }]}>
                  {t('common.updated')} {formatDateTime(tokenData.timestamp || Date.now())}
                </Text>

              </ScrollView>
            ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // ─── Overlay / Container ───────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 20,
    width: '90%',
    maxHeight: '85%',
    height: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },

  // ─── Header ────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: typography.h4,
    fontWeight: fontWeights.bold,
  },
  headerSubtitle: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
  },

  // ─── States ────────────────────────────────────────────────
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: typography.body,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 16,
  },
  errorText: {
    fontSize: typography.body,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },

  // ─── Content ───────────────────────────────────────────────
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: typography.micro,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // ─── Info cards ────────────────────────────────────────────
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 42,
  },
  infoLabel: {
    fontSize: typography.body,
    flex: 1,
  },
  infoValue: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
    flexShrink: 0,
    textAlign: 'right',
  },
  infoDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },

  // ─── Change badges ─────────────────────────────────────────
  changeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  changeItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  changeLabel: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  changeValue: {
    fontSize: typography.h4,
    fontWeight: fontWeights.semibold,
  },

  // ─── Misc ──────────────────────────────────────────────────
  lastUpdate: {
    fontSize: typography.caption,
    textAlign: 'center',
    opacity: 0.5,
    paddingVertical: 12,
  },

  // ─── Unused (kept for safety) ──────────────────────────────
  userTotalContainer: { gap: 0 },
  userTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 42,
  },
  row: { flexDirection: 'row', gap: 8 },
  halfColumn: { flex: 1 },
  label: { fontSize: typography.caption, marginBottom: 2 },
  value: { fontSize: typography.body, fontWeight: fontWeights.medium },
  exchangesListContainer: { gap: 6 },
  exchangeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
  },
  exchangeItemLeft: { flex: 1 },
  exchangeItemName: { fontSize: typography.body, fontWeight: fontWeights.semibold },
  exchangeItemAmount: { fontSize: typography.caption, marginTop: 2 },
  exchangeItemValue: { fontSize: typography.body, fontWeight: fontWeights.semibold, marginLeft: 8 },
  spreadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  subsectionTitle: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  limitsContainer: { marginTop: 4 },
  marketStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
})
