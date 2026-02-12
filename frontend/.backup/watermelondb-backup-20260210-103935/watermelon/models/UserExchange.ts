import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

/**
 * UserExchange Model
 * Representa uma exchange configurada pelo usuário
 */
export class UserExchange extends Model {
  static table = 'user_exchanges'

  @field('user_id') userId: string
  @field('exchange_type') exchangeType: string // CCXT ID: binance, bybit, okx, etc
  @field('exchange_name') exchangeName: string // Nome customizado pelo usuário
  @field('api_key_encrypted') apiKeyEncrypted: string
  @field('api_secret_encrypted') apiSecretEncrypted: string
  @field('api_passphrase_encrypted') apiPassphraseEncrypted?: string
  @field('is_active') isActive: boolean
  @date('last_sync_at') lastSyncAt?: Date
  @readonly @date('created_at') createdAt: Date
  @readonly @date('updated_at') updatedAt: Date
}
