import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Alert, Pressable } from 'react-native'
import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { typography, fontWeights } from '@/lib/typography'
import { apiService } from '@/services/api'
import { AnimatedLogoIcon } from '@/components/AnimatedLogoIcon'

interface TradeModalProps {
  visible: boolean
  onClose: () => void
  exchangeId: string
  exchangeName: string
  symbol: string
  currentPrice: number
  balance?: {
    token: number
    usdt: number
  }
  onOrderCreated?: () => void // Callback chamado após criar ordem com sucesso
  onBalanceUpdate?: () => void // Callback para atualizar balance/portfolio
}

type OrderType = 'market' | 'limit'
type OrderSide = 'buy' | 'sell'

export function TradeModal({ 
  visible, 
  onClose, 
  exchangeId, 
  exchangeName,
  symbol, 
  currentPrice,
  balance = { token: 0, usdt: 0 },
  onOrderCreated,
  onBalanceUpdate
}: TradeModalProps) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  
  const [orderSide, setOrderSide] = useState<OrderSide>('buy')
  const [orderType, setOrderType] = useState<OrderType>('limit')
  const [amount, setAmount] = useState('')
  const [price, setPrice] = useState(currentPrice < 0.01 ? currentPrice.toFixed(10).replace(/\.?0+$/, '') : currentPrice.toString())
  
  // Estados para loading e erro da criação de ordem
  const [createOrderLoading, setCreateOrderLoading] = useState(false)
  const [createOrderError, setCreateOrderError] = useState<string | null>(null)

  // Calcula diferença percentual entre preço digitado e preço de mercado
  const calculatePriceDifference = (): { percentage: number; isHigher: boolean } | null => {
    if (orderType !== 'limit' || !price || !currentPrice) return null
    
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0) return null
    
    const difference = ((priceNum - currentPrice) / currentPrice) * 100
    const isHigher = difference > 0
    
    return { percentage: Math.abs(difference), isHigher }
  }

  const priceDifference = calculatePriceDifference()

  // Função para parsear erros da API (suporta múltiplos formatos de exchanges)
  const parseErrorResponse = (errorString: string): { code?: string; message: string } => {
    // 1. Tenta detectar prefixo da exchange (ex: "bybit {...}", "mexc {...}")
    const exchangeMatch = errorString.match(/^(\w+)\s+(\{.+\})$/)
    
    if (exchangeMatch) {
      const [, exchangeName, jsonPart] = exchangeMatch
      
      try {
        const jsonObj = JSON.parse(jsonPart)
        
        // Bybit: retCode + retMsg
        if (jsonObj.retCode !== undefined) {
          return {
            code: String(jsonObj.retCode),
            message: jsonObj.retMsg || 'Erro desconhecido'
          }
        }
        
        // Binance: code + msg
        if (jsonObj.code !== undefined && jsonObj.msg !== undefined) {
          return {
            code: String(jsonObj.code),
            message: jsonObj.msg
          }
        }
        
        // OKX/Kraken/Coinbase: code + message
        if (jsonObj.code !== undefined && jsonObj.message !== undefined) {
          return {
            code: String(jsonObj.code),
            message: jsonObj.message
          }
        }
        
        // KuCoin: code + msg
        if (jsonObj.code && jsonObj.msg) {
          return {
            code: String(jsonObj.code),
            message: jsonObj.msg
          }
        }
        
        // Gate.io: label + message
        if (jsonObj.label && jsonObj.message) {
          return {
            code: jsonObj.label,
            message: jsonObj.message
          }
        }
        
        // MEXC: error + details
        if (jsonObj.error && jsonObj.details) {
          return {
            message: jsonObj.details
          }
        }
      } catch (e) {
        // Se falhar o parse do JSON, continua para os próximos métodos
      }
    }
    
    // 2. Tenta parsear JSON diretamente (sem prefixo)
    try {
      const jsonObj = JSON.parse(errorString)
      
      // Tenta diferentes combinações de campos
      if (jsonObj.retCode !== undefined) {
        return {
          code: String(jsonObj.retCode),
          message: jsonObj.retMsg || 'Erro desconhecido'
        }
      }
      
      if (jsonObj.code !== undefined && jsonObj.msg !== undefined) {
        return {
          code: String(jsonObj.code),
          message: jsonObj.msg
        }
      }
      
      if (jsonObj.code !== undefined && jsonObj.message !== undefined) {
        return {
          code: String(jsonObj.code),
          message: jsonObj.message
        }
      }
      
      if (jsonObj.error_code && jsonObj.error_message) {
        return {
          code: String(jsonObj.error_code),
          message: jsonObj.error_message
        }
      }
      
      if (jsonObj.error && jsonObj.error_description) {
        return {
          message: jsonObj.error_description
        }
      }
      
      if (jsonObj.details) {
        return {
          message: jsonObj.details
        }
      }
      
      if (jsonObj.message) {
        return {
          message: jsonObj.message
        }
      }
      
      if (jsonObj.msg) {
        return {
          message: jsonObj.msg
        }
      }
    } catch (e) {
      // Não é JSON, retorna string original
    }
    
    // 3. Retorna string original se não conseguir parsear
    return {
      message: errorString
    }
  }

  // ❌ REMOVIDO: Busca limites do mercado (endpoint retorna 404)
  // Os limites mínimos são validados diretamente pela exchange no backend
  // useEffect(() => {
  //   const fetchMarketLimits = async () => {
  //     if (!user?.id) return
  //     try {
  //       const data = await apiService.getMarkets(user.id, exchangeId, 'USDT', symbol)
  //       const market = data?.markets?.find((m: any) => m.base === symbol && m.quote === 'USDT')
  //       if (market?.limits) {
  //         setMarketLimits({
  //           minAmount: market.limits.amount?.min,
  //           minCost: market.limits.cost?.min
  //         })
  //       }
  //     } catch (error) {
  //       console.error('Error fetching market limits:', error)
  //     }
  //   }
  //   if (visible && symbol && exchangeId) {
  //     fetchMarketLimits()
  //   }
  // }, [visible, symbol, exchangeId, user?.id])

  // Atualiza o preço quando o preço atual muda
  useEffect(() => {
    if (orderType === 'market') {
      setPrice(currentPrice < 0.01 ? currentPrice.toFixed(10).replace(/\.?0+$/, '') : currentPrice.toString())
    }
  }, [currentPrice, orderType])

  // Reset ao abrir modal
  useEffect(() => {
    if (visible) {
      setOrderSide('buy')
      setOrderType('limit')
      setAmount('')
      setPrice(currentPrice < 0.01 ? currentPrice.toFixed(10).replace(/\.?0+$/, '') : currentPrice.toString())
      
      // Limpa estados de erro
      setCreateOrderLoading(false)
      setCreateOrderError(null)
    }
  }, [visible, currentPrice])

  const total = parseFloat(amount || '0') * parseFloat(price || '0')
  const isBuy = orderSide === 'buy'
  const availableBalance = isBuy ? balance.usdt : balance.token

  const handlePercentage = (percentage: number) => {
    if (isBuy) {
      // Compra: usa % do saldo USDT
      // Para 100%, usa apenas 99.5% para deixar margem para taxas e arredondamentos
      const safePercentage = percentage === 100 ? 99.5 : percentage
      const usdtAmount = (availableBalance * safePercentage) / 100
      const tokenAmount = usdtAmount / parseFloat(price || '1')
      
      setAmount(tokenAmount.toFixed(8))
    } else {
      // Venda: usa % do saldo de tokens
      // Para 100%, usa apenas 99.5% para deixar margem de segurança
      const safePercentage = percentage === 100 ? 99.5 : percentage
      const tokenAmount = (availableBalance * safePercentage) / 100
      
      setAmount(tokenAmount.toFixed(8))
    }
  }

  const handleSubmit = async () => {
    
    
    
    const amountNum = parseFloat(amount)
    const priceNum = parseFloat(price)

    if (!amountNum || amountNum <= 0) {
      
      Alert.alert('Erro', 'Digite uma quantidade válida')
      return
    }

    if (orderType === 'limit' && (!priceNum || priceNum <= 0)) {
      Alert.alert('Erro', 'Digite um preço válido')
      return
    }

    // ❌ REMOVIDO: Validações de marketLimits (backend valida os limites mínimos)
    // As exchanges retornam erro se a ordem não atender os requisitos mínimos

    // Adiciona tolerância de 0.1% para erros de arredondamento
    const tolerance = availableBalance * 0.001
    
    if (isBuy && total > (availableBalance + tolerance)) {
      
      Alert.alert('Saldo Insuficiente', `Você precisa de $ ${apiService.formatUSD(total)} USDT`)
      return
    }

    if (!isBuy && amountNum > (availableBalance + tolerance)) {
      
      Alert.alert('Saldo Insuficiente', `Você possui apenas ${availableBalance.toFixed(8)} ${symbol}`)
      return
    }

    // ✅ CRIAR ORDEM DIRETO - SEM MODAL DE CONFIRMAÇÃO
    if (!user?.id) {
      Alert.alert('Erro', 'Usuário não autenticado')
      return
    }

    setCreateOrderLoading(true)
    setCreateOrderError(null)

    try {
      const tradingPair = symbol.includes('/') ? symbol : `${symbol}/USDT`
      
      const result = isBuy
        ? await apiService.createBuyOrder(
            user.id,
            exchangeId,
            tradingPair,
            amountNum,
            orderType,
            orderType === 'limit' ? priceNum : undefined
          )
        : await apiService.createSellOrder(
            user.id,
            exchangeId,
            tradingPair,
            amountNum,
            orderType,
            orderType === 'limit' ? priceNum : undefined
          )
      
      if (result.success) {
        // Captura referências ANTES de fechar o modal (evita perda por desmontagem)
        const balanceCallback = onBalanceUpdate;
        const ordersCallback = onOrderCreated;
        
        // 1. Fecha modal imediatamente
        onClose();
        
        // 2. Atualiza orders após delay curto (ordens já estão na exchange)
        setTimeout(() => {
          console.log('🔄 [TRADE-MODAL] Atualizando ordens após criação...')
          if (ordersCallback) ordersCallback();
        }, 500);
        
        // 3. Atualiza balance com delay maior (exchange precisa processar)
        setTimeout(() => {
          console.log('🔄 [TRADE-MODAL] Atualizando balance após criação de ordem...')
          if (balanceCallback) balanceCallback();
        }, 2000);
      } else {
        const errorMsg = result.details || result.error || result.message || 'Erro ao criar ordem';
        setCreateOrderError(errorMsg);
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Não foi possível criar a ordem';
      setCreateOrderError(errorMsg);
    } finally {
      setCreateOrderLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Trade {String(symbol.toUpperCase())}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {String(exchangeName)} • {String(currentPrice < 0.01 
                  ? currentPrice.toFixed(10).replace(/\.?0+$/, '') 
                  : apiService.formatUSD(currentPrice))}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Abas Comprar/Vender - Estilo suave */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  isBuy && styles.tabActive,
                  { 
                    backgroundColor: isBuy ? '#10b98115' : colors.surface,
                    borderColor: isBuy ? '#10b981' : colors.border
                  }
                ]}
                onPress={() => setOrderSide('buy')}
              >
                <Text style={[
                  styles.tabText,
                  { color: isBuy ? '#10b981' : colors.textSecondary }
                ]}>
                  Comprar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tab,
                  !isBuy && styles.tabActive,
                  { 
                    backgroundColor: !isBuy ? '#ef444415' : colors.surface,
                    borderColor: !isBuy ? '#ef4444' : colors.border
                  }
                ]}
                onPress={() => {
                  
                  setOrderSide('sell')
                }}
              >
                <Text style={[
                  styles.tabText,
                  { color: !isBuy ? '#ef4444' : colors.textSecondary }
                ]}>
                  Vender
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tipo de Ordem */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>Tipo de Ordem</Text>
              <View style={styles.orderTypeButtons}>
                <TouchableOpacity
                  style={[
                    styles.orderTypeButton,
                    orderType === 'limit' && styles.orderTypeButtonActive,
                    { 
                      backgroundColor: orderType === 'limit' ? colors.primary : colors.surface,
                      borderColor: orderType === 'limit' ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setOrderType('limit')}
                >
                  <Text style={[
                    styles.orderTypeButtonText,
                    { color: orderType === 'limit' ? colors.primaryText : colors.textSecondary }
                  ]}>
                    Limit
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.orderTypeButton,
                    orderType === 'market' && styles.orderTypeButtonActive,
                    { 
                      backgroundColor: orderType === 'market' ? colors.primary : colors.surface,
                      borderColor: orderType === 'market' ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => {
                    setOrderType('market')
                    setPrice(currentPrice.toString())
                  }}
                >
                  <Text style={[
                    styles.orderTypeButtonText,
                    { color: orderType === 'market' ? colors.primaryText : colors.textSecondary }
                  ]}>
                    Market
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Preço */}
            {orderType === 'limit' && (
              <View style={styles.section}>
                <View style={styles.labelRow}>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.label, { color: colors.text }]}>Preço</Text>
                  {priceDifference && (
                    <Text style={[
                      styles.priceDifferenceText,
                      { color: colors.textSecondary }
                    ]}>
                      {priceDifference.isHigher ? '+' : '-'}{priceDifference.percentage.toFixed(2)}%
                    </Text>
                  )}
                </View>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      backgroundColor: colors.surface,
                      color: colors.text,
                      borderColor: colors.border
                    }
                  ]}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            )}

            {/* Quantidade */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.label, { color: colors.text }]}>
                  Quantidade ({String(symbol)})
                </Text>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.balanceText, { color: colors.textSecondary }]}> 
                  Disponível: {String(availableBalance.toFixed(8))}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border
                  }
                ]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00000000"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Botões de Porcentagem */}
              <View style={styles.percentageButtons}>
                {[25, 50, 75, 100].map((percent) => (
                  <TouchableOpacity
                    key={percent}
                    style={[styles.percentageButton, { borderColor: colors.border }]}
                    onPress={() => handlePercentage(percent)}
                  >
                    <Text style={[styles.percentageButtonText, { color: colors.primary }]}>
                      {String(percent)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* Aviso sobre margem de segurança */}
              <Text style={[styles.safetyMarginText, { color: colors.textSecondary }]}>
                💡 100% usa 99.5% do saldo (margem para taxas)
              </Text>
            </View>

            {/* Preview do Total */}
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.previewRow}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewLabel, { color: colors.textSecondary }]}> 
                  Total {isBuy ? 'a Pagar' : 'a Receber'}
                </Text>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewValue, { color: colors.text }]}> 
                  $ {apiService.formatUSD(total)}
                </Text>
              </View>
              
              {orderType === 'limit' && (
                <>
                  <View style={styles.previewRow}>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewLabel, { color: colors.textSecondary }]}> 
                      Preço
                    </Text>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewValue, { color: colors.text }]}> 
                      {parseFloat(price || '0') < 0.01 
                        ? parseFloat(price || '0').toFixed(10).replace(/\.?0+$/, '') 
                        : apiService.formatUSD(parseFloat(price || '0'))}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewLabel, { color: colors.textSecondary }]}> 
                      Quantidade
                    </Text>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewValue, { color: colors.text }]}> 
                      {String((() => {
                        const qty = parseFloat(amount || '0')
                        if (qty === 0) return '0.00'
                        if (qty >= 1000000) return `${(qty / 1000000).toFixed(2)}Mi`
                        if (qty >= 1000) return `${(qty / 1000).toFixed(2)}K`
                        if (qty < 1) return qty.toFixed(8).replace(/\.?0+$/, '')
                        return qty.toFixed(2)
                      })())} {String(symbol.toUpperCase())}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Botão Confirmar - Estilo suave */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { 
                  backgroundColor: isBuy ? '#10b98120' : '#ef444420',
                  borderColor: isBuy ? '#10b981' : '#ef4444',
                },
                createOrderLoading && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={createOrderLoading}
            >
              <Text style={[
                styles.submitButtonText,
                { color: isBuy ? '#10b981' : '#ef4444' }
              ]}>
                {String(createOrderLoading ? 'Criando ordem...' : `${isBuy ? 'Comprar' : 'Vender'} ${symbol}`)}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 20,
    width: '90%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: typography.h4,
    fontWeight: fontWeights.medium,
  },
  subtitle: {
    fontSize: typography.body,
    fontWeight: fontWeights.regular,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 22,
    fontWeight: fontWeights.light,
  },
  content: {
    padding: 24,
  },
  tabs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12, // 14→12
    borderRadius: 10, // 12→10
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48, // 52→48
  },
  tabActive: {
    // Applied via backgroundColor
  },
  tabText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.medium, // bold→medium
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
    marginBottom: 10,
    flexShrink: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  priceDifferenceText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  balanceText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
    flexShrink: 1,
    textAlign: 'right',
  },
  orderTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  orderTypeButton: {
    flex: 1,
    paddingVertical: 12,         // 10→12 (padrão secondary button)
    borderRadius: 10,            // 8→10 (padrão secondary button)
    borderWidth: 1,              // 1.5→1 (padrão secondary button)
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  orderTypeButtonActive: {
    // Applied via backgroundColor
  },
  orderTypeButtonText: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium, // bold→medium
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12, // 14→12
    borderRadius: 10, // 12→10
    borderWidth: 1.5, // 2→1.5
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
    minHeight: 48, // 52→48
  },
  percentageButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  percentageButton: {
    flex: 1,
    paddingVertical: 8, // 10→8
    borderRadius: 6, // 8→6
    borderWidth: 1, // 1.5→1
    alignItems: 'center',
    minHeight: 36, // 40→36
    justifyContent: 'center',
  },
  percentageButtonText: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },
  safetyMarginText: {
    fontSize: typography.caption,
    fontStyle: 'italic',
    opacity: 0.7,
    marginTop: 8,
    textAlign: 'center',
  },
  previewCard: {
    padding: 18, // 20→18
    borderRadius: 12, // 16→12
    borderWidth: 1.5, // 2→1.5
    marginBottom: 24,
    gap: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  previewLabel: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    flex: 1,
    flexShrink: 1,
  },
  previewValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium, // bold→medium
    flex: 1,
    flexShrink: 1,
    textAlign: 'right',
  },
  submitButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,       // Adiciona padding horizontal padrão
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    minHeight: 48,               // 50→48 (padrão primary button)
    borderWidth: 2,
  },
  submitButtonDisabled: {
    opacity: 0.5, // 0.6→0.5
  },
  submitButtonText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.medium, // bold→medium
  },
  // Estilos do modal de confirmação
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmSafeArea: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  confirmContainer: {
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  confirmHeader: {
    padding: 20,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  confirmTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeights.semibold,
  },
  confirmContent: {
    padding: 20,
    gap: 16,
  },
  confirmMessage: {
    fontSize: typography.body,
    textAlign: "center",
    lineHeight: 20,
  },
  confirmDetails: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  confirmDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confirmTotalRow: {
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
  },
  confirmLabel: {
    fontSize: typography.bodySmall,
  },
  confirmValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  confirmFooter: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonCancel: {
    borderWidth: 1,
  },
  confirmButtonConfirm: {
    // backgroundColor definido inline
  },
  confirmButtonText: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  // Estilos para loading e erro
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: typography.body,
    textAlign: "center",
  },
  errorContainerClean: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 4,
  },
  errorCodeText: {
    fontSize: typography.caption,
    opacity: 0.7,
    marginTop: 4,
  },
  errorMessageText: {
    fontSize: typography.body,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },
})

