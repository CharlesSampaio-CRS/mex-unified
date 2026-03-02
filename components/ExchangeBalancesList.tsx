import { View, Text, StyleSheet, Image, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native'
import { memo, useMemo, useState, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useBalance } from '@/contexts/BalanceContext'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { capitalizeExchangeName } from '@/lib/exchange-helpers'
import { getExchangeLogo } from '@/lib/exchange-logos'
import { fontWeights } from '@/lib/typography'

// Habilita LayoutAnimation no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface ExchangeBalancesListProps {
  usdToBrlRate?: number | null
}

/**
 * ExchangeBalancesList — Inicia comprimido, expande ao tocar.
 * Header discreto com ícones empilhados + chevron.
 * Expandido: ícone · nome · USD · BRL por exchange.
 */
export const ExchangeBalancesList = memo(function ExchangeBalancesList({ usdToBrlRate }: ExchangeBalancesListProps) {
  const { colors } = useTheme()
  const { data } = useBalance()
  const { hideValue } = usePrivacy()
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(false)

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

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded(prev => !prev)
  }, [])

  if (exchanges.length === 0) return null

  const fmtUsd = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
    if (v >= 100_000) return `$${(v / 1_000).toFixed(1)}K`
    return `$${v.toFixed(2)}`
  }

  const fmtBrl = (v: number) => {
    if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(2)}M`
    if (v >= 100_000) return `R$${(v / 1_000).toFixed(1)}K`
    return `R$${v.toFixed(2)}`
  }

  return (
    <View style={styles.container}>
      {/* Header comprimido — sempre visível */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggle}
        activeOpacity={0.6}
      >
        <Text style={[styles.headerLabel, { color: colors.textSecondary }]}>
          {expanded ? t('home.exchangeHide') : t('home.exchangeDetails')}
        </Text>

        {/* Chevron */}
        <Text style={[styles.chevron, { color: colors.textTertiary }]}>
          {expanded ? '▴' : '▾'}
        </Text>
      </TouchableOpacity>

      {/* Lista expandida */}
      {expanded && (
        <View style={styles.list}>
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
              <Text style={[styles.valueUsd, { color: colors.text }]}>
                {hideValue(fmtUsd(ex.value))}
              </Text>
              {usdToBrlRate ? (
                <Text style={[styles.valueBrl, { color: colors.textSecondary }]}>
                  {hideValue(fmtBrl(ex.value * usdToBrlRate))}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
  },
  // Header comprimido
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  headerLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: fontWeights.regular,
    opacity: 0.4,
  },
  chevron: {
    fontSize: 10,
    opacity: 0.3,
  },
  // Lista expandida
  list: {
    marginTop: 4,
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
    fontSize: 10,
    fontWeight: fontWeights.regular,
    opacity: 0.45,
  },
  valueUsd: {
    fontSize: 10,
    fontWeight: fontWeights.light,
    opacity: 0.65,
  },
  valueBrl: {
    fontSize: 9,
    fontWeight: fontWeights.light,
    opacity: 0.35,
    minWidth: 54,
    textAlign: 'right',
  },
})
