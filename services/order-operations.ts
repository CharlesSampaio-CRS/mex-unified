import { table } from '../lib/sqlite/query-builder'
import { decryptData } from '../lib/encryption'
import { apiService } from './api'
import { notificationService } from './notificationService'

/**
 * Order Operations Service - SQLite Version
 * 
 * Gerencia operações de orders (criar, cancelar) usando credenciais
 * do SQLite local e cria notificações automaticamente
 */

interface UserExchange {
  id?: string
  user_id: string
  exchange_name: string
  exchange_type: string
  api_key_encrypted: string
  api_secret_encrypted: string
  api_passphrase_encrypted?: string
  is_active: boolean
  created_at?: string
}

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
  let exchange = await table<UserExchange>('user_exchanges')
    .where('id', '=', exchangeId)
    .first()

  if (!exchange) {
    exchange = await table<UserExchange>('user_exchanges')
      .where('exchange_type', '=', exchangeId)
      .first()
  }

  if (!exchange) {
    exchange = await table<UserExchange>('user_exchanges')
      .where('exchange_name', '=', exchangeId)
      .first()
  }

  if (!exchange) {
    throw new Error(`Exchange ${exchangeId} não encontrada`)
  }

  // Decriptar credenciais
  const apiKey = await decryptData(exchange.api_key_encrypted, userId)
  const apiSecret = await decryptData(exchange.api_secret_encrypted, userId)
  const passphrase = exchange.api_passphrase_encrypted
    ? await decryptData(exchange.api_passphrase_encrypted, userId)
    : undefined

  return {
    ccxt_id: exchange.exchange_type,
    exchange_name: exchange.exchange_name,
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
        
        await notificationService.createNotification({
          type: 'order',
          title,
          message: `Ordem ${isBuy ? 'de compra' : 'de venda'} de ${request.amount} ${request.symbol.replace('/USDT', '').replace('/USDC', '')}`,
          data: {
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
          }
        })
        
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
        
        await notificationService.createNotification({
          type: 'order',
          title: 'Ordem Cancelada',
          message: `Ordem ${symbol.replace('/USDT', '').replace('/USDC', '')} foi cancelada com sucesso`,
          data: {
            orderId: request.orderId,
            exchangeId: request.exchangeId,
            exchangeName: credentials.exchange_name,
            symbol: request.symbol,
            action: 'cancel',
            timestamp: new Date().toISOString()
          }
        })
        
      }

      return result
    } catch (error: any) {
      console.error('❌ Erro ao cancelar order:', error)
      throw error
    }
  }
}

export const orderOperationsService = new OrderOperationsService()
