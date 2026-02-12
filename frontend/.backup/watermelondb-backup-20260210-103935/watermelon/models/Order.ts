import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

/**
 * Order Model
 * Ordens de trading do usuário
 */
export class Order extends Model {
  static table = 'orders'

  @field('user_id') userId: string
  @field('exchange_name') exchangeName: string
  @field('order_id') orderId: string
  @field('symbol') symbol: string
  @field('type') type: string // market, limit, stop
  @field('side') side: string // buy, sell
  @field('price') price: number
  @field('amount') amount: number
  @field('filled') filled: number
  @field('remaining') remaining: number
  @field('status') status: string // open, closed, canceled
  @date('timestamp') timestamp: Date
  @readonly @date('created_at') createdAt: Date
  @readonly @date('updated_at') updatedAt: Date
}
