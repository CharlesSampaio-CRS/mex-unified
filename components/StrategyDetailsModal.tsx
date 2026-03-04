import React, { useEffect, useState, useCallback } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { 
  StrategyDetail, 
  StrategyStatus, 
  StrategyStatsResponse} from '@/hooks/useBackendStrategies'
import { apiService } from '@/services/api'
import { capitalizeExchangeName } from '@/lib/exchange-helpers'
import { typography, fontWeights } from '@/lib/typography'
import { EditStrategyModal } from './edit-strategy-modal'

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
  const [activeTab, setActiveTab] = useState<'overview' | 'signals'>('overview')
  const [tickResult, setTickResult] = useState<{
    success: boolean;
    error?: string;
    price?: number;
    signals_count?: number;
    executions_count?: number;
    new_status?: string;
    summary?: string;
    signals?: Array<{ signal_type: string; price: number; message: string; acted: boolean; price_change_percent: number; created_at: number }>;
    executions?: Array<{ execution_id: string; action: string; reason: string; price: number; amount: number; pnl_usd: number; fee: number; error_message?: string; executed_at: number }>;
    acted_count?: number;
    info_count?: number;
  } | null>(null)
  const [expandedError, setExpandedError] = useState(false)
  const [expandedTickResult, setExpandedTickResult] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

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
      setShowEditModal(false)
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
          summary: tick.summary || undefined,
          signals: tick.signals || [],
          executions: tick.executions || [],
          acted_count: tick.acted_count || 0,
          info_count: tick.info_count || 0,
        }
        setTickResult(tickInfo)
        // Auto-expand if there's an error or an execution happened
        if (tick.error || tick.executions_count > 0) {
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
      in_position: t('strategy.statusInPosition') || 'In Position',
      gradual_selling: 'Gradual Selling',
      completed: t('strategy.statusCompleted') || 'Completed',
      stopped_out: 'Stopped Out',
      expired: 'Expired',
      paused: t('strategy.paused') || 'Paused',
      error: t('strategy.statusError') || 'Error',
    }
    return map[status] || status
  }

  const getStatusColor = (status: StrategyStatus) => {
    const map: Record<StrategyStatus, { bg: string; text: string; dot: string }> = {
      monitoring: { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6', dot: '#3b82f6' },
      in_position: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', dot: '#10b981' },
      gradual_selling: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', dot: '#f59e0b' },
      completed: { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6', dot: '#8b5cf6' },
      stopped_out: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', dot: '#ef4444' },
      expired: { bg: 'rgba(107, 114, 128, 0.12)', text: '#6b7280', dot: '#6b7280' },
      error: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', dot: '#ef4444' },
      paused: { bg: 'rgba(107, 114, 128, 0.12)', text: '#6b7280', dot: '#6b7280' },
      idle: { bg: 'rgba(107, 114, 128, 0.12)', text: '#9ca3af', dot: '#9ca3af' },
    }
    return map[status] || map.idle
  }

  const getExecutionLabel = (action: string): { text: string; color: string; emoji: string } => {
    const map: Record<string, { text: string; color: string; emoji: string }> = {
      buy: { text: 'Compra', color: '#10b981', emoji: '📥' },
      sell: { text: 'Venda', color: '#f59e0b', emoji: '📤' },
      buy_failed: { text: 'Compra Falhou', color: '#ef4444', emoji: '❌' },
      sell_failed: { text: 'Venda Falhou', color: '#ef4444', emoji: '❌' },
    }
    return map[action] || { text: action, color: colors.textSecondary, emoji: '📊' }
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
        {strategy.trigger_price != null && strategy.trigger_price > 0 && (
          <Text style={{ fontSize: typography.tiny, color: '#10b981', fontWeight: fontWeights.medium }}>
            TP: {formatCurrencyAbs(strategy.trigger_price)}
          </Text>
        )}
        {strategy.stop_loss_price != null && strategy.stop_loss_price > 0 && (strategy.config as any).stop_loss_enabled !== false && (
          <Text style={{ fontSize: typography.tiny, color: '#ef4444', fontWeight: fontWeights.medium }}>
            SL: {formatCurrencyAbs(strategy.stop_loss_price)}
          </Text>
        )}
        {(strategy.config as any).stop_loss_enabled === false && (
          <Text style={{ fontSize: typography.tiny, color: '#6b7280', fontWeight: fontWeights.medium }}>
            SL: OFF
          </Text>
        )}
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
            <Text style={[styles.infoValue, { color: colors.text }]}>{(pos.quantity ?? 0).toFixed(6)}</Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('strategy.currentPrice') || 'Current Price'}</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{formatCurrencyAbs(pos.current_price)}</Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('strategy.unrealizedPnl') || 'Unrealized P&L'}</Text>
            <Text style={[styles.infoValue, { color: (pos.unrealized_pnl ?? 0) >= 0 ? '#10b981' : '#ef4444' }]}>
              {formatCurrency(pos.unrealized_pnl)} ({(pos.unrealized_pnl_percent ?? 0) >= 0 ? '+' : ''}{(pos.unrealized_pnl_percent ?? 0).toFixed(2)}%)
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
                  <Text style={[styles.statsValue, { color: colors.text }]}>{(stats.win_rate ?? 0).toFixed(1)}%</Text>
                </View>
                <View style={styles.statsCell}>
                  <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>{t('strategy.totalSells') || 'Total Sells'}</Text>
                  <Text style={[styles.statsValue, { color: colors.text }]}>{stats.total_sells ?? 0}</Text>
                </View>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statsRow}>
                <View style={styles.statsCell}>
                  <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>{t('strategy.totalFees') || 'Total Fees'}</Text>
                  <Text style={[styles.statsValue, { color: colors.textSecondary }]}>${(stats.total_fees ?? 0).toFixed(2)}</Text>
                </View>
                <View style={styles.statsCell}>
                  <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>{t('strategy.currentPosition') || 'Position'}</Text>
                  <Text style={[styles.statsValue, { color: colors.text }]}>
                    {stats.current_position ? `${stats.current_position.quantity?.toFixed(6) ?? '0'}` : 'None'}
                  </Text>
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
    const cfg = strategy.config
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
              <Text style={{ fontSize: typography.h4 }}>🪙</Text>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('strategy.tradingPair')}</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.text }]}>{strategy.symbol}</Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Text style={{ fontSize: typography.h4 }}>💰</Text>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Preço de Compra</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.text }]}>{formatCurrencyAbs(cfg.base_price)}</Text>
          </View>
          {(cfg as any).invested_amount > 0 && (
            <>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <Text style={{ fontSize: typography.h4 }}>💵</Text>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Valor Investido</Text>
                </View>
                <Text style={[styles.infoValue, { color: '#f59e0b' }]}>${(cfg as any).invested_amount.toFixed(2)}</Text>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <Text style={{ fontSize: typography.h4 }}>🔒</Text>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Double-check</Text>
                </View>
                <Text style={[styles.infoValue, { color: '#f59e0b' }]}>Ativo — ~{((cfg as any).invested_amount / cfg.base_price).toFixed(4)} moedas</Text>
              </View>
            </>
          )}
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Text style={{ fontSize: typography.h4 }}>🎯</Text>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Take Profit</Text>
            </View>
            <Text style={[styles.infoValue, { color: '#10b981' }]}>+{cfg.take_profit_percent}%</Text>
          </View>
          {strategy.trigger_price != null && strategy.trigger_price > 0 && (
            <>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <Text style={{ fontSize: typography.h4 }}>📈</Text>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Preço Trigger</Text>
                </View>
                <Text style={[styles.infoValue, { color: '#10b981' }]}>{formatCurrencyAbs(strategy.trigger_price)}</Text>
              </View>
            </>
          )}
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Text style={{ fontSize: typography.h4 }}>🛡️</Text>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Stop Loss</Text>
            </View>
            {(cfg as any).stop_loss_enabled === false ? (
              <Text style={[styles.infoValue, { color: '#6b7280' }]}>🚫 Desativado</Text>
            ) : (
              <Text style={[styles.infoValue, { color: '#ef4444' }]}>-{cfg.stop_loss_percent}%</Text>
            )}
          </View>
          {(cfg as any).stop_loss_enabled !== false && strategy.stop_loss_price != null && strategy.stop_loss_price > 0 && (
            <>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <Text style={{ fontSize: typography.h4 }}>📉</Text>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Preço Stop</Text>
                </View>
                <Text style={[styles.infoValue, { color: '#ef4444' }]}>{formatCurrencyAbs(strategy.stop_loss_price)}</Text>
              </View>
            </>
          )}
          {(cfg as any).dca_enabled && (
            <>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <Text style={{ fontSize: typography.h4 }}>📉</Text>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>DCA (Dollar Cost Avg)</Text>
                </View>
                <Text style={[styles.infoValue, { color: '#3b82f6' }]}>Ativo</Text>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <Text style={{ fontSize: typography.h4 }}>💰</Text>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Valor DCA</Text>
                </View>
                <Text style={[styles.infoValue, { color: '#3b82f6' }]}>${(cfg as any).dca_buy_amount_usd?.toFixed(2) ?? '—'}</Text>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <Text style={{ fontSize: typography.h4 }}>📊</Text>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Trigger / Max</Text>
                </View>
                <Text style={[styles.infoValue, { color: '#3b82f6' }]}>-{(cfg as any).dca_trigger_percent ?? 5}% · {strategy.dca_buys_done ?? 0}/{(cfg as any).dca_max_buys ?? 3} compras</Text>
              </View>
            </>
          )}
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Text style={{ fontSize: typography.h4 }}>📊</Text>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Taxa</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.text }]}>{cfg.fee_percent}%</Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Text style={{ fontSize: typography.h4 }}>⏱️</Text>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Expiração</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.text }]}>{cfg.time_execution_min}min ({(cfg.time_execution_min / 60).toFixed(1)}h)</Text>
          </View>
          {strategy.last_price != null && strategy.last_price > 0 && (
            <>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <Text style={{ fontSize: typography.h4 }}>💲</Text>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('strategy.lastPrice') || 'Último Preço'}</Text>
                </View>
                <Text style={[styles.infoValue, { color: colors.text }]}>{formatCurrencyAbs(strategy.last_price)}</Text>
              </View>
            </>
          )}
        </View>
      </View>
    )
  }

  const renderGradualLots = () => {
    if (!strategy?.config?.gradual_sell) return null
    const cfg = strategy.config
    const lots = cfg.gradual_lots || []
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>VENDA GRADUAL</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Gradual Take</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>+{cfg.gradual_take_percent}%</Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Timer entre lotes</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{cfg.timer_gradual_min}min</Text>
          </View>
        </View>
        {lots.length > 0 && (
          <View style={[styles.conditionsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 10 }]}>
            {lots.map((lot, index) => (
              <View key={index}>
                {index > 0 && <View style={[styles.conditionDivider, { backgroundColor: colors.border }]} />}
                <View style={styles.conditionRow}>
                  <View style={[styles.conditionBullet, { backgroundColor: lot.executed ? '#8b5cf6' : '#f59e0b' }]} />
                  <View style={styles.conditionContent}>
                    <Text style={[styles.conditionText, { color: colors.text }]}>
                      Lote {lot.lot_number}: <Text style={{ fontWeight: fontWeights.regular }}>{lot.sell_percent}%</Text>
                      {lot.executed && <Text style={{ color: '#8b5cf6', fontWeight: fontWeights.regular }}> ✓</Text>}
                    </Text>
                    <Text style={[styles.conditionSubtext, { color: colors.textSecondary }]}>
                      {lot.executed ? `Vendido @ ${formatCurrencyAbs(lot.executed_price)} · PnL: ${formatCurrency(lot.realized_pnl)}` : 'Pendente'}
                      {lot.executed_at ? ` · ${formatDate(lot.executed_at)}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    )
  }

  const renderExecutionsList = () => {
    const execs = (strategy as StrategyDetail)?.executions || []
    if (execs.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: typography.emojiLarge, marginBottom: 12 }}>📊</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('strategy.noExecutions') || 'Nenhuma execução ainda'}</Text>
          <Text style={{ fontSize: typography.caption, color: colors.textSecondary, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }}>
            Execuções aparecem quando o sistema executa ordens na exchange (take profit, stop loss, DCA ou venda gradual).
          </Text>
        </View>
      )
    }

    const getReasonLabel = (reason: string): string => {
      const map: Record<string, string> = {
        'take_profit': '🎯 Take Profit',
        'stop_loss': '🛑 Stop Loss',
        'gradual_sell': '📈 Venda Gradual',
        'dca_buy': '📉 DCA Buy',
      }
      if (reason.startsWith('sell_failed:')) return '❌ ' + reason.replace('sell_failed:', '').trim()
      if (reason.startsWith('stop_loss_failed:')) return '🛑❌ ' + reason.replace('stop_loss_failed:', '').trim()
      return map[reason] || reason.replace(/_/g, ' ')
    }

    // ── Summary Stats ──
    const totalPnl = execs.reduce((sum, e) => sum + (e.pnl_usd ?? 0), 0)
    const successExecs = execs.filter(e => e.action === 'sell' || e.action === 'buy')
    const failedExecs = execs.filter(e => e.action === 'sell_failed' || e.action === 'buy_failed')
    const wins = successExecs.filter(e => (e.pnl_usd ?? 0) > 0).length
    const winRate = successExecs.length > 0 ? (wins / successExecs.length) * 100 : 0
    const totalFees = execs.reduce((sum, e) => sum + (e.fee ?? 0), 0)
    const totalPnlColor = totalPnl >= 0 ? '#10b981' : '#ef4444'

    return (
      <View style={{ paddingTop: 12 }}>
        {/* ── Resumo de Execuções ── */}
        <View style={[styles.statsGrid, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginBottom: 12 }]}>
          <Text style={{ fontSize: typography.tiny, fontWeight: fontWeights.bold, color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 10 }}>
            📊 RESUMO DE EXECUÇÕES
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statsCell}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>PnL Total</Text>
              <Text style={[styles.statsValue, { color: totalPnlColor, fontSize: typography.bodyLarge, fontWeight: fontWeights.bold }]}>
                {formatCurrency(totalPnl)}
              </Text>
            </View>
            <View style={styles.statsCell}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>Win Rate</Text>
              <Text style={[styles.statsValue, { color: winRate >= 50 ? '#10b981' : '#f59e0b', fontSize: typography.bodyLarge, fontWeight: fontWeights.bold }]}>
                {winRate.toFixed(0)}%
              </Text>
            </View>
            <View style={styles.statsCell}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>Operações</Text>
              <Text style={[styles.statsValue, { color: colors.text, fontSize: typography.bodyLarge, fontWeight: fontWeights.bold }]}>
                {execs.length}
              </Text>
            </View>
          </View>
          <View style={{ height: 0.5, backgroundColor: colors.border, marginVertical: 8 }} />
          <View style={styles.statsRow}>
            <View style={styles.statsCell}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>✅ Sucesso</Text>
              <Text style={{ fontSize: typography.bodySmall, fontWeight: fontWeights.semibold, color: '#10b981' }}>{successExecs.length}</Text>
            </View>
            <View style={styles.statsCell}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>❌ Falhas</Text>
              <Text style={{ fontSize: typography.bodySmall, fontWeight: fontWeights.semibold, color: failedExecs.length > 0 ? '#ef4444' : colors.textSecondary }}>{failedExecs.length}</Text>
            </View>
            <View style={styles.statsCell}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>💸 Fees</Text>
              <Text style={{ fontSize: typography.bodySmall, fontWeight: fontWeights.semibold, color: colors.textSecondary }}>${totalFees.toFixed(4)}</Text>
            </View>
          </View>
        </View>

        {/* ── Lista de Execuções ── */}
        <Text style={{ fontSize: typography.tiny, fontWeight: fontWeights.bold, color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 8, marginTop: 4 }}>
          HISTÓRICO ({Math.min(execs.length, 30)} de {execs.length})
        </Text>
        {execs.slice(0, 30).map((exec, idx) => {
          const label = getExecutionLabel(exec.action)
          const isFailure = exec.action === 'sell_failed' || exec.action === 'buy_failed'
          const pnlColor = isFailure ? '#ef4444' : (exec.pnl_usd ?? 0) >= 0 ? '#10b981' : '#ef4444'
          return (
            <View key={exec.execution_id || idx} style={[styles.execCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: label.color }]}>
              {/* Header: Tipo + Source + Data */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexShrink: 1, flexWrap: 'wrap' }}>
                  <View style={[styles.execBadge, { backgroundColor: label.color + '18' }]}>
                    <Text style={{ fontSize: typography.tiny, fontWeight: fontWeights.semibold, color: label.color }}>{label.emoji} {label.text}</Text>
                  </View>
                  {exec.source && (
                    <View style={{ backgroundColor: exec.source === 'user' ? '#8b5cf6' + '18' : '#6b7280' + '18', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontSize: typography.badge, fontWeight: fontWeights.bold, color: exec.source === 'user' ? '#8b5cf6' : '#6b7280' }}>
                        {exec.source === 'user' ? '👤' : '⚙️'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: typography.micro, color: colors.textSecondary, flexShrink: 0 }}>{formatDate(exec.executed_at)}</Text>
              </View>

              {/* Quantidade e Preço */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'flex-start', gap: 8 }}>
                <View style={{ flex: 1, flexShrink: 1 }}>
                  <Text style={{ fontSize: typography.caption, color: colors.textSecondary }} numberOfLines={1}>
                    {(exec.amount ?? 0).toFixed(6)} @ {formatCurrencyAbs(exec.price)}
                  </Text>
                  {exec.fee != null && exec.fee > 0 && (
                    <Text style={{ fontSize: typography.micro, color: colors.textSecondary, marginTop: 2 }}>Fee: ${exec.fee.toFixed(4)}</Text>
                  )}
                </View>
                {!isFailure && (
                  <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                    <Text style={{ fontSize: typography.bodyLarge, fontWeight: fontWeights.bold, color: pnlColor }}>{formatCurrency(exec.pnl_usd)}</Text>
                    <Text style={{ fontSize: typography.micro, color: pnlColor }}>{(exec.pnl_usd ?? 0) >= 0 ? 'Lucro' : 'Perda'}</Text>
                  </View>
                )}
              </View>

              {/* Motivo */}
              {exec.reason && (
                <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border + '40' }}>
                  <Text style={{ fontSize: typography.tiny, color: colors.textSecondary }}>
                    {getReasonLabel(exec.reason)}
                  </Text>
                </View>
              )}

              {/* Erro (se falhou) */}
              {exec.error_message && (
                <View style={{ marginTop: 6, padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderRadius: 6 }}>
                  <Text style={{ fontSize: typography.tiny, color: '#ef4444' }}>⚠️ {exec.error_message}</Text>
                </View>
              )}

              {/* Exchange Order ID */}
              {exec.exchange_order_id && (
                <Text style={{ fontSize: typography.micro, color: colors.textSecondary + '80', marginTop: 4 }}>
                  ID: {exec.exchange_order_id}
                </Text>
              )}
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
          <Text style={{ fontSize: typography.emojiLarge, marginBottom: 12 }}>📡</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('strategy.noSignals') || 'Nenhum sinal ainda'}</Text>
          <Text style={{ fontSize: typography.caption, color: colors.textSecondary, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }}>
            Sinais são gerados a cada tick do monitor quando o preço se aproxima ou ultrapassa os alvos configurados.
          </Text>
        </View>
      )
    }

    const signalTypeLabels: Record<string, { label: string; emoji: string }> = {
      take_profit: { label: 'TAKE PROFIT', emoji: '🎯' },
      stop_loss: { label: 'STOP LOSS', emoji: '🛑' },
      gradual_sell: { label: 'GRADUAL', emoji: '📈' },
      dca_buy: { label: 'DCA', emoji: '📉' },
      expired: { label: 'EXPIRADO', emoji: '⏰' },
      info: { label: 'INFO', emoji: 'ℹ️' },
    }

    const sigColors: Record<string, string> = {
      take_profit: '#10b981', stop_loss: '#ef4444',
      gradual_sell: '#f59e0b', dca_buy: '#3b82f6',
      expired: '#6b7280', info: '#6b7280',
    }

    // ── Summary Stats ──
    const totalSignals = sigs.length
    const actedSignals = sigs.filter(s => s.acted).length
    const typeCounts: Record<string, number> = {}
    sigs.forEach(s => { typeCounts[s.signal_type] = (typeCounts[s.signal_type] || 0) + 1 })

    return (
      <View style={{ paddingTop: 12 }}>
        {/* ── Resumo de Sinais ── */}
        <View style={[styles.statsGrid, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginBottom: 12 }]}>
          <Text style={{ fontSize: typography.tiny, fontWeight: fontWeights.bold, color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 10 }}>
            📡 RESUMO DE SINAIS
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statsCell}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>Total</Text>
              <Text style={[styles.statsValue, { color: colors.text, fontSize: typography.bodyLarge, fontWeight: fontWeights.bold }]}>{totalSignals}</Text>
            </View>
            <View style={styles.statsCell}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>Executados</Text>
              <Text style={[styles.statsValue, { color: actedSignals > 0 ? '#10b981' : colors.textSecondary, fontSize: typography.bodyLarge, fontWeight: fontWeights.bold }]}>{actedSignals}</Text>
            </View>
            <View style={styles.statsCell}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>Taxa Ação</Text>
              <Text style={[styles.statsValue, { color: actedSignals > 0 ? '#f59e0b' : colors.textSecondary, fontSize: typography.bodyLarge, fontWeight: fontWeights.bold }]}>
                {totalSignals > 0 ? ((actedSignals / totalSignals) * 100).toFixed(0) : 0}%
              </Text>
            </View>
          </View>
          {/* ── Breakdown por tipo ── */}
          {Object.keys(typeCounts).length > 1 && (
            <>
              <View style={{ height: 0.5, backgroundColor: colors.border, marginVertical: 8 }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(typeCounts).map(([type, count]) => {
                  const color = sigColors[type] || colors.textSecondary
                  const info = signalTypeLabels[type] || { label: type.toUpperCase(), emoji: '📡' }
                  return (
                    <View key={type} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ fontSize: typography.tiny }}>{info.emoji}</Text>
                      <Text style={{ fontSize: typography.tiny, fontWeight: fontWeights.semibold, color }}>{count}</Text>
                    </View>
                  )
                })}
              </View>
            </>
          )}
        </View>

        {/* ── Lista de Sinais ── */}
        <Text style={{ fontSize: typography.tiny, fontWeight: fontWeights.bold, color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 8, marginTop: 4 }}>
          HISTÓRICO ({Math.min(sigs.length, 30)} de {sigs.length})
        </Text>
        {sigs.slice(0, 30).map((sig, idx) => {
          const sigColor = sigColors[sig.signal_type] || colors.textSecondary
          const typeInfo = signalTypeLabels[sig.signal_type] || { label: sig.signal_type.toUpperCase(), emoji: '📡' }
          return (
            <View key={idx} style={[styles.execCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: sigColor }]}>
              {/* Header: Tipo + Acted + Source + Data */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexShrink: 1, flexWrap: 'wrap' }}>
                  <View style={[styles.execBadge, { backgroundColor: sigColor + '18' }]}>
                    <Text style={{ fontSize: typography.tiny, fontWeight: fontWeights.semibold, color: sigColor }}>{typeInfo.emoji} {typeInfo.label}</Text>
                  </View>
                  {sig.acted && (
                    <View style={{ backgroundColor: '#10b981', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontSize: typography.badge, fontWeight: fontWeights.bold, color: '#fff' }}>EXEC</Text>
                    </View>
                  )}
                  {sig.source && (
                    <View style={{ backgroundColor: sig.source === 'user' ? '#8b5cf6' + '18' : '#6b7280' + '18', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontSize: typography.badge, fontWeight: fontWeights.bold, color: sig.source === 'user' ? '#8b5cf6' : '#6b7280' }}>
                        {sig.source === 'user' ? '👤' : '⚙️'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: typography.micro, color: colors.textSecondary, flexShrink: 0 }}>{formatDate(sig.created_at)}</Text>
              </View>

              {/* Mensagem */}
              <Text style={{ fontSize: typography.caption, color: colors.text, marginTop: 8, lineHeight: 18 }} numberOfLines={3}>{sig.message}</Text>

              {/* Footer: Preço + Variação */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border + '40', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <Text style={{ fontSize: typography.tiny, color: colors.textSecondary }}>💰 Preço: {formatCurrencyAbs(sig.price)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{
                    backgroundColor: ((sig.price_change_percent ?? 0) >= 0 ? '#10b981' : '#ef4444') + '15',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}>
                    <Text style={{ fontSize: typography.caption, fontWeight: fontWeights.semibold, color: (sig.price_change_percent ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>
                      {(sig.price_change_percent ?? 0) >= 0 ? '▲' : '▼'} {(sig.price_change_percent ?? 0) >= 0 ? '+' : ''}{(sig.price_change_percent ?? 0).toFixed(2)}%
                    </Text>
                  </View>
                </View>
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
                <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{t('strategy.lastChecked') || 'Última Verificação'}</Text>
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
    const sigCount = (strategy as StrategyDetail)?.signals?.length || 0
    const execCount = (strategy as StrategyDetail)?.executions?.length || 0
    const totalActivity = sigCount + execCount
    const tabs = [
      { key: 'overview' as const, label: t('strategy.overview') || 'Visão Geral' },
      { key: 'signals' as const, label: `${t('strategy.signals') || 'Sinais'} (${totalActivity})` },
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
          <ActivityIndicator size="small" />
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
                    backgroundColor: tickResult.error
                      ? 'rgba(239, 68, 68, 0.08)'
                      : (tickResult.executions_count ?? 0) > 0
                        ? 'rgba(245, 158, 11, 0.08)'
                        : 'rgba(16, 185, 129, 0.08)',
                    borderColor: tickResult.error
                      ? '#ef4444'
                      : (tickResult.executions_count ?? 0) > 0
                        ? '#f59e0b'
                        : '#10b981',
                  }]}
                  onPress={() => setExpandedTickResult(!expandedTickResult)}
                  activeOpacity={0.7}
                >
                  {/* ── Resumo compacto ── */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Text style={{ fontSize: typography.h4 }}>
                        {tickResult.error ? '❌' : (tickResult.executions_count ?? 0) > 0 ? '⚡' : '✅'}
                      </Text>
                      <Text style={{ fontSize: typography.bodySmall, fontWeight: fontWeights.semibold, color: tickResult.error ? '#ef4444' : (tickResult.executions_count ?? 0) > 0 ? '#f59e0b' : '#10b981' }} numberOfLines={expandedTickResult ? undefined : 1}>
                        {tickResult.summary || (tickResult.error ? 'Tick com erro' : 'Tick executado')}
                      </Text>
                    </View>
                    <Text style={{ fontSize: typography.caption, color: colors.textSecondary }}>{expandedTickResult ? '▲' : '▼'}</Text>
                  </View>

                  {/* ── Detalhes expandidos ── */}
                  {expandedTickResult && (
                    <View style={{ marginTop: 10, gap: 6 }}>
                      {/* Preço atual */}
                      {tickResult.price != null && tickResult.price > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: typography.caption, color: colors.textSecondary }}>💰 Preço atual:</Text>
                          <Text style={{ fontSize: typography.bodySmall, fontWeight: fontWeights.semibold, color: colors.text }}>{formatCurrencyAbs(tickResult.price)}</Text>
                        </View>
                      )}

                      {/* Contadores resumo */}
                      <View style={{ flexDirection: 'row', gap: 16, marginTop: 2, flexWrap: 'wrap' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ fontSize: typography.tiny, color: colors.textSecondary }}>📡 Sinais:</Text>
                          <Text style={{ fontSize: typography.caption, fontWeight: fontWeights.semibold, color: colors.text }}>{tickResult.signals_count ?? 0}</Text>
                        </View>
                        {(tickResult.acted_count ?? 0) > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={{ fontSize: typography.tiny, color: '#f59e0b' }}>🎯 Executados:</Text>
                            <Text style={{ fontSize: typography.caption, fontWeight: fontWeights.semibold, color: '#f59e0b' }}>{tickResult.acted_count}</Text>
                          </View>
                        )}
                        {(tickResult.executions_count ?? 0) > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={{ fontSize: typography.tiny, color: '#f59e0b' }}>⚡ Ordens:</Text>
                            <Text style={{ fontSize: typography.caption, fontWeight: fontWeights.semibold, color: '#f59e0b' }}>{tickResult.executions_count}</Text>
                          </View>
                        )}
                      </View>

                      {/* Status alterado */}
                      {tickResult.new_status && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <Text style={{ fontSize: typography.caption, color: '#8b5cf6' }}>🔄 Novo status:</Text>
                          <Text style={{ fontSize: typography.caption, fontWeight: fontWeights.semibold, color: '#8b5cf6' }}>
                            {getStatusLabel(tickResult.new_status as StrategyStatus)}
                          </Text>
                        </View>
                      )}

                      {/* ── Sinais detalhados ── */}
                      {tickResult.signals && tickResult.signals.length > 0 && (
                        <View style={{ marginTop: 8, gap: 6 }}>
                          <Text style={{ fontSize: typography.tiny, fontWeight: fontWeights.bold, color: colors.textSecondary, letterSpacing: 0.5 }}>SINAIS DO TICK</Text>
                          {tickResult.signals.map((sig, idx) => {
                            const sigColorMap: Record<string, string> = {
                              take_profit: '#10b981', stop_loss: '#ef4444',
                              gradual_sell: '#f59e0b', expired: '#6b7280',
                              info: colors.textSecondary,
                            }
                            const sigColor = sigColorMap[sig.signal_type] || colors.textSecondary
                            return (
                              <View key={idx} style={{ backgroundColor: sigColor + '0D', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: sigColor }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, flexWrap: 'wrap' }}>
                                    <Text style={{ fontSize: typography.tiny, fontWeight: fontWeights.semibold, color: sigColor }}>
                                      {sig.signal_type.replace('_', ' ').toUpperCase()}
                                    </Text>
                                    {sig.acted && (
                                      <View style={{ backgroundColor: '#10b981', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                                        <Text style={{ fontSize: typography.badge, fontWeight: fontWeights.bold, color: '#fff' }}>EXECUTADO</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={{ fontSize: typography.tiny, fontWeight: fontWeights.medium, color: (sig.price_change_percent ?? 0) >= 0 ? '#10b981' : '#ef4444', flexShrink: 0 }}>
                                    {(sig.price_change_percent ?? 0) >= 0 ? '+' : ''}{(sig.price_change_percent ?? 0).toFixed(2)}%
                                  </Text>
                                </View>
                                <Text style={{ fontSize: typography.caption, color: colors.text, lineHeight: 18 }} numberOfLines={3}>{sig.message}</Text>
                              </View>
                            )
                          })}
                        </View>
                      )}

                      {/* ── Execuções do tick ── */}
                      {tickResult.executions && tickResult.executions.length > 0 && (
                        <View style={{ marginTop: 8, gap: 6 }}>
                          <Text style={{ fontSize: typography.tiny, fontWeight: fontWeights.bold, color: colors.textSecondary, letterSpacing: 0.5 }}>ORDENS EXECUTADAS</Text>
                          {tickResult.executions.map((exec, idx) => {
                            const isFailure = exec.action === 'sell_failed' || exec.action === 'buy_failed'
                            const execColor = isFailure ? '#ef4444' : (exec.pnl_usd >= 0 ? '#10b981' : '#ef4444')
                            return (
                              <View key={exec.execution_id || idx} style={{ backgroundColor: execColor + '0D', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: execColor }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                  <Text style={{ fontSize: typography.caption, fontWeight: fontWeights.semibold, color: execColor, flexShrink: 1 }}>
                                    {isFailure ? '❌ FALHOU' : exec.action === 'sell' ? '📤 VENDA' : '📥 COMPRA'}
                                  </Text>
                                  {!isFailure && (
                                    <Text style={{ fontSize: typography.bodySmall, fontWeight: fontWeights.bold, color: exec.pnl_usd >= 0 ? '#10b981' : '#ef4444', flexShrink: 0 }}>
                                      {formatCurrency(exec.pnl_usd)}
                                    </Text>
                                  )}
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, flexWrap: 'wrap', gap: 4 }}>
                                  <Text style={{ fontSize: typography.tiny, color: colors.textSecondary }} numberOfLines={1}>
                                    {(exec.amount ?? 0).toFixed(6)} @ {formatCurrencyAbs(exec.price)}
                                  </Text>
                                  {exec.fee > 0 && (
                                    <Text style={{ fontSize: typography.tiny, color: colors.textSecondary, flexShrink: 0 }}>Fee: ${exec.fee.toFixed(4)}</Text>
                                  )}
                                </View>
                                {exec.reason && (
                                  <Text style={{ fontSize: typography.tiny, color: colors.textSecondary, marginTop: 3, fontStyle: 'italic' }}>
                                    Motivo: {exec.reason.replace(/_/g, ' ')}
                                  </Text>
                                )}
                                {exec.error_message && (
                                  <Text style={{ fontSize: typography.tiny, color: '#ef4444', marginTop: 3 }}>⚠️ {exec.error_message}</Text>
                                )}
                              </View>
                            )
                          })}
                        </View>
                      )}

                      {/* ── Erro ── */}
                      {tickResult.error && (
                        <View style={{ marginTop: 6, padding: 10, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderRadius: 8 }}>
                          <Text style={{ fontSize: typography.tiny, fontWeight: fontWeights.semibold, color: '#ef4444', marginBottom: 4 }}>DETALHES DO ERRO:</Text>
                          <Text style={{ fontSize: typography.caption, color: '#ef4444', lineHeight: 18 }} selectable>{tickResult.error}</Text>
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
                      <Text style={{ fontSize: typography.h4 }}>⚠️</Text>
                      <Text style={{ fontSize: typography.bodySmall, fontWeight: fontWeights.semibold, color: '#ef4444' }} numberOfLines={expandedError ? undefined : 1}>
                        {expandedError ? 'Erro na última execução' : strategy.error_message}
                      </Text>
                    </View>
                    <Text style={{ fontSize: typography.caption, color: colors.textSecondary }}>{expandedError ? '▲' : '▼'}</Text>
                  </View>
                  {expandedError && (
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: 'rgba(239, 68, 68, 0.06)', borderRadius: 8 }}>
                      <Text style={{ fontSize: typography.tiny, fontWeight: fontWeights.semibold, color: '#ef4444', marginBottom: 4 }}>ERROR DETAILS:</Text>
                      <Text style={{ fontSize: typography.caption, color: '#ef4444', lineHeight: 18 }} selectable>{strategy.error_message}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('strategy.name')}</Text>
                <Text style={[styles.strategyName, { color: colors.text }]}>{strategy.name}</Text>
                {strategy.started_at ? <Text style={{ fontSize: typography.caption, color: colors.textSecondary, marginTop: 4 }}>Início: {formatDate(strategy.started_at)}</Text> : null}
              </View>
              {renderPositionCard()}
              {renderPnlSummary()}
              {renderConfig()}
              {renderGradualLots()}
              {renderDates()}
            </>
          )}
          {activeTab === 'signals' && (
            <>
              {renderExecutionsList()}
              {renderSignalsList()}
            </>
          )}
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
                <View style={styles.footerRow}>
                  <TouchableOpacity
                    style={[styles.footerButton, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]}
                    onPress={handleTick}
                    disabled={ticking}
                    activeOpacity={0.7}
                  >
                    {ticking ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Text style={[styles.footerButtonText, { color: colors.primary }]}>⚡ Tick</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.footerButton, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: '#f59e0b' }]}
                    onPress={() => setShowEditModal(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.footerButtonText, { color: '#f59e0b' }]}>✏️ Editar</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.footerRow}>
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
                      {strategy.is_active ? '⏸ Desativar' : '▶️ Ativar'}
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
                      <Text style={[styles.footerButtonText, { color: '#ef4444' }]}>🗑 Excluir</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>

        {/* Edit Strategy Modal — fora do modalContainer para não ser cortado */}
        <EditStrategyModal
          visible={showEditModal}
          strategy={strategy}
          onClose={() => setShowEditModal(false)}
          onSuccess={(updated) => {
            setStrategy(updated as any)
            setShowEditModal(false)
          }}
        />
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
    borderRadius: 16,
    width: '90%',
    maxHeight: '85%',
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: typography.h3,
    fontWeight: fontWeights.medium,
  },
  closeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: typography.displaySmall,
    fontWeight: fontWeights.light,
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.medium,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.tiny,
    fontWeight: fontWeights.light,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  errorEmoji: {
    fontSize: typography.emojiLarge,
    marginBottom: 12,
  },
  errorText: {
    marginTop: 12,
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  tickResultBanner: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  typeBadgeText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  strategyName: {
    fontSize: typography.h4,
    fontWeight: fontWeights.light,
    letterSpacing: -0.2,
  },
  infoCard: {
    borderRadius: 10,
    borderWidth: 0.5,
    padding: 14,
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
    gap: 10,
  },
  infoLabel: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.light,
  },
  infoValue: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
  },
  infoDivider: {
    height: 0.5,
    marginVertical: 10,
  },
  conditionsCard: {
    borderRadius: 10,
    borderWidth: 0.5,
    padding: 14,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
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
    fontSize: typography.tiny,
    fontWeight: fontWeights.light,
    lineHeight: 18,
  },
  conditionSubtext: {
    fontSize: typography.micro,
    fontWeight: fontWeights.light,
    marginTop: 3,
  },
  conditionDivider: {
    height: 0.5,
    marginVertical: 8,
  },
  actionsCard: {
    borderRadius: 10,
    borderWidth: 0.5,
    padding: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEmoji: {
    fontSize: typography.h3,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: typography.micro,
    fontWeight: fontWeights.light,
    marginBottom: 3,
  },
  actionValue: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
  },
  actionDivider: {
    height: 0.5,
    marginVertical: 10,
  },
  datesCard: {
    borderRadius: 10,
    borderWidth: 0.5,
    padding: 14,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dateLabel: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.light,
  },
  dateValue: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
    maxWidth: '55%',
    textAlign: 'right',
  },
  dateDivider: {
    height: 0.5,
    marginVertical: 8,
  },
  // Stats grid
  statsGrid: {
    borderRadius: 10,
    borderWidth: 0.5,
    padding: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  statsCell: {
    flex: 1,
    alignItems: 'center',
  },
  statsLabel: {
    fontSize: typography.micro,
    fontWeight: fontWeights.light,
    marginBottom: 3,
  },
  statsValue: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },
  // Execution/Signal cards
  execCard: {
    borderRadius: 8,
    borderWidth: 0.5,
    padding: 10,
    marginBottom: 6,
  },
  execBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  footer: {
    gap: 6,
    padding: 10,
    paddingHorizontal: 14,
    borderTopWidth: 0.5,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 8,
    minHeight: 36,
  },
  footerButtonText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
  },
})
