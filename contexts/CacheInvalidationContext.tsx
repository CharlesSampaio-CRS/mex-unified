import { createContext, useContext, useCallback, ReactNode, useRef } from 'react'
import { useBalance } from './BalanceContext'
import { useAuth } from './AuthContext'

interface CacheInvalidationContextType {
  invalidateAll: () => Promise<void>
  invalidateHomeData: () => Promise<void>
  onExchangeModified: () => Promise<void>
  registerExchangesRefreshCallback: (callback: () => Promise<void>) => void
  unregisterExchangesRefreshCallback: (callback: () => Promise<void>) => void
}

const CacheInvalidationContext = createContext<CacheInvalidationContextType | undefined>(undefined)

interface CacheInvalidationProviderProps {
  children: ReactNode
}

export function CacheInvalidationProvider({ children }: CacheInvalidationProviderProps) {
  const { refreshOnExchangeChange } = useBalance()
  const { user } = useAuth()
  
  // 🔄 Array de callbacks para atualizar quando exchanges mudarem
  const exchangesRefreshCallbacksRef = useRef<Set<() => Promise<void>>>(new Set())

  /**
   * Registra callback para atualizar lista de exchanges
   * Agora suporta múltiplos callbacks simultâneos
   */
  const registerExchangesRefreshCallback = useCallback((callback: () => Promise<void>) => {
    console.log('📝 [CacheInvalidation] Registrando callback, total:', exchangesRefreshCallbacksRef.current.size + 1)
    exchangesRefreshCallbacksRef.current.add(callback)
  }, [])

  /**
   * Remove callback específico quando o componente desmonta
   */
  const unregisterExchangesRefreshCallback = useCallback((callback: () => Promise<void>) => {
    console.log('🗑️ [CacheInvalidation] Removendo callback, total restante:', exchangesRefreshCallbacksRef.current.size - 1)
    exchangesRefreshCallbacksRef.current.delete(callback)
  }, [])

  /**
   * Invalida todos os dados da Home Screen
   * - Balances (total USD, por exchange, exchange status)
   * - Daily PnL (✅ incluído no fetchBalances)
   * - Portfolio evolution
   * - Top gainers/losers  
   * - Summary
   * - Assets
   * - Orders
   * 
   * NOTA: refreshOnExchangeChange() chama fetchBalances() que busca:
   *   1. apiService.getBalances() - balances + exchange status
   *   2. PNL calculado localmente via pnlService
   * Portanto, uma única chamada atualiza os balances!
   */
  const invalidateHomeData = useCallback(async () => {
    try {
      await refreshOnExchangeChange()
    } catch (error) {
      console.error('[CacheInvalidation] Error invalidating home data:', error)
      throw error
    }
  }, [refreshOnExchangeChange])

  /**
   * Callback quando uma exchange é modificada
   * Chamado quando:
   * - Exchange é conectada
   * - Exchange é desconectada  
   * - Exchange é deletada
   * - Exchange é ativada/desativada
   * 
   * IMPORTANTE: Também atualiza a lista de exchanges no ExchangesManager
   */
  const onExchangeModified = useCallback(async () => {
    console.log('🔄 [CacheInvalidation] Exchange modificada - notificando', exchangesRefreshCallbacksRef.current.size, 'callbacks')
    
    // Executa os callbacks E atualiza home screen em paralelo (evita dupla chamada sequencial)
    await Promise.all([
      // 1. Atualizar TODOS os callbacks registrados (ExchangesManager + ExchangesScreen)
      (async () => {
        if (exchangesRefreshCallbacksRef.current.size > 0) {
          const callbacks = Array.from(exchangesRefreshCallbacksRef.current)
          
          // Executa todos os callbacks em paralelo
          await Promise.all(
            callbacks.map(async (callback, index) => {
              try {
                console.log(`  ↳ Executando callback ${index + 1}/${callbacks.length}...`)
                await callback()
              } catch (error) {
                console.error(`[CacheInvalidation] Error in callback ${index + 1}:`, error)
              }
            })
          )
          
          console.log('✅ [CacheInvalidation] Todos os callbacks executados')
        }
      })(),
      
      // 2. Atualizar home screen (em paralelo com os callbacks acima)
      (async () => {
        console.log('  ↳ Atualizando home screen (balances)...')
        await invalidateHomeData()
        console.log('✅ [CacheInvalidation] Home screen atualizado')
      })()
    ])
    
    console.log('🎉 [CacheInvalidation] onExchangeModified concluído')
  }, [invalidateHomeData])

  /**
   * Invalida absolutamente tudo - usado no pull-to-refresh
   * Atualiza TODOS os contextos em paralelo e só retorna quando TUDO terminar
   * 
   * Atualiza:
   * - Balances (BalanceContext)
   * - Exchanges list (via callbacks registrados)
   * - Orders (via OrdersContext que escuta onBalanceLoaded)
   * - Portfolio (via PortfolioContext que escuta balance changes)
   */
  const invalidateAll = useCallback(async () => {
    console.log('🔄 [CacheInvalidation] invalidateAll() iniciado - atualizando TUDO')
    
    try {
      // Executa TODAS as atualizações em paralelo
      await Promise.all([
        // 1. Atualizar balances (inclui daily PnL)
        (async () => {
          console.log('  ↳ Atualizando balances...')
          await refreshOnExchangeChange()
          console.log('  ✅ Balances atualizados')
        })(),
        
        // 2. Atualizar exchanges lists (todos os callbacks registrados)
        (async () => {
          if (exchangesRefreshCallbacksRef.current.size > 0) {
            console.log(`  ↳ Atualizando exchanges (${exchangesRefreshCallbacksRef.current.size} callbacks)...`)
            const callbacks = Array.from(exchangesRefreshCallbacksRef.current)
            await Promise.all(callbacks.map(cb => cb()))
            console.log('  ✅ Exchanges atualizadas')
          }
        })()
        
        // NOTA: Orders e Portfolio são atualizados automaticamente via:
        // - OrdersContext escuta onBalanceLoaded
        // - PortfolioContext escuta mudanças em balanceData
        // Portanto não precisamos chamá-los explicitamente
      ])
      
      console.log('🎉 [CacheInvalidation] invalidateAll() concluído - TUDO atualizado!')
    } catch (error) {
      console.error('❌ [CacheInvalidation] Erro em invalidateAll():', error)
      throw error
    }
  }, [refreshOnExchangeChange])

  return (
    <CacheInvalidationContext.Provider
      value={{
        invalidateAll,
        invalidateHomeData,
        onExchangeModified,
        registerExchangesRefreshCallback,
        unregisterExchangesRefreshCallback,
      }}
    >
      {children}
    </CacheInvalidationContext.Provider>
  )
}

export function useCacheInvalidation() {
  const context = useContext(CacheInvalidationContext)
  if (context === undefined) {
    throw new Error('useCacheInvalidation must be used within a CacheInvalidationProvider')
  }
  return context
}
