/**
 * Expo SQLite Database Manager
 * 
 * Banco de dados otimizado que funciona em:
 * - ✅ Expo Go (Android + iOS)
 * - ✅ Expo Dev Client (Android + iOS)
 * - 🔄 Expo Web (modo simulado - dados não persistem)
 * 
 * Performance: 50-100x mais rápido que AsyncStorage
 * Features: SQL completo, transações, índices, triggers
 * 
 * ⚠️ IMPORTANTE: Web usa banco em memória (não persiste dados)
 */

import * as SQLite from 'expo-sqlite'
import { Platform } from 'react-native'

// Types
export interface QueryResult {
  rows: {
    _array: any[]
    length: number
    item: (index: number) => any
  }
  rowsAffected: number
  insertId?: number
}

// Database configuration
const DB_NAME = 'cryptohub.db'
const DB_VERSION = 1
const IS_WEB = Platform.OS === 'web'

// Mock database para Web (temporário até corrigir WASM)
class MockDatabase {
  private data: Map<string, any[]> = new Map()

  async execAsync(sql: string): Promise<void> {
    console.log('🌐 [MockDB] execAsync:', sql.substring(0, 100))
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    console.log('🌐 [MockDB] getAllAsync - Retornando array vazio')
    return []
  }

  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    console.log('🌐 [MockDB] getFirstAsync - Retornando null')
    return null
  }

  async runAsync(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowId: number }> {
    console.log('🌐 [MockDB] runAsync')
    return { changes: 0, lastInsertRowId: 0 }
  }
}
class SQLiteDatabase {
  private db: SQLite.SQLiteDatabase | null = null
  private isInitialized = false
  private initPromise: Promise<void> | null = null

  /**
   * Inicializa o banco de dados
   */
  async initialize(): Promise<void> {
    // Se já está inicializado, retorna
    if (this.isInitialized) return

    // Se está inicializando, aguarda
    if (this.initPromise) return this.initPromise

    // Inicia inicialização
    this.initPromise = this._initialize()
    return this.initPromise
  }

  private async _initialize(): Promise<void> {
    try {
      console.log('🗄️  [SQLite] Inicializando banco de dados...')
      console.log('📱 Platform:', Platform.OS)

      // 🌐 WEB: Usar Mock Database (temporário)
      if (IS_WEB) {
        console.warn('⚠️ [SQLite] Rodando em WEB - usando MockDatabase (dados não persistem)')
        this.db = new MockDatabase() as any
        this.isInitialized = true
        console.log('✅ [SQLite] MockDatabase inicializado (Web)')
        return
      }

      // 📱 MOBILE: Usar SQLite real
      this.db = await SQLite.openDatabaseAsync(DB_NAME)

      // Habilitar foreign keys
      await this.db.execAsync('PRAGMA foreign_keys = ON')

      // Habilitar WAL mode (Write-Ahead Logging) para melhor performance
      await this.db.execAsync('PRAGMA journal_mode = WAL')

      // 🔄 MIGRAÇÃO: Verificar se precisa atualizar schema
      const needsMigration = await this.checkIfNeedsMigration()
      if (needsMigration) {
        console.log('🔄 [SQLite] Schema antigo detectado - executando migração...')
        await this.migrateSchema()
      }

      // Criar tabelas
      await this.createTables()

      this.isInitialized = true
      console.log('✅ [SQLite] Banco de dados inicializado com sucesso!')
      console.log(`   📊 Platform: ${Platform.OS}`)
      console.log(`   📦 Database: ${DB_NAME}`)
      console.log(`   🔢 Version: ${DB_VERSION}`)

    } catch (error) {
      console.error('❌ [SQLite] Erro ao inicializar banco:', error)
      throw error
    }
  }

