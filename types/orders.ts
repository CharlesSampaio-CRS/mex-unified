// Tipos para ordens de trading

// Helper para pegar o ID da ordem (suporta ambos formatos)
export function getOrderId(order: OpenOrder): string {
  return order.exchange_order_id || order.id || '';
}

export interface OpenOrder {
  id?: string; // Para compatibilidade com alguns endpoints
  exchange_order_id?: string; // Campo retornado pelo backend
  symbol: string;
  type: 'limit' | 'market' | 'stop_loss' | 'stop_loss_limit' | 'take_profit' | 'take_profit_limit';
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  filled: number;
  remaining: number;
  status: 'open' | 'closed' | 'canceled' | 'expired';
  timestamp: number;
  datetime: string;
  cost: number;
  fee?: {
    cost: number;
    currency: string;
  };
  trades?: any[];
  info?: any;
  // Campos adicionais retornados pelo backend
  user_id?: string;
  exchange?: string;
  exchange_id?: string;
  exchange_name?: string;
}

export interface OpenOrdersResponse {
  success: boolean;
  user_id?: string;
  exchange_id: string;
  exchange_name?: string;
  exchange?: string; // Alguns endpoints retornam "exchange" ao invés de "exchange_name"
  orders: OpenOrder[];
  count?: number; // A API retorna "count"
  total_orders?: number; // Ou "total_orders" dependendo do endpoint
  timestamp?: string;
}
