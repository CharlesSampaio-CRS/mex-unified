import { View, Text, StyleSheet, Image, TouchableOpacity, LayoutAnimation, Platform, UIManager, Linking, Alert } from 'react-native'
import { memo, useMemo, useState, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useBalance } from '@/contexts/BalanceContext'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { capitalizeExchangeName } from '@/lib/exchange-helpers'
import { getExchangeLogo } from '@/lib/exchange-logos'
import { getDepositConfig } from '@/lib/exchange-deposit-links'
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
  const [expandedError, setExpandedError] = useState<string | null>(null)

  const exchanges = useMemo(() => {
    if (!data?.exchanges || data.exchanges.length === 0) return []

    return data.exchanges
      .map((ex) => {
        const name = capitalizeExchangeName(ex.name || ex.exchange || 'Unknown')
        const value = typeof ex.total_usd === 'string' ? parseFloat(ex.total_usd) : (ex.total_usd || 0)
        const logo = getExchangeLogo(name)
        const hasError = (ex as any).success === false
        const error = (ex as any).error || ''
        const ccxtId = (ex.name || ex.exchange || '').toLowerCase()
        const depositConfig = getDepositConfig(ccxtId)
        return { name, value, logo, hasError, error, ccxtId, depositConfig }
      })
      .sort((a, b) => b.value - a.value)
  }, [data])

  const handleDeposit = useCallback(async (exchangeName: string, ccxtId: string) => {
    const config = getDepositConfig(ccxtId)
    if (!config) return

    const message = (t('deposit.confirmMessage') || 'Você será redirecionado para o app da {exchange} para fazer um depósito.')
      .replace('{exchange}', exchangeName)

    Alert.alert(
      `⚠️ ${t('deposit.title') || 'Abrir app da exchange'}`,
      message,
      [
        { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
        {
          text: t('deposit.openApp') || 'Abrir App',
          style: 'default',
          onPress: async () => {
            // Fallback: busca pelo nome da exchange na loja
            const searchTerm = encodeURIComponent(exchangeName)
            const storeSearchUrl = Platform.OS === 'ios'
              ? `https://apps.apple.com/search?term=${searchTerm}`
              : `https://play.google.com/store/search?q=${searchTerm}&c=apps`

            try {
              // Tenta abrir o deep link do app primeiro
              if (config.appDepositUrl) {
                const canOpen = await Linking.canOpenURL(config.appDepositUrl)
                if (canOpen) {
                  await Linking.openURL(config.appDepositUrl)
                  return
                }
              }
              // Tenta o scheme do app
              if (config.appScheme) {
                const canOpen = await Linking.canOpenURL(config.appScheme)
                if (canOpen) {
                  await Linking.openURL(config.appScheme)
                  return
                }
              }
              // Fallback: busca na loja pelo nome da exchange
              await Linking.openURL(storeSearchUrl)
            } catch (err) {
              await Linking.openURL(storeSearchUrl)
            }
          },
        },
      ]
    )
  }, [t])

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
            <View key={ex.name}>
              <View style={styles.row}>
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
                {ex.hasError && (
                  <TouchableOpacity
                    onPress={() => setExpandedError(prev => prev === ex.name ? null : ex.name)}
                    activeOpacity={0.6}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.errorIcon}>⚠️</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.depositColumn}>
                  {ex.depositConfig ? (
                    <TouchableOpacity
                      onPress={() => handleDeposit(ex.name, ex.ccxtId)}
                      activeOpacity={0.6}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      style={styles.depositButton}
                    >
                      <Text style={[styles.depositText, { color: colors.success }]}>
                        {t('deposit.label') || 'Abrir'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={[styles.valueUsd, { color: colors.text }]}>
                  {hideValue(fmtUsd(ex.value))}
                </Text>
                {usdToBrlRate ? (
                  <Text style={[styles.valueBrl, { color: colors.textSecondary }]}>
                    {hideValue(fmtBrl(ex.value * usdToBrlRate))}
                  </Text>
                ) : null}
              </View>
              {/* Mensagem de erro expandida */}
              {ex.hasError && expandedError === ex.name && ex.error ? (
                <View style={[styles.errorRow, { backgroundColor: 'rgba(239, 68, 68, 0.06)', borderColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Text style={styles.errorText} numberOfLines={3}>
                    {ex.error}
                  </Text>
                </View>
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
  errorIcon: {
    fontSize: 10,
    opacity: 0.8,
  },
  errorRow: {
    marginLeft: 22,
    marginTop: 2,
    marginBottom: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 9,
    fontWeight: fontWeights.regular,
    color: '#ef4444',
    lineHeight: 13,
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
  depositColumn: {
    width: 40,
    alignItems: 'center',
  },
  depositButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  depositText: {
    fontSize: 9,
    fontWeight: fontWeights.bold,
  },
})
