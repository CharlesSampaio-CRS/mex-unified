export type NotificationType = 'success' | 'warning' | 'info' | 'error'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: Date
  read: boolean
  icon?: string
  source?: 'local' | 'backend' // Indica se é notificação local ou do backend
  data?: Record<string, any> // Dados adicionais do backend
}
