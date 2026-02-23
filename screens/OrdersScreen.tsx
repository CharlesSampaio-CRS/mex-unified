import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrders } from '@/contexts/OrdersContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';
import { Header } from '@/components/Header';
import { NotificationsModal } from '@/components/NotificationsModal';
import { OrderDetailsModal } from '@/components/order-details-modal';
import { OpenOrder } from '@/types/orders';
import { commonStyles } from '@/lib/layout';
import { typography, fontWeights } from '@/lib/typography';

export function OrdersScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { ordersByExchange, loading: ordersLoading, refreshing, refresh: refreshOrders, timestamp } = useOrders();
  const { hideValue } = usePrivacy();
  const { unreadCount } = useNotifications();
  
  const [search, setSearch] = useState('');
  const [selectedExchange, setSelectedExchange] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<'All' | 'buy' | 'sell'>('All');
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [orderDetailsVisible, setOrderDetailsVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OpenOrder | null>(null);
  const [cancellingOrderIds, setCancellingOrderIds] = useState<Set<string>>(new Set());

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
    await refreshOrders();
  }, [refreshOrders]);

  // Transform data - All orders from all exchanges
  const allOrdersSections = useMemo(() => {
    const sections = ordersByExchange.map(exchange => ({
      exchangeId: exchange.exchangeId,
      exchangeName: exchange.exchangeName,
      items: exchange.orders.map(order => ({
        ...order,
        id: order.id,
        exchangeId: exchange.exchangeId,
        exchangeName: exchange.exchangeName,
      }))
    }));

    return sections;
  }, [ordersByExchange]);

  // Apply filters
  const ordersSections = useMemo(() => {
    return allOrdersSections
      .map(section => {
        // Filter by exchange
        if (selectedExchange !== 'All' && section.exchangeId !== selectedExchange) {
          return null;
        }

        // Filter items within section
        const filteredItems = section.items.filter(item => {
          // Skip items without required fields
          if (!item || !item.side || !item.symbol) return false;
          
          // Filter by type
          if (selectedType !== 'All' && item.side !== selectedType) return false;
          
          // Search filter
          if (search) {
            const q = search.toLowerCase();
            return item.symbol.toLowerCase().includes(q);
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
      .filter(Boolean) as typeof allOrdersSections;
  }, [allOrdersSections, search, selectedType, selectedExchange]);

  // Get unique exchanges for filter
  const availableExchanges = useMemo(() => {
    const exchanges = allOrdersSections.map(section => ({
      id: section.exchangeId,
      name: section.exchangeName
    }));
    return exchanges;
  }, [allOrdersSections]);

  // Calculate totals (from filtered data)
  const totals = useMemo(() => {
    let totalOrders = 0;
    let totalValue = 0;

    ordersSections.forEach(section => {
      section.items.forEach(item => {
        if (!item || typeof item.price !== 'number' || typeof item.amount !== 'number') return;
        totalOrders++;
        totalValue += item.price * item.amount;
      });
    });

    return { totalOrders, totalValue };
  }, [ordersSections]);

  // Calculate global totals (all orders, unfiltered)
  const globalTotals = useMemo(() => {
    let totalOrders = 0;
    let totalValue = 0;

    allOrdersSections.forEach(section => {
      section.items.forEach(item => {
        if (!item || typeof item.price !== 'number' || typeof item.amount !== 'number') return;
        totalOrders++;
        totalValue += item.price * item.amount;
      });
    });

    return { totalOrders, totalValue };
  }, [allOrdersSections]);

  // Handle order selection
  const handleOrderPress = useCallback((order: OpenOrder) => {
    setSelectedOrder(order);
    setOrderDetailsVisible(true);
  }, []);

  // Handle cancel order
  const handleCancelOrder = useCallback(async (order: OpenOrder, exchangeId: string) => {
    if (cancellingOrderIds.has(order.id)) return;

    setCancellingOrderIds(prev => new Set(prev).add(order.id));

    try {
      const response = await apiService.cancelOrder(exchangeId, order.symbol, order.id);
      
      if (response.success) {
        // Refresh orders after successful cancellation
        await refreshOrders();
      }
    } catch (error) {
      console.error('Error canceling order:', error);
    } finally {
      setCancellingOrderIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(order.id);
        return newSet;
      });
    }
  }, [cancellingOrderIds, refreshOrders]);

  const loading = ordersLoading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        title="Orders"
        subtitle={`${globalTotals.totalOrders} ${globalTotals.totalOrders === 1 ? 'order' : 'orders'} • ${hideValue(`$${apiService.formatUSD(globalTotals.totalValue)}`)}`}
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
            placeholder="Buscar por símbolo..."
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

        {/* Type Filter */}
        <View style={styles.typeFilterRow}>
          <TouchableOpacity
            style={[
              styles.typeFilterChip,
              { 
                backgroundColor: selectedType === 'All' ? colors.primary : colors.surface,
                borderColor: selectedType === 'All' ? colors.primary : colors.border 
              }
            ]}
            onPress={() => setSelectedType('All')}
          >
            <Text style={[
              styles.typeFilterText,
              { color: selectedType === 'All' ? '#fff' : colors.text }
            ]}>
              Todas
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.typeFilterChip,
              { 
                backgroundColor: selectedType === 'buy' ? colors.success : colors.surface,
                borderColor: selectedType === 'buy' ? colors.success : colors.border 
              }
            ]}
            onPress={() => setSelectedType('buy')}
          >
            <Text style={[
              styles.typeFilterText,
              { color: selectedType === 'buy' ? '#fff' : colors.text }
            ]}>
              Compra
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.typeFilterChip,
              { 
                backgroundColor: selectedType === 'sell' ? colors.danger : colors.surface,
                borderColor: selectedType === 'sell' ? colors.danger : colors.border 
              }
            ]}
            onPress={() => setSelectedType('sell')}
          >
            <Text style={[
              styles.typeFilterText,
              { color: selectedType === 'sell' ? '#fff' : colors.text }
            ]}>
              Venda
            </Text>
          </TouchableOpacity>
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
                  backgroundColor: selectedExchange === 'All' ? colors.primary : colors.surface,
                  borderColor: selectedExchange === 'All' ? colors.primary : colors.border 
                }
              ]}
              onPress={() => setSelectedExchange('All')}
            >
              <Text style={[
                styles.exchangeFilterText,
                { color: selectedExchange === 'All' ? '#fff' : colors.text }
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
                    backgroundColor: selectedExchange === exchange.id ? colors.primary : colors.surface,
                    borderColor: selectedExchange === exchange.id ? colors.primary : colors.border 
                  }
                ]}
                onPress={() => setSelectedExchange(exchange.id)}
              >
                <Text style={[
                  styles.exchangeFilterText,
                  { color: selectedExchange === exchange.id ? '#fff' : colors.text }
                ]}>
                  {exchange.name || 'Exchange'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Results Count */}
        <View style={styles.resultsCount}>
          <Text style={[styles.resultsCountText, { color: colors.textSecondary }]}>
            {totals.totalOrders} {totals.totalOrders === 1 ? 'ordem encontrada' : 'ordens encontradas'}
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
        {loading && ordersSections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              Carregando ordens...
            </Text>
          </View>
        ) : ordersSections.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
              Nenhuma ordem encontrada
            </Text>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              {search || selectedType !== 'All' || selectedExchange !== 'All' 
                ? 'Tente ajustar os filtros' 
                : 'Você não possui ordens abertas no momento'}
            </Text>
          </View>
        ) : (
          <View style={styles.ordersListContainer}>
            {ordersSections.map((section) => (
              <View key={section.exchangeId} style={styles.exchangeSection}>
                {/* Exchange Header */}
                <View style={styles.exchangeHeader}>
                  <Text style={[styles.exchangeName, { color: colors.text }]}>
                    {section.exchangeName || 'Exchange'}
                  </Text>
                  <Text style={[styles.exchangeCount, { color: colors.textSecondary }]}>
                    {section.items.length} {section.items.length === 1 ? 'ordem' : 'ordens'}
                  </Text>
                </View>

                {/* Order Cards */}
                {section.items.map((item) => {
                  if (!item || !item.id || !item.side || !item.symbol) return null;
                  
                  const isCancelling = cancellingOrderIds.has(item.id);
                  const isBuy = item.side === 'buy';
                  const orderValue = (item.price || 0) * (item.amount || 0);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.orderCard,
                        { 
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          opacity: isCancelling ? 0.5 : 1
                        }
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleOrderPress(item)}
                      disabled={isCancelling}
                    >
                      {/* Card Header: Symbol + Type Badge */}
                      <View style={styles.cardHeader}>
                        <View style={styles.symbolSection}>
                          <View style={[
                            styles.typeIcon,
                            { backgroundColor: isBuy ? colors.successLight : colors.dangerLight }
                          ]}>
                            <Ionicons 
                              name={isBuy ? 'arrow-up' : 'arrow-down'} 
                              size={20} 
                              color={isBuy ? colors.success : colors.danger}
                            />
                          </View>
                          <View>
                            <Text style={[styles.orderSymbol, { color: colors.text }]}>
                              {item.symbol || 'N/A'}
                            </Text>
                            <View style={[
                              styles.typeBadge,
                              { backgroundColor: isBuy ? colors.successLight : colors.dangerLight }
                            ]}>
                              <Text style={[
                                styles.typeBadgeText,
                                { color: isBuy ? colors.success : colors.danger }
                              ]}>
                                {isBuy ? 'COMPRA' : 'VENDA'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.valueSection}>
                          <Text style={[styles.orderValue, { color: colors.text }]}>
                            {hideValue(`$${apiService.formatUSD(orderValue)}`)}
                          </Text>
                          <Text style={[styles.orderType, { color: colors.textSecondary }]}>
                            {item.type ? item.type.toUpperCase() : 'LIMIT'}
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
                            {hideValue(`$${apiService.formatUSD(item.price)}`)}
                          </Text>
                        </View>

                        <View style={styles.detailRow}>
                          <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                            Quantidade
                          </Text>
                          <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                            {hideValue(apiService.formatTokenAmount(item.amount.toString()))}
                          </Text>
                        </View>

                        {item.filled && item.filled > 0 && (
                          <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                              Executado
                            </Text>
                            <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                              {hideValue(apiService.formatTokenAmount(item.filled.toString()))}
                            </Text>
                          </View>
                        )}

                        {item.timestamp && (
                          <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                              Data
                            </Text>
                            <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                              {new Date(item.timestamp).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Card Footer: Cancel Button */}
                      <TouchableOpacity
                        style={[styles.cancelButton, { borderTopColor: colors.border }]}
                        onPress={() => handleCancelOrder(item, section.exchangeId)}
                        disabled={isCancelling}
                      >
                        {isCancelling ? (
                          <>
                            <Ionicons name="hourglass-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                              Cancelando...
                            </Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                            <Text style={[styles.cancelButtonText, { color: colors.danger }]}>
                              Cancelar Ordem
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          visible={orderDetailsVisible}
          onClose={() => {
            setOrderDetailsVisible(false);
            setTimeout(() => setSelectedOrder(null), 300);
          }}
          order={selectedOrder}
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
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
    paddingVertical: 0,
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeFilterChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeFilterText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
  },
  exchangeFilterScroll: {
    marginBottom: 8,
  },
  exchangeFilterContent: {
    paddingRight: 16,
    gap: 8,
  },
  exchangeFilterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  exchangeFilterText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
  },
  resultsCount: {
    paddingVertical: 4,
  },
  resultsCountText: {
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
  ordersListContainer: {
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
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
  },
  exchangeCount: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },
  orderCard: {
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
    marginRight: 8,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderSymbol: {
    fontSize: typography.caption,  // 14 - menor
    fontWeight: fontWeights.bold,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: 9,  // menor
    fontWeight: fontWeights.bold,
    letterSpacing: 0.3,
  },
  valueSection: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  orderValue: {
    fontSize: typography.caption,  // 14 - menor
    fontWeight: fontWeights.bold,
    marginBottom: 2,
  },
  orderType: {
    fontSize: typography.micro,  // 12
    fontWeight: fontWeights.medium,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: typography.micro,  // 12 - menor
    fontWeight: fontWeights.medium,
  },
  detailValue: {
    fontSize: typography.micro,  // 12 - menor
    fontWeight: fontWeights.semibold,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderTopWidth: 1,
  },
  cancelButtonText: {
    fontSize: typography.buttonSmall,
    fontWeight: fontWeights.bold,
  },
});
