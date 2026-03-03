import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions } from "react-native"
import { memo, useState, useCallback, useMemo, useEffect } from "react"
import Svg, { Path, Circle, Line, Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg"
import { useHeader } from "../contexts/HeaderContext"
import { useTheme } from "../contexts/ThemeContext"
import { useLanguage } from "../contexts/LanguageContext"
import { useBalance } from "../contexts/BalanceContext"
import { usePrivacy } from "../contexts/PrivacyContext"
import { useAuth } from "../contexts/AuthContext"
import { apiService } from "../services/api"
import { useBackendSnapshots } from "../hooks/useBackendSnapshots"
import { useCurrencyConversion } from "../hooks/use-currency-conversion"
import { getExchangeBalances, getExchangeId, getExchangeName } from "../lib/exchange-helpers"
import { typography, fontWeights } from "../lib/typography"
import { GradientCard } from "../components/GradientCard"
import type { Balance } from "../types/api"

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// ─── Tipos locais ───────────────────────────────────────────────
interface TokenPerformance {
  symbol: string
  exchange: string
  value: number
  change24h: number
}

// ─── Componente Principal ───────────────────────────────────────
export const AnalyticsScreen = memo(function AnalyticsScreen({ navigation }: any) {
  const { colors, isDark } = useTheme()
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const { data: balanceData, loading: balanceLoading, refresh: refreshBalance, refreshing } = useBalance()
  const { hideValue } = usePrivacy()

  const [isRefreshing, setIsRefreshing] = useState(false)

  // ── Calcular total USD ──
  const totalValue = useMemo(() => {
    if (!balanceData) return 0
    const v = parseFloat(
      balanceData.summary?.total_usd ||
      (balanceData as any).total_usd ||
      '0'
    )
    return v
  }, [balanceData])

  // ── PnL do MongoDB ──
  const { pnl, loading: pnlLoading, refresh: refreshPnl } = useBackendSnapshots(totalValue)

  // ── Conversão BRL ──
  const { brlValue, usdToBrlRate } = useCurrencyConversion(totalValue)

  // ── Header ──
  useHeader({ title: "Analytics", subtitle: "Portfolio performance" })

  // ── Refresh ──
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await Promise.all([refreshBalance(), refreshPnl()])
    setTimeout(() => setIsRefreshing(false), 300)
  }, [refreshBalance, refreshPnl])

  // ── PnL dados ──
  const pnlPeriods = useMemo(() => {
    if (!pnl) return null
    return {
      today: {
        label: '24h',
        ...pnl.today,
        isProfit: pnl.today.change >= 0,
      },
      week: {
        label: '7d',
        ...pnl.week,
        isProfit: pnl.week.change >= 0,
      },
      twoWeeks: {
        label: '14d',
        ...pnl.twoWeeks,
        isProfit: pnl.twoWeeks.change >= 0,
      },
      month: {
        label: '30d',
        ...pnl.month,
        isProfit: pnl.month.change >= 0,
      },
    }
  }, [pnl])

  // ── Top Gainers / Losers ──
  const tokenPerformance = useMemo(() => {
    if (!balanceData?.exchanges) return { gainers: [], losers: [] }

    const tokens: TokenPerformance[] = []

    balanceData.exchanges.forEach(exchange => {
      const balances = getExchangeBalances(exchange)
      const exchangeName = getExchangeName(exchange)

      Object.entries(balances).forEach(([symbol, bal]) => {
        const b = bal as Balance
        const value = b.usd_value ?? 0
        const change = b.change_24h ?? 0

        // Ignora stablecoins e tokens com valor < $1
        const stables = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FDUSD', 'BRL', 'USD', 'EUR']
        if (stables.includes(symbol.toUpperCase()) || value < 1) return

        tokens.push({
          symbol: symbol.toUpperCase(),
          exchange: exchangeName,
          value,
          change24h: change,
        })
      })
    })

    // Ordena por change_24h
    const sorted = [...tokens].sort((a, b) => b.change24h - a.change24h)
    const gainers = sorted.filter(t => t.change24h > 0).slice(0, 5)
    const losers = sorted.filter(t => t.change24h < 0).sort((a, b) => a.change24h - b.change24h).slice(0, 5)

    return { gainers, losers }
  }, [balanceData])

  // ── Distribuição por exchange ──
  const exchangeDistribution = useMemo(() => {
    if (!balanceData?.exchanges || totalValue === 0) return []

    return balanceData.exchanges
      .map(ex => {
        const val = typeof ex.total_usd === 'string' ? parseFloat(ex.total_usd) : (ex.total_usd || 0)
        return {
          name: getExchangeName(ex),
          value: val,
          percent: (val / totalValue) * 100,
          tokenCount: Object.keys(getExchangeBalances(ex)).length,
        }
      })
      .filter(e => e.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [balanceData, totalValue])

  // ── Concentração do portfólio ──
  const concentration = useMemo(() => {
    if (!balanceData?.exchanges || totalValue === 0) return { top1: 0, top3: 0, top5: 0, totalTokens: 0 }

    const allTokens: { symbol: string; value: number }[] = []

    balanceData.exchanges.forEach(ex => {
      const balances = getExchangeBalances(ex)
      Object.entries(balances).forEach(([symbol, bal]) => {
        const b = bal as Balance
        const v = b.usd_value ?? 0
        if (v > 0) {
          const existing = allTokens.find(t => t.symbol === symbol.toUpperCase())
          if (existing) {
            existing.value += v
          } else {
            allTokens.push({ symbol: symbol.toUpperCase(), value: v })
          }
        }
      })
    })

    const sorted = allTokens.sort((a, b) => b.value - a.value)
    const top1 = sorted.length >= 1 ? (sorted[0].value / totalValue) * 100 : 0
    const top3 = sorted.slice(0, 3).reduce((sum, t) => sum + t.value, 0) / totalValue * 100
    const top5 = sorted.slice(0, 5).reduce((sum, t) => sum + t.value, 0) / totalValue * 100

    return { top1, top3, top5, totalTokens: sorted.length }
  }, [balanceData, totalValue])

  // ── Render ──
  const loading = balanceLoading || pnlLoading

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* ═══ SEÇÃO 1: Resumo do Portfólio ═══ */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Portfolio
          </Text>

          <View style={styles.portfolioSummary}>
            <Text style={[styles.portfolioValue, { color: colors.text }]}>
              {hideValue(`$${apiService.formatUSD(totalValue)}`)}
            </Text>
            {brlValue ? (
              <Text style={[styles.portfolioBrl, { color: colors.textSecondary }]}>
                {hideValue(`R$ ${apiService.formatUSD(brlValue)}`)}
              </Text>
            ) : null}
          </View>

          {/* Exchanges e tokens */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {exchangeDistribution.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Exchanges
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {concentration.totalTokens}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Tokens
              </Text>
            </View>
          </View>
        </View>

        {/* ═══ SEÇÃO 2: Performance (PnL) ═══ */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Performance
          </Text>

          {pnlPeriods ? (
            <View style={styles.pnlGrid}>
              {(['today', 'week', 'twoWeeks', 'month'] as const).map((key) => {
                const p = pnlPeriods[key]
                const color = p.change === 0 ? colors.textTertiary : p.isProfit ? colors.success : colors.danger
                const arrow = p.change === 0 ? '━' : p.isProfit ? '▲' : '▼'
                return (
                  <View key={key} style={{ flex: 1, minWidth: (SCREEN_WIDTH - 56) / 2 - 4 }}>
                    <GradientCard
                      style={[styles.pnlItem, { borderWidth: 1, borderColor: p.change === 0 ? colors.border : p.isProfit ? `${colors.success}15` : `${colors.danger}15` }]}
                    >
                    <Text style={[styles.pnlPeriodLabel, { color: colors.textTertiary }]}>
                      {p.label}
                    </Text>
                    <View style={styles.pnlValueRow}>
                      <Text style={[styles.pnlArrow, { color }]}>{arrow}</Text>
                      <Text style={[styles.pnlValue, { color: p.change === 0 ? colors.text : color }]}>
                        {hideValue(`$${apiService.formatUSD(Math.abs(p.change))}`)}
                      </Text>
                    </View>
                    <Text style={[styles.pnlPercent, { color }]}>
                      {hideValue(p.change === 0 ? '0.00%' : `${Math.abs(p.changePercent).toFixed(2)}%`)}
                    </Text>
                    </GradientCard>
                  </View>
                )
              })}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Aguardando dados de performance...
            </Text>
          )}
        </View>

        {/* ═══ SEÇÃO 3: Concentração do Portfólio ═══ */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Concentração
          </Text>

          <View style={styles.concentrationList}>
            {[
              { label: 'Top 1 token', value: concentration.top1 },
              { label: 'Top 3 tokens', value: concentration.top3 },
              { label: 'Top 5 tokens', value: concentration.top5 },
            ].map((item) => (
              <View key={item.label} style={styles.concentrationRow}>
                <Text style={[styles.concentrationLabel, { color: colors.textSecondary }]}>
                  {item.label}
                </Text>
                <View style={styles.concentrationBarContainer}>
                  <View style={[styles.concentrationBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                    <View
                      style={[
                        styles.concentrationBarFill,
                        {
                          width: `${Math.min(item.value, 100)}%`,
                          backgroundColor: item.value > 70 ? colors.warning : colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.concentrationPercent, { color: colors.text }]}>
                  {hideValue(`${item.value.toFixed(1)}%`)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ═══ SEÇÃO 4: Top Gainers ═══ */}
        {tokenPerformance.gainers.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Top Gainers (24h)
            </Text>

            {tokenPerformance.gainers.map((token, index) => (
              <View key={`${token.symbol}-${token.exchange}-${index}`} style={styles.tokenRow}>
                <View style={styles.tokenRank}>
                  <Text style={[styles.rankNumber, { color: colors.textTertiary }]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.tokenInfo}>
                  <Text style={[styles.tokenSymbol, { color: colors.text }]}>{token.symbol}</Text>
                  <Text style={[styles.tokenExchange, { color: colors.textTertiary }]}>{token.exchange}</Text>
                </View>
                <View style={styles.tokenValues}>
                  <Text style={[styles.tokenValue, { color: colors.text }]}>
                    {hideValue(`$${apiService.formatUSD(token.value)}`)}
                  </Text>
                  <Text style={[styles.tokenChange, { color: colors.success }]}>
                    {hideValue(`+${token.change24h.toFixed(2)}%`)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ═══ SEÇÃO 5: Top Losers ═══ */}
        {tokenPerformance.losers.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Top Losers (24h)
            </Text>

            {tokenPerformance.losers.map((token, index) => (
              <View key={`${token.symbol}-${token.exchange}-${index}`} style={styles.tokenRow}>
                <View style={styles.tokenRank}>
                  <Text style={[styles.rankNumber, { color: colors.textTertiary }]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.tokenInfo}>
                  <Text style={[styles.tokenSymbol, { color: colors.text }]}>{token.symbol}</Text>
                  <Text style={[styles.tokenExchange, { color: colors.textTertiary }]}>{token.exchange}</Text>
                </View>
                <View style={styles.tokenValues}>
                  <Text style={[styles.tokenValue, { color: colors.text }]}>
                    {hideValue(`$${apiService.formatUSD(token.value)}`)}
                  </Text>
                  <Text style={[styles.tokenChange, { color: colors.danger }]}>
                    {hideValue(`${token.change24h.toFixed(2)}%`)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ═══ SEÇÃO 6: Distribuição por Exchange ═══ */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Alocação por Exchange
          </Text>

          {exchangeDistribution.map((ex, index) => (
            <View key={ex.name} style={styles.exchangeRow}>
              <View style={styles.exchangeInfo}>
                <Text style={[styles.exchangeName, { color: colors.text }]}>{ex.name}</Text>
                <Text style={[styles.exchangeTokens, { color: colors.textTertiary }]}>
                  {ex.tokenCount} tokens
                </Text>
              </View>
              <View style={styles.exchangeBarContainer}>
                <View style={[styles.exchangeBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <View
                    style={[
                      styles.exchangeBarFill,
                      {
                        width: `${Math.min(ex.percent, 100)}%`,
                        backgroundColor: colors.primary,
                        opacity: 1 - (index * 0.12),
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.exchangeValues}>
                <Text style={[styles.exchangeValue, { color: colors.text }]}>
                  {hideValue(`$${apiService.formatUSD(ex.value)}`)}
                </Text>
                <Text style={[styles.exchangePercent, { color: colors.textSecondary }]}>
                  {hideValue(`${ex.percent.toFixed(1)}%`)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Espaçamento final */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  )
})

// ─── Estilos ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Card base
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 12,
    opacity: 0.6,
  },

  // Portfolio summary
  portfolioSummary: {
    alignItems: 'center',
    marginBottom: 16,
  },
  portfolioValue: {
    fontSize: typography.displayLarge,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
  },
  portfolioBrl: {
    fontSize: typography.body,
    fontWeight: fontWeights.regular,
    marginTop: 2,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.h3,
    fontWeight: fontWeights.semibold,
  },
  statLabel: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    opacity: 0.3,
  },

  // PnL grid
  pnlGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pnlItem: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 56) / 2 - 4,
    padding: 12,
    borderRadius: 12,
  },
  pnlPeriodLabel: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pnlValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pnlArrow: {
    fontSize: 10,
  },
  pnlValue: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  pnlPercent: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    marginTop: 2,
  },

  emptyText: {
    fontSize: typography.bodySmall,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Concentração
  concentrationList: {
    gap: 10,
  },
  concentrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  concentrationLabel: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    width: 90,
  },
  concentrationBarContainer: {
    flex: 1,
  },
  concentrationBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  concentrationBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  concentrationPercent: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
    width: 48,
    textAlign: 'right',
  },

  // Token rows (Gainers / Losers)
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  tokenRank: {
    width: 20,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },
  tokenExchange: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    marginTop: 1,
  },
  tokenValues: {
    alignItems: 'flex-end',
  },
  tokenValue: {
    fontSize: typography.body,
    fontWeight: fontWeights.regular,
  },
  tokenChange: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
    marginTop: 1,
  },

  // Exchange distribution
  exchangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  exchangeInfo: {
    width: 80,
  },
  exchangeName: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  exchangeTokens: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    marginTop: 1,
  },
  exchangeBarContainer: {
    flex: 1,
  },
  exchangeBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  exchangeBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  exchangeValues: {
    alignItems: 'flex-end',
    width: 80,
  },
  exchangeValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
  },
  exchangePercent: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    marginTop: 1,
  },
})
