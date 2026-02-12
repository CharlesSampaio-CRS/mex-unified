import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native'
import { memo, useMemo, useState } from 'react'
import Svg, { G, Circle, Path } from 'react-native-svg'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useBalance } from '../contexts/BalanceContext'
import { usePrivacy } from '../contexts/PrivacyContext'
import { typography, fontWeights } from '../lib/typography'

const CHART_SIZE = 180 // Tamanho fixo para não ajustar ao redimensionar
const RADIUS = CHART_SIZE / 2
const STROKE_WIDTH = 16 // Reduzido de 20 para 16 (mais fino e suave)

// Paleta de cores suaves e elegantes (tons pastéis e menos saturados)
const EXCHANGE_COLORS = [
  '#60A5FA', // Azul suave
  '#93C5FD', // Azul claro
  '#7DD3FC', // Azul ciano suave
  '#A5B4FC', // Azul lavanda
  '#94A3B8', // Cinza azulado suave
  '#BAE6FD', // Azul muito claro
  '#6B7280', // Cinza médio neutro
  '#9CA3AF', // Cinza claro
  '#64748B', // Cinza slate suave
  '#84CC16', // Verde lima suave
  '#A78BFA', // Roxo suave
  '#5EEAD4', // Turquesa suave
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
const SkeletonExchangesPieChart = memo(function SkeletonExchangesPieChart() {
  const { colors } = useTheme()
  const { t } = useLanguage()
  
  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('home.distribution') || 'Distribuição por Exchange'}
        </Text>
        <View style={styles.chartContainer}>
          {/* Círculo skeleton sem loading indicator */}
          <View style={[styles.skeletonCircle, { backgroundColor: colors.surfaceSecondary }]} />
        </View>
        <View style={styles.legendContainer}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonLegendItem}>
              <View style={[styles.skeletonColor, { backgroundColor: colors.border }]} />
              <View style={[styles.skeletonText, { backgroundColor: colors.border }]} />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
})

