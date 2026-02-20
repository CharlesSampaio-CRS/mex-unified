import { View, Text, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native'
import { memo, useMemo, useState, useEffect, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useBalance } from '../contexts/BalanceContext'
import { usePrivacy } from '../contexts/PrivacyContext'
import { typography, fontWeights } from '../lib/typography'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

// 🎨 Cores personalizadas por exchange (gradiente claro → escuro)
const EXCHANGE_BRAND_COLORS: Record<string, { light: string; dark: string; name: string }> = {
  'MEXC': { 
    light: '#4A90E2',  // Azul marinho claro
    dark: '#1A3A5C',   // Azul marinho escuro
    name: 'MEXC'
  },
  'OKX': { 
    light: '#666666',  // Cinza claro
    dark: '#000000',   // Preto
    name: 'OKX'
  },
  'Bybit': { 
    light: '#F7B500',  // Amarelo vibrante
    dark: '#1A1A1A',   // Preto
    name: 'Bybit'
  },
  'Kraken': { 
    light: '#9B6FFF',  // Roxo claro
    dark: '#5D3FD3',   // Roxo escuro
    name: 'Kraken'
  },
  'Binance': { 
    light: '#F3BA2F',  // Amarelo Binance
    dark: '#FAFAFA',   // Branco levemente cinza
    name: 'Binance'
  },
  'Coinbase': { 
    light: '#0052FF',  // Azul Coinbase
    dark: '#FFFFFF',   // Branco
    name: 'Coinbase'
  },
  'KuCoin': { 
    light: '#24AE8F',  // Verde claro
    dark: '#FFFFFF',   // Branco
    name: 'KuCoin'
  },
  'NovaDAX': { 
    light: '#00D4AA',  // Verde água claro
    dark: '#1A1A1A',   // Preto
    name: 'NovaDAX'
  },
  'Gate.io': { 
    light: '#2354E6',  // Azul Gate.io
    dark: '#17D7A0',   // Verde Gate.io
    name: 'Gate.io'
  },
  'Bitget': { 
    light: '#00F0FF',  // Azul ciano claro
    dark: '#0099CC',   // Azul ciano escuro
    name: 'Bitget'
  },
  'Coinex': { 
    light: '#3DD08A',  // Verde claro
    dark: '#FFFFFF',   // Branco
    name: 'Coinex'
  },
}

// Cores padrão (fallback) caso exchange não esteja no mapeamento
const DEFAULT_GRADIENT = {
  light: '#6366F1',  // Índigo claro
  dark: '#4F46E5',   // Índigo escuro
}

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
  'Bitget': require('../assets/bitget.png'),
  'Coinex': require('../assets/coinex.png'),
}

interface ExchangeData {
  name: string
  originalName: string // Nome original para buscar ícone
  value: number
  percentage: number
  color: string
  gradientColors: [string, string] // [claro, escuro]
  hasError?: boolean
  error?: string
}

// Componente de barra individual com animação
const ExchangeBar = memo(({ 
  exchange, 
  isSelected, 
  onPress,
  valuesHidden 
}: { 
  exchange: ExchangeData
  isSelected: boolean
  onPress: () => void
  valuesHidden: boolean
}) => {
  const { colors } = useTheme()
  const widthAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: exchange.percentage,
      duration: 800,
      useNativeDriver: false,
    }).start()
  }, [exchange.percentage])

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isSelected ? 1.02 : 1,
      useNativeDriver: true,
    }).start()
  }, [isSelected])

  const formatValue = (value: number) => {
    if (valuesHidden) return '••••••'
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
    return `$${value.toFixed(2)}`
  }

  const formatPercent = (value: number) => {
    const fixed = value.toFixed(1)
    return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed
  }

  const icon = EXCHANGE_ICONS[exchange.originalName]

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.barContainer,
          { 
            backgroundColor: colors.surface,
            borderColor: isSelected ? exchange.color : colors.border,
            borderWidth: isSelected ? 2 : 1,
          }
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Header: Ícone + Nome + Valor */}
        <View style={styles.barHeader}>
          <View style={styles.barHeaderLeft}>
            {icon ? (
              <Image source={icon} style={styles.exchangeIcon} />
            ) : (
              <View style={[styles.iconPlaceholder, { backgroundColor: exchange.color + '20' }]}>
                <Text style={[styles.iconPlaceholderText, { color: exchange.color }]}>
                  {exchange.name.charAt(0)}
                </Text>
              </View>
            )}
            <Text style={[styles.exchangeName, { color: colors.text }]}>
              {exchange.name}
            </Text>
          </View>
          <View style={styles.barHeaderRight}>
            <Text style={[styles.exchangeValue, { color: colors.text }]}>
              {formatValue(exchange.value)}
            </Text>
            <Text style={[styles.exchangePercent, { 
              color: colors.text,
              opacity: 0.8 
            }]}>
              {formatPercent(exchange.percentage)}%
            </Text>
          </View>
        </View>

        {/* Barra de Progresso com Gradiente */}
        <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
          <Animated.View
            style={{
              width: widthAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              height: '100%',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <LinearGradient
              colors={exchange.gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.progressBarFill}
            />
          </Animated.View>
        </View>

        {/* Erro (se houver) */}
        {exchange.hasError && (
          <View style={styles.errorBadge}>
            <Ionicons name="alert-circle" size={12} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]} numberOfLines={1}>
              {exchange.error || 'Error loading data'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  )
})

