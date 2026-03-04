import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Alert, Pressable, Image, ActivityIndicator } from 'react-native'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { useOrders } from '@/contexts/OrdersContext'
import { useBalance } from '@/contexts/BalanceContext'
import { capitalizeExchangeName, getExchangeName, getExchangeId } from '@/lib/exchange-helpers'
import { typography, fontWeights } from '@/lib/typography'
import { apiService } from '@/services/api'
import { notify } from '@/services/notify'
import { getExchangeLogo } from '@/lib/exchange-logos'
import { ConfirmModal } from '@/components/ConfirmModal'

interface ExchangeItem {
  exchange_id: string
  exchange_type: string
  exchange_name: string
  is_active: boolean
  logo?: string
  icon?: string
  country?: string
  url?: string
  created_at: string
  linked_at: string
  api_key_expiry_days?: number
  days_until_expiry?: number
  api_key_expires_at?: string
}

interface CreateOrderModalProps {
  visible: boolean
  onClose: () => void
  /** Dados para clonar uma ordem existente */
  cloneData?: {
    exchangeId: string
    exchangeName: string
    symbol: string       // par completo ex: "BTC/USDT"
    side: 'buy' | 'sell'
    type: 'market' | 'limit'
    price: number
    amount: number
  }
}

type OrderType = 'market' | 'limit'
type OrderSide = 'buy' | 'sell'
type Step = 'exchange' | 'token' | 'pair' | 'order'

interface PairInfo {
  symbol: string
  base: string
  quote: string
  active: boolean
  min_amount: number
  min_cost: number
}

