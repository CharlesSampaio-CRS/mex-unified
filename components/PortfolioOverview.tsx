import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { memo, useState, useEffect, useMemo, useCallback, useRef } from "react"
import { LinearGradient } from "expo-linear-gradient"
import { useTheme } from "@/contexts/ThemeContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { useBalance } from "@/contexts/BalanceContext"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { usePortfolio } from "@/contexts/PortfolioContext"
import { useAuth } from "@/contexts/AuthContext"
import { apiService } from "@/services/api"
import { pnlService } from "@/services/pnl-service"
import { currencyService } from "@/services/currencyService"
import { SkeletonPortfolioOverview } from "./SkeletonLoaders"
import { AnimatedLogoIcon } from "./AnimatedLogoIcon"
import { PortfolioChart } from "./PortfolioChart"
import { GradientCard } from "./GradientCard"
import { typography, fontWeights } from "@/lib/typography"
import { useCurrencyConversion } from "@/hooks/use-currency-conversion"
import { snapshotService } from "@/services/snapshot-service"

export const PortfolioOverview = memo(function PortfolioOverview() {
  // 1️⃣ HOOKS: useContext (sempre primeiro)
  const { colors, isDark } = useTheme()
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const { data, loading, error, refreshing, refresh } = useBalance()
  const { hideValue } = usePrivacy()
  
  // 💾 Refs para manter valores anteriores durante loading
  const previousPnl24h = useRef<any>(null)
  const previousPnl7d = useRef<any>(null)
  const { evolutionData, currentPeriod, refreshEvolution, loading: portfolioLoading } = usePortfolio()
  
  // 2️⃣ HOOKS: useState (sempre na mesma ordem)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date())
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)
  const [snapshot7dAgo, setSnapshot7dAgo] = useState<number | null>(null)
  const [localEvolutionData, setLocalEvolutionData] = useState<{ values_usd: number[], timestamps: string[] } | null>(null)
  const [evolutionPeriod, setEvolutionPeriod] = useState<number>(7)

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
  
  // Cálculo direto do PNL de 24h baseado no change_24h de cada token
  const pnl24h = useMemo(() => {
    // Se está carregando mas já tem dados anteriores, mantém os anteriores
    if (loading && previousPnl24h.current) {
      return previousPnl24h.current
    }
    
    // Se não tem dados, retorna valores iniciais
    if (!data) {
      return {
        current: 0,
        previous: 0,
        change: 0,
        changePercent: 0,
        isProfit: false
      }
    }

    const currentTotal = typeof data.total_usd === 'string' 
      ? parseFloat(data.total_usd) 
      : (data.total_usd || 0)
    let previousTotal = 0

    // Itera sobre as exchanges e calcula o valor anterior de cada token
    for (const exchange of data.exchanges || []) {
      const balancesArray = Object.values(exchange.balances || {})
      
      for (const balance of balancesArray) {
        const currentValue = typeof balance.usd_value === 'string'
          ? parseFloat(balance.usd_value)
          : (balance.usd_value || 0)
        const change24hPercent = balance.change_24h || 0
        
        // Calcula o valor anterior usando a fórmula: previous = current / (1 + change%)
        const previousValue = change24hPercent !== 0
          ? currentValue / (1 + (change24hPercent / 100))
          : currentValue
        
        previousTotal += previousValue
      }
    }

    const change = currentTotal - previousTotal
    const changePercent = previousTotal !== 0 ? (change / previousTotal) * 100 : 0

    const result = {
      current: currentTotal,
      previous: previousTotal,
      change,
      changePercent,
      isProfit: change >= 0
    }
    
    // Salva o resultado para uso futuro
    if (!loading) {
      previousPnl24h.current = result
    }
    
    return result
  }, [data, loading])
  
  // Cálculo do PNL DINÂMICO: compara valor atual com o PRIMEIRO ponto do gráfico de evolução
  const pnl7d = useMemo(() => {
    // Se está carregando mas já tem dados anteriores, mantém os anteriores
    if (loading && previousPnl7d.current) {
      return previousPnl7d.current
    }
    
    // Se não tem dados, retorna valores iniciais
    if (!data || !localEvolutionData || localEvolutionData.values_usd.length === 0) {
      return {
        requestedPeriod: evolutionPeriod,
        actualDays: null,
        current: 0,
        previous: 0,
        change: 0,
        changePercent: 0,
        isProfit: false,
        hasSnapshot: false
      }
    }

    const currentTotal = typeof data.total_usd === 'string' 
      ? parseFloat(data.total_usd) 
      : (data.total_usd || 0)
    
    // USA O PRIMEIRO PONTO DO GRÁFICO como valor anterior
    const previousValue = localEvolutionData.values_usd[0]
    const hasSnapshot = true
    
    const change = currentTotal - previousValue
    const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0

    const result = {
      requestedPeriod: evolutionPeriod,
      actualDays: evolutionPeriod, // Usa o período solicitado
      current: currentTotal,
      previous: previousValue,
      hasSnapshot,
      change,
      changePercent,
      isProfit: change >= 0
    }
    
    // Salva o resultado para uso futuro
    if (!loading) {
      previousPnl7d.current = result
    }
    
    return result
  }, [data, loading, localEvolutionData, evolutionPeriod])
  
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
    return refreshing || portfolioLoading || isRefreshingAll
  }, [refreshing, portfolioLoading, isRefreshingAll])

  // 4️⃣ HOOKS: useCallback (depois de useMemo, antes de useEffect)
  const formatLastUpdated = useCallback(() => {
    if (!lastUpdateTime) return ''
    
    const timeStr = lastUpdateTime.toLocaleTimeString(language, { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
    
    return `${t('portfolio.updatedAt')}: ${timeStr}`
  }, [lastUpdateTime, language, t])

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
        refreshEvolution() // Atualiza gráfico mantendo o período atual
      ])
      
    } catch (error) {
      // Mostra erro para o usuário
      if (error instanceof Error) {
        alert(`Erro ao atualizar: ${error.message}`)
      }
    } finally {
      setIsRefreshingAll(false)
    }
  }, [user?.id, refresh, refreshEvolution])

  // 5️⃣ HOOKS: useEffect (sempre por último)
  useEffect(() => {
    if (data?.timestamp) {
      setLastUpdateTime(new Date())
    }
  }, [data?.timestamp])
  
  // Carregar dados de evolução do banco local (apenas para o gráfico)
  useEffect(() => {
    const loadEvolutionData = async () => {
      if (!user?.id) return
      
      try {
        const evolutionData = await pnlService.getEvolutionData(user.id!, evolutionPeriod)
        setLocalEvolutionData(evolutionData)
      } catch (error) {
        console.error('❌ [PortfolioOverview] Erro ao carregar dados de evolução:', error)
      }
    }
    
    loadEvolutionData()
  }, [user?.id, data?.timestamp, evolutionPeriod]) // Recarrega quando o balance ou período atualiza

  // Buscar snapshot de 7 dias atrás do banco local
  useEffect(() => {
    const load7dSnapshot = async () => {
      if (!user?.id) return
      
      try {
        // Data de 7 dias atrás
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        
        // Busca snapshots dos últimos 7 dias, ordenado por timestamp DESC
        const snapshots = await snapshotService.getSnapshots(user.id!, {
          startDate: sevenDaysAgo.getTime(),
          limit: 1000 // pegar todos os últimos 7 dias
        })
        
        if (snapshots.length > 0) {
          // Pega o snapshot mais antigo dos últimos 7 dias (último item do array DESC)
          const snap = snapshots[snapshots.length - 1]
          setSnapshot7dAgo(snap.total_usd)
        } else {
          // Se não tem snapshot de 7 dias, pega o mais antigo disponível
          const allSnapshots = await snapshotService.getSnapshots(user.id!, { limit: 1 })
          
          if (allSnapshots.length > 0) {
            const oldestSnap = allSnapshots[0]
            setSnapshot7dAgo(oldestSnap.total_usd)
          } else {
            setSnapshot7dAgo(null)
          }
        }
      } catch (error) {
        console.error('❌ [PortfolioOverview] Erro ao carregar snapshot de 7 dias:', error)
        setSnapshot7dAgo(null)
      }
    }
    
    load7dSnapshot()
  }, [user?.id, data?.timestamp])

  // ❌ REMOVIDO: useEffect que buscava snapshot separadamente
  // O PNL agora usa o primeiro ponto do gráfico de evolução (mesma fonte de dados)
  // Isso garante que o card de PNL e o gráfico sempre mostrem valores consistentes

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
          <View style={styles.valueSection}>
            <View style={styles.valueContainer}>
              <Text style={[styles.value, { color: colors.text }]}>
                {hideValue(`$${formattedValue}`)}
              </Text>
              <Text style={[styles.currencyLabel, { color: colors.textSecondary }]}>
                USD
              </Text>
              <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
                {formatLastUpdated()}
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
          <TouchableOpacity 
            style={[styles.refreshButton, isUpdating && styles.refreshButtonDisabled]}
            onPress={handleRefreshAll}
            disabled={isUpdating}
            activeOpacity={isUpdating ? 1 : 0.7}
          >
            {isUpdating ? (
              <AnimatedLogoIcon size={20} />
            ) : (
              <Text style={[styles.refreshIcon, { color: colors.primary }]}>↻</Text>
            )}
          </TouchableOpacity>
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

        {/* Portfolio Chart - Gráfico de 7 dias */}
        <PortfolioChart 
          localEvolutionData={localEvolutionData}
          onPeriodChange={setEvolutionPeriod}
          currentPeriod={evolutionPeriod}
        />
      </LinearGradient>
  )
})

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,           // era 20 (+20% - mais arredondado)
    padding: 16,                // Reduzido de 20 para 16 (mais compacto)
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
    fontSize: typography.caption,
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
    fontSize: typography.h4,
    fontWeight: fontWeights.light,
    opacity: 0.6,
  },
  valueSection: {
    gap: 4,
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 0,
    marginLeft: 12,  // Alinha com o BRL
  },
  value: {
    fontSize: typography.h4,  // 18px - reduzido
    fontWeight: fontWeights.light,
    letterSpacing: -0.6,
  },
  currencyLabel: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
    opacity: 0.5,
    letterSpacing: 0.5,
  },
  brlContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 2,
    marginLeft: 12,  // Empurra para a direita
  },
  brlValue: {
    fontSize: typography.caption,  // Menor que USD
    fontWeight: fontWeights.regular,
    opacity: 0.6,
  },
  lastUpdated: {
    fontSize: typography.micro,
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
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
    opacity: 0.9,
  },
  pnlInlineValue: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
  },
  pnlInlinePercent: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    opacity: 0.8,
  },
  pnlInlineLabel: {
    fontSize: typography.micro,
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
    fontSize: typography.micro,
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
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
  },
  pnlPillValue: {
    fontSize: typography.caption,
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
    fontSize: typography.micro,
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
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
    opacity: 0.6,
  },
  pnlValue: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
    letterSpacing: 0,
    flex: 1,
  },
  pnlPercent: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
    opacity: 0.6,
  },
  errorText: {
    fontSize: typography.body,
    textAlign: "center",
  },
  exchangesCount: {
    fontSize: typography.caption,
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
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
    opacity: 0.5,
  },
  pnlCardContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  pnlCardArrow: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
  },
  pnlCardValue: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
  },
  pnlCardPercent: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
    opacity: 0.7,
  },
})
