import { Q } from '@nozbe/watermelondb'
import database from './database'
import { 
  UserExchange,
  BalanceSnapshot,
  BalanceHistory,
  Order,
  Position,
  Strategy,
  Notification
} from './models'

/**
 * Database Helper
 * Funções utilitárias para acessar o WatermelonDB
 */

// ==================== DATABASE INITIALIZATION ====================

/**
 * Garante que a collection existe e está acessível
 * Se não existir, será criada automaticamente pelo WatermelonDB
 */
async function ensureCollectionExists(collectionName: string) {
  try {
    const collection = database.get(collectionName)
    
    // Tenta fazer uma query vazia para verificar se a collection está OK
    await collection.query().fetchCount()

    return collection
  } catch (error) {
    console.error(`❌ [WatermelonDB] Erro ao acessar collection '${collectionName}':`, error)
    throw new Error(`Collection '${collectionName}' não está acessível. Tente recarregar a página.`)
  }
}

// ==================== USER EXCHANGES ====================

export const getUserExchanges = async (userId: string) => {
  await ensureCollectionExists('user_exchanges')
  const collection = database.get<UserExchange>('user_exchanges')
  return await collection.query(
    Q.where('user_id', userId),
    Q.where('is_active', true)
  ).fetch()
}

export const saveUserExchange = async (data: {
  userId: string
  exchangeType: string // CCXT ID: binance, bybit, mexc, etc (lowercase)
  exchangeName: string // Nome customizado pelo usuário
  apiKeyEncrypted: string
  apiSecretEncrypted: string
  apiPassphraseEncrypted?: string
  isActive: boolean
}) => {
  await ensureCollectionExists('user_exchanges')
  const collection = database.get<UserExchange>('user_exchanges')
  
  return await database.write(async () => {
    return await collection.create(exchange => {
      exchange.userId = data.userId
      exchange.exchangeType = data.exchangeType // CCXT ID (lowercase)
      exchange.exchangeName = data.exchangeName // Nome customizado
      exchange.apiKeyEncrypted = data.apiKeyEncrypted
      exchange.apiSecretEncrypted = data.apiSecretEncrypted
      if (data.apiPassphraseEncrypted) {
        exchange.apiPassphraseEncrypted = data.apiPassphraseEncrypted
      }
      exchange.isActive = data.isActive
    })
  })
}

export const updateUserExchange = async (id: string, data: Partial<{
  isActive: boolean
  lastSyncAt: Date
}>) => {
  await ensureCollectionExists('user_exchanges')
  const collection = database.get<UserExchange>('user_exchanges')
  const exchange = await collection.find(id)
  
  return await database.write(async () => {
    return await exchange.update(record => {
      if (data.isActive !== undefined) record.isActive = data.isActive
      if (data.lastSyncAt) record.lastSyncAt = data.lastSyncAt
    })
  })
}

export const deleteUserExchange = async (id: string) => {
  console.log('🗑️ [deleteUserExchange] Iniciando delete...', { id })
  
  try {
    await ensureCollectionExists('user_exchanges')
    const collection = database.get<UserExchange>('user_exchanges')
    console.log('📦 [deleteUserExchange] Collection obtida e verificada')
    
    const exchange = await collection.find(id)
    console.log('🔍 [deleteUserExchange] Exchange encontrada:', {
      id: exchange.id,
      name: exchange.exchangeName
    })
    
    const result = await database.write(async () => {
      await exchange.destroyPermanently()
    })
    
    console.log('✅ [deleteUserExchange] Exchange deletada permanentemente!')
    return result
  } catch (error) {
    console.error('❌ [deleteUserExchange] Erro ao deletar:', error)
    throw error
  }
}

// ==================== BALANCE SNAPSHOTS ====================

export const getBalanceSnapshots = async (userId: string, limit = 30) => {
  const collection = database.get<BalanceSnapshot>('balance_snapshots')
  return await collection.query(
    Q.where('user_id', userId),
    Q.sortBy('timestamp', Q.desc),
    Q.take(limit)
  ).fetch()
}

export const saveBalanceSnapshot = async (data: {
  userId: string
  totalUsd: number
  totalBrl: number
  timestamp: Date | number
}) => {
  const collection = database.get<BalanceSnapshot>('balance_snapshots')
  
  return await database.write(async () => {
    return await collection.create(snapshot => {
      snapshot.userId = data.userId
      snapshot.totalUsd = data.totalUsd
      snapshot.totalBrl = data.totalBrl
      snapshot.timestamp = typeof data.timestamp === 'number' ? data.timestamp : data.timestamp.getTime()
    })
  })
}

