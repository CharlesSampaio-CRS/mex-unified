import { database, ensureDatabaseInitialized } from '../lib/watermelon/database'
import { Q } from '@nozbe/watermelondb'
import { decryptData } from '../lib/encryption'
import { apiService } from './api'

/**
 * Orders Sync Service
 * 
 * Busca orders das exchanges conectadas (do WatermelonDB local)
 * e envia para o trading-service processar
 */

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
      // 0. Garantir que o database está inicializado
      await ensureDatabaseInitialized()
      
      if (!database) {
        throw new Error('Database não inicializado')
      }

      // 1. Buscar exchanges do WatermelonDB
      const exchangesCollection = database.get('user_exchanges')
      
      if (!exchangesCollection) {
        throw new Error('Collection "user_exchanges" não encontrada')
      }
      
      const exchanges = await exchangesCollection
        .query(Q.where('user_id', userId))
        .fetch()

      if (exchanges.length === 0) {
        return {
          success: true,
          orders: [],
          count: 0
        }
      }

      // 2. Decriptar credenciais
      const exchangesData = await Promise.all(
        exchanges.map(async (ex: any) => {
          try {
            const apiKey = await decryptData(ex.apiKeyEncrypted, userId)
            const apiSecret = await decryptData(ex.apiSecretEncrypted, userId)
            const passphrase = ex.apiPassphraseEncrypted
              ? await decryptData(ex.apiPassphraseEncrypted, userId)
              : undefined

            return {
              exchange_id: ex.id,
              ccxt_id: ex.exchangeType,
              name: ex.exchangeName,
              api_key: apiKey,
              api_secret: apiSecret,
              passphrase,
            }
          } catch (error) {
            console.error(`❌ Erro ao decriptar exchange ${ex.exchangeName}:`, error)
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
