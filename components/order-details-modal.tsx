import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from "react-native"
import { useTheme } from "../contexts/ThemeContext"
import { useLanguage } from "../contexts/LanguageContext"
import { typography, fontWeights } from "../lib/typography"
import { OpenOrder, getOrderId } from "../types/orders"

interface OrderDetailsModalProps {
  visible: boolean
  onClose: () => void
  order: OpenOrder | null
}

export function OrderDetailsModal({ visible, onClose, order }: OrderDetailsModalProps) {
  const { colors } = useTheme()
  const { t } = useLanguage()

  if (!order) return null

  const getOrderTypeColor = (type: string) => {
    switch (type) {
      case 'limit': return '#3b82f6'
      case 'market': return '#10b981'
      case 'stop_loss': return '#ef4444'
      case 'stop_loss_limit': return '#f59e0b'
      default: return colors.textSecondary
    }
  }

  const getSideColor = (side: string) => {
    return side === 'buy' ? '#10b981' : '#ef4444'
  }

  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case 'limit': return t('orders.type.limit')
      case 'market': return t('orders.type.market')
      case 'stop_loss': return t('orders.type.stopLoss')
      default: return type.toUpperCase()
    }
  }

  const getSideLabel = (side: string) => {
    return side === 'buy' ? t('orders.side.buy') : t('orders.side.sell')
  }

  const formatValue = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`
    if (value >= 1) return `$${value.toFixed(2)}`
    return `$${value.toFixed(8).replace(/\.?0+$/, '')}`
  }

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`
    if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`
    if (amount >= 1) return amount.toFixed(2)
    return amount.toFixed(8).replace(/\.?0+$/, '')
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const progressPercent = (order.amount && order.amount > 0) 
    ? ((order.filled || 0) / order.amount) * 100 
    : 0

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSafeArea} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.headerContent}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.symbolText, { color: colors.text }]}>
                  {order.symbol}
                </Text>
                <View style={styles.badges}>
                  <View style={[styles.typeBadge, { backgroundColor: getOrderTypeColor(order.type) + '20' }]}>
                    <Text style={[styles.typeText, { color: getOrderTypeColor(order.type) }]}>
                      {getOrderTypeLabel(order.type)}
                    </Text>
                  </View>
                  <View style={[styles.sideBadge, { backgroundColor: getSideColor(order.side) + '20' }]}>
                    <Text style={[styles.sideText, { color: getSideColor(order.side) }]}>
                      {getSideLabel(order.side)}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.modalContent}>
              {/* Status */}
              <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {t('orders.details.status')}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: '#10b981' + '20' }]}>
                  <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                  <Text style={[styles.statusText, { color: '#10b981' }]}>
                    {order.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Progresso */}
              <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {t('orders.details.progress')}
                </Text>
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { backgroundColor: getSideColor(order.side), width: `${progressPercent}%` }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.progressText, { color: colors.text }]}>
                    {progressPercent.toFixed(1)}% {t('orders.details.executed')}
                  </Text>
                </View>
                <View style={styles.progressDetails}>
                  <View style={styles.progressRow}>
                    <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                      {t('orders.filled')}
                    </Text>
                    <Text style={[styles.progressValue, { color: colors.text }]}>
                      {order.filled ? formatAmount(order.filled) : '0'}
                    </Text>
                  </View>
                  <View style={styles.progressRow}>
                    <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                      {t('orders.details.remaining')}
                    </Text>
                    <Text style={[styles.progressValue, { color: colors.text }]}>
                      {order.remaining ? formatAmount(order.remaining) : formatAmount(order.amount || 0)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Detalhes Principais */}
              <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {t('orders.details.title')}
                </Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      {t('orders.details.orderId')}
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>
                      {getOrderId(order) || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      {t('orders.price')}
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {order.price ? formatValue(order.price) : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      {t('orders.amount')}
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {order.amount ? formatAmount(order.amount) : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      {t('orders.details.totalCost')}
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {order.cost ? formatValue(order.cost) : formatValue(order.price * order.amount)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      {t('orders.details.dateTime')}
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {order.timestamp ? formatDate(order.timestamp) : order.datetime || 'N/A'}
                    </Text>
                  </View>
                  {order.fee && order.fee.cost && (
                    <View style={styles.detailItem}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        {t('orders.details.fee')}
                      </Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {formatValue(order.fee.cost)} {order.fee.currency || ''}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Trades (se houver) */}
              {order.trades && order.trades.length > 0 && (
                <View style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {t('orders.details.trades')} ({order.trades.length})
                  </Text>
                  {order.trades.slice(0, 5).map((trade, index) => (
                    <View key={index} style={styles.tradeItem}>
                      <Text style={[styles.tradeText, { color: colors.text }]}>
                        {t('orders.details.trade')} #{index + 1}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Footer com botão de fechar */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity 
                style={[styles.closeButtonFooter, { backgroundColor: colors.primary }]}
                onPress={onClose}
              >
                <Text style={[styles.closeButtonFooterText, { color: colors.primaryText }]}>
                  {t('orders.details.close')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSafeArea: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  modalContainer: {
    borderRadius: 20,
    width: "90%",
    maxHeight: "85%",
    height: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  symbolText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.semibold,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },
  sideBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sideText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },
  closeButton: {
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  closeButtonText: {
    fontSize: typography.h3,
    fontWeight: fontWeights.light,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  section: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  progressDetails: {
    gap: 6,
    marginTop: 4,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: typography.bodySmall,
  },
  progressValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  detailsGrid: {
    gap: 12,
  },
  detailItem: {
    gap: 4,
  },
  detailLabel: {
    fontSize: typography.caption,
  },
  detailValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  tradeItem: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  tradeText: {
    fontSize: typography.bodySmall,
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
  },
  closeButtonFooter: {
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  closeButtonFooterText: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },
})
