import { Text, StyleSheet, ScrollView, View, TouchableOpacity, Modal, Pressable, RefreshControl, KeyboardAvoidingView, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useTheme } from "../contexts/ThemeContext"
import { useLanguage } from "../contexts/LanguageContext"
import { useAuth } from "../contexts/AuthContext"
import { useNotifications } from "../contexts/NotificationsContext"
import { strategyService, Strategy as SQLiteStrategy } from "../services/strategy-service"
import { CreateStrategyModal } from "../components/create-strategy-modal"
import { StrategyDetailsModal } from "@/components/StrategyDetailsModal"
import { Header } from "../components/Header"
import { NotificationsModal } from "../components/NotificationsModal"
import { LogoIcon } from "../components/LogoIcon"
import { AnimatedLogoIcon } from "../components/AnimatedLogoIcon"
import { TabBar } from "../components/TabBar"
import { typography, fontWeights } from "../lib/typography"
import { commonStyles, spacing, borderRadius, shadows } from "@/lib/layout"

/**
 * 🤖 Strategy Screen - 100% LOCAL com SQLite
 * 
 * Zero Database Pattern:
 * - Todas as estratégias são armazenadas localmente
 * - Sem chamadas de API para CRUD de estratégias
 * - Performance: ~5-20ms vs 200-500ms da API antiga
 * - Funciona 100% offline
 */

interface Strategy {
  id: string
  name: string
  type: string
  exchange: string
  token: string
  isActive: boolean
  description?: string
  config: any
  profitLoss: number
  tradesCount: number
  createdAt: Date
  updatedAt: Date
}

