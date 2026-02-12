import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

/**
 * BalanceHistory Model
 * Histórico detalhado de balanços por exchange e symbol
 */
export class BalanceHistory extends Model {
  static table = 'balance_history'

  @field('user_id') userId: string
  @field('exchange_name') exchangeName: string
  @field('symbol') symbol: string
  @field('free') free: number
  @field('used') used: number
  @field('total') total: number
  @field('usd_value') usdValue: number
  @field('brl_value') brlValue: number
  @field('timestamp') timestamp: number
  @readonly @date('created_at') createdAt: Date
}
