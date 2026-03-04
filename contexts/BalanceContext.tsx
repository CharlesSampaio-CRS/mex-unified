import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { apiService } from '@/services/api'
import { BalanceResponse } from '@/types/api'
import { useAuth } from './AuthContext'
import { 
  saveBalanceToLocalCache, 
  loadBalanceFromLocalCache, 
  clearBalanceLocalCache 
} from '@/lib/balance-cache'

interface BalanceContextType {
  data: BalanceResponse | null
  loading: boolean
  isLoading: boolean // Alias para compatibilidade
  error: string | null
  refreshing: boolean
  isStale: boolean // 🆕 Indica se os dados exibidos são do cache (stale)
  fetchBalances: (forceRefresh?: boolean, silent?: boolean) => Promise<void>
  refresh: () => Promise<void>
  refreshOnExchangeChange: () => Promise<void>
  loadFullBalances: () => Promise<void>
  fetchExchangeDetails: (exchangeId: string) => Promise<any>
  updateExchangeInCache: (exchangeId: string, exchangeData: any) => void
  onBalanceLoaded: (callback: () => void) => void
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined)

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<BalanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isStale, setIsStale] = useState(false) // 🆕 Dados são do cache?
  const hasFetchedInitialRef = useRef<boolean>(false)
  const isFetchingRef = useRef(false)
  const onBalanceLoadedCallbackRef = useRef<(() => void) | null>(null)

  // ==================== 🚀 STALE-WHILE-REVALIDATE ====================
  // Fluxo otimizado:
  //   1. Lê cache local (SecureStore) → exibe instantaneamente (isStale=true)
  //   2. Chama /balances/cached (backend MongoDB) → atualiza se mais recente
  //   3. Chama /balances/secure (CCXT real-time) → atualiza com dados frescos (isStale=false)
  //   4. Salva resultado no cache local para próxima abertura

  /**
   * 🚀 FASE 1: Carrega cache local instantaneamente
   * Chamado quando user?.id muda (login)
   */
  const loadFromLocalCache = useCallback(async (): Promise<boolean> => {
    try {
      const cached = await loadBalanceFromLocalCache()
      if (cached?.data) {
        console.log('⚡ [BalanceContext] Cache local carregado instantaneamente!')
        setData(cached.data)
        setIsStale(true)
        setLoading(false) // 🚀 Remove loading imediatamente!
        return true
      }
    } catch (err) {
      console.warn('⚠️ [BalanceContext] Erro ao ler cache local:', err)
    }
    return false
  }, [])

  /**
   * 🚀 FASE 2: Busca cache do backend (MongoDB, ~100ms)
   * Se for mais recente que o cache local, atualiza
   */
  const loadFromBackendCache = useCallback(async (): Promise<boolean> => {
    try {
      console.log('⚡ [BalanceContext] Buscando cache do backend...')
      const cached = await apiService.getBalancesCached()
      
      if (cached?.data && cached.cached_at) {
        console.log(`✅ [BalanceContext] Cache do backend recebido (age: ${cached.age_seconds}s)`)
        setData(cached.data)
        setIsStale(true)
        setLoading(false)
        
        // Salva no cache local para próxima abertura
        saveBalanceToLocalCache(cached.data).catch(() => {})
        return true
      }
    } catch (err) {
      console.warn('⚠️ [BalanceContext] Erro ao buscar cache do backend:', err)
    }
    return false
  }, [])

  /**
   * 🚀 FASE 3: Busca dados frescos via CCXT (o fetch "real")
   * Quando chega, marca isStale=false e salva no cache local
   */
  const fetchBalances = useCallback(async (forceRefresh = false, silent = false) => {
    // 🔒 PROTEÇÃO: Se já está buscando...
    if (isFetchingRef.current) {
      if (forceRefresh && !silent) {
        console.log('🔄 [BalanceContext] Fetch em andamento, mas forceRefresh=true — aguardando...')
        setRefreshing(true)
      } else {
        console.log('⏭️ [BalanceContext] Fetch já em andamento, ignorando...')
      }
      return
    }
    
    isFetchingRef.current = true
    console.log('🔐 [BalanceContext] Lock adquirido, iniciando fetch CCXT...')
    
    // ✅ Loading states: só mostra loading se NÃO tem dados (nem do cache)
    if (!silent && !data) {
      setLoading(true)
    } else if (!silent && forceRefresh) {
      setRefreshing(true)
    }
    
    // ⏰ TIMEOUT DE SEGURANÇA (90s)
    // Se já tem dados em cache, apenas cancela silenciosamente sem mostrar erro.
    // Os dados do cache continuam visíveis para o usuário.
    const safetyTimeout = setTimeout(() => {
      console.warn('⏰ [BalanceContext] Safety timeout (90s) — cancelando fetch')
      setLoading(false)
      setRefreshing(false)
      isFetchingRef.current = false

      if (data) {
        // Tem dados do cache → mantém exibindo, sem erro visível
        console.log('ℹ️ [BalanceContext] Dados do cache mantidos, sem erro para o usuário')
        setIsStale(true)
      } else {
        // Sem nenhum dado → mostra erro para o usuário poder tentar novamente
        setError('Timeout ao carregar dados. Tente novamente.')
      }
    }, 90_000)
    
    try {
      if (!user?.id) {
        setLoading(false)
        setRefreshing(false)
        isFetchingRef.current = false
        clearTimeout(safetyTimeout)
        return
      }
      
      setError(null)
      
      console.log('📡 [BalanceContext] Chamando apiService.getBalances() (CCXT real-time)...')
      const response = await apiService.getBalances(user.id, forceRefresh)
      console.log('✅ [BalanceContext] Dados frescos recebidos!')
      
      if (!response) {
        console.log('⚠️ [BalanceContext] Nenhuma resposta da API')
        isFetchingRef.current = false
        setLoading(false)
        setRefreshing(false)
        return
      }
      
      // ⚠️ PROTEÇÃO: Se todas as exchanges falharam por timeout
      const hasExchanges = response.exchanges && response.exchanges.length > 0
      const allExchangesFailed = hasExchanges 
        ? response.exchanges.every((ex: any) => ex.success === false)
        : false
      const hasTimeout = hasExchanges
        ? response.exchanges.some((ex: any) => 
            ex.error && (
              ex.error.includes('timeout') || 
              ex.error.includes('Timeout') ||
              ex.error.includes('40s')
            )
          )
        : false
      
      const currentTotal = typeof data?.total_usd === 'string' 
        ? parseFloat(data.total_usd) 
        : (data?.total_usd || 0)
      
      if (allExchangesFailed && hasTimeout && data && currentTotal > 0) {
        console.warn('⚠️ Todas exchanges falharam por timeout. Mantendo dados do cache.')
        setIsStale(true)
        isFetchingRef.current = false
        return
      }
      
      // ✅ Atualiza com dados frescos
      setData(response)
      setIsStale(false) // 🚀 Dados agora são FRESCOS!
      
      // 💾 Salva no cache local para próxima abertura (fire-and-forget)
      saveBalanceToLocalCache(response).catch(() => {})
      
      // 🆕 NOTIFICA callback
      if (onBalanceLoadedCallbackRef.current) {
        onBalanceLoadedCallbackRef.current()
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch balances'
      console.error('❌ [BalanceContext] Error:', errorMsg)
      setError(errorMsg)
    } finally {
      console.log('🧹 [BalanceContext] Finalizando fetch, removendo loading...')
      await new Promise(resolve => setTimeout(resolve, 50))
      
      setLoading(false)
      setRefreshing(false)
      isFetchingRef.current = false
      console.log('✅ [BalanceContext] Loading removido, isFetching=false')
      clearTimeout(safetyTimeout)
    }
  }, [user?.id, data])

  const refresh = useCallback(async () => {
    console.log('🟠 [BALANCE-CONTEXT] refresh() chamado')
    const startTime = Date.now()
    await fetchBalances(true, false)
    console.log(`🟠 [BALANCE-CONTEXT] refresh() concluído em ${Date.now() - startTime}ms`)
  }, [fetchBalances])

  const loadFullBalances = useCallback(async () => {
    if (data && (data as any).tokens) return
    await fetchBalances(false, false)
  }, [data, fetchBalances])

  const refreshOnExchangeChange = useCallback(async () => {
    await fetchBalances(true, true)
  }, [fetchBalances])

  // ==================== 🚀 INITIAL LOAD: Cache-First Strategy ====================
  useEffect(() => {
    if (user?.id && !hasFetchedInitialRef.current) {
      hasFetchedInitialRef.current = true
      
      const initWithCacheFirst = async () => {
        console.log('🚀 [BalanceContext] === CACHE-FIRST INIT ===')
        const startTime = Date.now()
        
        // FASE 1: Cache local (instantâneo, ~10-50ms)
        const hasLocalCache = await loadFromLocalCache()
        if (hasLocalCache) {
          console.log(`⚡ [BalanceContext] FASE 1 OK: Cache local em ${Date.now() - startTime}ms`)
        }
        
        // FASE 2: Cache do backend (~100ms) - só se não tem cache local
        if (!hasLocalCache) {
          const hasBackendCache = await loadFromBackendCache()
          if (hasBackendCache) {
            console.log(`⚡ [BalanceContext] FASE 2 OK: Backend cache em ${Date.now() - startTime}ms`)
          }
        }
        
        // FASE 3: Dados frescos via CCXT (background, ~5-25s)
        console.log('🔄 [BalanceContext] FASE 3: Buscando dados frescos em background...')
        fetchBalances(false, hasLocalCache).catch(err => {
          console.error('Error in background refresh:', err)
        })
      }
      
      initWithCacheFirst()
    } else if (!user?.id) {
      hasFetchedInitialRef.current = false
      setData(null)
      setError(null)
      setLoading(false)
      setRefreshing(false)
      setIsStale(false)
      
      // 🗑️ Limpa cache local no logout
      clearBalanceLocalCache().catch(() => {})
    }
  }, [user?.id])

  // Auto-refresh a cada 3 minutos
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    
    const timeout = setTimeout(() => {
      const doRefresh = async () => {
        await fetchBalances(true, true)
      }
      
      doRefresh()
      interval = setInterval(doRefresh, 3 * 60 * 1000)
    }, 3 * 60 * 1000)

    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [fetchBalances])

  // Lazy load: Busca detalhes de UMA exchange específica
  const fetchExchangeDetails = useCallback(async (exchangeId: string) => {
    try {
      if (!user?.id) return null
      const details = await apiService.getExchangeDetails(user.id, exchangeId, true)
      return details
    } catch (err) {
      console.error('Error fetching exchange details:', err)
      throw err
    }
  }, [])

  const updateExchangeInCache = useCallback((exchangeId: string, exchangeData: any) => {
    if (!data) return
    const updatedExchanges = data.exchanges.map(ex => {
      if (ex.exchange_id === exchangeId) {
        return { ...ex, ...exchangeData }
      }
      return ex
    })
    setData({ ...data, exchanges: updatedExchanges })
  }, [data])

  const onBalanceLoaded = useCallback((callback: () => void) => {
    onBalanceLoadedCallbackRef.current = callback
  }, [])

  const value = useMemo(() => ({
    data,
    loading,
    isLoading: loading,
    error,
    refreshing,
    isStale, // 🆕 Exposto para a UI saber se está mostrando dados stale
    fetchBalances,
    refresh,
    refreshOnExchangeChange,
    loadFullBalances,
    fetchExchangeDetails,
    updateExchangeInCache,
    onBalanceLoaded,
  }), [data, loading, error, refreshing, isStale, fetchBalances, refresh, refreshOnExchangeChange, loadFullBalances, fetchExchangeDetails, updateExchangeInCache, onBalanceLoaded])

  return (
    <BalanceContext.Provider value={value}>
      {children}
    </BalanceContext.Provider>
  )
}

export function useBalance() {
  const context = useContext(BalanceContext)
  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider')
  }
  return context
}
