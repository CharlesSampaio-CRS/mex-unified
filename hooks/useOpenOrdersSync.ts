/**
 * 🔄 Hook de Sincronização Automática de Ordens Abertas
 * 
 * Executa verificação de open orders automaticamente sempre que:
 * - A lista de tokens for atualizada (balance refresh)
 * - Uma nova exchange for adicionada
 * - O usuário forçar refresh manual
 * 
 * Performance:
 * - Usa ordersSyncService (novo fluxo com credentials locais)
 * - Debounce leve (500ms no frontend)
 * - Executa em background sem bloquear UI
 * - Busca todas as exchanges em uma única requisição
 * 
 * Smart Debouncing:
 * - Auto-sync: respeita debounce de 500ms
 * - Manual sync: ignora debounce (força atualização)
 */

import { useEffect, useRef, useCallback } from 'react'
import { useBalance } from '@/contexts/BalanceContext'
import { ordersSyncService } from '@/services/orders-sync'
import { getExchangeId, getExchangeName } from '@/lib/exchange-helpers'

interface UseOpenOrdersSyncOptions {
  userId: string
  enabled?: boolean // Permite desabilitar o sync
  onSyncStart?: () => void
  onSyncComplete?: (results: SyncResult[]) => void
  onSyncError?: (error: Error) => void
}

interface SyncResult {
  exchangeId: string
  exchangeName: string
  ordersCount: number
  success: boolean
  error?: string
  fromCache: boolean
  syncTimeMs: number
  warning?: 'auth' | 'not_supported' | 'network' | 'exchange' // New: graceful degradation flags
}

export function useOpenOrdersSync({
  userId,
  enabled = true,
  onSyncStart,
  onSyncComplete,
  onSyncError
}: UseOpenOrdersSyncOptions) {
  const { data: balanceData } = useBalance()
  const isSyncingRef = useRef(false)
  const lastSyncTimestampRef = useRef<number>(0)
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null) // ✅ Fix: usar ReturnType para compatibilidade Node/Browser
  const lastBalanceHashRef = useRef<string>('') // NEW: Track balance changes
  const isMountedRef = useRef(true) // NEW: Track component mount state
  const SYNC_DEBOUNCE_MS = 500 // Reduzido: Backend já tem cache de 30s, debounce pode ser menor

  const syncOpenOrders = useCallback(async (force = false) => {
    if (!enabled || !balanceData || isSyncingRef.current) {
      return
    }

    // Debounce: evita syncs muito frequentes (exceto se force=true)
    const now = Date.now()
    if (!force && now - lastSyncTimestampRef.current < SYNC_DEBOUNCE_MS) {
      return
    }

    isSyncingRef.current = true
    lastSyncTimestampRef.current = now
    
    const startTime = Date.now()
    onSyncStart?.()

    try {
      const exchanges = balanceData.exchanges || []
      const results: SyncResult[] = []

      // ✅ Novo fluxo: busca todas as ordens de uma vez com ordersSyncService
      const response = await ordersSyncService.fetchOrders(userId)
      
      if (!response) {
        // Se falhar, retorna resultados vazios para todas as exchanges
        exchanges.forEach(exchange => {
          results.push({
            exchangeId: getExchangeId(exchange),
            exchangeName: getExchangeName(exchange),
            ordersCount: 0,
            success: false,
            fromCache: false,
            syncTimeMs: 0,
            error: 'Failed to fetch orders'
          })
        })
        
        onSyncComplete?.(results)
        return
      }

      // Agrupa ordens por exchange
      const ordersByExchange = new Map<string, any[]>()
      response.orders.forEach(order => {
        const exchangeId = order.exchange_id || order.exchange
        if (!ordersByExchange.has(exchangeId)) {
          ordersByExchange.set(exchangeId, [])
        }
        ordersByExchange.get(exchangeId)!.push(order)
      })

      // Cria resultados para cada exchange
      exchanges.forEach(exchange => {
        const exchangeId = getExchangeId(exchange)
        const exchangeName = getExchangeName(exchange)
        const orders = ordersByExchange.get(exchangeId) || []
        
        results.push({
          exchangeId: exchangeId,
          exchangeName: exchangeName,
          ordersCount: orders.length,
          success: true,
          fromCache: false,
          syncTimeMs: 0
        })
      })

      const totalTime = Date.now() - startTime
      const successCount = results.filter(r => r.success).length
      const cachedCount = results.filter(r => r.fromCache).length
      const totalOrders = results.reduce((sum, r) => sum + r.ordersCount, 0)

      // Silencioso: apenas em caso de erro será logado
      // console.log(`✅ [OpenOrdersSync] Completed in ${totalTime}ms:`, {
      //   exchanges: exchanges.length,
      //   success: successCount,
      //   cached: cachedCount,
      //   totalOrders,
      //   avgTimeMs: Math.round(totalTime / exchanges.length)
      // })

      onSyncComplete?.(results)

    } catch (error) {
      const totalTime = Date.now() - startTime
      console.error(`❌ [OpenOrdersSync] Failed after ${totalTime}ms:`, error)
      onSyncError?.(error instanceof Error ? error : new Error(String(error)))
    } finally {
      isSyncingRef.current = false
    }
  }, [userId, balanceData, enabled, onSyncStart, onSyncComplete, onSyncError])

  // Auto-sync quando balanceData mudar
  useEffect(() => {
    if (!enabled || !balanceData) {
      return
    }

    // Cancela timer pendente se existir (evita múltiplas chamadas)
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }

    // Cria hash simples do balance para detectar mudanças reais
    const balanceHash = JSON.stringify(balanceData.exchanges?.map(e => ({
      id: e.exchange_id,
      tokensCount: e.tokens?.length || 0
    })) || [])

    // Se o balance não mudou de verdade, não faz nada
    if (balanceHash === lastBalanceHashRef.current) {
      // Silencioso: console.log('🔄 [OpenOrdersSync] Balance unchanged, skipping auto-sync')
      return
    }

    lastBalanceHashRef.current = balanceHash
    // Silencioso: console.log('🔄 [OpenOrdersSync] Balance changed, scheduling auto-sync in 500ms...')

    // Aguarda 500ms após mudança de balance para iniciar sync
    // Isso permite que a UI renderize primeiro E evita múltiplas chamadas
    pendingTimerRef.current = setTimeout(() => {
      // ✅ Limpa ref e verifica se ainda está montado ANTES de executar
      const timerId = pendingTimerRef.current
      pendingTimerRef.current = null
      
      // ✅ Só executa se componente ainda estiver montado
      if (isMountedRef.current && timerId) {
        syncOpenOrders(false) // Auto-sync respeita debounce
      }
    }, 500)

    return () => {
      // ✅ Cleanup garante que timer seja cancelado
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current)
        pendingTimerRef.current = null
      }
    }
    // IMPORTANTE: NÃO incluir syncOpenOrders nas dependências para evitar loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceData, enabled])

  // ✅ Cleanup global: marca componente como desmontado
  useEffect(() => {
    isMountedRef.current = true
    
    return () => {
      isMountedRef.current = false
      // ✅ Cancela qualquer timer pendente no unmount
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current)
        pendingTimerRef.current = null
      }
    }
  }, [])

  return {
    syncOpenOrders: ((force = true) => syncOpenOrders(force)) as (force?: boolean) => Promise<void>, // Manual sync ignora debounce por padrão
    isSyncing: isSyncingRef.current
  }
}
