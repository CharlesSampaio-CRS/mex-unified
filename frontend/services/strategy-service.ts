/**
 * Strategy Service - Expo SQLite
 * 
 * CRUD otimizado de estratégias usando Expo SQLite
 * Performance: 50-100x mais rápido que AsyncStorage
 * 
 * Funciona em:
 * - ✅ Expo Go (Android + iOS)
 * - ✅ Expo Dev Client
 * - ✅ Expo Web
 */

import { table } from '@/lib/sqlite/query-builder'
import { sqliteDatabase } from '@/lib/sqlite/database'

export interface Strategy {
  id: string
  name: string
  description: string | null
  type: string
  symbol: string
  exchange_id: string
  is_active: number // SQLite usa INTEGER para boolean
  config: string // JSON stringificado
  created_at: number
  updated_at: number
}

export interface StrategyConfig {
  entry_price?: number
  stop_loss?: number
  take_profit?: number
  amount?: number
  [key: string]: any
}

class SQLiteStrategyService {
  private tableName = 'strategies'

  /**
   * Criar nova estratégia
   */
  async create(data: {
    name: string
    description?: string
    type: string
    symbol: string
    exchange_id: string
    config: StrategyConfig
  }): Promise<Strategy> {
    const now = Date.now()
    const id = `strategy_${now}_${Math.random().toString(36).substr(2, 9)}`

    const strategy: Strategy = {
      id,
      name: data.name,
      description: data.description || null,
      type: data.type,
      symbol: data.symbol,
      exchange_id: data.exchange_id,
      is_active: 0,
      config: JSON.stringify(data.config),
      created_at: now,
      updated_at: now
    }

    await table(this.tableName).insert(strategy)
    return strategy
  }

  /**
   * Buscar estratégia por ID
   */
  async findById(id: string): Promise<Strategy | null> {
    return await table<Strategy>(this.tableName)
      .where('id', id)
      .first()
  }

  /**
   * Buscar todas as estratégias
   */
  async findAll(): Promise<Strategy[]> {
    try {
      console.log('🔍 [StrategyService] findAll() iniciado')
      console.log('🔍 [StrategyService] Tabela:', this.tableName)
      
      const result = await table<Strategy>(this.tableName)
        .orderBy('created_at', 'DESC')
        .get()
      
      console.log('✅ [StrategyService] findAll() concluído, resultados:', result.length)
      return result
    } catch (error) {
      console.error('❌ [StrategyService] Erro em findAll():', error)
      console.error('❌ [StrategyService] Stack:', error instanceof Error ? error.stack : error)
      // Retorna array vazio em caso de erro (tabela pode não existir ainda)
      return []
    }
  }

  /**
   * Buscar estratégias ativas
   */
  async findActive(): Promise<Strategy[]> {
    return await table<Strategy>(this.tableName)
      .where('is_active', 1)
      .orderBy('created_at', 'DESC')
      .get()
  }

  /**
   * Buscar estratégias por exchange
   */
  async findByExchange(exchangeId: string): Promise<Strategy[]> {
    return await table<Strategy>(this.tableName)
      .where('exchange_id', exchangeId)
      .orderBy('created_at', 'DESC')
      .get()
  }

  /**
   * Buscar estratégias por símbolo
   */
  async findBySymbol(symbol: string): Promise<Strategy[]> {
    return await table<Strategy>(this.tableName)
      .where('symbol', symbol)
      .orderBy('created_at', 'DESC')
      .get()
  }

  /**
   * Buscar estratégias por tipo
   */
  async findByType(type: string): Promise<Strategy[]> {
    return await table<Strategy>(this.tableName)
      .where('type', type)
      .orderBy('created_at', 'DESC')
      .get()
  }

  /**
   * Atualizar estratégia
   */
  async update(id: string, updates: Partial<Omit<Strategy, 'id' | 'created_at'>>): Promise<boolean> {
    const data: any = {
      ...updates,
      updated_at: Date.now()
    }

    // Se atualizar config, stringify
    if (data.config && typeof data.config === 'object') {
      data.config = JSON.stringify(data.config)
    }

    const rowsAffected = await table(this.tableName)
      .where('id', id)
      .update(data)

    return rowsAffected > 0
  }