// Componente Skeleton
const SkeletonExchangesChart = memo(function SkeletonExchangesChart() {
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
            <View key={i} style={[styles.skeletonBar, { backgroundColor: colors.border }]} />
          ))}
        </View>
      </View>
    </View>
  )
})

export const ExchangesHorizontalChart = memo(function ExchangesHorizontalChart() {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { data, loading, error } = useBalance()
  const { valuesHidden } = usePrivacy()
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null)

  const chartData = useMemo(() => {
    if (!data || !data.exchanges) return []
    
    const exchangesWithValues = data.exchanges.map((exchange: any, index: number) => {
      // Usar total_usd diretamente (como no PieChart)
      const totalUSD = parseFloat(exchange.total_usd || 0)
      
      // Verificar erros
      const hasError = exchange.success === false
      const errorMsg = exchange.error || 'Failed to load'

      // Pegar nome da exchange (igual ao PieChart)
      const exchangeName = exchange.name || exchange.exchange || `Exchange ${index + 1}`
      // Capitalizar apenas a primeira letra
      const formattedName = exchangeName.charAt(0).toUpperCase() + exchangeName.slice(1).toLowerCase()

      // 🎨 Buscar cores personalizadas da exchange
      const brandColors = EXCHANGE_BRAND_COLORS[exchangeName] || DEFAULT_GRADIENT
      const gradientColors: [string, string] = [brandColors.light, brandColors.dark]

      return {
        name: formattedName,
        originalName: exchangeName, // Manter nome original para buscar ícone
        value: totalUSD,
        percentage: 0,
        color: brandColors.dark, // Cor escura como primária (para texto/borda)
        gradientColors, // Gradiente [claro, escuro]
        hasError,
        error: errorMsg,
      }
    })

    // Calcular total e porcentagens
    const total = exchangesWithValues.reduce((sum, ex) => sum + ex.value, 0)
    
    const withPercentages = exchangesWithValues.map(ex => ({
      ...ex,
      percentage: total > 0 ? (ex.value / total) * 100 : 0,
    }))

    // Ordenar por valor (maior primeiro)
    return withPercentages.sort((a, b) => b.value - a.value)
  }, [data])

  if (loading) {
    return <SkeletonExchangesChart />
  }

  if (error || !chartData.length) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('home.distribution') || 'Distribuição por Exchange'}
          </Text>
          <View style={styles.emptyContainer}>
            <Ionicons name="bar-chart-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {error || t('home.noExchanges') || 'No exchanges connected'}
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
        <View style={styles.barsContainer}>
          {chartData.map((exchange) => (
            <ExchangeBar
              key={exchange.name}
              exchange={exchange}
              isSelected={selectedExchange === exchange.name}
              onPress={() => setSelectedExchange(
                selectedExchange === exchange.name ? null : exchange.name
              )}
              valuesHidden={valuesHidden}
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
  content: {
    gap: 16,
  },
  title: {
    fontSize: 14,  // Título chart (reduzido de 16px)
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  barsContainer: {
    gap: 10,
  },
  barContainer: {
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  barHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exchangeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  iconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholderText: {
    fontSize: 11,  // Placeholder icon (reduzido de 12px)
    fontWeight: '600',
  },
  exchangeName: {
    fontSize: 13,  // Nome exchange (reduzido de 14px - padrão compacto)
    fontWeight: '600',
  },
  exchangeValue: {
    fontSize: 13,  // Valor já está no padrão ✓
    fontWeight: '600',
  },
  exchangePercent: {
    fontSize: 11,  // Percentual (reduzido de 12px)
    fontWeight: '700',
  },
  progressBarBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  errorText: {
    fontSize: 10,
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 13,  // Texto vazio (reduzido de 14px)
    textAlign: 'center',
  },
  skeletonBar: {
    height: 60,
    borderRadius: 10,
    opacity: 0.3,
  },
})
