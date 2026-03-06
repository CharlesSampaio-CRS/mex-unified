import React, { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Dimensions,
} from 'react-native'
import Svg, {
  Path,
  Line,
  Circle,
  Rect,
  Text as SvgText,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'
import { useHeader } from '@/contexts/HeaderContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { NotificationsModal } from '@/components/NotificationsModal'
import { typography, fontWeights } from '@/lib/typography'

// ─── Types ───────────────────────────────────────────────────────
interface SimConfig {
  token: string
  entryPrice: number
  quantity: number
  investedAmount: number
  takeProfitPercent: number
  stopLossEnabled: boolean
  stopLossPercent: number
  gradualSell: boolean
  gradualLots: number
  gradualTakePercent: number
  timerGradualMin: number
  timeExecutionMin: number
  dcaEnabled: boolean
  dcaBuyAmountUsd: number
  dcaTriggerPercent: number
  dcaMaxBuys: number
  buyDipEnabled: boolean
  buyDipPercent: number
  buyDipAmountUsd: number
  buyDipMaxBuys: number
  feePercent: number
  days: number
}

interface SimEvent {
  day: number
  date: string
  price: number
  type: 'take_profit' | 'gradual_sell' | 'stop_loss' | 'expired' | 'dca_buy' | 'buy_dip'
  lotNumber?: number
  quantitySold: number
  revenue: number
  fee: number
  pnl: number
  pnlPercent: number
}

interface SimResult {
  events: SimEvent[]
  remainingQuantity: number
  totalRevenue: number
  totalFees: number
  // Realizado: soma dos P&L dos eventos (vendas executadas)
  realizedPnl: number
  realizedPnlPercent: number
  // Não realizado: mark-to-market da quantidade restante
  unrealizedPnl: number
  unrealizedPnlPercent: number
  // Total = realizado + não realizado
  totalPnl: number
  totalPnlPercent: number
  totalCost: number
  highestPrice: number
  lowestPrice: number
  finalStatus: string
}

interface PricePoint {
  timestamp: number
  price: number
  date: string
}

// ─── Simulation Engine ───────────────────────────────────────────
function runSimulation(prices: PricePoint[], config: SimConfig): SimResult {
  // Track blended position
  let totalInvested = config.entryPrice * config.quantity
  let totalQty = config.quantity
  let totalCostWithBuys = totalInvested

  const events: SimEvent[] = []

  // SL fixed at entry
  const slPrice = config.stopLossEnabled
    ? config.entryPrice * (1 - config.stopLossPercent / 100)
    : 0

  // Gradual sell tracking
  const lotsCount = config.gradualSell ? Math.max(1, config.gradualLots) : 1
  let gradualLotsFired = 0
  let gradualNextTrigger = config.entryPrice * (1 + config.takeProfitPercent / 100)

  // DCA trigger prices (compound from entry)
  const dcaBuyPrices = config.dcaEnabled
    ? Array.from({ length: config.dcaMaxBuys }).map((_, i) =>
        config.entryPrice * Math.pow(1 - config.dcaTriggerPercent / 100, i + 1))
    : []
  let dcaBuysFired = 0

  // Buy Dip
  const buyDipTriggerPrice = config.buyDipEnabled
    ? config.entryPrice * (1 - config.buyDipPercent / 100)
    : 0
  let buyDipsFired = 0

  let highestPrice = config.entryPrice
  let lowestPrice = config.entryPrice
  let finalStatus = 'monitoring'

  for (let i = 0; i < prices.length; i++) {
    const p = prices[i]
    const price = p.price
    const day = i + 1
    if (price > highestPrice) highestPrice = price
    if (price < lowestPrice) lowestPrice = price

    if (totalQty <= 0) break

    // ── DCA buys ──
    while (config.dcaEnabled && dcaBuysFired < config.dcaMaxBuys && price <= dcaBuyPrices[dcaBuysFired]) {
      const buyAmt = config.dcaBuyAmountUsd
      const buyQty = buyAmt / price
      const fee = buyQty * price * (config.feePercent / 100)
      totalInvested += buyAmt + fee
      totalQty += buyQty
      totalCostWithBuys += buyAmt + fee
      events.push({ day, date: p.date, price, type: 'dca_buy', quantitySold: buyQty, revenue: -(buyAmt + fee), fee, pnl: 0, pnlPercent: 0 })
      dcaBuysFired++
      // Recalc gradual trigger from new avg
      if (config.gradualSell && gradualLotsFired === 0) {
        const newAvg = totalInvested / totalQty
        gradualNextTrigger = newAvg * (1 + config.takeProfitPercent / 100)
      }
    }

    // ── Buy Dip buys ──
    if (config.buyDipEnabled && buyDipsFired < config.buyDipMaxBuys && price <= buyDipTriggerPrice) {
      const buyAmt = config.buyDipAmountUsd
      const buyQty = buyAmt / price
      const fee = buyQty * price * (config.feePercent / 100)
      totalInvested += buyAmt + fee
      totalQty += buyQty
      totalCostWithBuys += buyAmt + fee
      events.push({ day, date: p.date, price, type: 'buy_dip', quantitySold: buyQty, revenue: -(buyAmt + fee), fee, pnl: 0, pnlPercent: 0 })
      buyDipsFired++
      if (config.gradualSell && gradualLotsFired === 0) {
        const newAvg = totalInvested / totalQty
        gradualNextTrigger = newAvg * (1 + config.takeProfitPercent / 100)
      }
    }

    const avgEntryPrice = totalQty > 0 ? totalInvested / totalQty : config.entryPrice

    // ── Stop Loss (priority) ──
    if (config.stopLossEnabled && price <= slPrice) {
      const fee = totalQty * price * (config.feePercent / 100)
      const revenue = totalQty * price - fee
      const costBasis = totalQty * avgEntryPrice
      const pnl = revenue - costBasis
      events.push({ day, date: p.date, price, type: 'stop_loss', quantitySold: totalQty, revenue, fee, pnl, pnlPercent: (pnl / costBasis) * 100 })
      totalQty = 0; totalInvested = 0; finalStatus = 'stopped_out'
      break
    }

    // ── Gradual sell ──
    if (config.gradualSell && gradualLotsFired < lotsCount) {
      if (price >= gradualNextTrigger) {
        const lotQty = config.quantity * (1 / lotsCount)
        const sellQty = Math.min(lotQty, totalQty)
        const fee = sellQty * price * (config.feePercent / 100)
        const revenue = sellQty * price - fee
        const costBasis = sellQty * avgEntryPrice
        const pnl = revenue - costBasis
        const isLastLot = gradualLotsFired + 1 === lotsCount
        events.push({
          day, date: p.date, price,
          type: isLastLot ? 'take_profit' : 'gradual_sell',
          lotNumber: gradualLotsFired + 1,
          quantitySold: sellQty, revenue, fee,
          pnl, pnlPercent: (pnl / costBasis) * 100,
        })
        totalInvested -= sellQty * avgEntryPrice
        totalQty -= sellQty
        gradualLotsFired++
        gradualNextTrigger = gradualNextTrigger * (1 + config.gradualTakePercent / 100)
        if (totalQty <= 0.0001) { totalQty = 0; finalStatus = 'completed'; break }
      }
    } else if (!config.gradualSell) {
      const currentTp = avgEntryPrice * (1 + config.takeProfitPercent / 100)
      if (price >= currentTp) {
        const fee = totalQty * price * (config.feePercent / 100)
        const revenue = totalQty * price - fee
        const costBasis = totalQty * avgEntryPrice
        const pnl = revenue - costBasis
        events.push({ day, date: p.date, price, type: 'take_profit', quantitySold: totalQty, revenue, fee, pnl, pnlPercent: (pnl / costBasis) * 100 })
        totalQty = 0; totalInvested = 0; finalStatus = 'completed'
        break
      }
    }
  }

  const sellEvents = events.filter(e => e.type !== 'dca_buy' && e.type !== 'buy_dip')
  const totalRevenue = sellEvents.reduce((s, e) => s + e.revenue, 0)
  const totalFees = events.reduce((s, e) => s + e.fee, 0)

  const realizedPnl = sellEvents.reduce((s, e) => s + e.pnl, 0)
  const soldCost = sellEvents.reduce((s, e) => s + e.quantitySold * (totalCostWithBuys / (config.quantity || 1)), 0)
  const realizedPnlPercent = soldCost > 0 ? (realizedPnl / soldCost) * 100 : 0

  const lastPrice = prices[prices.length - 1]?.price ?? config.entryPrice
  const avgFinalEntry = totalQty > 0 ? totalInvested / totalQty : config.entryPrice
  const remainingCost = totalQty * avgFinalEntry
  const remainingValue = totalQty * lastPrice
  const unrealizedPnl = remainingCost > 0 ? remainingValue - remainingCost : 0
  const unrealizedPnlPercent = remainingCost > 0 ? (unrealizedPnl / remainingCost) * 100 : 0

  const totalPnl = realizedPnl + unrealizedPnl
  const totalPnlPercent = totalCostWithBuys > 0 ? (totalPnl / totalCostWithBuys) * 100 : 0

  return {
    events,
    remainingQuantity: totalQty,
    totalRevenue,
    totalFees,
    realizedPnl,
    realizedPnlPercent,
    unrealizedPnl,
    unrealizedPnlPercent,
    totalPnl,
    totalPnlPercent,
    totalCost: totalCostWithBuys,
    highestPrice,
    lowestPrice,
    finalStatus,
  }
}

// ─── Chart Component ─────────────────────────────────────────────
const CHART_H = 200
const CHART_PADDING_LEFT = 50
const CHART_PADDING_RIGHT = 24
const CHART_PADDING_V = 20

function SimChart({
  prices,
  config,
  result,
  colors,
}: {
  prices: PricePoint[]
  config: SimConfig
  result: SimResult
  colors: any
}) {
  const screenWidth = Dimensions.get('window').width
  // Desconta margem do ScrollView (16*2) + padding do card (16*2)
  const chartW = screenWidth - 64
  const plotW = chartW - CHART_PADDING_LEFT - CHART_PADDING_RIGHT
  const plotH = CHART_H - CHART_PADDING_V * 2

  if (prices.length < 2) return null

  // Inclui entry, TP e SL no range do eixo Y para ficarem sempre visíveis
  const allPrices = prices.map(p => p.price)
  const tpPrice = config.entryPrice * (1 + config.takeProfitPercent / 100)
  const slPrice = config.stopLossEnabled
    ? config.entryPrice * (1 - config.stopLossPercent / 100)
    : null

  allPrices.push(config.entryPrice, tpPrice)
  if (slPrice !== null) allPrices.push(slPrice)

  const minP = Math.min(...allPrices) * 0.99
  const maxP = Math.max(...allPrices) * 1.01

  const toX = (i: number) => CHART_PADDING_LEFT + (i / (prices.length - 1)) * plotW
  const toY = (price: number) =>
    CHART_PADDING_V + plotH - ((price - minP) / (maxP - minP)) * plotH

  // Build path
  let d = ''
  prices.forEach((p, i) => {
    const x = toX(i)
    const y = toY(p.price)
    d += i === 0 ? `M${x},${y}` : ` L${x},${y}`
  })

  // Gradient fill path
  const firstX = toX(0)
  const lastX = toX(prices.length - 1)
  const bottomY = CHART_PADDING_V + plotH
  const fillPath = `${d} L${lastX},${bottomY} L${firstX},${bottomY} Z`

  // Y-axis labels — mostra min, entry, TP e max para contexto claro
  const formatLabel = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : v >= 1 ? `$${v.toFixed(1)}` : `$${v.toPrecision(3)}`

  const rawYValues = [minP, config.entryPrice, tpPrice, maxP]
  // Remove duplicatas próximas (< 3% de diferença) mantendo a mais relevante
  const yLabelValues = rawYValues.filter((v, i, arr) => {
    if (i === 0) return true
    return arr.slice(0, i).every(prev => Math.abs(v - prev) / prev > 0.03)
  })
  const yLabels = yLabelValues.map(v => ({
    value: v,
    y: toY(v),
    label: formatLabel(v),
  }))

  // X-axis labels (every ~7 days)
  const step = Math.max(1, Math.floor(prices.length / 6))
  const xLabels = prices
    .map((p, i) => ({ i, label: p.date.slice(5) }))
    .filter((_, i) => i % step === 0 || i === prices.length - 1)

  const lineColor = result.totalPnl >= 0 ? '#10b981' : '#ef4444'
  const tpY = toY(tpPrice)
  const slY = slPrice !== null ? toY(slPrice) : null
  const entryY = toY(config.entryPrice)

  return (
    <Svg width={chartW} height={CHART_H + 24}>
      <Defs>
        <SvgLinearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lineColor} stopOpacity="0.3" />
          <Stop offset="1" stopColor={lineColor} stopOpacity="0.02" />
        </SvgLinearGradient>
      </Defs>

      {/* Grid */}
      {yLabels.map((l, i) => (
        <Line
          key={i}
          x1={CHART_PADDING_LEFT} y1={l.y}
          x2={chartW - CHART_PADDING_RIGHT} y2={l.y}
          stroke={colors.border} strokeWidth="0.5" strokeDasharray="4,4"
        />
      ))}

      {/* Fill */}
      <Path d={fillPath} fill="url(#priceGrad)" />

      {/* Price line */}
      <Path d={d} stroke={lineColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Entry price line */}
      <Line
        x1={CHART_PADDING_LEFT} y1={entryY}
        x2={chartW - CHART_PADDING_RIGHT} y2={entryY}
        stroke="#94a3b8" strokeWidth="1" strokeDasharray="6,4"
      />

      {/* Take Profit line */}
      {tpY >= CHART_PADDING_V && tpY <= CHART_PADDING_V + plotH && (
        <>
          <Line
            x1={CHART_PADDING_LEFT} y1={tpY}
            x2={chartW - CHART_PADDING_RIGHT} y2={tpY}
            stroke="#10b981" strokeWidth="1.5" strokeDasharray="6,4"
          />
          <SvgText
            x={chartW - CHART_PADDING_RIGHT - 2} y={tpY - 4}
            fontSize={typography.badge} fill="#10b981" fontWeight="600" textAnchor="end"
          >
            TP
          </SvgText>
        </>
      )}

      {/* Stop Loss line */}
      {slY !== null && slY >= CHART_PADDING_V && slY <= CHART_PADDING_V + plotH && (
        <>
          <Line
            x1={CHART_PADDING_LEFT} y1={slY}
            x2={chartW - CHART_PADDING_RIGHT} y2={slY}
            stroke="#ef4444" strokeWidth="1.5" strokeDasharray="6,4"
          />
          <SvgText
            x={chartW - CHART_PADDING_RIGHT - 2} y={slY + 12}
            fontSize={typography.badge} fill="#ef4444" fontWeight="600" textAnchor="end"
          >
            SL
          </SvgText>
        </>
      )}

      {/* Execution markers */}
      {result.events.map((ev, idx) => {
        const xi = Math.min(ev.day - 1, prices.length - 1)
        const x = toX(xi)
        const y = toY(ev.price)
        const isLoss = ev.type === 'stop_loss'
        const markerColor = isLoss ? '#ef4444' : '#10b981'
        return (
          <React.Fragment key={idx}>
            <Line x1={x} y1={CHART_PADDING_V} x2={x} y2={CHART_PADDING_V + plotH}
              stroke={markerColor} strokeWidth="1" strokeDasharray="3,3" strokeOpacity="0.6"
            />
            <Circle cx={x} cy={y} r={5} fill={markerColor} stroke="white" strokeWidth="1.5" />
          </React.Fragment>
        )
      })}

      {/* Y-axis labels */}
      {yLabels.map((l, i) => (
        <SvgText
          key={i}
          x={CHART_PADDING_LEFT - 4} y={l.y + 4}
          fontSize={typography.pico} fill={colors.textSecondary} textAnchor="end"
        >
          {l.label}
        </SvgText>
      ))}

      {/* X-axis labels */}
      {xLabels.map(({ i, label }) => (
        <SvgText
          key={i}
          x={toX(i)} y={CHART_H + 16}
          fontSize={typography.pico} fill={colors.textSecondary} textAnchor="middle"
        >
          {label}
        </SvgText>
      ))}
    </Svg>
  )
}

