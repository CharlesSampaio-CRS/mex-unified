import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

/**
 * Strategy Model
 * Estratégias de trading automatizado
 */
export class Strategy extends Model {
  static table = 'strategies'

  @field('user_id') userId: string
  @field('name') name: string
  @field('description') description?: string
  @field('exchange_name') exchangeName: string
  @field('symbol') symbol: string
  @field('type') type: string // grid, dca, trailing_stop, etc
  @field('config') config: string // JSON stringified
  @field('is_active') isActive: boolean
  @field('profit_loss') profitLoss: number
  @field('trades_count') tradesCount: number
  @readonly @date('created_at') createdAt: Date
  @readonly @date('updated_at') updatedAt: Date
}
