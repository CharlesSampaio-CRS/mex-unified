import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Alert, Pressable, ActivityIndicator, SafeAreaView } from 'react-native'
import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { useOrders } from '@/contexts/OrdersContext'
import { useBalance } from '@/contexts/BalanceContext'
import { typography, fontWeights } from '@/lib/typography'
import { apiService } from '@/services/api'
import { notify } from '@/services/notify'

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
    brl?: number // Saldo BRL disponível (para pares USDT/BRL)
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
  balance = { token: 0, usdt: 0, brl: 0 },
  onOrderCreated,
  onBalanceUpdate
}: TradeModalProps) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const { addOrder, refresh: refreshOrders, refreshExchange } = useOrders()
  const { refresh: refreshBalance } = useBalance()
  
  const [orderSide, setOrderSide] = useState<OrderSide | null>(null)
  const [orderType, setOrderType] = useState<OrderType | null>(null)
  const [amount, setAmount] = useState('')
  const [price, setPrice] = useState(currentPrice < 0.01 ? currentPrice.toFixed(10).replace(/\.?0+$/, '') : currentPrice.toString())
  
  // Estados para loading e erro da criação de ordem
  const [createOrderLoading, setCreateOrderLoading] = useState(false)
  const [createOrderError, setCreateOrderError] = useState<string | null>(null)
  const [selectedPercent, setSelectedPercent] = useState<number | null>(null)
  const [confirmVisible, setConfirmVisible] = useState(false)

  // 🔄 Estados para pares disponíveis (dinâmico via API)
  const [availablePairs, setAvailablePairs] = useState<Array<{
    symbol: string
    base: string
    quote: string
    active: boolean
    min_amount: number
    min_cost: number
  }>>([])
  const [selectedPair, setSelectedPair] = useState<string | null>(null)
  const [pairsLoading, setPairsLoading] = useState(false)
  const [pairsError, setPairsError] = useState<string | null>(null)
  const [pairPriceLoading, setPairPriceLoading] = useState(false)
  const [pairSearch, setPairSearch] = useState('')

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

  // Reset ao abrir modal — tudo desmarcado para UX progressiva
  useEffect(() => {
    if (visible) {
      setOrderSide(null)
      setOrderType(null)
      setAmount('')
      setPrice(currentPrice < 0.01 ? currentPrice.toFixed(10).replace(/\.?0+$/, '') : currentPrice.toString())
      
      // Limpa estados de erro
      setCreateOrderLoading(false)
      setCreateOrderError(null)
      setSelectedPercent(null)
      setConfirmVisible(false)

      // Limpa estados de pares
      setAvailablePairs([])
      setSelectedPair(null)
      setPairsError(null)
      setPairSearch('')

      // 🔄 Busca pares disponíveis para este token na exchange
      const fetchPairs = async () => {
        setPairsLoading(true)
        try {
          const result = await apiService.getAvailablePairs(exchangeId, symbol)
          if (result.success && result.pairs.length > 0) {
            const sym = symbol.toUpperCase()
            
            // 1. Primeiro tenta pares onde o token é a BASE (ex: BTC → BTC/USDT, BTC/BRL)
            let relevantPairs = result.pairs.filter(p => p.base === sym)
            
            // 2. Se não encontrou como base (ex: BRL, USDT, USDC são sempre QUOTE),
            //    usa pares onde o token é a QUOTE (ex: BRL → BTC/BRL, ETH/BRL)
            const isQuoteOnly = relevantPairs.length === 0
            if (isQuoteOnly) {
              relevantPairs = result.pairs.filter(p => p.quote === sym)
            }
            
            // Prioriza pares com quote/base currencies comuns
            const priorityOrder = ['USDT', 'BRL', 'USDC', 'BTC', 'ETH', 'EUR']
            const sortedPairs = relevantPairs.sort((a, b) => {
              const keyA = isQuoteOnly ? a.base : a.quote
              const keyB = isQuoteOnly ? b.base : b.quote
              const aIdx = priorityOrder.indexOf(keyA)
              const bIdx = priorityOrder.indexOf(keyB)
              const aPriority = aIdx >= 0 ? aIdx : 999
              const bPriority = bIdx >= 0 ? bIdx : 999
              return aPriority - bPriority
            })

            // Sem limite — mostra todos, com search quando >8
            setAvailablePairs(sortedPairs)
            
            // Auto-seleciona o primeiro par
            if (sortedPairs.length > 0) {
              setSelectedPair(sortedPairs[0].symbol)
            }
          } else {
            setPairsError(`Nenhum par de trading ativo encontrado para ${symbol} nesta exchange`)
          }
        } catch (error: any) {
          console.error('❌ Error fetching pairs:', error)
          const fallbackPair = `${symbol.toUpperCase()}/USDT`
          setSelectedPair(fallbackPair)
          setAvailablePairs([{
            symbol: fallbackPair,
            base: symbol.toUpperCase(),
            quote: 'USDT',
            active: true,
            min_amount: 0,
            min_cost: 0
          }])
        } finally {
          setPairsLoading(false)
        }
      }

      if (symbol && exchangeId) {
        fetchPairs()
      }
    }
  }, [visible, currentPrice, symbol, exchangeId])

  // 📈 Busca preço do par selecionado na exchange quando muda
  useEffect(() => {
    if (!selectedPair || !exchangeId || !visible) return
    
    const fetchPairPrice = async () => {
      setPairPriceLoading(true)
      try {
        const result = await apiService.getPairTicker(exchangeId, selectedPair)
        if (result.success && result.ticker?.last > 0) {
          const lastPrice = result.ticker.last
          setPrice(lastPrice < 0.01 ? lastPrice.toFixed(10).replace(/\.?0+$/, '') : lastPrice.toString())
        }
      } catch (error: any) {
        console.warn('⚠️ Could not fetch pair price, keeping current:', error.message)
      } finally {
        setPairPriceLoading(false)
      }
    }

    fetchPairPrice()
  }, [selectedPair, exchangeId, visible])

  const isBuy = orderSide === 'buy'

  // 🔄 Par selecionado e quote currency derivada dinamicamente
  const symbolUpper = symbol.toUpperCase()
  const selectedPairData = availablePairs.find(p => p.symbol === selectedPair)
  const quoteCurrency = selectedPairData?.quote || 'USDT'
  const baseCurrency = selectedPairData?.base || symbolUpper
  const isBrlQuote = quoteCurrency === 'BRL'
  const tradingPair = selectedPair || `${symbolUpper}/USDT`
  
  // Detecta se o token clicado é a quote do par (ex: clicou BRL, par BTC/BRL)
  const isTokenTheQuote = symbolUpper === quoteCurrency
  // Detecta se o token clicado é a base do par (ex: clicou BTC, par BTC/USDT)
  const isTokenTheBase = symbolUpper === baseCurrency

  // Quando o token clicado é a QUOTE (ex: clicou BRL, par BTC/BRL),
  // o campo quantidade deve representar a quote currency (BRL),
  // e o frontend converte para base currency antes de enviar ao backend.
  // "amountCurrency" = moeda que o campo quantidade representa
  const amountCurrency = isTokenTheQuote ? quoteCurrency : baseCurrency

  // Total em quote currency:
  // - Se amount está em base (caso normal): total = amount * price
  // - Se amount está em quote (isTokenTheQuote): total = amount (já é em quote)
  const amountNum_raw = parseFloat(amount || '0')
  const priceNum_raw = parseFloat(price || '0')
  const total = isTokenTheQuote ? amountNum_raw : (amountNum_raw * priceNum_raw)

  // Quantidade em base currency para enviar ao CCXT (sempre requer base):
  // - Se amount está em base: baseAmount = amount
  // - Se amount está em quote: baseAmount = amount / price
  const baseAmount = isTokenTheQuote 
    ? (priceNum_raw > 0 ? amountNum_raw / priceNum_raw : 0)
    : amountNum_raw

  // Saldo disponível depende do par selecionado E de qual side é o token clicado:
  // 
  // Token clicado é a BASE (ex: clicou BTC, par BTC/USDT):
  //   - Compra: usa saldo da quote (USDT ou BRL)
  //   - Venda: usa saldo do token clicado (BTC = balance.token)
  //
  // Token clicado é a QUOTE (ex: clicou BRL, par BTC/BRL):
  //   - Compra: usa saldo do token clicado (BRL = balance.token) → quer gastar BRL para comprar base
  //   - Venda: usa saldo do token clicado (BRL = balance.token) → quer vender BRL (dar BRL para receber base)
  const availableBalance = (() => {
    if (!orderSide) return 0
    
    if (isTokenTheBase) {
      // Token clicado é a base do par (caso normal: BTC → BTC/USDT)
      return isBuy 
        ? (isBrlQuote ? (balance.brl || 0) : balance.usdt)
        : balance.token
    } else if (isTokenTheQuote) {
      // Token clicado é a quote do par (ex: BRL → BTC/BRL, USDT → BTC/USDT)
      // Tanto para compra quanto venda, o saldo relevante é o do token clicado (quote)
      return balance.token
    }
    
    // Fallback
    return isBuy ? balance.usdt : balance.token
  })()

  // ✅ UX Progressiva: controle de habilitação dos passos
  const sideSelected = orderSide !== null
  const typeSelected = orderType !== null
  const amountNum = parseFloat(amount || '0')
  const priceNum = parseFloat(price || '0')
  const hasValidAmount = amountNum > 0
  const hasValidPrice = orderType === 'market' || (orderType === 'limit' && priceNum > 0)
  const isFormComplete = sideSelected && typeSelected && hasValidAmount && hasValidPrice && !createOrderLoading && !pairsLoading && !pairsError && !!selectedPair

  const handlePercentage = (percentage: number) => {
    if (!orderSide || !orderType) return
    setSelectedPercent(percentage)
    // Para 100%, usa apenas 99.5% para deixar margem para taxas e arredondamentos
    const safePercentage = percentage === 100 ? 99.5 : percentage
    const balanceToUse = (availableBalance * safePercentage) / 100

    if (isTokenTheQuote) {
      // Token clicado é a quote (ex: BRL) → quantidade em quote currency direto
      setAmount(balanceToUse.toFixed(2))
    } else if (isBuy) {
      // Compra normal (amount em base): converte saldo quote → base
      const tokenAmount = balanceToUse / parseFloat(price || '1')
      setAmount(tokenAmount.toFixed(8))
    } else {
      // Venda normal (amount em base): saldo já é em base
      setAmount(balanceToUse.toFixed(8))
    }
  }

  const handleSubmit = async () => {
    if (!orderSide || !orderType) return
    
    const amountVal = parseFloat(amount)
    const priceVal = parseFloat(price)

    if (!amountVal || amountVal <= 0) {
      Alert.alert('Erro', 'Digite uma quantidade válida')
      return
    }

    if (orderType === 'limit' && (!priceVal || priceVal <= 0)) {
      Alert.alert('Erro', 'Digite um preço válido')
      return
    }

    // Adiciona tolerância de 0.1% para erros de arredondamento
    const tolerance = availableBalance * 0.001
    
    // Validação de saldo: amount está na moeda do campo (amountCurrency)
    if (amountVal > (availableBalance + tolerance)) {
      const balanceLabel = amountCurrency === 'BRL'
        ? `R$ ${availableBalance.toFixed(2)} BRL`
        : `${availableBalance.toFixed(amountCurrency === baseCurrency ? 8 : 4)} ${amountCurrency}`
      Alert.alert('Saldo Insuficiente', `Disponível: ${balanceLabel}`)
      return
    }

    if (!user?.id) {
      Alert.alert('Erro', 'Usuário não autenticado')
      return
    }

    // ✅ Abre modal de confirmação ao invés de enviar direto
    setConfirmVisible(true)
  }

  // Executa a criação da ordem (após confirmação)
  const executeOrder = async () => {
    if (!orderSide || !orderType) return
    setConfirmVisible(false)

    const amountVal = parseFloat(amount)
    const priceVal = parseFloat(price)

    // CCXT create_order espera amount em BASE currency sempre.
    // Se o campo quantidade está em quote (isTokenTheQuote), converte para base.
    const amountForApi = isTokenTheQuote
      ? (priceVal > 0 ? amountVal / priceVal : 0)
      : amountVal

    setCreateOrderLoading(true)
    setCreateOrderError(null)

    try {
      // 🔄 Usa o par selecionado dinamicamente (já definido no estado)
      // tradingPair vem do selectedPair ou fallback para TOKEN/USDT
      
      const result = isBuy
        ? await apiService.createBuyOrder(
            user.id,
            exchangeId,
            tradingPair,
            amountForApi,
            orderType,
            orderType === 'limit' ? priceVal : undefined
          )
        : await apiService.createSellOrder(
            user.id,
            exchangeId,
            tradingPair,
            amountForApi,
            orderType,
            orderType === 'limit' ? priceVal : undefined
          )
      
      if (result.success) {
        // 🔍 DEBUG: Log do resultado para verificar estrutura
        console.log('🔍 [TRADE-MODAL] Create order result:', JSON.stringify(result, null, 2))
        
        // 1. Fecha modal imediatamente
        onClose();
        
        // 2. 🔔 NOTIFICAÇÃO: Ordem criada com sucesso
        const tradingSymbol = tradingPair.split('/')[0]
        notify.orderCreated(addNotification, {
          symbol: tradingPair,
          side: orderSide as 'buy' | 'sell',
          amount: amountForApi,
          price: priceVal,
          type: orderType!,
          exchange: exchangeName,
        })
        
        // 3. ✅ INSERÇÃO OTIMISTA: Adiciona a ordem na lista IMEDIATAMENTE (só para limit)
        if (orderType === 'limit') {
          // Backend serializa Order.id como "exchange_order_id" no JSON (serde rename)
          const realOrderId = result.order?.exchange_order_id || result.order?.id || result.order_id || result.orderId || result.id || `temp_${Date.now()}`
          const newOrder = {
            id: realOrderId,
            exchange_order_id: realOrderId,
            symbol: tradingPair,
            type: orderType as 'limit' | 'market',
            side: orderSide as 'buy' | 'sell',
            price: priceVal,
            amount: amountForApi,
            filled: 0,
            remaining: amountForApi,
            status: 'open' as const,
            timestamp: Date.now(),
            datetime: new Date().toISOString(),
            cost: 0,
            exchange_id: exchangeId,
            exchange_name: exchangeName,
          }
          addOrder(newOrder, exchangeId, exchangeName)
        }
        
        // 3. Chama callbacks legados (para outros componentes que dependem deles)
        if (onOrderCreated) onOrderCreated();
        if (onBalanceUpdate) onBalanceUpdate();
        
        // 4. Sincroniza com backend em background (silencioso, corrige dados reais)
        setTimeout(() => {
          refreshExchange(exchangeId).catch(console.error)
          refreshBalance().catch(console.error)
        }, 3000);
      } else {
        const errorMsg = result.details || result.error || result.message || 'Erro ao criar ordem';
        setCreateOrderError(errorMsg);
        notify.orderError(addNotification, {
          symbol: tradingPair,
          action: 'Criar Ordem',
          error: errorMsg,
        })
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Não foi possível criar a ordem';
      setCreateOrderError(errorMsg);
      notify.orderError(addNotification, {
        symbol: tradingPair,
        action: 'Criar Ordem',
        error: errorMsg,
      })
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
        <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Trade {String(tradingPair || symbol.toUpperCase())}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {String(exchangeName)} • {pairPriceLoading ? '⏳ ...' : String(parseFloat(price || '0') < 0.01 
                  ? parseFloat(price || '0').toFixed(10).replace(/\.?0+$/, '') 
                  : apiService.formatUSD(parseFloat(price || '0')))}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 🔄 Seletor de Par de Trading (dinâmico) */}
            {pairsLoading ? (
              <View style={[styles.section, { alignItems: 'center', paddingVertical: 16 }]}>
                <ActivityIndicator size="small" />
                <Text style={[styles.stepLabel, { color: colors.textSecondary, marginTop: 8 }]}>
                  Buscando pares disponíveis...
                </Text>
              </View>
            ) : pairsError ? (
              <View style={[styles.section, { alignItems: 'center', paddingVertical: 16 }]}>
                <Text style={{ fontSize: typography.emoji }}>⚠️</Text>
                <Text style={[styles.stepLabel, { color: '#ef4444', marginTop: 8, textAlign: 'center' }]}>
                  {pairsError}
                </Text>
                <Text style={[{ color: colors.textSecondary, fontSize: typography.caption, marginTop: 4, textAlign: 'center' }]}>
                  Este token pode não estar disponível para trading nesta exchange
                </Text>
              </View>
            ) : availablePairs.length > 1 ? (
              <View style={styles.section}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
                    Par de trading {pairPriceLoading ? '⏳' : ''}
                  </Text>
                  <Text style={[{ fontSize: typography.tiny, color: colors.textTertiary }]}>
                    {availablePairs.length} pares
                  </Text>
                </View>
                {/* Search input para listas grandes (>8 pares) */}
                {availablePairs.length > 8 && (
                  <View style={[{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    marginTop: 6,
                    marginBottom: 2,
                    gap: 6,
                  }]}>
                    <Text style={{ color: colors.textTertiary, fontSize: typography.body }}>🔍</Text>
                    <TextInput
                      style={{ flex: 1, fontSize: typography.bodySmall, color: colors.text, paddingVertical: 2 }}
                      placeholder="Buscar par... (ex: BTC, ETH)"
                      placeholderTextColor={colors.textTertiary}
                      value={pairSearch}
                      onChangeText={setPairSearch}
                      autoCapitalize="characters"
                    />
                    {pairSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setPairSearch('')}>
                        <Text style={{ color: colors.textSecondary, fontSize: typography.body }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <ScrollView 
                  horizontal={availablePairs.length <= 8} 
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={availablePairs.length > 8}
                  style={{ marginTop: 8, maxHeight: availablePairs.length > 8 ? 140 : undefined }}
                >
                  <View style={{ 
                    flexDirection: availablePairs.length <= 8 ? 'row' : 'row', 
                    flexWrap: availablePairs.length <= 8 ? 'nowrap' : 'wrap',
                    gap: 8 
                  }}>
                    {availablePairs
                      .filter(pair => !pairSearch || pair.symbol.toUpperCase().includes(pairSearch.toUpperCase()))
                      .map((pair) => (
                      <TouchableOpacity
                        key={pair.symbol}
                        style={[
                          {
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            backgroundColor: selectedPair === pair.symbol ? `${colors.primary}20` : colors.surface,
                            borderColor: selectedPair === pair.symbol ? colors.primary : colors.border,
                          }
                        ]}
                        onPress={() => {
                          setSelectedPair(pair.symbol)
                          setAmount('')
                          setSelectedPercent(null)
                        }}
                      >
                        <Text style={{
                          fontSize: typography.bodySmall,
                          fontWeight: selectedPair === pair.symbol ? fontWeights.bold : fontWeights.medium,
                          color: selectedPair === pair.symbol ? colors.primary : colors.textSecondary,
                        }}>
                          {pair.symbol}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : availablePairs.length === 1 ? (
              <View style={[styles.section, { paddingVertical: 4 }]}>
                <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
                  Par: <Text style={{ color: colors.text, fontWeight: fontWeights.bold }}>{tradingPair}</Text>
                  {pairPriceLoading ? ' ⏳' : ''}
                </Text>
              </View>
            ) : null}

            {/* PASSO 1: Comprar/Vender — habilitado quando par está carregado */}
            <View style={[styles.section, (pairsLoading || !!pairsError) && styles.sectionDisabled]}>
              <Text style={[styles.stepLabel, { color: (!pairsLoading && !pairsError) ? colors.textSecondary : colors.border }]}>1. Selecione a operação</Text>
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    { 
                      backgroundColor: orderSide === 'buy' ? '#10b98115' : colors.surface,
                      borderColor: orderSide === 'buy' ? '#10b981' : colors.border
                    }
                  ]}
                  onPress={() => { setOrderSide('buy'); setAmount(''); setSelectedPercent(null); }}
                  disabled={pairsLoading || !!pairsError}
                >
                  <Text style={[
                    styles.tabText,
                    { color: orderSide === 'buy' ? '#10b981' : colors.textSecondary }
                  ]}>
                    Comprar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tab,
                    { 
                      backgroundColor: orderSide === 'sell' ? '#ef444415' : colors.surface,
                      borderColor: orderSide === 'sell' ? '#ef4444' : colors.border
                    }
                  ]}
                  onPress={() => { setOrderSide('sell'); setAmount(''); setSelectedPercent(null); }}
                  disabled={pairsLoading || !!pairsError}
                >
                  <Text style={[
                    styles.tabText,
                    { color: orderSide === 'sell' ? '#ef4444' : colors.textSecondary }
                  ]}>
                    Vender
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* PASSO 2: Tipo de Ordem — só habilita após selecionar lado */}
            <View style={[styles.section, !sideSelected && styles.sectionDisabled]}>
              <Text style={[styles.stepLabel, { color: sideSelected ? colors.textSecondary : colors.border }]}>
                2. Tipo de ordem
              </Text>
              <View style={styles.orderTypeButtons}>
                <TouchableOpacity
                  style={[
                    styles.orderTypeButton,
                    orderType === 'limit' && styles.orderTypeButtonActive,
                    !sideSelected && styles.buttonDisabled,
                    { 
                      backgroundColor: orderType === 'limit' ? colors.primary : colors.surface,
                      borderColor: orderType === 'limit' ? colors.primary : colors.border,
                      opacity: sideSelected ? 1 : 0.4,
                    }
                  ]}
                  onPress={() => setOrderType('limit')}
                  disabled={!sideSelected}
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
                    !sideSelected && styles.buttonDisabled,
                    { 
                      backgroundColor: orderType === 'market' ? colors.primary : colors.surface,
                      borderColor: orderType === 'market' ? colors.primary : colors.border,
                      opacity: sideSelected ? 1 : 0.4,
                    }
                  ]}
                  onPress={() => {
                    setOrderType('market')
                    setPrice(currentPrice.toString())
                  }}
                  disabled={!sideSelected}
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

            {/* PASSO 3: Preço (só para limit) e Quantidade — habilita após tipo selecionado */}
            {orderType === 'limit' && (
              <View style={[styles.section, !typeSelected && styles.sectionDisabled]}>
                <View style={styles.labelRow}>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.stepLabel, { color: typeSelected ? colors.textSecondary : colors.border }]}>
                    3. Preço
                  </Text>
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
                      color: typeSelected ? colors.text : colors.border,
                      borderColor: colors.border,
                      opacity: typeSelected ? 1 : 0.4,
                    }
                  ]}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  editable={typeSelected}
                />
              </View>
            )}

            {/* Quantidade */}
            <View style={[styles.section, !typeSelected && styles.sectionDisabled]}>
              <View style={styles.labelRow}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.stepLabel, { color: typeSelected ? colors.textSecondary : colors.border }]}>
                  {orderType === 'limit' ? '4' : '3'}. Quantidade ({String(amountCurrency)})
                </Text>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.balanceText, { color: typeSelected ? colors.textSecondary : colors.border }]}> 
                  Disponível: {String(
                    amountCurrency === 'BRL'
                      ? `R$ ${availableBalance.toFixed(2)}`
                      : availableBalance > 0
                        ? `${availableBalance.toFixed(amountCurrency === baseCurrency ? 8 : 4)} ${amountCurrency}`
                        : `-- ${amountCurrency}`
                  )}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.surface,
                    color: typeSelected ? colors.text : colors.border,
                    borderColor: colors.border,
                    opacity: typeSelected ? 1 : 0.4,
                  }
                ]}
                value={amount}
                onChangeText={(text) => { setAmount(text); setSelectedPercent(null) }}
                keyboardType="decimal-pad"
                placeholder="0.00000000"
                placeholderTextColor={colors.textSecondary}
                editable={typeSelected}
              />

              {/* Botões de Porcentagem */}
              <View style={styles.percentageButtons}>
                {[25, 50, 75, 100].map((percent) => {
                  const isSelected = selectedPercent === percent
                  return (
                    <TouchableOpacity
                      key={percent}
                      style={[
                        styles.percentageButton,
                        { 
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? `${colors.primary}20` : 'transparent',
                          opacity: typeSelected ? 1 : 0.4,
                        }
                      ]}
                      onPress={() => handlePercentage(percent)}
                      disabled={!typeSelected}
                    >
                      <Text style={[
                        styles.percentageButtonText,
                        { 
                          color: isSelected ? colors.primary : colors.textSecondary,
                          fontWeight: isSelected ? fontWeights.bold : fontWeights.medium,
                        }
                      ]}>
                        {String(percent)}%
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              
              {/* Aviso sobre margem de segurança */}
              {typeSelected && (
                <Text style={[styles.safetyMarginText, { color: colors.textSecondary }]}>
                  💡 100% usa 99.5% do saldo (margem para taxas)
                </Text>
              )}
            </View>

            {/* Preview do Total — só mostra quando tem dados */}
            {typeSelected && (
              <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.previewRow}>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewLabel, { color: colors.textSecondary }]}> 
                    Total {isBuy ? 'a Pagar' : 'a Receber'} ({String(quoteCurrency)})
                  </Text>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewValue, { color: colors.text }]}> 
                    {quoteCurrency === 'BRL' ? `R$ ${total.toFixed(2)}` : `${apiService.formatUSD(total)} ${quoteCurrency}`}
                  </Text>
                </View>
                
                {orderType === 'limit' && (
                  <>
                    <View style={styles.previewRow}>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewLabel, { color: colors.textSecondary }]}> 
                        Preço ({String(quoteCurrency)})
                      </Text>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewValue, { color: colors.text }]}> 
                        {parseFloat(price || '0') < 0.01 
                          ? parseFloat(price || '0').toFixed(10).replace(/\.?0+$/, '') 
                          : apiService.formatUSD(parseFloat(price || '0'))}
                      </Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewLabel, { color: colors.textSecondary }]}> 
                        Qtd. base ({String(baseCurrency)})
                      </Text>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewValue, { color: colors.text }]}> 
                        {String((() => {
                          const qty = baseAmount
                          if (qty === 0) return '0.00'
                          if (qty >= 1000000) return `${(qty / 1000000).toFixed(2)}Mi`
                          if (qty >= 1000) return `${(qty / 1000).toFixed(2)}K`
                          if (qty < 1) return qty.toFixed(8).replace(/\.?0+$/, '')
                          return qty.toFixed(4)
                        })())} {String(baseCurrency)}
                      </Text>
                    </View>
                    {isTokenTheQuote && (
                      <View style={styles.previewRow}>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewLabel, { color: colors.textSecondary }]}> 
                          Qtd. informada ({String(amountCurrency)})
                        </Text>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.previewValue, { color: colors.text }]}> 
                          {amountCurrency === 'BRL' 
                            ? `R$ ${parseFloat(amount || '0').toFixed(2)}`
                            : `${parseFloat(amount || '0').toFixed(4)} ${amountCurrency}`
                          }
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Botão Enviar — só habilita quando tudo preenchido */}
            {(() => {
              const sideColor = isBuy ? '#10b981' : (orderSide === 'sell' ? '#ef4444' : colors.border)
              const buttonLabel = createOrderLoading 
                ? 'Criando ordem...' 
                : !sideSelected 
                  ? 'Selecione Comprar ou Vender'
                  : !typeSelected 
                    ? 'Selecione Limit ou Market'
                    : !hasValidAmount 
                      ? 'Informe a quantidade'
                      : `${isBuy ? 'Comprar' : 'Vender'} ${tradingPair}`
              
              return (
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    { 
                      backgroundColor: isFormComplete ? (isBuy ? '#10b98120' : '#ef444420') : `${colors.border}15`,
                      borderColor: isFormComplete ? sideColor : colors.border,
                    },
                    !isFormComplete && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!isFormComplete}
                >
                  <Text style={[
                    styles.submitButtonText,
                    { color: isFormComplete ? sideColor : colors.textSecondary }
                  ]}>
                    {String(buttonLabel)}
                  </Text>
                </TouchableOpacity>
              )
            })()}

            {/* Erro de criação */}
            {createOrderError && (
              <View style={styles.errorContainerClean}>
                <Text style={[styles.errorMessageText, { color: '#ef4444' }]}>
                  {(() => {
                    const parsed = parseErrorResponse(createOrderError)
                    return parsed.message
                  })()}
                </Text>
                {(() => {
                  const parsed = parseErrorResponse(createOrderError)
                  return parsed.code ? (
                    <Text style={[styles.errorCodeText, { color: colors.textSecondary }]}>
                      Código: {parsed.code}
                    </Text>
                  ) : null
                })()}
              </View>
            )}
          </ScrollView>
        </View>
        </SafeAreaView>
      </View>

      {/* Modal de Confirmação de Ordem - DENTRO do modal principal */}
      <Modal
        visible={confirmVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setConfirmVisible(false)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setConfirmVisible(false)}>
          <Pressable style={{ width: '90%', maxWidth: 400 }} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.confirmContainer, { backgroundColor: colors.card }]}>
              {/* Header */}
              <View style={[styles.confirmHeader, { borderBottomColor: colors.border }]}>
                <Text style={{ fontSize: typography.emoji }}>{isBuy ? '🟢' : '🔴'}</Text>
                <Text style={[styles.confirmTitle, { color: colors.text }]}>
                  {t('trade.confirmOrder')}
                </Text>
              </View>

              {/* Resumo */}
              <View style={styles.confirmContent}>
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>{t('trade.pair')}</Text>
                  <Text style={[styles.confirmValue, { color: colors.text }]}>
                    {String(tradingPair)}
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>{t('trade.side')}</Text>
                  <Text style={[styles.confirmValue, { color: isBuy ? '#10b981' : '#ef4444' }]}>
                    {String(isBuy ? t('trade.buy') : t('trade.sell'))}
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>{t('trade.type')}</Text>
                  <Text style={[styles.confirmValue, { color: colors.text }]}>
                    {String((orderType || '').toUpperCase())}
                  </Text>
                </View>
                {orderType === 'limit' && (
                  <View style={styles.confirmRow}>
                    <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>{t('trade.price')}</Text>
                    <Text style={[styles.confirmValue, { color: colors.text }]}>
                      {String(isBrlQuote 
                        ? `R$ ${parseFloat(price || '0').toFixed(2)}`
                        : `$ ${parseFloat(price || '0') < 0.01 
                          ? parseFloat(price || '0').toFixed(10).replace(/\.?0+$/, '') 
                          : apiService.formatUSD(parseFloat(price || '0'))}`
                      )}
                    </Text>
                  </View>
                )}
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>{t('trade.quantity')}</Text>
                  <Text style={[styles.confirmValue, { color: colors.text }]}>
                    {String(isTokenTheQuote
                      ? (amountCurrency === 'BRL'
                          ? `R$ ${parseFloat(amount || '0').toFixed(2)}`
                          : `${parseFloat(amount || '0').toFixed(4)} ${amountCurrency}`)
                      : `${parseFloat(amount || '0') < 1 
                          ? parseFloat(amount || '0').toFixed(8).replace(/\.?0+$/, '') 
                          : parseFloat(amount || '0').toFixed(4)} ${baseCurrency}`
                    )}
                  </Text>
                </View>

                {/* Mostra conversão para base currency quando input é em quote */}
                {isTokenTheQuote && baseAmount > 0 && (
                  <View style={styles.confirmRow}>
                    <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>≈ Base ({String(baseCurrency)})</Text>
                    <Text style={[styles.confirmValue, { color: colors.textSecondary }]}>
                      {String(baseAmount < 1 
                        ? baseAmount.toFixed(8).replace(/\.?0+$/, '') 
                        : baseAmount.toFixed(4))} {String(baseCurrency)}
                    </Text>
                  </View>
                )}

                {/* Separador */}
                <View style={[styles.confirmDivider, { backgroundColor: colors.border }]} />

                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabelBold, { color: colors.text }]}>
                    {String(isBuy ? t('trade.totalToPay') : t('trade.totalToReceive'))}
                  </Text>
                  <Text style={[styles.confirmValueBold, { color: isBuy ? '#10b981' : '#ef4444' }]}>
                    {String(quoteCurrency === 'BRL' ? `R$ ${total.toFixed(2)}` : `${apiService.formatUSD(total)} ${quoteCurrency}`)}
                  </Text>
                </View>
              </View>

              {/* Botões */}
              <View style={styles.confirmFooter}>
                <TouchableOpacity 
                  style={[styles.confirmCancelBtn, { borderColor: colors.border }]} 
                  onPress={() => setConfirmVisible(false)}
                >
                  <Text style={[styles.confirmCancelText, { color: colors.text }]}>{t('common.back')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmOkBtn, { backgroundColor: isBuy ? '#10b981' : '#ef4444' }]} 
                  onPress={executeOrder}
                >
                  <Text style={styles.confirmOkText}>
                    {String(isBuy ? t('trade.confirmBuy') : t('trade.confirmSell'))}
                  </Text>
                </TouchableOpacity>
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
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
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
    fontSize: typography.h1,
    fontWeight: fontWeights.light,
  },
  content: {
    padding: 24,
  },
  tabs: {
    flexDirection: 'row',
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  tabActive: {
    // Applied via backgroundColor
  },
  tabText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.medium,
  },
  stepLabel: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
    marginBottom: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  sectionDisabled: {
    opacity: 0.4,
  },
  buttonDisabled: {
    // opacity controlled inline
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
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
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
    borderRadius: 20,
    width: "100%",
    maxWidth: 400,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  confirmTitle: {
    fontSize: typography.h4,
    fontWeight: fontWeights.bold,
  },
  confirmContent: {
    padding: 20,
    gap: 12,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confirmLabel: {
    fontSize: typography.body,
    fontWeight: fontWeights.regular,
  },
  confirmValue: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  confirmLabelBold: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
  },
  confirmValueBold: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
  },
  confirmDivider: {
    height: 1,
    marginVertical: 4,
  },
  confirmFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  confirmOkBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmOkText: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
    color: '#fff',
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

