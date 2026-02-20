/**
 * 📦 SQLite Local Database
 * 
 * ✅ APENAS para dados LOCAIS (não sincronizados):
 * - price_alerts (alertas de preço)
 * - app_settings (configurações do app)
 * - user_preferences (preferências do usuário)
 * - notifications (histórico de notificações)
 * - watchlist (lista de favoritos - apenas símbolos)
 * 
 * ❌ TUDO que é operacional vai para MongoDB:
 * - user_exchanges
 * - balances/balance_history
 * - orders/positions
 * - strategies
 */

import * as SQLite from 'expo-sqlite'
import { Platform } from 'react-native'

class SQLiteDatabase {
  private db: SQLite.SQLiteDatabase | null = null
  private isInitialized = false
  private readonly DATABASE_NAME = 'mex_unified_local.db'

  /**
   * Inicializa o banco de dados SQLite
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('✅ [SQLite] Já inicializado')
      return
    }

    try {
      console.log('🔄 [SQLite] Inicializando banco local...')
      
      // Abre/cria o banco
      this.db = await SQLite.openDatabaseAsync(this.DATABASE_NAME)
      
      // Cria as tabelas LOCAIS (apenas)
      await this.createLocalTables()
      
      // Remove tabelas antigas (se existirem)
      await this.dropOldTables()
      
      this.isInitialized = true
      console.log('✅ [SQLite] Banco local inicializado')
    } catch (error) {
      console.error('❌ [SQLite] Erro ao inicializar:', error)
      throw error
    }
  }

  /**
   * Retorna a instância do banco
   */
  getDatabase(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('❌ [SQLite] Database não inicializado. Chame initialize() primeiro.')
    }
    return this.db
  }

  /**
   * Cria as 5 tabelas LOCAIS
   */
  private async createLocalTables(): Promise<void> {
    if (!this.db) return

    console.log('📋 [SQLite] Criando tabelas locais...')

    try {
      // 1️⃣ ALERTAS DE PREÇO
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS price_alerts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          symbol TEXT NOT NULL,
          exchange TEXT NOT NULL,
          condition TEXT NOT NULL,
          target_price REAL NOT NULL,
          current_price REAL,
          is_active INTEGER DEFAULT 1,
          triggered INTEGER DEFAULT 0,
          triggered_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON price_alerts(user_id);
        CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active, triggered);
      `)

      // 2️⃣ CONFIGURAÇÕES DO APP
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `)

      // 3️⃣ PREFERÊNCIAS DO USUÁRIO
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          user_id TEXT PRIMARY KEY,
          theme TEXT DEFAULT 'dark',
          currency TEXT DEFAULT 'USD',
          language TEXT DEFAULT 'pt-BR',
          notifications_enabled INTEGER DEFAULT 1,
          sound_enabled INTEGER DEFAULT 1,
          biometric_enabled INTEGER DEFAULT 0,
          auto_sync_enabled INTEGER DEFAULT 1,
          sync_interval INTEGER DEFAULT 300,
          updated_at INTEGER NOT NULL
        );
      `)

      // 4️⃣ HISTÓRICO DE NOTIFICAÇÕES
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          data TEXT,
          is_read INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
        CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
      `)

      // 5️⃣ WATCHLIST (FAVORITOS)
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS watchlist (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          symbol TEXT NOT NULL,
          exchange TEXT,
          is_favorite INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL,
          UNIQUE(user_id, symbol, exchange)
        );
        CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id, is_favorite);
      `)

      console.log('✅ [SQLite] Tabelas locais criadas')
    } catch (error) {
      console.error('❌ [SQLite] Erro ao criar tabelas:', error)
      throw error
    }
  }

  /**
   * Remove tabelas antigas (migradas para MongoDB)
   */
  private async dropOldTables(): Promise<void> {
    if (!this.db) return

    console.log('🧹 [SQLite] Removendo tabelas antigas (migradas para MongoDB)...')

    try {
      // Lista de tabelas antigas para remover
      const oldTables = [
        'user_exchanges',
        'balance_snapshots',
        'balance_history',
        'orders',
        'positions',
        'strategies'
      ]

      // Remove cada tabela individualmente
      for (const table of oldTables) {
        try {
          await this.db.execAsync(`DROP TABLE IF EXISTS ${table}`)
        } catch (error) {
          // Ignora erros (tabela pode não existir)
        }
      }

      // Remove índices antigos
      const oldIndexes = [
        'idx_balance_snapshots_user',
        'idx_balance_snapshots_timestamp',
        'idx_balance_history_user',
        'idx_balance_history_timestamp',
        'idx_balance_history_exchange_name',
        'idx_orders_exchange',
        'idx_orders_status',
        'idx_orders_timestamp',
        'idx_positions_exchange',
        'idx_strategies_exchange',
        'idx_strategies_active',
        'idx_watchlist_favorite'
      ]

      for (const index of oldIndexes) {
        try {
          await this.db.execAsync(`DROP INDEX IF EXISTS ${index}`)
        } catch (error) {
          // Ignora erros (índice pode não existir)
        }
      }

      console.log('✅ [SQLite] Tabelas antigas removidas')
    } catch (error) {
      console.warn('⚠️ [SQLite] Erro ao remover tabelas antigas:', error)
    }
  }

  /**
   * Limpa todo o banco de dados (CUIDADO!)
   */
  async clearDatabase(): Promise<void> {
    if (!this.db) return

    console.log('🧹 [SQLite] Limpando banco de dados...')

    try {
      await this.db.execAsync(`
        DELETE FROM price_alerts;
        DELETE FROM app_settings;
        DELETE FROM user_preferences;
        DELETE FROM notifications;
        DELETE FROM watchlist;
      `)
      console.log('✅ [SQLite] Banco limpo')
    } catch (error) {
      console.error('❌ [SQLite] Erro ao limpar banco:', error)
      throw error
    }
  }

  /**
   * Fecha a conexão (raramente usado em mobile)
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync()
      this.db = null
      this.isInitialized = false
      console.log('✅ [SQLite] Conexão fechada')
    }
  }
}

// Singleton
export const sqliteDatabase = new SQLiteDatabase()

// Exporta a instância do banco (para usar com query-builder)
export const getDatabase = () => sqliteDatabase.getDatabase()
