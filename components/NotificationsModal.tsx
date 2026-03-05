import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, FlatList } from "react-native"
import { useState, useMemo } from "react"
import { useTheme } from "../contexts/ThemeContext"
import { typography, fontWeights } from "../lib/typography"
import { useLanguage } from "../contexts/LanguageContext"
import { useNotifications } from "../contexts/NotificationsContext"
import { ConfirmModal } from "./ConfirmModal"
import { getNotificationCategory, getCategoryIcon, NOTIFICATION_CATEGORIES, NotificationCategory } from "../services/notify"

interface NotificationsModalProps {
  visible: boolean
  onClose: () => void
}

export function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
  const { colors } = useTheme()
  const { t, language } = useLanguage()
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    clearAll
  } = useNotifications()

  const [confirmDeleteAllVisible, setConfirmDeleteAllVisible] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('all')

  // Filtra notificações por categoria selecionada
  const filteredNotifications = useMemo(() => {
    if (selectedCategory === 'all') return notifications
    return notifications.filter(n => getNotificationCategory(n.data) === selectedCategory)
  }, [notifications, selectedCategory])

  // Contagem por categoria (para badges)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: notifications.length }
    notifications.forEach(n => {
      const cat = getNotificationCategory(n.data)
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [notifications])

  const categoryLabels: Record<string, string> = {
    all: 'Todas',
    order: '📊 Ordens',
    strategy: '🤖 Estratégias',
    alert: '🔔 Alertas',
    system: '⚙️ Sistema',
  }

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 1000 / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return t('notifications.now')
    if (minutes < 60) return `${minutes}m ${t('notifications.minutesAgo')}`
    if (hours < 24) return `${hours}h ${t('notifications.hoursAgo')}`
    if (days === 1) return t('notifications.yesterday')
    if (days < 7) return `${days}d ${t('notifications.daysAgo')}`
    const locale = language === 'pt-BR' ? 'pt-BR' : 'en-US'
    return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return '#10b981'
      case 'warning': return '#f59e0b'
      case 'error': return '#ef4444'
      case 'info': return '#3b82f6'
      default: return colors.textSecondary
    }
  }

  const getDefaultIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅'
      case 'warning': return '⚠️'
      case 'error': return '❌'
      case 'info': return 'ℹ️'
      default: return '🔔'
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSafeArea} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.cardBorder }]}>
              <View style={styles.headerTitleContainer}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.modalTitle, { color: colors.text }]}>{t('notifications.title')}</Text>
                {unreadCount > 0 && (
                  <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.unreadText, { color: colors.textSecondary }]}> 
                    {unreadCount} {t('notifications.unread')}
                  </Text>
                )}
              </View>
              <View style={styles.headerActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={markAllAsRead}>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.markAllButton}>{t('notifications.markAll')}</Text>
                  </TouchableOpacity>
                )}
                {notifications.length > 0 && (
                  <TouchableOpacity onPress={() => setConfirmDeleteAllVisible(true)}>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.markAllButton}>Limpar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={[styles.closeButtonText, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

          {/* Category Filter Tabs — horizontal carousel */}
          {notifications.length > 0 && (
            <View style={[styles.categoryTabs, { borderBottomColor: colors.cardBorder }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryTabsContent}
                keyboardShouldPersistTaps="handled"
              >
              {NOTIFICATION_CATEGORIES.map((cat) => {
                const count = categoryCounts[cat] || 0
                if (cat !== 'all' && count === 0) return null
                const isActive = selectedCategory === cat
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryTab,
                      {
                        backgroundColor: isActive ? `${colors.primary}15` : 'transparent',
                        borderColor: isActive ? colors.primary : colors.border,
                      }
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.categoryTabText,
                      { color: isActive ? colors.primary : colors.textSecondary }
                    ]}>
                      {categoryLabels[cat] || cat}
                    </Text>
                    {count > 0 && (
                      <View style={[
                        styles.categoryBadge,
                        { backgroundColor: isActive ? colors.primary : colors.border }
                      ]}>
                        <Text style={[
                          styles.categoryBadgeText,
                          { color: isActive ? '#fff' : colors.textSecondary }
                        ]}>
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
              </ScrollView>
            </View>
          )}

          {/* Notifications List */}
          <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
            {filteredNotifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>{selectedCategory === 'all' ? '🔔' : getCategoryIcon(selectedCategory)}</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {selectedCategory === 'all' ? t('notifications.empty') : `Nenhuma notificação de ${categoryLabels[selectedCategory] || selectedCategory}`}
                </Text>
                <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
                  {t('notifications.emptyMessage')}
                </Text>
              </View>
            ) : (
              filteredNotifications.map((notification) => (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationItem,
                    { 
                      backgroundColor: notification.read ? 'transparent' : colors.surface,
                      borderBottomColor: colors.cardBorder 
                    }
                  ]}
                  onPress={() => !notification.read && markAsRead(notification.id)}
                >
                  {/* Content */}
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text style={[
                        styles.notificationTitle, 
                        { color: colors.text },
                        !notification.read && styles.notificationTitleUnread
                      ]}>
                        {notification.title}
                      </Text>
                      {!notification.read && (
                        <View style={styles.unreadDot} />
                      )}
                    </View>
                    <Text style={[styles.notificationMessage, { color: colors.textSecondary }]}>
                      {notification.message}
                    </Text>
                    <View style={styles.notificationFooter}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.notificationTime, { color: colors.textSecondary }]}>
                          {formatTimestamp(notification.timestamp)}
                        </Text>
                        <View style={[styles.categoryTag, { backgroundColor: colors.surfaceSecondary || `${colors.textSecondary}10` }]}>
                          <Text style={[styles.categoryTagText, { color: colors.textSecondary }]}>
                            {categoryLabels[getNotificationCategory(notification.data)] || 'Sistema'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => deleteNotification(notification.id)}
                        style={styles.deleteButton}
                      >
                        <Text style={styles.deleteButtonText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          </View>
        </Pressable>
      </Pressable>

      {/* Modal de Confirmação para Limpar Todas */}
      <ConfirmModal
        visible={confirmDeleteAllVisible}
        onClose={() => setConfirmDeleteAllVisible(false)}
        onConfirm={async () => {
          await clearAll();
          setConfirmDeleteAllVisible(false);
        }}
        title={t('notifications.clearAll')}
        message={t('notifications.clearAllConfirm').replace('{count}', String(notifications.length))}
        confirmText={t('notifications.clearAllButton')}
        cancelText={t('common.cancel')}
        confirmColor="#ef4444"
        icon="🗑️"
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSafeArea: {
    width: '90%',
    maxHeight: '85%',
    height: '85%',
  },
  modalContent: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  modalTitle: {
    fontSize: typography.h4,
    fontWeight: fontWeights.medium,
    flexShrink: 1,
  },
  unreadText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
    marginTop: 2,
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  markAllButton: {
    color: "#3b82f6",
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
  },
  closeButton: {
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  closeButtonText: {
    fontSize: typography.h3,
    fontWeight: fontWeights.light,
  },
  notificationsList: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    gap: 0,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  notificationTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: fontWeights.medium,
    flex: 1,
  },
  notificationTitleUnread: {
    fontWeight: fontWeights.medium,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3b82f6",
  },
  notificationMessage: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.light,
    lineHeight: 18,
    marginBottom: 8,
  },
  notificationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notificationTime: {
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
    opacity: 0.6,
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: typography.body,
    opacity: 0.5,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: typography.emojiHuge,
    marginBottom: 16,
    opacity: 0.3,
  },
  emptyTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeights.light,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: typography.body,
    fontWeight: fontWeights.light,
    textAlign: "center",
    lineHeight: 20,
  },
  // Category filter tabs
  categoryTabs: {
    borderBottomWidth: 0.5,
  },
  categoryTabsContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  categoryTabText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },
  categoryBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 5,
  },
  categoryBadgeText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.semibold,
  },
  // Category tag on each notification
  categoryTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryTagText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
  },
})
