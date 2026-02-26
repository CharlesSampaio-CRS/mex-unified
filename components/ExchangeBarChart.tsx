import { View, Text, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native'
import { memo, useMemo, useRef, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useBalance } from '../contexts/BalanceContext'
import { usePrivacy } from '../contexts/PrivacyContext'
import { AnimatedLogoIcon } from './AnimatedLogoIcon'

// Paleta de cores suaves e elegantes
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
  hasError?: boolean
  error?: string
}

// Componente Skeleton para loading
const SkeletonExchangeBarChart = memo(function SkeletonExchangeBarChart() {
  const { colors } = useTheme()
  const { t } = useLanguage()
  
  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('home.distribution') || 'Distribuição por Exchange'}
        </Text>
        <View style={styles.barsContainer}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <View style={[styles.skeletonIcon, { backgroundColor: colors.border }]} />
              <View style={[styles.skeletonName, { backgroundColor: colors.border }]} />
              <View style={[styles.skeletonBar, { backgroundColor: colors.surface }]}>
                <View style={[styles.skeletonBarFill, { backgroundColor: colors.border }]} />
              </View>
              <View style={[styles.skeletonPercent, { backgroundColor: colors.border }]} />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
})

// Componente de Barra Animada
const AnimatedBar = memo(function AnimatedBar({ 
  exchange, 
  colors, 
  hideValue 
}: { 
  exchange: ExchangeData
  colors: any
  hideValue: (value: string) => string
}) {
  const animatedWidth = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(animatedWidth, {
      toValue: exchange.percentage,
      useNativeDriver: false,
      tension: 40,
      friction: 8,
    }).start()
  }, [exchange.percentage])

  const widthInterpolated = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  })

  const icon = EXCHANGE_ICONS[exchange.name]

  return (
    <TouchableOpacity 
      style={styles.row}
      activeOpacity={0.7}
    >
      {/* Ícone da Exchange */}
      {icon && (
        <Image 
          source={icon} 
          style={styles.icon}
          resizeMode="contain"
        />
      )}
      
      {/* Nome da Exchange */}
      <Text 
        style={[styles.name, { color: colors.text }]}
        numberOfLines={1}
      >
        {exchange.name}
      </Text>
      
      {/* Barra de Progresso */}
      <View style={[styles.barTrack, { backgroundColor: colors.surface }]}>
        <Animated.View 
          style={[
            styles.barFill,
            { 
              width: widthInterpolated,
              backgroundColor: exchange.color,
            }
          ]}
        />
      </View>
      
      {/* Porcentagem */}
      <Text style={[styles.percentage, { color: colors.text }]}>
        {exchange.percentage.toFixed(1)}%
      </Text>
      
      {/* Valor em USD */}
      <Text style={[styles.value, { color: colors.text }]}>
        {hideValue(`$${exchange.value.toFixed(0)}`)}
      </Text>
    </TouchableOpacity>
  )
})

interface ExchangeBarChartProps {
  showTitle?: boolean
  embedded?: boolean
}

export const ExchangeBarChart = memo(function ExchangeBarChart({ 
  showTitle = true,
  embedded = false 
}: ExchangeBarChartProps) {
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const { data, loading, error } = useBalance()
  const { hideValue } = usePrivacy()

  const chartData = useMemo(() => {
    if (!data || !data.exchanges) return []
    
    const exchangesWithBalance = data.exchanges
    
    if (exchangesWithBalance.length === 0) return []

    // Calcular total
    const total = exchangesWithBalance.reduce(
      (sum: number, ex: any) => sum + parseFloat(ex.total_usd || 0), 
      0
    )

    // Criar dados com porcentagem
    const chartDataItems: ExchangeData[] = exchangesWithBalance.map((ex: any, index: number) => ({
      name: ex.name || ex.exchange,
      value: parseFloat(ex.total_usd || 0),
      percentage: total > 0 ? (parseFloat(ex.total_usd || 0) / total) * 100 : 0,
      color: EXCHANGE_COLORS[index % EXCHANGE_COLORS.length],
      hasError: ex.success === false,
      error: ex.error,
    }))

    // Ordenar por valor decrescente
    return chartDataItems.sort((a, b) => b.value - a.value)
  }, [data])

  // Loading state
  if (loading && !data) {
    return <SkeletonExchangeBarChart />
  }

  // Error state
  if (error && !data) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <View style={styles.content}>
          {showTitle && (
            <Text style={[styles.title, { color: colors.text }]}>
              {t('home.distribution') || 'Distribuição por Exchange'}
            </Text>
          )}
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {error}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  // Empty state
  if (!chartData || chartData.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <View style={styles.content}>
          {showTitle && (
            <Text style={[styles.title, { color: colors.text }]}>
              {t('home.distribution') || 'Distribuição por Exchange'}
            </Text>
          )}
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('home.noExchanges') || 'Nenhuma exchange conectada'}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  const containerStyle = embedded 
    ? [styles.embeddedContainer, { backgroundColor: 'transparent' }]
    : [styles.container, { 
        backgroundColor: colors.card,
        borderWidth: isDark ? 0 : 1,
        borderColor: colors.border,
      }]

  return (
    <View style={containerStyle}>
      <View style={styles.content}>
        {showTitle && (
          <Text style={[styles.title, { color: colors.text }]}>
            {t('home.distribution') || 'Distribuição por Exchange'}
          </Text>
        )}
        
        <View style={styles.barsContainer}>
          {chartData.map((exchange) => (
            <AnimatedBar
              key={exchange.name}
              exchange={exchange}
              colors={colors}
              hideValue={hideValue}
            />
          ))}
        </View>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  embeddedContainer: {
    padding: 12,
    marginBottom: 0,
  },
  content: {
    gap: 12,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  barsContainer: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  name: {
    fontSize: 11,
    fontWeight: '600',
    width: 70,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentage: {
    fontSize: 11,
    fontWeight: '700',
    width: 42,
    textAlign: 'right',
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
    width: 65,
    textAlign: 'right',
  },
  
  // Skeleton styles
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  skeletonIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    opacity: 0.3,
  },
  skeletonName: {
    width: 70,
    height: 11,
    borderRadius: 4,
    opacity: 0.3,
  },
  skeletonBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  skeletonBarFill: {
    width: '60%',
    height: '100%',
    opacity: 0.3,
  },
  skeletonPercent: {
    width: 42,
    height: 11,
    borderRadius: 4,
    opacity: 0.3,
  },
  
  // Empty/Error states
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
})