// ==================== BALANCE HISTORY ====================

export const getBalanceHistory = async (userId: string, exchangeName?: string) => {
  const collection = database.get<BalanceHistory>('balance_history')
  
  const queries = [Q.where('user_id', userId)]
  if (exchangeName) {
    queries.push(Q.where('exchange_name', exchangeName))
  }
  
  return await collection.query(...queries, Q.sortBy('timestamp', Q.desc)).fetch()
}

export const saveBalanceHistory = async (data: {
  userId: string
  exchangeName: string
  symbol: string
  free: number
  used: number
  total: number
  usdValue: number
  brlValue: number
  timestamp: Date | number
}) => {
  const collection = database.get<BalanceHistory>('balance_history')
  
  return await database.write(async () => {
    return await collection.create(history => {
      history.userId = data.userId
      history.exchangeName = data.exchangeName
      history.symbol = data.symbol
      history.free = data.free
      history.used = data.used
      history.total = data.total
      history.usdValue = data.usdValue
      history.brlValue = data.brlValue
      history.timestamp = typeof data.timestamp === 'number' ? data.timestamp : data.timestamp.getTime()
    })
  })
}

// ==================== ORDERS ====================

export const getOrders = async (userId: string, status?: string) => {
  const collection = database.get<Order>('orders')
  
  const queries = [Q.where('user_id', userId)]
  if (status) {
    queries.push(Q.where('status', status))
  }
  
  return await collection.query(...queries, Q.sortBy('timestamp', Q.desc)).fetch()
}

export const saveOrder = async (data: {
  userId: string
  exchangeName: string
  orderId: string
  symbol: string
  type: string
  side: string
  price: number
  amount: number
  filled: number
  remaining: number
  status: string
  timestamp: Date
}) => {
  const collection = database.get<Order>('orders')
  
  // Check if order already exists
  const existing = await collection.query(
    Q.where('user_id', data.userId),
    Q.where('order_id', data.orderId)
  ).fetch()
  
  if (existing.length > 0) {
    // Update existing order
    return await database.write(async () => {
      return await existing[0].update(order => {
        order.filled = data.filled
        order.remaining = data.remaining
        order.status = data.status
      })
    })
  }
  
  // Create new order
  return await database.write(async () => {
    return await collection.create(order => {
      order.userId = data.userId
      order.exchangeName = data.exchangeName
      order.orderId = data.orderId
      order.symbol = data.symbol
      order.type = data.type
      order.side = data.side
      order.price = data.price
      order.amount = data.amount
      order.filled = data.filled
      order.remaining = data.remaining
      order.status = data.status
      order.timestamp = data.timestamp
    })
  })
}

// ==================== POSITIONS ====================

export const getPositions = async (userId: string) => {
  const collection = database.get<Position>('positions')
  return await collection.query(
    Q.where('user_id', userId),
    Q.sortBy('timestamp', Q.desc)
  ).fetch()
}

export const savePosition = async (data: {
  userId: string
  exchangeName: string
  symbol: string
  side: string
  contracts: number
  entryPrice: number
  markPrice: number
  liquidationPrice?: number
  unrealizedPnl: number
  leverage: number
  timestamp: Date
}) => {
  const collection = database.get<Position>('positions')
  
  // Check if position already exists
  const existing = await collection.query(
    Q.where('user_id', data.userId),
    Q.where('exchange_name', data.exchangeName),
    Q.where('symbol', data.symbol)
  ).fetch()
  
  if (existing.length > 0) {
    // Update existing position
    return await database.write(async () => {
      return await existing[0].update(position => {
        position.contracts = data.contracts
        position.markPrice = data.markPrice
        if (data.liquidationPrice) position.liquidationPrice = data.liquidationPrice
        position.unrealizedPnl = data.unrealizedPnl
        position.timestamp = data.timestamp
      })
    })
  }
  
  // Create new position
  return await database.write(async () => {
    return await collection.create(position => {
      position.userId = data.userId
      position.exchangeName = data.exchangeName
      position.symbol = data.symbol
      position.side = data.side
      position.contracts = data.contracts
      position.entryPrice = data.entryPrice
      position.markPrice = data.markPrice
      if (data.liquidationPrice) position.liquidationPrice = data.liquidationPrice
      position.unrealizedPnl = data.unrealizedPnl
      position.leverage = data.leverage
      position.timestamp = data.timestamp
    })
  })
}

