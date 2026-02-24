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
  recentlyAddedIds: Set<string>  // IDs de ordens recém-criadas (para animação)
  refresh: () => Promise<void>
  removeOrder: (orderId: string) => void  // Remoção otimista imediata
  addOrder: (order: OpenOrder, exchangeId: string, exchangeName: string) => void // Inserção otimista imediata
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined)

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [ordersByExchange, setOrdersByExchange] = useState<OrdersByExchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [recentlyAddedIds, setRecentlyAddedIds] = useState<Set<string>>(new Set());

  const fetchOrders = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return
    
    console.log('🟣 [ORDERS-CONTEXT] ========================================')
    console.log('🟣 [ORDERS-CONTEXT] Iniciando busca de ordens')
    console.log('🟣 [ORDERS-CONTEXT] ForceRefresh:', forceRefresh)
    console.log('🟣 [ORDERS-CONTEXT] User ID:', user.id)
    
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setError(null);

    try {
      const startTime = Date.now()
      console.log('🟣 [ORDERS-CONTEXT] Chamando getOrdersSecure...')
      
      const response = await apiService.getOrdersSecure();
      
      const apiTime = Date.now() - startTime
      console.log(`🟣 [ORDERS-CONTEXT] Resposta recebida em ${apiTime}ms`)
      console.log('🟣 [ORDERS-CONTEXT] Sucesso:', response?.success)
      console.log('🟣 [ORDERS-CONTEXT] Total de ordens:', response?.orders?.length || 0)
      
      if (!response?.success || !response.orders) {
        console.log('⚠️ [ORDERS-CONTEXT] Nenhuma ordem retornada')
        setOrdersByExchange([]);
        setTimestamp(Date.now());
        console.log('🟣 [ORDERS-CONTEXT] ========================================')
        return;
      }
      
      // Agrupa orders por exchange
      const groupedOrders = new Map<string, { id: string; name: string; orders: OpenOrder[] }>();
      
      response.orders.forEach((order: any) => {
        // ✅ Validação: ignora orders sem dados essenciais
        if (!order || !order.symbol) return;
        
        const exchangeId = order.exchange_id || order.exchange || 'unknown';
        const exchangeName = order.exchange_name || order.exchange || exchangeId;
        
        if (!groupedOrders.has(exchangeId)) {
          groupedOrders.set(exchangeId, {
            id: exchangeId,
            name: exchangeName,
            orders: []
          });
        }
        
        // ✅ Garante ID único
        const orderWithId = {
          ...order,
          id: order.id || order.exchange_order_id || `${exchangeId}_${order.symbol}_${Date.now()}`
        };
        
        groupedOrders.get(exchangeId)!.orders.push(orderWithId);
      });
      
      const results: OrdersByExchange[] = Array.from(groupedOrders.values()).map(ex => ({
        exchangeId: ex.id,
        exchangeName: ex.name,
        orders: ex.orders,
      }));
      
      console.log('🟣 [ORDERS-CONTEXT] Ordens agrupadas por exchange:')
      results.forEach(ex => {
        console.log(`  - ${ex.exchangeName}: ${ex.orders.length} ordens`)
      })
      
      setOrdersByExchange(results);
      setTimestamp(Date.now());
      console.log('✅ [ORDERS-CONTEXT] Ordens atualizadas com sucesso')
      console.log('🟣 [ORDERS-CONTEXT] ========================================')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch orders';
      console.error('❌ [ORDERS-CONTEXT] Erro ao buscar ordens:', errorMsg)
      console.error('❌ [ORDERS-CONTEXT] Stack:', err)
      console.log('🟣 [ORDERS-CONTEXT] ========================================')
      setError(errorMsg);
      setOrdersByExchange([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const refresh = useCallback(async () => {
    await fetchOrders(true);
  }, [fetchOrders]);

  // 🚀 Remoção otimista: Remove uma ordem da lista localmente sem esperar API
  const removeOrder = useCallback((orderId: string) => {
    console.log('🗑️ [ORDERS-CONTEXT] Remoção otimista da ordem:', orderId)
    setOrdersByExchange(prev => {
      const updated = prev.map(exchange => ({
        ...exchange,
        orders: exchange.orders.filter(order => order.id !== orderId)
      })).filter(exchange => exchange.orders.length > 0) // Remove exchanges sem ordens
      
      console.log('🗑️ [ORDERS-CONTEXT] Ordens restantes:', updated.reduce((sum, ex) => sum + ex.orders.length, 0))
      return updated
    })
    setTimestamp(Date.now())
  }, [])

  // 🚀 Inserção otimista: Adiciona uma ordem na lista localmente sem esperar API
  const addOrder = useCallback((order: OpenOrder, exchangeId: string, exchangeName: string) => {
    const orderId = String(order.id || `temp_${Date.now()}`)
    console.log('➕ [ORDERS-CONTEXT] Inserção otimista da ordem:', orderId, order.symbol)
    
    setOrdersByExchange(prev => {
      const existingExchange = prev.find(ex => ex.exchangeId === exchangeId)
      
      if (existingExchange) {
        // Exchange já existe, adiciona a ordem
        return prev.map(ex => 
          ex.exchangeId === exchangeId
            ? { ...ex, orders: [order, ...ex.orders] }
            : ex
        )
      } else {
        // Exchange nova, cria grupo
        return [...prev, {
          exchangeId,
          exchangeName,
          orders: [order]
        }]
      }
    })
    setTimestamp(Date.now())
    
    // ✨ Marca como recém-adicionado (animação piscante por 3s)
    setRecentlyAddedIds(prev => new Set(prev).add(orderId))
    setTimeout(() => {
      setRecentlyAddedIds(prev => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    }, 3000)
  }, [])

  // Carrega orders imediatamente ao logar
  useEffect(() => {
    if (user?.id) {
      fetchOrders(false);
    }
  }, [user?.id, fetchOrders]);

  const totalOrders = ordersByExchange.reduce((sum, ex) => sum + ex.orders.length, 0);

  return (
    <OrdersContext.Provider
      value={{
        ordersByExchange,
        loading,
        refreshing,
        error,
        totalOrders,
        timestamp,
        recentlyAddedIds,
        refresh,
        removeOrder,
        addOrder,
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
