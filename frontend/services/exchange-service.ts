/**
 * Exchange Service - SQLite
 * 
 * Gerencia exchanges conectadas do usuário
 * Funciona em Expo Go, Dev Client e Web!
 */

import { table } from '@/lib/sqlite/query-builder'
import { sqliteDatabase } from '@/lib/sqlite/database'

export interface UserExchange {
  id: string
  user_id: string
  exchange_type: string // CCXT ID: binance, bybit, mexc, etc (lowercase)
  exchange_name: string // Nome customizado pelo usuário
  api_key_encrypted: string
  api_secret_encrypted: string
  api_passphrase_encrypted: string | null
  is_active: number // SQLite usa INTEGER para boolean
  last_sync_at: number | null
  created_at: number
  updated_at: number
}

export interface UserExchangeData {
  userId: string
  exchangeType: string
  exchangeName: string
  apiKeyEncrypted: string
  apiSecretEncrypted: string
  apiPassphraseEncrypted?: string
  isActive?: boolean
}

export interface ConnectedExchange {
  id: string
  exchangeType: string
  exchangeName: string
  isActive: boolean
  lastSyncAt?: Date
  createdAt: Date
}

class SQLiteExchangeService {
  private tableName = 'user_exchanges'

  /**
   * Adiciona nova exchange
   */
  async addExchange(data: UserExchangeData): Promise<UserExchange> {
    try {
      console.log('🔵 [ExchangeService] addExchange() iniciado')
      console.log('📥 [ExchangeService] Dados recebidos:', {
        userId: data.userId,
        exchangeType: data.exchangeType,
        exchangeName: data.exchangeName,
        hasApiKey: !!data.apiKeyEncrypted,
        hasApiSecret: !!data.apiSecretEncrypted,
        hasPassphrase: !!data.apiPassphraseEncrypted,
        isActive: data.isActive
      })

      const now = Date.now()
      const id = `exchange_${now}_${Math.random().toString(36).substr(2, 9)}`

      const exchange: UserExchange = {
        id,
        user_id: data.userId,
        exchange_type: data.exchangeType,
        exchange_name: data.exchangeName,
        api_key_encrypted: data.apiKeyEncrypted,
        api_secret_encrypted: data.apiSecretEncrypted,
        api_passphrase_encrypted: data.apiPassphraseEncrypted || null,
        is_active: data.isActive !== false ? 1 : 0,
        last_sync_at: now,
        created_at: now,
        updated_at: now
      }

      console.log('💾 [ExchangeService] Exchange objeto criado:', {
        id: exchange.id,
        user_id: exchange.user_id,
        exchange_type: exchange.exchange_type,
        exchange_name: exchange.exchange_name,
        is_active: exchange.is_active
      })

      console.log('🔄 [ExchangeService] Executando INSERT no SQLite...')
      await table(this.tableName).insert(exchange)
      
      console.log('✅ [ExchangeService] INSERT concluído com sucesso!')
      
      // Verificar se realmente foi inserido
      const inserted = await table<UserExchange>(this.tableName)
        .where('id', id)
        .first()
      
      if (inserted) {
        console.log('✅ [ExchangeService] Exchange confirmada no banco:', inserted.id)
      } else {
        console.warn('⚠️ [ExchangeService] Exchange não encontrada após INSERT!')
      }

      return exchange
    } catch (error) {
      console.error('❌ [ExchangeService] Erro em addExchange():', error)
      console.error('❌ [ExchangeService] Stack:', error instanceof Error ? error.stack : error)
      throw error
    }
  }

  /**
   * Lista todas as exchanges conectadas do usuário
   */
  async getConnectedExchanges(userId: string): Promise<ConnectedExchange[]> {
    try {
      console.log('🔍 [ExchangeService] getConnectedExchanges() iniciado para userId:', userId)
      
      const exchanges = await table<UserExchange>(this.tableName)
        .where('user_id', userId)
        .orderBy('created_at', 'DESC')
        .get()

      console.log('✅ [ExchangeService] getConnectedExchanges() concluído, count:', exchanges.length)
      return exchanges.map(e => this.toConnectedExchange(e))
    } catch (error) {
      console.error('❌ [ExchangeService] Erro em getConnectedExchanges():', error)
      console.error('❌ [ExchangeService] Stack:', error instanceof Error ? error.stack : error)
      // Retorna array vazio em caso de erro (tabela pode não existir ainda)
      return []
    }
  }

  /**
   * Lista apenas exchanges ativas
   */
  async getActiveExchanges(userId: string): Promise<ConnectedExchange[]> {
    const exchanges = await table<UserExchange>(this.tableName)
      .where('user_id', userId)
      .where('is_active', 1)
      .orderBy('created_at', 'DESC')
      .get()

    return exchanges.map(e => this.toConnectedExchange(e))
  }

  /**
   * Busca exchange por ID
   */
  async getExchangeById(exchangeId: string): Promise<UserExchange | null> {
    return await table<UserExchange>(this.tableName)
      .where('id', exchangeId)
      .first()
  }

