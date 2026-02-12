import { appSchema, tableSchema } from '@nozbe/watermelondb'

/**
 * WatermelonDB Schema
 * 
 * DADOS LOCAIS (salvos no WatermelonDB):
 * - user_exchanges: Exchanges configuradas pelo usuário
 * - strategies: Estratégias de trading
 * - notifications: Notificações do usuário
 * - balance_snapshots: Snapshots de balanço ao longo do tempo
 * - balance_history: Histórico detalhado de balanços
 * - orders: Ordens de trading
 * - positions: Posições abertas
 * 
 * DADOS DA API (consultados do backend):
 * - users: Dados do usuário
 * - exchanges: Lista de exchanges disponíveis
 * - tokens_catalog: Catálogo de tokens/moedas
 */

export const schema = appSchema({
  version: 2, // ⚠️ Incrementado para adicionar exchange_type
  tables: [
    // 🔐 User Exchanges - Exchanges configuradas pelo usuário
    tableSchema({
      name: 'user_exchanges',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'exchange_type', type: 'string', isIndexed: true }, // CCXT ID: binance, bybit, etc
        { name: 'exchange_name', type: 'string', isIndexed: true }, // Nome customizado pelo usuário
        { name: 'api_key_encrypted', type: 'string' },
        { name: 'api_secret_encrypted', type: 'string' },
        { name: 'api_passphrase_encrypted', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean' },
        { name: 'last_sync_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),

    // 📊 Balance Snapshots - Snapshots periódicos do balanço total
    tableSchema({
      name: 'balance_snapshots',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'total_usd', type: 'number' },
        { name: 'total_brl', type: 'number' },
        { name: 'timestamp', type: 'number', isIndexed: true },
        { name: 'created_at', type: 'number' },
      ]
    }),

    // 💰 Balance History - Histórico detalhado de balanços por exchange
    tableSchema({
      name: 'balance_history',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'exchange_name', type: 'string', isIndexed: true },
        { name: 'symbol', type: 'string', isIndexed: true },
        { name: 'free', type: 'number' },
        { name: 'used', type: 'number' },
        { name: 'total', type: 'number' },
        { name: 'usd_value', type: 'number' },
        { name: 'brl_value', type: 'number' },
        { name: 'timestamp', type: 'number', isIndexed: true },
        { name: 'created_at', type: 'number' },
      ]
    }),

    // 📈 Orders - Ordens de trading
    tableSchema({
      name: 'orders',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'exchange_name', type: 'string', isIndexed: true },
        { name: 'order_id', type: 'string', isIndexed: true },
        { name: 'symbol', type: 'string', isIndexed: true },
        { name: 'type', type: 'string' }, // market, limit, stop
        { name: 'side', type: 'string' }, // buy, sell
        { name: 'price', type: 'number' },
        { name: 'amount', type: 'number' },
        { name: 'filled', type: 'number' },
        { name: 'remaining', type: 'number' },
        { name: 'status', type: 'string', isIndexed: true }, // open, closed, canceled
        { name: 'timestamp', type: 'number', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),

    // 📍 Positions - Posições abertas (futures)
    tableSchema({
      name: 'positions',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'exchange_name', type: 'string', isIndexed: true },
        { name: 'symbol', type: 'string', isIndexed: true },
        { name: 'side', type: 'string' }, // long, short
        { name: 'contracts', type: 'number' },
        { name: 'entry_price', type: 'number' },
        { name: 'mark_price', type: 'number' },
        { name: 'liquidation_price', type: 'number', isOptional: true },
        { name: 'unrealized_pnl', type: 'number' },
        { name: 'leverage', type: 'number' },
        { name: 'timestamp', type: 'number', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),

    // 🤖 Strategies - Estratégias de trading automatizado
    tableSchema({
      name: 'strategies',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'exchange_name', type: 'string', isIndexed: true },
        { name: 'symbol', type: 'string' },
        { name: 'type', type: 'string' }, // grid, dca, trailing_stop, etc
        { name: 'config', type: 'string' }, // JSON stringified config
        { name: 'is_active', type: 'boolean', isIndexed: true },
        { name: 'profit_loss', type: 'number' },
        { name: 'trades_count', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ]
    }),

    // 🔔 Notifications - Notificações do usuário
    tableSchema({
      name: 'notifications',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'message', type: 'string' },
        { name: 'type', type: 'string' }, // info, success, warning, error
        { name: 'category', type: 'string', isOptional: true }, // order, balance, strategy, etc
        { name: 'is_read', type: 'boolean', isIndexed: true },
        { name: 'data', type: 'string', isOptional: true }, // JSON metadata
        { name: 'created_at', type: 'number', isIndexed: true },
      ]
    }),
  ]
})
