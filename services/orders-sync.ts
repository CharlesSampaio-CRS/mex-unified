import { table } from '../lib/sqlite/query-builder'
import { decryptData } from '../lib/encryption'
import { apiService } from './api'

/**
 * Orders Sync Service - SQLite Version
 * 
 * Busca orders das exchanges conectadas (do SQLite local)
 * e envia para o trading-service processar
 */

interface UserExchange {
  id?: number
  user_id: string
  exchange_name: string
  exchange_type: string
  api_key_encrypted: string
  api_secret_encrypted: string
  api_passphrase_encrypted?: string
  is_active: boolean
  created_at?: string
}

export interface OrdersResponse {
  success: boolean
  orders: any[]
  count: number
}

class OrdersSyncService {
  /**
   * Busca orders de todas as exchanges conectadas
   */
  async fetchOrders(userId: string): Promise<OrdersResponse | null> {
    try {
      // 1. Buscar exchanges ativas do SQLite
      const exchanges = await table<UserExchange>('user_exchanges')
        .where('user_id', '=', userId)
        .where('is_active', '=', true)
        .get()

      if (exchanges.length === 0) {
        return {
          success: true,
          orders: [],
          count: 0
        }
      }

      // 2. Decriptar credenciais
      const exchangesData = await Promise.all(
        exchanges.map(async (ex) => {
          try {
            const apiKey = await decryptData(ex.api_key_encrypted, userId)
            const apiSecret = await decryptData(ex.api_secret_encrypted, userId)
            const passphrase = ex.api_passphrase_encrypted
              ? await decryptData(ex.api_passphrase_encrypted, userId)
              : undefined

            return {
              exchange_id: ex.id,
              ccxt_id: ex.exchange_type,
              name: ex.exchange_name,
              api_key: apiKey,
              api_secret: apiSecret,
              passphrase,
            }
          } catch (error) {
            console.error(`❌ Erro ao decriptar exchange ${ex.exchange_name}:`, error)
            return null
          }
        })
      )

      // Filtrar exchanges com erro
      const validExchanges = exchangesData.filter((ex) => ex !== null)

      if (validExchanges.length === 0) {
        console.error('❌ Nenhuma exchange válida após decriptação')
        return null
      }

      // 3. Enviar para o trading-service
      const response = await apiService.post<OrdersResponse>('/orders/fetch', {
        exchanges: validExchanges,
      })

      return response.data

    } catch (error: any) {
      console.error('❌ Erro ao buscar orders:', error)
      throw error
    }
  }
}

export const ordersSyncService = new OrdersSyncService()