  /**
   * Busca exchange por nome
   */
  async getExchangeByName(userId: string, exchangeName: string): Promise<UserExchange | null> {
    return await table<UserExchange>(this.tableName)
      .where('user_id', userId)
      .where('exchange_name', exchangeName)
      .first()
  }

  /**
   * Busca exchanges por tipo
   */
  async getExchangesByType(userId: string, exchangeType: string): Promise<UserExchange[]> {
    return await table<UserExchange>(this.tableName)
      .where('user_id', userId)
      .where('exchange_type', exchangeType)
      .orderBy('created_at', 'DESC')
      .get()
  }

  /**
   * Remove exchange
   */
  async removeExchange(exchangeId: string): Promise<boolean> {
    const rowsAffected = await table(this.tableName)
      .where('id', exchangeId)
      .delete()

    return rowsAffected > 0
  }

  /**
   * Ativa exchange
   */
  async activateExchange(exchangeId: string): Promise<boolean> {
    const rowsAffected = await table(this.tableName)
      .where('id', exchangeId)
      .update({
        is_active: 1,
        updated_at: Date.now()
      })

    return rowsAffected > 0
  }

  /**
   * Desativa exchange
   */
  async deactivateExchange(exchangeId: string): Promise<boolean> {
    const rowsAffected = await table(this.tableName)
      .where('id', exchangeId)
      .update({
        is_active: 0,
        updated_at: Date.now()
      })

    return rowsAffected > 0
  }

  /**
   * Alterna status ativo/inativo
   */
  async toggleExchange(exchangeId: string): Promise<boolean> {
    const exchange = await this.getExchangeById(exchangeId)
    if (!exchange) return false

    const newStatus = exchange.is_active === 1 ? 0 : 1
    return await this.updateExchange(exchangeId, { is_active: newStatus })
  }

  /**
   * Atualiza exchange
   */
  async updateExchange(exchangeId: string, updates: Partial<UserExchange>): Promise<boolean> {
    const data: any = {
      ...updates,
      updated_at: Date.now()
    }

    const rowsAffected = await table(this.tableName)
      .where('id', exchangeId)
      .update(data)

    return rowsAffected > 0
  }

  /**
   * Atualiza last_sync_at
   */
  async updateLastSync(exchangeId: string): Promise<boolean> {
    return await this.updateExchange(exchangeId, {
      last_sync_at: Date.now()
    })
  }

  /**
   * Atualiza nome customizado
   */
  async updateExchangeName(exchangeId: string, newName: string): Promise<boolean> {
    return await this.updateExchange(exchangeId, {
      exchange_name: newName
    })
  }

  /**
   * Conta exchanges do usuário
   */
  async countExchanges(userId: string): Promise<number> {
    try {
      console.log('🔍 [ExchangeService] countExchanges() iniciado para userId:', userId)
      
      const count = await table(this.tableName)
        .where('user_id', userId)
        .count()
      
      console.log('✅ [ExchangeService] countExchanges() concluído, count:', count)
      return count
    } catch (error) {
      console.error('❌ [ExchangeService] Erro em countExchanges():', error)
      console.error('❌ [ExchangeService] Stack:', error instanceof Error ? error.stack : error)
      // Retorna 0 em caso de erro (tabela pode não existir ainda)
      return 0
    }
  }

  /**
   * Conta exchanges ativas
   */
  async countActiveExchanges(userId: string): Promise<number> {
    return await table(this.tableName)
      .where('user_id', userId)
      .where('is_active', 1)
      .count()
  }

  /**
   * Remove todas as exchanges do usuário
   */
  async removeAllExchanges(userId: string): Promise<number> {
    return await table(this.tableName)
      .where('user_id', userId)
      .delete()
  }

  /**
   * Verifica se exchange existe
   */
  async exchangeExists(userId: string, exchangeName: string): Promise<boolean> {
    const exchange = await this.getExchangeByName(userId, exchangeName)
    return exchange !== null
  }

  /**
   * Converte UserExchange para ConnectedExchange (sem expor keys)
   */
  private toConnectedExchange(exchange: UserExchange): ConnectedExchange {
    return {
      id: exchange.id,
      exchangeType: exchange.exchange_type,
      exchangeName: exchange.exchange_name,
      isActive: exchange.is_active === 1,
      lastSyncAt: exchange.last_sync_at ? new Date(exchange.last_sync_at) : undefined,
      createdAt: new Date(exchange.created_at)
    }
  }

  /**
   * Obter credenciais descriptografadas (usar com cuidado!)
   */
  async getExchangeCredentials(exchangeId: string): Promise<{
    apiKey: string
    apiSecret: string
    apiPassphrase?: string
  } | null> {
    const exchange = await this.getExchangeById(exchangeId)
    if (!exchange) return null

    // Retorna encriptado - descriptografar no serviço que usar
    return {
      apiKey: exchange.api_key_encrypted,
      apiSecret: exchange.api_secret_encrypted,
      apiPassphrase: exchange.api_passphrase_encrypted || undefined
    }
  }
}

// Singleton instance
export const exchangeService = new SQLiteExchangeService()
export const sqliteExchangeService = exchangeService // Alias
export default exchangeService