// ─── Main Screen ─────────────────────────────────────────────────
const POPULAR_TOKENS = ['SOL/USDT', 'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT']
const COIN_IDS: Record<string, string> = {
  'SOL': 'solana',
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'AVAX': 'avalanche-2',
  'DOT': 'polkadot',
  'DOGE': 'dogecoin',
  'LINK': 'chainlink',
  'MATIC': 'matic-network',
  'UNI': 'uniswap',
}

export function StrategySimulatorScreen({ navigation }: any) {
  const { colors } = useTheme()
  const { unreadCount } = useNotifications()
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false)

  const onNotificationsPress = useCallback(() => {
    setNotificationsModalVisible(true)
  }, [])

  // Define o Header global para esta tela
  useHeader({
    title: "Simulador",
    subtitle: "Backtesting com dados reais",
    onNotificationsPress,
    unreadCount,
  })

  const [token, setToken] = useState('SOL/USDT')
  const [entryPrice, setEntryPrice] = useState('230')
  const [quantity, setQuantity] = useState('1')
  const [investedAmount, setInvestedAmount] = useState('')
  const [takeProfitPercent, setTakeProfitPercent] = useState('5')
  const [stopLossEnabled, setStopLossEnabled] = useState(true)
  const [stopLossPercent, setStopLossPercent] = useState('3')
  const [gradualSell, setGradualSell] = useState(true)
  const [gradualLots, setGradualLots] = useState('3')
  const [gradualTakePercent, setGradualTakePercent] = useState('2')
  const [timerGradualMin, setTimerGradualMin] = useState('15')
  const [timeExecutionMin, setTimeExecutionMin] = useState('120')
  const [dcaEnabled, setDcaEnabled] = useState(false)
  const [dcaBuyAmountUsd, setDcaBuyAmountUsd] = useState('')
  const [dcaTriggerPercent, setDcaTriggerPercent] = useState('5')
  const [dcaMaxBuys, setDcaMaxBuys] = useState('3')
  const [buyDipEnabled, setBuyDipEnabled] = useState(false)
  const [buyDipPercent, setBuyDipPercent] = useState('5')
  const [buyDipAmountUsd, setBuyDipAmountUsd] = useState('')
  const [buyDipMaxBuys, setBuyDipMaxBuys] = useState('3')
  const [feePercent, setFeePercent] = useState('0.1')
  const [days, setDays] = useState('30')

  const [prices, setPrices] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingFirstCandle, setLoadingFirstCandle] = useState(false)
  const [result, setResult] = useState<SimResult | null>(null)
  const [activeTab, setActiveTab] = useState<'config' | 'result'>('config')

  const config: SimConfig = useMemo(() => ({
    token,
    entryPrice: parseFloat(entryPrice) || 0,
    quantity: parseFloat(quantity) || 1,
    investedAmount: parseFloat(investedAmount) || 0,
    takeProfitPercent: parseFloat(takeProfitPercent) || 5,
    stopLossEnabled,
    stopLossPercent: parseFloat(stopLossPercent) || 3,
    gradualSell,
    gradualLots: parseInt(gradualLots) || 3,
    gradualTakePercent: parseFloat(gradualTakePercent) || 2,
    timerGradualMin: parseInt(timerGradualMin) || 15,
    timeExecutionMin: parseInt(timeExecutionMin) || 120,
    dcaEnabled,
    dcaBuyAmountUsd: parseFloat(dcaBuyAmountUsd) || 0,
    dcaTriggerPercent: parseFloat(dcaTriggerPercent) || 5,
    dcaMaxBuys: parseInt(dcaMaxBuys) || 3,
    buyDipEnabled,
    buyDipPercent: parseFloat(buyDipPercent) || 5,
    buyDipAmountUsd: parseFloat(buyDipAmountUsd) || 0,
    buyDipMaxBuys: parseInt(buyDipMaxBuys) || 3,
    feePercent: parseFloat(feePercent) || 0.1,
    days: parseInt(days) || 30,
  }), [token, entryPrice, quantity, investedAmount, takeProfitPercent, stopLossEnabled, stopLossPercent, gradualSell, gradualLots, gradualTakePercent, timerGradualMin, timeExecutionMin, dcaEnabled, dcaBuyAmountUsd, dcaTriggerPercent, dcaMaxBuys, buyDipEnabled, buyDipPercent, buyDipAmountUsd, buyDipMaxBuys, feePercent, days])

  // Computed
  const tpPrice = config.entryPrice * (1 + config.takeProfitPercent / 100)
  const slPrice = config.entryPrice * (1 - config.stopLossPercent / 100)
  const totalCost = config.entryPrice * config.quantity

  const fetchFirstCandle = useCallback(async () => {
    const base = token.includes('/') ? token.split('/')[0] : token
    const coinId = COIN_IDS[base.toUpperCase()] || base.toLowerCase()
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${config.days}&interval=daily`
    setLoadingFirstCandle(true)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data.prices || data.prices.length === 0) throw new Error('Sem dados')
      const firstPrice: number = data.prices[0][1]
      setEntryPrice(firstPrice.toFixed(2))
    } catch (err: any) {
      Alert.alert('Erro', `Não foi possível buscar preço: ${err.message}`)
    } finally {
      setLoadingFirstCandle(false)
    }
  }, [token, config.days])

  const fetchPrices = useCallback(async () => {
    const base = token.includes('/') ? token.split('/')[0] : token
    const coinId = COIN_IDS[base.toUpperCase()] || base.toLowerCase()
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${config.days}&interval=daily`
    setLoading(true)
    setPrices([])
    setResult(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data.prices || data.prices.length === 0) throw new Error('Sem dados de preço')
      const pts: PricePoint[] = data.prices.map(([ts, price]: [number, number]) => ({
        timestamp: ts,
        price,
        date: new Date(ts).toLocaleDateString('pt-BR', { month: '2-digit', day: '2-digit' }),
      }))
      setPrices(pts)
      const sim = runSimulation(pts, config)
      setResult(sim)
      setActiveTab('result')
    } catch (err: any) {
      Alert.alert('Erro', `Não foi possível buscar preços: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [token, config])

  const formatUSD = (v: number) => {
    if (Math.abs(v) >= 1000) return `$${(v).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
    if (Math.abs(v) >= 1) return `$${v.toFixed(2)}`
    return `$${v.toFixed(4)}`
  }

  const formatPct = (v: number) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(2)}%`

  const eventTypeLabel = (type: string, lot?: number) => {
    if (type === 'take_profit') return lot ? `✅ TP - Lote ${lot}` : '✅ Take Profit Total'
    if (type === 'gradual_sell') return `📊 Venda Gradual - Lote ${lot}`
    if (type === 'stop_loss') return '🛑 Stop Loss'
    if (type === 'expired') return '⏰ Expirado'
    if (type === 'dca_buy') return '📉 Compra DCA'
    if (type === 'buy_dip') return '🛒 Auto Buy Dip'
    return type
  }

  const statusLabel = (s: string) => {
    if (s === 'completed') return { label: '✅ Concluída', color: '#10b981' }
    if (s === 'stopped_out') return { label: '🛑 Stop Loss', color: '#ef4444' }
    if (s === 'monitoring') return { label: 'Em Monitoramento', color: '#3b82f6' }
    return { label: s, color: colors.textSecondary }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['config', 'result'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.textSecondary }]}>
              {tab === 'config' ? '⚙️  Configurar' : '📊  Resultado'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'config' && (
          <View style={{ gap: 16 }}>
            {/* Token quick-select */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>🪙 Token</Text>
              <View style={styles.chipRow}>
                {POPULAR_TOKENS.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, { borderColor: token === t ? colors.primary : colors.border, backgroundColor: token === t ? `${colors.primary}18` : 'transparent' }]}
                    onPress={() => {
                      setToken(t)
                      if (t === 'SOL/USDT') setEntryPrice('230')
                      else if (t === 'BTC/USDT') setEntryPrice('95000')
                      else if (t === 'ETH/USDT') setEntryPrice('3000')
                    }}
                  >
                    <Text style={[styles.chipText, { color: token === t ? colors.primary : colors.text }]}>
                      {t.replace('/USDT', '')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Posição */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>📍 Posição</Text>

              {/* Aviso fonte dos dados */}
              <View style={[styles.infoBox, { backgroundColor: '#f59e0b10', borderColor: '#f59e0b30' }]}>
                <Text style={{ color: '#f59e0b', fontSize: typography.caption, lineHeight: 18 }}>
                  ⚠️ Os preços históricos vêm da CoinGecko — últimos {days} dias a partir de hoje.
                  O preço de entrada abaixo deve ser coerente com esses valores para um backtesting realista.
                </Text>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Preço de Entrada (USDT)</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                    value={entryPrice}
                    onChangeText={v => setEntryPrice(v.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="Ex: 230"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TouchableOpacity
                    style={[styles.useFirstCandleBtn, { borderColor: colors.border }]}
                    onPress={fetchFirstCandle}
                    disabled={loadingFirstCandle}
                  >
                    {loadingFirstCandle
                      ? <ActivityIndicator size={10} color={colors.primary} />
                      : <Ionicons name="sync-outline" size={12} color={colors.primary} />
                    }
                    <Text style={{ color: colors.primary, fontSize: typography.caption }}>
                      Usar preço inicial do período
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Quantidade</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                    value={quantity}
                    onChangeText={v => setQuantity(v.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="Ex: 1"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>
              <View>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Valor Investido (USD)</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  value={investedAmount}
                  onChangeText={v => setInvestedAmount(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder={config.entryPrice > 0 ? String((config.entryPrice * config.quantity).toFixed(2)) : 'Ex: 36.00'}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              {config.entryPrice > 0 && (
                <View style={[styles.infoBox, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30` }]}>
                  <Text style={[styles.infoText, { color: colors.primary }]}>
                    💰 Custo total: {formatUSD(totalCost)}
                  </Text>
                </View>
              )}
            </View>

            {/* Take Profit */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>🎯 Take Profit</Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Alvo (%)</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                    value={takeProfitPercent}
                    onChangeText={v => setTakeProfitPercent(v.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="5.0"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={[styles.priceTag, { backgroundColor: '#10b98120', borderColor: '#10b98140' }]}>
                  <Text style={{ color: '#10b981', fontSize: typography.caption, fontWeight: fontWeights.semibold }}>
                    Trigger
                  </Text>
                  <Text style={{ color: '#10b981', fontSize: typography.bodyLarge, fontWeight: fontWeights.bold }}>
                    {config.entryPrice > 0 ? formatUSD(tpPrice) : '—'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Stop Loss */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>🛑 Stop Loss</Text>
                <Switch
                  value={stopLossEnabled}
                  onValueChange={v => {
                    setStopLossEnabled(v)
                    if (v && dcaEnabled) setDcaEnabled(false)
                  }}
                  trackColor={{ true: '#ef4444', false: colors.border }}
                  thumbColor="#fff"
                />
              </View>
              {stopLossEnabled && (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Limite (%)</Text>
                    <TextInput
                      style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                      value={stopLossPercent}
                      onChangeText={v => setStopLossPercent(v.replace(/[^0-9.]/g, ''))}
                      keyboardType="decimal-pad"
                      placeholder="3.0"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={[styles.priceTag, { backgroundColor: '#ef444420', borderColor: '#ef444440' }]}>
                    <Text style={{ color: '#ef4444', fontSize: typography.caption, fontWeight: fontWeights.semibold }}>
                      Trigger
                    </Text>
                    <Text style={{ color: '#ef4444', fontSize: typography.bodyLarge, fontWeight: fontWeights.bold }}>
                      {config.entryPrice > 0 ? formatUSD(slPrice) : '—'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Venda Gradual */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>📊 Venda Gradual</Text>
                <Switch
                  value={gradualSell}
                  onValueChange={setGradualSell}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor="#fff"
                />
              </View>
              {gradualSell && (
                <View style={{ gap: 12 }}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Número de Lotes</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                        value={gradualLots}
                        onChangeText={v => setGradualLots(v.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        placeholder="3"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View style={{ width: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Incremento por Lote (%)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                        value={gradualTakePercent}
                        onChangeText={v => setGradualTakePercent(v.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        placeholder="2.0"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Timer Gradual (min)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                        value={timerGradualMin}
                        onChangeText={v => setTimerGradualMin(v.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        placeholder="15"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View style={{ width: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Timeout Execução (min)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                        value={timeExecutionMin}
                        onChangeText={v => setTimeExecutionMin(v.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        placeholder="120"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>
                  {/* Preview dos lotes */}
                  {config.entryPrice > 0 && (
                    <View style={{ gap: 4 }}>
                      {Array.from({ length: Math.min(config.gradualLots, 6) }).map((_, i) => {
                        const lotTrigger = config.entryPrice *
                          Math.pow(1 + config.gradualTakePercent / 100, i + 1)
                        const pct = ((lotTrigger / config.entryPrice) - 1) * 100
                        return (
                          <View key={i} style={styles.lotRow}>
                            <Text style={[styles.lotLabel, { color: colors.textSecondary }]}>
                              Lote {i + 1} ({Math.round(100 / config.gradualLots)}%)
                            </Text>
                            <Text style={[styles.lotPrice, { color: '#10b981' }]}>
                              {formatUSD(lotTrigger)} (+{pct.toFixed(1)}%)
                            </Text>
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* DCA */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: dcaEnabled ? '#3b82f640' : colors.cardBorder }]}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>📉 DCA (Compra na Queda)</Text>
                  <Text style={{ fontSize: typography.caption, color: colors.textSecondary, marginTop: 2 }}>Compra mais quando o preço cai, baixando o preço médio</Text>
                </View>
                <Switch
                  value={dcaEnabled}
                  onValueChange={v => {
                    setDcaEnabled(v)
                    if (v && stopLossEnabled) setStopLossEnabled(false)
                  }}
                  trackColor={{ true: '#3b82f6', false: colors.border }}
                  thumbColor="#fff"
                />
              </View>
              {dcaEnabled && (
                <View style={{ gap: 12 }}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Valor por compra (USD)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                        value={dcaBuyAmountUsd}
                        onChangeText={v => setDcaBuyAmountUsd(v.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        placeholder="36.00"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View style={{ width: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Queda para acionar (%)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                        value={dcaTriggerPercent}
                        onChangeText={v => setDcaTriggerPercent(v.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        placeholder="5.0"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>
                  <View>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Máx. de compras DCA</Text>
                    <TextInput
                      style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                      value={dcaMaxBuys}
                      onChangeText={v => setDcaMaxBuys(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      placeholder="3"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  {config.entryPrice > 0 && config.dcaBuyAmountUsd > 0 && (
                    <View style={{ gap: 4 }}>
                      {Array.from({ length: Math.min(config.dcaMaxBuys, 5) }).map((_, i) => {
                        const dcaPrice = config.entryPrice * Math.pow(1 - config.dcaTriggerPercent / 100, i + 1)
                        const pct = ((dcaPrice / config.entryPrice) - 1) * 100
                        return (
                          <View key={i} style={styles.lotRow}>
                            <Text style={[styles.lotLabel, { color: colors.textSecondary }]}>DCA #{i + 1}</Text>
                            <Text style={[styles.lotPrice, { color: '#3b82f6' }]}>{formatUSD(dcaPrice)} ({pct.toFixed(1)}%)</Text>
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Auto Buy Dip */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: buyDipEnabled ? '#05966940' : colors.cardBorder }]}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>🛒 Auto Buy Dip</Text>
                  <Text style={{ fontSize: typography.caption, color: colors.textSecondary, marginTop: 2 }}>Compra automaticamente quando o preço cair X% do preço base</Text>
                </View>
                <Switch
                  value={buyDipEnabled}
                  onValueChange={setBuyDipEnabled}
                  trackColor={{ true: '#059669', false: colors.border }}
                  thumbColor="#fff"
                />
              </View>
              {buyDipEnabled && (
                <View style={{ gap: 12 }}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Queda para comprar (%)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                        value={buyDipPercent}
                        onChangeText={v => setBuyDipPercent(v.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        placeholder="5.0"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View style={{ width: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Valor por compra (USD)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                        value={buyDipAmountUsd}
                        onChangeText={v => setBuyDipAmountUsd(v.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        placeholder="50.00"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>
                  <View>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Máx. de compras</Text>
                    <TextInput
                      style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                      value={buyDipMaxBuys}
                      onChangeText={v => setBuyDipMaxBuys(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      placeholder="3"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  {config.entryPrice > 0 && (
                    <View style={[styles.infoBox, { backgroundColor: '#05966910', borderColor: '#05966930' }]}>
                      <Text style={{ fontSize: typography.caption, color: '#059669', fontWeight: fontWeights.medium }}>
                        Trigger: {formatUSD(config.entryPrice * (1 - config.buyDipPercent / 100))} (-{config.buyDipPercent}%)
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Configurações Gerais */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>⚙️ Configurações</Text>
              <View>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Taxa por operação (%)</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  value={feePercent}
                  onChangeText={v => setFeePercent(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0.1"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Período (backtesting)</Text>
                <View style={[styles.chipRow, { marginTop: 0 }]}>
                  {['7', '15', '30', '60', '90'].map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.chip, { borderColor: days === d ? colors.primary : colors.border, backgroundColor: days === d ? `${colors.primary}18` : 'transparent', paddingHorizontal: 14, paddingVertical: 8 }]}
                      onPress={() => setDays(d)}
                    >
                      <Text style={[styles.chipText, { color: days === d ? colors.primary : colors.text }]}>{d}d</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Run Button */}
            <TouchableOpacity
              style={[styles.runButton, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
              onPress={fetchPrices}
              disabled={loading || config.entryPrice <= 0}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="play-circle" size={20} color="#fff" />
                  <Text style={styles.runButtonText}>Simular Estratégia</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'result' && (
          <View style={{ gap: 16 }}>
            {!result ? (
              <View style={[styles.emptyResult, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={{ fontSize: typography.emojiHuge, marginBottom: 12 }}>🧪</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhuma simulação ainda</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  Configure a estratégia na aba anterior e toque em "Simular".
                </Text>
                <TouchableOpacity
                  style={[styles.runButton, { backgroundColor: colors.primary, marginTop: 16, alignSelf: 'center', paddingHorizontal: 32 }]}
                  onPress={() => setActiveTab('config')}
                >
                  <Text style={styles.runButtonText}>Configurar agora</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Summary card */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {token} — {days} dias
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusLabel(result.finalStatus).color}20` }]}>
                      <Text style={[styles.statusText, { color: statusLabel(result.finalStatus).color }]}>
                        {statusLabel(result.finalStatus).label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricsGrid}>
                    <View style={styles.metric}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>P&L Realizado</Text>
                      <Text style={[styles.metricValue, { color: result.realizedPnl >= 0 ? '#10b981' : '#ef4444' }]}>
                        {result.realizedPnl >= 0 ? '+' : ''}{formatUSD(result.realizedPnl)}
                      </Text>
                      <Text style={[styles.metricSub, { color: result.realizedPnlPercent >= 0 ? '#10b981' : '#ef4444' }]}>
                        {formatPct(result.realizedPnlPercent)}
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>P&L Não Real.</Text>
                      <Text style={[styles.metricValue, { color: result.unrealizedPnl >= 0 ? '#10b981' : '#ef4444' }]}>
                        {result.remainingQuantity > 0
                          ? `${result.unrealizedPnl >= 0 ? '+' : ''}${formatUSD(result.unrealizedPnl)}`
                          : '—'}
                      </Text>
                      <Text style={[styles.metricSub, { color: colors.textSecondary }]}>
                        {result.remainingQuantity > 0
                          ? `${((result.remainingQuantity / config.quantity) * 100).toFixed(0)}% restante`
                          : 'posição fechada'}
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>P&L Total</Text>
                      <Text style={[styles.metricValue, { color: result.totalPnl >= 0 ? '#10b981' : '#ef4444' }]}>
                        {result.totalPnl >= 0 ? '+' : ''}{formatUSD(result.totalPnl)}
                      </Text>
                      <Text style={[styles.metricSub, { color: result.totalPnlPercent >= 0 ? '#10b981' : '#ef4444' }]}>
                        {formatPct(result.totalPnlPercent)}
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Custo</Text>
                      <Text style={[styles.metricValue, { color: colors.text }]}>{formatUSD(result.totalCost)}</Text>
                      <Text style={[styles.metricSub, { color: colors.textSecondary }]}>{config.quantity} {token.split('/')[0]}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Receita</Text>
                      <Text style={[styles.metricValue, { color: colors.text }]}>{formatUSD(result.totalRevenue)}</Text>
                      <Text style={[styles.metricSub, { color: colors.textSecondary }]}>Taxas: {formatUSD(result.totalFees)}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Execuções</Text>
                      <Text style={[styles.metricValue, { color: colors.text }]}>{result.events.length}</Text>
                      <Text style={[styles.metricSub, { color: colors.textSecondary }]}>
                        {result.events.filter(e => e.type !== 'stop_loss').length} TP · {result.events.filter(e => e.type === 'stop_loss').length} SL
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Máxima</Text>
                      <Text style={[styles.metricValue, { color: '#10b981' }]}>{formatUSD(result.highestPrice)}</Text>
                      <Text style={[styles.metricSub, { color: '#10b981' }]}>
                        {formatPct(((result.highestPrice / config.entryPrice) - 1) * 100)}
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Mínima</Text>
                      <Text style={[styles.metricValue, { color: '#ef4444' }]}>{formatUSD(result.lowestPrice)}</Text>
                      <Text style={[styles.metricSub, { color: '#ef4444' }]}>
                        {formatPct(((result.lowestPrice / config.entryPrice) - 1) * 100)}
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Último preço</Text>
                      <Text style={[styles.metricValue, { color: colors.text }]}>
                        {prices.length > 0 ? formatUSD(prices[prices.length - 1].price) : '—'}
                      </Text>
                      <Text style={[styles.metricSub, { color: colors.textSecondary }]}>último candle</Text>
                    </View>
                  </View>
                </View>

                {/* Chart */}
                {prices.length > 0 && (
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>📈 Gráfico de Preço + Triggers</Text>
                    <View style={{ flexDirection: 'row', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendLine, { backgroundColor: '#94a3b8' }]} />
                        <Text style={[styles.legendText, { color: colors.textSecondary }]}>Entrada {formatUSD(config.entryPrice)}</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendLine, { backgroundColor: '#10b981' }]} />
                        <Text style={[styles.legendText, { color: colors.textSecondary }]}>TP {formatUSD(tpPrice)}</Text>
                      </View>
                      {stopLossEnabled && (
                        <View style={styles.legendItem}>
                          <View style={[styles.legendLine, { backgroundColor: '#ef4444' }]} />
                          <Text style={[styles.legendText, { color: colors.textSecondary }]}>SL {formatUSD(slPrice)}</Text>
                        </View>
                      )}
                    </View>
                    <SimChart prices={prices} config={config} result={result} colors={colors} />
                  </View>
                )}

                {/* Events log */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
                    📋 Log de Execuções ({result.events.length})
                  </Text>
                  {result.events.length === 0 ? (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                      <Text style={{ fontSize: typography.emoji }}>😴</Text>
                      <Text style={[{ color: colors.textSecondary, marginTop: 8, textAlign: 'center', fontSize: typography.body }]}>
                        Nenhum trigger disparou neste período.{'\n'}
                        Tente ajustar o Take Profit ou o período de simulação.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {result.events.map((ev, idx) => {
                          const isBuy = ev.type === 'dca_buy' || ev.type === 'buy_dip'
                          const evColor = ev.type === 'stop_loss' ? '#ef4444' : isBuy ? '#3b82f6' : '#10b981'
                          return (
                          <View
                            key={idx}
                            style={[styles.eventCard, { borderColor: evColor + '40', backgroundColor: evColor + '08' }]}
                          >
                          <View style={styles.rowBetween}>
                            <Text style={[styles.eventType, { color: evColor, flexShrink: 1 }]} numberOfLines={1}>
                              {eventTypeLabel(ev.type, ev.lotNumber)}
                            </Text>
                            <Text style={[styles.eventDate, { color: colors.textSecondary }]}>
                              Dia {ev.day} — {ev.date}
                            </Text>
                          </View>
                          <View style={styles.eventDetails}>
                            <View style={styles.eventStat}>
                              <Text style={[styles.eventStatLabel, { color: colors.textSecondary }]}>Preço</Text>
                              <Text style={[styles.eventStatValue, { color: colors.text }]}>{formatUSD(ev.price)}</Text>
                            </View>
                            <View style={styles.eventStat}>
                              <Text style={[styles.eventStatLabel, { color: colors.textSecondary }]}>Qtd</Text>
                              <Text style={[styles.eventStatValue, { color: colors.text }]}>{ev.quantitySold.toFixed(4)}</Text>
                            </View>
                            {isBuy ? (
                              <View style={styles.eventStat}>
                                <Text style={[styles.eventStatLabel, { color: colors.textSecondary }]}>Custo</Text>
                                <Text style={[styles.eventStatValue, { color: '#3b82f6' }]}>{formatUSD(-ev.revenue)}</Text>
                              </View>
                            ) : (
                              <>
                                <View style={styles.eventStat}>
                                  <Text style={[styles.eventStatLabel, { color: colors.textSecondary }]}>Receita</Text>
                                  <Text style={[styles.eventStatValue, { color: colors.text }]}>{formatUSD(ev.revenue)}</Text>
                                </View>
                                <View style={styles.eventStat}>
                                  <Text style={[styles.eventStatLabel, { color: colors.textSecondary }]}>P&L</Text>
                                  <Text style={[styles.eventStatValue, { color: ev.pnl >= 0 ? '#10b981' : '#ef4444' }]}>
                                    {ev.pnl >= 0 ? '+' : ''}{formatUSD(ev.pnl)}
                                  </Text>
                                  <Text style={[styles.eventStatLabel, { color: ev.pnl >= 0 ? '#10b981' : '#ef4444' }]}>
                                    {formatPct(ev.pnlPercent)}
                                  </Text>
                                </View>
                              </>
                            )}
                          </View>
                        </View>
                          )
                        })}
                    </View>
                  )}
                </View>

                {/* Re-run button */}
                <TouchableOpacity
                  style={[styles.runButton, { backgroundColor: colors.primary }]}
                  onPress={() => setActiveTab('config')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="settings" size={18} color="#fff" />
                  <Text style={styles.runButtonText}>Ajustar e Simular Novamente</Text>
                </TouchableOpacity>

                {/* Create Strategy button */}
                <TouchableOpacity
                  style={[styles.createStrategyButton, { borderColor: '#10b981' }]}
                  onPress={() => {
                    navigation?.navigate('Strategy', {
                      openCreate: true,
                      simulatorPreset: {
                        token,
                        basePrice: entryPrice,
                        investedAmount: investedAmount || String(config.entryPrice * config.quantity),
                        takeProfitPercent,
                        stopLossEnabled,
                        stopLossPercent,
                        gradualSell,
                        gradualLots,
                        gradualTakePercent,
                        timerGradualMin,
                        timeExecutionMin,
                        feePercent,
                        dcaEnabled,
                        dcaBuyAmountUsd,
                        dcaTriggerPercent,
                        dcaMaxBuys,
                        buyDipEnabled,
                        buyDipPercent,
                        buyDipAmountUsd,
                        buyDipMaxBuys,
                      },
                    })
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#10b981" />
                  <Text style={[styles.createStrategyText, { color: '#10b981' }]}>Criar Estratégia com estes Parâmetros</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
      <NotificationsModal
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: typography.body, fontWeight: fontWeights.medium },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  sectionTitle: { fontSize: typography.bodyLarge, fontWeight: fontWeights.semibold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: typography.caption, fontWeight: fontWeights.medium },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: typography.caption, marginBottom: 6, fontWeight: fontWeights.medium },
  input: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: typography.body,
  },
  useFirstCandleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 6, paddingVertical: 4,
  },
  infoBox: { borderRadius: 8, borderWidth: 1, padding: 10, marginTop: 4 },
  infoText: { fontSize: typography.caption, fontWeight: fontWeights.medium },
  priceTag: {
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 14,
    paddingVertical: 10, alignItems: 'center', justifyContent: 'center', minWidth: 90,
  },
  lotRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 0.5, borderTopColor: '#ffffff10' },
  lotLabel: { fontSize: typography.caption },
  lotPrice: { fontSize: typography.caption, fontWeight: fontWeights.semibold },
  runButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24,
  },
  runButtonText: { color: '#fff', fontSize: typography.bodyLarge, fontWeight: fontWeights.bold },
  emptyResult: { borderRadius: 12, borderWidth: 1, padding: 32, alignItems: 'center', gap: 4 },
  emptyTitle: { fontSize: typography.h4, fontWeight: fontWeights.semibold },
  emptyDesc: { fontSize: typography.body, textAlign: 'center' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: typography.caption, fontWeight: fontWeights.semibold },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, marginTop: 8 },
  metric: { width: '33.33%', paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' },
  metricLabel: { fontSize: typography.micro, marginBottom: 4, fontWeight: fontWeights.medium },
  metricValue: { fontSize: typography.bodyLarge, fontWeight: fontWeights.bold },
  metricSub: { fontSize: typography.micro, marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 16, height: 2, borderRadius: 1, opacity: 0.9 },
  legendText: { fontSize: typography.micro },
  eventCard: { borderRadius: 8, borderWidth: 1, padding: 12, gap: 8 },
  eventType: { fontSize: typography.caption, fontWeight: fontWeights.semibold },
  eventDate: { fontSize: typography.micro },
  eventDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eventStat: { gap: 2, minWidth: '22%', flexShrink: 1 },
  eventStatLabel: { fontSize: typography.micro, fontWeight: fontWeights.medium },
  eventStatValue: { fontSize: typography.micro, fontWeight: fontWeights.semibold },
  createStrategyButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24,
    borderWidth: 1.5,
  },
  createStrategyText: { fontSize: typography.body, fontWeight: fontWeights.semibold },
})
