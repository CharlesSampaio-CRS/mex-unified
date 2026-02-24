import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useBalance } from '@/contexts/BalanceContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useNotifications } from '@/contexts/NotificationsContext';
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
  const { user } = useAuth();
  const { ordersByExchange, loading, refreshing, refresh, removeOrder } = useOrders();
  const { refresh: refreshBalance } = useBalance();
  const { hideValue } = usePrivacy();
  const { unreadCount } = useNotifications();
  
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'All' | 'buy' | 'sell'>('All');
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [orderDetailsVisible, setOrderDetailsVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OpenOrder | null>(null);
  const [cancellingOrderIds, setCancellingOrderIds] = useState<Set<string>>(new Set());

  const onNotificationsPress = useCallback(() => setNotificationsModalVisible(true), []);
  const onProfilePress = useCallback(() => navigation?.navigate('Settings', { initialTab: 'profile' }), [navigation]);
  const onSettingsPress = useCallback(() => navigation?.navigate('Settings'), [navigation]);

  // Filtra orders
  const filteredSections = useMemo(() => {
    if (!ordersByExchange || ordersByExchange.length === 0) return [];
    
    return ordersByExchange
      .map(exchange => {
        if (!exchange || !exchange.orders) return null;
        
        const filtered = exchange.orders.filter(order => {
          if (!order || !order.id || !order.symbol || !order.side) return false;
          
          // Filtro de tipo
          if (selectedType !== 'All' && order.side !== selectedType) return false;
          
          // Filtro de busca
          if (search) {
            const q = search.toLowerCase();
            const symbol = String(order.symbol || '').toLowerCase();
            if (!symbol.includes(q)) return false;
          }
          
          return true;
        });
        
        if (filtered.length === 0) return null;
        
        return {
          exchangeId: String(exchange.exchangeId || 'unknown'),
          exchangeName: String(exchange.exchangeName || 'Unknown'),
          orders: filtered
        };
      })
      .filter(Boolean) as Array<{ exchangeId: string; exchangeName: string; orders: OpenOrder[] }>;
  }, [ordersByExchange, search, selectedType]);

  // Totais
  const totals = useMemo(() => {
    let count = 0;
    let value = 0;
    
    filteredSections.forEach(section => {
      section.orders.forEach(order => {
        if (!order) return;
        const price = Number(order.price) || 0;
        const amount = Number(order.amount) || 0;
        const orderValue = price * amount;
        
        if (isFinite(orderValue) && !isNaN(orderValue)) {
          count++;
          value += orderValue;
        }
      });
    });
    
    return { count, value };
  }, [filteredSections]);

  const handleOrderPress = useCallback((order: OpenOrder) => {
    setSelectedOrder(order);
    setOrderDetailsVisible(true);
  }, []);

  const handleCancelOrder = useCallback(async (order: OpenOrder, exchangeId: string) => {
    const orderId = String(order.id || '');
    if (cancellingOrderIds.has(orderId)) return;

    setCancellingOrderIds(prev => new Set(prev).add(orderId));

    try {
      // Cancela ordem na API
      await apiService.cancelOrderByExchangeId(exchangeId, order.symbol, order.id);
      
      // ✅ REMOÇÃO OTIMISTA IMEDIATA: Remove da lista sem esperar refresh
      console.log('✅ [ORDERS-SCREEN] Ordem cancelada, removendo da lista:', orderId)
      removeOrder(orderId);
      
      // Remove do set de cancelamento
      setCancellingOrderIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
      
      // ✅ Atualiza balance/assets imediatamente (fundos liberados ao cancelar)
      refreshBalance().catch(console.error);
      
      // Sincroniza com backend em background (silencioso, não bloqueia UI)
      setTimeout(() => {
        refresh();
      }, 2000);
    } catch (error) {
      console.error('Erro ao cancelar ordem:', error);
      setCancellingOrderIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  }, [cancellingOrderIds, refresh, removeOrder, refreshBalance]);

  // Renderiza order card
  const renderOrderCard = useCallback((order: OpenOrder, exchangeId: string) => {
    if (!order || !order.id) return null;
    
    const orderId = String(order.id || '');
    const isCancelling = cancellingOrderIds.has(orderId);
    const isBuy = order.side === 'buy';
    
    const price = Number(order.price) || 0;
    const amount = Number(order.amount) || 0;
    const orderValue = price * amount;
    
    if (!isFinite(orderValue) || isNaN(orderValue)) return null;

    return (
      <TouchableOpacity
        key={orderId}
        style={[
          styles.orderCard,
          { 
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: isCancelling ? 0.5 : 1
          }
        ]}
        activeOpacity={0.7}
        onPress={() => handleOrderPress(order)}
        disabled={isCancelling}
      >
        {/* Header */}
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
                {String(order.symbol || 'N/A')}
              </Text>
              <View style={[
                styles.typeBadge,
                { backgroundColor: isBuy ? colors.successLight : colors.dangerLight }
              ]}>
                <Text style={[
                  styles.typeBadgeText,
                  { color: isBuy ? colors.success : colors.danger }
                ]}>
                  {String(isBuy ? 'COMPRA' : 'VENDA')}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.valueSection}>
            <Text style={[styles.orderValue, { color: colors.text }]}>
              {String(hideValue(`$${apiService.formatUSD(orderValue)}`))}
            </Text>
            <Text style={[styles.orderType, { color: colors.textSecondary }]}>
              {String((order.type || 'LIMIT').toString().toUpperCase())}
            </Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.cardBody}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
              Preço
            </Text>
            <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
              {String(hideValue(`$${apiService.formatUSD(price)}`))}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
              Quantidade
            </Text>
            <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
              {String(hideValue(apiService.formatTokenAmount(String(amount))))}
            </Text>
          </View>

          {order.filled && Number(order.filled) > 0 && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                Executado
              </Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                {String(hideValue(apiService.formatTokenAmount(String(order.filled))))}
              </Text>
            </View>
          )}

          {order.timestamp && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                Data
              </Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                {String(new Date(order.timestamp).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }))}
              </Text>
            </View>
          )}
        </View>

        {/* Cancel Button */}
        <TouchableOpacity
          style={[styles.cancelButton, { borderTopColor: colors.border }]}
          onPress={() => handleCancelOrder(order, exchangeId)}
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
  }, [cancellingOrderIds, colors, hideValue, handleOrderPress, handleCancelOrder]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        title="Orders"
        subtitle={`${String(totals.count)} ${totals.count === 1 ? 'order' : 'orders'} • ${String(hideValue(`$${apiService.formatUSD(totals.value)}`))}`}
        onNotificationsPress={onNotificationsPress}
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
        unreadCount={unreadCount}
        navigation={navigation}
      />
      
      {/* Filters */}
      <View style={[styles.filtersContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {/* Search */}
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
              { color: selectedType === 'All' ? colors.background : colors.text }
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
              { color: selectedType === 'buy' ? colors.background : colors.text }
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
              { color: selectedType === 'sell' ? colors.background : colors.text }
            ]}>
              Venda
            </Text>
          </TouchableOpacity>
        </View>

        {/* Results Count */}
        <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
          {String(totals.count)} {String(totals.count === 1 ? 'ordem encontrada' : 'ordens encontradas')}
        </Text>
      </View>
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {loading && filteredSections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              Carregando ordens...
            </Text>
          </View>
        ) : filteredSections.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
              Nenhuma ordem encontrada
            </Text>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              {search || selectedType !== 'All' 
                ? 'Tente ajustar os filtros' 
                : 'Você não possui ordens abertas'}
            </Text>
          </View>
        ) : (
          <View style={styles.ordersListContainer}>
            {filteredSections.map((section) => (
              <View key={section.exchangeId} style={styles.exchangeSection}>
                <View style={styles.exchangeHeader}>
                  <Text style={[styles.exchangeName, { color: colors.text }]}>
                    {String(section.exchangeName)}
                  </Text>
                  <Text style={[styles.exchangeCount, { color: colors.textSecondary }]}>
                    {String(section.orders.length)} {String(section.orders.length === 1 ? 'ordem' : 'ordens')}
                  </Text>
                </View>
                {section.orders.map(order => renderOrderCard(order, section.exchangeId))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

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
  resultsCount: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
    paddingVertical: 4,
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
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderSymbol: {
    fontSize: typography.caption,
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
    fontSize: 9,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.3,
  },
  valueSection: {
    alignItems: 'flex-end',
  },
  orderValue: {
    fontSize: typography.caption,
    fontWeight: fontWeights.bold,
    marginBottom: 2,
  },
  orderType: {
    fontSize: typography.micro,
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
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },
  detailValue: {
    fontSize: typography.micro,
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
