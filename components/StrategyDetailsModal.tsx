import React, { useEffect, useState } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useBackendStrategies, Strategy } from '@/hooks/useBackendStrategies'

interface StrategyDetailsModalProps {
  visible: boolean
  strategyId: string | null
  userId: string
  onClose: () => void
  onDelete?: (strategyId: string) => void
  onToggleActive?: (strategyId: string, currentStatus: boolean) => void
}

export function StrategyDetailsModal({
  visible,
  strategyId,
  userId,
  onClose,
  onDelete,
  onToggleActive
}: StrategyDetailsModalProps) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { strategies } = useBackendStrategies(false) // Não auto-load, usa estratégias passadas
  
  const [strategy, setStrategy] = useState<Strategy | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (visible && strategyId) {
      // Busca a estratégia da lista local (já carregada)
      const found = strategies.find(s => s.id === strategyId)
      if (found) {
        setStrategy(found)
      } else {
        setError(t('strategy.notFound') || 'Estratégia não encontrada')
      }
    } else if (!visible) {
      // Reset when modal closes
      setStrategy(null)
      setError(null)
    }
  }, [visible, strategyId, strategies, t])

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('common.loading')}...
          </Text>
        </View>
      )
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={onClose}
          >
            <Text style={styles.retryButtonText}>{t('common.close') || 'Fechar'}</Text>
          </TouchableOpacity>
        </View>
      )
    }

    if (!strategy) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('strategy.notFound')}
          </Text>
        </View>
      )
    }

    const strategyId = strategy.id || ''
    const strategyName = `${strategy.symbol} - ${strategy.exchange_name || strategy.exchange_id || 'Exchange'}`
    const template = (strategy.config?.template) || 'simple'
    const templateNames: Record<string, string> = {
      simple: t('strategy.simple'),
      conservative: t('strategy.conservative'),
      aggressive: t('strategy.aggressive')
    }
    
    // is_active já é boolean no MongoDB
    const isActive = strategy.is_active

    return (
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header com status */}
        <View style={[styles.statusHeader, { backgroundColor: colors.surface }]}>
          <View style={[
            styles.statusBadge,
            isActive 
              ? { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)', borderWidth: 1 }
              : { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', borderWidth: 1 }
          ]}>
            <View 
              style={[
                styles.statusDot, 
                { backgroundColor: isActive ? colors.primary : colors.danger }
              ]} 
            />
            <Text style={[styles.statusText, { color: colors.text }]}>
              {isActive ? 'Ativa' : 'Inativa'}
            </Text>
          </View>

          <View style={[styles.typeBadge, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
              {templateNames[template]}
            </Text>
          </View>
        </View>

        {/* Nome da Estratégia */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('strategy.name')}
          </Text>
          <Text style={[styles.strategyName, { color: colors.text }]}>
            {strategyName}
          </Text>
        </View>

        {/* Informações Principais */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('strategy.configuration')}
          </Text>
          
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {/* Exchange */}
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"
                    stroke={colors.textSecondary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  {t('strategy.exchange')}
                </Text>
              </View>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {strategy.exchange_name || strategy.exchange_id || 'N/A'}
              </Text>
            </View>

            {/* Divider */}
            <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />

            {/* Token */}
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="10" stroke={colors.textSecondary} strokeWidth="2" />
                  <Path d="M12 6v6l4 2" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" />
                </Svg>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  {t('strategy.tradingPair')}
                </Text>
              </View>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {strategy.symbol}
              </Text>
            </View>

            {/* Divider */}
            <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />

            {/* Template */}
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                    stroke={colors.textSecondary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  {t('strategy.template')}
                </Text>
              </View>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {templateNames[template]}
              </Text>
            </View>
          </View>
        </View>

        {/* Regras - Take Profit */}
        {strategy.config?.rules?.take_profit_levels && strategy.config.rules.take_profit_levels.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {t('strategy.takeProfit')}
            </Text>
            <View style={[styles.conditionsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {strategy.config.rules.take_profit_levels.map((level: any, index: number) => (
                <View key={index}>
                  {index > 0 && (
                    <View style={[styles.conditionDivider, { backgroundColor: colors.border }]} />
                  )}
                  <View style={styles.conditionRow}>
                    <View style={[styles.conditionBullet, { backgroundColor: '#10b981' }]} />
                    <View style={styles.conditionContent}>
                      <Text style={[styles.conditionText, { color: colors.text }]}>
                        {t('strategy.level')} {index + 1}: <Text style={{ fontWeight: '400' }}>+{level.percent}%</Text>
                      </Text>
                      <Text style={[styles.conditionSubtext, { color: colors.textSecondary }]}>
                        {t('strategy.sell')} {level.sell_percent}% {t('strategy.ofPosition')}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Stop Loss */}
        {strategy.config?.rules?.stop_loss?.enabled && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {t('strategy.stopLoss')}
            </Text>
            <View style={[styles.actionsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.actionRow}>
                <View style={[styles.actionIcon, { backgroundColor: '#ef444420' }]}>
                  <Text style={styles.actionEmoji}>🛡️</Text>
                </View>
                <View style={styles.actionContent}>
                  <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
                    Proteção ativada
                  </Text>
                  <Text style={[styles.actionValue, { color: colors.text }]}>
                    -{strategy.config.rules.stop_loss.percent}%
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Datas */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('strategy.information')}
          </Text>
          <View style={[styles.datesCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.dateRow}>
              <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
                {t('strategy.createdAt')}
              </Text>
              <Text style={[styles.dateValue, { color: colors.text }]}>
                {new Date(strategy.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </Text>
            </View>
            
            <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />
            
            <View style={styles.dateRow}>
              <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
                {t('strategy.lastUpdate')}
              </Text>
              <Text style={[styles.dateValue, { color: colors.text }]}>
                {new Date(strategy.updated_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('strategy.details')}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={[styles.closeIcon, { color: colors.text }]}>✕</Text>
              </TouchableOpacity>
            </View>

          {/* Content */}
          {renderContent()}

          {/* Actions Footer */}
          {!loading && !error && strategy && (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.footerButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (strategyId) {
                    onToggleActive?.(strategyId, strategy.is_active)
                    onClose()
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.footerButtonText, { color: '#ffffff' }]}>
                  {strategy.is_active ? 'Desativar' : 'Ativar'}
                </Text>
              </TouchableOpacity>

              {onDelete && (
                <TouchableOpacity
                  style={[styles.footerButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ef4444' }]}
                  onPress={() => {
                    if (strategyId) {
                      onDelete(strategyId)
                      onClose()
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.footerButtonText, { color: '#ef4444' }]}>
                    Excluir
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  modalContainer: {
    borderRadius: 20,
    width: '90%',
    maxHeight: '85%',
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 24,
    fontWeight: '300',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '300',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '300',
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '400',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '300',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '400',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '400',
    textTransform: 'uppercase',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  strategyName: {
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: -0.2,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '300',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '400',
  },
  infoDivider: {
    height: 0.5,
    marginVertical: 12,
  },
  conditionsCard: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 16,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  conditionBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  conditionContent: {
    flex: 1,
  },
  conditionText: {
    fontSize: 13,
    fontWeight: '300',
    lineHeight: 20,
  },
  conditionSubtext: {
    fontSize: 12,
    fontWeight: '300',
    marginTop: 4,
  },
  conditionDivider: {
    height: 0.5,
    marginVertical: 8,
  },
  actionsCard: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEmoji: {
    fontSize: 20,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '300',
    marginBottom: 4,
  },
  actionValue: {
    fontSize: 13,
    fontWeight: '400',
  },
  actionDivider: {
    height: 0.5,
    marginVertical: 12,
  },
  datesCard: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 16,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '300',
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '400',
  },
  dateDivider: {
    height: 0.5,
    marginVertical: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 0.5,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minHeight: 44,
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
