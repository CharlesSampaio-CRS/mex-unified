import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { apiService } from '../services/api'
import { OpenOrder } from '../types/orders'
import { useAuth } from './AuthContext'
import { useNotifications } from './NotificationsContext'
import { useBalance } from './BalanceContext'
import { capitalizeExchangeName } from '../lib/exchange-helpers'

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
  recentlyAffectedSymbols: Set<string> // Símbolos de tokens afetados por create/cancel (para animação no Assets)
  refresh: () => Promise<void>
  refreshExchange: (exchangeId: string) => Promise<void>  // ⚡ Refresh de UMA exchange
  removeOrder: (orderId: string, symbol?: string) => void  // Remoção otimista imediata
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
  const [recentlyAffectedSymbols, setRecentlyAffectedSymbols] = useState<Set<string>>(new Set());
  // 🛡️ IDs de ordens recentemente canceladas — o refresh ignora essas ordens por 15s
  const recentlyCancelledRef = useRef<Map<string, number>>(new Map());

  // Helper: Filtra ordens canceladas do resultado
  const filterCancelledOrders = useCallback((results: OrdersByExchange[]): OrdersByExchange[] => {
    const now = Date.now();
    const CANCEL_GRACE_PERIOD = 15000; // 15s de proteção
    // Limpa entradas expiradas
    for (const [id, ts] of recentlyCancelledRef.current) {
      if (now - ts > CANCEL_GRACE_PERIOD) recentlyCancelledRef.current.delete(id);
    }
    
    if (recentlyCancelledRef.current.size === 0) return results;

    return results.map(ex => ({
      ...ex,
      orders: ex.orders.filter(order => {
        const oid = String(order.id || '');
        const eoid = String(order.exchange_order_id || '');
        const isCancelled = recentlyCancelledRef.current.has(oid) || recentlyCancelledRef.current.has(eoid);
        if (isCancelled) console.log('�️ [ORDERS-CONTEXT] Filtrando ordem cancelada do refresh:', oid);
        return !isCancelled;
      })
    })).filter(ex => ex.orders.length > 0);
  }, []);

  // Helper: Agrupa orders de uma response em OrdersByExchange[]
  const groupOrdersFromResponse = useCallback((orders: any[]): OrdersByExchange[] => {
    const groupedOrders = new Map<string, { id: string; name: string; orders: OpenOrder[] }>();
    
    orders.forEach((order: any) => {
      if (!order || !order.symbol) return;
      
      const exchangeId = order.exchange_id || order.exchange || 'unknown';
      const exchangeName = capitalizeExchangeName(order.exchange_name || order.exchange || exchangeId);
      
      if (!groupedOrders.has(exchangeId)) {
        groupedOrders.set(exchangeId, { id: exchangeId, name: exchangeName, orders: [] });
      }
      
      const orderWithId = {
        ...order,
        id: order.id || order.exchange_order_id || `${exchangeId}_${order.symbol}_${Date.now()}`,
        exchange_order_id: order.exchange_order_id || order.id || undefined,
      };
      
      groupedOrders.get(exchangeId)!.orders.push(orderWithId);
    });
    
    return Array.from(groupedOrders.values()).map(ex => ({
      exchangeId: ex.id,
      exchangeName: ex.name,
      orders: ex.orders,
    }));
  }, []);

  const fetchOrders = useCallback(async (forceRefresh = false, silent = false) => {
    if (!user?.id) return
    
    console.log('🟣 [ORDERS-CONTEXT] ========================================')
    console.log('🟣 [ORDERS-CONTEXT] Iniciando busca de ordens')
    console.log('🟣 [ORDERS-CONTEXT] ForceRefresh:', forceRefresh, 'Silent:', silent)
    
    if (!silent) {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
    }
    
    setError(null);

    try {
      const startTime = Date.now()
      
      const response = await apiService.getOrdersSecure();
      
      const apiTime = Date.now() - startTime
      console.log(`🟣 [ORDERS-CONTEXT] Resposta recebida em ${apiTime}ms — ${response?.orders?.length || 0} ordens`)
      
      if (!response?.success || !response.orders) {
        setOrdersByExchange([]);
        setTimestamp(Date.now());
        return;
      }
      
      const results = groupOrdersFromResponse(response.orders);
      const filteredResults = filterCancelledOrders(results);
      
      filteredResults.forEach(ex => {
        console.log(`  📦 ${ex.exchangeName}: ${ex.orders.length} ordens`)
      })
      
      setOrdersByExchange(filteredResults);
      setTimestamp(Date.now());
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch orders';
      console.error('❌ [ORDERS-CONTEXT] Erro ao buscar ordens:', errorMsg)
      setError(errorMsg);
      setOrdersByExchange([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, groupOrdersFromResponse, filterCancelledOrders]);

  // ⚡ Refresh rápido de UMA exchange específica — atualiza apenas os dados dessa exchange
  // Ideal para chamar após create/cancel de order sem recarregar tudo
  const refreshExchange = useCallback(async (exchangeId: string) => {
    if (!user?.id) return
    
    console.log(`⚡ [ORDERS-CONTEXT] Refresh rápido da exchange ${exchangeId}`)
    const startTime = Date.now()
    
    try {
      const response = await apiService.getOrdersByExchange(exchangeId);
      
      const apiTime = Date.now() - startTime
      console.log(`⚡ [ORDERS-CONTEXT] Exchange ${exchangeId} respondeu em ${apiTime}ms — ${response?.orders?.length || 0} ordens`)
      
      if (!response?.success) return;
      
      const newOrders = groupOrdersFromResponse(response.orders || []);
      const filteredNew = filterCancelledOrders(newOrders);
      
      // Merge: substitui orders dessa exchange, mantém as outras
      setOrdersByExchange(prev => {
        const otherExchanges = prev.filter(ex => ex.exchangeId !== exchangeId);
        return [...otherExchanges, ...filteredNew].sort((a, b) => a.exchangeName.localeCompare(b.exchangeName));
      });
      setTimestamp(Date.now());
    } catch (err) {
      console.error(`❌ [ORDERS-CONTEXT] Erro no refresh da exchange ${exchangeId}:`, err)
      // Não seta error global — falha de 1 exchange não deve bloquear o contexto
    }
  }, [user?.id, groupOrdersFromResponse, filterCancelledOrders]);

  const refresh = useCallback(async () => {
    await fetchOrders(true);
  }, [fetchOrders]);

  // Helper: Marca um símbolo como recém-afetado (animação piscante no Assets por 4s)
  const markSymbolAffected = useCallback((symbol: string) => {
    // Extrai o token base do par (ex: "BTC/USDT" → "BTC")
    const baseToken = symbol.split('/')[0]?.toUpperCase() || symbol.toUpperCase()
    console.log('✨ [ORDERS-CONTEXT] Marcando token como afetado:', baseToken)
    setRecentlyAffectedSymbols(prev => new Set(prev).add(baseToken))
    setTimeout(() => {
      setRecentlyAffectedSymbols(prev => {
        const next = new Set(prev)
        next.delete(baseToken)
        return next
      })
    }, 4000)
  }, [])

  // 🚀 Remoção otimista: Remove uma ordem da lista localmente sem esperar API
  const removeOrder = useCallback((orderId: string, symbol?: string) => {
    console.log('🗑️ [ORDERS-CONTEXT] Remoção otimista da ordem:', orderId)
    
    // 🛡️ Registra o orderId no grace period para evitar reaparecimento fantasma
    const now = Date.now()
    recentlyCancelledRef.current.set(orderId, now)
    
    // Encontra o símbolo e exchange_order_id da ordem antes de remover
    for (const exchange of ordersByExchange) {
      const order = exchange.orders.find(o => o.id === orderId)
      if (order) {
        if (!symbol) symbol = order.symbol
        // Registra também o exchange_order_id (pode ser diferente do id)
        if (order.exchange_order_id && order.exchange_order_id !== orderId) {
          recentlyCancelledRef.current.set(order.exchange_order_id, now)
        }
        break
      }
    }
    
    console.log('🛡️ [ORDERS-CONTEXT] IDs protegidos contra reaparecimento:', [...recentlyCancelledRef.current.keys()])
    
    setOrdersByExchange(prev => {
      const updated = prev.map(exchange => ({
        ...exchange,
        orders: exchange.orders.filter(order => order.id !== orderId)
      })).filter(exchange => exchange.orders.length > 0)
      
      console.log('🗑️ [ORDERS-CONTEXT] Ordens restantes:', updated.reduce((sum, ex) => sum + ex.orders.length, 0))
      return updated
    })
    setTimestamp(Date.now())
    
    // ✨ Marca o token como afetado para animação na lista de Assets
    if (symbol) {
      markSymbolAffected(symbol)
    }
  }, [ordersByExchange, markSymbolAffected])

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
    
    // ✨ Marca o token como afetado para animação na lista de Assets
    if (order.symbol) {
      markSymbolAffected(order.symbol)
    }
  }, [markSymbolAffected])

  // Carrega orders imediatamente ao logar
  useEffect(() => {
    if (user?.id) {
      fetchOrders(false);
    }
  }, [user?.id, fetchOrders]);

  // ⏰ Auto-refresh a cada 30s (silencioso, sem loading visual)
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      console.log('⏰ [ORDERS-CONTEXT] Auto-refresh (30s)');
      fetchOrders(true, true);
    }, 30 * 1000);

    return () => clearInterval(interval);
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
        recentlyAffectedSymbols,
        refresh,
        refreshExchange,
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
