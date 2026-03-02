import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native'
import { memo, useMemo, useState } from 'react'
import Svg, { G, Circle, Path } from 'react-native-svg'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useBalance } from '../contexts/BalanceContext'
import { usePrivacy } from '../contexts/PrivacyContext'
import { typography, fontWeights } from '../lib/typography'
import { Balance } from '../types/api'

const BASE_CHART_SIZE = 120
const MIN_CHART_SIZE = 80
const STROKE_WIDTH = 16
const MAX_TOKENS_SHOWN = 8 // Mostra top 8 tokens, agrupa o resto como "Outros"

// Paleta de cores para tokens (tons diferentes do ExchangesPieChart)
const TOKEN_COLORS = [
  '#F59E0B', // Amarelo (BTC vibes)
  '#10B981', // Verde esmeralda
  '#8B5CF6', // Roxo
  '#EF4444', // Vermelho
  '#3B82F6', // Azul
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Laranja
  '#6366F1', // Indigo
  '#84CC16', // Lime
  '#06B6D4', // Cyan
  '#A855F7', // Violet
  '#78716C', // Stone (para "Outros")
]

// Stablecoins que ficam por último na legenda
const STABLECOINS = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'UST', 'FDUSD', 'PYUSD']

interface TokenData {
  symbol: string
  value: number
  totalAmount: number
  percentage: number
  color: string
  exchangeCount: number // Em quantas exchanges esse token aparece
}

// ===== SKELETON =====
const SkeletonTokensPieChart = memo(function SkeletonTokensPieChart({ colors, embedded }: { colors: any; embedded?: boolean }) {
  const content = (
    <>
      <View style={styles.chartContainer}>
        <View style={[styles.skeletonCircle, { 
          width: BASE_CHART_SIZE * 2, 
          height: BASE_CHART_SIZE * 2, 
          borderRadius: BASE_CHART_SIZE,
          borderWidth: STROKE_WIDTH,
          borderColor: colors.surfaceSecondary,
        }]} />
      </View>
      <View style={styles.legendContainer}>
        {[1, 2, 3, 4].map((_, i) => (
          <View key={i} style={styles.skeletonLegendItem}>
            <View style={[styles.skeletonColor, { backgroundColor: colors.surfaceSecondary }]} />
            <View style={[styles.skeletonText, { backgroundColor: colors.surfaceSecondary }]} />
          </View>
        ))}
      </View>
    </>
  )

  if (embedded) {
    return <View style={styles.content}>{content}</View>
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.content}>
        <View style={{ width: 80, height: 14, borderRadius: 4, backgroundColor: colors.surfaceSecondary, opacity: 0.5 }} />
        {content}
      </View>
    </View>
  )
})

// ===== HELPERS =====
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

