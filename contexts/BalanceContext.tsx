import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Platform } from 'react-native'
import { apiService } from '@/services/api'
import { BalanceResponse } from '@/types/api'
import { config } from '@/lib/config'
import { useAuth } from './AuthContext'

interface BalanceContextType {
  data: BalanceResponse | null
  loading: boolean
  isLoading: boolean // Alias para compatibilidade
  error: string | null
  refreshing: boolean
  fetchBalances: (forceRefresh?: boolean, silent?: boolean) => Promise<void>
  refresh: () => Promise<void>
  refreshOnExchangeChange: () => Promise<void>
  loadFullBalances: () => Promise<void> // 🚀 NEW: Lazy load full balances
  fetchExchangeDetails: (exchangeId: string) => Promise<any>
  updateExchangeInCache: (exchangeId: string, exchangeData: any) => void
  onBalanceLoaded: (callback: () => void) => void // 🆕 Callback para quando balance carregar
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined)

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth() // Obtém o usuário autenticado
  const [data, setData] = useState<BalanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const hasFetchedInitialRef = useRef<boolean>(false) // Ref para controlar fetch inicial
  const isFetchingRef = useRef(false) // 🔒 Lock ÚNICO para evitar chamadas simultâneas
  const onBalanceLoadedCallbackRef = useRef<(() => void) | null>(null) // 🆕 Callback para notificar quando carrega

  const fetchBalances = useCallback(async (forceRefresh = false, silent = false) => {
    // 🔒 PROTEÇÃO ATÔMICA: Verifica E marca o lock numa única operação
    if (isFetchingRef.current) {
      console.log('⏭️ [BalanceContext] Fetch já em andamento, ignorando...')
      return
    }
    
    // 🔒 Marca que está buscando IMEDIATAMENTE (antes de qualquer await)
    isFetchingRef.current = true
    console.log('🔐 [BalanceContext] Lock adquirido, iniciando fetch...')
    
    // ✅ ATIVA ESTADOS DE LOADING IMEDIATAMENTE (antes de qualquer await ou verificação)
    if (!silent && !data) {
      setLoading(true)
    } else if (!silent && forceRefresh) {
      setRefreshing(true)
    }
    
    // ⏰ TIMEOUT DE SEGURANÇA: Remove loading após 60s (alinhado com BALANCE_SYNC timeout)
    const safetyTimeout = setTimeout(() => {
      console.error('⏰ [BalanceContext] TIMEOUT DE SEGURANÇA (60s) - Forçando remoção do loading')
      setLoading(false)
      setRefreshing(false)
      isFetchingRef.current = false
      setError('Timeout ao carregar dados. Tente novamente.')
    }, 60000)
    
    try {     
      // Se não tem usuário autenticado, não faz nada
      if (!user?.id) {
        setLoading(false)
        setRefreshing(false)
        isFetchingRef.current = false
        clearTimeout(safetyTimeout)
        return
      }
      
      setError(null)
      
      // Busca direto da API
      console.log('📡 [BalanceContext] Chamando apiService.getBalances()...')
      const response = await apiService.getBalances(user.id, forceRefresh)
      console.log('✅ [BalanceContext] Resposta recebida:', response ? 'COM DADOS' : 'SEM DADOS')
      
      if (!response) {
        console.log('⚠️ [BalanceContext] Nenhuma resposta da API, finalizando...')
        isFetchingRef.current = false
        setLoading(false)
        setRefreshing(false)
        return
      }
      
      // ⚠️ PROTEÇÃO: Se todas as exchanges falharam (timeout, erro), não sobrescreve os dados
      const hasExchanges = response.exchanges && response.exchanges.length > 0
      const allExchangesFailed = hasExchanges 
        ? response.exchanges.every((ex: any) => ex.success === false)
        : false
      const hasTimeout = hasExchanges
        ? response.exchanges.some((ex: any) => 
            ex.error && (
              ex.error.includes('timeout') || 
              ex.error.includes('Timeout') ||
              ex.error.includes('40s')  // Novo timeout
            )
          )
        : false
      
      // Se todas falharam por timeout E já temos dados anteriores válidos, mantém os dados antigos
      const currentTotal = typeof data?.total_usd === 'string' 
        ? parseFloat(data.total_usd) 
        : (data?.total_usd || 0)
      
      if (allExchangesFailed && hasTimeout && data && currentTotal > 0) {
        console.warn('⚠️ Todas as exchanges falharam por timeout. Mantendo dados anteriores.')
        
        // Marca que houve erro mas mantém os dados
        setError('Timeout ao buscar saldos. Mostrando último valor conhecido.')
        isFetchingRef.current = false
        return
      }
      
      // Se pelo menos uma exchange teve sucesso OU não temos dados anteriores, atualiza
      setData(response)
      
      // 🆕 NOTIFICA que o balance foi carregado
      if (onBalanceLoadedCallbackRef.current) {
        onBalanceLoadedCallbackRef.current()
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch balances'
      console.error('❌ [BalanceContext.fetchBalances] Error fetching balances:', errorMsg)
      console.error('❌ [BalanceContext.fetchBalances] Stack:', err instanceof Error ? err.stack : err)
      setError(errorMsg)
    } finally {
      console.log('🧹 [BalanceContext] Finalizando fetchBalances, removendo loading...')
      
      // ✅ Aguarda um pouco para garantir que a UI processou os novos dados
      // antes de desativar o loading/refreshing
      await new Promise(resolve => setTimeout(resolve, 300))
      
      setLoading(false)
      setRefreshing(false)
      isFetchingRef.current = false
      console.log('✅ [BalanceContext] Loading removido, isFetching=false')
      
      // ⏰ Limpa o timeout de segurança
      clearTimeout(safetyTimeout)
    }
  }, [user?.id])

  const refresh = useCallback(async () => {
    // ✅ NÃO precisa de lock aqui - fetchBalances já tem o lock isFetchingRef
    await fetchBalances(true, false)
  }, [fetchBalances])

  const loadFullBalances = useCallback(async () => {
    // Se já tem dados completos (tem lista de tokens), não precisa recarregar
    if (data && (data as any).tokens) return
    
    // Carrega dados completos
    await fetchBalances(false, false)
  }, [data, fetchBalances])

  const refreshOnExchangeChange = useCallback(async () => {
    // Atualiza de forma silenciosa
    await fetchBalances(true, true)
  }, [fetchBalances])

  useEffect(() => {
    if (user?.id && !hasFetchedInitialRef.current) {
      hasFetchedInitialRef.current = true
      
      // ✅ Apenas busca balances, sem open orders
      fetchBalances(false, false).catch(err => {
        console.error('Error in initial load:', err)
      })
    } else if (!user?.id) {
      hasFetchedInitialRef.current = false
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    
    const timeout = setTimeout(() => {
      const doRefresh = async () => {
        // ✅ NÃO precisa de lock aqui - fetchBalances já tem o lock isFetchingRef
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

  // 🆕 Função para registrar callback quando balance carregar
  const onBalanceLoaded = useCallback((callback: () => void) => {
    onBalanceLoadedCallbackRef.current = callback
  }, [])

  const value = useMemo(() => ({
    data,
    loading,
    isLoading: loading, // Alias para compatibilidade
    error,
    refreshing,
    fetchBalances,
    refresh,
    refreshOnExchangeChange,
    loadFullBalances, // 🚀 NEW
    fetchExchangeDetails,
    updateExchangeInCache,
    onBalanceLoaded // 🆕 NEW: Callback para quando balance carregar
  }), [data, loading, error, refreshing, fetchBalances, refresh, refreshOnExchangeChange, loadFullBalances, fetchExchangeDetails, updateExchangeInCache, onBalanceLoaded])

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
