import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, TextInput, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Text as SvgText, Line } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHeader } from '@/contexts/HeaderContext';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { useAlerts } from '@/contexts/AlertsContext';
import { apiService } from '@/services/api';
import { NotificationsModal } from '@/components/NotificationsModal';
import { TokenDetailsModal } from '@/components/token-details-modal';
import { TradeModal } from '@/components/trade-modal';
import { CreateAlertModal } from '@/components/create-price-alert-modal';
import { getExchangeBalances, getExchangeId, getExchangeName, capitalizeExchangeName } from '@/lib/exchange-helpers';
import { getExchangeLogo } from '@/lib/exchange-logos';
import { commonStyles } from '@/lib/layout';
import { typography, fontWeights } from '@/lib/typography';

export function AssetsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { data: balanceData, loading: balanceLoading, refresh: refreshBalance, refreshing } = useBalance();
  const { hideValue, hideZeroBalances: hideZero, toggleHideZeroBalances } = usePrivacy();
  const { unreadCount } = useNotifications();
  const { refresh: refreshOrders } = useOrders();
  const { addToken, removeToken, isWatching } = useWatchlist();
  const { getAlertsForToken } = useAlerts();
  
  const [search, setSearch] = useState('');
  const [selectedExchange, setSelectedExchange] = useState<string>('All');
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [selectedTokenForDetails, setSelectedTokenForDetails] = useState<{ exchangeId: string; symbol: string } | null>(null);
  const [tradeModalVisible, setTradeModalVisible] = useState(false);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [selectedTokenForAlert, setSelectedTokenForAlert] = useState<{
    symbol: string;
    price: number;
    exchangeId: string;
    exchangeName: string;
  } | null>(null);
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

  // Toggle favorito (watchlist)
  const handleToggleFavorite = useCallback(async (symbol: string) => {
    if (isWatching(symbol)) {
      await removeToken(symbol);
    } else {
      await addToken(symbol);
    }
  }, [isWatching, addToken, removeToken]);

  // Refresh — usa refreshing gerenciado pelo BalanceContext
  const handleRefresh = useCallback(async () => {
    await refreshBalance();
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
        if (selectedExchange !== 'All' && selectedExchange !== 'favorites' && section.exchangeId !== selectedExchange) {
          return null;
        }

        // Filter items within section
        const filteredItems = section.items.filter(item => {
          // Hide zero balance
          if (hideZero && item.valueUSD === 0) return false;

          // Favorites filter
          if (selectedExchange === 'favorites' && !isWatching(item.symbol)) return false;
          
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
  }, [allAssetsSections, search, hideZero, selectedExchange, isWatching]);

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
            {/* Favoritos chip */}
            <TouchableOpacity
              style={[
                styles.exchangeFilterChip,
                { 
                  backgroundColor: selectedExchange === 'favorites' ? '#F59E0B' : colors.background,
                }
              ]}
              onPress={() => setSelectedExchange('favorites')}
            >
              <Text style={[
                styles.exchangeFilterText,
                { color: selectedExchange === 'favorites' ? '#fff' : colors.textSecondary }
              ]}>
                Favoritos
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {loading && assetsSections.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" />
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

                {/* Asset Cards */}
                {section.items.map((item, itemIndex) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.assetCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedTokenForDetails({ exchangeId: item.exchangeId, symbol: item.symbol });
                      setTokenModalVisible(true);
                    }}
                  >
                    {/* Linha 1: símbolo (esquerda) + preço de mercado (direita) */}
                    <View style={styles.cardRow1}>
                      <Text style={[styles.assetSymbol, { color: colors.text }]} numberOfLines={1}>
                        {String(item.symbol || 'Unknown')}
                      </Text>
                      <Text style={[styles.assetPrice, { color: colors.text }]} numberOfLines={1}>
                        {item.priceUSD > 0
                          ? `$${item.priceUSD < 0.01 ? item.priceUSD.toFixed(6) : item.priceUSD < 1 ? item.priceUSD.toFixed(4) : item.priceUSD.toFixed(2)}`
                          : '—'}
                      </Text>
                    </View>

                    {/* Linha 2: quantidade · valor USD holdings · variação% */}
                    <View style={styles.cardRow2}>
                      <Text style={[styles.cardSubtext, { color: colors.textSecondary }]} numberOfLines={1}>
                        {hideValue(
                          `${parseFloat(String(item.amount || 0)) < 0.0001
                            ? parseFloat(String(item.amount || 0)).toFixed(8)
                            : parseFloat(String(item.amount || 0)) < 1
                              ? parseFloat(String(item.amount || 0)).toFixed(4)
                              : parseFloat(String(item.amount || 0)).toFixed(2)
                          } ${item.symbol}`
                        )}
                      </Text>
                      <View style={styles.cardRow2Right}>
                        <Text style={[styles.assetValue, { color: colors.textSecondary }]} numberOfLines={1}>
                          {hideValue(`$${apiService.formatUSD(item.valueUSD || 0)}`)}
                        </Text>
                        {item.variation24h !== null && item.variation24h !== undefined && !item.isStablecoin ? (
                          <Text style={[styles.variationText, {
                            color: item.variation24h >= 0 ? colors.success : colors.danger
                          }]} numberOfLines={1}>
                            {item.variation24h >= 0 ? '+' : ''}{String(item.variation24h.toFixed(2))}%
                          </Text>
                        ) : (
                          <Text style={[styles.variationText, { color: colors.textTertiary, opacity: 0.4 }]}>—</Text>
                        )}
                      </View>
                    </View>

                    {/* Action Bar: Favorito | Alerta | Negociar */}
                    <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
                      {/* Favorito */}
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleToggleFavorite(item.symbol)}
                        activeOpacity={0.6}
                      >
                        <Ionicons
                          name={isWatching(item.symbol) ? 'star' : 'star-outline'}
                          size={15}
                          color={isWatching(item.symbol) ? '#F59E0B' : colors.textSecondary}
                        />
                        <Text style={[styles.actionButtonText, { color: isWatching(item.symbol) ? '#F59E0B' : colors.textSecondary }]}>
                          {isWatching(item.symbol) ? 'Favorito' : 'Favoritar'}
                        </Text>
                      </TouchableOpacity>

                      <View style={[styles.actionSeparator, { backgroundColor: colors.border }]} />

                      {/* Alerta */}
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          setSelectedTokenForAlert({ symbol: item.symbol, price: item.priceUSD, exchangeId: item.exchangeId, exchangeName: item.exchangeName });
                          setAlertModalVisible(true);
                        }}
                        activeOpacity={0.6}
                      >
                        <Ionicons
                          name={getAlertsForToken(item.symbol, item.exchangeId).length > 0 ? 'notifications' : 'notifications-outline'}
                          size={15}
                          color={getAlertsForToken(item.symbol, item.exchangeId).length > 0 ? colors.primary : colors.textSecondary}
                        />
                        <Text style={[styles.actionButtonText, { color: getAlertsForToken(item.symbol, item.exchangeId).length > 0 ? colors.primary : colors.textSecondary }]}>
                          Alerta
                        </Text>
                      </TouchableOpacity>

                      <View style={[styles.actionSeparator, { backgroundColor: colors.border }]} />

                      {/* Negociar */}
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          setSelectedTrade({ exchangeId: item.exchangeId, exchangeName: item.exchangeName, symbol: item.symbol, currentPrice: item.priceUSD, balance: { token: item.free, usdt: item.usdtBalance, brl: item.brlBalance } });
                          setTradeModalVisible(true);
                        }}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="swap-horizontal-outline" size={15} color={colors.primary} />
                        <Text style={[styles.actionButtonText, { color: colors.primary, fontWeight: fontWeights.bold }]}>
                          Negociar
                        </Text>
                      </TouchableOpacity>
                    </View>
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

      {/* Modal de Criar Alerta (por token) */}
      {selectedTokenForAlert && (
        <CreateAlertModal
          visible={alertModalVisible}
          onClose={() => {
            setAlertModalVisible(false);
            setTimeout(() => setSelectedTokenForAlert(null), 300);
          }}
          symbol={selectedTokenForAlert.symbol}
          currentPrice={selectedTokenForAlert.price}
          exchangeId={selectedTokenForAlert.exchangeId}
          exchangeName={selectedTokenForAlert.exchangeName}
        />
      )}
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
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 0,
  },
  // Linha 1: símbolo (esquerda) + preço de mercado (direita)
  cardRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  // Linha 2: quantidade · valor holdings · variação%
  cardRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardRow2Right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  tokenIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tokenIconText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardSubtext: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
  },
  cardRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 3,
  },
  assetSymbol: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
  },
  assetPrice: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  assetValue: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.medium,
  },
  variationText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.bold,
  },
  // Action bar com 3 botões
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.semibold,
  },
  actionSeparator: {
    width: 1,
    height: '60%',
  },
});
