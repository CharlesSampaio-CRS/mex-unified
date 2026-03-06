import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable, Modal, TextInput, Animated, ActivityIndicator } from "react-native"
import React, { useState, useCallback, useMemo, memo, useRef, useEffect } from "react"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import { apiService } from "@/services/api"
import { useTheme } from "@/contexts/ThemeContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { useBalance } from "@/contexts/BalanceContext"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { useAuth } from "@/contexts/AuthContext"
import { useOrders } from "@/contexts/OrdersContext"
import { useWatchlist } from "@/contexts/WatchlistContext"
import { useAlerts } from "@/contexts/AlertsContext"
import { SkeletonExchangeItem } from "./SkeletonLoaders"
import { TokenDetailsModal } from "./token-details-modal"
import { TradeModal } from "./trade-modal"
import { CreateAlertModal } from "./create-price-alert-modal"
import { getExchangeLogo } from "@/lib/exchange-logos"
import { typography, fontWeights } from "@/lib/typography"
import { useTokenMonitor } from "@/hooks/use-token-monitor"
import { useOpenOrdersSync } from "@/hooks/useOpenOrdersSync"
import { getExchangeId, getExchangeName, getTotalUsd, getExchangeBalances } from "@/lib/exchange-helpers"

// Lista de stablecoins e moedas fiat que não devem ter variação e botão de trade
const STABLECOINS = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'FDUSD', 'USDD', 'BRL', 'EUR', 'USD']

interface AssetsListProps {
  onAddExchange?: () => void
  onOpenOrdersPress?: (exchangeId: string, exchangeName: string) => void
  onRefreshOrders?: () => void  // Callback para atualizar ordens
}

