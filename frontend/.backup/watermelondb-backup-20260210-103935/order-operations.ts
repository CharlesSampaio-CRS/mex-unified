import { database, ensureDatabaseInitialized } from '../lib/watermelon/database'
import { decryptData } from '../lib/encryption'
import { apiService } from './api'
import { notificationService } from './notificationService'

/**
 * Order Operations Service
 * 
 * Gerencia operações de orders (criar, cancelar) usando credenciais
 * do WatermelonDB local e cria notificações automaticamente
 */

export interface CreateOrderRequest {
  userId: string
  exchangeId: string
  symbol: string
  type: 'market' | 'limit'
  side: 'buy' | 'sell'
  amount: number
  price?: number
}

export interface CancelOrderRequest {
  userId: string
  exchangeId: string
  orderId: string
  symbol?: string
}

/**
 * Busca e decripta credenciais de uma exchange
 */
async function getExchangeCredentials(exchangeId: string, userId: string) {
  await ensureDatabaseInitialized()
  
  if (!database) {
    throw new Error('Database não inicializado')
  }

  const exchangesCollection = database.get('user_exchanges')
  const exchange = await exchangesCollection.find(exchangeId)

  if (!exchange) {
    throw new Error(`Exchange ${exchangeId} não encontrada`)
  }

  // Decriptar credenciais
  const apiKey = await decryptData((exchange as any).apiKeyEncrypted, userId)
  const apiSecret = await decryptData((exchange as any).apiSecretEncrypted, userId)
  const passphrase = (exchange as any).apiPassphraseEncrypted
    ? await decryptData((exchange as any).apiPassphraseEncrypted, userId)
    : undefined

  return {
    ccxt_id: (exchange as any).exchangeType,
    exchange_name: (exchange as any).exchangeName,
    api_key: apiKey,
    api_secret: apiSecret,
    passphrase,
  }
}

class OrderOperationsService {
  /**
   * Cria uma ordem (buy ou sell)
   */
  async createOrder(request: CreateOrderRequest): Promise<any> {
    try {
      // 1. Buscar e decriptar credenciais
      const credentials = await getExchangeCredentials(request.exchangeId, request.userId)

      // 2. Enviar para o backend
      const response = await apiService.post('/orders/create-with-creds', {
        ...credentials,
        symbol: request.symbol,
        type: request.type,
        side: request.side,
        amount: request.amount,
        price: request.price,
      })

      const result = response.data
      
      // 3. Criar notificação automaticamente se sucesso
      if (result.success) {
        const isBuy = request.side === 'buy'
        const orderStatus = result.order?.status || 'open'
        const isExecuted = orderStatus === 'closed' || orderStatus === 'filled'
        
        let title = '✅ Ordem Criada'
        let icon = isBuy ? '🟢' : '🔴'
        
        if (isExecuted) {
          title = '🎉 Ordem Executada!'
          icon = '🎉'
        } else if (request.type === 'limit') {
          title = '⏳ Ordem Limite Criada'
        }
        
        await notificationService.createNotification(
          request.userId,
          'success',
          title,
          `Ordem ${isBuy ? 'de compra' : 'de venda'} de ${request.amount} ${request.symbol.replace('/USDT', '').replace('/USDC', '')}`,
          {
            icon,
            orderId: result.order?.id || result.order_id,
            exchangeId: request.exchangeId,
            exchangeName: credentials.exchange_name,
            symbol: request.symbol,
            side: request.side,
            type: request.type,
            amount: request.amount,
            price: request.price,
            status: orderStatus,
            action: 'create',
            timestamp: new Date().toISOString()
          },
          'order'
        )
        
        console.log('✅ [OrderOperations] Ordem criada e notificação gerada')
      }

      return result
    } catch (error: any) {
      console.error('❌ Erro ao criar order:', error)
      throw error
    }
  }

  /**
   * Cria uma ordem de compra
   */
  async createBuyOrder(
    userId: string,
    exchangeId: string,
    symbol: string,
    amount: number,
    type: 'market' | 'limit',
    price?: number
  ): Promise<any> {
    return this.createOrder({
      userId,
      exchangeId,
      symbol,
      type,
      side: 'buy',
      amount,
      price,
    })
  }

  /**
   * Cria uma ordem de venda
   */
  async createSellOrder(
    userId: string,
    exchangeId: string,
    symbol: string,
    amount: number,
    type: 'market' | 'limit',
    price?: number
  ): Promise<any> {
    return this.createOrder({
      userId,
      exchangeId,
      symbol,
      type,
      side: 'sell',
      amount,
      price,
    })
  }

  /**
   * Cancela uma ordem
   */
  async cancelOrder(request: CancelOrderRequest): Promise<any> {
    try {
      // 1. Buscar e decriptar credenciais
      const credentials = await getExchangeCredentials(request.exchangeId, request.userId)

      // 2. Enviar para o backend
      const response = await apiService.post('/orders/cancel-with-creds', {
        ...credentials,
        order_id: request.orderId,
        symbol: request.symbol,
      })

      const result = response.data
      
      // 3. Criar notificação automaticamente se sucesso
      const isSuccess = result.success === true || (!result.error && !result.success)
      
      if (isSuccess) {
        const symbol = request.symbol || 'N/A'
        
        await notificationService.createNotification(
          request.userId,
          'info',
          'Ordem Cancelada',
          `Ordem ${symbol.replace('/USDT', '').replace('/USDC', '')} foi cancelada com sucesso`,
          {
            orderId: request.orderId,
            exchangeId: request.exchangeId,
            exchangeName: credentials.exchange_name,
            symbol: request.symbol,
            action: 'cancel',
            timestamp: new Date().toISOString()
          },
          'order'
        )
        
      }

      return result
    } catch (error: any) {
      console.error('❌ Erro ao cancelar order:', error)
      throw error
    }
  }
}

export const orderOperationsService = new OrderOperationsService()
