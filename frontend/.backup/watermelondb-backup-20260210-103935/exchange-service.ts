import database from '../lib/watermelon/database'
import { Q } from '@nozbe/watermelondb'
import { UserExchange } from '../lib/watermelon/models/UserExchange'

/**
 * Exchange Service - Local
 * 
 * Gerencia exchanges conectadas do usuário no WatermelonDB local
 * 
 * Funcionalidades:
 * - Listar exchanges conectadas
 * - Buscar exchange por ID
 * - Adicionar nova exchange
 * - Remover exchange
 * - Ativar/desativar exchange
 */

export interface UserExchangeData {
  userId: string
  exchangeType: string // CCXT ID: binance, bybit, mexc, etc (lowercase)
  exchangeName: string // Nome customizado pelo usuário
  apiKeyEncrypted: string
  apiSecretEncrypted: string
  apiPassphraseEncrypted?: string
  isActive?: boolean
}

export interface ConnectedExchange {
  id: string
  exchangeType: string // CCXT ID: binance, bybit, mexc, etc
  exchangeName: string // Nome customizado
  isActive: boolean
  lastSyncAt?: Date
  createdAt: Date
  // Não retorna keys por segurança
}

class ExchangeService {
  /**
   * Lista todas as exchanges conectadas do usuário
   */
  async getConnectedExchanges(userId: string): Promise<ConnectedExchange[]> {
    try {
      const collection = database.get<UserExchange>('user_exchanges')
      
      const exchanges = await collection
        .query(
          Q.where('user_id', userId),
          Q.sortBy('created_at', Q.desc)
        )
        .fetch()
      
      const result = exchanges.map(exchange => ({
        id: exchange.id,
        exchangeType: exchange.exchangeType,
        exchangeName: exchange.exchangeName,
        isActive: exchange.isActive,
        lastSyncAt: exchange.lastSyncAt,
        createdAt: exchange.createdAt
      }))
      
      return result
    } catch (error) {
      console.error('❌ [ExchangeService.getConnectedExchanges] ERRO:', error)
      throw error
    }
  }

  /**
   * Lista apenas exchanges ativas
   */
  async getActiveExchanges(userId: string): Promise<ConnectedExchange[]> {
    const collection = database.get<UserExchange>('user_exchanges')
    
    const exchanges = await collection
      .query(
        Q.where('user_id', userId),
        Q.where('is_active', true),
        Q.sortBy('created_at', Q.desc)
      )
      .fetch()
    
    return exchanges.map(exchange => ({
      id: exchange.id,
      exchangeType: exchange.exchangeType,
      exchangeName: exchange.exchangeName,
      isActive: exchange.isActive,
      lastSyncAt: exchange.lastSyncAt,
      createdAt: exchange.createdAt
    }))
  }

  /**
   * Busca exchange por ID
   */
  async getExchangeById(exchangeId: string): Promise<UserExchange | null> {
    try {
      const collection = database.get<UserExchange>('user_exchanges')
      return await collection.find(exchangeId)
    } catch (error) {
      console.error('❌ Exchange não encontrada:', error)
      return null
    }
  }

  /**
   * Busca exchange por nome
   */
  async getExchangeByName(userId: string, exchangeName: string): Promise<UserExchange | null> {
    const collection = database.get<UserExchange>('user_exchanges')
    
    const exchanges = await collection
      .query(
        Q.where('user_id', userId),
        Q.where('exchange_name', exchangeName)
      )
      .fetch()
    
    return exchanges.length > 0 ? exchanges[0] : null
  }

  /**
   * Adiciona nova exchange
   */
  async addExchange(data: UserExchangeData): Promise<UserExchange> {
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
        exchange.isActive = data.isActive !== undefined ? data.isActive : true
        exchange.lastSyncAt = new Date()
      })
    })
  }

  /**
   * Remove exchange
   */
  async removeExchange(exchangeId: string): Promise<void> {
    const exchange = await this.getExchangeById(exchangeId)
    
    if (!exchange) {
      throw new Error('Exchange não encontrada')
    }
    
    await database.write(async () => {
      await exchange.destroyPermanently()
    })
  }

  /**
   * Ativa exchange
   */
  async activateExchange(exchangeId: string): Promise<void> {
    const exchange = await this.getExchangeById(exchangeId)
    
    if (!exchange) {
      throw new Error('Exchange não encontrada')
    }
    
    await database.write(async () => {
      await exchange.update(ex => {
        ex.isActive = true
      })
    })
  }

  /**
   * Desativa exchange
   */
  async deactivateExchange(exchangeId: string): Promise<void> {
    const exchange = await this.getExchangeById(exchangeId)
    
    if (!exchange) {
      throw new Error('Exchange não encontrada')
    }
    
    await database.write(async () => {
      await exchange.update(ex => {
        ex.isActive = false
      })
    })
  }

  /**
   * Atualiza timestamp de última sincronização
   */
  async updateLastSync(exchangeId: string): Promise<void> {
    const exchange = await this.getExchangeById(exchangeId)
    
    if (!exchange) {
      throw new Error('Exchange não encontrada')
    }
    
    await database.write(async () => {
      await exchange.update(ex => {
        ex.lastSyncAt = new Date()
      })
    })
  }

  /**
   * Conta quantas exchanges o usuário tem conectadas
   */
  async getExchangeCount(userId: string): Promise<number> {
    const collection = database.get<UserExchange>('user_exchanges')
    
    return await collection
      .query(Q.where('user_id', userId))
      .fetchCount()
  }

  /**
   * Verifica se usuário já conectou uma exchange específica
   */
  async hasExchange(userId: string, exchangeName: string): Promise<boolean> {
    const exchange = await this.getExchangeByName(userId, exchangeName)
    return exchange !== null
  }
}

export const exchangeService = new ExchangeService()
