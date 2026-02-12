/**
 * Lista de Tokens Favoritos
 * Mostra tokens marcados como favoritos pelo usuário
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/contexts/ThemeContext"
import { useWatchlist } from "@/contexts/WatchlistContext"
import { useBalance } from "@/contexts/BalanceContext"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { useAlerts } from "@/contexts/AlertsContext"
import { apiService } from "@/services/api"
import { CreateAlertModal } from "./create-price-alert-modal"
import { TokenDetailsModal } from "./token-details-modal"
import { TradeModal } from "./trade-modal"
import { GenericItemList } from "./GenericItemList"
import { getExchangeBalances, getExchangeId, getExchangeName } from "@/lib/exchange-helpers"

interface TokenData {
  symbol: string
  name: string
  amount: number
  price: number
  value: number
  change24h: number | null
  exchanges: string[]
}

export function WatchlistFavorites() {
  const { colors } = useTheme()
  const { watchlist, removeToken, loading: watchlistLoading } = useWatchlist()
  const { data: balanceData, loading: balanceLoading, refresh: refreshBalance } = useBalance()
  const { hideValue } = usePrivacy()
  const { getAlertsForToken } = useAlerts()
  
  const [refreshing, setRefreshing] = useState(false)
  const [alertModalVisible, setAlertModalVisible] = useState(false)
  const [selectedToken, setSelectedToken] = useState<{ symbol: string; price: number; exchangeId?: string; exchangeName?: string } | null>(null)
  const [tokenModalVisible, setTokenModalVisible] = useState(false)
  const [selectedTokenForDetails, setSelectedTokenForDetails] = useState<{ exchangeId: string; symbol: string } | null>(null)
  const [tradeModalVisible, setTradeModalVisible] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<{
    exchangeId: string
    exchangeName: string
    symbol: string
    currentPrice: number
    balance: { token: number; usdt: number }
  } | null>(null)

  // Refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshBalance()
    setRefreshing(false)
  }, [refreshBalance])

  // Remover favorito
  const handleRemoveFavorite = async (symbol: string) => {
    await removeToken(symbol)
  }

  // Abrir modal de alerta
  const handleCreateAlert = (symbol: string, price: number, exchangeId?: string, exchangeName?: string) => {
    setSelectedToken({ symbol, price, exchangeId, exchangeName })
    setAlertModalVisible(true)
  }

  // Transform data to GenericItemList format - Grouped by Exchange
  const favoriteSections = useMemo(() => {
    // Map to store tokens by exchange
    const exchangeMap = new Map<string, { exchangeId: string; exchangeName: string; items: any[] }>()
    const tokensWithoutBalance: any[] = []

    // Aggregate data from exchanges
    if (balanceData?.exchanges) {
      balanceData.exchanges.forEach(exchange => {
        const balances = getExchangeBalances(exchange)
        const exchangeId = getExchangeId(exchange)
        const exchangeName = getExchangeName(exchange)
        
        Object.entries(balances).forEach(([symbol, token]) => {
          const symbolUpper = symbol.toUpperCase()
          
          // Check if in watchlist
          const isInWatchlist = watchlist.some(w => w.symbol.toUpperCase() === symbolUpper)
          if (!isInWatchlist) return

          const amount = parseFloat((token.amount || token.total || 0).toString())
          const free = parseFloat((token.free || 0).toString())
          const used = parseFloat((token.used || token.locked || 0).toString())
          const price = parseFloat((token.price_usd || 0).toString())
          const value = parseFloat((token.value_usd || token.usd_value || 0).toString())

          // Only add tokens with balance
          if (value > 0) {
            // Get USDT balance from this exchange
            const usdtData = balances['USDT'] || balances['usdt']
            const usdtBalance = usdtData ? parseFloat((usdtData.free || 0).toString()) : 0

            const tokenData = {
              id: `${exchangeId}-${symbolUpper}`,
              symbol: symbolUpper,
              name: symbolUpper,
              amount,
              free,
              used,
              priceUSD: price,
              valueUSD: value,
              variation24h: token.change_24h ?? null,
              exchangeId,
              exchangeName,
              isStablecoin: ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'FDUSD'].includes(symbolUpper),
              usdtBalance,
              exchanges: [exchangeName], // Single exchange for this item
            }

            // Add to exchange section
            if (!exchangeMap.has(exchangeId)) {
              exchangeMap.set(exchangeId, {
                exchangeId,
                exchangeName,
                items: []
              })
            }
            exchangeMap.get(exchangeId)!.items.push(tokenData)
          }
        })
      })
    }

    // Find tokens in watchlist but without balance in any exchange
    watchlist.forEach(w => {
      const symbolUpper = w.symbol.toUpperCase()
      let hasBalance = false

      // Check if token has balance in any exchange
      exchangeMap.forEach(section => {
        if (section.items.some(item => item.symbol === symbolUpper)) {
          hasBalance = true
        }
      })

      // Add to "without balance" section if not found
      if (!hasBalance) {
        tokensWithoutBalance.push({
          id: `no-balance-${symbolUpper}`,
          symbol: symbolUpper,
          name: w.name || symbolUpper,
          amount: 0,
          free: 0,
          used: 0,
          priceUSD: 0,
          valueUSD: 0,
          variation24h: null,
          exchangeId: '',
          exchangeName: '',
          isStablecoin: false,
          usdtBalance: 0,
          exchanges: [],
        })
      }
    })

    // Convert to array and sort sections by exchange name
    const sections: any[] = Array.from(exchangeMap.values()).map(section => ({
      ...section,
      loading: false,
      // Sort items by value (descending)
      items: section.items.sort((a, b) => b.valueUSD - a.valueUSD)
    })).sort((a, b) => a.exchangeName.localeCompare(b.exchangeName))

    // Add "Sem Saldo" section at the end if there are tokens without balance
    if (tokensWithoutBalance.length > 0) {
      sections.push({
        exchangeId: 'favorites-without-balance',
        exchangeName: 'Sem Saldo',
        items: tokensWithoutBalance.sort((a, b) => a.symbol.localeCompare(b.symbol)),
        loading: false,
      })
    }

    return sections
  }, [balanceData, watchlist])

  const loading = watchlistLoading || balanceLoading

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Empty State */}
      {loading && favoriteSections.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            Carregando...
          </Text>
        </View>
      ) : favoriteSections.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="star-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
            Nenhum favorito ainda
          </Text>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            Marque tokens como favoritos clicando na estrela (⭐) na lista de assets
          </Text>
        </View>
      ) : (
        /* GenericItemList */
        <View style={{ padding: 16 }}>
          <GenericItemList
            sections={favoriteSections}
            config={{
              renderFavoriteButton: (item, colors) => {
                const tokenAlerts = getAlertsForToken(item.symbol)
                const hasAlerts = tokenAlerts.length > 0
                
                return (
                  <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                    {/* Botão de Alerta */}
                    <TouchableOpacity
                      onPress={() => handleCreateAlert(item.symbol, item.priceUSD, item.exchangeId, item.exchangeName)}
                      style={{ padding: 2 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={hasAlerts ? "notifications" : "notifications-outline"}
                        size={16}
                        color={hasAlerts ? colors.primary : colors.textSecondary}
                        style={{ opacity: hasAlerts ? 1 : 0.6 }}
                      />
                    </TouchableOpacity>
                    
                    {/* Botão de Remover Favorito */}
                    <TouchableOpacity
                      onPress={() => handleRemoveFavorite(item.symbol)}
                      style={{ padding: 2, marginLeft: -2 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="star"
                        size={16}
                        color="#fbbf24"
                      />
                    </TouchableOpacity>
                  </View>
                )
              },
              renderBadge: (item, colors) => {
                // Mostra variação 24h se disponível (igual estava antes)
                if (item.variation24h !== null && item.variation24h !== undefined && !item.isStablecoin && item.valueUSD > 0) {
                  return (
                    <View style={[
                      styles.variationBadge,
                      { backgroundColor: item.variation24h >= 0 ? colors.successLight : colors.dangerLight }
                    ]}>
                      <Text style={[
                        styles.variationText,
                        { color: item.variation24h >= 0 ? colors.success : colors.danger }
                      ]}>
                        {`${item.variation24h >= 0 ? '▲' : '▼'} ${Math.abs(item.variation24h).toFixed(2)}% 24H`}
                      </Text>
                    </View>
                  )
                }
                
                // Se não tiver variação mas tiver exchange, mostra exchange
                if (item.exchangeName && item.valueUSD > 0) {
                  return (
                    <View style={[styles.exchangeBadge, { backgroundColor: colors.background }]}>
                      <Text style={[styles.exchangeBadgeText, { color: colors.textSecondary }]}>
                        {item.exchangeName}
                      </Text>
                    </View>
                  )
                }
                
                // Se não tiver saldo
                if (item.valueUSD === 0) {
                  return (
                    <View style={[styles.noBalanceTag, { backgroundColor: colors.background }]}>
                      <Ionicons name="information-circle-outline" size={12} color={colors.textTertiary} />
                      <Text style={[styles.noBalanceText, { color: colors.textSecondary }]}>
                        Sem saldo
                      </Text>
                    </View>
                  )
                }
                
                return null
              },
              renderSubtitle: (item, colors) => {
                // Não precisa mostrar exchange no subtitle pois já está na seção
                // Apenas retorna null para manter o layout limpo
                return null
              },
              renderDetails: (item, colors) => {
                // Show details only if token has balance
                if (item.valueUSD > 0) {
                  return [
                    {
                      label: 'Quantidade',
                      value: hideValue(apiService.formatTokenAmount(item.amount.toString()))
                    },
                    {
                      label: 'Preço',
                      value: hideValue(`$${apiService.formatUSD(item.priceUSD)}`)
                    },
                    {
                      label: 'Valor Total',
                      value: hideValue(`$${apiService.formatUSD(item.valueUSD)}`),
                      bold: true
                    }
                  ]
                }
                
                // Show minimal info for tokens without balance
                return [
                  {
                    label: 'Status',
                    value: 'Favorito sem saldo'
                  },
                  {
                    label: 'Info',
                    value: 'Token aguardando consulta de preço'
                  }
                ]
              },
              buttons: {
                primary: {
                  label: 'Ver Detalhes',
                  visible: (item) => item.valueUSD > 0 && !!item.exchangeId, // 🆕 Só mostra se tiver saldo
                  onPress: (item) => {
                    if (item.valueUSD > 0 && item.exchangeId) {
                      setSelectedTokenForDetails({
                        exchangeId: item.exchangeId,
                        symbol: item.symbol
                      })
                      setTokenModalVisible(true)
                    }
                  }
                },
                secondary: {
                  label: 'Negociar',
                  visible: (item) => item.valueUSD > 0 && !!item.exchangeId, // 🆕 Só mostra se tiver saldo
                  onPress: (item) => {
                    if (item.valueUSD > 0 && item.exchangeId) {
                      setSelectedTrade({
                        exchangeId: item.exchangeId,
                        exchangeName: item.exchangeName,
                        symbol: item.symbol,
                        currentPrice: item.priceUSD,
                        balance: {
                          token: item.free,
                          usdt: item.usdtBalance
                        }
                      })
                      setTradeModalVisible(true)
                    }
                  }
                }
              },
              getItemId: (item) => item.id,
              processingItemId: null
            }}
          />
        </View>
      )}

      {/* Modal de Criar Alerta */}
      {selectedToken && (
        <CreateAlertModal
          visible={alertModalVisible}
          onClose={() => {
            setAlertModalVisible(false)
            setTimeout(() => setSelectedToken(null), 300)
          }}
          symbol={selectedToken.symbol}
          currentPrice={selectedToken.price}
          exchangeId={selectedToken.exchangeId}
          exchangeName={selectedToken.exchangeName}
        />
      )}

      {/* Modal de Detalhes do Token */}
      {selectedTokenForDetails && (
        <TokenDetailsModal
          visible={tokenModalVisible}
          onClose={() => {
            setTokenModalVisible(false)
            setTimeout(() => setSelectedTokenForDetails(null), 300)
          }}
          exchangeId={selectedTokenForDetails.exchangeId}
          symbol={selectedTokenForDetails.symbol}
        />
      )}

      {/* Modal de Trade */}
      {selectedTrade && (
        <TradeModal
          visible={tradeModalVisible}
          onClose={() => {
            setTradeModalVisible(false)
            setTimeout(() => setSelectedTrade(null), 300)
          }}
          exchangeId={selectedTrade.exchangeId}
          exchangeName={selectedTrade.exchangeName}
          symbol={selectedTrade.symbol}
          currentPrice={selectedTrade.currentPrice}
          balance={selectedTrade.balance}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  variationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  variationText: {
    fontSize: 11,
    fontWeight: '600',
  },
  exchangeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  exchangeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  noBalanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  noBalanceText: {
    fontSize: 11,
    fontWeight: '500',
  },
})
