import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { Notification, NotificationType } from '../types/notifications'
import { notificationService, Notification as DBNotification } from '../services/notificationService'
import { useAuth } from './AuthContext'

interface NotificationsContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'source'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  deleteNotification: (id: string) => void
  clearAll: () => void
  isLoading: boolean
  refreshNotifications: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()

  // Helper to convert local notification to frontend format
  const convertLocalNotification = (localNotif: DBNotification): Notification => {
    let parsedData = undefined
    try {
      parsedData = localNotif.data ? JSON.parse(localNotif.data) : undefined
    } catch {
      parsedData = undefined
    }

    return {
      id: localNotif.id,
      type: localNotif.type as NotificationType,
      title: localNotif.title,
      message: localNotif.message,
      timestamp: new Date(localNotif.created_at),
      read: localNotif.is_read === 1,
      source: 'local',
      data: parsedData
    }
  }

  // Load notifications from local database
  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      // Get all notifications from SQLite (no user filtering needed since it's local)
      const localNotifications = await notificationService.getAllNotifications()
      const converted = localNotifications.map(convertLocalNotification)
      
      setNotifications(converted)
    } catch (error) {
      console.error('❌ [NotificationsContext] Erro ao carregar notificações:', error)
      setNotifications([])
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  // Load notifications on mount and when user changes
  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // ❌ REMOVIDO: Observer WatermelonDB não existe mais no SQLite
  // O SQLite não fornece observables em tempo real como o WatermelonDB
  // As notificações são recarregadas manualmente quando necessárias

  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read).length, 
    [notifications]
  )

  const addNotification = useCallback(async (notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'source'>) => {
    if (!user?.id) {
      return
    }

    try {
      // Create notification in local database
      const created = await notificationService.createNotification({
        type: notification.type as 'order' | 'alert' | 'strategy' | 'balance' | 'system',
        title: notification.title,
        message: notification.message,
        data: notification.data
      })

      if (created) {
        // Add to local state immediately
        const newNotification: Notification = {
          id: created.id,
          type: created.type as NotificationType,
          title: created.title,
          message: created.message,
          timestamp: new Date(created.created_at),
          read: created.is_read === 1,
          source: 'local',
          icon: notification.icon,
          data: created.data ? JSON.parse(created.data) : undefined
        }
        
        setNotifications(prev => [newNotification, ...prev])
      }
    } catch (error) {
      console.error('❌ [NotificationsContext] Erro ao criar notificação:', error)
    }
  }, [user?.id])

  const markAsRead = useCallback(async (id: string) => {
    if (!user?.id) {
      return
    }

    try {
      // Mark as read in local database
      const success = await notificationService.markAsRead(id)
      
      if (success) {
        // Update local state
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === id ? { ...notif, read: true } : notif
          )
        )
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [user?.id])

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) {
      return
    }

    try {
      // Mark all in local database
      const affectedRows = await notificationService.markAllAsRead()
      
      if (affectedRows > 0) {
        // Update local state
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, read: true }))
        )
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }, [user?.id])

  const deleteNotification = useCallback(async (id: string) => {
    if (!user?.id || !id || id === 'undefined') {
      console.error('Invalid notification ID:', id)
      return
    }

    try {
      // Update UI immediately (optimistic update)
      setNotifications(prev => prev.filter(notif => notif.id !== id))
      
      // Delete from local database
      const success = await notificationService.deleteNotification(id)
      
      if (!success) {
        // If deletion failed, we might need to refetch
        console.warn('Notification deletion returned false, but UI was already updated')
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
      // Refetch to ensure consistency
      await loadNotifications()
    }
  }, [user?.id, loadNotifications])

  const clearAll = useCallback(async () => {
    if (!user?.id) {
      return
    }

    try {
      // Delete all from local database
      const affectedRows = await notificationService.deleteAllNotifications()
      
      if (affectedRows > 0) {
        // Clear local state
        setNotifications([])
      }
    } catch (error) {
      console.error('❌ [NotificationsContext] Erro ao limpar notificações:', error)
    }
  }, [user?.id])

  const refreshNotifications = useCallback(async () => {
    await loadNotifications()
  }, [loadNotifications])

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    isLoading,
    refreshNotifications
  }), [notifications, unreadCount, addNotification, markAsRead, markAllAsRead, deleteNotification, clearAll, isLoading, refreshNotifications])

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
}
