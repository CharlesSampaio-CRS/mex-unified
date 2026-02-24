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
  const { user } = useAuth();
  const [ordersByExchange, setOrdersByExchange] = useState<OrdersByExchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);

  const fetchOrders = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return
    
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setError(null);

    try {
      const response = await apiService.getOrdersSecure();
      
      if (!response?.success || !response.orders) {
        setOrdersByExchange([]);
        setTimestamp(Date.now());
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
      
      setOrdersByExchange(results);
      setTimestamp(Date.now());
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch orders';
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