// Sub-componente com animação piscante para tokens afetados por create/cancel
function BlinkingAssetCard({ 
  children, 
  isAffected, 
  style,
  onPress
}: { 
  key?: string;
  children: React.ReactNode; 
  isAffected: boolean; 
  style: any;
  onPress: () => void;
}) {
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAffected) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.4,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      blinkAnim.setValue(1);
    }
  }, [isAffected]);

  return (
    <Animated.View style={{ opacity: isAffected ? blinkAnim : 1 }}>
      <TouchableOpacity style={style} onPress={onPress}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export const AssetsList = memo(function AssetsList({ onOpenOrdersPress, onRefreshOrders }: AssetsListProps) {
  const { colors, isDark } = useTheme()
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const { data, loading, error, refresh: refreshBalance, refreshing } = useBalance()
  const { refresh: refreshOrders, recentlyAffectedSymbols } = useOrders()
  const { hideValue, valuesHidden, hideZeroBalances: hideZeroBalanceExchanges, toggleHideZeroBalances: toggleZeroBalanceExchanges } = usePrivacy()
  const { addToken, removeToken, isWatching } = useWatchlist()
  const { getAlertsForToken } = useAlerts()
  const [searchQuery, setSearchQuery] = useState('')
  
  // Estados para busca inteligente na exchange
  const [searchingExchange, setSearchingExchange] = useState(false)
  const [externalSearchResult, setExternalSearchResult] = useState<{
    symbol: string
    exchangeId: string
    exchangeName: string
    price: number
    found: boolean
  } | null>(null)

  // Função para toggle do favorito
  const handleToggleFavorite = useCallback(async (symbol: string) => {
    if (isWatching(symbol)) {
      await removeToken(symbol)
    } else {
      await addToken(symbol)
    }
  }, [isWatching, addToken, removeToken])

  const [selectedToken, setSelectedToken] = useState<{ exchangeId: string; symbol: string } | null>(null)
  const [tokenModalVisible, setTokenModalVisible] = useState(false)
  const [tokenInfoVisible, setTokenInfoVisible] = useState<string | null>(null) // Para mostrar info agregada do token
  const [tokenInfoModalVisible, setTokenInfoModalVisible] = useState(false) // Modal de info agregada
  const [selectedExchangeId, setSelectedExchangeId] = useState<string | null>(null) // Exchange do token clicado
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null) // Posição do tooltip
  const [tradeModalVisible, setTradeModalVisible] = useState(false)
  const [alertModalVisible, setAlertModalVisible] = useState(false)
  const [selectedTokenForAlert, setSelectedTokenForAlert] = useState<{
    symbol: string
    price: number
    exchangeId: string
    exchangeName: string
  } | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<{
    exchangeId: string
    exchangeName: string
    symbol: string
    currentPrice: number
    balance: { token: number; usdt: number; brl?: number }
  } | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null)
  const [openOrdersCount, setOpenOrdersCount] = useState<Record<string, number>>({})
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingOrdersByExchange, setLoadingOrdersByExchange] = useState<Record<string, boolean>>({})
  const [hasLoadedOrders, setHasLoadedOrders] = useState(false)
  const [lastOrdersUpdate, setLastOrdersUpdate] = useState<Date | null>(null)
  const ordersIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Estados para variações de preço
  const [exchangeVariations, setExchangeVariations] = useState<Record<string, Record<string, any>>>({})
  const [loadingVariations, setLoadingVariations] = useState<Record<string, boolean>>({})
  const [lastUpdateTime, setLastUpdateTime] = useState<Record<string, Date>>({})
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const variationsFetchedRef = useRef<Set<string>>(new Set()) // 🔑 Cache de exchanges já consultadas

  // 📊 Monitor tokens for price alerts
  const monitoredTokens = useMemo(() => {
    const tokens: Array<{ symbol: string; exchange: string; variation24h: number; price: number }> = []
    
    if (data?.exchanges) {
      data.exchanges.forEach((exchange: any) => {
        const exchangeId = getExchangeId(exchange)
        // ✅ Suporta ambas estruturas: balances (nova) e tokens (antiga)
        const balances = getExchangeBalances(exchange)
        
        if (balances && typeof balances === 'object') {
          Object.entries(balances).forEach(([symbol, tokenData]: [string, any]) => {
            // ✅ Acesso correto: exchangeVariations[exchangeId][symbol]
            const tokenVariations = exchangeVariations[exchangeId]?.[symbol]
            
            // Verifica se tem variação do backend (priority) ou do cache local
            const variation24h = tokenData.change_24h || tokenVariations?.['24h']?.price_change_percent
            
            if (variation24h !== undefined && variation24h !== null) {
              const priceUsd = tokenData.price_usd || (tokenData.usd_value && tokenData.total ? tokenData.usd_value / tokenData.total : 0)
              
              tokens.push({
                symbol: symbol,
                exchange: exchangeId,
                variation24h: parseFloat(variation24h.toString()), // ✅ Converte string para número
                price: parseFloat(priceUsd.toString()) || 0
              })
            }
          })
        }
      })
    }
    
    return tokens
  }, [data?.exchanges, exchangeVariations])

  // Activate token monitoring
  useTokenMonitor(monitoredTokens)

  // 🔄 AUTO-SYNC: Sincroniza open orders automaticamente quando tokens mudarem
  // ❌ DESABILITADO: AllOpenOrdersList já busca todas as orders de uma vez
  // Isso evita chamadas duplicadas (10 individuais vs 1 agrupada)
  const { syncOpenOrders: manualSyncOrders, isSyncing: isSyncingOrders } = useOpenOrdersSync({
    userId: user?.id || '',
    enabled: false, // ❌ DESABILITADO para evitar chamadas duplicadas
    onSyncStart: () => {
      setLoadingOrders(true)
    },
    onSyncComplete: (results) => {
      // Atualiza contagem de ordens por exchange (MANTÉM valores existentes)
      setOpenOrdersCount(prev => {
        const updated = { ...prev } // Mantém valores existentes
        results.forEach((result) => {
          if (result.success) {
            updated[result.exchangeId] = result.ordersCount
          }
        })
        return updated
      })
      
      setLoadingOrders(false)
      setHasLoadedOrders(true)
      setLastOrdersUpdate(new Date())
      
      // Notifica parent se houver callback
      if (onRefreshOrders) {
        onRefreshOrders()
      }
    },
    onSyncError: (error) => {
      setLoadingOrders(false)
    }
  })

  // ⚡ Busca contagem de ordens abertas logo após carregar as exchanges (prioridade alta)
  // ❌ DESABILITADO: AllOpenOrdersList já busca todas as orders de uma vez
  // Isso evita chamadas duplicadas e melhora performance
  useEffect(() => {
    // COMENTADO: Busca duplicada removida
    // if (!loading && data?.exchanges && data.exchanges.length > 0 && !hasLoadedOrders && !loadingOrders) {
    //   const timer = setTimeout(() => {
    //     fetchOpenOrdersCount()
    //   }, 200)
    //   return () => clearTimeout(timer)
    // }
  }, [loading, data?.exchanges, hasLoadedOrders, loadingOrders])

  // ⏰ Atualização automática a cada 5 minutos
  // ❌ DESABILITADO: AllOpenOrdersList já faz auto-refresh
  useEffect(() => {
    // COMENTADO: Auto-refresh duplicado removido
    // if (hasLoadedOrders && data?.exchanges && data.exchanges.length > 0) {
    //   if (ordersIntervalRef.current) {
    //     clearInterval(ordersIntervalRef.current)
    //   }
    //   ordersIntervalRef.current = setInterval(() => {
    //     fetchOpenOrdersCount()
    //   }, 5 * 60 * 1000)
    //   return () => {
    //     if (ordersIntervalRef.current) {
    //       clearInterval(ordersIntervalRef.current)
    //       ordersIntervalRef.current = null
    //     }
    //   }
    // }
  }, [hasLoadedOrders, data?.exchanges])

  // Busca as ordens abertas para UMA exchange específica (atualização rápida após criar/cancelar ordem)
  const fetchOpenOrdersForExchange = useCallback(async (exchangeId: string) => {
    if (!user?.id) return
    
    try {
      // ✅ NOVO: Usa endpoint seguro que busca exchanges do MongoDB
      const response = await apiService.getOrdersSecure()
      
      if (!response || !response.success) {
        return { success: false, count: 0 }
      }
      
      // Filtra ordens da exchange solicitada
      const orders = response.orders.filter((order: any) => 
        order.exchange_id === exchangeId || order.exchange === exchangeId
      )
      const count = orders.length
      
      // Atualiza contagem no estado
      setOpenOrdersCount(prev => ({
        ...prev,
        [exchangeId]: count
      }))
      
      return { success: true, count, orders }
    } catch (error: any) {
      return { success: false, count: 0 }
    }
  }, [user?.id])

  const fetchOpenOrdersCount = useCallback(async () => {
    if (!data?.exchanges || data.exchanges.length === 0 || !user?.id) {
      return
    }

    // Evita múltiplas chamadas simultâneas
    if (loadingOrders) return

    setLoadingOrders(true)
    
    const startTime = Date.now()
    let successCount = 0
    let failCount = 0
    let totalOrders = 0
    
    // 🚀 Busca em lotes de 3 exchanges por vez (paralelo controlado)
    const BATCH_SIZE = 3
    
    for (let i = 0; i < data.exchanges.length; i += BATCH_SIZE) {
      const batch = data.exchanges.slice(i, i + BATCH_SIZE)
      
      // Cria promises para todas as exchanges do lote
      const batchPromises = batch.map(async (exchange) => {
        const exchangeId = getExchangeId(exchange)
        const exchangeName = getExchangeName(exchange)
        
        try {
          // ✅ NOVO: Usa endpoint seguro que busca exchanges do MongoDB
          const response = await apiService.getOrdersSecure()
          
          if (!response || !response.success) {
            return { 
              success: false, 
              exchangeId: exchangeId,
              exchangeName: exchangeName,
              count: 0 
            }
          }
          
          // Filtra ordens da exchange
          const orders = response.orders.filter(order => 
            order.exchange_id === exchangeId || order.exchange === exchangeId
          )
          const count = orders.length
          
          return { 
            success: true, 
            exchangeId: exchangeId,
            exchangeName: exchangeName,
            count, 
            orders 
          }
        } catch (error: any) {
          return { 
            success: false, 
            exchangeId: exchangeId,
            exchangeName: exchangeName,
            count: 0 
          }
        }
      })
      
      // Aguarda todas as promises do lote completarem (mesmo se algumas falharem)
      const batchResults = await Promise.allSettled(batchPromises)
      
      // Processa resultados do lote
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const data = result.value
          
          // Atualiza contagem no estado (só se tiver exchangeId válido)
          if (data.exchangeId) {
            setOpenOrdersCount(prev => ({
              ...prev,
              [data.exchangeId]: data.count
            }))
          }
          
          if (data.success) {
            successCount++
            totalOrders += data.count
          } else {
            failCount++
          }
        } else {
          failCount++
        }
      })
    }
    
    // Atualiza timestamp da última atualização
    setLastOrdersUpdate(new Date())
    setLoadingOrders(false)
    setHasLoadedOrders(true)
  }, [data?.exchanges, loadingOrders])

  // Função para atualizar ordens de uma exchange específica (usada após cancelar ordem)
  const refreshSingleExchangeOrders = useCallback(async (exchangeId: string) => {
    const exchange = data?.exchanges?.find((ex: any) => ex.exchange_id === exchangeId)
    if (!exchange) return

    if (!user?.id) return
    
    // Marca como loading para esta exchange
    setLoadingOrdersByExchange(prev => ({ ...prev, [exchangeId]: true }))

    try {
      // ✅ NOVO: Usa endpoint seguro que busca exchanges do MongoDB
      const response = await apiService.getOrdersSecure()
      
      if (!response || !response.success) {
        setLoadingOrdersByExchange(prev => ({ ...prev, [exchangeId]: false }))
        return
      }
      
      // Filtra ordens da exchange
      const orders = response.orders.filter((order: any) => 
        order.exchange_id === exchangeId || order.exchange === exchangeId
      )
      const count = orders.length
      
      // Atualiza contagem
      setOpenOrdersCount(prev => ({
        ...prev,
        [exchangeId]: count
      }))
    } catch (error: any) {
    } finally {
      // Remove loading
      setLoadingOrdersByExchange(prev => ({ ...prev, [exchangeId]: false }))
    }
  }, [data?.exchanges, user?.id])


  // Expõe função de atualizar ordens através de callback e window global
  useEffect(() => {
    // Expõe globalmente - TODAS as exchanges
    (window as any).__exchangesListRefreshOrders = fetchOpenOrdersCount
    
    // Também chama o callback se existir (para atualizar o ref no HomeScreen)
    if (onRefreshOrders) {
      onRefreshOrders()
    }
  }, [fetchOpenOrdersCount, onRefreshOrders])

  // Expõe função de atualizar uma exchange específica globalmente
  useEffect(() => {
    (window as any).__exchangesListRefreshOrdersForExchange = refreshSingleExchangeOrders
  }, [refreshSingleExchangeOrders])

  // �️ Mapeamento de nomes comuns para símbolos corretos
  const tokenNameToSymbol: Record<string, string> = {
    'BITCOIN': 'BTC',
    'ETHEREUM': 'ETH',
    'SOLANA': 'SOL',
    'CARDANO': 'ADA',
    'POLKADOT': 'DOT',
    'RIPPLE': 'XRP',
    'DOGECOIN': 'DOGE',
    'SHIBA': 'SHIB',
    'SHIBAINU': 'SHIB',
    'POLYGON': 'MATIC',
    'AVALANCHE': 'AVAX',
    'CHAINLINK': 'LINK',
    'UNISWAP': 'UNI',
    'LITECOIN': 'LTC',
    'COSMOS': 'ATOM',
    'ALGORAND': 'ALGO',
    'STELLAR': 'XLM',
    'MONERO': 'XMR',
    'TRON': 'TRX',
    'BINANCE': 'BNB',
    'BINANCECOIN': 'BNB',
  }

  // �🔍 Busca inteligente: procura token na exchange prioritária se não encontrado localmente
  const searchTokenInPriorityExchange = useCallback(async (tokenSymbol: string) => {
    if (!user?.id || !data?.exchanges || data.exchanges.length === 0) {
      return
    }

    let upperToken = tokenSymbol.toUpperCase().trim()
    
    // Converte nome comum para símbolo (ex: SOLANA -> SOL)
    if (tokenNameToSymbol[upperToken]) {
      upperToken = tokenNameToSymbol[upperToken]
    }
    
    // Verifica se já tem o token localmente
    const hasTokenLocally = data.exchanges.some((exchange: any) => {
      const balances = getExchangeBalances(exchange)
      return balances && Object.keys(balances).some(symbol => 
        symbol.toUpperCase() === upperToken
      )
    })

    // Se já tem localmente, não precisa buscar na exchange
    if (hasTokenLocally) {
      setExternalSearchResult(null)
      return
    }

    // Prioriza MEXC, depois ordena por número de tokens
    const sortedExchanges = [...data.exchanges].sort((a: any, b: any) => {
      const nameA = getExchangeName(a).toUpperCase()
      const nameB = getExchangeName(b).toUpperCase()
      
      // MEXC sempre vem primeiro
      if (nameA === 'MEXC') return -1
      if (nameB === 'MEXC') return 1
      
      // Caso contrário, ordena por quantidade de tokens
      const balancesA = getExchangeBalances(a)
      const balancesB = getExchangeBalances(b)
      const countA = balancesA ? Object.keys(balancesA).length : 0
      const countB = balancesB ? Object.keys(balancesB).length : 0
      return countB - countA
    })

    // Busca o token em todas as exchanges (prioritária primeiro)
    setSearchingExchange(true)
    setExternalSearchResult(null)

    let tokenFound = false
    let lastError: any = null

    console.log(`🔍 Iniciando busca de ${upperToken} em ${sortedExchanges.length} exchanges...`)
    sortedExchanges.forEach((ex: any, idx: number) => {
      console.log(`  ${idx + 1}. ${getExchangeName(ex)} (ID: ${getExchangeId(ex)})`)
    })

    for (const exchange of sortedExchanges) {
      const exchangeId = getExchangeId(exchange)
      const exchangeName = getExchangeName(exchange)

      try {
        console.log(`🔍 Tentando buscar ${upperToken} em ${exchangeName} (ID: ${exchangeId})...`)
        const result = await apiService.searchToken(user.id, exchangeId, upperToken)
        
        console.log(`📦 Resposta de ${exchangeName}:`, {
          success: result.success,
          hasData: !!result.data,
          message: result.message,
          error: result.error
        })
        
        if (result.success && result.data) {
          // Token encontrado!
          console.log(`✅ Token ${upperToken} encontrado em ${exchangeName}!`, result.data)
          setExternalSearchResult({
            symbol: upperToken,
            exchangeId,
            exchangeName,
            price: result.data.price || 0,
            found: true
          })
          tokenFound = true
          break // Para ao encontrar
        } else {
          console.log(`⚠️ Token ${upperToken} não encontrado em ${exchangeName}: ${result.message}`)
        }
      } catch (error: any) {
        console.warn(`❌ Erro ao buscar ${upperToken} em ${exchangeName}:`, error)
        lastError = error
        // Continua tentando outras exchanges
      }
    }

    // Se não encontrou via backend, tenta buscar via CoinGecko (API pública)
    if (!tokenFound) {
      console.log(`🌐 Token não encontrado no backend, tentando CoinGecko...`)
      try {
        const coinGeckoResults = await apiService.searchTokenCoinGecko(upperToken)
        
        if (coinGeckoResults && coinGeckoResults.length > 0) {
          const tokenData = coinGeckoResults[0]
          const mexcExchange = sortedExchanges.find((ex: any) => 
            getExchangeName(ex).toUpperCase() === 'MEXC'
          )
          
          if (mexcExchange) {
            console.log(`✅ Token ${upperToken} encontrado no CoinGecko!`, tokenData)
            setExternalSearchResult({
              symbol: tokenData.symbol?.toUpperCase() || upperToken,
              exchangeId: getExchangeId(mexcExchange),
              exchangeName: getExchangeName(mexcExchange),
              price: tokenData.current_price || 0,
              found: true
            })
            tokenFound = true
          }
        }
      } catch (error: any) {
        // Backend CoinGecko pode estar indisponível (500) ou ter rate limit
        const errorMessage = error?.message || 'Erro desconhecido'
        const statusCode = errorMessage.match(/(\d{3})/)
        
        if (statusCode && statusCode[1] === '500') {
          console.warn(`⚠️ CoinGecko API temporariamente indisponível (500)`)
        } else if (statusCode && statusCode[1] === '429') {
          console.warn(`⚠️ CoinGecko rate limit atingido (429)`)
        } else {
          console.warn(`⚠️ CoinGecko API não disponível: ${errorMessage}`)
        }
        
        // Não lança erro - apenas continua sem resultado do CoinGecko
      }
    }

    // Se não encontrou em nenhuma exchange
    if (!tokenFound) {
      const firstExchange = sortedExchanges[0]
      const firstExchangeId = getExchangeId(firstExchange)
      const firstExchangeName = getExchangeName(firstExchange)
      
      console.log(`❌ Token ${upperToken} não encontrado em nenhuma exchange`)
      setExternalSearchResult({
        symbol: upperToken,
        exchangeId: firstExchangeId,
        exchangeName: firstExchangeName,
        price: 0,
        found: false
      })
    }

    setSearchingExchange(false)
  }, [user?.id, data?.exchanges])

  // Executa busca quando searchQuery muda (com debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchTokenInPriorityExchange(searchQuery.trim())
      } else {
        setExternalSearchResult(null)
      }
    }, 500) // Debounce de 500ms

    return () => clearTimeout(timer)
  }, [searchQuery, searchTokenInPriorityExchange])

  const handleTokenPress = useCallback((exchangeId: string, symbol: string, event: any) => {
    // Agora abre modal com informações agregadas do token
    const key = `${symbol}`
    setTokenInfoVisible(key)
    setSelectedExchangeId(exchangeId) // Guarda qual exchange foi clicada
    setTokenInfoModalVisible(true)
  }, [])

  const handleVariationPress = useCallback((exchangeId: string, symbol: string) => {
    // Abre o modal de detalhes do token
    setSelectedToken({ exchangeId, symbol })
    setTokenModalVisible(true)
  }, [])

  const handleCloseTokenModal = useCallback(() => {
    setTokenModalVisible(false)
    setTimeout(() => {
      setSelectedToken(null)
    }, 300)
  }, [])

  // Filtrar exchanges - oculta corretoras com saldo $0 se toggle ativado E filtra por busca
  const filteredExchanges = useMemo(() => {
    if (!data) {
      return []
    }
    
    if (!data.exchanges || data.exchanges.length === 0) {
      return []
    }
    
    // Aplica filtro de busca primeiro
    let filtered = data.exchanges
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.map(exchange => {
        const exchangeName = getExchangeName(exchange).toLowerCase()
        
        // Se o nome da exchange corresponde, retorna a exchange completa
        if (exchangeName.includes(query)) {
          return exchange
        }
        
        // Caso contrário, filtra apenas tokens correspondentes
        const balances = getExchangeBalances(exchange)
        if (balances && typeof balances === 'object') {
          const filteredBalances: Record<string, any> = {}
          Object.entries(balances).forEach(([symbol, balance]) => {
            if (symbol.toLowerCase().includes(query)) {
              filteredBalances[symbol] = balance
            }
          })
          
          // Se tem tokens correspondentes, retorna exchange com tokens filtrados
          if (Object.keys(filteredBalances).length > 0) {
            return {
              ...exchange,
              balances: filteredBalances,
              tokens: filteredBalances
            }
          }
        }
        
        // Não corresponde a nada, retorna null para remover depois
        return null
      }).filter((exchange): exchange is NonNullable<typeof exchange> => exchange !== null)
    }
    
    // Filtra tokens com saldo $0 se toggle ativado (não remove a exchange)
    if (hideZeroBalanceExchanges) {
      filtered = filtered.map(exchange => {
        const balances = getExchangeBalances(exchange)
        if (balances && typeof balances === 'object') {
          const filteredBalances: Record<string, any> = {}
          Object.entries(balances).forEach(([symbol, balance]) => {
            const valueUSD = parseFloat((balance.usd_value || balance.value_usd || 0).toString())
            // Mantém apenas tokens com valor > 0
            if (valueUSD > 0) {
              filteredBalances[symbol] = balance
            }
          })
          
          return {
            ...exchange,
            balances: filteredBalances,
            tokens: filteredBalances
          }
        }
        return exchange
      })
    }
    
    // Ordenar exchanges por valor total USD (maior para menor)
    const sorted = filtered.sort((a, b) => {
      const totalA = getTotalUsd(a)
      const totalB = getTotalUsd(b)
      return totalB - totalA
    })
    
    return sorted
  }, [data, data?.timestamp, hideZeroBalanceExchanges, searchQuery])

  // Calcular totais agregados por token (soma de todas as exchanges)
  const tokenAggregates = useMemo(() => {
    const aggregates: Record<string, { totalAmount: number; totalUSD: number; exchanges: number }> = {}
    
    if (data?.exchanges) {
      data.exchanges.forEach((exchange: any) => {
        // ✅ Suporta ambas estruturas: balances (nova) e tokens (antiga)
        const balances = getExchangeBalances(exchange)
        
        if (balances && typeof balances === 'object') {
          Object.entries(balances).forEach(([symbol, tokenData]: [string, any]) => {
            if (!aggregates[symbol]) {
              aggregates[symbol] = { totalAmount: 0, totalUSD: 0, exchanges: 0 }
            }
            
            // ✅ Suporta ambas estruturas
            const amount = tokenData.total || tokenData.amount || 0
            const valueUsd = tokenData.usd_value || tokenData.value_usd || 0
            
            aggregates[symbol].totalAmount += parseFloat(amount.toString()) || 0
            aggregates[symbol].totalUSD += parseFloat(valueUsd.toString()) || 0
            aggregates[symbol].exchanges += 1
          })
        }
      })
    }
    
    return aggregates
  }, [data])

  // Estilos dinâmicos baseados no tema
  const themedStyles = useMemo(() => ({
    card: { backgroundColor: colors.surface },
    toggle: { 
      backgroundColor: isDark ? 'rgba(60, 60, 60, 0.4)' : 'rgba(220, 220, 220, 0.5)', 
      borderColor: isDark ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.4)' 
    },
    toggleActive: { 
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.5)', 
      borderColor: isDark ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.7)' 
    },
    toggleThumb: { 
      backgroundColor: isDark ? 'rgba(140, 140, 140, 0.9)' : 'rgba(120, 120, 120, 0.85)' 
    },
    toggleThumbActive: { 
      backgroundColor: isDark ? 'rgba(96, 165, 250, 1)' : 'rgba(59, 130, 246, 1)' 
    },
    tokensContainer: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
    logoContainer: { backgroundColor: '#ffffff', borderColor: colors.border }, // Fundo branco em ambos os modos para os ícones
  }), [colors, isDark])

  // Cores do gradiente para os cards - tons neutros suaves
  const cardGradientColors: readonly [string, string, ...string[]] = isDark 
    ? ['rgba(26, 26, 26, 0.95)', 'rgba(38, 38, 38, 0.95)', 'rgba(26, 26, 26, 0.95)']  // Dark mode - preto/cinza escuro
    : ['rgba(250, 250, 249, 1)', 'rgba(247, 246, 244, 1)', 'rgba(250, 250, 249, 1)']  // Light mode - bege muito claro suave

  // Mostra skeleton apenas durante loading inicial (não durante refresh)
  if (loading && !data && !error) {
    return (
      <View style={styles.container}>
        <SkeletonExchangeItem />
        <SkeletonExchangeItem />
        <SkeletonExchangeItem />
      </View>
    )
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        {error ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        ) : (
          <View style={styles.emptyStateContainer}>
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
              {t('exchanges.noExchanges') || 'Nenhuma exchange vinculada'}
            </Text>
            <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
              {t('exchanges.addFirstExchange') || 'Adicione sua primeira exchange para começar a monitorar seus investimentos'}
            </Text>
          </View>
        )}
      </View>
    )
  }
  
  return (
    <Pressable 
      style={styles.listContainer} 
      onPress={() => {
        // Não precisa mais fechar tooltip aqui (agora é modal)
      }}
    >
      {/* Card Principal com LinearGradient - DUPLICADO do Summary */}
      <LinearGradient
        colors={cardGradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, { borderColor: colors.border }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.valueContainer}>
            <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
              {data?.timestamp ? `Updated ${new Date((typeof data.timestamp === 'number' ? data.timestamp : Number(data.timestamp)) * 1000).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}` : 'Updated recently'}
            </Text>
          </View>
        </View>

        {/* Campo de Busca */}
        <View style={styles.searchContainer}>
          <Text style={[styles.searchIcon, { color: colors.textSecondary }]}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text, borderColor: colors.border }]}
            placeholder="BTC, ETH, SOL..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Text style={[styles.clearIcon, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Resultado da busca externa */}
        {searchQuery.trim().length >= 2 && externalSearchResult && (
          <View style={[styles.externalSearchResult, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {searchingExchange ? (
              <View style={styles.searchingContainer}>
                <ActivityIndicator size="small" />
                <Text style={[styles.searchingText, { color: colors.textSecondary }]}>
                  {t('assets.searchingExchanges').replace('{query}', searchQuery.toUpperCase())}
                </Text>
              </View>
            ) : externalSearchResult.found ? (
              <View style={styles.tokenFoundContainer}>
                <View style={styles.tokenFoundHeader}>
                  <View style={styles.tokenFoundInfo}>
                    <Text style={[styles.tokenFoundSymbol, { color: colors.text }]}>
                      {externalSearchResult.symbol}
                    </Text>
                    <Text style={[styles.tokenFoundExchange, { color: colors.textSecondary }]}>
                      {t('assets.availableOn').replace('{exchange}', externalSearchResult.exchangeName)}
                    </Text>
                  </View>
                  {externalSearchResult.price > 0 && (
                    <Text style={[styles.tokenFoundPrice, { color: colors.text }]}>
                      ${externalSearchResult.price.toFixed(6)}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.tokenFoundButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    // Abre modal de trade para o token encontrado
                    setSelectedTrade({
                      exchangeId: externalSearchResult.exchangeId,
                      exchangeName: externalSearchResult.exchangeName,
                      symbol: externalSearchResult.symbol,
                      currentPrice: externalSearchResult.price,
                      balance: { token: 0, usdt: 0, brl: 0 }
                    })
                    setTradeModalVisible(true)
                  }}
                >
                  <Text style={[styles.tokenFoundButtonText, { color: '#FFFFFF' }]}>
                    {t('common.viewDetails')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.tokenNotFoundContainer}>
                <Ionicons name="search-outline" size={24} color={colors.textTertiary} />
                <Text style={[styles.tokenNotFoundText, { color: colors.textSecondary }]}>
                  {t('assets.tokenNotFound').replace('{symbol}', externalSearchResult.symbol)}
                </Text>
                <Text style={[styles.tokenNotFoundSubtext, { color: colors.textTertiary }]}>
                  {t('assets.tokenNotFoundDesc')}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.filterDivider} />

        {/* Toggle de Filtro */}
        <TouchableOpacity 
          style={styles.filterRow}
          onPress={toggleZeroBalanceExchanges}
          activeOpacity={0.7}
        >
          <View style={styles.filterContent}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              Hide $0.00 tokens
            </Text>
          </View>
          <View style={[styles.toggle, themedStyles.toggle, hideZeroBalanceExchanges && [styles.toggleActive, themedStyles.toggleActive]]}>
            <View style={[
              styles.toggleThumb, 
              themedStyles.toggleThumb, 
              hideZeroBalanceExchanges && styles.toggleThumbActive,
              hideZeroBalanceExchanges && themedStyles.toggleThumbActive
            ]} />
          </View>
        </TouchableOpacity>
      </LinearGradient>

      {/* Mostra mensagem quando não há exchanges */}
      {filteredExchanges.length === 0 && (
        <View style={styles.emptyStateContainer}>
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
            {hideZeroBalanceExchanges 
              ? (t('exchanges.allExchangesHidden') || 'Todas as exchanges estão ocultas')
              : (t('exchanges.noExchanges') || 'Nenhuma exchange vinculada')
            }
          </Text>
          <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
            {hideZeroBalanceExchanges
              ? (t('exchanges.disableFilterToSee') || 'Desative o filtro para ver exchanges com saldo zero')
              : (t('exchanges.addFirstExchange') || 'Adicione sua primeira exchange para começar a monitorar seus investimentos')
            }
          </Text>
        </View>
      )}

      <View style={styles.list} collapsable={false}>
        {filteredExchanges.map((exchange) => {
          // ✅ Suporta ambas estruturas: balances (nova) e tokens (antiga)
          const balances = getExchangeBalances(exchange)
          const allTokens = Object.entries(balances) as [string, any][]
          
          // Ordenar tokens: stablecoins por último, depois por valor
          const sortedTokens = allTokens.sort((a, b) => {
            const [symbolA, tokenA] = a
            const [symbolB, tokenB] = b
            
            const isStablecoinA = STABLECOINS.includes(symbolA.toUpperCase())
            const isStablecoinB = STABLECOINS.includes(symbolB.toUpperCase())
            
            if (isStablecoinA && !isStablecoinB) return 1
            if (!isStablecoinA && isStablecoinB) return -1
            
            // ✅ Suporta ambas estruturas
            const valueA = parseFloat((tokenA.usd_value || tokenA.value_usd || 0).toString())
            const valueB = parseFloat((tokenB.usd_value || tokenB.value_usd || 0).toString())
            return valueB - valueA
          })

          // Converter tokens para o formato esperado pelo CompactAssetCard
          const formattedAssets = sortedTokens.slice(0, 10).map(([symbol, token]) => {
            // ✅ Suporta ambas estruturas
            const valueUSD = parseFloat((token.usd_value || token.value_usd || 0).toString())
            const priceUSD = parseFloat((token.price_usd || 0).toString())
            const amount = (token.total || token.amount || 0).toString()
            
            // 🆕 Adiciona free, used e total do balance
            const free = parseFloat((token.free || 0).toString())
            const used = parseFloat((token.used || 0).toString())
            const total = parseFloat((token.total || 0).toString())
            
            const usdtToken = sortedTokens.find(([sym]) => sym === 'USDT' || sym === 'usdt')
            const usdtBalance = usdtToken ? parseFloat((usdtToken[1].free || usdtToken[1].total || usdtToken[1].amount || 0).toString()) : 0
            
            const brlToken = sortedTokens.find(([sym]) => sym === 'BRL' || sym === 'brl')
            const brlBalance = brlToken ? parseFloat((brlToken[1].free || brlToken[1].total || brlToken[1].amount || 0).toString()) : 0
            
            const exchangeId = getExchangeId(exchange)
            const exchangeName = getExchangeName(exchange)
            const tokenVariations = exchangeVariations[exchangeId]?.[symbol]
            const isStablecoin = STABLECOINS.includes(symbol.toUpperCase())
            const variation24h = isStablecoin ? 0 : (token.change_24h || tokenVariations?.['24h']?.price_change_percent)

            return {
              id: `${exchangeId}-${symbol}`,
              symbol: symbol.toUpperCase(),
              amount,           // string: quantidade formatada
              free,             // number: disponível para trading
              used,             // number: em ordens abertas
              total,            // number: total (free + used)
              priceUSD,         // number: preço em USD
              valueUSD,         // number: valor total em USD
              usdtBalance,      // number: saldo USDT da exchange
              brlBalance,       // number: saldo BRL da exchange (para pares fiat)
              isStablecoin,     // boolean
              variation24h,     // number | undefined: variação 24h
              exchangeId,       // string
              exchangeName,     // string
            }
          })

          // Calcular valor total USD da exchange
          const exchangeTotalUSD = getTotalUsd(exchange)

          return (
            <View key={getExchangeId(exchange)} style={styles.exchangeSection}>
              {/* Exchange Header - mesmo estilo do header dos order cards */}
              <View style={[styles.exchangeCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={[styles.exchangeCardHeader, { borderBottomColor: colors.border }]}>
                  <View style={styles.exchangeCardLeft}>
                    <Image 
                      source={getExchangeLogo(getExchangeName(exchange))} 
                      style={styles.exchangeCardLogo}
                      resizeMode="contain"
                    />
                    <Text style={[styles.exchangeCardName, { color: colors.text }]}>
                      {String(getExchangeName(exchange))}
                    </Text>
                  </View>
                  <Text style={[styles.exchangeCardTotal, { color: colors.text }]}>
                    {String(valuesHidden ? '****' : apiService.formatUSD(exchangeTotalUSD))}
                  </Text>
                </View>

                {/* Asset rows - inline como os order items */}
                <View style={styles.exchangeCardBody}>
                  {formattedAssets.map((asset: any, index: number) => (
                    <BlinkingAssetCard
                      key={asset.id}
                      isAffected={recentlyAffectedSymbols.has(asset.symbol?.toUpperCase())}
                      style={[
                        styles.assetItemRow,
                        { borderBottomColor: colors.border },
                        index === formattedAssets.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() => {
                        setSelectedToken({
                          exchangeId: asset.exchangeId,
                          symbol: asset.symbol
                        })
                        setTokenModalVisible(true)
                      }}
                    >
                      {/* Two-line layout:
                           Linha 1: [NomeToken]                    [precoToken]
                           Linha 2: [qtdToken]  [valorUSD]  [var%]            */}
                      <View style={styles.assetTwoLineContainer}>
                        {/* Linha 1: símbolo à esquerda, preço à direita */}
                        <View style={styles.assetRow1}>
                          <Text style={[styles.assetSymbolText, { color: colors.text }]} numberOfLines={1}>
                            {String(asset.symbol)}
                          </Text>
                          <Text style={[styles.assetPriceText, { color: colors.text }]} numberOfLines={1}>
                            {asset.priceUSD > 0
                              ? `$${asset.priceUSD < 0.01 ? asset.priceUSD.toFixed(6) : asset.priceUSD < 1 ? asset.priceUSD.toFixed(4) : asset.priceUSD.toFixed(2)}`
                              : '—'}
                          </Text>
                        </View>

                        {/* Linha 2: quantidade · valor USD · variação */}
                        <View style={styles.assetRow2}>
                          <Text style={[styles.assetAmountText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {valuesHidden
                              ? '****'
                              : `${parseFloat(asset.amount) < 0.0001 ? parseFloat(asset.amount).toFixed(8) : parseFloat(asset.amount) < 1 ? parseFloat(asset.amount).toFixed(4) : parseFloat(asset.amount).toFixed(2)} ${asset.symbol}`}
                          </Text>
                          <View style={styles.assetRow2Right}>
                            <Text style={[styles.assetValueText, { color: colors.textSecondary }]} numberOfLines={1}>
                              {valuesHidden ? '****' : apiService.formatUSD(asset.valueUSD)}
                            </Text>
                            {!asset.isStablecoin && asset.variation24h !== undefined && asset.variation24h !== null ? (
                              <Text style={[styles.assetVariationText, {
                                color: asset.variation24h >= 0 ? colors.success : colors.danger
                              }]} numberOfLines={1}>
                                {(asset.variation24h >= 0 ? '▲' : '▼') + ' ' + Math.abs(Number(asset.variation24h)).toFixed(2)}%
                              </Text>
                            ) : (
                              <Text style={[styles.assetVariationText, { color: colors.textSecondary, opacity: 0.3 }]}>—</Text>
                            )}
                          </View>
                        </View>
                      </View>
                    </BlinkingAssetCard>
                  ))}
                </View>
              </View>
            </View>
          )
        })}
      </View>

      {/* Modal de Detalhes do Token */}
      {selectedToken && (
        <TokenDetailsModal
          visible={tokenModalVisible}
          onClose={handleCloseTokenModal}
          exchangeId={selectedToken.exchangeId}
          symbol={selectedToken.symbol}
        />
      )}

      {/* Modal de Info Agregada do Token */}
      <Modal
        visible={tokenInfoModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setTokenInfoModalVisible(false)
          setTokenInfoVisible(null)
          setSelectedExchangeId(null)
        }}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => {
            setTokenInfoModalVisible(false)
            setTokenInfoVisible(null)
            setSelectedExchangeId(null)
          }}
        >
          <Pressable 
            style={[styles.tokenInfoModal, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            {tokenInfoVisible && tokenAggregates[tokenInfoVisible] && selectedExchangeId && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                      {tokenInfoVisible.toUpperCase()}
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                      {data?.exchanges?.find((ex: any) => getExchangeId(ex) === selectedExchangeId) 
                        ? getExchangeName(data.exchanges.find((ex: any) => getExchangeId(ex) === selectedExchangeId)!)
                        : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setTokenInfoModalVisible(false)
                      setTokenInfoVisible(null)
                      setSelectedExchangeId(null)
                    }}
                    style={styles.closeButton}
                  >
                    <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalContent}>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                      {t('token.total') || 'Total'}
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {hideValue(apiService.formatTokenAmount(tokenAggregates[tokenInfoVisible].totalAmount.toString()))}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                      {t('token.value') || 'Valor'}
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {hideValue(`$${apiService.formatUSD(tokenAggregates[tokenInfoVisible].totalUSD)}`)}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Trade */}
      {selectedTrade && (
        <TradeModal
          visible={tradeModalVisible}
          onClose={() => setTradeModalVisible(false)}
          exchangeId={selectedTrade.exchangeId}
          exchangeName={selectedTrade.exchangeName}
          symbol={selectedTrade.symbol}
          currentPrice={selectedTrade.currentPrice}
          balance={selectedTrade.balance}
          onBalanceUpdate={() => {
            console.log('🔄 [ASSETS-LIST] onBalanceUpdate chamado após criação de ordem')
            refreshBalance();
          }}
          onOrderCreated={() => {
            console.log('🔄 [ASSETS-LIST] onOrderCreated chamado após criação de ordem')
            // 1. Atualiza o contexto global de ordens
            refreshOrders();
            // 2. Atualiza a contagem local de ordens para a exchange específica
            fetchOpenOrdersForExchange(selectedTrade.exchangeId);
          }}
        />
      )}

      {/* Modal de Criar Alerta */}
      {selectedTokenForAlert && (
        <CreateAlertModal
          visible={alertModalVisible}
          onClose={() => {
            setAlertModalVisible(false)
            setTimeout(() => setSelectedTokenForAlert(null), 300)
          }}
          symbol={selectedTokenForAlert.symbol}
          currentPrice={selectedTokenForAlert.price}
          exchangeId={selectedTokenForAlert.exchangeId}
          exchangeName={selectedTokenForAlert.exchangeName}
        />
      )}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  listContainer: {
    marginTop: 0,
  },
  // Campo de Busca
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 10,
    fontSize: typography.body,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    paddingLeft: 32,
    paddingRight: 32,
    fontSize: typography.bodySmall,
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
    borderWidth: 1,
  },
  clearButton: {
    position: 'absolute',
    right: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearIcon: {
    fontSize: typography.caption,
    opacity: 0.5,
  },
  // Resultado da busca externa
  externalSearchResult: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  searchingText: {
    fontSize: typography.tiny,
  },
  tokenFoundContainer: {
    gap: 8,
  },
  tokenFoundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenFoundInfo: {
    flex: 1,
    gap: 2,
  },
  tokenFoundSymbol: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  tokenFoundExchange: {
    fontSize: typography.tiny,
  },
  tokenFoundPrice: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  tokenFoundButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: 'center',
  },
  tokenFoundButtonText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
  },
  tokenNotFoundContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  tokenNotFoundText: {
    fontSize: typography.tiny,
    flex: 1,
  },
  tokenNotFoundSubtext: {
    fontSize: typography.micro,
    opacity: 0.6,
    marginTop: 3,
    textAlign: 'center',
  },
  // Card Principal
  container: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 10,
  },
  // Card de filtro
  filterCard: {
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 0,
  },
  filterDivider: {
    height: 1,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    marginVertical: 10,
  },
  valueContainer: {
    flexDirection: "column",
    gap: 4,
  },
  value: {
    fontSize: typography.displaySmall,  // 28px - mesmo do Summary
    fontWeight: fontWeights.light,
    letterSpacing: -1.2,
  },
  lastUpdated: {
    fontSize: typography.micro,
    fontWeight: fontWeights.light,
    opacity: 0.4,
  },
  refreshButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
  refreshIcon: {
    fontSize: typography.h4,
    fontWeight: fontWeights.light,
    opacity: 0.6,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterLabel: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },
  filterCount: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleActive: {
    // Colors from theme
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  syncIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    opacity: 0.8,
  },
  syncText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
  },
  lastSyncContainer: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: "flex-start",
  },
  lastSyncText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    fontStyle: "italic",
    opacity: 0.7,
  },
  exchangeSection: {
    marginBottom: 14,
  },
  exchangeCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  exchangeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
  },
  exchangeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exchangeCardLogo: {
    width: 20,
    height: 20,
  },
  exchangeCardName: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
  },
  exchangeCardTotal: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },
  exchangeCardBody: {
    // Container for asset rows inside the card
  },
  // Asset item row - duas linhas
  assetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
  },
  // Container que ocupa toda a largura e organiza as 2 linhas
  assetTwoLineContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 3,
  },
  // Linha 1: símbolo (esquerda) + preço (direita)
  assetRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Linha 2: quantidade (esquerda) + [valor + variação] (direita)
  assetRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetRow2Right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assetSymbolContainer: {
    minWidth: 48,
    maxWidth: 60,
  },
  assetSymbolText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },
  assetPriceText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  assetAmountText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
  },
  assetValueText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.medium,
  },
  assetVariationText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.bold,
  },
  // Mantido para compatibilidade (não usado no novo layout)
  assetVariationBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 42,
    alignItems: 'center',
  },
  assetValuesContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  // Mantidos para compatibilidade
  assetPriceContainer: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
  },
  assetHoldingsContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 72,
  },
  list: {
    gap: 8,
    paddingHorizontal: 0,
  },
  card: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 0,
  },
  cardMargin: {
    marginBottom: 6,
  },
  cardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: 2,
    borderWidth: 0,
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  logoFallback: {
    fontSize: typography.bodySmall,
  },
  exchangeName: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },
  orderCount: {
    fontSize: typography.tiny,
  },
  exchangeNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  ordersBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 5,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  ordersBadgeText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.3,
  },
  infoIconButton: {
    padding: 2,
    marginLeft: 4,
  },
  infoIconText: {
    fontSize: typography.h4,
  },
  assetsCount: {
    fontSize: typography.micro,
    fontWeight: fontWeights.light,
  },
  rightSection: {
    alignItems: "flex-end",
  },
  balance: {
    fontSize: typography.body,
    fontWeight: fontWeights.light,
    marginBottom: 2,
  },
  change: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
  },
  changePositive: {
  },
  changeNegative: {
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: typography.body,
    textAlign: "center",
    padding: 20,
  },
  tokensContainer: {
    borderRadius: 0,
    padding: 10,
    marginTop: 0,
    borderWidth: 0,
    overflow: 'hidden',
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 0.5,
    opacity: 0.8,
  },
  infoIconContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFA500",
    alignItems: "center",
    justifyContent: "center",
  },
  infoIconYellow: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.bold,
    color: "#FFFFFF",
  },
  infoText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.light,
    flex: 1,
    lineHeight: 14,
  },
  tokensTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  infoButton: {
    padding: 4,
  },
  infoIcon: {
    fontSize: typography.body,
    opacity: 0.6,
  },
  lastUpdate: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    marginBottom: 12,
    opacity: 0.5,
  },
  noTokensText: {
    fontSize: typography.caption,
    textAlign: "center",
    paddingVertical: 10,
  },
  moreTokensText: {
    fontSize: typography.caption,
    textAlign: "center",
    paddingVertical: 12,        // +50% mais espaço
    fontStyle: "italic",
    opacity: 0.6,               // mais discreto
    fontWeight: fontWeights.medium,
  },
  tokenItem: {
    flexDirection: "column",
    gap: 6,
  },
  tokenTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tokenMiddleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tokenBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tokenBottomLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  tokenLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  tokenSymbolBadge: {
    borderRadius: 6,
    borderWidth: 1,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenAmount: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
  },
  tokenPriceSeparator: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
  },
  tokenPrice: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
  },
  tokenValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  tokenValueZero: {
    // Applied via inline style
  },
  tokenRight: {
    alignItems: "flex-end",
  },
  variationsContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 4,
  },
  priceChangeContainer: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
  },
  priceChangeText: {
    textAlign: "center",
  },
  // 🆕 Estilos compactos para layout horizontal simplificado - CARD DESIGN (igual aos cards de ordens)
  tokenItemCompact: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
  },
  tokenHeader: {
    marginBottom: 10,
  },
  tokenTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  tokenSymbol: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.2,
  },
  variationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  variationText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.4,
  },
  tokenDetails: {
    gap: 5,
  },
  tokenDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenDetailLabel: {
    fontSize: typography.tiny,
  },
  tokenDetailValue: {
    fontSize: typography.tiny,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  detailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
  },
  detailsButtonText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
  },
  tradeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
  },
  tradeButtonText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
  },
  // 🆕 Estilos antigos para compatibilidade
  tokenHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tokenSymbolCard: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.2,
  },
  variationBadgeCard: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  variationTextCard: {
    fontSize: typography.micro,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.3,
  },
  tokenDetailsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  tokenFooterRow: {
    marginTop: 3,
    flexDirection: 'row',
    gap: 6,
  },
  tokenFooterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  tokenFooterButtonText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },
  tradeButtonCard: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  tokenCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  tokenSymbolCompact: {
    fontSize: typography.bodySmall,  // tamanho consistente com orders
    fontWeight: fontWeights.semibold, // semibold é suficiente
    letterSpacing: 0.2,         // reduzido para compactar
    textAlign: "left",
    opacity: 1,                 // 100% opacidade
    textTransform: 'uppercase', // sempre maiúsculo
    flex: 1,                    // ocupa espaço disponível
  },
  availabilityIndicator: {
    width: 7,                   // +17% maior
    height: 7,
    borderRadius: 3.5,
    marginRight: 2,
  },
  tokenAmountCompact: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    flex: 1,
    textAlign: "left",
    opacity: 0.7,               // mais discreto
  },
  tokenValueCompact: {
    fontSize: typography.body,  // era caption - maior
    fontWeight: fontWeights.semibold, // era medium - destaque
    minWidth: 70,               // +17% largura
    textAlign: "right",
    letterSpacing: 0.2,
  },
  variationBadgeCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    minWidth: 64,
  },
  variationTextCompact: {
    fontSize: typography.caption, // era tiny - MAIOR
    fontWeight: fontWeights.bold,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  loadingTokens: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 12,
  },
  loadingTokensText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
  },
  tooltip: {
    position: "absolute",
    bottom: -30,
    left: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.35,
    shadowRadius: 4.65,
    elevation: 10,
    zIndex: 9999,
  },
  tooltipText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },
  tokenInfoTooltip: {
    position: "absolute",
    top: 30,
    left: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 9999,
    minWidth: 180,
    gap: 4,
  },
  tokenInfoTooltipFloating: {
    position: "absolute",
    // top e left serão definidos dinamicamente
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 99999,
    gap: 6,
    minWidth: 200,
    maxWidth: 300,
  },
  tokenInfoTitle: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
    marginBottom: 4,
  },
  tokenInfoText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },
  tokenInfoSmall: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    marginTop: 2,
  },
  // Estilos do Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  tokenInfoModal: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    minWidth: 260,
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  modalTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeights.bold,
  },
  modalSubtitle: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    marginTop: 4,
    opacity: 0.7,
  },
  closeButton: {
    padding: 4,
    marginRight: -4,
  },
  closeButtonText: {
    fontSize: typography.displaySmall,
    fontWeight: fontWeights.regular,
    lineHeight: 20,
  },
  modalContent: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },
  infoValue: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  emptyStateTitle: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  errorBadgeText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.bold,
    textTransform: 'uppercase',
  },
  ordersButton: {
    minWidth: 32,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
    position: 'relative',
  },
  ordersButtonText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.bold,
    lineHeight: 16,
  },
  ordersTooltip: {
    position: 'absolute',
    top: -36,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    minWidth: 120,
  },
  ordersTooltipText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
    textAlign: 'center',
  },
})




