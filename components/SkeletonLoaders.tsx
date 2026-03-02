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
      {/* Header row */}
      <View style={[styles.exchangeHeader, { borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Skeleton width={20} height={20} borderRadius={10} />
          <Skeleton width={70} height={12} />
        </View>
        <Skeleton width={64} height={12} />
      </View>
      {/* Asset rows */}
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.exchangeAssetRow, { borderBottomColor: i < 3 ? colors.border : 'transparent' }]}>
          <Skeleton width={42} height={10} />
          <Skeleton width={36} height={14} borderRadius={4} />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Skeleton width={50} height={10} />
            <Skeleton width={50} height={10} />
          </View>
        </View>
      ))}
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
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 10,
  },
  cardBody: {
    marginTop: 6,
  },
  exchangeItem: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  exchangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
  },
  exchangeAssetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  chartContainer: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
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
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  overviewStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
})
