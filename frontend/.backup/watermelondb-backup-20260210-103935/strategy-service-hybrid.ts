/**
 * Exemplo de uso do Hybrid Database
 * 
 * Este service funciona tanto no Expo Go (AsyncStorage) 
 * quanto no Dev Client/Web (WatermelonDB)
 */

import { hybridDatabase } from '@/lib/storage/hybrid-database'

interface Strategy {
  id: string
  name: string
  description: string
  isActive: boolean
  createdAt: number
}

class StrategyService {
  /**
   * Criar uma nova estratégia
   */
  async createStrategy(data: Omit<Strategy, 'id' | 'createdAt'>): Promise<Strategy> {
    const strategy: Strategy = {
      id: `strategy_${Date.now()}`,
      ...data,
      createdAt: Date.now()
    }

    return await hybridDatabase.save('strategies', strategy)
  }

  /**
   * Buscar todas as estratégias
   */
  async getAllStrategies(): Promise<Strategy[]> {
    return await hybridDatabase.findAll<Strategy>('strategies')
  }

  /**
   * Buscar estratégia por ID
   */
  async getStrategyById(id: string): Promise<Strategy | null> {
    return await hybridDatabase.findById<Strategy>('strategies', id)
  }

  /**
   * Buscar apenas estratégias ativas
   */
  async getActiveStrategies(): Promise<Strategy[]> {
    return await hybridDatabase.query<Strategy>('strategies', 
      (strategy) => strategy.isActive === true
    )
  }

  /**
   * Atualizar estratégia
   */
  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy | null> {
    return await hybridDatabase.update<Strategy>('strategies', id, updates)
  }

  /**
   * Deletar estratégia
   */
  async deleteStrategy(id: string): Promise<boolean> {
    return await hybridDatabase.delete('strategies', id)
  }

  /**
   * Ativar/Desativar estratégia
   */
  async toggleStrategy(id: string): Promise<Strategy | null> {
    const strategy = await this.getStrategyById(id)
    if (!strategy) return null

    return await this.updateStrategy(id, {
      isActive: !strategy.isActive
    })
  }

  /**
   * Limpar todas as estratégias
   */
  async clearAll(): Promise<void> {
    await hybridDatabase.clearCollection('strategies')
  }

  /**
   * Verificar qual adapter está sendo usado
   */
  getAdapterInfo(): { type: 'AsyncStorage' | 'WatermelonDB', isExpoGo: boolean } {
    return {
      type: hybridDatabase.getAdapterType(),
      isExpoGo: hybridDatabase.isUsingExpoGoMode()
    }
  }
}

export const strategyService = new StrategyService()
export default strategyService
