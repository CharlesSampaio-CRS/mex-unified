import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

/**
 * Notification Model
 * Notificações do usuário
 */
export class Notification extends Model {
  static table = 'notifications'

  @field('user_id') userId: string
  @field('title') title: string
  @field('message') message: string
  @field('type') type: string // info, success, warning, error
  @field('category') category?: string // order, balance, strategy, etc
  @field('is_read') isRead: boolean
  @field('data') data?: string // JSON metadata
  @readonly @date('created_at') createdAt: Date
}
