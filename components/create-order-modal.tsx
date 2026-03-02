import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Alert, Pressable, Image, ActivityIndicator } from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { useOrders } from '@/contexts/OrdersContext'
import { useBalance } from '@/contexts/BalanceContext'
import { typography, fontWeights } from '@/lib/typography'
import { apiService } from '@/services/api'
import { notify } from '@/services/notify'
import { getExchangeLogo } from '@/lib/exchange-logos'
import { AnimatedLogoIcon } from '@/components/AnimatedLogoIcon'
import { ConfirmModal } from '@/components/ConfirmModal'
import { LinkedExchange } from '@/types/api'

interface CreateOrderModalProps {
  visible: boolean
  onClose: () => void
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

export function CreateOrderModal({ visible, onClose }: CreateOrderModalProps) {
  const { colors } = useTheme()
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const { addOrder, refresh: refreshOrders } = useOrders()
  const { data: balanceData, refresh: refreshBalance } = useBalance()

  // Step navigation
  const [step, setStep] = useState<Step>('exchange')

  // Step 1: Exchange selection
  const [exchanges, setExchanges] = useState<LinkedExchange[]>([])
  const [exchangesLoading, setExchangesLoading] = useState(false)
  const [selectedExchange, setSelectedExchange] = useState<LinkedExchange | null>(null)

  // Step 2: Token input
  const [tokenInput, setTokenInput] = useState('')

  // Step 3: Pair selection
  const [availablePairs, setAvailablePairs] = useState<PairInfo[]>([])
  const [pairsLoading, setPairsLoading] = useState(false)
  const [pairsError, setPairsError] = useState<string | null>(null)
  const [selectedPair, setSelectedPair] = useState<PairInfo | null>(null)

  // Step 4: Order form
  const [orderSide, setOrderSide] = useState<OrderSide | null>(null)
  const [orderType, setOrderType] = useState<OrderType | null>(null)
  const [amount, setAmount] = useState('')
  const [price, setPrice] = useState('')
  const [createOrderLoading, setCreateOrderLoading] = useState(false)
  const [createOrderError, setCreateOrderError] = useState<string | null>(null)
  const [confirmVisible, setConfirmVisible] = useState(false)

  // Reset everything on open
  useEffect(() => {
    if (visible) {
      setStep('exchange')
      setExchanges([])
      setSelectedExchange(null)
      setTokenInput('')
      setAvailablePairs([])
      setPairsLoading(false)
      setPairsError(null)
      setSelectedPair(null)
      setOrderSide(null)
      setOrderType(null)
      setAmount('')
      setPrice('')
      setCreateOrderLoading(false)
      setCreateOrderError(null)
      setConfirmVisible(false)

      // Fetch connected exchanges
      fetchExchanges()
    }
  }, [visible])

  // Fetch connected exchanges
  const fetchExchanges = async () => {
    if (!user?.id) return
    setExchangesLoading(true)
    try {
      const result = await apiService.getLinkedExchanges(user.id, true)
      if (result.success && result.exchanges) {
        // Only show active exchanges
        const active = result.exchanges.filter(e => e.status === 'active' || e.is_active !== false)
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
      const exchangeId = selectedExchange.exchange_id || selectedExchange._id || ''
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

        // Limit to 12 most relevant
        const topPairs = sorted.slice(0, 12)
        setAvailablePairs(topPairs)

        if (topPairs.length === 1) {
          setSelectedPair(topPairs[0])
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
  const handleSelectExchange = (exchange: LinkedExchange) => {
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

  // Handle pair selection → go to order step
  const handleSelectPair = (pair: PairInfo) => {
    setSelectedPair(pair)
    setOrderSide(null)
    setOrderType(null)
    setAmount('')
    setPrice('')
    setCreateOrderError(null)
    setStep('order')
  }

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
    } else if (step === 'order') {
      setStep('pair')
      setSelectedPair(null)
      setOrderSide(null)
      setOrderType(null)
      setAmount('')
      setPrice('')
      setCreateOrderError(null)
    }
  }

  // Derived values for order step
  const tradingPair = selectedPair?.symbol || ''
  const baseCurrency = selectedPair?.base || ''
  const quoteCurrency = selectedPair?.quote || ''
  const isBrlQuote = quoteCurrency === 'BRL'
  const exchangeName = selectedExchange?.name || ''
  const exchangeId = selectedExchange?.exchange_id || selectedExchange?._id || ''

  const amountNum = parseFloat(amount || '0')
  const priceNum = parseFloat(price || '0')
  const total = amountNum * priceNum

  const sideSelected = orderSide !== null
  const typeSelected = orderType !== null
  const hasValidAmount = amountNum > 0
  const hasValidPrice = orderType === 'market' || (orderType === 'limit' && priceNum > 0)
  const isFormComplete = sideSelected && typeSelected && hasValidAmount && hasValidPrice && !createOrderLoading

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

    try {
      const result = isBuy
        ? await apiService.createBuyOrder(
            user.id,
            exchangeId,
            tradingPair,
            amountVal,
            orderType,
            orderType === 'limit' ? priceVal : undefined
          )
        : await apiService.createSellOrder(
            user.id,
            exchangeId,
            tradingPair,
            amountVal,
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
          amount: amountVal,
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
            amount: amountVal,
            filled: 0,
            remaining: amountVal,
            status: 'open' as const,
            timestamp: Date.now(),
            datetime: new Date().toISOString(),
            cost: 0,
            exchange_id: exchangeId,
            exchange_name: exchangeName,
          }
          addOrder(newOrder, exchangeId, exchangeName)
        }

        // 4. Sync in background
        setTimeout(() => {
          refreshOrders().catch(console.error)
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
          <AnimatedLogoIcon size={28} />
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
            const logo = getExchangeLogo(exchange.name)
            return (
              <TouchableOpacity
                key={exchange.exchange_id || exchange._id}
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
                      {exchange.name}
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
          <AnimatedLogoIcon size={28} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Buscando pares para {tokenInput.toUpperCase()}...
          </Text>
        </View>
      ) : pairsError ? (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 32 }}>⚠️</Text>
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
        <View style={styles.pairGrid}>
          {availablePairs.map((pair) => (
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
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Preço ({quoteCurrency})
            </Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.inputPrefix, { color: colors.textSecondary }]}>
                {isBrlQuote ? 'R$' : '$'}
              </Text>
              <TextInput
                style={[styles.formInput, { color: colors.text }]}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                autoFocus={true}
              />
            </View>
          </>
        )}

        {/* Amount input */}
        {typeSelected && (
          <>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Quantidade ({baseCurrency})
            </Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.formInput, { color: colors.text }]}
                placeholder="0.00000000"
                placeholderTextColor={colors.textTertiary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                autoFocus={orderType === 'market'}
              />
              <Text style={[styles.inputSuffix, { color: colors.textSecondary }]}>
                {baseCurrency}
              </Text>
            </View>

            {/* Percentage buttons */}
            <View style={styles.percentRow}>
              {[25, 50, 75, 100].map((pct) => (
                <TouchableOpacity
                  key={pct}
                  style={[styles.percentChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => {
                    // Sem saldo disponível aqui (não temos balance por par), só seta porcentagem como placeholder
                    Alert.alert('Dica', `Use ${pct}% do saldo disponível na exchange.\nPara cálculos automáticos, use o botão Trade na tela de Assets.`)
                  }}
                >
                  <Text style={[styles.percentText, { color: colors.textSecondary }]}>{pct}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Total display */}
        {typeSelected && hasValidAmount && (orderType === 'market' || hasValidPrice) && (
          <View style={[styles.totalRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total Estimado</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {orderType === 'market'
                ? `${apiService.formatTokenAmount(amount)} ${baseCurrency} (preço de mercado)`
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
              <ActivityIndicator size="small" color="#fff" />
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
          `${orderType === 'limit' ? 'LIMIT' : 'MARKET'} ${orderSide === 'buy' ? 'compra' : 'venda'} de ${apiService.formatTokenAmount(amount)} ${baseCurrency}` +
          (orderType === 'limit' ? `\nPreço: ${isBrlQuote ? 'R$ ' : '$ '}${apiService.formatUSD(priceNum, priceNum < 0.01 ? 8 : 2)}` : '') +
          (orderType === 'limit' ? `\nTotal: ${isBrlQuote ? 'R$ ' : '$ '}${apiService.formatUSD(total, total < 1 ? 6 : 2)} ${quoteCurrency}` : '') +
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
    fontSize: 13,
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
