import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Text as SvgText, Line } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHeader } from '@/contexts/HeaderContext';
import { apiService } from '@/services/api';
import { NotificationsModal } from '@/components/NotificationsModal';
import { TokenDetailsModal } from '@/components/token-details-modal';
import { TradeModal } from '@/components/trade-modal';
import { getExchangeBalances, getExchangeId, getExchangeName, capitalizeExchangeName } from '@/lib/exchange-helpers';
import { getExchangeLogo } from '@/lib/exchange-logos';
import { commonStyles } from '@/lib/layout';
import { typography, fontWeights } from '@/lib/typography';
import { AnimatedLogoIcon } from '../components/AnimatedLogoIcon';
import { CustomRefreshIndicator } from '../components/CustomRefreshIndicator';

export function AssetsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { data: balanceData, loading: balanceLoading, refresh: refreshBalance } = useBalance();
  const { hideValue, hideZeroBalances: hideZero, toggleHideZeroBalances } = usePrivacy();
  const { unreadCount } = useNotifications();
  const { refresh: refreshOrders } = useOrders();
  
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
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
    balance: { token: number; usdt: number; brl?: number };
  } | null>(null);

  const onNotificationsPress = useCallback(() => {
    setNotificationsModalVisible(true);
  }, []);

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

          const brlData = balances['BRL'] || balances['brl'];
          const brlBalance = brlData ? parseFloat((brlData.free || 0).toString()) : 0;

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
            brlBalance,
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

  // Define o Header global para esta tela
  const assetsSubtitle = `${String(globalTotals.totalAssets)} ${String(globalTotals.totalAssets === 1 ? 'asset' : 'assets')}`;
  useHeader({
    title: 'Assets',
    subtitle: assetsSubtitle,
    onNotificationsPress,
    unreadCount,
  });

  const loading = balanceLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
              <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
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
                  {capitalizeExchangeName(exchange.name)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Results Count + Hide Zero Toggle */}
        <View style={styles.resultsCount}>
          <Text style={[styles.resultsCountText, { color: colors.textSecondary }]}>
            {totals.totalAssets} {totals.totalAssets === 1 ? 'ativo encontrado' : 'ativos encontrados'}
          </Text>
          <TouchableOpacity
            style={[styles.zeroToggle, {
              backgroundColor: hideZero ? `${colors.primary}12` : colors.surface,
              borderColor: hideZero ? `${colors.primary}40` : colors.border,
            }]}
            onPress={toggleHideZeroBalances}
            activeOpacity={0.7}
          >
            {hideZero ? (
              <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <SvgText x="12" y="17" textAnchor="middle" fontSize="17" fontWeight="bold" fill={colors.primary}>0</SvgText>
                <Line x1="6" y1="18" x2="18" y2="6" stroke={colors.primary} strokeWidth="2.5" strokeLinecap="round" />
              </Svg>
            ) : (
              <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <SvgText x="12" y="17" textAnchor="middle" fontSize="17" fontWeight="bold" fill={colors.textSecondary}>0</SvgText>
              </Svg>
            )}
            <Text style={[styles.zeroToggleText, { color: hideZero ? colors.primary : colors.textSecondary }]}>
              {hideZero ? 'Zeros ocultos' : 'Mostrar zeros'}
            </Text>
          </TouchableOpacity>
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
            // Custom indicator
            // @ts-ignore
            customIndicator={<CustomRefreshIndicator />}
          />
        }
      >
        {loading && assetsSections.length === 0 ? (
          <View style={styles.emptyState}>
            <AnimatedLogoIcon size={40} />
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
                {/* Exchange Header - mesmo padrão dos Orders */}
                <View style={[styles.exchangeCardHeader, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={styles.exchangeCardLeft}>
                    <View style={styles.exchangeLogoContainer}>
                      <Image 
                        source={getExchangeLogo(section.exchangeName)} 
                        style={styles.exchangeCardLogo}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={[styles.exchangeCardName, { color: colors.text }]}>
                      {String(section.exchangeName || 'Unknown')}
                    </Text>
                  </View>
                  <Text style={[styles.exchangeCardCount, { color: colors.textSecondary }]}>
                    {String(section.items.length)} {String(section.items.length === 1 ? 'ativo' : 'ativos')}
                  </Text>
                </View>

                {/* Asset Cards - Compact */}
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
                    {/* Linha única compacta - mesmo padrão Orders */}
                    <View style={styles.cardRow}>
                      {/* Lado esquerdo: Ícone + Info */}
                      <View style={styles.cardLeft}>
                        <View style={[styles.typeIcon, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.typeIconText, { color: colors.primary }]}>
                            {String((item.symbol || '?').charAt(0))}
                          </Text>
                        </View>
                        <View style={styles.cardInfo}>
                          <View style={styles.cardInfoTop}>
                            <Text style={[styles.assetSymbol, { color: colors.text }]} numberOfLines={1}>
                              {String(item.symbol || 'Unknown')}
                            </Text>
                            {item.variation24h !== null && item.variation24h !== undefined && !item.isStablecoin && (
                              <View style={[
                                styles.sideBadge,
                                { backgroundColor: item.variation24h >= 0 ? colors.successLight : colors.dangerLight }
                              ]}>
                                <Text style={[
                                  styles.sideBadgeText,
                                  { color: item.variation24h >= 0 ? colors.success : colors.danger }
                                ]}>
                                  {String(item.variation24h >= 0 ? '▲' : '▼')}{String(Math.abs(item.variation24h || 0).toFixed(1))}%
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.cardSubtext, { color: colors.textTertiary }]} numberOfLines={1}>
                            {String(hideValue(`${apiService.formatTokenAmount(String(item.amount || 0))} @ $${apiService.formatUSD(item.priceUSD || 0)}`))}
                          </Text>
                        </View>
                      </View>

                      {/* Lado direito: Valor + Amount */}
                      <View style={styles.cardRight}>
                        <Text style={[styles.assetValue, { color: colors.text }]} numberOfLines={1}>
                          {String(hideValue(`$${apiService.formatUSD(item.valueUSD || 0)}`))}
                        </Text>
                        <Text style={[styles.cardSubtext, { color: colors.textTertiary }]} numberOfLines={1}>
                          {String(hideValue(apiService.formatTokenAmount(String(item.amount || 0))))}
                        </Text>
                      </View>
                    </View>

                    {/* Botão Negociar compacto */}
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
                            usdt: item.usdtBalance,
                            brl: item.brlBalance
                          }
                        });
                        setTradeModalVisible(true);
                      }}
                    >
                      <Ionicons name="swap-horizontal-outline" size={14} color={colors.primary} />
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
          onBalanceUpdate={() => {
            refreshBalance()
          }}
          onOrderCreated={() => {
            refreshBalance()
            refreshOrders()
          }}
        />
      )}

      <NotificationsModal 
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />
    </View>
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
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
    paddingVertical: 0,
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
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },
  resultsCount: {
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsCountText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },
  zeroToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  zeroToggleText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyStateTitle: {
    fontSize: typography.h4,
    fontWeight: fontWeights.semibold,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  assetsListContainer: {
    padding: 16,
  },
  exchangeSection: {
    marginBottom: 20,
  },
  // Exchange header card (mesmo padrão dos Orders)
  exchangeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  exchangeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exchangeCardLogo: {
    width: '100%',
    height: '100%',
  },
  exchangeLogoContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 2,
  },
  exchangeCardName: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
  },
  exchangeCardCount: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },
  // Card compacto - mesmo padrão Orders
  assetCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.bold,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardInfoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assetSymbol: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
    flexShrink: 1,
  },
  sideBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  sideBadgeText: {
    fontSize: typography.badge,
    fontWeight: fontWeights.bold,
  },
  cardSubtext: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
  },
  cardRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  assetValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
  },
  tradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 5,
    borderTopWidth: 1,
  },
  tradeButtonText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.semibold,
  },
});
