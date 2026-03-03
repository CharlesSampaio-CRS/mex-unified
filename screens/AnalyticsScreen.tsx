import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, TouchableOpacity } from "react-native"
import { memo, useState, useCallback, useMemo, useEffect } from "react"
import Svg, { Path, Circle, Line, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg"
import { useHeader } from "../contexts/HeaderContext"
import { useTheme } from "../contexts/ThemeContext"
import { useLanguage } from "../contexts/LanguageContext"
import { useBalance } from "../contexts/BalanceContext"
import { usePrivacy } from "../contexts/PrivacyContext"
import { useAuth } from "../contexts/AuthContext"
import { apiService } from "../services/api"
import { marketPriceService } from "../services/marketPriceService"
import { useBackendSnapshots } from "../hooks/useBackendSnapshots"
import { useCurrencyConversion } from "../hooks/use-currency-conversion"
import { getExchangeBalances, getExchangeName } from "../lib/exchange-helpers"
import { typography, fontWeights } from "../lib/typography"
import { GradientCard } from "../components/GradientCard"
import type { Balance } from "../types/api"

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CHART_W = SCREEN_WIDTH - 64
const CHART_H = 140
const COMP_CHART_H = 170
const CHART_PAD = 16

// ─── Tipos ──────────────────────────────────────────────────────
interface TokenPerformance {
  symbol: string
  exchange: string
  value: number
  change24h: number
}

// ─── Helpers SVG ────────────────────────────────────────────────

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpx1 = prev.x + (curr.x - prev.x) / 3
    const cpy1 = prev.y
    const cpx2 = prev.x + 2 * (curr.x - prev.x) / 3
    const cpy2 = curr.y
    d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${curr.x} ${curr.y}`
  }
  return d
}

function valuesToPoints(
  values: number[],
  width: number,
  height: number,
  padX: number = 0,
  padY: number = 4,
): { x: number; y: number }[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values.map((v, i) => ({
    x: padX + (i / Math.max(values.length - 1, 1)) * (width - 2 * padX),
    y: padY + ((max - v) / range) * (height - 2 * padY),
  }))
}

function buildAreaPath(points: { x: number; y: number }[], height: number): string {
  if (points.length === 0) return ''
  const linePath = buildSmoothPath(points)
  const last = points[points.length - 1]
  const first = points[0]
  return `${linePath} L ${last.x} ${height} L ${first.x} ${height} Z`
}

function findNearestIdx(points: { x: number }[], touchX: number): number {
  let idx = 0
  let minD = Infinity
  points.forEach((p, i) => {
    const d = Math.abs(p.x - touchX)
    if (d < minD) { minD = d; idx = i }
  })
  return idx
}

// ─── Mini Sparkline ─────────────────────────────────────────────
const Sparkline = memo(function Sparkline({
  values,
  width = 60,
  height = 24,
  color,
}: {
  values: number[]
  width?: number
  height?: number
  color: string
}) {
  if (values.length < 2) return null
  const points = valuesToPoints(values, width, height, 2, 3)
  const d = buildSmoothPath(points)
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  )
})

// ─── Gráfico de Evolução ────────────────────────────────────────
const EvolutionChart = memo(function EvolutionChart({
  values,
  timestamps,
  colors,
  isDark,
  hideValue,
}: {
  values: number[]
  timestamps: string[]
  colors: any
  isDark: boolean
  hideValue: (s: string) => string
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  if (values.length < 2) {
    return (
      <View style={[evoStyles.empty, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
        <Text style={[evoStyles.emptyText, { color: colors.textTertiary }]}>
          Dados insuficientes para gráfico
        </Text>
      </View>
    )
  }

  const points = valuesToPoints(values, CHART_W, CHART_H, CHART_PAD, 12)
  const linePath = buildSmoothPath(points)
  const areaPath = buildAreaPath(points, CHART_H)
  const isPositive = values[values.length - 1] >= values[0]
  const lineColor = isPositive ? colors.success : colors.danger

  const startVal = values[0]
  const endVal = values[values.length - 1]
  const change = endVal - startVal
  const changePct = startVal > 0 ? (change / startVal) * 100 : 0

  const fmtDate = (ts: string) => {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' })
  }

  const selected = selectedIdx !== null ? {
    value: values[selectedIdx],
    date: fmtDate(timestamps[selectedIdx]),
    point: points[selectedIdx],
  } : null

  return (
    <View>
      {/* Sumário */}
      <View style={evoStyles.summaryRow}>
        <View>
          <Text style={[evoStyles.summaryLabel, { color: colors.textTertiary }]}>Variação do período</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[evoStyles.summaryArrow, { color: lineColor }]}>
              {change === 0 ? '━' : isPositive ? '▲' : '▼'}
            </Text>
            <Text style={[evoStyles.summaryValue, { color: lineColor }]}>
              {hideValue(`$${apiService.formatUSD(Math.abs(change))}`)}
            </Text>
            <Text style={[evoStyles.summaryPct, { color: lineColor }]}>
              {hideValue(`${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`)}
            </Text>
          </View>
        </View>
        {selected && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[evoStyles.tooltipDate, { color: colors.textTertiary }]}>{selected.date}</Text>
            <Text style={[evoStyles.tooltipValue, { color: colors.text }]}>
              {hideValue(`$${apiService.formatUSD(selected.value)}`)}
            </Text>
          </View>
        )}
      </View>

      {/* SVG */}
      <Svg width={CHART_W} height={CHART_H} style={{ alignSelf: 'center' }}>
        <Defs>
          <SvgLinearGradient id="evoGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>

        {[0.25, 0.5, 0.75].map(frac => (
          <Line
            key={frac}
            x1={CHART_PAD} y1={12 + frac * (CHART_H - 24)}
            x2={CHART_W - CHART_PAD} y2={12 + frac * (CHART_H - 24)}
            stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
            strokeWidth={1}
          />
        ))}

        <Path d={areaPath} fill="url(#evoGrad)" />
        <Path d={linePath} stroke={lineColor} strokeWidth={2} fill="none" strokeLinecap="round" />

        {selected && (
          <>
            <Line
              x1={selected.point.x} y1={0}
              x2={selected.point.x} y2={CHART_H}
              stroke={colors.textTertiary} strokeWidth={0.5} strokeDasharray="3,3"
            />
            <Circle cx={selected.point.x} cy={selected.point.y} r={4} fill={lineColor} />
            <Circle cx={selected.point.x} cy={selected.point.y} r={6} fill={lineColor} opacity={0.2} />
          </>
        )}
      </Svg>

      {/* Eixo X */}
      <View style={evoStyles.xAxis}>
        <Text style={[evoStyles.xLabel, { color: colors.textTertiary }]}>{fmtDate(timestamps[0])}</Text>
        <Text style={[evoStyles.xLabel, { color: colors.textTertiary }]}>{fmtDate(timestamps[timestamps.length - 1])}</Text>
      </View>

      {/* Touch overlay */}
      <View
        style={evoStyles.touchOverlay}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => setSelectedIdx(findNearestIdx(points, e.nativeEvent.locationX))}
        onResponderMove={(e) => setSelectedIdx(findNearestIdx(points, e.nativeEvent.locationX))}
        onResponderRelease={() => setSelectedIdx(null)}
      />
    </View>
  )
})

// ─── Normalizar série para % relativo ───────────────────────────
function normalizeToPercent(values: number[]): number[] {
  if (values.length === 0) return []
  const base = values[0]
  if (base === 0) return values.map(() => 0)
  return values.map(v => ((v - base) / base) * 100)
}

// Alinhar série de mercado com timestamps do portfólio
function alignSeries(
  marketTs: string[],
  marketVals: number[],
  portfolioTs: string[],
): number[] {
  if (marketTs.length === 0 || portfolioTs.length === 0) return []
  const marketPairs = marketTs.map((ts, i) => ({ t: new Date(ts).getTime(), v: marketVals[i] }))
  return portfolioTs.map(ts => {
    const t = new Date(ts).getTime()
    let closest = marketPairs[0]
    let minD = Math.abs(t - closest.t)
    for (let i = 1; i < marketPairs.length; i++) {
      const d = Math.abs(t - marketPairs[i].t)
      if (d < minD) { minD = d; closest = marketPairs[i] }
    }
    return closest.v
  })
}

// ─── Gráfico Comparativo (Portfolio vs BTC vs ETH) ─────────────
interface CompSeriesData {
  values: number[]
  timestamps: string[]
}

const COMP_COLORS = {
  portfolio: '#8B5CF6', // roxo
  btc: '#F7931A',      // laranja BTC
  eth: '#627EEA',      // azul ETH
}

const ComparisonChart = memo(function ComparisonChart({
  portfolioData,
  btcData,
  ethData,
  colors,
  isDark,
  hideValue,
  loading,
}: {
  portfolioData: CompSeriesData | null
  btcData: CompSeriesData | null
  ethData: CompSeriesData | null
  colors: any
  isDark: boolean
  hideValue: (s: string) => string
  loading: boolean
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  // Precisamos ao menos do portfólio com 2 pontos
  if (!portfolioData || portfolioData.values.length < 2) {
    return (
      <View style={[evoStyles.empty, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
        <Text style={[evoStyles.emptyText, { color: colors.textTertiary }]}>
          {loading ? 'Carregando comparação...' : 'Dados insuficientes'}
        </Text>
      </View>
    )
  }

  // Normalizar portfólio
  const portPct = normalizeToPercent(portfolioData.values)

  // Alinhar e normalizar BTC/ETH aos timestamps do portfólio
  const btcAligned = btcData ? alignSeries(btcData.timestamps, btcData.values, portfolioData.timestamps) : null
  const ethAligned = ethData ? alignSeries(ethData.timestamps, ethData.values, portfolioData.timestamps) : null
  const btcPct = btcAligned ? normalizeToPercent(btcAligned) : null
  const ethPct = ethAligned ? normalizeToPercent(ethAligned) : null

  // Calcular min/max global para todas as séries
  const allValues = [
    ...portPct,
    ...(btcPct || []),
    ...(ethPct || []),
  ]
  const globalMin = Math.min(...allValues)
  const globalMax = Math.max(...allValues)
  const range = globalMax - globalMin || 1

  // Converter para pontos usando escala global
  const toPoints = (pctValues: number[]) =>
    pctValues.map((v, i) => ({
      x: CHART_PAD + (i / Math.max(pctValues.length - 1, 1)) * (CHART_W - 2 * CHART_PAD),
      y: 12 + ((globalMax - v) / range) * (COMP_CHART_H - 24),
    }))

  const portPoints = toPoints(portPct)
  const btcPoints = btcPct ? toPoints(btcPct) : null
  const ethPoints = ethPct ? toPoints(ethPct) : null

  // Linha de 0%
  const zeroY = 12 + ((globalMax - 0) / range) * (COMP_CHART_H - 24)

  // Valores finais para a legenda
  const portFinal = portPct[portPct.length - 1]
  const btcFinal = btcPct ? btcPct[btcPct.length - 1] : null
  const ethFinal = ethPct ? ethPct[ethPct.length - 1] : null

  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

  // Seleção por toque
  const selected = selectedIdx !== null ? {
    port: portPct[selectedIdx],
    btc: btcPct ? btcPct[selectedIdx] : null,
    eth: ethPct ? ethPct[selectedIdx] : null,
    point: portPoints[selectedIdx],
    date: (() => {
      const d = new Date(portfolioData.timestamps[selectedIdx])
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' })
    })(),
  } : null

  return (
    <View>
      {/* Legenda + valores finais */}
      <View style={compStyles.legendRow}>
        <View style={compStyles.legendItem}>
          <View style={[compStyles.legendDot, { backgroundColor: COMP_COLORS.portfolio }]} />
          <Text style={[compStyles.legendLabel, { color: colors.textSecondary }]}>Portfolio</Text>
          <Text style={[compStyles.legendValue, { color: selected ? colors.text : (portFinal >= 0 ? colors.success : colors.danger) }]}>
            {hideValue(fmtPct(selected ? selected.port : portFinal))}
          </Text>
        </View>
        {btcPct && (
          <View style={compStyles.legendItem}>
            <View style={[compStyles.legendDot, { backgroundColor: COMP_COLORS.btc }]} />
            <Text style={[compStyles.legendLabel, { color: colors.textSecondary }]}>BTC</Text>
            <Text style={[compStyles.legendValue, { color: selected ? colors.text : (btcFinal! >= 0 ? colors.success : colors.danger) }]}>
              {hideValue(fmtPct(selected && selected.btc !== null ? selected.btc : btcFinal!))}
            </Text>
          </View>
        )}
        {ethPct && (
          <View style={compStyles.legendItem}>
            <View style={[compStyles.legendDot, { backgroundColor: COMP_COLORS.eth }]} />
            <Text style={[compStyles.legendLabel, { color: colors.textSecondary }]}>ETH</Text>
            <Text style={[compStyles.legendValue, { color: selected ? colors.text : (ethFinal! >= 0 ? colors.success : colors.danger) }]}>
              {hideValue(fmtPct(selected && selected.eth !== null ? selected.eth : ethFinal!))}
            </Text>
          </View>
        )}
      </View>

      {selected && (
        <Text style={[compStyles.touchDate, { color: colors.textTertiary }]}>{selected.date}</Text>
      )}

      {/* SVG */}
      <Svg width={CHART_W} height={COMP_CHART_H} style={{ alignSelf: 'center' }}>
        {/* Grid */}
        {[0.25, 0.5, 0.75].map(frac => (
          <Line
            key={frac}
            x1={CHART_PAD} y1={12 + frac * (COMP_CHART_H - 24)}
            x2={CHART_W - CHART_PAD} y2={12 + frac * (COMP_CHART_H - 24)}
            stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}
            strokeWidth={1}
          />
        ))}

        {/* Linha de 0% */}
        {zeroY > 10 && zeroY < COMP_CHART_H - 10 && (
          <Line
            x1={CHART_PAD} y1={zeroY}
            x2={CHART_W - CHART_PAD} y2={zeroY}
            stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        )}

        {/* ETH line */}
        {ethPoints && (
          <Path d={buildSmoothPath(ethPoints)} stroke={COMP_COLORS.eth} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.7} />
        )}

        {/* BTC line */}
        {btcPoints && (
          <Path d={buildSmoothPath(btcPoints)} stroke={COMP_COLORS.btc} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.7} />
        )}

        {/* Portfolio line (mais forte) */}
        <Defs>
          <SvgLinearGradient id="compPortGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={COMP_COLORS.portfolio} stopOpacity={0.15} />
            <Stop offset="100%" stopColor={COMP_COLORS.portfolio} stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        <Path d={buildAreaPath(portPoints, COMP_CHART_H)} fill="url(#compPortGrad)" />
        <Path d={buildSmoothPath(portPoints)} stroke={COMP_COLORS.portfolio} strokeWidth={2.5} fill="none" strokeLinecap="round" />

        {/* Touch indicator */}
        {selected && (
          <>
            <Line
              x1={selected.point.x} y1={0}
              x2={selected.point.x} y2={COMP_CHART_H}
              stroke={colors.textTertiary} strokeWidth={0.5} strokeDasharray="3,3"
            />
            <Circle cx={selected.point.x} cy={selected.point.y} r={4} fill={COMP_COLORS.portfolio} />
            {btcPoints && (
              <Circle cx={btcPoints[selectedIdx!].x} cy={btcPoints[selectedIdx!].y} r={3} fill={COMP_COLORS.btc} />
            )}
            {ethPoints && (
              <Circle cx={ethPoints[selectedIdx!].x} cy={ethPoints[selectedIdx!].y} r={3} fill={COMP_COLORS.eth} />
            )}
          </>
        )}
      </Svg>

      {/* Eixo X */}
      <View style={evoStyles.xAxis}>
        <Text style={[evoStyles.xLabel, { color: colors.textTertiary }]}>
          {(() => { const d = new Date(portfolioData.timestamps[0]); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }) })()}
        </Text>
        <Text style={[evoStyles.xLabel, { color: colors.textTertiary }]}>
          {(() => { const d = new Date(portfolioData.timestamps[portfolioData.timestamps.length - 1]); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }) })()}
        </Text>
      </View>

      {/* Touch overlay */}
      <View
        style={[evoStyles.touchOverlay, { height: COMP_CHART_H, top: 50 }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => setSelectedIdx(findNearestIdx(portPoints, e.nativeEvent.locationX))}
        onResponderMove={(e) => setSelectedIdx(findNearestIdx(portPoints, e.nativeEvent.locationX))}
        onResponderRelease={() => setSelectedIdx(null)}
      />
    </View>
  )
})

// ─── COMPONENTE PRINCIPAL ───────────────────────────────────────
export const AnalyticsScreen = memo(function AnalyticsScreen({ navigation }: any) {
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const { user } = useAuth()
  const { data: balanceData, loading: balanceLoading, refresh: refreshBalance, refreshing } = useBalance()
  const { hideValue } = usePrivacy()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [evolutionPeriod, setEvolutionPeriod] = useState<number>(7)
  const [evolutionData, setEvolutionData] = useState<{ values_usd: number[]; timestamps: string[] } | null>(null)
  const [evoLoading, setEvoLoading] = useState(false)
  const [btcChartData, setBtcChartData] = useState<CompSeriesData | null>(null)
  const [ethChartData, setEthChartData] = useState<CompSeriesData | null>(null)
  const [compLoading, setCompLoading] = useState(false)

  // Total USD
  const totalValue = useMemo(() => {
    if (!balanceData) return 0
    return parseFloat(balanceData.summary?.total_usd || (balanceData as any).total_usd || '0')
  }, [balanceData])

  // PnL / Snapshots
  const { pnl, snapshots, loading: pnlLoading, refresh: refreshPnl, getEvolutionData } = useBackendSnapshots(totalValue)

  // BRL
  const { brlValue } = useCurrencyConversion(totalValue)

  // Header
  useHeader({ title: "Analytics", subtitle: "Portfolio performance" })

  // Carregar evolução
  const loadEvolution = useCallback(async (days: number) => {
    setEvoLoading(true)
    try {
      const data = await getEvolutionData(days)
      setEvolutionData(data)
    } catch { /* silently fail */ }
    setEvoLoading(false)
  }, [getEvolutionData])

  // Carregar dados BTC/ETH para comparação
  const loadComparison = useCallback(async (days: number) => {
    setCompLoading(true)
    try {
      const [btc, eth] = await Promise.all([
        marketPriceService.getChartData('BTC', days),
        marketPriceService.getChartData('ETH', days),
      ])
      setBtcChartData(btc ? { values: btc.values, timestamps: btc.timestamps } : null)
      setEthChartData(eth ? { values: eth.values, timestamps: eth.timestamps } : null)
    } catch {
      setBtcChartData(null)
      setEthChartData(null)
    }
    setCompLoading(false)
  }, [])

  useEffect(() => {
    loadEvolution(evolutionPeriod)
    loadComparison(evolutionPeriod)
  }, [evolutionPeriod, loadEvolution, loadComparison])

  // Refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await Promise.all([refreshBalance(), refreshPnl()])
    await Promise.all([loadEvolution(evolutionPeriod), loadComparison(evolutionPeriod)])
    setTimeout(() => setIsRefreshing(false), 300)
  }, [refreshBalance, refreshPnl, loadEvolution, loadComparison, evolutionPeriod])

  // PnL períodos
  const pnlPeriods = useMemo(() => {
    if (!pnl) return null
    return [
      { key: '24h', label: '24h', data: pnl.today },
      { key: '7d', label: '7d', data: pnl.week },
      { key: '14d', label: '14d', data: pnl.twoWeeks },
      { key: '30d', label: '30d', data: pnl.month },
    ].map(p => ({
      ...p,
      isProfit: p.data.change >= 0,
      color: p.data.change === 0 ? colors.textTertiary : p.data.change >= 0 ? colors.success : colors.danger,
    }))
  }, [pnl, colors])

  // Sparkline data por período
  const sparklineData = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return {} as Record<string, number[]>
    const now = Date.now()
    const periodDays: Record<string, number> = { '24h': 1, '7d': 7, '14d': 14, '30d': 30 }
    const result: Record<string, number[]> = {}

    for (const [key, days] of Object.entries(periodDays)) {
      const cutoff = now - days * 24 * 60 * 60 * 1000
      const filtered = snapshots
        .filter(s => s.timestamp >= cutoff)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(s => s.total_usd)
      if (filtered.length >= 2) {
        const step = Math.max(1, Math.floor(filtered.length / 12))
        result[key] = filtered.filter((_, i) => i % step === 0 || i === filtered.length - 1)
      }
    }
    return result
  }, [snapshots])

  // Top Gainers / Losers
  const tokenPerformance = useMemo(() => {
    if (!balanceData?.exchanges) return { gainers: [] as TokenPerformance[], losers: [] as TokenPerformance[] }
    const tokens: TokenPerformance[] = []
    const stables = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FDUSD', 'BRL', 'USD', 'EUR']

    balanceData.exchanges.forEach(exchange => {
      const balances = getExchangeBalances(exchange)
      const exchangeName = getExchangeName(exchange)
      Object.entries(balances).forEach(([symbol, bal]) => {
        const b = bal as Balance
        const value = b.usd_value ?? 0
        const change = b.change_24h ?? 0
        if (stables.includes(symbol.toUpperCase()) || value < 1) return
        tokens.push({ symbol: symbol.toUpperCase(), exchange: exchangeName, value, change24h: change })
      })
    })

    const sorted = [...tokens].sort((a, b) => b.change24h - a.change24h)
    return {
      gainers: sorted.filter(t => t.change24h > 0).slice(0, 5),
      losers: sorted.filter(t => t.change24h < 0).sort((a, b) => a.change24h - b.change24h).slice(0, 5),
    }
  }, [balanceData])

  // Distribuição por exchange
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

  // Concentração
  const concentration = useMemo(() => {
    if (!balanceData?.exchanges || totalValue === 0) return { top1: 0, top3: 0, top5: 0, totalTokens: 0, topSymbol: '' }
    const allTokens: { symbol: string; value: number }[] = []
    balanceData.exchanges.forEach(ex => {
      const balances = getExchangeBalances(ex)
      Object.entries(balances).forEach(([symbol, bal]) => {
        const v = (bal as Balance).usd_value ?? 0
        if (v > 0) {
          const existing = allTokens.find(t => t.symbol === symbol.toUpperCase())
          if (existing) existing.value += v
          else allTokens.push({ symbol: symbol.toUpperCase(), value: v })
        }
      })
    })
    const sorted = allTokens.sort((a, b) => b.value - a.value)
    const top1 = sorted.length >= 1 ? (sorted[0].value / totalValue) * 100 : 0
    const top3 = sorted.slice(0, 3).reduce((s, t) => s + t.value, 0) / totalValue * 100
    const top5 = sorted.slice(0, 5).reduce((s, t) => s + t.value, 0) / totalValue * 100
    return { top1, top3, top5, totalTokens: sorted.length, topSymbol: sorted[0]?.symbol || '' }
  }, [balanceData, totalValue])

  // ── RENDER ──
  const periods = [7, 15, 30]

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
        {/* ═══ 1. EVOLUÇÃO DO PORTFÓLIO ═══ */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Evolução</Text>
            <View style={styles.periodPills}>
              {periods.map(d => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setEvolutionPeriod(d)}
                  style={[
                    styles.periodPill,
                    {
                      backgroundColor: evolutionPeriod === d ? `${colors.primary}18` : 'transparent',
                      borderColor: evolutionPeriod === d ? colors.primary : colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.periodPillText, { color: evolutionPeriod === d ? colors.primary : colors.textSecondary }]}>
                    {d}d
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {evolutionData && evolutionData.values_usd.length >= 2 ? (
            <EvolutionChart
              values={evolutionData.values_usd}
              timestamps={evolutionData.timestamps}
              colors={colors}
              isDark={isDark}
              hideValue={hideValue}
            />
          ) : (
            <View style={[evoStyles.empty, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
              <Text style={[evoStyles.emptyText, { color: colors.textTertiary }]}>
                {evoLoading ? 'Carregando...' : 'Sem dados para o período'}
              </Text>
            </View>
          )}
        </View>

        {/* ═══ 1.5. COMPARATIVO vs BTC / ETH ═══ */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Comparativo</Text>
            <Text style={[compStyles.subtitle, { color: colors.textTertiary }]}>vs BTC & ETH</Text>
          </View>

          <ComparisonChart
            portfolioData={evolutionData}
            btcData={btcChartData}
            ethData={ethChartData}
            colors={colors}
            isDark={isDark}
            hideValue={hideValue}
            loading={compLoading || evoLoading}
          />
        </View>

        {/* ═══ 2. RESUMO DO PORTFÓLIO ═══ */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.portfolioRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 4 }]}>Portfolio</Text>
              <Text style={[styles.portfolioValue, { color: colors.text }]}>
                {hideValue(`$${apiService.formatUSD(totalValue)}`)}
              </Text>
              {brlValue ? (
                <Text style={[styles.portfolioBrl, { color: colors.textSecondary }]}>
                  {hideValue(`R$ ${apiService.formatUSD(brlValue)}`)}
                </Text>
              ) : null}
            </View>
            <View style={styles.statsCompact}>
              <View style={styles.statChip}>
                <Text style={[styles.statChipValue, { color: colors.text }]}>{exchangeDistribution.length}</Text>
                <Text style={[styles.statChipLabel, { color: colors.textTertiary }]}>exchanges</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={[styles.statChipValue, { color: colors.text }]}>{concentration.totalTokens}</Text>
                <Text style={[styles.statChipLabel, { color: colors.textTertiary }]}>tokens</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ═══ 3. PERFORMANCE (PnL + sparklines) ═══ */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Performance</Text>

          {pnlPeriods ? (
            <View style={styles.pnlGrid}>
              {pnlPeriods.map(p => {
                const arrow = p.data.change === 0 ? '━' : p.isProfit ? '▲' : '▼'
                const sparkValues = sparklineData[p.key]
                return (
                  <View key={p.key} style={styles.pnlItemWrapper}>
                    <GradientCard
                      style={[
                        styles.pnlItem,
                        { borderWidth: 1, borderColor: p.data.change === 0 ? colors.border : p.isProfit ? `${colors.success}15` : `${colors.danger}15` },
                      ]}
                    >
                      <View style={styles.pnlTop}>
                        <Text style={[styles.pnlLabel, { color: colors.textTertiary }]}>{p.label}</Text>
                        {sparkValues && sparkValues.length >= 2 && (
                          <Sparkline values={sparkValues} width={48} height={18} color={p.color} />
                        )}
                      </View>
                      <View style={styles.pnlValueRow}>
                        <Text style={[styles.pnlArrow, { color: p.color }]}>{arrow}</Text>
                        <Text style={[styles.pnlValue, { color: p.data.change === 0 ? colors.text : p.color }]}>
                          {hideValue(`$${apiService.formatUSD(Math.abs(p.data.change))}`)}
                        </Text>
                      </View>
                      <Text style={[styles.pnlPercent, { color: p.color }]}>
                        {hideValue(p.data.change === 0 ? '0.00%' : `${Math.abs(p.data.changePercent).toFixed(2)}%`)}
                      </Text>
                    </GradientCard>
                  </View>
                )
              })}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Aguardando dados...</Text>
          )}
        </View>

        {/* ═══ 4. CONCENTRAÇÃO ═══ */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Concentração</Text>
          {[
            { label: 'Top 1', sublabel: concentration.topSymbol, value: concentration.top1 },
            { label: 'Top 3', sublabel: 'tokens', value: concentration.top3 },
            { label: 'Top 5', sublabel: 'tokens', value: concentration.top5 },
          ].map((item) => (
            <View key={item.label} style={styles.concentrationRow}>
              <View style={styles.concentrationLabelGroup}>
                <Text style={[styles.concentrationLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                <Text style={[styles.concentrationSub, { color: colors.textTertiary }]}>{item.sublabel}</Text>
              </View>
              <View style={styles.concentrationBarContainer}>
                <View style={[styles.barBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <View
                    style={[styles.barFill, {
                      width: `${Math.min(item.value, 100)}%`,
                      backgroundColor: item.value > 70 ? colors.warning : colors.primary,
                    }]}
                  />
                </View>
              </View>
              <Text style={[styles.concentrationPercent, { color: colors.text }]}>
                {hideValue(`${item.value.toFixed(1)}%`)}
              </Text>
            </View>
          ))}
        </View>

        {/* ═══ 5. TOP MOVERS (lado a lado) ═══ */}
        {(tokenPerformance.gainers.length > 0 || tokenPerformance.losers.length > 0) && (
          <View style={styles.moversRow}>
            <View style={[styles.moversCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.success }]}>▲ Gainers</Text>
              {tokenPerformance.gainers.length > 0 ? tokenPerformance.gainers.map((token, idx) => (
                <View key={`g-${token.symbol}-${idx}`} style={styles.moverRow}>
                  <Text style={[styles.moverSymbol, { color: colors.text }]} numberOfLines={1}>{token.symbol}</Text>
                  <Text style={[styles.moverChange, { color: colors.success }]}>
                    {hideValue(`+${token.change24h.toFixed(1)}%`)}
                  </Text>
                </View>
              )) : (
                <Text style={[styles.emptySmall, { color: colors.textTertiary }]}>—</Text>
              )}
            </View>
            <View style={[styles.moversCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.danger }]}>▼ Losers</Text>
              {tokenPerformance.losers.length > 0 ? tokenPerformance.losers.map((token, idx) => (
                <View key={`l-${token.symbol}-${idx}`} style={styles.moverRow}>
                  <Text style={[styles.moverSymbol, { color: colors.text }]} numberOfLines={1}>{token.symbol}</Text>
                  <Text style={[styles.moverChange, { color: colors.danger }]}>
                    {hideValue(`${token.change24h.toFixed(1)}%`)}
                  </Text>
                </View>
              )) : (
                <Text style={[styles.emptySmall, { color: colors.textTertiary }]}>—</Text>
              )}
            </View>
          </View>
        )}

        {/* ═══ 6. ALOCAÇÃO POR EXCHANGE ═══ */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Alocação por Exchange</Text>
          {exchangeDistribution.map((ex, index) => (
            <View key={ex.name} style={styles.exchangeRow}>
              <View style={styles.exchangeInfo}>
                <Text style={[styles.exchangeName, { color: colors.text }]}>{ex.name}</Text>
                <Text style={[styles.exchangeTokens, { color: colors.textTertiary }]}>{ex.tokenCount} tokens</Text>
              </View>
              <View style={styles.exchangeBarContainer}>
                <View style={[styles.barBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <View
                    style={[styles.barFill, {
                      width: `${Math.min(ex.percent, 100)}%`,
                      backgroundColor: colors.primary,
                      opacity: 1 - (index * 0.12),
                    }]}
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

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  )
})

// ─── Evolution chart styles ─────────────────────────────────────
const evoStyles = StyleSheet.create({
  empty: {
    height: 100,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: typography.bodySmall,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    marginBottom: 2,
  },
  summaryArrow: {
    fontSize: 11,
  },
  summaryValue: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  summaryPct: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
  },
  tooltipDate: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
  },
  tooltipValue: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: CHART_PAD,
    marginTop: 4,
  },
  xLabel: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
  },
  touchOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    height: CHART_H,
  },
})

// ─── Comparison chart styles ────────────────────────────────────
const compStyles = StyleSheet.create({
  subtitle: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },
  legendValue: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
  },
  touchDate: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    textAlign: 'center',
    marginBottom: 4,
  },
})

// ─── Main styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },

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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    opacity: 0.6,
  },

  // Period pills
  periodPills: { flexDirection: 'row', gap: 6 },
  periodPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  periodPillText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },

  // Portfolio
  portfolioRow: { flexDirection: 'row', alignItems: 'center' },
  portfolioValue: {
    fontSize: typography.display,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
  },
  portfolioBrl: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
    marginTop: 2,
  },
  statsCompact: { gap: 6, alignItems: 'flex-end' },
  statChip: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statChipValue: { fontSize: typography.h4, fontWeight: fontWeights.semibold },
  statChipLabel: { fontSize: typography.micro, fontWeight: fontWeights.regular },

  // PnL
  pnlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pnlItemWrapper: { width: (SCREEN_WIDTH - 56) / 2 - 4 },
  pnlItem: { padding: 12, borderRadius: 12 },
  pnlTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pnlLabel: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  pnlValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pnlArrow: { fontSize: 10 },
  pnlValue: { fontSize: typography.body, fontWeight: fontWeights.semibold },
  pnlPercent: { fontSize: typography.micro, fontWeight: fontWeights.regular, marginTop: 2 },
  emptyText: { fontSize: typography.bodySmall, textAlign: 'center', paddingVertical: 16 },

  // Concentração
  concentrationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  concentrationLabelGroup: { width: 70 },
  concentrationLabel: { fontSize: typography.caption, fontWeight: fontWeights.medium },
  concentrationSub: { fontSize: typography.micro, fontWeight: fontWeights.regular },
  concentrationBarContainer: { flex: 1 },
  barBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%' as any, borderRadius: 3 },
  concentrationPercent: { fontSize: typography.caption, fontWeight: fontWeights.medium, width: 48, textAlign: 'right' },

  // Movers
  moversRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  moversCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  moverRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  moverSymbol: { flex: 1, fontSize: typography.bodySmall, fontWeight: fontWeights.medium },
  moverChange: { fontSize: typography.caption, fontWeight: fontWeights.medium },
  emptySmall: { fontSize: typography.bodySmall, textAlign: 'center', paddingVertical: 8 },

  // Exchange
  exchangeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  exchangeInfo: { width: 80 },
  exchangeName: { fontSize: typography.bodySmall, fontWeight: fontWeights.medium },
  exchangeTokens: { fontSize: typography.micro, fontWeight: fontWeights.regular, marginTop: 1 },
  exchangeBarContainer: { flex: 1 },
  exchangeValues: { alignItems: 'flex-end', width: 80 },
  exchangeValue: { fontSize: typography.bodySmall, fontWeight: fontWeights.regular },
  exchangePercent: { fontSize: typography.micro, fontWeight: fontWeights.regular, marginTop: 1 },
})
