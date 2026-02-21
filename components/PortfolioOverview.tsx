import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { memo, useState, useEffect, useMemo, useCallback, useRef } from "react"
import { LinearGradient } from "expo-linear-gradient"
import { useTheme } from "@/contexts/ThemeContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { useBalance } from "@/contexts/BalanceContext"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { useAuth } from "@/contexts/AuthContext"
import { apiService } from "@/services/api"
import { currencyService } from "@/services/currencyService"
import { SkeletonPortfolioOverview } from "./SkeletonLoaders"
import { AnimatedLogoIcon } from "./AnimatedLogoIcon"
import { PortfolioChart } from "./PortfolioChart"
import { ExchangesPieChart } from "./ExchangesPieChart"
import { GradientCard } from "./GradientCard"
import { typography, fontWeights } from "@/lib/typography"
import { useCurrencyConversion } from "@/hooks/use-currency-conversion"
import { PnLSummary, backendSnapshotService } from "@/services/backend-snapshot-service"

interface PortfolioOverviewProps {
  pnl?: PnLSummary | null
  pnlLoading?: boolean
}

export const PortfolioOverview = memo(function PortfolioOverview({ pnl, pnlLoading = false }: PortfolioOverviewProps) {
  // 1️⃣ HOOKS: useContext (sempre primeiro)
  const { colors, isDark } = useTheme()
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const { data, loading, error, refreshing, refresh } = useBalance()
  const { hideValue } = usePrivacy()
  
  // 2️⃣ HOOKS: useState (sempre na mesma ordem)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date())
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)
  const [evolutionPeriod, setEvolutionPeriod] = useState<number>(7)
  const [evolutionData, setEvolutionData] = useState<{ values_usd: number[], timestamps: string[] } | null>(null)
  const [evolutionLoading, setEvolutionLoading] = useState(false)

  // 3️⃣ HOOKS: useMemo (antes de useCallback e useEffect)
  const totalValue = useMemo(() => {
    if (!data) return 0
    
    const value = parseFloat(
      data.summary?.total_usd ||  // ← Estrutura antiga (com summary)
      (data as any).total_usd ||  // ← Estrutura nova (raiz)
      '0'
    )
    
    return value
  }, [data])
  
  const formattedValue = useMemo(() => {
    return apiService.formatUSD(totalValue)
  }, [totalValue])
  
  // Conversão USD → BRL
  const { brlValue, usdToBrlRate, isLoading: brlLoading } = useCurrencyConversion(totalValue)
  
  const formattedBrlValue = useMemo(() => {
    if (!brlValue) return null
    return currencyService.formatBrl(brlValue)
  }, [brlValue])
  
  // Valor BRL sem símbolo (label BRL é suficiente)
  const brlValueWithoutSymbol = useMemo(() => {
    if (!formattedBrlValue) return null
    return formattedBrlValue.replace(/[R$]/g, '').trim()
  }, [formattedBrlValue])
  
  // PNL do MongoDB (hoje = 24h)
  const pnl24h = useMemo(() => {
    if (!pnl || pnlLoading) {
      return {
        current: totalValue,
        previous: totalValue,
        change: 0,
        changePercent: 0,
        isProfit: false
      }
    }
    
    return {
      current: pnl.currentBalance,
      previous: pnl.today.previous,
      change: pnl.today.change,
      changePercent: pnl.today.changePercent,
      isProfit: pnl.today.change >= 0
    }
  }, [pnl, pnlLoading, totalValue])
  
  // PNL de período (7d, 15d ou 30d) do MongoDB
  const pnl7d = useMemo(() => {
    if (!pnl || pnlLoading) {
      return {
        requestedPeriod: evolutionPeriod,
        actualDays: null,
        current: totalValue,
        previous: totalValue,
        change: 0,
        changePercent: 0,
        isProfit: false,
        hasSnapshot: false
      }
    }
    
    // Escolhe qual período do PNL usar baseado no evolutionPeriod
    let periodData = pnl.week // default 7 dias
    if (evolutionPeriod === 15) {
      periodData = pnl.twoWeeks
    } else if (evolutionPeriod === 30) {
      periodData = pnl.month
    }
    
    return {
      requestedPeriod: evolutionPeriod,
      actualDays: evolutionPeriod,
      current: pnl.currentBalance,
      previous: periodData.previous,
      change: periodData.change,
      changePercent: periodData.changePercent,
      isProfit: periodData.change >= 0,
      hasSnapshot: true
    }
  }, [pnl, pnlLoading, evolutionPeriod, totalValue])
  
  const change24h = pnl24h.changePercent
  const isPositive = pnl24h.isProfit
  
  // Função para gerar label dinâmico do período
  const getPeriodLabel = useCallback((requestedDays: number, actualDays: number | null) => {
    // Sempre mostra o período solicitado pelo usuário
    const requestedLabel = requestedDays === 7 ? t('pnl.7Days') : 
                          requestedDays === 15 ? t('pnl.15Days') : 
                          t('pnl.30Days')
    
    // Se não tem snapshot, mostra só o período
    if (actualDays === null) {
      return requestedLabel
    }
    
    // Se o snapshot está próximo (±2 dias), mostra só o período
    const daysDifference = Math.abs(actualDays - requestedDays)
    if (daysDifference <= 2) {
      return requestedLabel
    }
    
    // Se está longe, adiciona um indicador discreto
    // Ex: "7 dias (≈4d)" para mostrar que está usando dado aproximado
    return `${requestedLabel} (≈${actualDays}d)`
  }, [t])
  
  const isUpdating = useMemo(() => {
    return refreshing || evolutionLoading || isRefreshingAll
  }, [refreshing, evolutionLoading, isRefreshingAll])

  // 4️⃣ HOOKS: useCallback (depois de useMemo, antes de useEffect)
  const formatLastUpdated = useCallback(() => {
    // Se estiver atualizando, mostra "Updating..."
    if (isUpdating) {
      return t('home.updating')
    }
    
    const timestamp = data?.timestamp
      ? new Date((typeof data.timestamp === 'number' ? data.timestamp : Number(data.timestamp)) * 1000)
      : lastUpdateTime

    if (!timestamp) return ''

    const timeStr = timestamp.toLocaleTimeString(language, { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    })

    return `Updated ${timeStr}`
  }, [data?.timestamp, lastUpdateTime, language, isUpdating, t])

  const handleRefreshAll = useCallback(async () => {
    if (!user?.id) {
      return
    }

    setIsRefreshingAll(true)
    
    try {
      // ✅ CORRIGIDO: Apenas chama refresh() que já faz o sync internamente
      // Não precisa chamar backgroundSyncService.syncNow() + refresh()
      await Promise.all([
        refresh(), // Atualiza balances no context (já chama syncNow internamente)
        loadEvolutionData(evolutionPeriod) // Atualiza gráfico mantendo o período atual
      ])
      
    } catch (error) {
      // Mostra erro para o usuário
      if (error instanceof Error) {
        alert(`Erro ao atualizar: ${error.message}`)
      }
    } finally {
      setIsRefreshingAll(false)
    }
  }, [user?.id, refresh, evolutionPeriod])

  /**
   * Carrega dados de evolução do MongoDB
   */
  const loadEvolutionData = useCallback(async (days: number) => {
    if (!user?.id) return
    
    try {
      console.log(`🔄 [PortfolioOverview] Carregando dados de evolução para ${days} dias...`)
      setEvolutionLoading(true)
      const data = await backendSnapshotService.getEvolutionData(days)
      console.log(`✅ [PortfolioOverview] Dados de evolução carregados:`, {
        days,
        dataPoints: data.values_usd.length,
        firstValue: data.values_usd[0],
        lastValue: data.values_usd[data.values_usd.length - 1]
      })
      setEvolutionData(data)
    } catch (error) {
      console.error('❌ Erro ao carregar dados de evolução:', error)
    } finally {
      setEvolutionLoading(false)
    }
  }, [user?.id])

  // 5️⃣ HOOKS: useEffect (sempre por último)
  useEffect(() => {
    if (data?.timestamp) {
      setLastUpdateTime(new Date())
    }
  }, [data?.timestamp])

  // Carrega dados de evolução do MongoDB quando o período muda
  useEffect(() => {
    console.log(`🔄 [PortfolioOverview useEffect] Período mudou para ${evolutionPeriod} dias`)
    console.log(`🔄 [PortfolioOverview useEffect] user?.id:`, user?.id)
    console.log(`🔄 [PortfolioOverview useEffect] Chamando loadEvolutionData...`)
    loadEvolutionData(evolutionPeriod)
  }, [evolutionPeriod, loadEvolutionData])

  // Handler para mudar período do gráfico
  const handlePeriodChange = useCallback((days: number) => {
    console.log(`🔘 [PortfolioOverview] handlePeriodChange chamado: ${days} dias`)
    console.log(`🔘 [PortfolioOverview] evolutionPeriod atual: ${evolutionPeriod}`)
    console.log(`🔘 [PortfolioOverview] Setando novo período...`)
    setEvolutionPeriod(days)
    console.log(`✅ [PortfolioOverview] setEvolutionPeriod(${days}) executado`)
  }, [evolutionPeriod])

  // 6️⃣ RENDER LOGIC (early returns devem vir depois de todos os hooks)
  if (loading && !data && !error) {
    return <SkeletonPortfolioOverview />
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {error || t('home.noData')}
        </Text>
      </View>
    )
  }

  // Define cores do gradiente baseado no tema - tons neutros suaves
  const gradientColors: readonly [string, string, ...string[]] = isDark 
    ? ['rgba(39, 39, 42, 1)', 'rgba(63, 63, 70, 1)', 'rgba(39, 39, 42, 1)']  // Dark mode - Zinc 800-700
    : ['rgba(250, 250, 249, 1)', 'rgba(247, 246, 244, 1)', 'rgba(250, 250, 249, 1)']  // Light mode - bege muito claro suave
  
  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { borderColor: colors.border }]}
    >
        <View style={styles.headerRow}>
          <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
            {formatLastUpdated()}
          </Text>
        </View>

        <View style={styles.valueSection}>
          <View style={styles.valueContainer}>
            <Text style={[styles.value, { color: colors.text }]}>
              {hideValue(`$${formattedValue}`)}
            </Text>
            <Text style={[styles.currencyLabel, { color: colors.textSecondary }]}>
              USD
            </Text>
          </View>
          {brlValueWithoutSymbol && (
            <View style={styles.brlContainer}>
              <Text style={[styles.brlValue, { color: colors.textSecondary }]}>
                {hideValue(brlLoading ? '...' : `$${brlValueWithoutSymbol}`)}
              </Text>
              <Text style={[styles.currencyLabel, { color: colors.textSecondary }]}>
                BRL
              </Text>
            </View>
          )}
        </View>

        {/* PNL Cards - Diário e Período separados */}
        <View style={styles.pnlCardsRow}>
          {/* PNL Diário (24h) - Calculado diretamente do change_24h */}
          <GradientCard style={[
            styles.pnlCard, 
            { 
              borderWidth: 1,
              borderColor: pnl24h.change === 0 ? colors.border : (pnl24h.isProfit ? `${colors.success}15` : `${colors.danger}15`),
            }
          ]}>
            <Text style={[styles.pnlCardLabel, { color: colors.textTertiary }]}>
              {t('pnl.24Hours')}
            </Text>
            <View style={styles.pnlCardContent}>
              <Text style={[
                styles.pnlCardArrow,
                { color: pnl24h.change === 0 ? colors.textTertiary : (pnl24h.isProfit ? colors.success : colors.danger) }
              ]}>
                {pnl24h.change === 0 ? "━" : (pnl24h.isProfit ? "▲" : "▼")}
              </Text>
              <Text style={[
                styles.pnlCardValue,
                { color: pnl24h.change === 0 ? colors.text : (pnl24h.isProfit ? colors.success : colors.danger) }
              ]}>
                {hideValue(`$${apiService.formatUSD(Math.abs(pnl24h.change))}`)}
              </Text>
            </View>
            <Text style={[
              styles.pnlCardPercent,
              { color: pnl24h.change === 0 ? colors.textTertiary : (pnl24h.isProfit ? colors.success : colors.danger) }
            ]}>
              {hideValue(pnl24h.change === 0 
                ? "0.00%" 
                : `${Math.abs(pnl24h.changePercent).toFixed(2)}%`
              )}
            </Text>
          </GradientCard>

          {/* PNL DINÂMICO - Compara com snapshot do período selecionado */}
          <GradientCard style={[
            styles.pnlCard, 
            { 
              borderWidth: 1,
              borderColor: !pnl7d.hasSnapshot ? colors.border : (pnl7d.change === 0 ? colors.border : (pnl7d.isProfit ? `${colors.success}15` : `${colors.danger}15`)),
            }
          ]}>
            <Text style={[styles.pnlCardLabel, { color: colors.textTertiary }]}>
              {getPeriodLabel(pnl7d.requestedPeriod, pnl7d.actualDays)}
            </Text>
            <View style={styles.pnlCardContent}>
              <Text style={[
                styles.pnlCardArrow,
                { color: pnl7d.change === 0 ? colors.textTertiary : (pnl7d.isProfit ? colors.success : colors.danger) }
              ]}>
                {pnl7d.change === 0 ? "━" : (pnl7d.isProfit ? "▲" : "▼")}
              </Text>
              <Text style={[
                styles.pnlCardValue,
                { color: pnl7d.change === 0 ? colors.text : (pnl7d.isProfit ? colors.success : colors.danger) }
              ]}>
                {hideValue(`$${apiService.formatUSD(Math.abs(pnl7d.change))}`)}
              </Text>
            </View>
            <Text style={[
              styles.pnlCardPercent,
              { color: pnl7d.change === 0 ? colors.textTertiary : (pnl7d.isProfit ? colors.success : colors.danger) }
            ]}>
              {hideValue(pnl7d.change === 0 
                ? "0.00%" 
                : `${Math.abs(pnl7d.changePercent).toFixed(2)}%`
              )}
            </Text>
          </GradientCard>
        </View>

        {/* Portfolio Chart - Gráfico com dados do MongoDB */}
        <PortfolioChart 
          localEvolutionData={evolutionData}
          onPeriodChange={handlePeriodChange}
          currentPeriod={evolutionPeriod}
        />

        {/* Espaçamento entre os gráficos */}
        <View style={{ marginTop: 16 }} />

        {/* Gráfico de Pizza das Exchanges */}
        <ExchangesPieChart />
      </LinearGradient>
  )
})

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,                // era 1 (mantido suave)
    },
    shadowOpacity: 0.03,        // era 0.04 (-25% - mais suave)
    shadowRadius: 6,
    elevation: 1,               // era 2 (-50% - menos sombra Android)
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,           // Reduzido de 12 para 10 (mais compacto)
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 0,
  },
  label: {
    fontSize: 11,  // Label header (reduzido de 14px)
    fontWeight: fontWeights.regular,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    opacity: 0.5,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshIconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  refreshIcon: {
    fontSize: 16,  // Ícone refresh (reduzido de 18px)
    fontWeight: fontWeights.light,
    opacity: 0.6,
  },
  valueSection: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 0,
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    flex: 1,
  },
  value: {
    fontSize: 16,  // Valor principal do portfolio (reduzido de 17px)
    fontWeight: fontWeights.light,
    letterSpacing: -0.4,
  },
  currencyLabel: {
    fontSize: 11,  // Label USD/BRL (reduzido de 13px)
    fontWeight: fontWeights.medium,
    opacity: 0.5,
    letterSpacing: 0.4,
  },
  brlContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    justifyContent: "flex-end",
  },
  brlValue: {
    fontSize: 12,  // Valor BRL (reduzido de 13px)
    fontWeight: fontWeights.regular,
    opacity: 0.6,
  },
  lastUpdated: {
    fontSize: 11,  // Timestamp (reduzido de 12px)
    fontWeight: fontWeights.light,
    opacity: 0.4,
  },
  // PNL Inline - abaixo do valor total
  pnlInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,           // Reduzido de 16 para 12 (mais compacto)
  },
  pnlInlineArrow: {
    fontSize: 12,  // Seta PnL (reduzido de 16px)
    fontWeight: fontWeights.bold,
    opacity: 0.9,
  },
  pnlInlineValue: {
    fontSize: 12,  // Valor PnL (reduzido de 14px)
    fontWeight: fontWeights.semibold,
  },
  pnlInlinePercent: {
    fontSize: 11,  // Percentual PnL (reduzido de 14px)
    fontWeight: fontWeights.regular,
    opacity: 0.8,
  },
  pnlInlineLabel: {
    fontSize: 10,  // Label 24h (reduzido de 12px)
    fontWeight: fontWeights.regular,
    opacity: 0.4,
    marginLeft: 4,
  },
  // PNLs - Pills compactas lado a lado (OLD - não usado)
  pnlsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  pnlPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  pnlPillLabel: {
    fontSize: 10,  // Label PnL pill (reduzido de 12px)
    fontWeight: fontWeights.semibold,
    opacity: 0.5,
    letterSpacing: 0.5,
  },
  pnlPillValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pnlPillArrow: {
    fontSize: 12,  // Seta pill (reduzido de 16px)
    fontWeight: fontWeights.bold,
  },
  pnlPillValue: {
    fontSize: 12,  // Valor pill (reduzido de 14px)
    fontWeight: fontWeights.semibold,
  },
  // Seção de PNL em linha única - visual suave (OLD - pode remover)
  pnlSection: {
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 0.5,
  },
  pnlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pnlLabel: {
    fontSize: 10,  // Label seção (reduzido de 12px)
    fontWeight: fontWeights.regular,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    opacity: 0.35,
    minWidth: 70,
  },
  pnlIndicator: {
    width: 18,
    alignItems: "center",
  },
  pnlArrow: {
    fontSize: 11,  // Seta seção (reduzido de 14px)
    fontWeight: fontWeights.light,
    opacity: 0.6,
  },
  pnlValue: {
    fontSize: 11,  // Valor seção (reduzido de 14px)
    fontWeight: fontWeights.medium,
    letterSpacing: 0,
    flex: 1,
  },
  pnlPercent: {
    fontSize: 11,  // Percentual seção (reduzido de 13px)
    fontWeight: fontWeights.regular,
    opacity: 0.6,
  },
  errorText: {
    fontSize: 13,  // Texto erro (reduzido de 16px)
    textAlign: "center",
  },
  exchangesCount: {
    fontSize: 12,  // Contador exchanges (reduzido de 14px)
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
  refreshButtonAbsolute: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    zIndex: 10,
  },
  // PNL Diário - Resumo rápido acima do gráfico
  todayPnlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginTop: 8,
  },
  // PNL Cards Row - Cards lado a lado (compactos)
  pnlCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  pnlCard: {
    flex: 1,
    paddingVertical: 10,        // +25% padding vertical (mais espaço)
    paddingHorizontal: 12,      // +20% padding horizontal
    borderRadius: 12,           // +20% border radius (mais arredondado)
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',        // adiciona sombra sutil
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  pnlCardLabel: {
    fontSize: 10,  // Label card (reduzido de 12px)
    fontWeight: fontWeights.medium,
    opacity: 0.5,
  },
  pnlCardContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  pnlCardArrow: {
    fontSize: 12,  // Seta card (reduzido de 14px)
    fontWeight: fontWeights.semibold,
  },
  pnlCardValue: {
    fontSize: 12,  // Valor card (reduzido de 14px)
    fontWeight: fontWeights.semibold,
  },
  pnlCardPercent: {
    fontSize: 11,  // Percentual card (reduzido de 13px)
    fontWeight: fontWeights.regular,
    opacity: 0.7,
  },
})