export const ExchangesPieChart = memo(function ExchangesPieChart() {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { data, loading, error } = useBalance()
  const { valuesHidden } = usePrivacy()
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null)

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
      name: ex.name || ex.exchange,
      value: parseFloat(ex.total_usd || 0),
      percentage: total > 0 ? (parseFloat(ex.total_usd || 0) / total) * 100 : 0,
      color: EXCHANGE_COLORS[index % EXCHANGE_COLORS.length],
      hasError: ex.success === false, // 🆕 Marca exchanges com erro
      error: ex.error, // 🆕 Mensagem de erro
    }))

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
    return <SkeletonExchangesPieChart />
  }

  if (chartData.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('home.distribution') || 'Por Exchange'}
          </Text>
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('home.noExchangesConnected') || 'Nenhuma exchange conectada'}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('home.distribution') || 'Distribuição por Exchange'}
        </Text>

        <View style={styles.chartContainer}>
          {/* Gráfico de Pizza */}
          <Svg width={CHART_SIZE} height={CHART_SIZE} viewBox={`${-RADIUS} ${-RADIUS} ${CHART_SIZE} ${CHART_SIZE}`}>
            <G>
              {pieSegments.map((segment, index) => {
                const isSelected = selectedExchange === segment.name
                const strokeWidth = isSelected ? STROKE_WIDTH + 2 : STROKE_WIDTH // Reduzido de +4 para +2
                const opacity = selectedExchange && !isSelected ? 0.5 : 1 // Aumentado de 0.3 para 0.5 (menos contraste)
                
                return (
                  <Path
                    key={index}
                    d={createArc(segment.startAngle, segment.endAngle, RADIUS - strokeWidth / 2)}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    opacity={opacity}
                    onPress={() => toggleExchange(segment.name)}
                  />
                )
              })}
              {/* Círculo interno para criar efeito de donut */}
              <Circle
                r={RADIUS - STROKE_WIDTH - 4}
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
                      ⚠️ Erro
                    </Text>
                    <Text style={[styles.centerPercentage, { color: colors.textSecondary, fontSize: 10, textAlign: 'center' }]} numberOfLines={2}>
                      Falha ao buscar saldo
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.centerValue, { color: colors.primary }]}>
                      {formatValue(selectedData.value)}
                    </Text>
                    <Text style={[styles.centerPercentage, { color: colors.textSecondary }]}>
                      {selectedData.percentage.toFixed(1)}%
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
                {EXCHANGE_ICONS[item.name] ? (
                  <View style={[styles.exchangeIconContainer, { opacity }]}>
                    <Image 
                      source={EXCHANGE_ICONS[item.name]} 
                      style={styles.exchangeIcon}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View style={[styles.legendColor, { backgroundColor: item.color, opacity }]} />
                )}
                <View style={styles.legendTextContainer}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.legendName, { color: colors.text, opacity }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {/* ⚠️ Indicador de erro */}
                    {item.hasError && (
                      <Text style={{ fontSize: 12, opacity: opacity * 0.8 }}>⚠️</Text>
                    )}
                  </View>
                  <Text style={[styles.legendPercentage, { color: colors.textSecondary, opacity }]}>
                    {item.percentage.toFixed(1)}%
                  </Text>
                </View>
                {isSelected && (
                  <View style={[styles.selectedIndicator, { backgroundColor: item.color }]} />
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    padding: 20,                // Reduzido de 28 para 20 (mais compacto)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    gap: 16,                    // Reduzido de 20 para 16 (mais compacto)
  },
  title: {
    fontSize: typography.caption, // h3→caption (12-13px, igual PortfolioOverview)
    fontWeight: fontWeights.regular, // medium→regular (igual PortfolioOverview)
    letterSpacing: 0.5, // 0.3→0.5 (igual PortfolioOverview)
    opacity: 0.5, // Adiciona opacidade (igual PortfolioOverview)
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    alignSelf: 'center',
    paddingVertical: 6,         // Reduzido de 10 para 6 (mais compacto)
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontSize: typography.display, // Mantém 32px
    fontWeight: fontWeights.regular, // light→regular
    letterSpacing: -1,
  },
  centerValue: {
    fontSize: typography.body, // caption→body (16px)
    fontWeight: fontWeights.medium, // regular→medium
    marginTop: 6, // 4→6
  },
  centerPercentage: {
    fontSize: typography.caption, // micro→caption (14px)
    fontWeight: fontWeights.medium, // regular→medium
    marginTop: 4, // 2→4
  },
  legend: {
    gap: 6,                     // Reduzido de 8 para 6 (mais compacto)
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,                    // Reduzido de 12 para 10 (mais compacto)
    minHeight: 40,              // Reduzido de 44 para 40 (mais compacto)
    paddingVertical: 4,
  },
  exchangeIconContainer: {
    width: 32, // 22→32
    height: 32, // 22→32
    borderRadius: 16, // 11→16
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  exchangeIcon: {
    width: 28, // 20→28
    height: 28, // 20→28
  },
  legendColor: {
    width: 16, // 12→16
    height: 16, // 12→16
    borderRadius: 8, // 6→8
  },
  legendTextContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  legendName: {
    fontSize: typography.caption, // Reduzido de body (16px) para caption (14px)
    fontWeight: fontWeights.medium,
    flex: 1,
  },
  legendPercentage: {
    fontSize: typography.caption, // Reduzido de body (16px) para caption (14px)
    fontWeight: fontWeights.medium,
    minWidth: 60,
    textAlign: 'right',
  },
  selectedIndicator: {
    width: 10, // 8→10
    height: 10, // 8→10
    borderRadius: 5, // 4→5
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
    width: CHART_SIZE,
    height: CHART_SIZE,
    borderRadius: CHART_SIZE / 2,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendContainer: {
    gap: 6,                     // Igual ao legend (6px)
  },
  skeletonLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
  },
  skeletonColor: {
    width: 32,
    height: 32,
    borderRadius: 16,
    opacity: 0.3,
  },
  skeletonText: {
    flex: 1,
    height: 16,
    borderRadius: 4,
    opacity: 0.3,
  },
})

