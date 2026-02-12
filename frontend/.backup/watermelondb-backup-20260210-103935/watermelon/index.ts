/**
 * WatermelonDB - Main Export
 * 
 * Import tudo que você precisa de um único lugar
 */

// Database instance
export { database, default } from './database'

// Schema
export { schema } from './schema'

// Models
export {
  UserExchange,
  BalanceSnapshot,
  BalanceHistory,
  Order,
  Position,
  Strategy,
  Notification,
} from './models'

// Helpers (CRUD operations)
export {
  // User Exchanges
  getUserExchanges,
  saveUserExchange,
  updateUserExchange,
  deleteUserExchange,
  
  // Balance Snapshots
  getBalanceSnapshots,
  saveBalanceSnapshot,
  
  // Balance History
  getBalanceHistory,
  saveBalanceHistory,
  
  // Orders
  getOrders,
  saveOrder,
  
  // Positions
  getPositions,
  savePosition,
  
  // Strategies
  getStrategies,
  saveStrategy,
  updateStrategy,
  
  // Notifications
  getNotifications,
  saveNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  
  // Utility
  clearAllData,
  getDatabaseSize,
} from './helpers'

/**
 * Quick Start Example:
 * 
 * import { getUserExchanges, saveBalanceHistory } from './lib/watermelon'
 * 
 * // Fetch user exchanges
 * const exchanges = await getUserExchanges(userId)
 * 
 * // Save balance
 * await saveBalanceHistory({
 *   userId,
 *   exchangeName: 'binance',
 *   symbol: 'BTC',
 *   free: 1.5,
 *   used: 0.5,
 *   total: 2.0,
 *   usdValue: 100000,
 *   brlValue: 500000,
 *   timestamp: new Date()
 * })
 */
