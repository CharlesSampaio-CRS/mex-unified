import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Alert, Pressable, ActivityIndicator } from 'react-native'
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
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>

          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Header — padrão idêntico ao CreateAlertModal */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: colors.primary }]}>Fechar</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>
              {tradingPair || symbol.toUpperCase()}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            {/* Token info row — par, exchange e preço */}
            <View style={[styles.tokenRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.tokenIconWrap, { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}40` }]}>
                <Text style={[styles.tokenIconText, { color: colors.primary }]}>
                  {(tradingPair || symbol).charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.tokenInfoLeft}>
                <Text style={[styles.tokenSymbol, { color: colors.text }]}>{tradingPair || symbol.toUpperCase()}</Text>
                <Text style={[styles.tokenExchange, { color: colors.textSecondary }]}>
                  {exchangeName}{pairPriceLoading ? ' ⏳' : ''}
                </Text>
              </View>
              <View style={styles.tokenPriceWrap}>
                <Text style={[styles.tokenPrice, { color: colors.text }]}>
                  {parseFloat(price || '0') < 0.01
                    ? parseFloat(price || '0').toFixed(8).replace(/\.?0+$/, '')
                    : apiService.formatUSD(parseFloat(price || '0'))}
                </Text>
              </View>
            </View>

            {/* Par selector (só quando há mais de 1 par) */}
            {pairsLoading ? (
              <View style={[styles.formSection, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Buscando pares...</Text>
              </View>
            ) : pairsError ? (
              <View style={[styles.errorBox, { backgroundColor: '#ef444415' }]}>
                <Text style={styles.errorText}>⚠️ {pairsError}</Text>
              </View>
            ) : availablePairs.length > 1 ? (
              <View style={styles.formSection}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Par de Trading</Text>
                {availablePairs.length > 8 && (
                  <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={{ color: colors.textTertiary }}>🔍</Text>
                    <TextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      placeholder="Buscar par..."
                      placeholderTextColor={colors.textTertiary}
                      value={pairSearch}
                      onChangeText={setPairSearch}
                      autoCapitalize="characters"
                    />
                    {pairSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setPairSearch('')}>
                        <Text style={{ color: colors.textSecondary }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <ScrollView
                  horizontal={availablePairs.length <= 8}
                  showsHorizontalScrollIndicator={false}
                  style={{ maxHeight: availablePairs.length > 8 ? 120 : undefined }}
                >
                  <View style={[styles.pairChips, { flexWrap: availablePairs.length > 8 ? 'wrap' : 'nowrap' }]}>
                    {availablePairs
                      .filter(p => !pairSearch || p.symbol.toUpperCase().includes(pairSearch.toUpperCase()))
                      .map(pair => (
                        <TouchableOpacity
                          key={pair.symbol}
                          style={[styles.pairChip, {
                            backgroundColor: selectedPair === pair.symbol ? `${colors.primary}20` : colors.surface,
                            borderColor: selectedPair === pair.symbol ? colors.primary : colors.border,
                          }]}
                          onPress={() => { setSelectedPair(pair.symbol); setAmount(''); setSelectedPercent(null); }}
                        >
                          <Text style={[styles.pairChipText, {
                            color: selectedPair === pair.symbol ? colors.primary : colors.textSecondary,
                            fontWeight: selectedPair === pair.symbol ? fontWeights.bold : fontWeights.medium,
                          }]}>{pair.symbol}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            {/* Buy / Sell segmented */}
            <View style={styles.formSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Operação</Text>
              <View style={[styles.segmented, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.segmentItem, orderSide === 'buy' && { backgroundColor: '#00c076' }]}
                  onPress={() => { setOrderSide('buy'); setAmount(''); setSelectedPercent(null); }}
                  disabled={pairsLoading || !!pairsError}
                >
                  <Text style={[styles.segmentText, { color: orderSide === 'buy' ? '#fff' : colors.textSecondary }]}>
                    Comprar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentItem, orderSide === 'sell' && { backgroundColor: '#ff3b30' }]}
                  onPress={() => { setOrderSide('sell'); setAmount(''); setSelectedPercent(null); }}
                  disabled={pairsLoading || !!pairsError}
                >
                  <Text style={[styles.segmentText, { color: orderSide === 'sell' ? '#fff' : colors.textSecondary }]}>
                    Vender
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Tipo de Ordem */}
            <View style={[styles.formSection, !sideSelected && { opacity: 0.4 }]}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tipo de Ordem</Text>
              <View style={[styles.segmented, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {(['limit', 'market'] as const).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.segmentItem, orderType === type && { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setOrderType(type);
                      if (type === 'market') setPrice(currentPrice.toString());
                    }}
                    disabled={!sideSelected}
                  >
                    <Text style={[styles.segmentText, { color: orderType === type ? '#fff' : colors.textSecondary }]}>
                      {type === 'limit' ? 'Limit' : 'Market'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Preço (limit) */}
            {orderType === 'limit' && (
              <View style={styles.formSection}>
                <View style={styles.fieldLabelRow}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Preço ({String(quoteCurrency)})
                  </Text>
                  {priceDifference && (
                    <Text style={[styles.priceDiffBadge, { color: priceDifference.isHigher ? colors.success : colors.danger }]}>
                      {priceDifference.isHigher ? '+' : ''}{priceDifference.percentage.toFixed(2)}%
                    </Text>
                  )}
                </View>
                <View style={[styles.stepperWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      const v = parseFloat(price || '0');
                      const step = v >= 100 ? 1 : v >= 1 ? 0.01 : 0.0001;
                      setPrice(Math.max(0, v - step).toFixed(v < 1 ? 4 : 2));
                    }}
                  >
                    <Text style={[styles.stepperIcon, { color: colors.textSecondary }]}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.stepperInput, { color: colors.text }]}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      const v = parseFloat(price || '0');
                      const step = v >= 100 ? 1 : v >= 1 ? 0.01 : 0.0001;
                      setPrice((v + step).toFixed(v < 1 ? 4 : 2));
                    }}
                  >
                    <Text style={[styles.stepperIcon, { color: colors.textSecondary }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Quantidade */}
            <View style={[styles.formSection, !typeSelected && { opacity: 0.4 }]}>
              <View style={styles.fieldLabelRow}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Quantidade ({String(amountCurrency)})
                </Text>
                <Text style={[styles.availableText, { color: colors.textSecondary }]}>
                  Disp: {amountCurrency === 'BRL'
                    ? `R$ ${availableBalance.toFixed(2)}`
                    : `${availableBalance > 0 ? availableBalance.toFixed(amountCurrency === baseCurrency ? 8 : 4) : '--'} ${amountCurrency}`}
                </Text>
              </View>
              <View style={[styles.stepperWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => {
                    const v = parseFloat(amount || '0');
                    const step = v >= 1 ? 0.01 : 0.0001;
                    const next = Math.max(0, v - step);
                    setAmount(next > 0 ? next.toFixed(v < 1 ? 8 : 4) : '');
                    setSelectedPercent(null);
                  }}
                  disabled={!typeSelected}
                >
                  <Text style={[styles.stepperIcon, { color: colors.textSecondary }]}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.stepperInput, { color: colors.text }]}
                  value={amount}
                  onChangeText={(text) => { setAmount(text); setSelectedPercent(null); }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  editable={typeSelected}
                />
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => {
                    const v = parseFloat(amount || '0');
                    const step = v >= 1 ? 0.01 : 0.0001;
                    setAmount((v + step).toFixed(v < 1 ? 8 : 4));
                    setSelectedPercent(null);
                  }}
                  disabled={!typeSelected}
                >
                  <Text style={[styles.stepperIcon, { color: colors.textSecondary }]}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Percent grid */}
              <View style={styles.percentGrid}>
                {[25, 50, 75, 100].map(pct => (
                  <TouchableOpacity
                    key={pct}
                    style={[styles.percentBtn, {
                      backgroundColor: selectedPercent === pct ? `${colors.primary}20` : colors.surface,
                      borderColor: selectedPercent === pct ? colors.primary : colors.border,
                      opacity: typeSelected ? 1 : 0.4,
                    }]}
                    onPress={() => handlePercentage(pct)}
                    disabled={!typeSelected}
                  >
                    <Text style={[styles.percentBtnText, {
                      color: selectedPercent === pct ? colors.primary : colors.textSecondary,
                      fontWeight: selectedPercent === pct ? fontWeights.bold : fontWeights.medium,
                    }]}>
                      {pct === 100 ? 'Max' : `${pct}%`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Preview total */}
            {typeSelected && hasValidAmount && (
              <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                    {isBuy ? 'Total a Pagar' : 'Total a Receber'} ({String(quoteCurrency)})
                  </Text>
                  <Text style={[styles.previewValue, { color: isBuy ? '#00c076' : '#ff3b30' }]}>
                    {quoteCurrency === 'BRL' ? `R$ ${total.toFixed(2)}` : `${apiService.formatUSD(total)} ${quoteCurrency}`}
                  </Text>
                </View>
                {orderType === 'limit' && (
                  <>
                    <View style={styles.previewRow}>
                      <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                        Qtd. base ({String(baseCurrency)})
                      </Text>
                      <Text style={[styles.previewValue, { color: colors.text }]}>
                        {String((() => {
                          const qty = baseAmount;
                          if (qty === 0) return '0.00';
                          if (qty < 1) return qty.toFixed(8).replace(/\.?0+$/, '');
                          return qty.toFixed(4);
                        })())} {String(baseCurrency)}
                      </Text>
                    </View>
                    {isTokenTheQuote && (
                      <View style={styles.previewRow}>
                        <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                          Qtd. informada ({String(amountCurrency)})
                        </Text>
                        <Text style={[styles.previewValue, { color: colors.text }]}>
                          {amountCurrency === 'BRL'
                            ? `R$ ${parseFloat(amount || '0').toFixed(2)}`
                            : `${parseFloat(amount || '0').toFixed(4)} ${amountCurrency}`}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Erro de criação */}
            {createOrderError && (
              <View style={[styles.errorBox, { backgroundColor: '#ef444415' }]}>
                <Text style={styles.errorText}>{parseErrorResponse(createOrderError).message}</Text>
                {parseErrorResponse(createOrderError).code && (
                  <Text style={[styles.errorCodeText, { color: colors.textSecondary }]}>
                    Código: {parseErrorResponse(createOrderError).code}
                  </Text>
                )}
              </View>
            )}

          </ScrollView>

          {/* CTA Button */}
          <View style={[styles.ctaWrap, { borderTopColor: colors.border }]}>
            {(() => {
              const sideColor = isBuy ? '#00c076' : (orderSide === 'sell' ? '#ff3b30' : colors.border);
              const label = createOrderLoading
                ? 'Criando ordem...'
                : !sideSelected ? 'Selecione Comprar ou Vender'
                : !typeSelected ? 'Selecione Limit ou Market'
                : !hasValidAmount ? 'Informe a quantidade'
                : `${isBuy ? 'Comprar' : 'Vender'} ${String(baseCurrency)}`;

              return (
                <TouchableOpacity
                  style={[styles.ctaButton, {
                    backgroundColor: isFormComplete ? sideColor : colors.surface,
                    borderWidth: 1,
                    borderColor: isFormComplete ? sideColor : colors.border,
                    opacity: isFormComplete ? 1 : 0.6,
                  }]}
                  onPress={handleSubmit}
                  disabled={!isFormComplete}
                  activeOpacity={0.85}
                >
                  {createOrderLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={[styles.ctaText, { color: isFormComplete ? '#fff' : colors.textSecondary }]}>
                        {String(label)}
                      </Text>
                  }
                </TouchableOpacity>
              );
            })()}
          </View>

        </View>
      </View>
      {/* Modal de Confirmação de Ordem */}
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
                  <Text style={[styles.confirmValue, { color: isBuy ? '#00c076' : '#ff3b30' }]}>
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
                  <Text style={[styles.confirmValueBold, { color: isBuy ? '#00c076' : '#ff3b30' }]}>
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
                  style={[styles.confirmOkBtn, { backgroundColor: isBuy ? '#00c076' : '#ff3b30' }]} 
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
  // ─── Overlay / Sheet ───────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },

  // ─── Handle ────────────────────────────────────────────────
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },

  // ─── Header ────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  cancelBtn: {
    padding: 4,
  },
  cancelText: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },
  title: {
    fontSize: typography.h4,
    fontWeight: fontWeights.bold,
  },
  headerSpacer: {
    width: 60,
  },

  // ─── Scroll ────────────────────────────────────────────────
  scrollContent: {
    paddingBottom: 20,
  },

  // ─── Token row ─────────────────────────────────────────────
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    minHeight: 80,
  },
  tokenIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  tokenIconText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.bold,
  },
  tokenInfoLeft: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
  },
  tokenExchange: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    marginTop: 2,
  },
  tokenPriceWrap: {
    alignItems: 'flex-end',
  },
  tokenPrice: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
  },

  // ─── Form sections ─────────────────────────────────────────
  formSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  fieldLabel: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  availableText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
  },
  priceDiffBadge: {
    fontSize: typography.caption,
    fontWeight: fontWeights.bold,
  },

  // ─── Segmented control ─────────────────────────────────────
  segmented: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },

  // ─── Par chips ─────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.bodySmall,
    paddingVertical: 2,
  },
  pairChips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  pairChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  pairChipText: {
    fontSize: typography.bodySmall,
  },

  // ─── Stepper inputs ────────────────────────────────────────
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepperBtn: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperIcon: {
    fontSize: typography.h3,
    fontWeight: fontWeights.light,
    lineHeight: typography.h3 + 2,
  },
  stepperInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.h3,
    fontWeight: fontWeights.semibold,
    paddingVertical: 16,
  },

  // ─── Percent grid ──────────────────────────────────────────
  percentGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  percentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  percentBtnText: {
    fontSize: typography.bodySmall,
  },

  // ─── Preview card ──────────────────────────────────────────
  previewCard: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  previewLabel: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
    flex: 1,
  },
  previewValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
    textAlign: 'right',
  },

  // ─── Error box ─────────────────────────────────────────────
  errorBox: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: '#ef4444',
    marginBottom: 4,
  },
  errorCodeText: {
    fontSize: typography.caption,
    opacity: 0.7,
    marginTop: 4,
  },

  // ─── CTA ───────────────────────────────────────────────────
  ctaWrap: {
    padding: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  ctaButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#19a1e6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaText: {
    fontSize: typography.bodyLarge,
    fontWeight: fontWeights.bold,
    color: '#FFFFFF',
  },

  // ─── Confirm modal ─────────────────────────────────────────
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmContainer: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  confirmOkBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmOkText: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
    color: '#fff',
  },
})