// ==================== STRATEGIES ====================

export const getStrategies = async (userId: string, isActive?: boolean) => {
  const collection = database.get<Strategy>('strategies')
  
  const queries = [Q.where('user_id', userId)]
  if (isActive !== undefined) {
    queries.push(Q.where('is_active', isActive))
  }
  
  return await collection.query(...queries).fetch()
}

export const saveStrategy = async (data: {
  userId: string
  name: string
  description?: string
  exchangeName: string
  symbol: string
  type: string
  config: string
  isActive: boolean
}) => {
  const collection = database.get<Strategy>('strategies')
  
  return await database.write(async () => {
    return await collection.create(strategy => {
      strategy.userId = data.userId
      strategy.name = data.name
      if (data.description) strategy.description = data.description
      strategy.exchangeName = data.exchangeName
      strategy.symbol = data.symbol
      strategy.type = data.type
      strategy.config = data.config
      strategy.isActive = data.isActive
      strategy.profitLoss = 0
      strategy.tradesCount = 0
    })
  })
}

export const updateStrategy = async (id: string, data: Partial<{
  isActive: boolean
  profitLoss: number
  tradesCount: number
}>) => {
  const collection = database.get<Strategy>('strategies')
  const strategy = await collection.find(id)
  
  return await database.write(async () => {
    return await strategy.update(record => {
      if (data.isActive !== undefined) record.isActive = data.isActive
      if (data.profitLoss !== undefined) record.profitLoss = data.profitLoss
      if (data.tradesCount !== undefined) record.tradesCount = data.tradesCount
    })
  })
}

// ==================== NOTIFICATIONS ====================

export const getNotifications = async (userId: string, unreadOnly = false) => {
  const collection = database.get<Notification>('notifications')
  
  const queries = [Q.where('user_id', userId)]
  if (unreadOnly) {
    queries.push(Q.where('is_read', false))
  }
  
  return await collection.query(...queries, Q.sortBy('created_at', Q.desc)).fetch()
}

export const saveNotification = async (data: {
  userId: string
  title: string
  message: string
  type: string
  category?: string
  data?: string
}) => {
  const collection = database.get<Notification>('notifications')
  
  return await database.write(async () => {
    return await collection.create(notification => {
      notification.userId = data.userId
      notification.title = data.title
      notification.message = data.message
      notification.type = data.type
      if (data.category) notification.category = data.category
      if (data.data) notification.data = data.data
      notification.isRead = false
    })
  })
}

export const markNotificationAsRead = async (id: string) => {
  const collection = database.get<Notification>('notifications')
  const notification = await collection.find(id)
  
  return await database.write(async () => {
    return await notification.update(record => {
      record.isRead = true
    })
  })
}

export const markAllNotificationsAsRead = async (userId: string) => {
  const collection = database.get<Notification>('notifications')
  const notifications = await collection.query(
    Q.where('user_id', userId),
    Q.where('is_read', false)
  ).fetch()
  
  return await database.write(async () => {
    await Promise.all(
      notifications.map(notification => 
        notification.update(record => {
          record.isRead = true
        })
      )
    )
  })
}

// ==================== UTILITY ====================

export const clearAllData = async () => {
  return await database.write(async () => {
    await database.unsafeResetDatabase()
  })
}

export const getDatabaseSize = async () => {
  // This would require native module to get actual file size
  // For now, return count of records
  const counts = {
    userExchanges: await database.get<UserExchange>('user_exchanges').query().fetchCount(),
    balanceSnapshots: await database.get<BalanceSnapshot>('balance_snapshots').query().fetchCount(),
    balanceHistory: await database.get<BalanceHistory>('balance_history').query().fetchCount(),
    orders: await database.get<Order>('orders').query().fetchCount(),
    positions: await database.get<Position>('positions').query().fetchCount(),
    strategies: await database.get<Strategy>('strategies').query().fetchCount(),
    notifications: await database.get<Notification>('notifications').query().fetchCount(),
  }
  
  return counts
}
