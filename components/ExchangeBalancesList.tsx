import { View, Text, StyleSheet, Image } from 'react-native'
import { memo, useMemo } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useBalance } from '@/contexts/BalanceContext'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { capitalizeExchangeName } from '@/lib/exchange-helpers'
import { getExchangeLogo } from '@/lib/exchange-logos'
import { apiService } from '@/services/api'
import { fontWeights } from '@/lib/typography'

/**
 * ExchangeBalancesList — Linhas ultra-clean dos saldos por exchange.
 * Sem header, sem bordas, sem botões. Apenas ícone · nome · valor.
 */
export const ExchangeBalancesList = memo(function ExchangeBalancesList() {
  const { colors } = useTheme()
  const { data } = useBalance()
  const { hideValue } = usePrivacy()

  const exchanges = useMemo(() => {
    if (!data?.exchanges || data.exchanges.length === 0) return []

    return data.exchanges
      .map((ex) => {
        const name = capitalizeExchangeName(ex.name || ex.exchange || 'Unknown')
        const value = typeof ex.total_usd === 'string' ? parseFloat(ex.total_usd) : (ex.total_usd || 0)
        const logo = getExchangeLogo(name)
        return { name, value, logo }
      })
      .sort((a, b) => b.value - a.value)
  }, [data])

  if (exchanges.length === 0) return null

  const fmt = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
    if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`
    return apiService.formatUSD(v)
  }

  return (
    <View style={styles.container}>
      {exchanges.map((ex) => (
        <View key={ex.name} style={styles.row}>
          {ex.logo ? (
            <Image source={ex.logo} style={styles.icon} />
          ) : (
            <View style={[styles.iconFallback, { backgroundColor: colors.border }]}>
              <Text style={[styles.iconLetter, { color: colors.textSecondary }]}>
                {ex.name.charAt(0)}
              </Text>
            </View>
          )}
          <Text style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>
            {ex.name}
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {hideValue(`$${fmt(ex.value)}`)}
          </Text>
        </View>
      ))}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  icon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    opacity: 0.8,
  },
  iconFallback: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLetter: {
    fontSize: 8,
    fontWeight: fontWeights.semibold,
  },
  name: {
    flex: 1,
    fontSize: 11,
    fontWeight: fontWeights.regular,
    opacity: 0.5,
  },
  value: {
    fontSize: 11,
    fontWeight: fontWeights.light,
    opacity: 0.7,
  },
})
