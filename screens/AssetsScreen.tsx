import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { apiService } from '@/services/api';
import { GenericItemList } from '@/components/GenericItemList';
import { TokenDetailsModal } from '@/components/token-details-modal';
import { TradeModal } from '@/components/trade-modal';
import { getExchangeBalances, getExchangeId, getExchangeName } from '@/lib/exchange-helpers';
import { typography, fontWeights } from '@/lib/typography';

export function AssetsScreen() {
  const { colors } = useTheme();
  const { data: balanceData, loading: balanceLoading, refresh: refreshBalance } = useBalance();
  const { hideValue } = usePrivacy();
  
  const [refreshing, setRefreshing] = useState(false);
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [selectedTokenForDetails, setSelectedTokenForDetails] = useState<{ exchangeId: string; symbol: string } | null>(null);
  const [tradeModalVisible, setTradeModalVisible] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<{
    exchangeId: string;
    exchangeName: string;
    symbol: string;
    currentPrice: number;
    balance: { token: number; usdt: number };
  } | null>(null);

  // Refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshBalance();
    await new Promise(resolve => setTimeout(resolve, 300));
    setRefreshing(false);
  }, [refreshBalance]);

  // Transform data to GenericItemList format - Grouped by Exchange
  const assetsSections = useMemo(() => {
    const exchangeMap = new Map<string, { exchangeId: string; exchangeName: string; items: any[] }>();

    if (balanceData?.exchanges) {
      balanceData.exchanges.forEach(exchange => {
        const balances = getExchangeBalances(exchange);
        const exchangeId = getExchangeId(exchange);
        const exchangeName = getExchangeName(exchange);
        
        Object.entries(balances).forEach(([symbol, token]) => {
          const symbolUpper = symbol.toUpperCase();
          const amount = parseFloat((token.amount || token.total || 0).toString());
          const free = parseFloat((token.free || 0).toString());
          const used = parseFloat((token.used || token.locked || 0).toString());
          const price = parseFloat((token.price_usd || 0).toString());
          const value = parseFloat((token.value_usd || token.usd_value || 0).toString());

          // Only add tokens with balance > 0
          if (value > 0) {
            const usdtData = balances['USDT'] || balances['usdt'];
            const usdtBalance = usdtData ? parseFloat((usdtData.free || 0).toString()) : 0;

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
            };

            if (!exchangeMap.has(exchangeId)) {
              exchangeMap.set(exchangeId, {
                exchangeId,
                exchangeName,
                items: []
              });
            }
            exchangeMap.get(exchangeId)!.items.push(tokenData);
          }
        });
      });
    }

    // Convert to array and sort sections by exchange name
    const sections = Array.from(exchangeMap.values()).map(section => ({
      ...section,
      loading: false,
      // Sort items by value (descending)
      items: section.items.sort((a, b) => b.valueUSD - a.valueUSD)
    })).sort((a, b) => a.exchangeName.localeCompare(b.exchangeName));

    return sections;
  }, [balanceData]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalValue = 0;
    let totalAssets = 0;

    assetsSections.forEach(section => {
      section.items.forEach(item => {
        totalValue += item.valueUSD;
        totalAssets++;
      });
    });

    return { totalValue, totalAssets };
  }, [assetsSections]);

  const loading = balanceLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with totals */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Meus Assets
        </Text>
        <View style={styles.totalsRow}>
          <View style={styles.totalItem}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              Total
            </Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {hideValue(`$${apiService.formatUSD(totals.totalValue)}`)}
            </Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              Assets
            </Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {totals.totalAssets}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {loading && assetsSections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              Carregando assets...
            </Text>
          </View>
        ) : assetsSections.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
              Nenhum asset encontrado
            </Text>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              Conecte suas exchanges para ver seus assets
            </Text>
          </View>
        ) : (
          <View style={{ padding: 16 }}>
            <GenericItemList
              sections={assetsSections}
              config={{
                renderBadge: (item, colors) => {
                  if (item.variation24h !== null && item.variation24h !== undefined && !item.isStablecoin) {
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
                    );
                  }
                  return null;
                },
                renderDetails: (item, colors) => [
                  {
                    label: 'Disponível',
                    value: hideValue(apiService.formatTokenAmount(item.free.toString()))
                  },
                  {
                    label: 'Bloqueado',
                    value: hideValue(apiService.formatTokenAmount(item.used.toString()))
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
                ],
                buttons: {
                  primary: {
                    label: 'Ver Detalhes',
                    visible: (item) => !!item.exchangeId,
                    onPress: (item) => {
                      if (item.exchangeId) {
                        setSelectedTokenForDetails({
                          exchangeId: item.exchangeId,
                          symbol: item.symbol
                        });
                        setTokenModalVisible(true);
                      }
                    }
                  },
                  secondary: {
                    label: 'Negociar',
                    visible: (item) => !!item.exchangeId,
                    onPress: (item) => {
                      if (item.exchangeId) {
                        setSelectedTrade({
                          exchangeId: item.exchangeId,
                          exchangeName: item.exchangeName,
                          symbol: item.symbol,
                          currentPrice: item.priceUSD,
                          balance: {
                            token: item.free,
                            usdt: item.usdtBalance
                          }
                        });
                        setTradeModalVisible(true);
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
      </ScrollView>

      {/* Modal de Detalhes do Token */}
      {selectedTokenForDetails && (
        <TokenDetailsModal
          visible={tokenModalVisible}
          onClose={() => {
            setTokenModalVisible(false);
            setTimeout(() => setSelectedTokenForDetails(null), 300);
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
            setTradeModalVisible(false);
            setTimeout(() => setSelectedTrade(null), 300);
          }}
          exchangeId={selectedTrade.exchangeId}
          exchangeName={selectedTrade.exchangeName}
          symbol={selectedTrade.symbol}
          currentPrice={selectedTrade.currentPrice}
          balance={selectedTrade.balance}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: typography.h2,
    fontWeight: fontWeights.bold,
    marginBottom: 12,
  },
  totalsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  totalItem: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: fontWeights.regular,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: fontWeights.semibold,
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
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
});
