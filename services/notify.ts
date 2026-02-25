/**
 * 🔔 Centralized Notification Helper
 * 
 * Provides pre-built notification methods for all app events.
 * Each method creates a consistent notification with proper
 * category, type, icon, and data.
 * 
 * Categories:
 * - order: Buy/sell/cancel order events
 * - strategy: Create/toggle/delete/execute strategy events
 * - alert: Price alert triggers
 * - system: App-level events (login, sync, errors)
 * 
 * Usage:
 * ```tsx
 * const { addNotification } = useNotifications()
 * 
 * // Instead of building the notification manually:
 * notify.strategyCreated(addNotification, { name: 'BTC - simple', symbol: 'BTC', exchange: 'Binance' })
 * notify.orderCreated(addNotification, { symbol: 'BTC/USDT', side: 'buy', amount: 0.5, price: 50000, type: 'limit', exchange: 'Binance' })
 * notify.alertTriggered(addNotification, { symbol: 'ETH', condition: 'above', targetPrice: 4000, currentPrice: 4050 })
 * ```
 */

type AddNotificationFn = (notification: {
  type: string
  title: string
  message: string
  icon?: string
  data?: Record<string, any>
}) => void

// ==========================================
// 📦 ORDER NOTIFICATIONS
// ==========================================

function orderCreated(
  addNotification: AddNotificationFn,
  params: {
    symbol: string
    side: 'buy' | 'sell'
    amount: number
    price: number
    type: string
    exchange: string
  }
) {
  const { symbol, side, amount, price, type: orderType, exchange } = params
  const isBuy = side === 'buy'
  const tradingSymbol = symbol.split('/')[0]
  const formattedAmount = amount < 1
    ? amount.toFixed(8).replace(/\.?0+$/, '')
    : amount.toFixed(4)
  const formattedPrice = price < 0.01
    ? price.toFixed(10).replace(/\.?0+$/, '')
    : price.toFixed(2)

  addNotification({
    type: 'success',
    title: isBuy ? '✅ Ordem de Compra Criada' : '✅ Ordem de Venda Criada',
    message: `${orderType.toUpperCase()} ${isBuy ? 'compra' : 'venda'} de ${formattedAmount} ${tradingSymbol}${orderType === 'limit' ? ` a $${formattedPrice}` : ' (mercado)'}`,
    icon: isBuy ? '🟢' : '🔴',
    data: {
      category: 'order',
      action: 'order_created',
      symbol,
      side,
      type: orderType,
      amount,
      price,
      exchange,
    },
  })
}

function orderCancelled(
  addNotification: AddNotificationFn,
  params: {
    symbol: string
    side: string
    amount: number
    type?: string
    orderId?: string
    exchange?: string
  }
) {
  const { symbol, side, amount, type: orderType, orderId, exchange } = params
  const isBuy = side === 'buy'
  const tradingSymbol = (symbol || '').split('/')[0]
  const formattedAmount = amount < 1
    ? amount.toFixed(8).replace(/\.?0+$/, '')
    : amount.toFixed(4)

  addNotification({
    type: 'warning',
    title: '🗑️ Ordem Cancelada',
    message: `${(orderType || 'LIMIT').toUpperCase()} ${isBuy ? 'compra' : 'venda'} de ${formattedAmount} ${tradingSymbol} cancelada`,
    icon: '🗑️',
    data: {
      category: 'order',
      action: 'order_cancelled',
      symbol,
      side,
      orderId,
      exchange,
    },
  })
}

function orderFilled(
  addNotification: AddNotificationFn,
  params: {
    symbol: string
    side: string
    amount: number
    price?: number
    exchange?: string
  }
) {
  const { symbol, side, amount, price, exchange } = params
  const isBuy = side === 'buy'
  const tradingSymbol = (symbol || '').split('/')[0]
  const formattedAmount = amount < 1
    ? amount.toFixed(8).replace(/\.?0+$/, '')
    : amount.toFixed(4)

  addNotification({
    type: 'success',
    title: isBuy ? '💰 Compra Executada' : '💰 Venda Executada',
    message: `${formattedAmount} ${tradingSymbol} ${isBuy ? 'comprado' : 'vendido'}${price ? ` a $${price.toFixed(2)}` : ''}`,
    icon: isBuy ? '📈' : '📉',
    data: {
      category: 'order',
      action: 'order_filled',
      symbol,
      side,
      amount,
      price,
      exchange,
    },
  })
}

