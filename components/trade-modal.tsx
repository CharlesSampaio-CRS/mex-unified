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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmTradeVisible, setConfirmTradeVisible] = useState(false)
  const [pendingOrder, setPendingOrder] = useState<{amount: number, price: number, total: number} | null>(null)
  
  // Estados para loading e erro no modal de confirmação
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
      
      // Limpa estados do modal de confirmação
      setConfirmTradeVisible(false)
      setPendingOrder(null)
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

    
    
    // Salva dados da ordem pendente e abre modal de confirmação
    setPendingOrder({ amount: amountNum, price: priceNum, total })
    setConfirmTradeVisible(true)
  }

  const confirmTrade = async () => {
    if (!pendingOrder) return
    
    if (!user?.id) {
      Alert.alert('Erro', 'Usuário não autenticado')
      return
    }

    setCreateOrderLoading(true)
    setCreateOrderError(null)
    
    try {
      const amountNum = pendingOrder.amount
      const priceNum = pendingOrder.price
      const total = pendingOrder.total
      
      // 🔧 Forma o par de trading (ex: BTC/USDT)
      const tradingPair = symbol.includes('/') ? symbol : `${symbol.toUpperCase()}/USDT`
      
      // Chama a API de compra ou venda
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
      
      
      
      // Verifica se a ordem foi criada com sucesso
      if (result.success) {
        console.log('✅ [TradeModal] Ordem criada com sucesso:', result)
        
        const isDryRun = result.dry_run === true
        const orderId = result.order?.id || 'N/A'
        const orderStatus = result.order?.status || 'unknown'
        const orderFilled = result.order?.filled || 0
        const orderAmount = result.order?.amount || amountNum
        const avgPrice = result.order?.cost && orderFilled > 0 
          ? result.order.cost / orderFilled 
          : priceNum
        
        
        // 🎯 DETECÇÃO INTELIGENTE: Verifica se ordem foi executada
        const isExecuted = orderStatus === 'closed' || orderStatus === 'filled'
        const fillPercent = orderAmount > 0 ? (orderFilled / orderAmount) * 100 : 0
        const isPartiallyFilled = fillPercent > 0 && fillPercent < 100
        const isFullyFilled = fillPercent >= 99 // Tolerância de 1% para arredondamento

        // 🔔 NOTIFICAÇÃO: Inteligente baseada no status real da ordem
        const isBuy = orderSide === 'buy'
        
        let notificationTitle = '✅ Ordem Criada'
        let notificationMessage = `Ordem ${isBuy ? 'de compra' : 'de venda'} criada: ${amountNum.toFixed(8)} ${symbol} ${orderType === 'limit' ? `@ ${apiService.formatUSD(priceNum)}` : 'a mercado'}`
        
        if (isDryRun) {
          notificationTitle = ' Ordem Simulada'
          notificationMessage = `Ordem ${isBuy ? 'de compra' : 'de venda'} simulada: ${amountNum.toFixed(8)} ${symbol} ${orderType === 'limit' ? `@ ${apiService.formatUSD(priceNum)}` : 'a mercado'}`
        } else if (isExecuted && isFullyFilled) {
          notificationTitle = 'Ordem Executada!'
          notificationMessage = `Ordem ${isBuy ? 'de compra' : 'de venda'} executada: ${orderFilled.toFixed(8)} ${symbol} ${avgPrice ? `@ ${apiService.formatUSD(avgPrice)}` : 'a mercado'}`
        } else if (isPartiallyFilled) {
          notificationTitle = ' Ordem Parcialmente Executada'
          notificationMessage = `Ordem ${isBuy ? 'de compra' : 'de venda'}: ${orderFilled.toFixed(8)} de ${orderAmount.toFixed(8)} ${symbol} executados (${fillPercent.toFixed(0)}%)`
        } else if (orderType === 'limit') {
          notificationTitle = ' Ordem Limite Criada'
          notificationMessage = `Ordem ${isBuy ? 'de compra' : 'de venda'} aguardando execução: ${amountNum.toFixed(8)} ${symbol} @ ${apiService.formatUSD(priceNum)}`
        }
        
        addNotification({
          type: 'success',
          title: notificationTitle,
          message: notificationMessage,
          data: {
            icon: isExecuted ? '🎉' : (isBuy ? '🟢' : '🔴'),
            orderId,
            exchangeName,
            symbol,
            side: orderSide,
            type: orderType,
            amount: amountNum,
            filled: orderFilled,
            fillPercent: fillPercent,
            price: orderType === 'limit' ? priceNum : avgPrice,
            avgPrice: avgPrice,
            status: orderStatus,
            total
          }
        })
        
        // Fecha modais
        setConfirmTradeVisible(false)
        setPendingOrder(null)
        setCreateOrderLoading(false)
        setCreateOrderError(null)
        onClose()
        
        // Chama callbacks em background
        if (onOrderCreated) {
          Promise.resolve(onOrderCreated()).catch(err => {
            console.error('❌ [TradeModal] Erro em onOrderCreated:', err)
          })
        }
        
        if (onBalanceUpdate) {
          Promise.resolve(onBalanceUpdate()).catch(err => {
            console.error('❌ [TradeModal] Erro em onBalanceUpdate:', err)
          })
        } else {
          console.log('⚠️ [TradeModal] onBalanceUpdate não foi fornecido')
        }
        
        
        // Mostra alerta de sucesso (em background)
        setTimeout(() => {
          let alertTitle = '✅ Ordem Criada'
          let alertMessage = `Ordem ${orderId} criada com sucesso!\n\nStatus: ${orderStatus}\nQuantidade: ${amountNum.toFixed(8)} ${symbol}\nTotal: ${apiService.formatUSD(total)}`
          
          if (isDryRun) {
            alertTitle = '✅ Ordem Simulada'
            alertMessage = `Ordem ${orderId} foi simulada com sucesso!\n\nStatus: ${orderStatus}\nTipo: ${orderType}\nLado: ${isBuy ? 'Compra' : 'Venda'}\nQuantidade: ${amountNum.toFixed(8)} ${symbol}\n${orderType === 'limit' ? `Preço: ${apiService.formatUSD(priceNum)}` : 'Preço: Mercado'}\nTotal: ${apiService.formatUSD(total)}\n\n⚠️ Sistema em modo DRY-RUN`
          } else if (isExecuted && isFullyFilled) {
            alertTitle = '🎉 Ordem Executada!'
            alertMessage = `Ordem ${orderId} foi executada completamente!\n\n✅ Executado: ${orderFilled.toFixed(8)} ${symbol}\n💰 Preço médio: ${avgPrice ? apiService.formatUSD(avgPrice) : 'N/A'}\n💵 Total: ${apiService.formatUSD(total)}\n\nStatus: ${orderStatus}`
          } else if (isPartiallyFilled) {
            alertTitle = '⚡ Ordem Parcialmente Executada'
            alertMessage = `Ordem ${orderId} foi parcialmente executada!\n\n✅ Executado: ${orderFilled.toFixed(8)} de ${orderAmount.toFixed(8)} ${symbol} (${fillPercent.toFixed(0)}%)\n⏳ Restante: ${(orderAmount - orderFilled).toFixed(8)} ${symbol}\n💰 Preço médio: ${avgPrice ? apiService.formatUSD(avgPrice) : 'N/A'}\n\nStatus: ${orderStatus}`
          } else if (orderType === 'limit') {
            alertTitle = '⏳ Ordem Limite Aguardando'
            alertMessage = `Ordem ${orderId} criada e aguardando execução!\n\n📊 Quantidade: ${amountNum.toFixed(8)} ${symbol}\n💵 Preço limite: ${apiService.formatUSD(priceNum)}\n💰 Total: ${apiService.formatUSD(total)}\n\nStatus: ${orderStatus}\n\nA ordem será executada quando o preço de mercado atingir seu limite.`
          }
          
          Alert.alert(alertTitle, alertMessage)
        }, 100)
      } else {
        // ❌ API retornou success=false (erro lógico)
        console.error('❌ [TradeModal] API retornou success=false:', result)
        
        // Tenta extrair mensagem de erro de diferentes campos
        let errorMsg = 'Erro ao criar ordem'
        
        // Se for limitação da exchange (ex: MEXC), usa details diretamente
        if (result.exchange_limitation && result.details) {
          errorMsg = result.details
        } else if (result.details) {
          errorMsg = result.details
        } else if (result.error) {
          // Tenta parsear o erro
          const parsedError = parseErrorResponse(result.error)
          if (parsedError.code) {
            errorMsg = `${parsedError.code}: ${parsedError.message}`
          } else {
            errorMsg = parsedError.message
          }
        } else if (result.message) {
          errorMsg = result.message
        }
        
        setCreateOrderError(errorMsg)
      }
    } catch (error: any) {
      console.error('❌ [TradeModal] Erro ao criar ordem:', error)
      console.error('Stack:', error.stack)
      
      // Tenta parsear a mensagem de erro
      const errorMsg = error.message || 'Não foi possível criar a ordem. Tente novamente.'
      const parsedError = parseErrorResponse(errorMsg)
      
      if (parsedError.code) {
        setCreateOrderError(`${parsedError.code}: ${parsedError.message}`)
      } else {
        setCreateOrderError(parsedError.message)
      }
    } finally {
      setCreateOrderLoading(false)
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
              <Text style={[styles.title, { color: colors.text }]}>Trade {symbol.toUpperCase()}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {exchangeName} • {currentPrice < 0.01 
                  ? currentPrice.toFixed(10).replace(/\.?0+$/, '') 
                  : apiService.formatUSD(currentPrice)}
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
                  Quantidade ({symbol})
                </Text>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.balanceText, { color: colors.textSecondary }]}> 
                  Disponível: {availableBalance.toFixed(8)}
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
                      {percent}%
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
                      {(() => {
                        const qty = parseFloat(amount || '0')
                        if (qty === 0) return '0.00'
                        if (qty >= 1000000) return `${(qty / 1000000).toFixed(2)}Mi`
                        if (qty >= 1000) return `${(qty / 1000).toFixed(2)}K`
                        if (qty < 1) return qty.toFixed(8).replace(/\.?0+$/, '')
                        return qty.toFixed(2)
                      })()} {symbol.toUpperCase()}
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
                isSubmitting && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={[
                styles.submitButtonText,
                { color: isBuy ? '#10b981' : '#ef4444' }
              ]}>
                {isSubmitting ? 'Criando ordem...' : `${isBuy ? 'Comprar' : 'Vender'} ${symbol}`}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Modal de Confirmação de Trade */}
      <Modal
        visible={confirmTradeVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setConfirmTradeVisible(false)}
      >
        <Pressable 
          style={styles.confirmOverlay} 
          onPress={() => setConfirmTradeVisible(false)}
        >
          <Pressable 
            style={styles.confirmSafeArea} 
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.confirmContainer, { backgroundColor: colors.surface }]}>
              {/* Header */}
              <View style={[styles.confirmHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmTitle, { color: colors.text }]}>
                  {isBuy ? t('trade.buy') : t('trade.sell')}
                </Text>
              </View>

              {/* Content */}
              <View style={styles.confirmContent}>
                {/* Mostra loading */}
                {createOrderLoading && (
                  <View style={styles.loadingContainer}>
                    <AnimatedLogoIcon size={32} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      {t('trade.creatingOrder')}
                    </Text>
                  </View>
                )}
                
                {/* Mostra erro */}
                {createOrderError && (
                  <View style={styles.errorContainerClean}>
                    {(() => {
                      const parsedError = parseErrorResponse(createOrderError)
                      return (
                        <>
                          {parsedError.code && (
                            <Text style={[styles.errorCodeText, { color: colors.textSecondary }]}>
                              {t('orders.errorCode')}: {parsedError.code}
                            </Text>
                          )}
                          
                          <Text style={[styles.errorMessageText, { color: colors.text }]}>
                            {parsedError.message}
                          </Text>
                        </>
                      )
                    })()}
                  </View>
                )}
                
                {/* Mostra mensagem de confirmação apenas se não está em loading e sem erro */}
                {!createOrderLoading && !createOrderError && (
                  <>
                    <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
                      {isBuy ? t('trade.confirmBuy') : t('trade.confirmSell')} {symbol.toUpperCase()}?
                    </Text>
                    
                    {pendingOrder && (
                      <View style={[styles.confirmDetails, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                        <View style={styles.confirmDetailRow}>
                      <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                        Par:
                      </Text>
                      <Text style={[styles.confirmValue, { color: colors.text }]}>
                        {symbol.toUpperCase()}/USDT
                      </Text>
                    </View>
                    
                    <View style={styles.confirmDetailRow}>
                      <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                        Lado:
                      </Text>
                      <Text style={[styles.confirmValue, { color: isBuy ? '#10b981' : '#ef4444' }]}>
                        {isBuy ? 'Compra' : 'Venda'}
                      </Text>
                    </View>
                    
                    <View style={styles.confirmDetailRow}>
                      <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                        Tipo:
                      </Text>
                      <Text style={[styles.confirmValue, { color: colors.text }]}>
                        {orderType === 'market' ? 'Mercado' : 'Limite'}
                      </Text>
                    </View>
                    
                    <View style={styles.confirmDetailRow}>
                      <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                        Quantidade:
                      </Text>
                      <Text style={[styles.confirmValue, { color: colors.text }]}>
                        {pendingOrder.amount.toFixed(8)} {symbol.toUpperCase()}
                      </Text>
                    </View>
                    
                    <View style={styles.confirmDetailRow}>
                      <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                        Preço:
                      </Text>
                      <Text style={[styles.confirmValue, { color: colors.text }]}>
                        {orderType === 'market' ? 'Mercado' : `$ ${apiService.formatUSD(pendingOrder.price)}`}
                      </Text>
                    </View>
                    
                    <View style={[styles.confirmDetailRow, styles.confirmTotalRow, { borderTopColor: colors.border }]}>
                      <Text style={[styles.confirmLabel, { color: colors.textSecondary, fontWeight: fontWeights.semibold }]}>
                        Total:
                      </Text>
                      <Text style={[styles.confirmValue, { color: colors.text, fontWeight: fontWeights.semibold, fontSize: typography.h4 }]}>
                        $ {apiService.formatUSD(pendingOrder.total)}
                      </Text>
                    </View>
                  </View>
                )}
                  </>
                )}
              </View>

              {/* Footer com botões */}
              <View style={styles.confirmFooter}>
                {/* Botão Voltar/Fechar - sempre disponível */}
                <TouchableOpacity
                  onPress={() => {
                    setConfirmTradeVisible(false)
                    setPendingOrder(null)
                    setCreateOrderError(null) // Limpa erro ao fechar
                  }}
                  disabled={createOrderLoading}
                  style={[styles.confirmButton, styles.confirmButtonCancel, { 
                    borderColor: colors.border,
                    opacity: createOrderLoading ? 0.5 : 1
                  }]}
                >
                  <Text style={[styles.confirmButtonText, { color: colors.textSecondary }]}>
                    {createOrderError ? t('common.close') : t('common.cancel')}
                  </Text>
                </TouchableOpacity>
                
                {/* Botão Confirmar ou Tentar Novamente */}
                {!createOrderLoading && (
                  <TouchableOpacity
                    onPress={confirmTrade}
                    style={[styles.confirmButton, styles.confirmButtonConfirm, { backgroundColor: isBuy ? '#10b981' : '#ef4444' }]}
                  >
                    <Text style={[styles.confirmButtonText, { color: '#fff' }]}>
                      {createOrderError ? t('common.tryAgain') : (isBuy ? t('trade.buy') : t('trade.sell'))}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    fontSize: typography.h3,
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

