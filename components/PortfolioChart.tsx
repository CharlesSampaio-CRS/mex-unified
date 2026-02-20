import { View, Text, StyleSheet, TouchableOpacity, PanResponder } from 'react-native'
import { memo, useMemo, useState, useRef } from 'react'
import Svg, { Line, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Path } from 'react-native-svg'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { apiService } from '@/services/api'
import { typography, fontWeights } from '@/lib/typography'

const CHART_WIDTH = 320 // Largura fixa para não ajustar ao redimensionar
const CHART_HEIGHT = 140  // Reduzido de 160 para 140 (mais compacto)
const PADDING = 20 // Aumentado para 20 para garantir que a linha fique dentro dos limites

interface ChartPoint {
  x: number
  y: number
  value: number
  timestamp: string
}

interface PortfolioChartProps {
  localEvolutionData?: { values_usd: number[], timestamps: string[] } | null
  onPeriodChange?: (days: number) => void
  currentPeriod?: number
}

export const PortfolioChart = memo(function PortfolioChart({
  localEvolutionData,
  onPeriodChange,
  currentPeriod = 7
}: PortfolioChartProps) {
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const { hideValue } = usePrivacy()
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const chartRef = useRef<View>(null)

  // Períodos disponíveis
  const periods = [7, 15, 30]

  // Handler para mudar período
  const handlePeriodChange = (days: number) => {
    console.log(`🔘 [PortfolioChart] handlePeriodChange chamado com ${days} dias`)
    console.log(`🔘 [PortfolioChart] currentPeriod atual: ${currentPeriod}`)
    console.log(`🔘 [PortfolioChart] onPeriodChange existe?`, !!onPeriodChange)
    
    if (onPeriodChange) {
      console.log(`✅ [PortfolioChart] Chamando onPeriodChange(${days})`)
      onPeriodChange(days)
    } else {
      console.warn('⚠️ [PortfolioChart] onPeriodChange não está definido!')
    }
  }

  // Processa os dados do gráfico diretamente (sem memo - dados vêm do MongoDB)
  const getChartData = (): ChartPoint[] => {
    console.log('🔄 [PortfolioChart] getChartData chamado', {
      hasData: !!localEvolutionData,
      valuesLength: localEvolutionData?.values_usd?.length || 0,
      currentPeriod,
      firstValue: localEvolutionData?.values_usd?.[0],
      lastValue: localEvolutionData?.values_usd?.[localEvolutionData.values_usd.length - 1],
      timestamps: localEvolutionData?.timestamps?.slice(0, 3) // Mostra primeiros 3 timestamps
    })
    
    if (!localEvolutionData?.values_usd || localEvolutionData.values_usd.length === 0) {
      console.warn('⚠️ [PortfolioChart] Sem dados para renderizar')
      return []
    }

    const values = localEvolutionData.values_usd
    const timestamps = localEvolutionData.timestamps

    // Filtra valores inválidos (NaN, null, undefined)
    const validValues = values.filter((v: number) => v != null && !isNaN(v) && isFinite(v))
    
    if (validValues.length === 0) {
      // Se não há valores válidos, retorna um ponto único em 0
      return [{
        x: CHART_WIDTH / 2,
        y: CHART_HEIGHT / 2,
        value: 0,
        timestamp: timestamps[0] || new Date().toISOString()
      }]
    }

    // Encontra valores min/max para normalização
    const minValue = Math.min(...validValues)
    const maxValue = Math.max(...validValues)
    const range = maxValue - minValue || 1 // evita divisão por zero

    // Margem extra para a strokeWidth da linha (2px)
    const safetyMargin = 2

    // Mapeia para coordenadas do gráfico
    return values.map((value: number, index: number) => {
      // Se o valor for inválido, usa o valor anterior válido ou 0
      const safeValue = (value != null && !isNaN(value) && isFinite(value)) ? value : (validValues[0] || 0)
      
      const x = PADDING + (index / (values.length - 1)) * (CHART_WIDTH - 2 * PADDING)
      // Inverte Y porque SVG tem origem no topo
      // Usa PADDING + safetyMargin para garantir que a linha não saia dos limites
      const y = (PADDING + safetyMargin) + ((maxValue - safeValue) / range) * (CHART_HEIGHT - 2 * (PADDING + safetyMargin))
      
      // Garante que x e y são números válidos
      const safeX = isFinite(x) ? x : CHART_WIDTH / 2
      const safeY = isFinite(y) ? y : CHART_HEIGHT / 2
      
      return {
        x: safeX,
        y: safeY,
        value: safeValue,
        timestamp: timestamps[index] || new Date().toISOString()
      }
    })
  }

  const chartData = getChartData()

  // Gera o path SVG para a linha (direto, sem memo)
  const getLinePath = () => {
    if (chartData.length === 0) return ''
    
    let path = `M ${chartData[0].x} ${chartData[0].y}`
    
    // Usa curvas suaves (cubic bezier) para conectar os pontos
    for (let i = 1; i < chartData.length; i++) {
      const prev = chartData[i - 1]
      const curr = chartData[i]
      
      const cpx1 = prev.x + (curr.x - prev.x) / 3
      const cpy1 = prev.y
      const cpx2 = prev.x + 2 * (curr.x - prev.x) / 3
      const cpy2 = curr.y
      
      path += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${curr.x} ${curr.y}`
    }
    
    return path
  }

  const linePath = getLinePath()

  // Gera o path para o gradiente de preenchimento (direto, sem memo)
  const getAreaPath = () => {
    if (chartData.length === 0) return ''
    
    let path = linePath
    
    // Completa o path descendo até a base e voltando
    const lastPoint = chartData[chartData.length - 1]
    const firstPoint = chartData[0]
    
    path += ` L ${lastPoint.x} ${CHART_HEIGHT}`
    path += ` L ${firstPoint.x} ${CHART_HEIGHT}`
    path += ' Z'
    
    return path
  }

  const areaPath = getAreaPath()

  // Determina se o gráfico está positivo ou negativo
  const isPositive = chartData.length < 2 ? true : chartData[chartData.length - 1].value >= chartData[0].value

  // Cor do gráfico baseada na tendência
  const lineColor = isPositive ? colors.success : colors.danger

  // PanResponder para detectar toques no gráfico
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => true, // Permite que outros gestos (scroll) tenham prioridade
        onShouldBlockNativeResponder: () => false, // Não bloqueia eventos nativos (scroll)
        onPanResponderGrant: (evt) => {
          const locationX = evt.nativeEvent.locationX
          findNearestPoint(locationX)
        },
        onPanResponderMove: (evt) => {
          const locationX = evt.nativeEvent.locationX
          findNearestPoint(locationX)
        },
        onPanResponderRelease: () => {
          setSelectedPoint(null) // Limpa ao soltar
        },
      }),
    [chartData]
  )

  // Encontra o ponto mais próximo do toque
  const findNearestPoint = (touchX: number) => {
    if (chartData.length === 0) return

    let nearestIndex = 0
    let minDistance = Math.abs(chartData[0].x - touchX)

    chartData.forEach((point, index) => {
      const distance = Math.abs(point.x - touchX)
      if (distance < minDistance) {
        minDistance = distance
        nearestIndex = index
      }
    })

    setSelectedPoint(nearestIndex)
  }

  // Formata a data do timestamp
  const formatDate = (timestamp: string) => {
    console.log('📅 [PortfolioChart] formatDate:', {
      timestamp,
      timestampType: typeof timestamp,
      isValidDate: !isNaN(new Date(timestamp).getTime())
    })
    
    const date = new Date(timestamp)
    
    // Verifica se a data é válida
    if (isNaN(date.getTime())) {
      console.error('❌ [PortfolioChart] Data inválida:', timestamp)
      return 'Data inválida'
    }
    
    const formatted = date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      timeZone: 'America/Sao_Paulo' // Força timezone do Brasil
    })
    
    console.log('✅ [PortfolioChart] Data formatada:', {
      original: timestamp,
      dateObject: date.toISOString(),
      formatted
    })
    
    return formatted
  }

  // Dados do ponto selecionado
  const selectedData = selectedPoint !== null ? chartData[selectedPoint] : null

  if (chartData.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? 'rgba(39, 39, 42, 0.4)' : 'rgba(249, 250, 251, 1)' }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('portfolio.noEvolutionData')}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? 'rgba(39, 39, 42, 0.4)' : 'rgba(249, 250, 251, 1)' }]}>
      {/* Header com label e botões de período */}
      <View style={styles.header}>
        <Text style={[styles.chartLabel, { color: colors.textTertiary }]}>
          {t('portfolio.evolution').replace('{days}', String(currentPeriod))}
        </Text>
        
        {/* Botões discretos de período */}
        <View style={styles.periodButtons}>
          {periods.map((days) => (
            <TouchableOpacity
              key={days}
              onPress={() => handlePeriodChange(days)}
              style={[
                styles.periodButton,
                currentPeriod === days && styles.periodButtonActive,
                { 
                  backgroundColor: currentPeriod === days 
                    ? colors.primary + '20' 
                    : 'transparent',
                  borderColor: currentPeriod === days 
                    ? colors.primary 
                    : colors.border
                }
              ]}
              activeOpacity={0.7}
            >
              <Text 
                style={[
                  styles.periodButtonText,
                  { color: currentPeriod === days ? colors.primary : colors.textSecondary }
                ]}
              >
                {days}d
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View {...panResponder.panHandlers} ref={chartRef} style={styles.chartWrapper}>
        {/* Tooltip com valor - aparece só ao tocar */}
        {selectedData && (
          <View style={[styles.tooltip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.tooltipValue, { color: colors.text }]}>
              {hideValue(`$${apiService.formatUSD(selectedData.value)}`)}
            </Text>
            <Text style={[styles.tooltipDate, { color: colors.textSecondary }]}>
              {formatDate(selectedData.timestamp)}
            </Text>
          </View>
        )}

        <Svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
          <Defs>
            <SvgLinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
            </SvgLinearGradient>
          </Defs>
          
          {/* Área preenchida com gradiente */}
          <Path
            d={areaPath}
            fill="url(#areaGradient)"
          />
          
          {/* Linha do gráfico */}
          <Path
            d={linePath}
            stroke={lineColor}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Pontos em todos os valores do gráfico */}
          {chartData.map((point, index) => {
            const isFirst = index === 0
            const isLast = index === chartData.length - 1
            const isSelected = selectedPoint === index
            
            // Define o tamanho baseado na posição
            const radius = isSelected ? 5 : (isFirst || isLast) ? 3.5 : 2.5
            const opacity = isSelected ? 1 : (isFirst || isLast) ? 0.9 : 0.7
            
            return (
              <Circle
                key={`point-${index}`}
                cx={point.x}
                cy={point.y}
                r={radius}
                fill={lineColor}
                opacity={opacity}
              />
            )
          })}

          {/* Ponto selecionado (se houver) - Destacado com anel */}
          {selectedData && (
            <>
              {/* Linha vertical de referência */}
              <Line
                x1={selectedData.x}
                y1={PADDING}
                x2={selectedData.x}
                y2={CHART_HEIGHT - PADDING}
                stroke={lineColor}
                strokeWidth={1}
                strokeDasharray="3,3"
                opacity={0.4}
              />
              {/* Anel externo do ponto selecionado */}
              <Circle
                cx={selectedData.x}
                cy={selectedData.y}
                r={6}
                fill={lineColor}
                opacity={0.3}
              />
              {/* Centro branco do ponto selecionado */}
              <Circle
                cx={selectedData.x}
                cy={selectedData.y}
                r={2.5}
                fill={colors.background}
              />
            </>
          )}
        </Svg>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 6,
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  periodButton: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  periodButtonActive: {
    // Estilo aplicado dinamicamente
  },
  periodButtonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  chartWrapper: {
    overflow: 'hidden',         // Garante que a linha não saia do wrapper
    borderRadius: 8,
  },
  emptyText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    opacity: 0.7,
  },
  chartLabel: {
    fontSize: 10,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    opacity: 0.5,
  },
  tooltip: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    backgroundColor: 'white',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 10,
  },
  tooltipValue: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  tooltipDate: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
    opacity: 0.7,
  },
})
