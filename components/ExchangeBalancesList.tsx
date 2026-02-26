import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native'
import { memo, useMemo, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useBalance } from '@/contexts/BalanceContext'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { capitalizeExchangeName } from '@/lib/exchange-helpers'
import { getExchangeLogo } from '@/lib/exchange-logos'
import { apiService } from '@/services/api'
import { fontWeights } from '@/lib/typography'

/**
 * ExchangeBalancesList — Lista compacta dos totais por exchange
 * Exibida no PortfolioOverview entre o valor total e os PNL cards.
 * Mostra: ícone | nome | valor USD | % do total
 */
export const ExchangeBalancesList = memo(function ExchangeBalancesList() {
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const { data } = useBalance()
  const { hideValue, valuesHidden } = usePrivacy()
  const [expanded, setExpanded] = useState(false)

  // Calcula total geral e dados por exchange
  const { exchanges, totalUsd } = useMemo(() => {
    if (!data?.exchanges || data.exchanges.length === 0) {
      return { exchanges: [], totalUsd: 0 }
    }

    const total = data.exchanges.reduce((sum, ex) => {
      const val = typeof ex.total_usd === 'string' ? parseFloat(ex.total_usd) : (ex.total_usd || 0)
      return sum + val
    }, 0)

    const items = data.exchanges
      .map((ex) => {
        const name = capitalizeExchangeName(ex.name || ex.exchange || 'Unknown')
        const value = typeof ex.total_usd === 'string' ? parseFloat(ex.total_usd) : (ex.total_usd || 0)
        const percentage = total > 0 ? (value / total) * 100 : 0
        const logo = getExchangeLogo(name)
        const hasError = ex.success === false

        return { name, value, percentage, logo, hasError, error: ex.error }
      })
      .sort((a, b) => b.value - a.value) // Maior primeiro

    return { exchanges: items, totalUsd: total }
  }, [data])

  // Se não tem exchanges, não renderiza nada
  if (exchanges.length === 0) return null

  // Mostrar no máximo 3 exchanges colapsado, todas se expandido
  const MAX_COLLAPSED = 3
  const hasMore = exchanges.length > MAX_COLLAPSED
  const visibleExchanges = expanded ? exchanges : exchanges.slice(0, MAX_COLLAPSED)

  const formatValue = (value: number): string => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
    if (value >= 10_000) return `$${(value / 1_000).toFixed(1)}K`
    return `$${apiService.formatUSD(value)}`
  }

  const formatPercent = (pct: number): string => {
    if (pct >= 99.95) return '100%'
    if (pct < 0.1) return '<0.1%'
    return `${pct.toFixed(1)}%`
  }

  return (
    <View style={[styles.container, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
          {t('home.exchangeBalances') || 'Saldos por Exchange'}
        </Text>
        <Text style={[styles.headerCount, { color: colors.textTertiary }]}>
          {exchanges.length}
        </Text>
      </View>

      {/* Lista de exchanges */}
      <View style={styles.list}>
        {visibleExchanges.map((ex, index) => (
          <View
            key={ex.name}
            style={[
              styles.row,
              index < visibleExchanges.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              },
            ]}
          >
            {/* Ícone */}
            <View style={styles.iconContainer}>
              {ex.logo ? (
                <Image source={ex.logo} style={styles.icon} />
              ) : (
                <View style={[styles.iconFallback, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.iconFallbackText, { color: colors.textSecondary }]}>
                    {ex.name.charAt(0)}
                  </Text>
                </View>
              )}
            </View>

            {/* Nome */}
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {ex.name}
            </Text>

            {/* Erro badge */}
            {ex.hasError && (
              <Text style={styles.errorBadge}>⚠️</Text>
            )}

            {/* Percentual */}
            <Text style={[styles.percent, { color: colors.textTertiary }]}>
              {hideValue(formatPercent(ex.percentage))}
            </Text>

            {/* Valor */}
            <Text style={[styles.value, { color: colors.text }]}>
              {hideValue(formatValue(ex.value))}
            </Text>
          </View>
        ))}
      </View>

      {/* Botão "ver mais / menos" */}
      {hasMore && (
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.6}
        >
          <Text style={[styles.toggleText, { color: colors.primary }]}>
            {expanded
              ? (t('common.showLess') || 'Ver menos')
              : (t('common.showMore') || `+${exchanges.length - MAX_COLLAPSED} mais`)}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.5,
  },
  headerCount: {
    fontSize: 11,
    fontWeight: fontWeights.medium,
    opacity: 0.4,
  },
  list: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 8,
  },
  iconContainer: {
    width: 22,
    height: 22,
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  iconFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallbackText: {
    fontSize: 10,
    fontWeight: fontWeights.semibold,
  },
  name: {
    flex: 1,
    fontSize: 13,
    fontWeight: fontWeights.medium,
  },
  errorBadge: {
    fontSize: 10,
    marginRight: -4,
  },
  percent: {
    fontSize: 11,
    fontWeight: fontWeights.regular,
    minWidth: 38,
    textAlign: 'right',
    opacity: 0.6,
  },
  value: {
    fontSize: 13,
    fontWeight: fontWeights.semibold,
    minWidth: 70,
    textAlign: 'right',
  },
  toggleButton: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 2,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: fontWeights.medium,
  },
})
