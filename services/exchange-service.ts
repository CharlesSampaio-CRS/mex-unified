/**
 * Exchange Service - MongoDB APENAS (via API Backend)
 * 
 * ✅ TUDO vem do MongoDB via API Backend
 * ❌ SEM cache SQLite
 * ❌ SEM fallback offline
 */

import { table } from '@/lib/sqlite/query-builder'
import { apiService } from './api'

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

  async addExchange(data: UserExchangeData): Promise<UserExchange> {
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
    
    await table(this.tableName).insert(exchange)
    
    return exchange
  }

  async getConnectedExchanges(userId: string): Promise<ConnectedExchange[]> {
    const response = await apiService.listExchanges()
    
    if (!response.success || !response.exchanges) {
      return []
    }
    
    const exchanges = response.exchanges.map(ex => ({
      id: ex.exchange_id,
      exchangeType: ex.exchange_type,
      exchangeName: ex.exchange_name,
      isActive: ex.is_active,
      createdAt: new Date(ex.created_at)
    }))

    return exchanges
  }

  async getActiveExchanges(userId: string): Promise<ConnectedExchange[]> {
    const allExchanges = await this.getConnectedExchanges(userId)
    return allExchanges.filter(ex => ex.isActive)
  }

  async getExchangeById(exchangeId: string): Promise<UserExchange | null> {
    return await table<UserExchange>(this.tableName)
      .where('id', exchangeId)
      .first()
  }

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

  async countExchanges(userId: string): Promise<number> {
    try {
      const count = await table(this.tableName)
        .where('user_id', userId)
        .count()
      
      return count
    } catch (error) {
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
