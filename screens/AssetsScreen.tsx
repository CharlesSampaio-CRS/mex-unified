import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiService } from '@/services/api';
import { Header } from '@/components/Header';
import { NotificationsModal } from '@/components/NotificationsModal';
import { TokenDetailsModal } from '@/components/token-details-modal';
import { TradeModal } from '@/components/trade-modal';
import { getExchangeBalances, getExchangeId, getExchangeName } from '@/lib/exchange-helpers';
import { commonStyles } from '@/lib/layout';
import { typography, fontWeights } from '@/lib/typography';

export function AssetsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { data: balanceData, loading: balanceLoading, refresh: refreshBalance } = useBalance();
  const { hideValue } = usePrivacy();
  const { unreadCount } = useNotifications();
  
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<string>('All');
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
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

  const onNotificationsPress = useCallback(() => {
    setNotificationsModalVisible(true);
  }, []);

  const onProfilePress = useCallback(() => {
    navigation?.navigate('Settings', { initialTab: 'profile' });
  }, [navigation]);

  const onAlertsPress = useCallback(() => {
    navigation?.navigate('Favoritos');
  }, [navigation]);

  const onSettingsPress = useCallback(() => {
    navigation?.navigate('Settings');
  }, [navigation]);

  // Refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshBalance();
    await new Promise(resolve => setTimeout(resolve, 300));
    setRefreshing(false);
  }, [refreshBalance]);

  // Transform data to GenericItemList format - Grouped by Exchange
  const allAssetsSections = useMemo(() => {
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

  // Apply filters
  const assetsSections = useMemo(() => {
    return allAssetsSections
      .map(section => {
        // Filter by exchange
        if (selectedExchange !== 'All' && section.exchangeId !== selectedExchange) {
          return null;
        }

        // Filter items within section
        const filteredItems = section.items.filter(item => {
          // Hide zero balance
          if (hideZero && item.valueUSD === 0) return false;
          
          // Search filter
          if (search) {
            const q = search.toLowerCase();
            return item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
          }
          
          return true;
        });

        // Return section only if it has items after filtering
        if (filteredItems.length === 0) return null;

        return {
          ...section,
          items: filteredItems
        };
      })
      .filter(Boolean) as typeof allAssetsSections;
  }, [allAssetsSections, search, hideZero, selectedExchange]);

  // Get unique exchanges for filter
  const availableExchanges = useMemo(() => {
    const exchanges = allAssetsSections.map(section => ({
      id: section.exchangeId,
      name: section.exchangeName
    }));
    return exchanges;
  }, [allAssetsSections]);

  // Calculate totals (from filtered data)
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

  // Calculate global totals (all assets, unfiltered)
  const globalTotals = useMemo(() => {
    let totalValue = 0;
    let totalAssets = 0;

    allAssetsSections.forEach(section => {
      section.items.forEach(item => {
        if (item.valueUSD > 0) {
          totalValue += item.valueUSD;
          totalAssets++;
        }
      });
    });

    return { totalValue, totalAssets };
  }, [allAssetsSections]);

  const loading = balanceLoading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        title="Assets"
        subtitle={`${globalTotals.totalAssets} ${globalTotals.totalAssets === 1 ? 'asset' : 'assets'} • ${hideValue(`$${apiService.formatUSD(globalTotals.totalValue)}`)}`}
        onNotificationsPress={onNotificationsPress}
        onProfilePress={onProfilePress}
        onAlertsPress={onAlertsPress}
        onSettingsPress={onSettingsPress}
        unreadCount={unreadCount}
        navigation={navigation}
      />
      
      {/* Filters Section */}
      <View style={[styles.filtersContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar por nome ou símbolo..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Options Row */}
        <View style={styles.filterRow}>
          {/* Hide Zero Balance Toggle */}
          <View style={styles.toggleContainer}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Ocultar saldo zero</Text>
            <Switch
              value={hideZero}
              onValueChange={setHideZero}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={hideZero ? colors.primary : colors.textTertiary}
            />
          </View>
        </View>

        {/* Exchange Filter */}
        {availableExchanges.length > 1 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.exchangeFilterScroll}
            contentContainerStyle={styles.exchangeFilterContent}
          >
            <TouchableOpacity
              style={[
                styles.exchangeFilterChip,
                { 
                  backgroundColor: selectedExchange === 'All' ? colors.primary : colors.background,
                }
              ]}
              onPress={() => setSelectedExchange('All')}
            >
              <Text style={[
                styles.exchangeFilterText,
                { color: selectedExchange === 'All' ? '#fff' : colors.textSecondary }
              ]}>
                Todas
              </Text>
            </TouchableOpacity>
            {availableExchanges.map(exchange => (
              <TouchableOpacity
                key={exchange.id}
                style={[
                  styles.exchangeFilterChip,
                  { 
                    backgroundColor: selectedExchange === exchange.id ? colors.primary : colors.background,
                  }
                ]}
                onPress={() => setSelectedExchange(exchange.id)}
              >
                <Text style={[
                  styles.exchangeFilterText,
                  { color: selectedExchange === exchange.id ? '#fff' : colors.textSecondary }
                ]}>
                  {exchange.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Results Count */}
        <View style={styles.resultsCount}>
          <Text style={[styles.resultsCountText, { color: colors.textSecondary }]}>
            {totals.totalAssets} {totals.totalAssets === 1 ? 'ativo encontrado' : 'ativos encontrados'}
          </Text>
        </View>
      </View>
      
      <ScrollView
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
              {search || hideZero || selectedExchange !== 'All' 
                ? 'Tente ajustar os filtros' 
                : 'Conecte suas exchanges para ver seus assets'}
            </Text>
          </View>
        ) : (
          <View style={styles.assetsListContainer}>
            {assetsSections.map((section, sectionIndex) => (
              <View key={section.exchangeId} style={styles.exchangeSection}>
                {/* Exchange Header */}
                <View style={styles.exchangeHeader}>
                  <Text style={[styles.exchangeName, { color: colors.text }]}>
                    {section.exchangeName}
                  </Text>
                  <Text style={[styles.exchangeCount, { color: colors.textSecondary }]}>
                    {section.items.length} {section.items.length === 1 ? 'ativo' : 'ativos'}
                  </Text>
                </View>

                {/* Asset Cards */}
                {section.items.map((item, itemIndex) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.assetCard,
                      { 
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      }
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedTokenForDetails({
                        exchangeId: item.exchangeId,
                        symbol: item.symbol
                      });
                      setTokenModalVisible(true);
                    }}
                  >
                    {/* Card Header: Symbol + Value */}
                    <View style={styles.cardHeader}>
                      <View style={styles.symbolSection}>
                        <View style={[styles.symbolIcon, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.symbolIconText, { color: colors.primary }]}>
                            {item.symbol.charAt(0)}
                          </Text>
                        </View>
                        <View>
                          <Text style={[styles.assetSymbol, { color: colors.text }]}>
                            {item.symbol}
                          </Text>
                          <Text style={[styles.assetName, { color: colors.textSecondary }]}>
                            {item.name}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.valueSection}>
                        <Text style={[styles.assetValue, { color: colors.text }]}>
                          {hideValue(`$${apiService.formatUSD(item.valueUSD)}`)}
                        </Text>
                        <Text style={[styles.assetAmount, { color: colors.textSecondary }]}>
                          {hideValue(apiService.formatTokenAmount(item.amount.toString()))}
                        </Text>
                      </View>
                    </View>

                    {/* Card Body: Details */}
                    <View style={styles.cardBody}>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                          Preço
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                          {hideValue(`$${apiService.formatUSD(item.priceUSD)}`)}
                        </Text>
                      </View>
                      
                      {item.variation24h !== null && item.variation24h !== undefined && !item.isStablecoin && (
                        <View style={styles.detailRow}>
                          <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                            24h
                          </Text>
                          <View style={[
                            styles.variationBadgeInline,
                            { backgroundColor: item.variation24h >= 0 ? colors.successLight : colors.dangerLight }
                          ]}>
                            <Text style={[
                              styles.variationTextInline,
                              { color: item.variation24h >= 0 ? colors.success : colors.danger }
                            ]}>
                              {item.variation24h >= 0 ? '▲' : '▼'} {Math.abs(item.variation24h).toFixed(2)}%
                            </Text>
                          </View>
                        </View>
                      )}

                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                          Disponível
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                          {hideValue(apiService.formatTokenAmount(item.free.toString()))}
                        </Text>
                      </View>

                      {item.used > 0 && (
                        <View style={styles.detailRow}>
                          <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                            Bloqueado
                          </Text>
                          <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                            {hideValue(apiService.formatTokenAmount(item.used.toString()))}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Card Footer: Action Button */}
                    <TouchableOpacity
                      style={[styles.tradeButton, { borderTopColor: colors.border }]}
                      onPress={() => {
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
                      }}
                    >
                      <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                      <Text style={[styles.tradeButtonText, { color: colors.primary }]}>
                        Negociar
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
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
          onOrderCreated={() => {
            console.log('🎉 [AssetsScreen] Ordem criada - disparando atualização...');
            // ⚡ Dispara em background IMEDIATAMENTE
            refreshBalance().catch(err => {
              console.error('❌ [AssetsScreen] Erro:', err);
            });
            console.log('✅ [AssetsScreen] Atualização disparada!');
          }}
          onBalanceUpdate={() => {
            // ⚠️ NÃO FAZ NADA
            console.log('⏭️ [AssetsScreen] onBalanceUpdate pulado');
          }}
        />
      )}

      <NotificationsModal 
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: commonStyles.screenContainer,
  filtersContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.bodySmall,  // 15
    fontWeight: fontWeights.regular,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: typography.caption,  // 14
    fontWeight: fontWeights.medium,
  },
  exchangeFilterScroll: {
    marginBottom: 8,
  },
  exchangeFilterContent: {
    paddingRight: 16,
    gap: 6,
  },
  exchangeFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 6,
  },
  exchangeFilterText: {
    fontSize: typography.micro,  // 12 - menor e mais clean
    fontWeight: fontWeights.medium,
  },
  resultsCount: {
    paddingVertical: 4,
  },
  resultsCountText: {
    fontSize: typography.micro,  // 12
    fontWeight: fontWeights.medium,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyStateTitle: {
    fontSize: typography.h4,  // 18
    fontWeight: fontWeights.semibold,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: typography.caption,  // 14
    fontWeight: fontWeights.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  assetsListContainer: {
    padding: 16,
  },
  exchangeSection: {
    marginBottom: 24,
  },
  exchangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  exchangeName: {
    fontSize: typography.body,  // 16
    fontWeight: fontWeights.bold,
  },
  exchangeCount: {
    fontSize: typography.micro,  // 12
    fontWeight: fontWeights.medium,
  },
  assetCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
  },
  symbolSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  symbolIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolIconText: {
    fontSize: typography.h4,  // 18
    fontWeight: fontWeights.bold,
  },
  assetSymbol: {
    fontSize: typography.body,  // 16
    fontWeight: fontWeights.bold,
    marginBottom: 2,
  },
  assetName: {
    fontSize: typography.micro,  // 12
    fontWeight: fontWeights.medium,
  },
  valueSection: {
    alignItems: 'flex-end',
  },
  assetValue: {
    fontSize: typography.body,  // 16
    fontWeight: fontWeights.bold,
    marginBottom: 2,
  },
  assetAmount: {
    fontSize: typography.micro,  // 12
    fontWeight: fontWeights.regular,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: typography.tiny,  // 13
    fontWeight: fontWeights.medium,
  },
  detailValue: {
    fontSize: typography.tiny,  // 13
    fontWeight: fontWeights.semibold,
  },
  variationBadgeInline: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  variationTextInline: {
    fontSize: typography.micro,  // 12
    fontWeight: fontWeights.bold,
  },
  tradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderTopWidth: 1,
  },
  tradeButtonText: {
    fontSize: typography.buttonSmall,  // 14
    fontWeight: fontWeights.bold,
  },
  variationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  variationText: {
    fontSize: 11,
    fontWeight: fontWeights.semibold,
  },
});
