import { View, Text, StyleSheet, Image, TouchableOpacity, useWindowDimensions } from 'react-native'
import { memo, useMemo, useState } from 'react'
import Svg, { G, Circle, Path } from 'react-native-svg'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useBalance } from '../contexts/BalanceContext'
import { usePrivacy } from '../contexts/PrivacyContext'
import { typography, fontWeights } from '../lib/typography'
import { capitalizeExchangeName } from '../lib/exchange-helpers'

const BASE_CHART_SIZE = 120
const MIN_CHART_SIZE = 80
const STROKE_WIDTH = 16 // Reduzido de 20 para 16 (mais fino e suave)

// Paleta de cores suaves e elegantes (tons pastéis e menos saturados)
const EXCHANGE_COLORS = [
  '#2563EB', // Azul forte
  '#1D4ED8', // Azul escuro
  '#0284C7', // Ciano forte
  '#7C3AED', // Roxo forte
  '#F59E42', // Laranja forte
  '#F43F5E', // Vermelho forte
  '#10B981', // Verde forte
  '#FACC15', // Amarelo forte
  '#E11D48', // Rosa forte
  '#6366F1', // Indigo forte
  '#A21CAF', // Roxo escuro
  '#0891B2', // Turquesa forte
]

// Mapeamento de ícones das exchanges
const EXCHANGE_ICONS: Record<string, any> = {
  'Binance': require('../assets/binance.png'),
  'Bybit': require('../assets/bybit.png'),
  'Coinbase': require('../assets/coinbase.png'),
  'Gate.io': require('../assets/gateio.png'),
  'Kraken': require('../assets/kraken.png'),
  'KuCoin': require('../assets/kucoin.png'),
  'MEXC': require('../assets/mexc.png'),
  'NovaDAX': require('../assets/novadax.png'),
  'OKX': require('../assets/okx.png'),
}

interface ExchangeData {
  name: string
  value: number
  percentage: number
  color: string
  hasError?: boolean // 🆕 Indica se a exchange teve erro
  error?: string // 🆕 Mensagem de erro
}

// Componente Skeleton para loading
const SkeletonExchangesPieChart = memo(function SkeletonExchangesPieChart({ embedded }: { embedded?: boolean }) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { width } = useWindowDimensions()
  const chartSize = Math.max(MIN_CHART_SIZE, Math.min(BASE_CHART_SIZE, width - 80))
  
  const content = (
    <>
      {!embedded && (
        <Text style={[styles.title, { color: colors.text }]}>
          {t('home.distribution') || 'Distribuição por Exchange'}
        </Text>
      )}
      <View style={styles.chartContainer}>
        <View style={[styles.skeletonCircle, { backgroundColor: colors.surfaceSecondary, width: chartSize, height: chartSize, borderRadius: chartSize / 2 }]} />
      </View>
      <View style={styles.legendContainer}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonLegendItem}>
            <View style={[styles.skeletonColor, { backgroundColor: colors.border }]} />
            <View style={[styles.skeletonText, { backgroundColor: colors.border }]} />
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
        {content}
      </View>
    </View>
  )
})

