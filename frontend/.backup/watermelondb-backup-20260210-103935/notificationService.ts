/**
 * Notification Service - Zero Database Architecture
 * All notifications stored locally in WatermelonDB
 * No backend sync - completely offline
 */

import { Q } from '@nozbe/watermelondb'
import { database } from '../lib/watermelon/database'
import { Notification } from '../lib/watermelon/models/Notification'

export interface LocalNotification {
  id: string
  userId: string
  title: string
  message: string
  type: 'success' | 'warning' | 'info' | 'error'
  category?: string
  isRead: boolean
  data?: Record<string, any>
  createdAt: Date
}

class NotificationService {
  /**
   * Get user notifications from local database
   */
  async getNotifications(
    userId: string,
    unreadOnly: boolean = false,
    limit: number = 50
  ): Promise<LocalNotification[]> {
    try {
      const collection = database.get<Notification>('notifications')
      
      let query = collection
        .query(Q.where('user_id', userId))
        .extend(Q.sortBy('created_at', Q.desc))
        .extend(Q.take(limit))
      
      if (unreadOnly) {
        query = collection
          .query(
            Q.where('user_id', userId),
            Q.where('is_read', false)
          )
          .extend(Q.sortBy('created_at', Q.desc))
          .extend(Q.take(limit))
      }
      
      const notifications = await query.fetch()
      
      return notifications.map(n => ({
        id: n.id,
        userId: n.userId,
        title: n.title,
        message: n.message,
        type: n.type as 'success' | 'warning' | 'info' | 'error',
        category: n.category,
        isRead: n.isRead,
        data: n.data ? JSON.parse(n.data) : undefined,
        createdAt: n.createdAt
      }))
    } catch (error) {
      console.error('Error fetching notifications:', error)
      return []
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const collection = database.get<Notification>('notifications')
      const count = await collection
        .query(
          Q.where('user_id', userId),
          Q.where('is_read', false)
        )
        .fetchCount()
      
      return count
    } catch (error) {
      console.error('Error getting unread count:', error)
      return 0
    }
  }

  /**
   * Observe notifications in real-time (WatermelonDB observer)
   * Returns subscription that can be unsubscribed
   */
  observeNotifications(
    userId: string,
    callback: (notifications: LocalNotification[]) => void
  ) {
    try {
      const collection = database.get<Notification>('notifications')
      
      const observable = collection
        .query(
          Q.where('user_id', userId),
          Q.sortBy('created_at', Q.desc),
          Q.take(50)
        )
        .observe()
      
      const subscription = observable.subscribe(notifications => {
        const converted = notifications.map(n => ({
          id: n.id,
          userId: n.userId,
          title: n.title,
          message: n.message,
          type: n.type as 'success' | 'warning' | 'info' | 'error',
          category: n.category,
          isRead: n.isRead,
          data: n.data ? JSON.parse(n.data) : undefined,
          createdAt: n.createdAt
        }))
        
        callback(converted)
      })
      
      return subscription
    } catch (error) {
      console.error('Error observing notifications:', error)
      return { unsubscribe: () => {} }
    }
  }

  /**
   * Create notification in local database
   */
  async createNotification(
    userId: string,
    type: 'success' | 'warning' | 'info' | 'error',
    title: string,
    message: string,
    data?: Record<string, any>,
    category?: string
  ): Promise<LocalNotification | null> {
    try {
      const collection = database.get<Notification>('notifications')
      
      const notification = await database.write(async () => {
        return await collection.create(record => {
          record.userId = userId
          record.title = title
          record.message = message
          record.type = type
          record.category = category || ''
          record.isRead = false
          record.data = data ? JSON.stringify(data) : ''
        })
      })

      return {
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type as 'success' | 'warning' | 'info' | 'error',
        category: notification.category,
        isRead: notification.isRead,
        data: notification.data ? JSON.parse(notification.data) : undefined,
        createdAt: notification.createdAt
      }
    } catch (error) {
      console.error('Error creating notification:', error)
      return null
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const collection = database.get<Notification>('notifications')
      const notification = await collection.find(notificationId)
      
      await database.write(async () => {
        await notification.update(record => {
          record.isRead = true
        })
      })
      
      return true
    } catch (error) {
      console.error('Error marking notification as read:', error)
      return false
    }
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const collection = database.get<Notification>('notifications')
      const unreadNotifications = await collection
        .query(
          Q.where('user_id', userId),
          Q.where('is_read', false)
        )
        .fetch()
      
      await database.write(async () => {
        const promises = unreadNotifications.map(notification =>
          notification.update(record => {
            record.isRead = true
          })
        )
        await Promise.all(promises)
      })
      
      return true
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      return false
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const collection = database.get<Notification>('notifications')
      
      // Try to find the notification first
      const notification = await collection.find(notificationId).catch(() => null)
      
      if (!notification) {
        console.warn(`Notification ${notificationId} not found in database, assuming already deleted`)
        return true // Return true since the end result is the same - notification doesn't exist
      }
      
      await database.write(async () => {
        await notification.destroyPermanently()
      })
      
      return true
    } catch (error) {
      console.error('Error deleting notification:', error)
      return false
    }
  }

  /**
   * Delete all notifications for user
   */
  async deleteAll(userId: string): Promise<boolean> {
    try {
      const collection = database.get<Notification>('notifications')
      const notifications = await collection
        .query(Q.where('user_id', userId))
        .fetch()
      
      await database.write(async () => {
        const promises = notifications.map(notification =>
          notification.destroyPermanently()
        )
        await Promise.all(promises)
      })
      
      return true
    } catch (error) {
      console.error('Error deleting all notifications:', error)
      return false
    }
  }

  /**
   * Delete old read notifications (cleanup)
   * Keeps last 30 days of read notifications
   */
  async cleanupOldNotifications(userId: string, daysToKeep: number = 30): Promise<number> {
    try {
      const collection = database.get<Notification>('notifications')
      const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
      
      const oldNotifications = await collection
        .query(
          Q.where('user_id', userId),
          Q.where('is_read', true),
          Q.where('created_at', Q.lt(cutoffDate))
        )
        .fetch()
      
      if (oldNotifications.length === 0) {
        return 0
      }
      
      await database.write(async () => {
        const promises = oldNotifications.map(notification =>
          notification.destroyPermanently()
        )
        await Promise.all(promises)
      })
      
      return oldNotifications.length
    } catch (error) {
      console.error('Error cleaning up old notifications:', error)
      return 0
    }
  }
}

export const notificationService = new NotificationService()