export function StrategyScreen({ navigation }: any) {
  const { colors, isDark } = useTheme()
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const { unreadCount } = useNotifications()
  const [activeTab, setActiveTab] = useState<"strategies" | "executions">("strategies")
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false)

  // Modal de confirmação de exclusão
  const [confirmDeleteModalVisible, setConfirmDeleteModalVisible] = useState(false)
  const [confirmStrategyId, setConfirmStrategyId] = useState<string>("")
  const [confirmStrategyName, setConfirmStrategyName] = useState<string>("")

  // Modal de confirmação de toggle (ativar/desativar)
  const [confirmToggleModalVisible, setConfirmToggleModalVisible] = useState(false)
  const [toggleStrategyId, setToggleStrategyId] = useState<string>("")
  const [toggleStrategyName, setToggleStrategyName] = useState<string>("")
  const [toggleStrategyNewStatus, setToggleStrategyNewStatus] = useState<boolean>(false)
  
  // Modal de detalhes da estratégia
  const [detailsModalVisible, setDetailsModalVisible] = useState(false)
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null)

  // Themed toggle styles
  const themedToggleStyles = useMemo(() => ({
    toggle: { 
      backgroundColor: isDark ? 'rgba(60, 60, 60, 0.4)' : 'rgba(220, 220, 220, 0.5)',
      borderColor: isDark ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.4)',
    },
    toggleActive: { 
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.5)',
      borderColor: isDark ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.7)',
    },
    toggleThumb: { 
      backgroundColor: isDark ? 'rgba(140, 140, 140, 0.9)' : 'rgba(120, 120, 120, 0.85)',
    },
    toggleThumbActive: { 
      backgroundColor: isDark ? 'rgba(96, 165, 250, 1)' : 'rgba(59, 130, 246, 1)',
    },
  }), [isDark])

  /**
   * 🔄 Carrega estratégias do banco local (SQLite)
   * Performance: ~5-20ms (vs ~200-500ms da API antiga)
   */
  const loadStrategies = useCallback(async () => {
    console.log('🔄 [StrategyScreen] loadStrategies chamado, user?.id:', user?.id)
    
    if (!user?.id) {
      console.log('⚠️ [StrategyScreen] No user ID, skipping strategies load')
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      console.log('📊 [StrategyScreen] Loading strategies from local database...')
      
      // Busca do banco local (SQLite)
      console.log('📡 [StrategyScreen] Chamando strategyService.findAll()...')
      const localStrategies = await strategyService.findAll()
      
      console.log(`✅ [StrategyScreen] Loaded ${localStrategies.length} strategies from local DB`)
      
      // Transform SQLite models to UI format
      const transformedStrategies: Strategy[] = localStrategies.map((strategy: SQLiteStrategy) => {
        let config = {}
        try {
          config = JSON.parse(strategy.config)
        } catch {
          config = {}
        }
        
        return {
          id: strategy.id,
          name: strategy.name,
          type: strategy.type,
          exchange: strategy.exchange_name || strategy.exchange_id, // Usa exchange_name se disponível, senão exchange_id
          token: strategy.symbol,
          isActive: strategy.is_active === 1, // SQLite usa INTEGER para boolean
          description: strategy.description || undefined,
          config,
          profitLoss: 0, // TODO: calcular do histórico
          tradesCount: 0, // TODO: calcular do histórico
          createdAt: new Date(strategy.created_at),
          updatedAt: new Date(strategy.updated_at),
        }
      })
      
      setStrategies(transformedStrategies)
    } catch (error) {
      console.error("❌ Error loading strategies:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  /**
   * 📋 Execuções ficam vazias por enquanto
   * TODO: Implementar sistema de execuções local
   */
  const loadExecutions = useCallback(async () => {
    // Execuções serão implementadas depois
    // Por enquanto, mantém vazio
  }, [])

  // Load strategies and executions from API on mount
  useEffect(() => {
    console.log('🔄 [StrategyScreen] useEffect executado')
    loadStrategies()
    loadExecutions()
  }, [loadStrategies, loadExecutions])

  const toggleStrategy = useCallback((id: string) => {
    const strategyToToggle = strategies.find(s => s.id === id)
    if (!strategyToToggle) return

    const newIsActive = !strategyToToggle.isActive
    
    // Show confirmation modal
    setToggleStrategyId(id)
    setToggleStrategyName(strategyToToggle.name)
    setToggleStrategyNewStatus(newIsActive)
    setConfirmToggleModalVisible(true)
  }, [strategies])

  const confirmToggle = useCallback(async () => {
    const id = toggleStrategyId
    const newIsActive = toggleStrategyNewStatus
    
    setConfirmToggleModalVisible(false)
    setToggleStrategyId("")
    setToggleStrategyName("")
    setToggleStrategyNewStatus(false)

    // Optimistic update
    const previousStrategies = [...strategies]

    setStrategies(prev =>
      prev.map(strategy =>
        strategy.id === id
          ? { ...strategy, isActive: newIsActive }
          : strategy
      )
    )

    // Atualiza no banco local
    try {
      console.log(`🔄 ${newIsActive ? 'Activating' : 'Deactivating'} strategy ${id}`)
      
      if (newIsActive) {
        await strategyService.activate(id)
      } else {
        await strategyService.deactivate(id)
      }
      
      console.log('✅ Strategy updated in local database')
    } catch (error) {
      console.error("❌ Error toggling strategy:", error)
      // Rollback on error
      setStrategies(previousStrategies)
      alert(`Erro ao alterar estratégia: ${error instanceof Error ? error.message : error}`)
    }
  }, [toggleStrategyId, toggleStrategyNewStatus, strategies])

  const deleteStrategy = useCallback(async (id: string, name: string) => {
    setConfirmStrategyId(id)
    setConfirmStrategyName(name)
    setConfirmDeleteModalVisible(true)
  }, [])

  const confirmDelete = useCallback(async () => {
    const id = confirmStrategyId
    const name = confirmStrategyName
    
    setConfirmDeleteModalVisible(false)
    setConfirmStrategyId("")
    setConfirmStrategyName("")

    if (!user?.id) {
      alert('Erro: usuário não autenticado')
      return
    }

    try {
      console.log(`🗑️ Deleting strategy ${id} (${name})`)
      
      // Optimistic update - remove from UI immediately
      setStrategies(prev => prev.filter(s => s.id !== id))
      
      // Deleta do banco local
      await strategyService.delete(id)
      
      console.log('✅ Strategy deleted from local database')
    } catch (error: any) {
      console.error("❌ Error deleting strategy:", error)
      
      // Rollback - reload strategies on error
      loadStrategies()
      
      alert(`Erro ao deletar estratégia: ${error.message || error}`)
    }
  }, [confirmStrategyId, confirmStrategyName, loadStrategies, user?.id])

  const handleNewStrategy = useCallback(() => {
    setCreateModalVisible(true)
  }, [])

  const handleStrategyCreated = useCallback(async (strategyId: string) => {
    setCreateModalVisible(false)
    
    console.log('✅ New strategy created:', strategyId)
    
    // Recarrega estratégias do banco local
    await loadStrategies()
  }, [loadStrategies])

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "USD",
    }).format(value)
  }, [])

  const formatDate = useCallback((date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }, [])

  const formatNextCheck = useCallback((nextCheck: Date) => {
    const now = new Date()
    const diffMs = nextCheck.getTime() - now.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    
    if (diffMinutes < 0) {
      return t('strategy.soon')
    } else if (diffMinutes === 0) {
      return t('strategy.now')
    } else if (diffMinutes === 1) {
      return t('strategy.inOneMinute')
    } else if (diffMinutes < 60) {
      return `${t('strategy.in')} ${diffMinutes} ${t('strategy.minutes')}`
    } else {
      // Show time if more than 1 hour (timezone-aware)
      return new Intl.DateTimeFormat(language === 'pt-BR' ? 'pt-BR' : 'en-US', {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo", // Força timezone do Brasil
      }).format(nextCheck)
    }
  }, [t, language])

  // Memoize computed values to avoid recalculation on every render
  const strategiesCount = useMemo(() => strategies.length, [strategies.length])
  const hasStrategies = useMemo(() => strategiesCount > 0, [strategiesCount])

  // 🔄 Refresh específico por aba - atualiza apenas o conteúdo da aba ativa
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    
    try {
      if (activeTab === "strategies") {
        // Aba Estratégias: atualiza apenas estratégias
        await loadStrategies()
      } else {
        // Aba Execuções: atualiza apenas execuções
        await loadExecutions()
      }
      
    } catch (error) {
      console.error(`❌ [StrategyScreen] Erro ao atualizar aba ${activeTab}:`, error)
    } finally {
      setRefreshing(false)
    }
  }, [activeTab, loadStrategies, loadExecutions])

  // Handlers para o Header
  const onNotificationsPress = useCallback(() => {
    setNotificationsModalVisible(true)
  }, [])

  const onProfilePress = useCallback(() => {
    navigation?.navigate('Settings', { initialTab: 'profile' })
  }, [navigation])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header padronizado com título customizado */}
      <Header 
        title={t('strategy.title')}
        subtitle={`${strategiesCount} ${strategiesCount === 1 ? t('strategy.strategy') : t('strategy.strategies')}`}
        onNotificationsPress={onNotificationsPress}
        onProfilePress={onProfilePress}
        unreadCount={unreadCount}
      />
      
      {/* Tabs - usando componente TabBar padronizado */}
      <TabBar 
        tabs={[t('strategy.strategies'), t('strategy.executions')]}
        activeTab={activeTab === 'strategies' ? 0 : 1}
        onTabChange={(index) => setActiveTab(index === 0 ? 'strategies' : 'executions')}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Removido loading customizado - usa apenas o RefreshControl */}
        {activeTab === 'strategies' ? (
          // Aba de Estratégias
          strategies.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('strategy.empty')}</Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                {t('strategy.emptyDesc')}
              </Text>
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: 'transparent', borderColor: '#3b82f6' }]}
                onPress={handleNewStrategy}
                activeOpacity={0.8}
              >
                <Text style={styles.createButtonText}>{t('strategy.new')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Botão "Nova" no topo quando há estratégias */}
              <View style={styles.actionButtonInline}>
                <TouchableOpacity
                  style={[styles.newButton, { backgroundColor: 'transparent', borderColor: '#3b82f6' }]}
                  onPress={handleNewStrategy}
                  activeOpacity={0.8}
                >
                  <Text style={styles.newButtonText}>{t('strategy.new')}</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.strategiesList}>
            {strategies.map((strategy) => (
              <View
                key={strategy.id}
                style={[styles.strategyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {/* Header do card - nome e badge de status clicável */}
                <View style={styles.strategyHeader}>
                  <View style={styles.strategyHeaderLeft}>
                    <Text style={[styles.strategyName, { color: colors.text }]}>
                      {strategy.name}
                    </Text>
                    <View style={[styles.typeBadge, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.typeText, { color: colors.primary }]}>
                        {strategy.type}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Badge de status ativo/inativo (clicável como toggle) */}
                  <TouchableOpacity
                    style={[
                      styles.statusBadge,
                      { backgroundColor: strategy.isActive ? colors.successLight : colors.dangerLight }
                    ]}
                    onPress={() => toggleStrategy(strategy.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.statusText,
                      { color: strategy.isActive ? colors.success : colors.danger }
                    ]}>
                      {strategy.isActive ? t('strategy.active') : t('strategy.inactive')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Detalhes (3 linhas) */}
                <View style={styles.strategyDetails}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      {t('strategy.exchange')}:
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {strategy.exchange}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      {t('strategy.token')}:
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {strategy.token}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      {t('strategy.totalTrades') || 'Total Trades'}:
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {strategy.tradesCount || 0}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      {t('strategy.profitLoss') || 'P&L'}:
                    </Text>
                    <Text style={[
                      styles.detailValue, 
                      { color: strategy.profitLoss >= 0 ? colors.success : colors.danger }
                    ]}>
                      ${strategy.profitLoss.toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Botões de ação */}
                <View style={styles.actionButtons}>
                  {/* Botão Ver Detalhes */}
                  <TouchableOpacity
                    style={[
                      styles.detailsButton,
                      { backgroundColor: colors.surface, borderColor: colors.border }
                    ]}
                    onPress={() => {
                      setSelectedStrategyId(strategy.id)
                      setDetailsModalVisible(true)
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.detailsButtonText, { color: colors.primary }]}>
                      {t('strategy.viewDetails')}
                    </Text>
                  </TouchableOpacity>

                  {/* Botão Deletar */}
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { 
                        backgroundColor: 'transparent', 
                        borderColor: colors.danger 
                      }
                    ]}
                    onPress={() => deleteStrategy(strategy.id, strategy.name)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.actionButtonText, 
                      { color: colors.danger }
                    ]}>
                      {t('strategy.delete')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
              </View>
            </>
          )
        ) : (
          // Aba de Execuções
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('strategy.executionsEmpty')}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {t('strategy.executionsEmptyDesc')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Toggle Confirmation Modal */}
      <Modal
        visible={confirmToggleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmToggleModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={[styles.confirmModal, { backgroundColor: colors.surface }]}>
              <Text style={[styles.confirmTitle, { color: colors.text }]}>
                {toggleStrategyNewStatus ? t('strategy.activateConfirm') : t('strategy.deactivateConfirm')}
              </Text>
              <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
                {t('strategy.statusWillChange')}
              </Text>
              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => setConfirmToggleModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.confirmButtonText, { color: colors.text }]}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                  onPress={confirmToggle}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteConfirmButtonText}>
                    {t('common.confirm')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={confirmDeleteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmDeleteModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={[styles.confirmModal, { backgroundColor: colors.surface }]}>
              <Text style={[styles.confirmTitle, { color: colors.text }]}>
                {t('strategy.confirmDelete')}
              </Text>
              <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
                {t('strategy.deleteWarning')}
              </Text>
              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => setConfirmDeleteModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.confirmButtonText, { color: colors.text }]}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.deleteConfirmButton]}
                  onPress={confirmDelete}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteConfirmButtonText}>{t('strategy.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create Strategy Modal */}
      <CreateStrategyModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={handleStrategyCreated}
        userId={user?.id || ''}
      />

      {/* Strategy Details Modal */}
      <StrategyDetailsModal
        visible={detailsModalVisible}
        strategyId={selectedStrategyId}
        userId={user?.id || ''}
        onClose={() => {
          setDetailsModalVisible(false)
          setSelectedStrategyId(null)
        }}
        onDelete={(strategyId: string) => {
          // Find strategy name for confirmation
          const strategy = strategies.find(s => s.id === strategyId)
          if (strategy) {
            deleteStrategy(strategyId, strategy.name)
          }
        }}
        onToggleActive={(strategyId: string, currentStatus: boolean) => {
          toggleStrategy(strategyId)
        }}
      />

      {/* Notifications Modal */}
      <NotificationsModal 
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: commonStyles.screenContainer,
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.headerPaddingH,
    paddingVertical: spacing.headerPaddingV,
  },
  titleSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.titleSectionPaddingH,
    paddingTop: spacing.titleSectionPaddingTop,
    paddingBottom: spacing.titleSectionPaddingBottom,
  },
  titleContent: {
    flexDirection: "column",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerText: {
    flexDirection: "column",
  },
  title: {
    fontSize: typography.h3,
    fontWeight: fontWeights.light,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: typography.caption,
    marginTop: 2,
    fontWeight: fontWeights.light,
  },
  actionButtonContainer: commonStyles.actionButtonContainer,
  actionButtonInline: {
    marginBottom: spacing.itemGap,
    alignItems: 'flex-end',
  },
  newButton: {
    ...commonStyles.button,
  },
  newButtonText: {
    color: "#3b82f6",
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
    letterSpacing: 0,
    textAlign: 'center',
  },
  scrollView: commonStyles.scrollView,
  content: {
    padding: spacing.cardPadding + 2, // 16px (14 + 2 = 16)
    paddingBottom: 80,
  },
  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "300",
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    fontWeight: "300",
    textAlign: "center",
  },
  // Strategies List
  strategiesList: {
    gap: spacing.cardGap, // Aumentado de itemGap (12px) para cardGap (16px)
  },
  strategyCard: {
    borderRadius: borderRadius.xl, // Aumentado para xl (20px) - mais moderno
    padding: spacing.cardPaddingLarge, // Aumentado para 20px - mais espaçoso
    ...shadows.md, // Sombra média para melhor destaque
  },
  strategyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  strategyHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  strategyName: {
    fontSize: 16,
    fontWeight: "400",
    marginBottom: 6,
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 11,
    fontWeight: "400",
    textTransform: "uppercase",
  },
  // Toggle
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleActive: {
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  // Strategy Info
  strategyInfo: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "300",
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "400",
    flex: 1,
    textAlign: "right",
  },
  // Strategy Footer
  strategyFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusActive: {},
  statusInactive: {},
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  deleteButton: {
    padding: 8,
  },
  deleteIcon: {
    fontSize: 18,
  },
  // Tabs
  tabsContainer: {
    flexDirection: "row",
    gap: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  tab: {
    paddingVertical: 10,
    paddingBottom: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "400",
  },
  tabTextActive: {
    fontWeight: "600",
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  // Create Button
  createButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 24,
    borderWidth: 0.5,
  },
  createButtonText: {
    color: "#3b82f6",
    fontSize: 13,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  // Stats
  statsSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
    gap: 8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statItem: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "400",
  },
  statValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Executions
  executionsList: {
    gap: spacing.cardGap, // Usando design token (16px)
  },
  executionCard: {
    borderRadius: borderRadius.xl, // Aumentado para xl (20px) - mais moderno
    padding: spacing.cardPaddingLarge, // Aumentado para 20px - mais espaçoso
    gap: spacing.md, // Usando design token (12px)
    ...shadows.md, // Sombra média para melhor destaque
  },
  executionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  executionHeaderLeft: {
    flex: 1,
    gap: 8,
  },
  executionName: {
    fontSize: 14,
    fontWeight: "600",
  },
  executionTypeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  executionTypeText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  executionDate: {
    fontSize: 12,
    fontWeight: "400",
  },
  executionInfo: {
    gap: 8,
  },
  // Modals
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
  confirmModal: {
    width: "90%",
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "500",
    textAlign: "center",
  },
  confirmMessage: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  deleteConfirmButton: {
    backgroundColor: "#ef4444",
  },
  deleteConfirmButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  // Novos estilos para padrão GenericItemList
  strategyDetails: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  detailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