export const ExchangesPieChart = memo(function ExchangesPieChart({ embedded }: { embedded?: boolean }) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { data, loading, error } = useBalance()
  const { valuesHidden } = usePrivacy()
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null)
  const { width } = useWindowDimensions()
  const chartSize = Math.max(MIN_CHART_SIZE, Math.min(BASE_CHART_SIZE, width - 80))
  const radius = chartSize / 2

  const formatPercent = (value: number) => {
    const fixed = value.toFixed(1)
    return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed
  }

  const chartData = useMemo(() => {
    if (!data || !data.exchanges) return []
    
    // ✅ Mostrar TODAS as exchanges conectadas (mesmo as que falharam)
    // Exchanges com erro aparecem com $0 e usuário pode clicar para ver detalhes
    const exchangesWithBalance = data.exchanges
    
    if (exchangesWithBalance.length === 0) return []

    // Calcular total (de todas as exchanges com sucesso)
    const total = exchangesWithBalance.reduce(
      (sum: number, ex: any) => sum + parseFloat(ex.total_usd || 0), 
      0
    )
    
    // 🔍 DEBUG: Comparar total calculado com total_usd da raiz
    const rootTotal = typeof data.total_usd === 'string' 
      ? parseFloat(data.total_usd) 
      : (data.total_usd || 0)
    
    if (Math.abs(total - rootTotal) > 0.01) {
      console.warn('⚠️ [ExchangesPieChart] Diferença entre totais detectada:')
      console.warn(`  📊 Total da raiz: $${rootTotal.toFixed(6)}`)
      console.warn(`  🧮 Total calculado (soma exchanges): $${total.toFixed(6)}`)
      console.warn(`  💰 Diferença: $${(rootTotal - total).toFixed(6)}`)
      console.warn(`  📋 Exchanges incluídas no cálculo:`, exchangesWithBalance.map((ex: any) => ({
        name: ex.name || ex.exchange,
        total_usd: ex.total_usd,
        success: ex.success
      })))
    }

    // Criar dados com porcentagem
    const chartDataItems: ExchangeData[] = exchangesWithBalance.map((ex: any, index: number) => ({
      name: capitalizeExchangeName(ex.name || ex.exchange),
      value: parseFloat(ex.total_usd || 0),
      percentage: total > 0 ? (parseFloat(ex.total_usd || 0) / total) * 100 : 0,
      color: EXCHANGE_COLORS[index % EXCHANGE_COLORS.length],
      hasError: ex.success === false, // 🆕 Marca exchanges com erro
      error: ex.error, // 🆕 Mensagem de erro
    }))

    // Se total zerado, força 100% na primeira exchange para renderizar o pie
    if (total <= 0 && chartDataItems.length > 0) {
      chartDataItems[0].percentage = 100
      for (let i = 1; i < chartDataItems.length; i++) {
        chartDataItems[i].percentage = 0
      }
    }

    // Ordenar por valor decrescente
    return chartDataItems.sort((a, b) => b.value - a.value)
  }, [data])

  // Dados da exchange selecionada
  const selectedData = useMemo(() => {
    if (!selectedExchange) return null
    return chartData.find(item => item.name === selectedExchange)
  }, [selectedExchange, chartData])

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

  // Toggle seleção de exchange
  const toggleExchange = (exchangeName: string) => {
    setSelectedExchange(prev => prev === exchangeName ? null : exchangeName)
  }

  const pieSegments = useMemo(() => {
    if (chartData.length === 0) return []

    let currentAngle = -90 // Começar do topo

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

  const createArc = (startAngle: number, endAngle: number, radius: number) => {
    const start = polarToCartesian(0, 0, radius, endAngle)
    const end = polarToCartesian(0, 0, radius, startAngle)
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

    return [
      'M', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    ].join(' ')
  }

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    }
  }

  // Mostra skeleton apenas durante loading inicial (não durante refresh)
  // IMPORTANTE: Esse check deve vir DEPOIS de todos os hooks
  if (loading && !data && !error) {
    return <SkeletonExchangesPieChart embedded={embedded} />
  }

  if (chartData.length === 0) {
    const emptyContent = (
      <>
        {!embedded && (
          <Text style={[styles.title, { color: colors.text }]}>
            {t('home.distribution') || 'Por Exchange'}
          </Text>
        )}
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('home.noExchangesConnected') || 'Nenhuma exchange conectada'}
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
        <Text style={[styles.title, { color: colors.text }]}>
          {t('home.distribution') || 'Distribuição por Exchange'}
        </Text>
      )}

        <View style={styles.chartContainer}>
          {/* Gráfico de Pizza */}
          <Svg width={chartSize} height={chartSize} viewBox={`${-radius} ${-radius} ${chartSize} ${chartSize}`}>
            <G>
              {pieSegments.map((segment, index) => {
                const isSelected = selectedExchange === segment.name
                const strokeWidth = isSelected ? STROKE_WIDTH + 2 : STROKE_WIDTH // Reduzido de +4 para +2
                const opacity = selectedExchange && !isSelected ? 0.5 : 1 // Aumentado de 0.3 para 0.5 (menos contraste)
                const isFullCircle = segment.percentage >= 99.99
                
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
                      onPress={() => toggleExchange(segment.name)}
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
                      onPress={() => toggleExchange(segment.name)}
                    />
                  )
                )
              })}
              {/* Círculo interno para criar efeito de donut */}
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
                  {selectedData.name}
                </Text>
                {selectedData.hasError ? (
                  <>
                    <Text style={[styles.centerValue, { color: '#EF4444', fontSize: 16 }]}>
                      {t('chart.error')}
                    </Text>
                    <Text style={[styles.centerPercentage, { color: colors.textSecondary, fontSize: 10, textAlign: 'center' }]} numberOfLines={2}>
                      {t('chart.fetchError')}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.centerValue, { color: colors.primary }]}>
                      {formatValue(selectedData.value)}
                    </Text>
                    <Text style={[styles.centerPercentage, { color: colors.textSecondary }]} numberOfLines={1}>
                      {formatPercent(selectedData.percentage)}%
                    </Text>
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={[styles.centerPercentage, { color: colors.textSecondary }]}>
                  100%
                </Text>
                <Text style={[styles.centerValue, { color: colors.text }]}>
                  {chartData.length === 1 ? 'Exchange' : 'Exchanges'}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Legenda */}
        <View style={styles.legend}>
          {chartData.map((item, index) => {
            const isSelected = selectedExchange === item.name
            const opacity = selectedExchange && !isSelected ? 0.6 : 1 // Aumentado de 0.4 para 0.6 (menos contraste)
            
            return (
              <TouchableOpacity 
                key={index} 
                style={[
                  styles.legendItem,
                  isSelected && { backgroundColor: colors.surfaceSecondary, borderRadius: 8, padding: 8, marginHorizontal: -8 }
                ]}
                onPress={() => toggleExchange(item.name)}
                activeOpacity={0.7}
              >
                {/* Ícone da Exchange */}
                <View style={[styles.legendColor, { backgroundColor: item.color, opacity }]} />
                <View style={styles.legendTextContainer}>
                  <View style={styles.legendNameRow}>
                    <Text style={[styles.legendName, { color: colors.text, opacity }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {/* ⚠️ Indicador de erro */}
                    {item.hasError && (
                      <Text style={{ fontSize: 10, opacity: opacity * 0.8 }}>⚠️</Text>
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
    fontSize: 12, // Reduzido
    fontWeight: fontWeights.regular, // light→regular
    letterSpacing: -1,
    textAlign: 'center',
  },
  centerValue: {
    fontSize: 10, // Reduzido
    fontWeight: fontWeights.medium, // regular→medium
    marginTop: 6, // 4→6
    textAlign: 'center',
  },
  centerPercentage: {
    fontSize: 8, // Reduzido
    fontWeight: fontWeights.medium, // regular→medium
    marginTop: 4, // 2→4
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
  exchangeIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  exchangeIcon: {
    width: 20,
    height: 20,
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
    fontWeight: fontWeights.medium,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  legendPercentage: {
    fontSize: 10,
    fontWeight: fontWeights.medium,
    minWidth: 36,
    maxWidth: 56,
    textAlign: 'right',
    flexShrink: 0,
  },
  legendNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
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
    fontSize: typography.bodyLarge, // body→bodyLarge (17px)
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

