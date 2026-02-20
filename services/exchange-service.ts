/**
 * Exchange Service - MongoDB via API Backend
 * 
 * ✅ Dados vêm do MongoDB via API Backend
 * ❌ Sem cache local
 * ❌ Sem fallback offline
 */

import { apiService } from './api'

export interface UserExchange {
  id: string
  user_id: string
  exchange_type: string // CCXT ID: binance, bybit, mexc, etc (lowercase)
  exchange_name: string // Nome customizado pelo usuário
  api_key_encrypted: string
  api_secret_encrypted: string
  api_passphrase_encrypted: string | null
  is_active: number // INTEGER para boolean
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

class ExchangeService {
  /**
   * 🧮 Calcula contadores de exchanges (conectadas e disponíveis)
   * Lógica: Total catálogo - Conectadas = Disponíveis
   * Retorna: { connected, available, total }
   */
  async getExchangesCounts(userId: string): Promise<{
    connected: number
    available: number
    total: number
  }> {
    try {
      // 1. Busca catálogo completo de exchanges (collection "exchanges")
      const catalogResponse = await apiService.getAvailableExchanges(userId)
      const totalCatalog = catalogResponse?.success && catalogResponse?.exchanges
        ? catalogResponse.exchanges.length
        : 0
      
      // 2. Busca exchanges conectadas pelo usuário (collection "user_exchanges")
      // Usa listExchanges() que chama GET /user/exchanges com JWT auth
      const linkedResponse = await apiService.listExchanges()
      const connectedCount = linkedResponse?.success && linkedResponse?.exchanges 
        ? linkedResponse.exchanges.length 
        : 0
      
      // 3. Calcula disponíveis para conectar: Total - Conectadas
      const availableCount = Math.max(0, totalCatalog - connectedCount)
      
      console.log('🔍 [ExchangeService] Contadores:', {
        total: totalCatalog,
        connected: connectedCount,
        available: availableCount,
        formula: `${totalCatalog} - ${connectedCount} = ${availableCount}`
      })
      
      return {
        connected: connectedCount,
        available: availableCount,
        total: totalCatalog
      }
    } catch (error) {
      console.error('❌ [ExchangeService] Erro ao calcular contadores:', error)
      return {
        connected: 0,
        available: 0,
        total: 0
      }
    }
  }

  /**
   * @deprecated Use getExchangesCounts() instead
   * Conta exchanges conectadas
   */
  async countExchanges(userId: string): Promise<number> {
    const counts = await this.getExchangesCounts(userId)
    return counts.connected
  }

  /**
   * Conta exchanges ativas
   */
  async countActiveExchanges(userId: string): Promise<number> {
    try {
      const response = await apiService.listExchanges()
      
      if (!response.success || !response.exchanges) {
        return 0
      }
      
      const activeCount = response.exchanges.filter(ex => ex.is_active).length
      return activeCount
    } catch (error) {
      console.error('❌ [ExchangeService] Erro ao contar exchanges ativas:', error)
      return 0
    }
  }
}

// Singleton instance
export const exchangeService = new ExchangeService()
export default exchangeService
