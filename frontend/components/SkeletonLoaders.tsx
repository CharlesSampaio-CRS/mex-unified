import { View, StyleSheet, Animated, Easing } from 'react-native'
import { useEffect, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  borderRadius?: number
  style?: any
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const { colors, isDark } = useTheme()
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    // Animação de pulso
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          opacity,
        },
        style,
      ]}
    />
  )
}

// Skeleton para Card
export function SkeletonCard() {
  const { colors } = useTheme()
  
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.cardHeader}>
        <Skeleton width={40} height={40} borderRadius={8} />
        <View style={styles.cardHeaderText}>
          <Skeleton width={120} height={16} />
          <Skeleton width={80} height={12} style={{ marginTop: 8 }} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Skeleton width="100%" height={60} borderRadius={8} />
      </View>
    </View>
  )
}

// Skeleton para lista de exchanges
export function SkeletonExchangeItem() {
  const { colors } = useTheme()
  
  return (
    <View style={[styles.exchangeItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.exchangeHeader}>
        <Skeleton width={32} height={32} borderRadius={16} />
        <View style={styles.exchangeInfo}>
          <Skeleton width={100} height={14} />
          <Skeleton width={60} height={12} style={{ marginTop: 4 }} />
        </View>
        <Skeleton width={80} height={20} borderRadius={4} />
      </View>
    </View>
  )
}

// Skeleton para gráfico
export function SkeletonChart() {
  const { colors } = useTheme()
  
  return (
    <View style={[styles.chartContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.chartHeader}>
        <Skeleton width={140} height={16} />
        <View style={styles.chartTabs}>
          <Skeleton width={32} height={24} borderRadius={12} style={{ marginRight: 8 }} />
          <Skeleton width={32} height={24} borderRadius={12} style={{ marginRight: 8 }} />
          <Skeleton width={32} height={24} borderRadius={12} style={{ marginRight: 8 }} />
          <Skeleton width={32} height={24} borderRadius={12} />
        </View>
      </View>
      <Skeleton width="100%" height={180} borderRadius={8} style={{ marginTop: 16 }} />
    </View>
  )
}

// Skeleton para overview de portfolio
export function SkeletonPortfolioOverview() {
  const { colors } = useTheme()
  
  return (
    <View style={[styles.overviewContainer, { borderColor: colors.cardBorder }]}>
      <Skeleton width={120} height={14} />
      <Skeleton width={200} height={32} style={{ marginTop: 12 }} />
      <View style={styles.overviewStats}>
        <Skeleton width={100} height={16} />
        <Skeleton width={60} height={16} style={{ marginLeft: 12 }} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  cardBody: {
    marginTop: 8,
  },
  exchangeItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  exchangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exchangeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chartContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartTabs: {
    flexDirection: 'row',
  },
  overviewContainer: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  overviewStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
})
