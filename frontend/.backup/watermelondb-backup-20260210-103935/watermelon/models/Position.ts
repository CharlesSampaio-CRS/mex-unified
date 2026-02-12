import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

/**
 * Position Model
 * Posições abertas em futures
 */
export class Position extends Model {
  static table = 'positions'

  @field('user_id') userId: string
  @field('exchange_name') exchangeName: string
  @field('symbol') symbol: string
  @field('side') side: string // long, short
  @field('contracts') contracts: number
  @field('entry_price') entryPrice: number
  @field('mark_price') markPrice: number
  @field('liquidation_price') liquidationPrice?: number
  @field('unrealized_pnl') unrealizedPnl: number
  @field('leverage') leverage: number
  @date('timestamp') timestamp: Date
  @readonly @date('created_at') createdAt: Date
  @readonly @date('updated_at') updatedAt: Date
}