  /**
   * Cria todas as tabelas necessárias
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado')

    console.log('📋 [SQLite] Criando tabelas...')

    await this.db.execAsync(`
      -- Tabela de Exchanges do Usuário
      CREATE TABLE IF NOT EXISTS user_exchanges (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        exchange_type TEXT NOT NULL,
        exchange_name TEXT NOT NULL,
        api_key_encrypted TEXT NOT NULL,
        api_secret_encrypted TEXT NOT NULL,
        api_passphrase_encrypted TEXT,
        is_active INTEGER DEFAULT 1,
        last_sync_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Tabela de Snapshots de Balance
      CREATE TABLE IF NOT EXISTS balance_snapshots (
        id TEXT PRIMARY KEY,
        exchange_id TEXT NOT NULL,
        total_usd REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (exchange_id) REFERENCES user_exchanges(id) ON DELETE CASCADE
      );

      -- Tabela de Histórico de Balance
      CREATE TABLE IF NOT EXISTS balance_history (
        id TEXT PRIMARY KEY,
        exchange_id TEXT NOT NULL,
        token TEXT NOT NULL,
        amount REAL NOT NULL,
        usd_value REAL NOT NULL,
        price REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (exchange_id) REFERENCES user_exchanges(id) ON DELETE CASCADE
      );

      -- Tabela de Orders
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        exchange_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        type TEXT NOT NULL,
        side TEXT NOT NULL,
        price REAL,
        amount REAL NOT NULL,
        filled REAL DEFAULT 0,
        status TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (exchange_id) REFERENCES user_exchanges(id) ON DELETE CASCADE
      );

      -- Tabela de Positions
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        exchange_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        amount REAL NOT NULL,
        entry_price REAL NOT NULL,
        current_price REAL NOT NULL,
        pnl REAL NOT NULL,
        pnl_percent REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (exchange_id) REFERENCES user_exchanges(id) ON DELETE CASCADE
      );

      -- Tabela de Strategies
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        symbol TEXT NOT NULL,
        exchange_id TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        config TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (exchange_id) REFERENCES user_exchanges(id) ON DELETE CASCADE
      );

      -- Tabela de Notifications
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT,
        is_read INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      -- Tabela de Watchlist
      CREATE TABLE IF NOT EXISTS watchlist (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL UNIQUE,
        name TEXT,
        is_favorite INTEGER DEFAULT 0,
        order_index INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      -- Tabela de Price Alerts
      CREATE TABLE IF NOT EXISTS price_alerts (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        target_price REAL NOT NULL,
        condition TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        is_triggered INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        triggered_at INTEGER
      );

      -- Índices para otimização de queries
      CREATE INDEX IF NOT EXISTS idx_balance_snapshots_exchange ON balance_snapshots(exchange_id);
      CREATE INDEX IF NOT EXISTS idx_balance_snapshots_timestamp ON balance_snapshots(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_balance_history_exchange ON balance_history(exchange_id);
      CREATE INDEX IF NOT EXISTS idx_balance_history_timestamp ON balance_history(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_orders_exchange ON orders(exchange_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_positions_exchange ON positions(exchange_id);
      CREATE INDEX IF NOT EXISTS idx_strategies_exchange ON strategies(exchange_id);
      CREATE INDEX IF NOT EXISTS idx_strategies_active ON strategies(is_active);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_watchlist_favorite ON watchlist(is_favorite);
      CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active);
    `)

    console.log('✅ [SQLite] Tabelas criadas com sucesso!')
  }

  /**
   * Verifica se precisa migrar o schema
   */
  private async checkIfNeedsMigration(): Promise<boolean> {
    if (!this.db) return false

    try {
      // Verificar se a coluna user_id existe na tabela user_exchanges
      const result = await this.db.getFirstAsync<{ name: string }>(
        `PRAGMA table_info(user_exchanges)`
      )
      
      if (!result) {
        // Tabela não existe ainda
        return false
      }

      // Verificar se tem a coluna user_id (nova estrutura)
      const columns = await this.db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(user_exchanges)`
      )
      
      const hasUserId = columns.some(col => col.name === 'user_id')
      const hasExchangeType = columns.some(col => col.name === 'exchange_type')
      
      // Se não tem user_id e exchange_type, precisa migrar
      return !hasUserId || !hasExchangeType
    } catch (error) {
      console.error('❌ [SQLite] Erro ao verificar migração:', error)
      return false
    }
  }

  /**
   * Migra o schema antigo para o novo
   */
  private async migrateSchema(): Promise<void> {
    if (!this.db) return

    try {
      console.log('🔄 [SQLite] Migrando schema...')

      // Dropar tabela antiga e recriar com novo schema
      await this.db.execAsync(`
        DROP TABLE IF EXISTS user_exchanges;
        DROP TABLE IF EXISTS balance_snapshots;
        DROP TABLE IF EXISTS balance_history;
      `)

      console.log('✅ [SQLite] Schema antigo removido')
    } catch (error) {
      console.error('❌ [SQLite] Erro na migração:', error)
      throw error
    }
  }

  /**
   * Reseta o banco de dados (útil após mudanças de schema)
   */
  async resetDatabase(): Promise<void> {
    await this.initialize()
    if (!this.db) throw new Error('Database não inicializado')

    console.log('🔄 [SQLite] Resetando banco de dados...')

    try {
      // Dropar todas as tabelas
      await this.db.execAsync(`
        DROP TABLE IF EXISTS user_exchanges;
        DROP TABLE IF EXISTS balance_snapshots;
        DROP TABLE IF EXISTS balance_history;
        DROP TABLE IF EXISTS strategies;
        DROP TABLE IF EXISTS positions;
        DROP TABLE IF EXISTS orders;
        DROP TABLE IF EXISTS notifications;
        DROP TABLE IF EXISTS watchlist;
        DROP TABLE IF EXISTS price_alerts;
      `)

      console.log('✅ [SQLite] Tabelas antigas removidas')

      // Recriar todas as tabelas
      await this.createTables()

      console.log('✅ [SQLite] Banco de dados resetado com sucesso!')
    } catch (error) {
      console.error('❌ [SQLite] Erro ao resetar banco:', error)
      throw error
    }
  }

  /**
   * Executa uma query SQL
   */
  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    console.log('🔍 [SQLite] query() iniciado')
    console.log('🔍 [SQLite] SQL:', sql)
    console.log('🔍 [SQLite] Params:', params)
    
    await this.initialize()
    if (!this.db) throw new Error('Database não inicializado')

    try {
      console.log('🔄 [SQLite] Executando runAsync...')
      const result = await this.db.runAsync(sql, params)
      console.log('✅ [SQLite] runAsync concluído!')
      console.log('✅ [SQLite] changes:', result.changes)
      console.log('✅ [SQLite] lastInsertRowId:', result.lastInsertRowId)
      
      return {
        rows: {
          _array: [],
          length: 0,
          item: (index: number) => null
        },
        rowsAffected: result.changes,
        insertId: result.lastInsertRowId
      }
    } catch (error) {
      console.error('❌ [SQLite] Erro na query:', { sql, params, error })
      console.error('❌ [SQLite] Stack:', error instanceof Error ? error.stack : error)
      throw error
    }
  }

  /**
   * Executa uma query SQL e retorna os resultados
   */
  async queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    console.log('📋 [SQLite] queryAll() chamado')
    console.log('📝 [SQLite] SQL:', sql)
    console.log('📝 [SQLite] Params:', params)
    
    await this.initialize()
    if (!this.db) throw new Error('Database não inicializado')

    try {
      console.log('🔄 [SQLite] Executando getAllAsync...')
      const result = await this.db.getAllAsync<T>(sql, params)
      console.log('📊 [SQLite] Resultado getAllAsync:', result?.length, 'registros')
      
      return result
    } catch (error) {
      console.error('❌ [SQLite] Erro na queryAll:', { sql, params, error })
      console.error('❌ [SQLite] Stack completa:', error instanceof Error ? error.stack : error)
      throw error
    }
  }

  /**
   * Executa uma query SQL e retorna o primeiro resultado
   */
  async queryFirst<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    console.log('🔍 [SQLite] queryFirst() chamado')
    console.log('📝 [SQLite] SQL:', sql)
    console.log('📝 [SQLite] Params:', params)
    
    await this.initialize()
    if (!this.db) throw new Error('Database não inicializado')

    try {
      console.log('🔄 [SQLite] Executando getFirstAsync...')
      const result = await this.db.getFirstAsync<T>(sql, params)
      console.log('📊 [SQLite] Resultado getFirstAsync:', result)
      
      const finalResult = result || null
      console.log('✅ [SQLite] queryFirst() retornando:', finalResult)
      return finalResult
    } catch (error) {
      console.error('❌ [SQLite] Erro na query:', { sql, params, error })
      console.error('❌ [SQLite] Stack completa:', error instanceof Error ? error.stack : error)
      throw error
    }
  }

  /**
   * Executa uma transação
   */
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.initialize()
    if (!this.db) throw new Error('Database não inicializado')

    try {
      await this.db.execAsync('BEGIN TRANSACTION')
      const result = await callback()
      await this.db.execAsync('COMMIT')
      return result
    } catch (error) {
      await this.db.execAsync('ROLLBACK')
      console.error('❌ [SQLite] Erro na transação:', error)
      throw error
    }
  }

  /**
   * Limpa uma tabela
   */
  async clearTable(tableName: string): Promise<void> {
    await this.query(`DELETE FROM ${tableName}`)
  }

  /**
   * Limpa todo o banco de dados
   */
  async clearAll(): Promise<void> {
    await this.initialize()
    if (!this.db) throw new Error('Database não inicializado')

    const tables = [
      'price_alerts',
      'watchlist',
      'notifications',
      'strategies',
      'positions',
      'orders',
      'balance_history',
      'balance_snapshots',
      'user_exchanges'
    ]

    await this.transaction(async () => {
      for (const table of tables) {
        await this.clearTable(table)
      }
    })

    console.log('🗑️  [SQLite] Banco de dados limpo!')
  }

  /**
   * Fecha a conexão com o banco
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync()
      this.db = null
      this.isInitialized = false
      this.initPromise = null
      console.log('👋 [SQLite] Conexão fechada')
    }
  }

  /**
   * Retorna estatísticas do banco
   */
  async getStats(): Promise<{
    tables: Array<{ name: string; count: number }>
    size: string
    version: number
  }> {
    await this.initialize()
    
    const tables = [
      'user_exchanges',
      'balance_snapshots',
      'balance_history',
      'orders',
      'positions',
      'strategies',
      'notifications',
      'watchlist',
      'price_alerts'
    ]

    const tableCounts = await Promise.all(
      tables.map(async (table) => {
        const result = await this.queryFirst<{ count: number }>(
          `SELECT COUNT(*) as count FROM ${table}`
        )
        return { name: table, count: result?.count || 0 }
      })
    )

    return {
      tables: tableCounts,
      size: 'N/A', // SQLite não expõe tamanho facilmente
      version: DB_VERSION
    }
  }
}

// Singleton instance
export const sqliteDatabase = new SQLiteDatabase()
export default sqliteDatabase
