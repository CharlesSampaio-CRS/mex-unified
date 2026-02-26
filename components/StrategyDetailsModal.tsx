import React, { useEffect, useState, useCallback } from 'react'
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
import { 
  Strategy, 
  StrategyDetail, 
  StrategyStatus, 
  StrategyExecution, 
  StrategySignal,
  StrategyStatsResponse,
  PositionInfo
} from '@/hooks/useBackendStrategies'
import { apiService } from '@/services/api'
import { capitalizeExchangeName } from '@/lib/exchange-helpers'

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
  
  const [strategy, setStrategy] = useState<StrategyDetail | null>(null)
  const [stats, setStats] = useState<StrategyStatsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [ticking, setTicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'executions' | 'signals'>('overview')
  const [tickResult, setTickResult] = useState<{ success: boolean; error?: string; price?: number; signals_count?: number; executions_count?: number; new_status?: string } | null>(null)
  const [expandedError, setExpandedError] = useState(false)
  const [expandedTickResult, setExpandedTickResult] = useState(false)

  useEffect(() => {
    if (visible && strategyId) {
      fetchStrategy(strategyId)
    } else if (!visible) {
      setStrategy(null)
      setStats(null)
      setError(null)
      setLoading(false)
      setActiveTab('overview')
      setTickResult(null)
      setExpandedError(false)
      setExpandedTickResult(false)
    }
  }, [visible, strategyId])

  const fetchStrategy = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      console.log(`🔍 [StrategyDetails] Buscando estratégia ${id} do MongoDB...`)
      
      const [strategyRes, statsRes] = await Promise.allSettled([
        apiService.getStrategy(id),
        apiService.getStrategyStats(id)
      ])
      
      if (strategyRes.status === 'fulfilled') {
        const data = strategyRes.value.data
        if (data?.success && data?.strategy) {
          setStrategy(data.strategy as StrategyDetail)
          console.log(`✅ [StrategyDetails] Estratégia encontrada: ${data.strategy.name}`)
        } else {
          setError(t('strategy.notFound') || 'Estratégia não encontrada')
        }
      } else {
        setError((strategyRes.reason as any)?.message || 'Erro ao carregar estratégia')
      }
      
      if (statsRes.status === 'fulfilled') {
        const statsData = (statsRes.value as any).data
        if (statsData?.success && statsData?.stats) {
          setStats(statsData.stats)
        }
      }
    } catch (err: any) {
      console.error(`❌ [StrategyDetails] Erro ao buscar estratégia:`, err)
      setError(err.message || t('strategy.notFound') || 'Erro ao carregar estratégia')
    } finally {
      setLoading(false)
    }
  }

  const handleTick = useCallback(async () => {
    if (!strategyId || ticking) return
    try {
      setTicking(true)
      setTickResult(null)
      setExpandedTickResult(false)
      
      const response = await apiService.tickStrategy(strategyId)
      const tick = response?.data?.tick
      
      if (tick) {
        const tickInfo = {
          success: !tick.error,
          error: tick.error || undefined,
          price: tick.price || 0,
          signals_count: tick.signals_count || 0,
          executions_count: tick.executions_count || 0,
          new_status: tick.new_status || undefined,
        }
        setTickResult(tickInfo)
        // Auto-expand if there's an error
        if (tick.error) {
          setExpandedTickResult(true)
        }
        console.log('⚡ [Tick result]', tickInfo)
      }

      // Refresh strategy data
      await fetchStrategy(strategyId)
    } catch (err: any) {
      console.error('❌ [StrategyDetails] Tick failed:', err)
      const errorMsg = err?.response?.data?.error || err?.message || 'Unknown error'
      setTickResult({
        success: false,
        error: `Request failed: ${errorMsg}`,
      })
      setExpandedTickResult(true)
    } finally {
      setTicking(false)
    }
  }, [strategyId, ticking])

  // ═══ Helpers ═══

  const formatCurrency = (value: number | undefined | null): string => {
    if (value == null) return '$0.00'
    const prefix = value >= 0 ? '+$' : '-$'
    return prefix + Math.abs(value).toFixed(2)
  }

  const formatCurrencyAbs = (value: number | undefined | null): string => {
    if (value == null) return '$0.00'
    if (value >= 1000) return '$' + value.toFixed(2)
    if (value >= 1) return '$' + value.toFixed(4)
    return '$' + value.toFixed(6)
  }

  const getStatusLabel = (status: StrategyStatus): string => {
    const map: Record<StrategyStatus, string> = {
      idle: t('strategy.statusIdle') || 'Idle',
      monitoring: t('strategy.statusMonitoring') || 'Monitoring',
      buy_pending: t('strategy.statusBuyPending') || 'Buy Pending',
      in_position: t('strategy.statusInPosition') || 'In Position',
      sell_pending: t('strategy.statusSellPending') || 'Sell Pending',
      paused: t('strategy.paused') || 'Paused',
      completed: t('strategy.statusCompleted') || 'Completed',
      error: t('strategy.statusError') || 'Error',
    }
    return map[status] || status
  }

  const getStatusColor = (status: StrategyStatus) => {
    const map: Record<StrategyStatus, { bg: string; text: string; dot: string }> = {
      monitoring: { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6', dot: '#3b82f6' },
      in_position: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', dot: '#10b981' },
      buy_pending: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', dot: '#f59e0b' },
      sell_pending: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', dot: '#f59e0b' },
      completed: { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6', dot: '#8b5cf6' },
      error: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', dot: '#ef4444' },
      paused: { bg: 'rgba(107, 114, 128, 0.12)', text: '#6b7280', dot: '#6b7280' },
      idle: { bg: 'rgba(107, 114, 128, 0.12)', text: '#9ca3af', dot: '#9ca3af' },
    }
    return map[status] || map.idle
  }

  const getExecutionLabel = (action: string): { text: string; color: string } => {
    const map: Record<string, { text: string; color: string }> = {
      buy: { text: t('strategy.execBuy') || 'Buy', color: '#10b981' },
      sell: { text: t('strategy.execSell') || 'Sell', color: '#ef4444' },
      dca_buy: { text: t('strategy.execDcaBuy') || 'DCA Buy', color: '#3b82f6' },
      grid_buy: { text: t('strategy.execGridBuy') || 'Grid Buy', color: '#8b5cf6' },
      grid_sell: { text: t('strategy.execGridSell') || 'Grid Sell', color: '#f59e0b' },
      buy_failed: { text: t('strategy.execFailed') || 'Buy Failed', color: '#ef4444' },
      sell_failed: { text: t('strategy.execFailed') || 'Sell Failed', color: '#ef4444' },
    }
    return map[action] || { text: action, color: colors.textSecondary }
  }

  const formatDate = (ts: number | undefined): string => {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  // ═══ Render Sections ═══

  const renderStatusHeader = () => {
    if (!strategy) return null
    const sc = getStatusColor(strategy.status)
    return (
      <View style={[styles.statusHeader, { backgroundColor: colors.surface }]}>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.text, borderWidth: 1 }]}>
          <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
          <Text style={[styles.statusText, { color: sc.text }]}>
            {getStatusLabel(strategy.status)}
          </Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
            {strategy.strategy_type}
          </Text>
        </View>
      </View>
    )
  }

  const renderPositionCard = () => {
    if (!strategy?.position) return null
    const pos = strategy.position
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t('strategy.position') || 'POSITION'}
        </Text>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('strategy.entryPrice') || 'Entry Price'}</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{formatCurrencyAbs(pos.entry_price)}</Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('strategy.quantity') || 'Quantity'}</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{pos.quantity.toFixed(6)}</Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('strategy.currentPrice') || 'Current Price'}</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{formatCurrencyAbs(pos.current_price)}</Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('strategy.unrealizedPnl') || 'Unrealized P&L'}</Text>
            <Text style={[styles.infoValue, { color: pos.unrealized_pnl >= 0 ? '#10b981' : '#ef4444' }]}>
              {formatCurrency(pos.unrealized_pnl)} ({pos.unrealized_pnl_percent >= 0 ? '+' : ''}{pos.unrealized_pnl_percent.toFixed(2)}%)
            </Text>
          </View>
        </View>
      </View>
    )
  }

  const renderPnlSummary = () => {
    if (!strategy) return null
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('strategy.profitLoss') || 'P&L SUMMARY'}</Text>
        <View style={[styles.statsGrid, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.statsRow}>
            <View style={styles.statsCell}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>{t('strategy.realizedPnl') || 'Realized P&L'}</Text>
              <Text style={[styles.statsValue, { color: strategy.total_pnl_usd >= 0 ? '#10b981' : '#ef4444' }]}>{formatCurrency(strategy.total_pnl_usd)}</Text>
            </View>
            <View style={styles.statsCell}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>{t('strategy.totalTrades') || 'Total Trades'}</Text>
              <Text style={[styles.statsValue, { color: colors.text }]}>{strategy.total_executions}</Text>
            </View>
          </View>
          {stats && (
            <>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statsRow}>
                <View style={styles.statsCell}>
                  <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>{t('strategy.winRate') || 'Win Rate'}</Text>
                  <Text style={[styles.statsValue, { color: colors.text }]}>{(stats.win_rate * 100).toFixed(1)}%</Text>
                </View>
                <View style={styles.statsCell}>
                  <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>{t('strategy.avgProfit') || 'Avg Profit'}</Text>
                  <Text style={[styles.statsValue, { color: stats.avg_profit_per_trade >= 0 ? '#10b981' : '#ef4444' }]}>{formatCurrency(stats.avg_profit_per_trade)}</Text>
                </View>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statsRow}>
                <View style={styles.statsCell}>
                  <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>{t('strategy.totalFees') || 'Total Fees'}</Text>
                  <Text style={[styles.statsValue, { color: colors.textSecondary }]}>${stats.total_fees.toFixed(2)}</Text>
                </View>
                <View style={styles.statsCell}>
                  <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>{t('strategy.daysActive') || 'Days Active'}</Text>
                  <Text style={[styles.statsValue, { color: colors.text }]}>{stats.days_active}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    )
  }

  const renderConfig = () => {
    if (!strategy?.config) return null
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('strategy.configuration')}</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('strategy.exchange')}</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.text }]}>{capitalizeExchangeName(strategy.exchange_name || strategy.exchange_id || 'N/A')}</Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" stroke={colors.textSecondary} strokeWidth="2" />
                <Path d="M12 6v6l4 2" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" />
              </Svg>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('strategy.tradingPair')}</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.text }]}>{strategy.symbol}</Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('strategy.checkInterval') || 'Check Interval'}</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.text }]}>{strategy.check_interval_secs}s</Text>
          </View>
          {strategy.last_price != null && strategy.last_price > 0 && (
            <>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <Text style={{ fontSize: 16 }}>💰</Text>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('strategy.lastPrice') || 'Last Price'}</Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.text }]}>{formatCurrencyAbs(strategy.last_price)}</Text>
              </View>
            </>
          )}
        </View>
      </View>
    )
  }

  const renderTakeProfitLevels = () => {
    if (!strategy?.config?.take_profit_levels || strategy.config.take_profit_levels.length === 0) return null
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('strategy.takeProfit')}</Text>
        <View style={[styles.conditionsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {strategy.config.take_profit_levels.map((level, index) => (
            <View key={index}>
              {index > 0 && <View style={[styles.conditionDivider, { backgroundColor: colors.border }]} />}
              <View style={styles.conditionRow}>
                <View style={[styles.conditionBullet, { backgroundColor: level.executed ? '#8b5cf6' : '#10b981' }]} />
                <View style={styles.conditionContent}>
                  <Text style={[styles.conditionText, { color: colors.text }]}>
                    {t('strategy.level')} {index + 1}: <Text style={{ fontWeight: '400' }}>+{level.percent}%</Text>
                    {level.executed && <Text style={{ color: '#8b5cf6', fontWeight: '400' }}> ✓</Text>}
                  </Text>
                  <Text style={[styles.conditionSubtext, { color: colors.textSecondary }]}>
                    {t('strategy.sell')} {level.sell_percent}% {t('strategy.ofPosition')}
                    {level.executed_at ? ` · ${formatDate(level.executed_at)}` : ''}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    )
  }

  const renderStopLoss = () => {
    if (!strategy?.config?.stop_loss?.enabled) return null
    const sl = strategy.config.stop_loss
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('strategy.stopLoss')}</Text>
        <View style={[styles.actionsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.actionRow}>
            <View style={[styles.actionIcon, { backgroundColor: '#ef444420' }]}>
              <Text style={styles.actionEmoji}>🛡️</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
                {t('strategy.protectionEnabled')}{sl.trailing ? ` (Trailing: ${sl.trailing_distance || 0}%)` : ''}
              </Text>
              <Text style={[styles.actionValue, { color: colors.text }]}>-{sl.percent}%</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  const renderDcaConfig = () => {
    if (!strategy?.config?.dca?.enabled) return null
    const dca = strategy.config.dca
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DCA</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Buys Done</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{dca.buys_done} / {dca.max_buys || '∞'}</Text>
          </View>
          {dca.dip_percent && (
            <>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Dip Trigger</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>-{dca.dip_percent}%</Text>
              </View>
            </>
          )}
          {dca.amount_per_buy && (
            <>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Amount/Buy</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>${dca.amount_per_buy}</Text>
              </View>
            </>
          )}
        </View>
      </View>
    )
  }

  const renderExecutionsList = () => {
    const execs = (strategy as StrategyDetail)?.executions || []
    if (execs.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('strategy.noExecutions') || 'No executions yet'}</Text>
        </View>
      )
    }
    return (
      <View style={{ paddingTop: 16 }}>
        {execs.slice(0, 20).map((exec, idx) => {
          const label = getExecutionLabel(exec.action)
          return (
            <View key={exec.execution_id || idx} style={[styles.execCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={[styles.execBadge, { backgroundColor: label.color + '18' }]}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: label.color }}>{label.text}</Text>
                </View>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>{formatDate(exec.executed_at)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{exec.amount.toFixed(6)} @ {formatCurrencyAbs(exec.price)}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: exec.pnl_usd >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(exec.pnl_usd)}</Text>
              </View>
              {exec.error_message ? <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{exec.error_message}</Text> : null}
              {exec.reason ? <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' }}>{exec.reason}</Text> : null}
            </View>
          )
        })}
      </View>
    )
  }

  const renderSignalsList = () => {
    const sigs = (strategy as StrategyDetail)?.signals || []
    if (sigs.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📡</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('strategy.noSignals') || 'No signals yet'}</Text>
        </View>
      )
    }
    return (
      <View style={{ paddingTop: 16 }}>
        {sigs.slice(0, 30).map((sig, idx) => {
          const sigColors: Record<string, string> = {
            buy: '#10b981', take_profit: '#8b5cf6', stop_loss: '#ef4444',
            trailing_stop: '#f59e0b', dca_buy: '#3b82f6', grid_trade: '#06b6d4',
            info: '#6b7280', price_alert: '#f59e0b'
          }
          const sigColor = sigColors[sig.signal_type] || colors.textSecondary
          return (
            <View key={idx} style={[styles.execCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={[styles.execBadge, { backgroundColor: sigColor + '18' }]}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: sigColor }}>{sig.signal_type.replace('_', ' ').toUpperCase()}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {sig.acted && <Text style={{ fontSize: 10, color: '#10b981', fontWeight: '600' }}>ACTED</Text>}
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>{formatDate(sig.created_at)}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: colors.text, marginTop: 6 }}>{sig.message}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>Price: {formatCurrencyAbs(sig.price)}</Text>
                <Text style={{ fontSize: 11, color: sig.price_change_percent >= 0 ? '#10b981' : '#ef4444' }}>{sig.price_change_percent >= 0 ? '+' : ''}{sig.price_change_percent.toFixed(2)}%</Text>
              </View>
            </View>
          )
        })}
      </View>
    )
  }

  const renderDates = () => {
    if (!strategy) return null
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('strategy.information')}</Text>
        <View style={[styles.datesCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.dateRow}>
            <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{t('strategy.createdAt')}</Text>
            <Text style={[styles.dateValue, { color: colors.text }]}>{formatDate(strategy.created_at)}</Text>
          </View>
          <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />
          <View style={styles.dateRow}>
            <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{t('strategy.lastUpdate')}</Text>
            <Text style={[styles.dateValue, { color: colors.text }]}>{formatDate(strategy.updated_at)}</Text>
          </View>
          {strategy.last_checked_at && (
            <>
              <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />
              <View style={styles.dateRow}>
                <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{t('strategy.lastChecked') || 'Last Checked'}</Text>
                <Text style={[styles.dateValue, { color: colors.text }]}>{formatDate(strategy.last_checked_at)}</Text>
              </View>
            </>
          )}
          {strategy.error_message && (
            <>
              <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />
              <View style={styles.dateRow}>
                <Text style={[styles.dateLabel, { color: '#ef4444' }]}>{t('strategy.statusError') || 'Error'}</Text>
                <Text style={[styles.dateValue, { color: '#ef4444' }]} numberOfLines={2}>{strategy.error_message}</Text>
              </View>
            </>
          )}
        </View>
      </View>
    )
  }

  // ═══ Tab Bar ═══

  const renderTabBar = () => {
    if (!strategy) return null
    const tabs = [
      { key: 'overview' as const, label: t('strategy.overview') || 'Overview' },
      { key: 'executions' as const, label: `${t('strategy.executions') || 'Executions'} (${strategy.executions_count || 0})` },
      { key: 'signals' as const, label: `${t('strategy.signals') || 'Signals'} (${strategy.signals_count || 0})` },
    ]
    return (
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab.key ? colors.primary : colors.textSecondary }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  // ═══ Main Render ═══

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('common.loading')}...</Text>
        </View>
      )
    }
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={styles.retryButtonText}>{t('common.close') || 'Fechar'}</Text>
          </TouchableOpacity>
        </View>
      )
    }
    if (!strategy) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('strategy.notFound')}</Text>
        </View>
      )
    }
    return (
      <>
        {renderTabBar()}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {activeTab === 'overview' && (
            <>
              {renderStatusHeader()}

              {/* ── Tick Result Banner (expandível) ── */}
              {tickResult && (
                <TouchableOpacity
                  style={[styles.tickResultBanner, {
                    backgroundColor: tickResult.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    borderColor: tickResult.success ? '#10b981' : '#ef4444',
                  }]}
                  onPress={() => setExpandedTickResult(!expandedTickResult)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Text style={{ fontSize: 16 }}>{tickResult.success ? '✅' : '❌'}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: tickResult.success ? '#10b981' : '#ef4444' }}>
                        {tickResult.success ? 'Tick executado com sucesso' : 'Tick com erro'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{expandedTickResult ? '▲' : '▼'}</Text>
                  </View>
                  {expandedTickResult && (
                    <View style={{ marginTop: 10, gap: 4 }}>
                      {tickResult.price != null && tickResult.price > 0 && (
                        <Text style={{ fontSize: 12, color: colors.text }}>💰 Price: {formatCurrencyAbs(tickResult.price)}</Text>
                      )}
                      {tickResult.signals_count != null && (
                        <Text style={{ fontSize: 12, color: colors.text }}>📡 Signals: {tickResult.signals_count}</Text>
                      )}
                      {tickResult.executions_count != null && (
                        <Text style={{ fontSize: 12, color: colors.text }}>⚡ Executions: {tickResult.executions_count}</Text>
                      )}
                      {tickResult.new_status && (
                        <Text style={{ fontSize: 12, color: colors.text }}>🔄 New Status: {tickResult.new_status}</Text>
                      )}
                      {tickResult.error && (
                        <View style={{ marginTop: 6, padding: 10, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderRadius: 8 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#ef4444', marginBottom: 4 }}>ERROR DETAILS:</Text>
                          <Text style={{ fontSize: 12, color: '#ef4444', lineHeight: 18 }} selectable>{tickResult.error}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {/* ── Error Message da estratégia (expandível) ── */}
              {strategy.error_message && !tickResult && (
                <TouchableOpacity
                  style={[styles.tickResultBanner, {
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    borderColor: '#ef4444',
                  }]}
                  onPress={() => setExpandedError(!expandedError)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Text style={{ fontSize: 16 }}>⚠️</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#ef4444' }} numberOfLines={expandedError ? undefined : 1}>
                        {expandedError ? 'Erro na última execução' : strategy.error_message}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{expandedError ? '▲' : '▼'}</Text>
                  </View>
                  {expandedError && (
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#ef4444', marginBottom: 4 }}>ERROR DETAILS:</Text>
                      <Text style={{ fontSize: 12, color: '#ef4444', lineHeight: 18 }} selectable>{strategy.error_message}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('strategy.name')}</Text>
                <Text style={[styles.strategyName, { color: colors.text }]}>{strategy.name}</Text>
                {strategy.description ? <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>{strategy.description}</Text> : null}
              </View>
              {renderPositionCard()}
              {renderPnlSummary()}
              {renderConfig()}
              {renderTakeProfitLevels()}
              {renderStopLoss()}
              {renderDcaConfig()}
              {renderDates()}
            </>
          )}
          {activeTab === 'executions' && renderExecutionsList()}
          {activeTab === 'signals' && renderSignalsList()}
          <View style={{ height: 120 }} />
        </ScrollView>
      </>
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
              <Text style={[styles.title, { color: colors.text }]}>{t('strategy.details')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={[styles.closeIcon, { color: colors.text }]}>✕</Text>
              </TouchableOpacity>
            </View>

          {renderContent()}

          {!loading && !error && strategy && (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.footerButton, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]}
                onPress={handleTick}
                disabled={ticking}
                activeOpacity={0.7}
              >
                {ticking ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.footerButtonText, { color: colors.primary }]}>{t('strategy.triggerManual') || '⚡ Tick'}</Text>
                )}
              </TouchableOpacity>

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
                  {strategy.is_active ? (t('strategy.deactivate') || 'Desativar') : (t('strategy.activate') || 'Ativar')}
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
                  <Text style={[styles.footerButtonText, { color: '#ef4444' }]}>{t('strategy.delete') || 'Excluir'}</Text>
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
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
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
  tickResultBanner: {
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
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
    maxWidth: '55%',
    textAlign: 'right',
  },
  dateDivider: {
    height: 0.5,
    marginVertical: 8,
  },
  // Stats grid
  statsGrid: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statsCell: {
    flex: 1,
    alignItems: 'center',
  },
  statsLabel: {
    fontSize: 11,
    fontWeight: '300',
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  // Execution/Signal cards
  execCard: {
    borderRadius: 10,
    borderWidth: 0.5,
    padding: 12,
    marginBottom: 8,
  },
  execBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderTopWidth: 0.5,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    minHeight: 44,
  },
  footerButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
})
