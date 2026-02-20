/**
 * Notification Service - AsyncStorage
 * 
 * Gerencia notificações locais do app
 * Todas as notificações armazenadas localmente no AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATIONS_STORAGE_KEY = '@cryptohub:notifications';

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  data: string | null
  is_read: number
  created_at: number
}

export interface NotificationData {
  type: 'order' | 'alert' | 'strategy' | 'balance' | 'system'
  title: string
  message: string
  data?: any
}

class AsyncStorageNotificationService {
  private async saveNotifications(notifications: Notification[]): Promise<void> {
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('[NotificationService] Error saving:', error);
    }
  }

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

    const notifications = await this.getAllNotifications();
    notifications.push(notification);
    await this.saveNotifications(notifications);
    
    return notification
  }

  async getAllNotifications(): Promise<Notification[]> {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      const notifications = stored ? JSON.parse(stored) : [];
      return notifications.sort((a: Notification, b: Notification) => b.created_at - a.created_at);
    } catch (error) {
      console.error('[NotificationService] Error loading:', error);
      return [];
    }
  }

  async getUnreadNotifications(): Promise<Notification[]> {
    const all = await this.getAllNotifications();
    return all.filter(n => n.is_read === 0);
  }

  async getNotificationsByType(type: string): Promise<Notification[]> {
    const all = await this.getAllNotifications();
    return all.filter(n => n.type === type);
  }

  async getNotificationById(id: string): Promise<Notification | null> {
    const all = await this.getAllNotifications();
    return all.find(n => n.id === id) || null;
  }

  async markAsRead(id: string): Promise<boolean> {
    const notifications = await this.getAllNotifications();
    const index = notifications.findIndex(n => n.id === id);
    
    if (index === -1) return false;
    
    notifications[index].is_read = 1;
    await this.saveNotifications(notifications);
    return true;
  }

  async markAsUnread(id: string): Promise<boolean> {
    const notifications = await this.getAllNotifications();
    const index = notifications.findIndex(n => n.id === id);
    
    if (index === -1) return false;
    
    notifications[index].is_read = 0;
    await this.saveNotifications(notifications);
    return true;
  }

  async markAllAsRead(): Promise<number> {
    const notifications = await this.getAllNotifications();
    let count = 0;
    
    notifications.forEach(n => {
      if (n.is_read === 0) {
        n.is_read = 1;
        count++;
      }
    });
    
    await this.saveNotifications(notifications);
    return count;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const notifications = await this.getAllNotifications();
    const filtered = notifications.filter(n => n.id !== id);
    
    if (filtered.length === notifications.length) return false;
    
    await this.saveNotifications(filtered);
    return true;
  }

  async deleteAllNotifications(): Promise<number> {
    const notifications = await this.getAllNotifications();
    const count = notifications.length;
    await this.saveNotifications([]);
    return count;
  }

  async deleteOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const notifications = await this.getAllNotifications();
    const filtered = notifications.filter(n => n.created_at >= cutoffDate);
    const deletedCount = notifications.length - filtered.length;
    
    await this.saveNotifications(filtered);
    return deletedCount;
  }

  async countUnread(): Promise<number> {
    const notifications = await this.getAllNotifications();
    return notifications.filter(n => n.is_read === 0).length;
  }

  async countAll(): Promise<number> {
    const notifications = await this.getAllNotifications();
    return notifications.length;
  }

  async paginate(page: number = 1, perPage: number = 20) {
    const all = await this.getAllNotifications();
    const total = all.length;
    const offset = (page - 1) * perPage;
    const data = all.slice(offset, offset + perPage);

    return {
      data,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage)
    }
  }

  parseData(notification: Notification): any {
    try {
      return notification.data ? JSON.parse(notification.data) : null
    } catch {
      return null
    }
  }

  async getStats() {
    const all = await this.getAllNotifications();
    const unread = all.filter(n => n.is_read === 0).length;

    const byType: Record<string, number> = {};
    all.forEach(notif => {
      byType[notif.type] = (byType[notif.type] || 0) + 1;
    });

    return {
      total: all.length,
      unread,
      byType
    }
  }
}

export const notificationService = new AsyncStorageNotificationService()
export default notificationService
