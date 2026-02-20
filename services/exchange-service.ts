/**
 * Exchange Service - Hybrid (MongoDB + SQLite Cache)
 * 
 * Estratégia:
 * 1. 📡 getConnectedExchanges() / getActiveExchanges() - Busca do MongoDB via API
 * 2. 📦 Outros métodos (CRUD) - Ainda usam SQLite local como cache
 * 3. ⚡ Fallback automático para SQLite se API falhar
 * 
 * Por que híbrido?
 * - Listagem precisa ser do MongoDB (fonte da verdade)
 * - Operações CRUD ainda podem usar cache local para performance
 * - Sync bidirecional: Local ↔️ MongoDB
 */

import { table } from '@/lib/sqlite/query-builder'
import { sqliteDatabase } from '@/lib/sqlite/database'
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

  /**
   * Adiciona nova exchange
   */
  async addExchange(data: UserExchangeData): Promise<UserExchange> {
    console.log('📝 [ExchangeService] addExchange() iniciado')
    console.log('📝 [ExchangeService] Dados recebidos:', {
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

    console.log('💾 [ExchangeService] Objeto exchange criado:', {
      id: exchange.id,
      user_id: exchange.user_id,
      exchange_type: exchange.exchange_type,
      exchange_name: exchange.exchange_name,
      is_active: exchange.is_active
    })
    
    console.log('💾 [ExchangeService] Chamando table().insert()...')
    await table(this.tableName).insert(exchange)
    console.log('✅ [ExchangeService] Insert concluído com sucesso!')
    
    return exchange
  }

  /**
   * Lista todas as exchanges conectadas do usuário (MongoDB via API)
   */
  async getConnectedExchanges(userId: string): Promise<ConnectedExchange[]> {
    try {
      console.log('🔍 [ExchangeService] getConnectedExchanges() - Buscando do MongoDB via API para userId:', userId)
      
      // Busca do backend (MongoDB)
      const response = await apiService.listExchanges()
      
      if (!response.success || !response.exchanges) {
        console.warn('⚠️ [ExchangeService] Resposta vazia ou inválida do backend')
        return []
      }

      console.log(`✅ [ExchangeService] ${response.count} exchanges encontradas no MongoDB`)
      
      // Converte para formato ConnectedExchange
      const exchanges = response.exchanges.map(ex => ({
        id: ex.exchange_id,
        exchangeType: ex.exchange_type,
        exchangeName: ex.exchange_name,
        isActive: ex.is_active,
        createdAt: new Date(ex.created_at),
        lastSyncAt: undefined // API não retorna last_sync_at neste endpoint
      }))

      return exchanges
    } catch (error) {
      console.error('❌ [ExchangeService] Erro em getConnectedExchanges():', error)
      console.error('❌ [ExchangeService] Stack:', error instanceof Error ? error.stack : error)
      
      // Fallback: tenta buscar do SQLite local (cache)
      console.warn('⚠️ [ExchangeService] Tentando fallback para SQLite local...')
      try {
        const exchanges = await table<UserExchange>(this.tableName)
          .where('user_id', userId)
          .orderBy('created_at', 'DESC')
          .get()
        
        console.log(`📦 [ExchangeService] ${exchanges.length} exchanges encontradas no cache local`)
        return exchanges.map(e => this.toConnectedExchange(e))
      } catch (localError) {
        console.error('❌ [ExchangeService] Fallback SQLite também falhou:', localError)
        return []
      }
    }
  }

  /**
   * Lista apenas exchanges ativas (MongoDB via API)
   */
  async getActiveExchanges(userId: string): Promise<ConnectedExchange[]> {
    try {
      console.log('🔍 [ExchangeService] getActiveExchanges() - Buscando do MongoDB via API')
      
      const allExchanges = await this.getConnectedExchanges(userId)
      const activeExchanges = allExchanges.filter(ex => ex.isActive)
      
      console.log(`✅ [ExchangeService] ${activeExchanges.length}/${allExchanges.length} exchanges ativas`)
      
      return activeExchanges
    } catch (error) {
      console.error('❌ [ExchangeService] Erro em getActiveExchanges():', error)
      return []
    }
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
