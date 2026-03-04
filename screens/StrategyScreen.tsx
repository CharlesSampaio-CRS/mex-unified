import { Text, StyleSheet, ScrollView, RefreshControl, View, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, TextInput } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useTheme } from "../contexts/ThemeContext"
import { useLanguage } from "../contexts/LanguageContext"
import { useAuth } from "../contexts/AuthContext"
import { useNotifications } from "../contexts/NotificationsContext"
import { useBackendStrategies, Strategy, StrategyStatus } from "../hooks/useBackendStrategies"
import { notify } from "../services/notify"
import { CreateStrategyModal } from "../components/create-strategy-modal"
import { StrategyDetailsModal } from "@/components/StrategyDetailsModal"
import { useHeader } from "../contexts/HeaderContext"
import { NotificationsModal } from "../components/NotificationsModal"
import { typography, fontWeights } from "../lib/typography"
import { commonStyles } from "@/lib/layout"

/**
 * 🤖 Strategy Screen - MongoDB Backend
 * 
 * Estratégias armazenadas no MongoDB:
 * - Sincronização em tempo real via API
 * - Multi-device: mesmos dados em todos os dispositivos
 */

export function StrategyScreen({ navigation, route }: any) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { user } = useAuth()
  const { unreadCount, addNotification } = useNotifications()
  const { 
    strategies,
    archivedStrategies,
    loading,
    refreshing,
    loadStrategies,
    loadHistory,
    toggleActive,
    deleteStrategy: deleteStrategyFromBackend,
    activeStrategies,
    inactiveStrategies,
    newExecutions,
    clearNewExecutions,
  } = useBackendStrategies(true) // Auto-load
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'paused' | 'archived'>('all')

  // Preset do simulador para criar estratégia pré-preenchida
  const [simulatorPreset, setSimulatorPreset] = useState<any>(undefined)

  // 🔔 Notificações de novas execuções detectadas no polling
  useEffect(() => {
    if (newExecutions.length > 0) {
      for (const exec of newExecutions) {
        const count = exec.newCount - exec.prevCount;
        // Notifica uma vez por estratégia que teve nova(s) execução(ões)
        addNotification({
          type: 'info',
          title: '🤖 Nova Execução',
          message: `${exec.strategyName} executou ${count} nova(s) ordem(ns) em ${exec.symbol}`,
          icon: '⚡',
          data: {
            category: 'strategy',
            action: 'strategy_executed',
            name: exec.strategyName,
            symbol: exec.symbol,
            strategyId: exec.strategyId,
          },
        });
      }
      clearNewExecutions();
    }
  }, [newExecutions, addNotification, clearNewExecutions]);

  // Abre modal de criação se vier da tela de templates ou do simulador
  useEffect(() => {
    if (route?.params?.openCreate) {
      if (route?.params?.simulatorPreset) {
        setSimulatorPreset(route.params.simulatorPreset)
      }
      setCreateModalVisible(true)
      // Limpa o param para não reabrir ao voltar
      navigation?.setParams({ openCreate: undefined, template: undefined, simulatorPreset: undefined })
    }
  }, [route?.params?.openCreate])

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

  const toggleStrategyHandler = useCallback((id: string) => {
    const strategyToToggle = strategies.find(s => s.id === id)
    if (!strategyToToggle) return

    const newIsActive = !strategyToToggle.is_active
    
    // Show confirmation modal
    setToggleStrategyId(id)
    setToggleStrategyName(strategyToToggle.name)
    setToggleStrategyNewStatus(newIsActive)
    setConfirmToggleModalVisible(true)
  }, [strategies])

  const confirmToggle = useCallback(async () => {
    const id = toggleStrategyId
    const name = toggleStrategyName
    const newIsActive = toggleStrategyNewStatus
    
    setConfirmToggleModalVisible(false)
    setToggleStrategyId("")
    setToggleStrategyName("")
    setToggleStrategyNewStatus(false)

    // Atualiza no backend via hook
    try {
      console.log(`🔄 ${newIsActive ? 'Activating' : 'Deactivating'} strategy ${id}`)
      
      await toggleActive(id, newIsActive)
      
      // 🔔 Notificação: Ativada ou Pausada
      if (newIsActive) {
        notify.strategyActivated(addNotification, { name, strategyId: id })
      } else {
        notify.strategyPaused(addNotification, { name, strategyId: id })
      }
      
      console.log('✅ Strategy updated in MongoDB')
    } catch (error) {
      console.error("❌ Error toggling strategy:", error)
      notify.strategyError(addNotification, {
        name,
        action: newIsActive ? 'ativar' : 'pausar',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        strategyId: id,
      })
    }
  }, [toggleStrategyId, toggleStrategyName, toggleStrategyNewStatus, toggleActive, addNotification])

  const deleteStrategyHandler = useCallback(async (id: string, name: string) => {
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

    try {
      console.log(`🗑️ Archiving strategy ${id} (${name})`)
      
      // Arquiva via hook (remove do estado local automaticamente)
      await deleteStrategyFromBackend(id)
      
      // 🔔 Notificação: Estratégia arquivada
      notify.strategyDeleted(addNotification, { name, strategyId: id })
      
      console.log('✅ Strategy archived in MongoDB')
    } catch (error: any) {
      console.error("❌ Error archiving strategy:", error)
      notify.strategyError(addNotification, {
        name,
        action: 'arquivar',
        error: error.message || 'Erro desconhecido',
        strategyId: id,
      })
    }
  }, [confirmStrategyId, confirmStrategyName, deleteStrategyFromBackend, addNotification])

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
    const sign = value >= 0 ? '+' : '';
    return `${sign}${new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "USD",
    }).format(value)}`;
  }, [])

  const getStatusLabel = useCallback((status: StrategyStatus): string => {
    const labels: Record<string, string> = {
      idle: t('strategy.statusIdle') || 'Idle',
      monitoring: t('strategy.statusMonitoring') || 'Monitoring',
      buy_pending: t('strategy.statusBuyPending') || 'Buy Pending',
      in_position: t('strategy.statusInPosition') || 'In Position',
      sell_pending: t('strategy.statusSellPending') || 'Sell Pending',
      paused: t('strategy.inactive'),
      completed: t('strategy.statusCompleted') || 'Completed',
      error: t('strategy.statusError') || 'Error',
      archived: 'Arquivada',
      gradual_selling: 'Gradual Selling',
      stopped_out: 'Stopped Out',
      expired: 'Expirada',
    };
    return labels[status] || status;
  }, [t])

  const getStatusColor = useCallback((status: StrategyStatus): string => {
    switch (status) {
      case 'monitoring': return '#3b82f6';
      case 'in_position': return '#10b981';
      case 'gradual_selling': return '#f59e0b';
      case 'completed': return '#8b5cf6';
      case 'error': return '#ef4444';
      case 'paused': return '#6b7280';
      case 'archived': return '#9ca3af';
      case 'stopped_out': return '#ef4444';
      case 'expired': return '#f59e0b';
      default: return '#6b7280';
    }
  }, [])

  // Memoize computed values to avoid recalculation on every render
  const strategiesCount = useMemo(() => strategies.length, [strategies.length])
  const hasStrategies = useMemo(() => strategiesCount > 0, [strategiesCount])

  // Filtered strategies based on search + filter
  const filteredStrategies = useMemo(() => {
    // Se filtro é "archived", usa lista de arquivadas
    if (activeFilter === 'archived') {
      let result = archivedStrategies;
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        result = result.filter(s =>
          s.name.toLowerCase().includes(q) ||
          s.symbol.toLowerCase().includes(q) ||
          s.exchange_name.toLowerCase().includes(q)
        )
      }
      return result;
    }

    let result = strategies

    // Filter by active/paused
    if (activeFilter === 'active') {
      result = result.filter(s => s.is_active)
    } else if (activeFilter === 'paused') {
      result = result.filter(s => !s.is_active)
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.symbol.toLowerCase().includes(q) ||
        s.exchange_name.toLowerCase().includes(q) ||
        ((s as any).strategy_type || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [strategies, archivedStrategies, activeFilter, search])

  // 🔄 Refresh - atualiza estratégias do MongoDB
  const handleRefresh = useCallback(async () => {
    try {
      if (activeFilter === 'archived') {
        await loadHistory()
      } else {
        await loadStrategies()
      }
    } catch (error) {
      console.error('❌ [StrategyScreen] Erro ao atualizar:', error)
    }
  }, [loadStrategies, loadHistory, activeFilter])

  // Handlers para o Header
  const onNotificationsPress = useCallback(() => {
    setNotificationsModalVisible(true)
  }, [])

  // Define o Header global para esta tela
  useHeader({
    title: t('strategy.title'),
    subtitle: `${strategiesCount} ${strategiesCount === 1 ? t('strategy.strategy') : t('strategy.strategies')}`,
    onNotificationsPress,
    unreadCount,
  })

  // Helper: get strategy type icon
  const getTypeIcon = useCallback((type: string): string => {
    switch (type?.toLowerCase()) {
      case 'dca': return 'repeat-outline'
      case 'grid': return 'grid-outline'
      case 'scalping': return 'flash-outline'
      default: return 'analytics-outline'
    }
  }, [])

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Filters */}
      <View style={[styles.filtersContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar estratégia..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <View style={styles.typeFilterRow}>
          <TouchableOpacity
            style={[
              styles.typeFilterChip,
              {
                backgroundColor: activeFilter === 'all' ? colors.primary : colors.surface,
                borderColor: activeFilter === 'all' ? colors.primary : colors.border,
              }
            ]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[
              styles.typeFilterText,
              { color: activeFilter === 'all' ? colors.background : colors.text }
            ]}>
              Todas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeFilterChip,
              {
                backgroundColor: activeFilter === 'active' ? colors.success : colors.surface,
                borderColor: activeFilter === 'active' ? colors.success : colors.border,
              }
            ]}
            onPress={() => setActiveFilter('active')}
          >
            <Text style={[
              styles.typeFilterText,
              { color: activeFilter === 'active' ? colors.background : colors.text }
            ]}>
              Ativas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeFilterChip,
              {
                backgroundColor: activeFilter === 'paused' ? '#6b7280' : colors.surface,
                borderColor: activeFilter === 'paused' ? '#6b7280' : colors.border,
              }
            ]}
            onPress={() => setActiveFilter('paused')}
          >
            <Text style={[
              styles.typeFilterText,
              { color: activeFilter === 'paused' ? colors.background : colors.text }
            ]}>
              Pausadas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeFilterChip,
              {
                backgroundColor: activeFilter === 'archived' ? '#9ca3af' : colors.surface,
                borderColor: activeFilter === 'archived' ? '#9ca3af' : colors.border,
              }
            ]}
            onPress={() => {
              setActiveFilter('archived')
              loadHistory()
            }}
          >
            <Ionicons name="archive-outline" size={12} color={activeFilter === 'archived' ? colors.background : colors.text} style={{ marginRight: 2 }} />
            <Text style={[
              styles.typeFilterText,
              { color: activeFilter === 'archived' ? colors.background : colors.text }
            ]}>
              Histórico
            </Text>
          </TouchableOpacity>
        </View>

        {/* Results Count + New Button */}
        <View style={styles.filterFooter}>
          <Text style={[styles.resultsCount, { color: colors.textTertiary }]}>
            {filteredStrategies.length} {filteredStrategies.length === 1 ? 'estratégia' : 'estratégias'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.newStrategyButton, { borderColor: '#8b5cf6' }]}
              onPress={() => navigation?.navigate('StrategySimulator')}
              activeOpacity={0.7}
            >
              <Ionicons name="flask-outline" size={14} color="#8b5cf6" />
              <Text style={[styles.newStrategyText, { color: '#8b5cf6' }]}>Simular</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.newStrategyButton, { borderColor: colors.primary }]}
              onPress={handleNewStrategy}
              activeOpacity={0.7}
            >
              <Ionicons name="add-outline" size={14} color={colors.primary} />
              <Text style={[styles.newStrategyText, { color: colors.primary }]}>Nova</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {filteredStrategies.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={40} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {strategies.length === 0 ? t('strategy.empty') : 'Nenhuma estratégia encontrada'}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {strategies.length === 0 ? t('strategy.emptyDesc') : 'Tente ajustar sua busca ou filtros'}
            </Text>
          </View>
        ) : (
          <View style={styles.strategiesList}>
            {filteredStrategies.map((strategy) => {
              const strategyType = (strategy as any).strategy_type || 'Custom'
              const statusColor = getStatusColor(strategy.status)
              const isPnlPositive = strategy.total_pnl_usd >= 0
              const hasError = !!strategy.error_message

              return (
                <View
                  key={strategy.id}
                  style={[
                    styles.compactCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: hasError ? 'rgba(239, 68, 68, 0.3)' : colors.border,
                    }
                  ]}
                >
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedStrategyId(strategy.id)
                      setDetailsModalVisible(true)
                    }}
                  >
                    {/* Compact Row */}
                    <View style={styles.cardRow}>
                      {/* Left: Icon + Info */}
                      <View style={styles.cardLeft}>
                        <View style={[
                          styles.typeIcon,
                          { backgroundColor: `${statusColor}18` }
                        ]}>
                          <Ionicons
                            name={getTypeIcon(strategyType) as any}
                            size={16}
                            color={statusColor}
                          />
                        </View>
                        <View style={styles.cardInfo}>
                          <View style={styles.cardInfoTop}>
                            <Text style={[styles.cardSymbol, { color: colors.text }]} numberOfLines={1}>
                              {strategy.name}
                            </Text>
                            <View style={[
                              styles.sideBadge,
                              { backgroundColor: `${statusColor}18` }
                            ]}>
                              <Text style={[styles.sideBadgeText, { color: statusColor }]}>
                                {strategyType.toUpperCase()}
                              </Text>
                            </View>
                            {hasError && (
                              <Ionicons name="warning-outline" size={12} color="#ef4444" />
                            )}
                          </View>
                          <Text style={[styles.cardSubtext, { color: colors.textTertiary }]} numberOfLines={1}>
                            {strategy.exchange_name} • {strategy.symbol}
                            {strategy.total_executions > 0 ? ` • ${strategy.total_executions} exec` : ''}
                          </Text>
                        </View>
                      </View>

                      {/* Right: PnL + Status */}
                      <View style={styles.cardRight}>
                        <Text
                          style={[
                            styles.cardValue,
                            { color: isPnlPositive ? colors.success : colors.danger }
                          ]}
                          numberOfLines={1}
                        >
                          {formatCurrency(strategy.total_pnl_usd)}
                        </Text>
                        <Text style={[styles.cardStatusText, { color: statusColor }]} numberOfLines={1}>
                          {getStatusLabel(strategy.status)}
                        </Text>
                      </View>
                    </View>

                    {/* Footer Actions */}
                    <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                      <TouchableOpacity
                        style={styles.cardActionButton}
                        onPress={() => {
                          setSelectedStrategyId(strategy.id)
                          setDetailsModalVisible(true)
                        }}
                      >
                        <Ionicons name="eye-outline" size={14} color={colors.primary} />
                        <Text style={[styles.cardActionText, { color: colors.primary }]}>
                          Detalhes
                        </Text>
                      </TouchableOpacity>

                      {activeFilter !== 'archived' && (
                        <>
                          <View style={[styles.cardActionDivider, { backgroundColor: colors.border }]} />

                          <TouchableOpacity
                            style={styles.cardActionButton}
                            onPress={() => toggleStrategyHandler(strategy.id)}
                          >
                            <Ionicons
                              name={strategy.is_active ? 'pause-outline' : 'play-outline'}
                              size={14}
                              color={strategy.is_active ? '#f59e0b' : colors.success}
                            />
                            <Text style={[
                              styles.cardActionText,
                              { color: strategy.is_active ? '#f59e0b' : colors.success }
                            ]}>
                              {strategy.is_active ? 'Pausar' : 'Ativar'}
                            </Text>
                          </TouchableOpacity>

                          <View style={[styles.cardActionDivider, { backgroundColor: colors.border }]} />

                          <TouchableOpacity
                            style={styles.cardActionButton}
                            onPress={() => deleteStrategyHandler(strategy.id, strategy.name)}
                          >
                            <Ionicons name="archive-outline" size={14} color={colors.danger} />
                            <Text style={[styles.cardActionText, { color: colors.danger }]}>
                              Arquivar
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              )
            })}
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
                Arquivar estratégia?
              </Text>
              <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
                A estratégia "{confirmStrategyName}" será arquivada. O histórico de sinais e execuções será preservado na aba Histórico.
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
                  <Text style={styles.deleteConfirmButtonText}>Arquivar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create Strategy Modal */}
      <CreateStrategyModal
        visible={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false)
          setSimulatorPreset(undefined)
        }}
        onSuccess={handleStrategyCreated}
        userId={user?.id || ''}
        navigation={navigation}
        simulatorPreset={simulatorPreset}
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
            deleteStrategyHandler(strategyId, strategy.name)
          }
        }}
        onToggleActive={(strategyId: string, currentStatus: boolean) => {
          toggleStrategyHandler(strategyId)
        }}
      />

      {/* Notifications Modal */}
      <NotificationsModal 
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: commonStyles.screenContainer,
  // Filters
  filtersContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
    paddingVertical: 0,
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeFilterChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeFilterText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
  },
  filterFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsCount: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
    paddingVertical: 4,
  },
  newStrategyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  newStrategyText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
  },
  scrollView: commonStyles.scrollView,
  content: {
    padding: 16,
    paddingBottom: 80,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: typography.h4,
    fontWeight: fontWeights.semibold,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Strategies List
  strategiesList: {
    gap: 0,
  },
  // Compact Card
  compactCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardInfoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardSymbol: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
    flexShrink: 1,
  },
  sideBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  sideBadgeText: {
    fontSize: typography.badge,
    fontWeight: fontWeights.bold,
  },
  cardSubtext: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
  },
  cardRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  cardValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
  },
  cardStatusText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
  },
  // Card Footer Actions
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  cardActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flex: 1,
    paddingVertical: 2,
  },
  cardActionDivider: {
    width: 1,
    height: 16,
  },
  cardActionText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.semibold,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSafeArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  confirmModal: {
    width: '90%',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  confirmTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeights.medium,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: typography.caption,
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButtonText: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  deleteConfirmButton: {
    backgroundColor: '#ef4444',
  },
  deleteConfirmButtonText: {
    color: '#ffffff',
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
})
