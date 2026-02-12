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
import { apiService } from "@/services/api"
import { AnimatedLogoIcon } from "./AnimatedLogoIcon"
import { config } from "@/lib/config"
import { exchangeService } from "@/services/exchange-service"
import { decryptData } from "@/lib/encryption"

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
      return
    }

    let totalAmount = 0
    let totalValue = 0

    balanceData.exchanges.forEach((exchange: any) => {
      // ✅ Suporta ambas estruturas: balances (nova) e tokens (antiga)
      const balances = exchange.balances || exchange.tokens || {}
      const token = balances[symbol]
      
      if (token) {
        const amount = token.total || parseFloat(token.amount || '0')
        const valueUsd = token.usd_value || parseFloat(token.value_usd || '0')
        
        totalAmount += amount || 0
        totalValue += valueUsd || 0
      }
    })

    setUserTotalAmount(totalAmount)
    setUserTotalValue(totalValue)
  }

  const loadTokenDetails = async () => {
    if (!user?.id) {
      setError('Usuário não autenticado')
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      // 1️⃣ Buscar a exchange do banco local
      const exchange = await exchangeService.getExchangeById(exchangeId)
      if (!exchange) {
        throw new Error('Exchange não encontrada')
      }
      
      // 2️⃣ Descriptografar as credenciais
      const apiKey = await decryptData(exchange.api_key_encrypted, user.id)
      const apiSecret = await decryptData(exchange.api_secret_encrypted, user.id)
      const passphrase = exchange.api_passphrase_encrypted 
        ? await decryptData(exchange.api_passphrase_encrypted, user.id) 
        : undefined
      
      // 3️⃣ Formatar o símbolo como par (ex: BTC -> BTC/USDT)
      const pair = symbol.includes('/') ? symbol.toUpperCase() : `${symbol.toUpperCase()}/USDT`
      
      // 4️⃣ Chamar o endpoint /tokens/details (POST) com credenciais
      const response = await fetch(`${config.apiBaseUrl}/tokens/details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exchange: {
            exchange_id: exchangeId,
            ccxt_id: exchange.exchange_type, // Ex: 'mexc', 'binance'
            name: exchange.exchange_name,
            api_key: apiKey,
            api_secret: apiSecret,
            passphrase: passphrase,
            is_active: exchange.is_active,
          },
          symbol: pair, // Ex: 'BTC/USDT', 'REKTCOIN/USDT'
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao carregar detalhes do token')
      }
      
      const data = await response.json()
      setTokenData(data)
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
                      {tokenData.exchange?.name || 'Exchange'}
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
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Quantidade Total</Text>
                        <Text style={[styles.value, { color: colors.text, fontWeight: '600' }]}>
                          {hideValue(apiService.formatTokenAmount(userTotalAmount.toString()))}
                        </Text>
                      </View>
                      <View style={styles.userTotalRow}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Valor Total (USD)</Text>
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
                        {formatPrice(tokenData.price?.high_24h || '0')}
                      </Text>
                    </View>
                    <View style={styles.halfColumn}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>
                        Mínima
                      </Text>
                      <Text style={[styles.value, { color: colors.danger }]}>
                        {formatPrice(tokenData.price?.low_24h || '0')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Última Atualização */}
                <View style={[styles.section, { marginBottom: 20, borderBottomWidth: 0 }]}>
                  <Text style={[styles.lastUpdate, { color: colors.textSecondary }]}>
                    Atualizado: {formatDateTime(tokenData.timestamp || Date.now())}
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
})
