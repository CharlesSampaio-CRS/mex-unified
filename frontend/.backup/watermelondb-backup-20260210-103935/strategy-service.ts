import database from '../lib/watermelon/database'
import { Q } from '@nozbe/watermelondb'
import { Strategy } from '../lib/watermelon/models/Strategy'

/**
 * Strategy Service - Local
 * 
 * CRUD de estratégias 100% no WatermelonDB local
 * Operações: Create, Read, Delete (sem Update conforme solicitado)
 */

export interface StrategyData {
  userId: string
  name: string
  description?: string
  exchangeName: string
  symbol: string
  type: string // 'grid', 'dca', 'trailing_stop', etc
  config: any // JSON config
  isActive?: boolean
}

export interface StrategyFilter {
  userId: string
  exchangeName?: string
  symbol?: string
  type?: string
  isActive?: boolean
}

class StrategyService {
  /**
   * Cria uma nova estratégia
   */
  async createStrategy(data: StrategyData): Promise<Strategy> {
    const collection = database.get<Strategy>('strategies')
    
    return await database.write(async () => {
      return await collection.create(strategy => {
        strategy.userId = data.userId
        strategy.name = data.name
        strategy.description = data.description || undefined
        strategy.exchangeName = data.exchangeName
        strategy.symbol = data.symbol
        strategy.type = data.type
        strategy.config = typeof data.config === 'string' 
          ? data.config 
          : JSON.stringify(data.config)
        strategy.isActive = data.isActive ?? true
        strategy.profitLoss = 0
        strategy.tradesCount = 0
      })
    })
  }

  /**
   * Busca todas as estratégias do usuário
   */
  async getAllStrategies(userId: string): Promise<Strategy[]> {
    const collection = database.get<Strategy>('strategies')
    
    return await collection
      .query(
        Q.where('user_id', userId),
        Q.sortBy('created_at', Q.desc)
      )
      .fetch()
  }

  /**
   * Busca estratégias com filtros
   */
  async getStrategiesFiltered(filter: StrategyFilter): Promise<Strategy[]> {
    const collection = database.get<Strategy>('strategies')
    
    const conditions: any[] = [
      Q.where('user_id', filter.userId)
    ]
    
    if (filter.exchangeName) {
      conditions.push(Q.where('exchange_name', filter.exchangeName))
    }
    
    if (filter.symbol) {
      conditions.push(Q.where('symbol', filter.symbol))
    }
    
    if (filter.type) {
      conditions.push(Q.where('type', filter.type))
    }
    
    if (filter.isActive !== undefined) {
      conditions.push(Q.where('is_active', filter.isActive))
    }
    
    return await collection
      .query(
        ...conditions,
        Q.sortBy('created_at', Q.desc)
      )
      .fetch()
  }

  /**
   * Busca estratégias ativas
   */
  async getActiveStrategies(userId: string): Promise<Strategy[]> {
    return this.getStrategiesFiltered({ userId, isActive: true })
  }

  /**
   * Busca estratégias inativas
   */
  async getInactiveStrategies(userId: string): Promise<Strategy[]> {
    return this.getStrategiesFiltered({ userId, isActive: false })
  }

  /**
   * Busca uma estratégia por ID
   */
  async getStrategyById(id: string): Promise<Strategy | null> {
    try {
      const collection = database.get<Strategy>('strategies')
      return await collection.find(id)
    } catch {
      return null
    }
  }

  /**
   * Ativa uma estratégia
   */
  async activateStrategy(id: string): Promise<void> {
    const strategy = await this.getStrategyById(id)
    
    if (!strategy) {
      throw new Error('Estratégia não encontrada')
    }
    
    await database.write(async () => {
      await strategy.update(s => {
        s.isActive = true
      })
    })
  }

  /**
   * Desativa uma estratégia
   */
  async deactivateStrategy(id: string): Promise<void> {
    const strategy = await this.getStrategyById(id)
    
    if (!strategy) {
      throw new Error('Estratégia não encontrada')
    }
    
    await database.write(async () => {
      await strategy.update(s => {
        s.isActive = false
      })
    })
  }

  /**
   * Deleta uma estratégia permanentemente
   */
  async deleteStrategy(id: string): Promise<void> {
    const strategy = await this.getStrategyById(id)
    
    if (!strategy) {
      throw new Error('Estratégia não encontrada')
    }
    
    await database.write(async () => {
      await strategy.destroyPermanently()
    })
  }

  /**
   * Atualiza estatísticas da estratégia (profit/loss, trades)
   */
  async updateStrategyStats(
    id: string,
    profitLoss: number,
    tradesCount: number
  ): Promise<void> {
    const strategy = await this.getStrategyById(id)
    
    if (!strategy) {
      throw new Error('Estratégia não encontrada')
    }
    
    await database.write(async () => {
      await strategy.update(s => {
        s.profitLoss = profitLoss
        s.tradesCount = tradesCount
      })
    })
  }

  /**
   * Conta estratégias do usuário
   */
  async getStrategyCount(userId: string): Promise<number> {
    const collection = database.get<Strategy>('strategies')
    
    return await collection
      .query(Q.where('user_id', userId))
      .fetchCount()
  }

  /**
   * Busca estratégias por tipo
   */
  async getStrategiesByType(userId: string, type: string): Promise<Strategy[]> {
    return this.getStrategiesFiltered({ userId, type })
  }

  /**
   * Busca estratégias por exchange
   */
  async getStrategiesByExchange(userId: string, exchangeName: string): Promise<Strategy[]> {
    return this.getStrategiesFiltered({ userId, exchangeName })
  }

  /**
   * Busca estratégias por symbol
   */
  async getStrategiesBySymbol(userId: string, symbol: string): Promise<Strategy[]> {
    return this.getStrategiesFiltered({ userId, symbol })
  }
}

export const strategyService = new StrategyService()