function orderError(
  addNotification: AddNotificationFn,
  params: {
    symbol: string
    action: string
    error: string
    orderId?: string
  }
) {
  const tradingSymbol = (params.symbol || '').split('/')[0]

  addNotification({
    type: 'error',
    title: `❌ Erro - ${params.action}`,
    message: `Falha na ordem de ${tradingSymbol}: ${params.error}`,
    icon: '⚠️',
    data: {
      category: 'order',
      action: 'order_error',
      symbol: params.symbol,
      orderId: params.orderId,
      error: params.error,
    },
  })
}

// ==========================================
// 🤖 STRATEGY NOTIFICATIONS
// ==========================================

function strategyCreated(
  addNotification: AddNotificationFn,
  params: {
    name: string
    symbol: string
    exchange: string
    template?: string
    strategyId?: string
  }
) {
  addNotification({
    type: 'success',
    title: '🤖 Estratégia Criada',
    message: `${params.symbol}/USDT na ${params.exchange} (${params.template || 'custom'})`,
    icon: '🤖',
    data: {
      category: 'strategy',
      action: 'strategy_created',
      name: params.name,
      symbol: params.symbol,
      exchange: params.exchange,
      template: params.template,
      strategyId: params.strategyId,
    },
  })
}

function strategyActivated(
  addNotification: AddNotificationFn,
  params: { name: string; strategyId?: string }
) {
  addNotification({
    type: 'success',
    title: '▶️ Estratégia Ativada',
    message: `${params.name} está ativa e monitorando`,
    icon: '▶️',
    data: {
      category: 'strategy',
      action: 'strategy_activated',
      name: params.name,
      strategyId: params.strategyId,
    },
  })
}

function strategyPaused(
  addNotification: AddNotificationFn,
  params: { name: string; strategyId?: string }
) {
  addNotification({
    type: 'warning',
    title: '⏸️ Estratégia Pausada',
    message: `${params.name} foi desativada`,
    icon: '⏸️',
    data: {
      category: 'strategy',
      action: 'strategy_paused',
      name: params.name,
      strategyId: params.strategyId,
    },
  })
}

function strategyDeleted(
  addNotification: AddNotificationFn,
  params: { name: string; strategyId?: string }
) {
  addNotification({
    type: 'warning',
    title: '🗑️ Estratégia Removida',
    message: `${params.name} foi excluída`,
    icon: '🗑️',
    data: {
      category: 'strategy',
      action: 'strategy_deleted',
      name: params.name,
      strategyId: params.strategyId,
    },
  })
}

function strategyExecuted(
  addNotification: AddNotificationFn,
  params: {
    name: string
    symbol: string
    side: 'buy' | 'sell'
    amount?: number
    price?: number
    strategyId?: string
  }
) {
  const isBuy = params.side === 'buy'
  addNotification({
    type: 'info',
    title: isBuy ? '🤖📈 Execução: Compra' : '🤖📉 Execução: Venda',
    message: `${params.name} executou ${isBuy ? 'compra' : 'venda'} de ${params.symbol}${params.price ? ` a $${params.price.toFixed(2)}` : ''}`,
    icon: isBuy ? '📈' : '📉',
    data: {
      category: 'strategy',
      action: 'strategy_executed',
      name: params.name,
      symbol: params.symbol,
      side: params.side,
      amount: params.amount,
      price: params.price,
      strategyId: params.strategyId,
    },
  })
}

function strategyError(
  addNotification: AddNotificationFn,
  params: {
    name: string
    action: string
    error: string
    strategyId?: string
  }
) {
  addNotification({
    type: 'error',
    title: `❌ Erro na Estratégia`,
    message: `${params.name}: ${params.error}`,
    icon: '⚠️',
    data: {
      category: 'strategy',
      action: 'strategy_error',
      name: params.name,
      error: params.error,
      strategyId: params.strategyId,
    },
  })
}

// ==========================================
// 🔔 ALERT NOTIFICATIONS
// ==========================================

function alertTriggered(
  addNotification: AddNotificationFn,
  params: {
    symbol: string
    condition: 'above' | 'below'
    targetPrice: number
    currentPrice: number
  }
) {
  const isAbove = params.condition === 'above'
  addNotification({
    type: isAbove ? 'success' : 'warning',
    title: isAbove ? `🚀 ${params.symbol} Atingiu Alvo` : `📉 ${params.symbol} Caiu ao Alvo`,
    message: `${params.symbol} ${isAbove ? 'subiu acima' : 'caiu abaixo'} de $${params.targetPrice.toFixed(2)} — Preço atual: $${params.currentPrice.toFixed(2)}`,
    icon: isAbove ? '🚀' : '📉',
    data: {
      category: 'alert',
      action: 'alert_triggered',
      symbol: params.symbol,
      condition: params.condition,
      targetPrice: params.targetPrice,
      currentPrice: params.currentPrice,
    },
  })
}

