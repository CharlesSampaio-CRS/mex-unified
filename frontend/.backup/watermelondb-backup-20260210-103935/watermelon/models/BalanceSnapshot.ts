import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

/**
 * BalanceSnapshot Model
 * Snapshot periódico do balanço total do usuário
 */
export class BalanceSnapshot extends Model {
  static table = 'balance_snapshots'

  @field('user_id') userId: string
  @field('total_usd') totalUsd: number
  @field('total_brl') totalBrl: number
  @field('timestamp') timestamp: number
  @readonly @date('created_at') createdAt: Date
}
