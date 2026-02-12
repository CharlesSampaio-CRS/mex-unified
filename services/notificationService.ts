/**
 * Notification Service - SQLite
 * 
 * Gerencia notificações locais do app
 * Todas as notificações armazenadas localmente no SQLite
 */

import { table } from '@/lib/sqlite/query-builder'
import { sqliteDatabase } from '@/lib/sqlite/database'

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  data: string | null // JSON stringificado
  is_read: number // SQLite usa INTEGER para boolean
  created_at: number
}

export interface NotificationData {
  type: 'order' | 'alert' | 'strategy' | 'balance' | 'system'
  title: string
  message: string
  data?: any
}

class SQLiteNotificationService {
  private tableName = 'notifications'

  /**
   * Criar notificação
   */
  async createNotification(data: NotificationData): Promise<Notification> {
    const now = Date.now()
    const id = `notif_${now}_${Math.random().toString(36).substr(2, 9)}`

    const notification: Notification = {
      id,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data ? JSON.stringify(data.data) : null,
      is_read: 0,
      created_at: now
    }

    await table(this.tableName).insert(notification)
    return notification
  }

  /**
   * Buscar todas as notificações
   */
  async getAllNotifications(): Promise<Notification[]> {
    return await table<Notification>(this.tableName)
      .orderBy('created_at', 'DESC')
      .get()
  }

  /**
   * Buscar notificações não lidas
   */
  async getUnreadNotifications(): Promise<Notification[]> {
    return await table<Notification>(this.tableName)
      .where('is_read', 0)
      .orderBy('created_at', 'DESC')
      .get()
  }

  /**
   * Buscar notificações por tipo
   */
  async getNotificationsByType(type: string): Promise<Notification[]> {
    return await table<Notification>(this.tableName)
      .where('type', type)
      .orderBy('created_at', 'DESC')
      .get()
  }

  /**
   * Buscar notificação por ID
   */
  async getNotificationById(id: string): Promise<Notification | null> {
    return await table<Notification>(this.tableName)
      .where('id', id)
      .first()
  }

  /**
   * Marcar como lida
   */
  async markAsRead(id: string): Promise<boolean> {
    const rowsAffected = await table(this.tableName)
      .where('id', id)
      .update({ is_read: 1 })

    return rowsAffected > 0
  }

  /**
   * Marcar como não lida
   */
  async markAsUnread(id: string): Promise<boolean> {
    const rowsAffected = await table(this.tableName)
      .where('id', id)
      .update({ is_read: 0 })

    return rowsAffected > 0
  }

  /**
   * Marcar todas como lidas
   */
  async markAllAsRead(): Promise<number> {
    return await table(this.tableName)
      .where('is_read', 0)
      .update({ is_read: 1 })
  }

  /**
   * Deletar notificação
   */
  async deleteNotification(id: string): Promise<boolean> {
    const rowsAffected = await table(this.tableName)
      .where('id', id)
      .delete()

    return rowsAffected > 0
  }

  /**
   * Deletar todas as notificações
   */
  async deleteAllNotifications(): Promise<number> {
    return await table(this.tableName).delete()
  }

  /**
   * Deletar notificações antigas (mais de X dias)
   */
  async deleteOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000)
    
    return await table(this.tableName)
      .where('created_at', '<', cutoffDate)
      .delete()
  }

  /**
   * Contar notificações não lidas
   */
  async countUnread(): Promise<number> {
    return await table(this.tableName)
      .where('is_read', 0)
      .count()
  }

  /**
   * Contar todas as notificações
   */
  async countAll(): Promise<number> {
    return await table(this.tableName).count()
  }

  /**
   * Buscar notificações com paginação
   */
  async paginate(page: number = 1, perPage: number = 20): Promise<{
    data: Notification[]
    total: number
    page: number
    perPage: number
    totalPages: number
  }> {
    const offset = (page - 1) * perPage
    
    const [data, total] = await Promise.all([
      table<Notification>(this.tableName)
        .orderBy('created_at', 'DESC')
        .limit(perPage)
        .offset(offset)
        .get(),
      this.countAll()
    ])

    return {
      data,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage)
    }
  }

  /**
   * Parse data JSON
   */
  parseData(notification: Notification): any {
    try {
      return notification.data ? JSON.parse(notification.data) : null
    } catch {
      return null
    }
  }

  /**
   * Obter estatísticas
   */
  async getStats(): Promise<{
    total: number
    unread: number
    byType: Record<string, number>
  }> {
    const [total, unread, allNotifications] = await Promise.all([
      this.countAll(),
      this.countUnread(),
      this.getAllNotifications()
    ])

    const byType: Record<string, number> = {}
    allNotifications.forEach(notif => {
      byType[notif.type] = (byType[notif.type] || 0) + 1
    })

    return {
      total,
      unread,
      byType
    }
  }
}

// Singleton instance
export const notificationService = new SQLiteNotificationService()
export const sqliteNotificationService = notificationService // Alias
export default notificationService