function alertCreated(
  addNotification: AddNotificationFn,
  params: {
    symbol: string
    condition: 'above' | 'below'
    targetPrice: number
  }
) {
  const isAbove = params.condition === 'above'
  addNotification({
    type: 'info',
    title: '🔔 Alerta Criado',
    message: `${params.symbol} — Notificar quando ${isAbove ? 'acima' : 'abaixo'} de $${params.targetPrice.toFixed(2)}`,
    icon: '🔔',
    data: {
      category: 'alert',
      action: 'alert_created',
      symbol: params.symbol,
      condition: params.condition,
      targetPrice: params.targetPrice,
    },
  })
}

function alertDeleted(
  addNotification: AddNotificationFn,
  params: { symbol: string }
) {
  addNotification({
    type: 'warning',
    title: '🔕 Alerta Removido',
    message: `Alerta de ${params.symbol} foi excluído`,
    icon: '🔕',
    data: {
      category: 'alert',
      action: 'alert_deleted',
      symbol: params.symbol,
    },
  })
}

// ==========================================
// 🔄 TOKEN MONITOR NOTIFICATIONS
// ==========================================

function tokenDrop(
  addNotification: AddNotificationFn,
  params: { symbol: string; variation: number; price: string }
) {
  addNotification({
    type: 'warning',
    title: `📉 ${params.symbol} em Queda`,
    message: `${params.symbol} caiu ${Math.abs(params.variation).toFixed(2)}% nas últimas 24h. Preço: $${params.price}`,
    icon: '📉',
    data: { category: 'alert', action: 'token_drop', symbol: params.symbol, variation: params.variation },
  })
}

function tokenRise(
  addNotification: AddNotificationFn,
  params: { symbol: string; variation: number; price: string }
) {
  addNotification({
    type: 'success',
    title: `🚀 ${params.symbol} em Alta`,
    message: `${params.symbol} subiu ${params.variation.toFixed(2)}% nas últimas 24h! Preço: $${params.price}`,
    icon: '📈',
    data: { category: 'alert', action: 'token_rise', symbol: params.symbol, variation: params.variation },
  })
}

function tokenSuddenChange(
  addNotification: AddNotificationFn,
  params: { symbol: string; variation: number; price: string; direction: 'up' | 'down' }
) {
  const dir = params.direction === 'up' ? 'subiu' : 'caiu'
  addNotification({
    type: 'info',
    title: `⚡ ${params.symbol} - Mudança Rápida`,
    message: `${params.symbol} ${dir} rapidamente. Variação: ${params.variation > 0 ? '+' : ''}${params.variation.toFixed(2)}%. Preço: $${params.price}`,
    icon: '⚡',
    data: { category: 'alert', action: 'token_sudden_change', symbol: params.symbol, variation: params.variation },
  })
}

// ==========================================
// ⚙️ SYSTEM NOTIFICATIONS
// ==========================================

function systemError(
  addNotification: AddNotificationFn,
  params: { title: string; message: string }
) {
  addNotification({
    type: 'error',
    title: `⚠️ ${params.title}`,
    message: params.message,
    icon: '⚠️',
    data: { category: 'system', action: 'system_error' },
  })
}

// ==========================================
// 🏷️ CATEGORY HELPERS
// ==========================================

/** Extract category from notification data */
export function getNotificationCategory(data?: Record<string, any>): string {
  return data?.category || 'system'
}

/** Get category icon */
export function getCategoryIcon(category: string): string {
  switch (category) {
    case 'order': return '📊'
    case 'strategy': return '🤖'
    case 'alert': return '🔔'
    case 'system': return '⚙️'
    default: return '🔔'
  }
}

/** Get category label */
export function getCategoryLabel(category: string): string {
  switch (category) {
    case 'order': return 'Ordens'
    case 'strategy': return 'Estratégias'
    case 'alert': return 'Alertas'
    case 'system': return 'Sistema'
    default: return 'Outros'
  }
}

/** All available categories */
export const NOTIFICATION_CATEGORIES = ['all', 'order', 'strategy', 'alert', 'system'] as const
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number]

// ==========================================
// 📦 EXPORT
// ==========================================

export const notify = {
  // Orders
  orderCreated,
  orderCancelled,
  orderFilled,
  orderError,

  // Strategies
  strategyCreated,
  strategyActivated,
  strategyPaused,
  strategyDeleted,
  strategyExecuted,
  strategyError,

  // Alerts
  alertTriggered,
  alertCreated,
  alertDeleted,

  // Token Monitor
  tokenDrop,
  tokenRise,
  tokenSuddenChange,

  // System
  systemError,
}

export default notify