  /**
   * Ativar/Desativar estratégia
   */
  async toggleActive(id: string): Promise<boolean> {
    const strategy = await this.findById(id)
    if (!strategy) return false

    const newStatus = strategy.is_active === 1 ? 0 : 1
    return await this.update(id, { is_active: newStatus })
  }

  /**
   * Ativar estratégia
   */
  async activate(id: string): Promise<boolean> {
    return await this.update(id, { is_active: 1 })
  }

  /**
   * Desativar estratégia
   */
  async deactivate(id: string): Promise<boolean> {
    return await this.update(id, { is_active: 0 })
  }

  /**
   * Deletar estratégia
   */
  async delete(id: string): Promise<boolean> {
    const rowsAffected = await table(this.tableName)
      .where('id', id)
      .delete()

    return rowsAffected > 0
  }

  /**
   * Deletar múltiplas estratégias
   */
  async deleteMany(ids: string[]): Promise<number> {
    return await table(this.tableName)
      .whereIn('id', ids)
      .delete()
  }

  /**
   * Deletar todas as estratégias de uma exchange
   */
  async deleteByExchange(exchangeId: string): Promise<number> {
    return await table(this.tableName)
      .where('exchange_id', exchangeId)
      .delete()
  }

  /**
   * Contar estratégias
   */
  async count(): Promise<number> {
    return await table(this.tableName).count()
  }

  /**
   * Contar estratégias ativas
   */
  async countActive(): Promise<number> {
    return await table(this.tableName)
      .where('is_active', 1)
      .count()
  }

  /**
   * Buscar estratégias com paginação
   */
  async paginate(page: number = 1, perPage: number = 20): Promise<{
    data: Strategy[]
    total: number
    page: number
    perPage: number
    totalPages: number
  }> {
    const offset = (page - 1) * perPage
    
    const [data, total] = await Promise.all([
      table<Strategy>(this.tableName)
        .orderBy('created_at', 'DESC')
        .limit(perPage)
        .offset(offset)
        .get(),
      this.count()
    ])

    return {
      data,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage)
    }
  }

  /**
   * Buscar estratégias com filtros avançados
   */
  async search(filters: {
    name?: string
    type?: string
    symbol?: string
    exchange_id?: string
    is_active?: boolean
  }): Promise<Strategy[]> {
    const query = table<Strategy>(this.tableName)

    if (filters.name) {
      query.whereLike('name', `%${filters.name}%`)
    }

    if (filters.type) {
      query.where('type', filters.type)
    }

    if (filters.symbol) {
      query.where('symbol', filters.symbol)
    }

    if (filters.exchange_id) {
      query.where('exchange_id', filters.exchange_id)
    }

    if (filters.is_active !== undefined) {
      query.where('is_active', filters.is_active ? 1 : 0)
    }

    return await query.orderBy('created_at', 'DESC').get()
  }

  /**
   * Limpar todas as estratégias
   */
  async clear(): Promise<void> {
    await sqliteDatabase.clearTable(this.tableName)
  }

  /**
   * Obter estatísticas
   */
  async getStats(): Promise<{
    total: number
    active: number
    inactive: number
    byType: Record<string, number>
    byExchange: Record<string, number>
  }> {
    const [total, active, allStrategies] = await Promise.all([
      this.count(),
      this.countActive(),
      this.findAll()
    ])

    // Agregar por tipo
    const byType: Record<string, number> = {}
    const byExchange: Record<string, number> = {}

    allStrategies.forEach(strategy => {
      byType[strategy.type] = (byType[strategy.type] || 0) + 1
      byExchange[strategy.exchange_id] = (byExchange[strategy.exchange_id] || 0) + 1
    })

    return {
      total,
      active,
      inactive: total - active,
      byType,
      byExchange
    }
  }

  /**
   * Parse config JSON
   */
  parseConfig(strategy: Strategy): StrategyConfig {
    try {
      return JSON.parse(strategy.config)
    } catch {
      return {}
    }
  }

  /**
   * Obter estratégia com config parseado
   */
  async findByIdWithConfig(id: string): Promise<(Strategy & { parsedConfig: StrategyConfig }) | null> {
    const strategy = await this.findById(id)
    if (!strategy) return null

    return {
      ...strategy,
      parsedConfig: this.parseConfig(strategy)
    }
  }
}

// Singleton instance
export const strategyService = new SQLiteStrategyService()
export const sqliteStrategyService = strategyService // Alias para compatibilidade
export default strategyService