const createArc = (startAngle: number, endAngle: number, radius: number) => {
  const start = polarToCartesian(0, 0, radius, endAngle)
  const end = polarToCartesian(0, 0, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}

const formatPercent = (value: number): string => {
  if (value >= 10) return value.toFixed(1)
  if (value >= 1) return value.toFixed(1)
  if (value >= 0.1) return value.toFixed(2)
  return '0.1'
}

// ===== MAIN COMPONENT =====
export const TokensPieChart = memo(function TokensPieChart({ embedded }: { embedded?: boolean }) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { data, loading } = useBalance()
  const { valuesHidden, hideValue } = usePrivacy()
  const { width: screenWidth } = useWindowDimensions()
  const [selectedToken, setSelectedToken] = useState<string | null>(null)

  // Agregar tokens de todas as exchanges
  const chartData = useMemo<TokenData[]>(() => {
    if (!data?.exchanges || data.exchanges.length === 0) return []

    // Mapa: symbol → { totalValue, totalAmount, exchangeCount }
    const tokenMap = new Map<string, { value: number; amount: number; exchanges: Set<string> }>()

    for (const exchange of data.exchanges) {
      if (!exchange.success) continue

      const balances = exchange.balances || {}
      for (const [symbol, bal] of Object.entries(balances)) {
        const balance = bal as Balance
        if (!balance || balance.total <= 0) continue

        const usdValue = balance.usd_value ?? 0
        // Ignora tokens sem valor USD significativo (< $0.01)
        if (usdValue < 0.01) continue

        const existing = tokenMap.get(symbol)
        if (existing) {
          existing.value += usdValue
          existing.amount += balance.total
          existing.exchanges.add(exchange.exchange || exchange.name || 'Unknown')
        } else {
          tokenMap.set(symbol, {
            value: usdValue,
            amount: balance.total,
            exchanges: new Set([exchange.exchange || exchange.name || 'Unknown']),
          })
        }
      }
    }

    if (tokenMap.size === 0) return []

    // Converter para array e ordenar por valor (desc)
    const allTokens = Array.from(tokenMap.entries())
      .map(([symbol, data]) => ({
        symbol,
        value: data.value,
        totalAmount: data.amount,
        exchangeCount: data.exchanges.size,
        percentage: 0,
        color: '',
      }))
      .sort((a, b) => b.value - a.value)

    const totalValue = allTokens.reduce((sum, t) => sum + t.value, 0)
    if (totalValue <= 0) return []

    // Se tem poucos tokens, mostra todos
    if (allTokens.length <= MAX_TOKENS_SHOWN) {
      return allTokens.map((token, index) => ({
        ...token,
        percentage: (token.value / totalValue) * 100,
        color: TOKEN_COLORS[index % TOKEN_COLORS.length],
      }))
    }

    // Top N + "Outros"
    const topTokens = allTokens.slice(0, MAX_TOKENS_SHOWN - 1)
    const otherTokens = allTokens.slice(MAX_TOKENS_SHOWN - 1)
    const othersValue = otherTokens.reduce((sum, t) => sum + t.value, 0)
    const othersAmount = 0 // Não faz sentido somar amounts de tokens diferentes

    const result: TokenData[] = topTokens.map((token, index) => ({
      ...token,
      percentage: (token.value / totalValue) * 100,
      color: TOKEN_COLORS[index % TOKEN_COLORS.length],
    }))

    result.push({
      symbol: 'Outros',
      value: othersValue,
      totalAmount: othersAmount,
      percentage: (othersValue / totalValue) * 100,
      color: TOKEN_COLORS[TOKEN_COLORS.length - 1], // Stone
      exchangeCount: otherTokens.length,
    })

    return result
  }, [data])

  // Token selecionado
  const selectedData = useMemo(() => {
    return chartData.find(item => item.symbol === selectedToken)
  }, [selectedToken, chartData])

  // Formatar valor USD
  const formatValue = (value: number) => {
    if (valuesHidden) return '••••••'
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`
    }
    return `$${value.toFixed(2)}`
  }

  // Toggle seleção
  const toggleToken = (symbol: string) => {
    setSelectedToken(prev => prev === symbol ? null : symbol)
  }

  // Segmentos do pie chart
  const pieSegments = useMemo(() => {
    if (chartData.length === 0) return []

    let currentAngle = -90

    return chartData.map((item) => {
      const angle = (item.percentage / 100) * 360
      const segment = {
        ...item,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
      }
      currentAngle += angle
      return segment
    })
  }, [chartData])

  // Tamanho do gráfico (mesmo cálculo do ExchangesPieChart para consistência)
  const chartSize = useMemo(() => {
    return Math.max(MIN_CHART_SIZE, Math.min(BASE_CHART_SIZE, screenWidth - 80))
  }, [screenWidth])

  const radius = chartSize / 2
  const strokeWidth = STROKE_WIDTH

  // Loading
  if (loading) {
    return <SkeletonTokensPieChart colors={colors} embedded={embedded} />
  }

  // Empty state
  if (chartData.length === 0) {
    const emptyContent = (
      <>
        {!embedded && (
          <Text style={[styles.title, { color: colors.textSecondary }]}>
            DISTRIBUIÇÃO POR TOKEN
          </Text>
        )}
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Nenhum token encontrado
          </Text>
        </View>
      </>
    )

    if (embedded) {
      return <View style={styles.content}>{emptyContent}</View>
    }

    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <View style={styles.content}>
          {emptyContent}
        </View>
      </View>
    )
  }

  const chartContent = (
    <>
      {!embedded && (
        <Text style={[styles.title, { color: colors.textSecondary }]}>
          DISTRIBUIÇÃO POR TOKEN
        </Text>
      )}

      {/* Gráfico */}
      <View style={styles.chartContainer}>
        <Svg
            width={chartSize}
            height={chartSize}
            viewBox={`${-radius} ${-radius} ${chartSize} ${chartSize}`}
          >
            <G>
              {pieSegments.map((segment, index) => {
                const isFullCircle = segment.endAngle - segment.startAngle >= 359.5
                const isSelected = selectedToken === segment.symbol
                const opacity = selectedToken && !isSelected ? 0.3 : 1

                return (
                  isFullCircle ? (
                    <Circle
                      key={index}
                      r={radius - strokeWidth / 2}
                      fill="none"
                      stroke={segment.color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      opacity={opacity}
                      onPress={() => toggleToken(segment.symbol)}
                    />
                  ) : (
                    <Path
                      key={index}
                      d={createArc(segment.startAngle, segment.endAngle, radius - strokeWidth / 2)}
                      fill="none"
                      stroke={segment.color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      opacity={opacity}
                      onPress={() => toggleToken(segment.symbol)}
                    />
                  )
                )
              })}
              {/* Círculo interno para efeito donut */}
              <Circle
                r={radius - STROKE_WIDTH - 4}
                fill={colors.card}
              />
            </G>
          </Svg>

          {/* Centro com texto */}
          <View style={styles.centerText}>
            {selectedData ? (
              <>
                <Text style={[styles.centerLabel, { color: colors.text }]} numberOfLines={1}>
                  {selectedData.symbol}
                </Text>
                <Text style={[styles.centerValue, { color: colors.primary }]}>
                  {formatValue(selectedData.value)}
                </Text>
                <Text style={[styles.centerPercentage, { color: colors.textSecondary }]} numberOfLines={1}>
                  {formatPercent(selectedData.percentage)}%
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.centerPercentage, { color: colors.textSecondary }]}>
                  100%
                </Text>
                <Text style={[styles.centerValue, { color: colors.text }]}>
                  {chartData.length === 1 ? 'Token' : 'Tokens'}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Legenda */}
        <View style={styles.legend}>
          {chartData.map((item, index) => {
            const isSelected = selectedToken === item.symbol
            const opacity = selectedToken && !isSelected ? 0.6 : 1

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.legendItem,
                  isSelected && { backgroundColor: colors.surfaceSecondary, borderRadius: 8, padding: 8, marginHorizontal: -8 }
                ]}
                onPress={() => toggleToken(item.symbol)}
                activeOpacity={0.7}
              >
                {/* Cor do token */}
                <View style={[styles.legendColor, { backgroundColor: item.color, opacity }]} />
                <View style={styles.legendTextContainer}>
                  <View style={styles.legendNameRow}>
                    <Text style={[styles.legendName, { color: colors.text, opacity }]} numberOfLines={1}>
                      {item.symbol}
                    </Text>
                    {/* Quantidade de exchanges onde aparece */}
                    {item.symbol !== 'Outros' && item.exchangeCount > 1 && (
                      <Text style={[styles.exchangeCountBadge, { color: colors.textTertiary, opacity }]}>
                        {item.exchangeCount}x
                      </Text>
                    )}
                    {item.symbol === 'Outros' && (
                      <Text style={[styles.exchangeCountBadge, { color: colors.textTertiary, opacity }]}>
                        +{item.exchangeCount}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.legendPercentage, { color: colors.textSecondary, opacity }]} numberOfLines={1}>
                    {formatPercent(item.percentage)}%
                  </Text>
                </View>
                {isSelected && (
                  <View style={[styles.selectedIndicator, { backgroundColor: item.color }]} />
                )}
              </TouchableOpacity>
            )
          })}
        </View>
    </>
  )

  if (embedded) {
    return <View style={styles.content}>{chartContent}</View>
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.content}>
        {chartContent}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  content: {
    gap: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.5,
    opacity: 0.5,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    alignSelf: 'center',
    paddingVertical: 4,
    width: '100%',
    overflow: 'hidden',
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '70%',
    alignSelf: 'center',
  },
  centerLabel: {
    fontSize: 12,
    fontWeight: fontWeights.regular,
    letterSpacing: -1,
    textAlign: 'center',
  },
  centerValue: {
    fontSize: 10,
    fontWeight: fontWeights.regular,
    marginTop: 6,
    textAlign: 'center',
  },
  centerPercentage: {
    fontSize: 8,
    fontWeight: fontWeights.regular,
    marginTop: 4,
    textAlign: 'center',
  },
  legend: {
    gap: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 20,
    paddingVertical: 1,
    width: '100%',
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendTextContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  legendName: {
    fontSize: 10,
    fontWeight: fontWeights.regular,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  legendNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  legendPercentage: {
    fontSize: 10,
    fontWeight: fontWeights.regular,
    minWidth: 36,
    maxWidth: 56,
    textAlign: 'right',
    flexShrink: 0,
  },
  exchangeCountBadge: {
    fontSize: 9,
    fontWeight: fontWeights.regular,
  },
  selectedIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.bodyLarge,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Skeleton styles
  skeletonCircle: {
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendContainer: {
    gap: 4,
  },
  skeletonLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 28,
  },
  skeletonColor: {
    width: 24,
    height: 24,
    borderRadius: 12,
    opacity: 0.3,
  },
  skeletonText: {
    flex: 1,
    height: 16,
    borderRadius: 4,
    opacity: 0.3,
  },
})
