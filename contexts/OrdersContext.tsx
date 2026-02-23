import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { apiService } from '../services/api'
import { OpenOrder } from '../types/orders'
import { useAuth } from './AuthContext'
import { useNotifications } from './NotificationsContext'
import { useBalance } from './BalanceContext'

interface OrdersByExchange {
  exchangeId: string
  exchangeName: string
  orders: OpenOrder[]
}

interface OrdersContextType {
  ordersByExchange: OrdersByExchange[]
  loading: boolean
  refreshing: boolean
  error: string | null
  totalOrders: number
  timestamp: number | null
  refresh: () => Promise<void>
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined)

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const { refresh: refreshBalance, onBalanceLoaded } = useBalance()
  const [ordersByExchange, setOrdersByExchange] = useState<OrdersByExchange[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timestamp, setTimestamp] = useState<number | null>(null)
  const hasFetchedInitialRef = useRef(false)
  const shouldFetchAfterBalanceRef = useRef(false) // 🆕 Flag para indicar se deve buscar após balance carregar
  
  // 🔔 DETECÇÃO DE ORDENS EXECUTADAS: Armazena IDs das ordens abertas anteriores
  const previousOrdersRef = useRef<Map<string, OpenOrder>>(new Map())

  // 🎯 Detecta ordens que foram executadas (sumiram da lista)
  const detectExecutedOrders = useCallback((currentOrders: OpenOrder[]) => {
    // Cria Map com ordens atuais
    const currentOrdersMap = new Map<string, OpenOrder>()
    currentOrders.forEach(order => {
      currentOrdersMap.set(order.id, order)
    })
    
    // Verifica quais ordens sumiram (foram executadas/canceladas)
    const removedOrders: OpenOrder[] = []
    previousOrdersRef.current.forEach((previousOrder, orderId) => {
      if (!currentOrdersMap.has(orderId)) {
        removedOrders.push(previousOrder)
      }
    })
    
    // 🎯 IMPORTANTE: Não cria notificações aqui pois não sabemos se foi execução ou cancelamento
    // A notificação de execução é criada pelo backend quando a ordem é executada
    // A notificação de cancelamento é criada manualmente quando o usuário cancela
    
    // Atualiza o balance se houver ordens removidas
    if (removedOrders.length > 0) {
      refreshBalance().catch(err => {
        console.error('❌ [OrdersContext] Erro ao atualizar balance:', err)
      })
    }
    
    // Atualiza referência com ordens atuais
    previousOrdersRef.current = currentOrdersMap
  }, [refreshBalance])

  const fetchOrders = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return

    const startTime = performance.now(); // ⚡ Inicia cronômetro
    
    // ✅ ATIVA ESTADOS DE LOADING IMEDIATAMENTE (antes de qualquer await)
    if (forceRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    
    setError(null)

    try {
      // ✅ NOVO: Usa endpoint seguro que busca exchanges do MongoDB
      console.log('📋 [OrdersContext] Buscando orders via endpoint seguro (MongoDB)...')
      
      const apiStartTime = performance.now(); // ⚡ Tempo antes da chamada API
      const response = await apiService.getOrdersSecure()
      const apiEndTime = performance.now(); // ⚡ Tempo depois da chamada API
      
      console.log(`⏱️ [OrdersContext] API levou ${(apiEndTime - apiStartTime).toFixed(0)}ms`)
      
      console.log('📋 [OrdersContext] Response recebida:', {
        success: response?.success,
        ordersCount: response?.orders?.length,
        hasOrders: !!response?.orders
      });
            
      if (!response || !response.success) {
        console.log('⚠️ [OrdersContext] Response não é success');
        setOrdersByExchange([])
        setTimestamp(Date.now())
        return
      }
            
      const exchangesWithOrders = new Map<string, { id: string; name: string; orders: OpenOrder[] }>()
      
      if (response.orders && response.orders.length > 0) {
        response.orders.forEach((order: any) => {
          console.log('📋 [OrdersContext] Order da API:', {
            id: order.id,
            exchange_order_id: order.exchange_order_id,
            symbol: order.symbol
          });
          
          const exchangeId = order.exchange_id || order.exchange || 'unknown'
          const exchangeName = order.exchange_name || order.exchange || exchangeId
          
          if (!exchangesWithOrders.has(exchangeId)) {
            exchangesWithOrders.set(exchangeId, {
              id: exchangeId,
              name: exchangeName,
              orders: []
            })
          }
          
          // ✅ GARANTIR QUE A ORDEM TENHA UM ID
          const orderWithId = {
            ...order,
            id: order.id || order.exchange_order_id || `${order.exchange}_${order.symbol}_${order.timestamp}`
          };
          
          exchangesWithOrders.get(exchangeId)!.orders.push(orderWithId)
        })
      }
      
      const results: OrdersByExchange[] = Array.from(exchangesWithOrders.values()).map(ex => ({
        exchangeId: ex.id,
        exchangeName: ex.name,
        orders: ex.orders,
      }))
      
      console.log('📊 [OrdersContext] Results criados:', results.length);
      console.log('📊 [OrdersContext] Results data:', results);
      
      // 🎯 DETECTA ORDENS EXECUTADAS: Compara com lista anterior
      // Só detecta após a primeira carga (ignora carga inicial)
      if (hasFetchedInitialRef.current && response.orders) {
        detectExecutedOrders(response.orders)
      }
      
      setOrdersByExchange(results)
      console.log('📊 [OrdersContext] setOrdersByExchange chamado com:', results.length, 'exchanges');
      setTimestamp(Date.now())
      
      console.log(`✅ [OrdersContext] Orders carregadas: ${response.orders?.length || 0} total`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch orders'
      console.error('❌ [OrdersContext] Erro ao buscar orders:', errorMsg)
      setError(errorMsg)
      setOrdersByExchange([])
    } finally {
      // ⚡ OTIMIZADO: Reduzido delay de 300ms para 100ms
      await new Promise(resolve => setTimeout(resolve, 100))
      
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id, detectExecutedOrders])

  const refresh = useCallback(async () => {
    await fetchOrders(true)
  }, [fetchOrders])

  // 🆕 Registra callback para carregar orders SEMPRE que balance atualizar
  useEffect(() => {
    if (!user?.id) return
    
    console.log('📝 [OrdersContext] Registrando callback para carregar orders após balance...')
    
    onBalanceLoaded(() => {
      console.log('🔔 [OrdersContext] Balance carregado/atualizado! Carregando orders...')
      // 🔥 SEMPRE carrega orders quando balance atualiza (não só no primeiro)
      const isFirstLoad = !hasFetchedInitialRef.current
      hasFetchedInitialRef.current = true
      
      // Force refresh se não for primeira carga (balance periódico)
      fetchOrders(!isFirstLoad)
    })
  }, [user?.id, onBalanceLoaded, fetchOrders])

  // ❌ REMOVIDO: Carregamento imediato das orders (agora espera o balance carregar)
  // useEffect(() => {
  //   if (user?.id && !hasFetchedInitialRef.current) {
  //     hasFetchedInitialRef.current = true
  //     fetchOrders(false)
  //   }
  // }, [user?.id, fetchOrders])

  // ❌ REMOVIDO: AUTO-REFRESH independente de 3 minutos
  // Agora orders são atualizadas automaticamente quando balance atualiza (via callback)
  // O BalanceContext já tem auto-refresh de 3 minutos, então não precisa duplicar
  // useEffect(() => {
  //   if (!user?.id) return
  //   let interval: ReturnType<typeof setInterval> | null = null
  //   interval = setInterval(() => {
  //     fetchOrders(true)
  //   }, 3 * 60 * 1000)
  //   return () => {
  //     if (interval) clearInterval(interval)
  //   }
  // }, [user?.id, fetchOrders])

  const totalOrders = ordersByExchange.reduce((sum, ex) => sum + ex.orders.length, 0)

  return (
    <OrdersContext.Provider
      value={{
        ordersByExchange,
        loading,
        refreshing,
        error,
        totalOrders,
        timestamp,
        refresh,
      }}
    >
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrdersProvider')
  }
  return context
}