export function CreateOrderModal({ visible, onClose, cloneData }: CreateOrderModalProps) {
  const { colors } = useTheme()
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const { addOrder, refresh: refreshOrders, refreshExchange } = useOrders()
  const { data: balanceData, refresh: refreshBalance } = useBalance()

  // Step navigation
  const [step, setStep] = useState<Step>('exchange')

  // Step 1: Exchange selection
  const [exchanges, setExchanges] = useState<ExchangeItem[]>([])
  const [exchangesLoading, setExchangesLoading] = useState(false)
  const [selectedExchange, setSelectedExchange] = useState<ExchangeItem | null>(null)

  // Step 2: Token input
  const [tokenInput, setTokenInput] = useState('')

  // Step 3: Pair selection
  const [availablePairs, setAvailablePairs] = useState<PairInfo[]>([])
  const [pairsLoading, setPairsLoading] = useState(false)
  const [pairsError, setPairsError] = useState<string | null>(null)
  const [selectedPair, setSelectedPair] = useState<PairInfo | null>(null)
  const [pairPriceLoading, setPairPriceLoading] = useState(false)
  const [pairSearchFilter, setPairSearchFilter] = useState('')

  // Step 4: Order form
  const [orderSide, setOrderSide] = useState<OrderSide | null>(null)
  const [orderType, setOrderType] = useState<OrderType | null>(null)
  const [amount, setAmount] = useState('')
  const [price, setPrice] = useState('')
  const [amountInQuote, setAmountInQuote] = useState(false) // Toggle: digitar em quote (BRL/USDT) em vez de base (ETH/BTC)
  const [createOrderLoading, setCreateOrderLoading] = useState(false)
  const [createOrderError, setCreateOrderError] = useState<string | null>(null)
  const [confirmVisible, setConfirmVisible] = useState(false)

  // Ref para impedir que o auto-fetch de preço sobrescreva o preço clonado
  const isCloneModeRef = useRef(false)

  // Reset everything on open (or setup clone mode)
  useEffect(() => {
    if (visible) {
      // Sempre reseta estado base
      setExchanges([])
      setAvailablePairs([])
      setPairsLoading(false)
      setPairsError(null)
      setPairPriceLoading(false)
      setPairSearchFilter('')
      setCreateOrderLoading(false)
      setCreateOrderError(null)
      setConfirmVisible(false)
      setAmountInQuote(false)

      if (cloneData) {
        // 🔁 Modo Clone: pula direto para o formulário com dados pré-preenchidos
        isCloneModeRef.current = true
        const [base, quote] = cloneData.symbol.split('/')
        setSelectedExchange({
          exchange_id: cloneData.exchangeId,
          exchange_name: cloneData.exchangeName,
          exchange_type: '',
          is_active: true,
          created_at: '',
          linked_at: '',
        })
        setTokenInput(base || '')
        setSelectedPair({
          symbol: cloneData.symbol,
          base: base || '',
          quote: quote || '',
          active: true,
          min_amount: 0,
          min_cost: 0,
        })
        setOrderSide(cloneData.side)
        setOrderType(cloneData.type)
        setPrice(cloneData.price > 0 ? String(cloneData.price) : '')
        setAmount(cloneData.amount > 0 ? String(cloneData.amount) : '')
        setStep('order')

        // Fetch exchanges em background (para o botão "voltar" funcionar)
        fetchExchanges()
      } else {
        isCloneModeRef.current = false
        // Modo normal: inicia do início
        setStep('exchange')
        setSelectedExchange(null)
        setTokenInput('')
        setSelectedPair(null)
        setOrderSide(null)
        setOrderType(null)
        setAmount('')
        setPrice('')

        // Fetch connected exchanges
        fetchExchanges()
      }
    }
  }, [visible])

  // Fetch connected exchanges
  const fetchExchanges = async () => {
    if (!user?.id) return
    setExchangesLoading(true)
    try {
      // Usa endpoint JWT: GET /api/v1/user/exchanges
      const result = await apiService.getUserExchangesWithCredentials()
      if (result.success && result.exchanges) {
        // Only show active exchanges
        const active = result.exchanges.filter((e: ExchangeItem) => e.is_active !== false)
        setExchanges(active)
      }
    } catch (error: any) {
      console.error('❌ Error fetching exchanges:', error)
      notify.orderError(addNotification, {
        symbol: '',
        action: 'Carregar Exchanges',
        error: error.message || 'Erro ao carregar exchanges',
      })
    } finally {
      setExchangesLoading(false)
    }
  }

  // Fetch available pairs for selected exchange + token
  const fetchPairs = async () => {
    if (!selectedExchange || !tokenInput.trim()) return
    setPairsLoading(true)
    setPairsError(null)
    setAvailablePairs([])
    setSelectedPair(null)

    try {
      const exchangeId = selectedExchange.exchange_id || (selectedExchange as any)._id || ''
      const result = await apiService.getAvailablePairs(exchangeId, tokenInput.trim().toUpperCase())
      
      if (result.success && result.pairs.length > 0) {
        const sym = tokenInput.trim().toUpperCase()

        // Filter: pairs where token is base OR quote
        let relevantPairs = result.pairs.filter(p => p.base === sym)
        const isQuoteOnly = relevantPairs.length === 0
        if (isQuoteOnly) {
          relevantPairs = result.pairs.filter(p => p.quote === sym)
        }

        // Sort by priority
        const priorityOrder = ['USDT', 'BRL', 'USDC', 'BTC', 'ETH', 'EUR']
        const sorted = relevantPairs.sort((a, b) => {
          const keyA = isQuoteOnly ? a.base : a.quote
          const keyB = isQuoteOnly ? b.base : b.quote
          const aIdx = priorityOrder.indexOf(keyA)
          const bIdx = priorityOrder.indexOf(keyB)
          return (aIdx >= 0 ? aIdx : 999) - (bIdx >= 0 ? bIdx : 999)
        })

        // Sem limite — mostra todos, com search quando >12
        setAvailablePairs(sorted)
        setPairSearchFilter('')

        if (sorted.length === 1) {
          // Auto-seleciona e vai direto para order step com fetch de preço
          handleSelectPair(sorted[0])
        }
      } else {
        setPairsError(`Nenhum par de trading encontrado para ${tokenInput.toUpperCase()} nesta exchange`)
      }
    } catch (error: any) {
      console.error('❌ Error fetching pairs:', error)
      setPairsError(error.message || 'Erro ao buscar pares')
    } finally {
      setPairsLoading(false)
    }
  }

  // Handle exchange selection → go to token step
  const handleSelectExchange = (exchange: ExchangeItem) => {
    setSelectedExchange(exchange)
    setTokenInput('')
    setAvailablePairs([])
    setSelectedPair(null)
    setStep('token')
  }

  // Handle token search → go to pair step
  const handleSearchPairs = () => {
    if (!tokenInput.trim()) {
      Alert.alert('Atenção', 'Digite o símbolo do token (ex: BTC, ETH, SOL)')
      return
    }
    setStep('pair')
    fetchPairs()
  }

  // 📈 Busca o preço atual do par na exchange (reutilizável)
  const fetchCurrentPrice = useCallback(async (pair?: PairInfo | null, exchange?: ExchangeItem | null) => {
    const pairToUse = pair || selectedPair
    const exchangeToUse = exchange || selectedExchange
    if (!pairToUse || !exchangeToUse) return

    const exId = exchangeToUse.exchange_id || (exchangeToUse as any)?._id || ''
    if (!exId || !pairToUse.symbol) return

    setPairPriceLoading(true)
    try {
      const result = await apiService.getPairTicker(exId, pairToUse.symbol)
      if (result.success && result.ticker?.last > 0) {
        const lastPrice = result.ticker.last
        // Preço é sempre na quote currency do par (USD-based: USDT, BRL, USDC, etc.)
        setPrice(lastPrice < 0.01 ? lastPrice.toFixed(10).replace(/\.?0+$/, '') : lastPrice.toString())
        console.log(`💰 Preço atualizado: ${pairToUse.symbol} = ${lastPrice}`)
      }
    } catch (error: any) {
      console.warn('⚠️ Could not fetch pair price:', error.message)
    } finally {
      setPairPriceLoading(false)
    }
  }, [selectedPair, selectedExchange])

  // Handle pair selection → go to order step (preço será buscado pelo useEffect ao selecionar limit)
  const handleSelectPair = async (pair: PairInfo) => {
    setSelectedPair(pair)
    setOrderSide(null)
    setOrderType(null)
    setAmount('')
    setPrice('')
    setAmountInQuote(false)
    setCreateOrderError(null)
    setStep('order')
  }

  // 🔄 AUTO-FETCH: Sempre que selecionar "limit", busca o preço atualizado
  // (Pula quando veio de clone — o preço já foi preenchido pelo cloneData)
  useEffect(() => {
    if (orderType && selectedPair && selectedExchange) {
      if (isCloneModeRef.current) {
        // Primeira vez no modo clone → não sobrescreve o preço clonado
        isCloneModeRef.current = false
        return
      }
      // Busca preço atual para limit E market (market precisa do preço para % de saldo)
      fetchCurrentPrice()
    }
  }, [orderType])

  // Go back one step
  const handleBack = () => {
    if (step === 'token') {
      setStep('exchange')
      setSelectedExchange(null)
    } else if (step === 'pair') {
      setStep('token')
      setAvailablePairs([])
      setSelectedPair(null)
      setPairsError(null)
      setPairSearchFilter('')
    } else if (step === 'order') {
      setStep('pair')
      setSelectedPair(null)
      setOrderSide(null)
      setOrderType(null)
      setAmount('')
      setPrice('')
      setAmountInQuote(false)
      setCreateOrderError(null)
    }
  }

  // Derived values for order step
  const tradingPair = selectedPair?.symbol || ''
  const baseCurrency = selectedPair?.base || ''
  const quoteCurrency = selectedPair?.quote || ''
  const isBrlQuote = quoteCurrency === 'BRL'
  const exchangeName = selectedExchange?.exchange_name || ''
  const exchangeId = selectedExchange?.exchange_id || ''

  // Detecta se o token digitado é a quote do par (ex: digitou BRL, par BTC/BRL)
  const tokenUpper = tokenInput.trim().toUpperCase()
  const isTokenTheQuote = tokenUpper === quoteCurrency
  const isTokenTheBase = tokenUpper === baseCurrency

  // Quando o token é a QUOTE, o campo quantidade representa a quote currency
  // OU quando o usuário ativou o toggle amountInQuote (ex: quer digitar em BRL/USDT)
  const isAmountInQuote = isTokenTheQuote || amountInQuote
  const amountCurrency = isAmountInQuote ? quoteCurrency : baseCurrency

  const amountNum = parseFloat(amount || '0')
  const priceNum = parseFloat(price || '0')

  // Total em quote currency:
  // - Se amount em base (caso normal): total = amount * price
  // - Se amount em quote (isAmountInQuote): total = amount (já é em quote)
  const total = isAmountInQuote ? amountNum : (amountNum * priceNum)

  // Quantidade em base currency para enviar ao CCXT (sempre requer base):
  const baseAmount = isAmountInQuote
    ? (priceNum > 0 ? amountNum / priceNum : 0)
    : amountNum

  const isBuy = orderSide === 'buy'
  const sideSelected = orderSide !== null
  const typeSelected = orderType !== null
  const hasValidAmount = amountNum > 0
  const hasValidPrice = orderType === 'market' || (orderType === 'limit' && priceNum > 0)
  const isFormComplete = sideSelected && typeSelected && hasValidAmount && hasValidPrice && !createOrderLoading && !pairPriceLoading

  // ============================================================
  // Calcula o saldo disponível (free) para a currency relevante na exchange selecionada
  // Compra: precisa de quote currency (ex: USDT, BRL)
  // Venda: precisa de base currency (ex: BTC, ETH)
  // ============================================================
  const getAvailableBalance = useCallback((): number => {
    if (!balanceData?.exchanges || !selectedExchange || !selectedPair) return 0
    
    const exId = selectedExchange.exchange_id || (selectedExchange as any)._id || ''
    
    // Encontra a exchange certa nos dados de balance
    const exchangeData = balanceData.exchanges.find((ex: any) => {
      const id = getExchangeId(ex)
      return id === exId || id === selectedExchange.exchange_name?.toLowerCase()
    })
    
    if (!exchangeData) return 0
    
    const balances = exchangeData.balances || exchangeData.tokens || {}
    
    // Determina qual currency precisa verificar:
    // - Se isAmountInQuote e está comprando: precisa do quote (gasta quote pra comprar base)
    // - Se isAmountInQuote e está vendendo: precisa do quote (vende quote)
    // - Normal comprando: precisa do quote (gasta quote pra comprar base) 
    // - Normal vendendo: precisa do base (vende base por quote)
    let relevantCurrency: string
    if (orderSide === 'buy') {
      // Compra sempre gasta quote currency
      relevantCurrency = quoteCurrency
    } else {
      // Venda sempre gasta base currency (ou quote se isAmountInQuote)
      relevantCurrency = isAmountInQuote ? quoteCurrency : baseCurrency
    }
    
    const token = balances[relevantCurrency] || balances[relevantCurrency?.toUpperCase()]
    if (!token) return 0
    
    const free = typeof token.free === 'number' ? token.free : parseFloat(token.free || '0')
    return free > 0 ? free : Math.max(0, (token.total || 0) - (typeof token.used === 'number' ? token.used : parseFloat(token.used || '0')))
  }, [balanceData, selectedExchange, selectedPair, orderSide, isAmountInQuote, baseCurrency, quoteCurrency])

  // Calcula o amount com base na porcentagem do saldo disponível
  // Compra: % do saldo USDT (quote) → converte para base usando preço atual
  // Venda: % do saldo do token (base) → valor direto
  const handlePercentage = useCallback(async (pct: number) => {
    const available = getAvailableBalance()
    
    if (available <= 0) {
      Alert.alert('Saldo Indisponível', `Não há saldo suficiente na exchange para esta operação.\n\nAtualize seus saldos na tela principal.`)
      return
    }
    
    const portionValue = available * (pct / 100)
    
    if (orderSide === 'buy') {
      // Compra: saldo é em quote (USDT). Precisa do preço para converter em base.
      let currentPrice = priceNum

      // Se não tem preço, busca agora
      if (currentPrice <= 0 && selectedPair && selectedExchange) {
        try {
          const exId = selectedExchange.exchange_id || (selectedExchange as any)?._id || ''
          const result = await apiService.getPairTicker(exId, selectedPair.symbol)
          if (result.success && result.ticker?.last > 0) {
            currentPrice = result.ticker.last
            setPrice(currentPrice < 0.01 ? currentPrice.toFixed(10).replace(/\.?0+$/, '') : currentPrice.toString())
          }
        } catch (e) {
          console.warn('⚠️ Could not fetch price for %:', e)
        }
      }

      if (isAmountInQuote) {
        // Amount em quote (BRL/USDT): define direto o valor em quote
        setAmount(portionValue < 1 ? portionValue.toFixed(8).replace(/\.?0+$/, '') : portionValue.toFixed(2))
      } else if (currentPrice > 0) {
        // Amount em base (ETH/BTC): converte quote → base usando preço
        const baseAmt = portionValue / currentPrice
        setAmount(baseAmt.toFixed(8).replace(/\.?0+$/, ''))
      } else {
        // Sem preço — muda para modo quote
        setAmountInQuote(true)
        setAmount(portionValue < 1 ? portionValue.toFixed(8).replace(/\.?0+$/, '') : portionValue.toFixed(2))
      }
    } else {
      // Venda: saldo em base (SOL, BTC, etc.) — valor direto
      setAmount(portionValue.toFixed(8).replace(/\.?0+$/, ''))
    }
  }, [getAvailableBalance, orderSide, isAmountInQuote, priceNum, orderType, selectedPair, selectedExchange])

  // Handle submit → show confirm
  const handleSubmit = () => {
    if (!orderSide || !orderType) return

    if (!hasValidAmount) {
      Alert.alert('Erro', 'Digite uma quantidade válida')
      return
    }

    if (orderType === 'limit' && !hasValidPrice) {
      Alert.alert('Erro', 'Digite um preço válido para ordem limit')
      return
    }

    if (!user?.id) {
      Alert.alert('Erro', 'Usuário não autenticado')
      return
    }

    setConfirmVisible(true)
  }

  // Execute order creation
  const executeOrder = async () => {
    if (!orderSide || !orderType || !user?.id) return
    setConfirmVisible(false)
    setCreateOrderLoading(true)
    setCreateOrderError(null)

    const amountVal = parseFloat(amount)
    const priceVal = parseFloat(price)
    const isBuy = orderSide === 'buy'

    // CCXT create_order espera amount em BASE currency sempre.
    // Se o campo quantidade está em quote (isAmountInQuote), converte para base.
    const amountForApi = isAmountInQuote
      ? (priceVal > 0 ? amountVal / priceVal : 0)
      : amountVal

    try {
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
        // 1. Close modal
        onClose()

        // 2. Notification: order created
        notify.orderCreated(addNotification, {
          symbol: tradingPair,
          side: orderSide,
          amount: amountForApi,
          price: priceVal,
          type: orderType,
          exchange: exchangeName,
        })

        // 3. Optimistic insertion for limit orders
        if (orderType === 'limit') {
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

        // 4. Sync in background — ⚡ apenas esta exchange
        setTimeout(() => {
          refreshExchange(exchangeId).catch(console.error)
          refreshBalance().catch(console.error)
        }, 3000)
      } else {
        const errorMsg = result.details || result.error || result.message || 'Erro ao criar ordem'
        setCreateOrderError(errorMsg)
        notify.orderError(addNotification, {
          symbol: tradingPair,
          action: 'Criar Ordem',
          error: errorMsg,
        })
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Não foi possível criar a ordem'
      setCreateOrderError(errorMsg)
      notify.orderError(addNotification, {
        symbol: tradingPair,
        action: 'Criar Ordem',
        error: errorMsg,
      })
    } finally {
      setCreateOrderLoading(false)
    }
  }

  // ============================================================
  // RENDER: Step 1 — Exchange Selection
  // ============================================================
  const renderExchangeStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.stepBadgeText}>1</Text>
        </View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Selecione a Exchange</Text>
      </View>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Escolha a exchange onde deseja criar a ordem
      </Text>

      {exchangesLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Carregando exchanges...
          </Text>
        </View>
      ) : exchanges.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Nenhuma exchange conectada
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
            Conecte uma exchange na aba de configurações
          </Text>
        </View>
      ) : (
        <View style={styles.exchangeList}>
          {exchanges.map((exchange) => {
            const logo = getExchangeLogo(exchange.exchange_name || exchange.exchange_type)
            return (
              <TouchableOpacity
                key={exchange.exchange_id}
                style={[styles.exchangeItem, { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border 
                }]}
                activeOpacity={0.7}
                onPress={() => handleSelectExchange(exchange)}
              >
                <View style={styles.exchangeItemLeft}>
                  <View style={styles.exchangeLogoWrap}>
                    {logo ? (
                      <Image source={logo} style={styles.exchangeLogo} resizeMode="contain" />
                    ) : (
                      <Ionicons name="business-outline" size={20} color={colors.textSecondary} />
                    )}
                  </View>
                  <View>
                    <Text style={[styles.exchangeName, { color: colors.text }]}>
                      {exchange.exchange_name}
                    </Text>
                    <Text style={[styles.exchangeStatus, { color: colors.success }]}>
                      Conectada
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            )
          })}
        </View>
      )}
    </View>
  )

  // ============================================================
  // RENDER: Step 2 — Token Input
  // ============================================================
  const renderTokenStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.stepBadgeText}>2</Text>
        </View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Digite o Token</Text>
      </View>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Informe o símbolo do token que deseja negociar
      </Text>

      {/* Selected exchange chip */}
      <View style={[styles.selectedChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.exchangeLogoWrapSmall}>
          {getExchangeLogo(exchangeName) ? (
            <Image source={getExchangeLogo(exchangeName)} style={styles.exchangeLogoSmall} resizeMode="contain" />
          ) : null}
        </View>
        <Text style={[styles.selectedChipText, { color: colors.text }]}>{exchangeName}</Text>
      </View>

      <View style={[styles.tokenInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.tokenInput, { color: colors.text }]}
          placeholder="Ex: BTC, ETH, SOL, BRL..."
          placeholderTextColor={colors.textTertiary}
          value={tokenInput}
          onChangeText={(text) => setTokenInput(text.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={true}
          returnKeyType="search"
          onSubmitEditing={handleSearchPairs}
        />
        {tokenInput.length > 0 && (
          <TouchableOpacity onPress={() => setTokenInput('')}>
            <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick token buttons */}
      <View style={styles.quickTokens}>
        {['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'USDT', 'BRL'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.quickTokenChip,
              {
                backgroundColor: tokenInput === t ? colors.primary : colors.surface,
                borderColor: tokenInput === t ? colors.primary : colors.border,
              }
            ]}
            onPress={() => setTokenInput(t)}
          >
            <Text style={[
              styles.quickTokenText,
              { color: tokenInput === t ? '#fff' : colors.text }
            ]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          { backgroundColor: tokenInput.trim() ? colors.primary : colors.border }
        ]}
        onPress={handleSearchPairs}
        disabled={!tokenInput.trim()}
        activeOpacity={0.7}
      >
        <Ionicons name="search-outline" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Buscar Pares</Text>
      </TouchableOpacity>
    </View>
  )

  // ============================================================
  // RENDER: Step 3 — Pair Selection
  // ============================================================
  const renderPairStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.stepBadgeText}>3</Text>
        </View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Selecione o Par</Text>
      </View>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Escolha o par de trading para {tokenInput.toUpperCase()}
      </Text>

      {/* Breadcrumb chips */}
      <View style={styles.breadcrumbRow}>
        <View style={[styles.selectedChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.exchangeLogoWrapSmall}>
            {getExchangeLogo(exchangeName) ? (
              <Image source={getExchangeLogo(exchangeName)} style={styles.exchangeLogoSmall} resizeMode="contain" />
            ) : null}
          </View>
          <Text style={[styles.selectedChipText, { color: colors.text }]}>{exchangeName}</Text>
        </View>
        <View style={[styles.selectedChip, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
          <Text style={[styles.selectedChipText, { color: colors.primary }]}>{tokenInput.toUpperCase()}</Text>
        </View>
      </View>

      {pairsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Buscando pares para {tokenInput.toUpperCase()}...
          </Text>
        </View>
      ) : pairsError ? (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: typography.displayLarge }}>⚠️</Text>
          <Text style={[styles.emptyText, { color: '#ef4444' }]}>{pairsError}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { borderColor: colors.border }]}
            onPress={() => { setStep('token'); setPairsError(null) }}
          >
            <Ionicons name="arrow-back-outline" size={16} color={colors.text} />
            <Text style={[styles.retryButtonText, { color: colors.text }]}>Tentar outro token</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Search para listas grandes (>12 pares) */}
          {availablePairs.length > 12 && (
            <View style={[{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginBottom: 8,
              gap: 8,
            }]}>
              <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
              <TextInput
                style={{ flex: 1, fontSize: typography.body, color: colors.text, paddingVertical: 2 }}
                placeholder="Buscar par... (ex: BTC, ETH, SOL)"
                placeholderTextColor={colors.textTertiary}
                value={pairSearchFilter}
                onChangeText={setPairSearchFilter}
                autoCapitalize="characters"
              />
              {pairSearchFilter.length > 0 && (
                <TouchableOpacity onPress={() => setPairSearchFilter('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
              <Text style={{ fontSize: typography.tiny, color: colors.textTertiary }}>
                {availablePairs.length} pares
              </Text>
            </View>
          )}
          <ScrollView 
            showsVerticalScrollIndicator={availablePairs.length > 12}
            style={{ maxHeight: availablePairs.length > 12 ? 280 : undefined }}
            nestedScrollEnabled={true}
          >
            <View style={styles.pairGrid}>
              {availablePairs
                .filter(pair => !pairSearchFilter || pair.symbol.toUpperCase().includes(pairSearchFilter.toUpperCase()))
                .map((pair) => (
                <TouchableOpacity
                  key={pair.symbol}
                  style={[
                    styles.pairChip,
                    {
                      backgroundColor: selectedPair?.symbol === pair.symbol ? colors.primary : colors.surface,
                      borderColor: selectedPair?.symbol === pair.symbol ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => handleSelectPair(pair)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.pairChipText,
                    { color: selectedPair?.symbol === pair.symbol ? '#fff' : colors.text }
                  ]}>
                    {pair.symbol}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </>
      )}
    </View>
  )

  // ============================================================
  // RENDER: Step 4 — Order Form
  // ============================================================
  const renderOrderStep = () => {
    const isBuy = orderSide === 'buy'

    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.stepBadgeText}>4</Text>
          </View>
          <Text style={[styles.stepTitle, { color: colors.text }]}>Criar Ordem</Text>
        </View>

        {/* Summary breadcrumb */}
        <View style={styles.breadcrumbRow}>
          <View style={[styles.selectedChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.exchangeLogoWrapSmall}>
              {getExchangeLogo(exchangeName) ? (
                <Image source={getExchangeLogo(exchangeName)} style={styles.exchangeLogoSmall} resizeMode="contain" />
              ) : null}
            </View>
            <Text style={[styles.selectedChipText, { color: colors.text }]}>{exchangeName}</Text>
          </View>
          <View style={[styles.selectedChip, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
            <Text style={[styles.selectedChipText, { color: colors.primary }]}>{tradingPair}</Text>
          </View>
        </View>

        {/* Side selector */}
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Direção</Text>
        <View style={styles.sideRow}>
          <TouchableOpacity
            style={[
              styles.sideButton,
              {
                backgroundColor: orderSide === 'buy' ? colors.success : colors.surface,
                borderColor: orderSide === 'buy' ? colors.success : colors.border,
              }
            ]}
            onPress={() => setOrderSide('buy')}
          >
            <Ionicons name="arrow-up-outline" size={18} color={orderSide === 'buy' ? '#fff' : colors.success} />
            <Text style={[styles.sideButtonText, { color: orderSide === 'buy' ? '#fff' : colors.text }]}>
              Compra
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sideButton,
              {
                backgroundColor: orderSide === 'sell' ? colors.danger : colors.surface,
                borderColor: orderSide === 'sell' ? colors.danger : colors.border,
              }
            ]}
            onPress={() => setOrderSide('sell')}
          >
            <Ionicons name="arrow-down-outline" size={18} color={orderSide === 'sell' ? '#fff' : colors.danger} />
            <Text style={[styles.sideButtonText, { color: orderSide === 'sell' ? '#fff' : colors.text }]}>
              Venda
            </Text>
          </TouchableOpacity>
        </View>

        {/* Order type selector */}
        {sideSelected && (
          <>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tipo de Ordem</Text>
            <View style={styles.sideRow}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  {
                    backgroundColor: orderType === 'limit' ? colors.primary : colors.surface,
                    borderColor: orderType === 'limit' ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => setOrderType('limit')}
              >
                <Text style={[styles.typeButtonText, { color: orderType === 'limit' ? '#fff' : colors.text }]}>
                  Limit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  {
                    backgroundColor: orderType === 'market' ? colors.primary : colors.surface,
                    borderColor: orderType === 'market' ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => setOrderType('market')}
              >
                <Text style={[styles.typeButtonText, { color: orderType === 'market' ? '#fff' : colors.text }]}>
                  Market
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Price input (limit only) */}
        {typeSelected && orderType === 'limit' && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>
                Preço ({quoteCurrency}) {pairPriceLoading ? '⏳' : ''}
              </Text>
              {/* Botão refresh preço */}
              <TouchableOpacity
                onPress={() => fetchCurrentPrice()}
                disabled={pairPriceLoading}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                  backgroundColor: colors.primary + '15',
                  opacity: pairPriceLoading ? 0.5 : 1,
                }}
              >
                {pairPriceLoading ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                )}
                <Text style={{ fontSize: typography.tiny, color: colors.primary, fontWeight: fontWeights.medium }}>
                  Atualizar
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.inputPrefix, { color: colors.textSecondary }]}>
                {isBrlQuote ? 'R$' : '$'}
              </Text>
              <TextInput
                style={[styles.formInput, { color: colors.text }]}
                placeholder={pairPriceLoading ? 'Buscando preço...' : '0.00'}
                placeholderTextColor={colors.textTertiary}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                autoFocus={!pairPriceLoading}
              />
            </View>
          </>
        )}

        {/* Amount input */}
        {typeSelected && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>
                Quantidade ({amountCurrency})
              </Text>
              {/* Toggle base/quote — só mostra se não é isTokenTheQuote (já fixo) */}
              {!isTokenTheQuote && (
                <TouchableOpacity 
                  onPress={() => { setAmountInQuote(!amountInQuote); setAmount('') }}
                  style={{ 
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                    backgroundColor: colors.primary + '15',
                  }}
                >
                  <Ionicons name="swap-horizontal-outline" size={14} color={colors.primary} />
                  <Text style={{ fontSize: typography.tiny, color: colors.primary, fontWeight: fontWeights.medium }}>
                    {amountInQuote ? `Digitar em ${baseCurrency}` : `Digitar em ${quoteCurrency}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {isAmountInQuote && (
                <Text style={[styles.inputPrefix, { color: colors.textSecondary }]}>
                  {isBrlQuote ? 'R$' : '$'}
                </Text>
              )}
              <TextInput
                style={[styles.formInput, { color: colors.text }]}
                placeholder={isAmountInQuote ? '0.00' : '0.00000000'}
                placeholderTextColor={colors.textTertiary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                autoFocus={orderType === 'market' && !pairPriceLoading}
              />
              <Text style={[styles.inputSuffix, { color: colors.textSecondary }]}>
                {amountCurrency}
              </Text>
            </View>

            {/* Info: conversão quando amount está em quote */}
            {isAmountInQuote && hasValidAmount && priceNum > 0 && (
              <Text style={{ fontSize: typography.tiny, color: colors.textTertiary, marginTop: 2 }}>
                ≈ {apiService.formatTokenAmount(baseAmount.toFixed(8))} {baseCurrency}
              </Text>
            )}
            {/* Info: conversão quando amount está em base */}
            {!isAmountInQuote && hasValidAmount && priceNum > 0 && (
              <Text style={{ fontSize: typography.tiny, color: colors.textTertiary, marginTop: 2 }}>
                ≈ {isBrlQuote ? 'R$ ' : '$ '}{apiService.formatUSD(total, total < 1 ? 6 : 2)} {quoteCurrency}
              </Text>
            )}

            {/* Available balance hint + Percentage buttons */}
            {orderSide && (
              <View style={{ marginTop: 6, padding: 10, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: typography.tiny, color: colors.textSecondary, marginBottom: 8 }}>
                  {(() => {
                    const avail = getAvailableBalance()
                    if (avail <= 0) return `💰 Saldo ${orderSide === 'buy' ? quoteCurrency : baseCurrency}: não disponível`
                    const curr = orderSide === 'buy' 
                      ? quoteCurrency
                      : (isAmountInQuote ? quoteCurrency : baseCurrency)
                    return `💰 Saldo ${curr}: ${apiService.formatTokenAmount(avail.toFixed(8))} ${curr}`
                  })()}
                </Text>
                <View style={styles.percentRow}>
                  {[25, 50, 75, 100].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      style={[styles.percentChip, { 
                        backgroundColor: colors.card, 
                        borderColor: orderSide === 'buy' ? '#10b98140' : '#f59e0b40',
                      }]}
                      onPress={() => handlePercentage(pct)}
                    >
                      <Text style={[styles.percentText, { color: orderSide === 'buy' ? '#10b981' : '#f59e0b' }]}>{pct}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* Total display */}
        {typeSelected && hasValidAmount && (orderType === 'market' || hasValidPrice) && (
          <View style={[styles.totalRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total Estimado</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {orderType === 'market'
                ? `${apiService.formatTokenAmount(isAmountInQuote ? baseAmount.toFixed(8) : amount)} ${baseCurrency} (preço de mercado)`
                : isAmountInQuote
                  ? `${isBrlQuote ? 'R$ ' : '$ '}${apiService.formatUSD(amountNum, amountNum < 1 ? 6 : 2)} ${quoteCurrency}`
                  : `${isBrlQuote ? 'R$ ' : '$ '}${apiService.formatUSD(total, total < 1 ? 6 : 2)} ${quoteCurrency}`
              }
            </Text>
          </View>
        )}

        {/* Error */}
        {createOrderError && (
          <View style={[styles.errorBox, { backgroundColor: '#ef444420', borderColor: '#ef4444' }]}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={[styles.errorText, { color: '#ef4444' }]}>{createOrderError}</Text>
          </View>
        )}

        {/* Submit button */}
        {typeSelected && (
          <TouchableOpacity
            style={[
              styles.submitButton,
              {
                backgroundColor: isFormComplete
                  ? (isBuy ? colors.success : colors.danger)
                  : colors.border,
              }
            ]}
            onPress={handleSubmit}
            disabled={!isFormComplete || createOrderLoading}
            activeOpacity={0.7}
          >
            {createOrderLoading ? (
              <ActivityIndicator size="small" />
            ) : (
              <>
                <Ionicons
                  name={isBuy ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.submitButtonText}>
                  {isBuy ? 'Criar Ordem de Compra' : 'Criar Ordem de Venda'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    )
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================
  const stepTitles: Record<Step, string> = {
    exchange: 'Nova Ordem',
    token: 'Nova Ordem',
    pair: 'Nova Ordem',
    order: 'Nova Ordem',
  }

  const canGoBack = step !== 'exchange'

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
            <View style={styles.headerLeft}>
              {canGoBack && (
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                  <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
              )}
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  {stepTitles[step]}
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  {step === 'exchange' && 'Passo 1 de 4'}
                  {step === 'token' && `${exchangeName} • Passo 2 de 4`}
                  {step === 'pair' && `${exchangeName} • ${tokenInput.toUpperCase()} • Passo 3 de 4`}
                  {step === 'order' && `${exchangeName} • ${tradingPair} • Passo 4 de 4`}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Progress bar */}
          <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
            <View style={[
              styles.progressBarFill,
              {
                backgroundColor: colors.primary,
                width: `${((['exchange', 'token', 'pair', 'order'].indexOf(step) + 1) / 4) * 100}%`
              }
            ]} />
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 'exchange' && renderExchangeStep()}
            {step === 'token' && renderTokenStep()}
            {step === 'pair' && renderPairStep()}
            {step === 'order' && renderOrderStep()}
          </ScrollView>
        </View>
      </View>

      {/* Confirm Modal */}
      <ConfirmModal
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        onConfirm={executeOrder}
        title={orderSide === 'buy' ? '✅ Confirmar Compra' : '🔴 Confirmar Venda'}
        message={
          `${orderType === 'limit' ? 'LIMIT' : 'MARKET'} ${orderSide === 'buy' ? 'compra' : 'venda'} de ` +
          (isAmountInQuote
            ? `${isBrlQuote ? 'R$ ' : '$ '}${apiService.formatUSD(amountNum, amountNum < 0.01 ? 8 : 2)} ${quoteCurrency} (≈ ${apiService.formatTokenAmount(baseAmount.toFixed(8))} ${baseCurrency})`
            : `${apiService.formatTokenAmount(amount)} ${baseCurrency}`) +
          (orderType === 'limit' ? `\nPreço: ${isBrlQuote ? 'R$ ' : '$ '}${apiService.formatUSD(priceNum, priceNum < 0.01 ? 8 : 2)}` : '') +
          (orderType === 'limit' && !isAmountInQuote ? `\nTotal: ${isBrlQuote ? 'R$ ' : '$ '}${apiService.formatUSD(total, total < 1 ? 6 : 2)} ${quoteCurrency}` : '') +
          `\n\n📍 ${exchangeName} • ${tradingPair}`
        }
        confirmText={orderSide === 'buy' ? 'Comprar' : 'Vender'}
        cancelText="Voltar"
        confirmColor={orderSide === 'buy' ? '#22c55e' : '#ef4444'}
        icon={orderSide === 'buy' ? '🟢' : '🔴'}
      />
    </Modal>
  )
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    padding: 4,
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
  progressBarBg: {
    height: 3,
    width: '100%',
  },
  progressBarFill: {
    height: 3,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  stepContainer: {
    gap: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#fff',
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
  },
  stepTitle: {
    fontSize: typography.h4,
    fontWeight: fontWeights.semibold,
  },
  stepDescription: {
    fontSize: typography.caption,
    lineHeight: 20,
    marginBottom: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: typography.caption,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: typography.caption,
    textAlign: 'center',
  },

  // Exchange list
  exchangeList: {
    gap: 8,
  },
  exchangeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  exchangeItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exchangeLogoWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 4,
  },
  exchangeLogo: {
    width: '100%',
    height: '100%',
  },
  exchangeName: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  exchangeStatus: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },

  // Selected chip / breadcrumb
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    alignSelf: 'flex-start',
  },
  selectedChipText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.semibold,
  },
  exchangeLogoWrapSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 2,
  },
  exchangeLogoSmall: {
    width: '100%',
    height: '100%',
  },
  breadcrumbRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },

  // Token input
  tokenInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  tokenInput: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
    paddingVertical: 0,
  },
  quickTokens: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickTokenChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickTokenText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: typography.button,
    fontWeight: fontWeights.semibold,
  },

  // Pair grid
  pairGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pairChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  pairChipText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },

  // Order form
  fieldLabel: {
    fontSize: typography.micro,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  sideRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sideButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  sideButtonText: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeButtonText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  inputPrefix: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },
  inputSuffix: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },
  formInput: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
    paddingVertical: 0,
  },
  percentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  percentChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  percentText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.semibold,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  totalLabel: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },
  totalValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: typography.button,
    fontWeight: fontWeights.bold,
  },
})
