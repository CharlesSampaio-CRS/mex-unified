import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native"
import { useTheme } from "@/contexts/ThemeContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { useAuth } from "@/contexts/AuthContext"
import { useBalance } from "@/contexts/BalanceContext"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { capitalizeExchangeName, getExchangeName, getExchangeId } from "@/lib/exchange-helpers"
import { apiService } from "@/services/api"
import { AnimatedLogoIcon } from "./AnimatedLogoIcon"

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
      console.error('❌ Erro ao carregar token:', err)
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
    const sign = numPercent >= 0 ? '+' : ''
    return `${sign}${numPercent.toFixed(2)}%`
  }

  const getChangeColor = (percent: string | number | null) => {
    if (!percent) return colors.textSecondary
    const numPercent = typeof percent === 'string' ? parseFloat(percent) : percent
    return numPercent >= 0 ? '#10b981' : '#ef4444'
  }

  const getBidAskColor = (type: 'bid' | 'ask') => {
    return type === 'bid' ? '#10b981' : '#ef4444'
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
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.safeArea}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.headerLeft}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {symbol?.toUpperCase() || 'Token'}
                </Text>
                {tokenData && (
                  <>
                    <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                      {capitalizeExchangeName(tokenData.exchange?.name || 'Exchange')}
                    </Text>
                    <Text style={[styles.modalPrice, { color: colors.primary }]}>
                      ${formatPrice(tokenData.price?.current || '0')}
                    </Text>
                  </>
                )}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={[styles.closeButtonText, { color: colors.text }]}>✕</Text>
              </TouchableOpacity>
            </View>
            {loading ? (
              <View style={styles.loadingContainer}>
                <AnimatedLogoIcon size={40} />
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
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Totais do Usuário */}
                {(userTotalAmount > 0 || userTotalValue > 0) && (
                  <View style={[styles.section, { backgroundColor: colors.primary + '10', borderBottomColor: colors.cardBorder }]}>
                    <View style={styles.userTotalContainer}>
                      <View style={styles.userTotalRow}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('tokenDetails.totalQuantity')}</Text>
                        <Text style={[styles.value, { color: colors.text, fontWeight: '600' }]}>
                          {hideValue(apiService.formatTokenAmount(userTotalAmount.toString()))}
                        </Text>
                      </View>
                      <View style={styles.userTotalRow}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('tokenDetails.totalValueUsd')}</Text>
                        <Text style={[styles.value, { color: colors.primary, fontWeight: '700', fontSize: 16 }]}>
                          {hideValue(`$${apiService.formatUSD(userTotalValue)}`)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Variações de Preço */}
                <View style={[styles.section, { borderBottomColor: colors.cardBorder }]}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('token.priceVariation')}
                  </Text>
                  <View style={styles.changeContainer}>
                    <View style={styles.changeItem}>
                      <Text style={[styles.changeLabel, { color: colors.textSecondary }]}>
                        1h
                      </Text>
                      <Text
                        style={[
                          styles.changeValue,
                          { color: getChangeColor(tokenData.change?.['1h']?.price_change_percent) },
                        ]}
                      >
                        {formatPercent(tokenData.change?.['1h']?.price_change_percent)}
                      </Text>
                    </View>
                    <View style={styles.changeItem}>
                      <Text style={[styles.changeLabel, { color: colors.textSecondary }]}>
                        4h
                      </Text>
                      <Text
                        style={[
                          styles.changeValue,
                          { color: getChangeColor(tokenData.change?.['4h']?.price_change_percent) },
                        ]}
                      >
                        {formatPercent(tokenData.change?.['4h']?.price_change_percent)}
                      </Text>
                    </View>
                    <View style={styles.changeItem}>
                      <Text style={[styles.changeLabel, { color: colors.textSecondary }]}>
                        24h
                      </Text>
                      <Text
                        style={[
                          styles.changeValue,
                          { color: getChangeColor(tokenData.change?.['24h']?.price_change_percent) },
                        ]}
                      >
                        {formatPercent(tokenData.change?.['24h']?.price_change_percent)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Bid / Ask + Spread */}
                {(tokenData.price?.bid || tokenData.price?.ask) && (
                  <View style={[styles.section, { borderBottomColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      Livro de Ofertas
                    </Text>
                    <View style={styles.row}>
                      <View style={styles.halfColumn}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>
                          Bid (Compra)
                        </Text>
                        <Text style={[styles.value, { color: getBidAskColor('bid') }]}>
                          ${formatPrice(tokenData.price.bid)}
                        </Text>
                      </View>
                      <View style={styles.halfColumn}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>
                          Ask (Venda)
                        </Text>
                        <Text style={[styles.value, { color: getBidAskColor('ask') }]}>
                          ${formatPrice(tokenData.price.ask)}
                        </Text>
                      </View>
                    </View>
                    {tokenData.price.bid && tokenData.price.ask && (
                      <View style={[styles.spreadRow, { borderTopColor: colors.border }]}>
                        <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>
                          Spread
                        </Text>
                        <Text style={[styles.value, { color: colors.text }]}>
                          {calculateSpread(tokenData.price.bid, tokenData.price.ask)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Máxima e Mínima 24h */}
                <View style={[styles.section, { borderBottomColor: colors.cardBorder }]}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Variação 24h
                  </Text>
                  <View style={styles.row}>
                    <View style={styles.halfColumn}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>
                        Máxima
                      </Text>
                      <Text style={[styles.value, { color: colors.success }]}>
                        ${formatPrice(tokenData.price?.high_24h || '0')}
                      </Text>
                    </View>
                    <View style={styles.halfColumn}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>
                        Mínima
                      </Text>
                      <Text style={[styles.value, { color: colors.danger }]}>
                        ${formatPrice(tokenData.price?.low_24h || '0')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Volume 24h */}
                {(tokenData.volume?.base_24h || tokenData.volume?.quote_24h) && (
                  <View style={[styles.section, { borderBottomColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      Volume 24h
                    </Text>
                    <View style={styles.row}>
                      <View style={styles.halfColumn}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>
                          Base ({symbol?.toUpperCase()})
                        </Text>
                        <Text style={[styles.value, { color: colors.text }]}>
                          {formatVolume(tokenData.volume.base_24h)}
                        </Text>
                      </View>
                      <View style={styles.halfColumn}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>
                          Quote ({tokenData.quote || 'USDT'})
                        </Text>
                        <Text style={[styles.value, { color: colors.text }]}>
                          ${formatVolume(tokenData.volume.quote_24h)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Distribuição por Exchange */}
                {exchangeBreakdown.length > 0 && (
                  <View style={[styles.section, { borderBottomColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      Distribuição por Exchange
                    </Text>
                    <View style={styles.exchangesListContainer}>
                      {exchangeBreakdown.map((ex) => (
                        <View 
                          key={ex.exchangeId} 
                          style={[styles.exchangeItem, { backgroundColor: colors.surfaceSecondary || colors.card }]}
                        >
                          <View style={styles.exchangeItemLeft}>
                            <Text style={[styles.exchangeItemName, { color: colors.text }]}>
                              {ex.exchangeName}
                            </Text>
                            <Text style={[styles.exchangeItemAmount, { color: colors.textSecondary }]}>
                              {hideValue(apiService.formatTokenAmount(ex.amount.toString()))}
                              {ex.used > 0 && ` (${hideValue(apiService.formatTokenAmount(ex.free.toString()))} livre / ${hideValue(apiService.formatTokenAmount(ex.used.toString()))} em uso)`}
                            </Text>
                          </View>
                          <Text style={[styles.exchangeItemValue, { color: colors.primary }]}>
                            {hideValue(`$${apiService.formatUSD(ex.valueUsd)}`)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Informações de Mercado */}
                {tokenData.market_info && (
                  <View style={[styles.section, { borderBottomColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      Informações de Mercado
                    </Text>
                    
                    {/* Status */}
                    <View style={[styles.marketStatusRow, { marginBottom: 12 }]}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>
                        Status do par
                      </Text>
                      <Text style={[styles.value, { 
                        color: tokenData.market_info.active ? colors.success : colors.danger 
                      }]}>
                        {tokenData.market_info.active ? '● Ativo' : '● Inativo'}
                      </Text>
                    </View>

                    {/* Precisão */}
                    {tokenData.market_info.precision && (
                      <View style={styles.row}>
                        <View style={styles.halfColumn}>
                          <Text style={[styles.label, { color: colors.textSecondary }]}>
                            Precisão (Quantidade)
                          </Text>
                          <Text style={[styles.value, { color: colors.text }]}>
                            {tokenData.market_info.precision.amount != null 
                              ? `${tokenData.market_info.precision.amount} decimais` 
                              : 'N/A'}
                          </Text>
                        </View>
                        <View style={styles.halfColumn}>
                          <Text style={[styles.label, { color: colors.textSecondary }]}>
                            Precisão (Preço)
                          </Text>
                          <Text style={[styles.value, { color: colors.text }]}>
                            {tokenData.market_info.precision.price != null 
                              ? `${tokenData.market_info.precision.price} decimais` 
                              : 'N/A'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Limites */}
                    {tokenData.market_info.limits && (
                      <View style={styles.limitsContainer}>
                        <Text style={[styles.subsectionTitle, { color: colors.text }]}>
                          Limites de Negociação
                        </Text>
                        
                        {/* Quantidade */}
                        {(tokenData.market_info.limits.amount?.min != null || tokenData.market_info.limits.amount?.max != null) && (
                          <View style={styles.row}>
                            <View style={styles.halfColumn}>
                              <Text style={[styles.label, { color: colors.textSecondary }]}>
                                Qtd. Mínima
                              </Text>
                              <Text style={[styles.value, { color: colors.text }]}>
                                {tokenData.market_info.limits.amount.min != null 
                                  ? apiService.formatTokenAmount(tokenData.market_info.limits.amount.min.toString()) 
                                  : 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.halfColumn}>
                              <Text style={[styles.label, { color: colors.textSecondary }]}>
                                Qtd. Máxima
                              </Text>
                              <Text style={[styles.value, { color: colors.text }]}>
                                {tokenData.market_info.limits.amount.max != null 
                                  ? apiService.formatTokenAmount(tokenData.market_info.limits.amount.max.toString()) 
                                  : 'Sem limite'}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Custo */}
                        {(tokenData.market_info.limits.cost?.min != null || tokenData.market_info.limits.cost?.max != null) && (
                          <View style={[styles.row, { marginTop: 8 }]}>
                            <View style={styles.halfColumn}>
                              <Text style={[styles.label, { color: colors.textSecondary }]}>
                                Custo Mínimo
                              </Text>
                              <Text style={[styles.value, { color: colors.text }]}>
                                {tokenData.market_info.limits.cost.min != null 
                                  ? `$${apiService.formatUSD(tokenData.market_info.limits.cost.min)}` 
                                  : 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.halfColumn}>
                              <Text style={[styles.label, { color: colors.textSecondary }]}>
                                Custo Máximo
                              </Text>
                              <Text style={[styles.value, { color: colors.text }]}>
                                {tokenData.market_info.limits.cost.max != null 
                                  ? `$${apiService.formatUSD(tokenData.market_info.limits.cost.max)}` 
                                  : 'Sem limite'}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Preço */}
                        {(tokenData.market_info.limits.price?.min != null || tokenData.market_info.limits.price?.max != null) && (
                          <View style={[styles.row, { marginTop: 8 }]}>
                            <View style={styles.halfColumn}>
                              <Text style={[styles.label, { color: colors.textSecondary }]}>
                                Preço Mínimo
                              </Text>
                              <Text style={[styles.value, { color: colors.text }]}>
                                {tokenData.market_info.limits.price.min != null 
                                  ? `$${formatPrice(tokenData.market_info.limits.price.min)}` 
                                  : 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.halfColumn}>
                              <Text style={[styles.label, { color: colors.textSecondary }]}>
                                Preço Máximo
                              </Text>
                              <Text style={[styles.value, { color: colors.text }]}>
                                {tokenData.market_info.limits.price.max != null 
                                  ? `$${formatPrice(tokenData.market_info.limits.price.max)}` 
                                  : 'Sem limite'}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Alavancagem */}
                        {tokenData.market_info.limits.leverage && 
                         (tokenData.market_info.limits.leverage.min != null || tokenData.market_info.limits.leverage.max != null) && (
                          <View style={[styles.row, { marginTop: 8 }]}>
                            <View style={styles.halfColumn}>
                              <Text style={[styles.label, { color: colors.textSecondary }]}>
                                Alavancagem Mín.
                              </Text>
                              <Text style={[styles.value, { color: colors.text }]}>
                                {tokenData.market_info.limits.leverage.min != null 
                                  ? `${tokenData.market_info.limits.leverage.min}x` 
                                  : 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.halfColumn}>
                              <Text style={[styles.label, { color: colors.textSecondary }]}>
                                Alavancagem Máx.
                              </Text>
                              <Text style={[styles.value, { color: colors.text }]}>
                                {tokenData.market_info.limits.leverage.max != null 
                                  ? `${tokenData.market_info.limits.leverage.max}x` 
                                  : 'N/A'}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Última Atualização */}
                <View style={[styles.section, { marginBottom: 20, borderBottomWidth: 0 }]}>
                  <Text style={[styles.lastUpdate, { color: colors.textSecondary }]}>
                    {t('common.updated')} {formatDateTime(tokenData.timestamp || Date.now())}
                  </Text>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  modalContent: {
    borderRadius: 20,
    width: '90%',
    maxHeight: '85%',
    height: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    opacity: 0.7,
  },
  modalPrice: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 26,
    fontWeight: '300',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '300',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '400',
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '400',
    marginTop: 16,
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 26,
    fontWeight: '500',
    marginBottom: 4,
  },
  pairText: {
    fontSize: 16,
    fontWeight: '300',
  },
  userTotalContainer: {
    gap: 12,
    marginBottom: 12,
  },
  userTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userTotalLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  userTotalValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  exchangesListContainer: {
    marginTop: 12,
    gap: 8,
  },
  exchangesListTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  exchangeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  exchangeItemLeft: {
    flex: 1,
  },
  exchangeItemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  exchangeItemAmount: {
    fontSize: 12,
    fontWeight: '400',
  },
  exchangeItemValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  changeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  changeItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  changeLabel: {
    fontSize: 14,
    fontWeight: '300',
    marginBottom: 4,
  },
  changeValue: {
    fontSize: 18,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfColumn: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '300',
    marginBottom: 4,
  },
  value: {
    fontSize: 17,
    fontWeight: '400',
  },
  spreadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    width: '48%',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '300',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '400',
  },
  lastUpdate: {
    fontSize: 14,
    fontWeight: '300',
    textAlign: 'center',
  },
  limitsContainer: {
    marginTop: 4,
  },
  marketStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
})
