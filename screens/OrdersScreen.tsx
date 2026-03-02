import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useBalance } from '@/contexts/BalanceContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';
import { notify } from '@/services/notify';
import { useHeader } from '@/contexts/HeaderContext';
import { NotificationsModal } from '@/components/NotificationsModal';
import { OrderDetailsModal } from '@/components/order-details-modal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { OpenOrder } from '@/types/orders';
import { commonStyles } from '@/lib/layout';
import { typography, fontWeights } from '@/lib/typography';
import { getExchangeLogo } from '@/lib/exchange-logos';

// Sub-componente com animação piscante para ordens sendo canceladas
function AnimatedOrderCard({ 
  children, 
  isCancelling, 
  style 
}: { 
  key?: string;
  children: React.ReactNode; 
  isCancelling: boolean; 
  style: any; 
}) {
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isCancelling) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 0.7,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      blinkAnim.setValue(1);
    }
  }, [isCancelling]);

  return (
    <Animated.View style={[style, { opacity: isCancelling ? blinkAnim : 1 }]}>
      {children}
    </Animated.View>
  );
}

export function OrdersScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { ordersByExchange, loading, refreshing, refresh, removeOrder, recentlyAddedIds } = useOrders();
  const { data: balanceData, refresh: refreshBalance } = useBalance();
  const { hideValue } = usePrivacy();
  const { unreadCount, addNotification } = useNotifications();
  
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'All' | 'buy' | 'sell'>('All');
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [orderDetailsVisible, setOrderDetailsVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OpenOrder | null>(null);
  const [cancellingOrderIds, setCancellingOrderIds] = useState<Set<string>>(new Set());
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<{ order: OpenOrder; exchangeId: string } | null>(null);

  const onNotificationsPress = useCallback(() => setNotificationsModalVisible(true), []);

  // 💰 Mapa de preços atuais dos tokens (para calcular PnL)
  const tokenPrices = useMemo(() => {
    const prices: Record<string, number> = {};
    if (!balanceData?.exchanges) return prices;

    for (const exchange of balanceData.exchanges) {
      if (!exchange.success) continue;

      // Nova estrutura: balances (Record<string, Balance>)
      if (exchange.balances) {
        for (const [symbol, balance] of Object.entries(exchange.balances)) {
          const bal = balance as any;
          const total = parseFloat((bal.total || 0).toString());
          const usdValue = parseFloat((bal.usd_value || bal.value_usd || 0).toString());
          if (total > 0 && usdValue > 0) {
            const pricePerUnit = usdValue / total;
            const sym = symbol.toUpperCase();
            // Usa o melhor preço (mais atualizado) entre exchanges
            if (!prices[sym] || pricePerUnit > 0) {
              prices[sym] = pricePerUnit;
            }
          }
        }
      }

      // Estrutura antiga: tokens (Record<string, Token>)
      if (exchange.tokens) {
        for (const [symbol, token] of Object.entries(exchange.tokens)) {
          const tok = token as any;
          const priceUsd = parseFloat((tok.price_usd || 0).toString());
          if (priceUsd > 0) {
            prices[symbol.toUpperCase()] = priceUsd;
          }
        }
      }
    }

    return prices;
  }, [balanceData]);

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

  // Define o Header global para esta tela
  const ordersSubtitle = `${String(totals.count)} open ${totals.count === 1 ? 'order' : 'orders'}`;
  useHeader({
    title: 'Orders',
    subtitle: ordersSubtitle,
    onNotificationsPress,
    unreadCount,
  });

  const handleOrderPress = useCallback((order: OpenOrder) => {
    setSelectedOrder(order);
    setOrderDetailsVisible(true);
  }, []);

  // Abre modal de confirmação para cancelar
  const handleCancelOrder = useCallback((order: OpenOrder, exchangeId: string) => {
    const orderId = String(order.id || '');
    if (cancellingOrderIds.has(orderId)) return;
    setOrderToCancel({ order, exchangeId });
    setCancelConfirmVisible(true);
  }, [cancellingOrderIds]);

  // Executa o cancelamento após confirmação
  const executeCancelOrder = useCallback(async () => {
    if (!orderToCancel) return;
    const { order, exchangeId } = orderToCancel;
    const orderId = String(order.id || '');
    // ✅ Usa exchange_order_id (ID real da exchange) para cancelar na API
    const exchangeOrderId = String(order.exchange_order_id || order.id || '');

    setCancelConfirmVisible(false);
    setOrderToCancel(null);
    setCancellingOrderIds(prev => new Set(prev).add(orderId));

    try {
      // Cancela ordem na API usando o ID da exchange
      console.log('🔍 [ORDERS-SCREEN] Cancelando ordem:', { orderId, exchangeOrderId, symbol: order.symbol, exchangeId });
      await apiService.cancelOrderByExchangeId(exchangeId, order.symbol, exchangeOrderId);
      
      // ✅ REMOÇÃO OTIMISTA IMEDIATA: Remove da lista sem esperar refresh
      console.log('✅ [ORDERS-SCREEN] Ordem cancelada, removendo da lista:', orderId)
      removeOrder(orderId);
      
      // 🔔 NOTIFICAÇÃO: Ordem cancelada com sucesso
      const isBuy = order.side === 'buy';
      notify.orderCancelled(addNotification, {
        symbol: order.symbol,
        side: order.side || 'buy',
        amount: Number(order.amount || 0),
        type: order.type,
        orderId: exchangeOrderId,
      });
      
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
    } catch (error: any) {
      console.error('Erro ao cancelar ordem:', error);
      notify.orderError(addNotification, {
        symbol: order.symbol || '',
        action: 'Cancelar Ordem',
        error: error.message || 'Erro desconhecido',
        orderId: exchangeOrderId,
      });
      setCancellingOrderIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  }, [orderToCancel, refresh, removeOrder, refreshBalance, addNotification]);

  // Renderiza order row (compact inline, como os asset rows)
  const renderOrderRow = useCallback((order: OpenOrder, exchangeId: string, index: number, total: number) => {
    if (!order || !order.id) return null;
    
    const orderId = String(order.id || '');
    const isCancelling = cancellingOrderIds.has(orderId);
    const isRecentlyAdded = recentlyAddedIds.has(orderId);
    const isAnimating = isCancelling || isRecentlyAdded;
    const isBuy = order.side === 'buy';
    
    const price = Number(order.price) || 0;
    const amount = Number(order.amount) || 0;
    const orderValue = price * amount;
    
    // Determina casas decimais adequadas para o preço
    const priceDecimals = price < 0.01 ? 8 : price < 1 ? 6 : price < 100 ? 4 : 2;

    // 💰 Calcula PnL estimado (diferença entre preço da ordem e preço atual)
    const baseToken = (order.symbol || '').split('/')[0]?.toUpperCase();
    const currentPrice = baseToken ? (tokenPrices[baseToken] || 0) : 0;
    const currentValue = currentPrice * amount;
    const pnlValue = currentPrice > 0
      ? (isBuy ? currentValue - orderValue : orderValue - currentValue)
      : 0;
    const pnlPercent = currentPrice > 0 && currentValue > 0
      ? (isBuy 
          ? ((currentPrice - price) / price) * 100
          : ((price - currentPrice) / currentPrice) * 100)
      : 0;
    const hasPnl = currentPrice > 0 && Math.abs(pnlValue) > 0.001;
    const isPnlPositive = pnlValue >= 0;
    
    if (!isFinite(orderValue) || isNaN(orderValue)) return null;

    return (
      <AnimatedOrderCard
        key={orderId}
        isCancelling={isAnimating}
        style={[
          styles.orderItemRow,
          { borderBottomColor: colors.border },
          index === total - 1 && { borderBottomWidth: 0 },
        ]}
      >
        <TouchableOpacity
          style={styles.orderRowTouchable}
          activeOpacity={0.7}
          onPress={() => handleOrderPress(order)}
          disabled={isCancelling}
        >
          {/* Symbol */}
          <View style={styles.orderSymbolContainer}>
            <Text style={[styles.orderSymbolText, { color: colors.text }]} numberOfLines={1}>
              {String(order.symbol || 'N/A')}
            </Text>
          </View>

          {/* Side badge (COMPRA/VENDA) */}
          <View style={[styles.orderSideBadge, { 
            backgroundColor: (isBuy ? colors.success : colors.danger) + '15' 
          }]}>
            <Text style={[styles.orderSideText, { 
              color: isBuy ? colors.success : colors.danger 
            }]}>
              {String(isBuy ? 'BUY' : 'SELL')}
            </Text>
          </View>

          {/* PnL badge (se houver) */}
          {hasPnl && (
            <View style={[styles.orderPnlBadge, {
              backgroundColor: (isPnlPositive ? colors.success : colors.danger) + '10'
            }]}>
              <Text style={[styles.orderPnlText, {
                color: isPnlPositive ? colors.success : colors.danger
              }]}>
                {String(isPnlPositive ? '+' : '')}{String(pnlPercent.toFixed(1))}%
              </Text>
            </View>
          )}

          {/* Price + Value inline */}
          <View style={styles.orderValuesContainer}>
            <Text style={[styles.orderPriceText, { color: colors.textSecondary }]} numberOfLines={1}>
              {String(hideValue(`$${apiService.formatUSD(price, priceDecimals)}`))}
            </Text>
            <Text style={[styles.orderValueText, { color: colors.text }]} numberOfLines={1}>
              {String(hideValue(`$${apiService.formatUSD(orderValue, orderValue < 1 ? 4 : 2)}`))}
            </Text>
          </View>

          {/* Cancel icon */}
          <TouchableOpacity
            style={styles.orderCancelIcon}
            onPress={(e) => {
              e.stopPropagation?.();
              handleCancelOrder(order, exchangeId);
            }}
            disabled={isCancelling}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons 
              name={isCancelling ? 'hourglass-outline' : 'close-circle-outline'} 
              size={16} 
              color={isCancelling ? colors.textSecondary : colors.danger + '80'} 
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </AnimatedOrderCard>
    );
  }, [cancellingOrderIds, recentlyAddedIds, colors, hideValue, handleOrderPress, handleCancelOrder, tokenPrices]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
                <View style={[styles.exchangeCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  {/* Exchange Header */}
                  <View style={[styles.exchangeCardHeader, { borderBottomColor: colors.border }]}>
                    <View style={styles.exchangeCardLeft}>
                      <Image 
                        source={getExchangeLogo(section.exchangeName)} 
                        style={styles.exchangeCardLogo}
                        resizeMode="contain"
                      />
                      <Text style={[styles.exchangeCardName, { color: colors.text }]}>
                        {String(section.exchangeName)}
                      </Text>
                    </View>
                    <Text style={[styles.exchangeCardCount, { color: colors.textSecondary }]}>
                      {String(section.orders.length)} {String(section.orders.length === 1 ? 'ordem' : 'ordens')}
                    </Text>
                  </View>
                  {/* Order Rows */}
                  <View style={styles.exchangeCardBody}>
                    {section.orders.map((order, index) => renderOrderRow(order, section.exchangeId, index, section.orders.length))}
                  </View>
                </View>
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

      {/* Modal de Confirmação de Cancelamento */}
      <ConfirmModal
        visible={cancelConfirmVisible}
        onClose={() => { setCancelConfirmVisible(false); setOrderToCancel(null); }}
        onConfirm={executeCancelOrder}
        title="Cancelar Ordem"
        message={orderToCancel 
          ? `Tem certeza que deseja cancelar a ordem de ${orderToCancel.order.side === 'buy' ? 'compra' : 'venda'} de ${orderToCancel.order.symbol}?\n\nPreço: $${apiService.formatUSD(Number(orderToCancel.order.price) || 0)}\nQuantidade: ${apiService.formatTokenAmount(String(Number(orderToCancel.order.amount) || 0))}`
          : ''
        }
        confirmText="Cancelar Ordem"
        cancelText="Voltar"
        confirmColor="#ef4444"
        icon="⚠️"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: commonStyles.screenContainer,
  filtersContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    paddingVertical: 0,
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  typeFilterChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
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
    marginBottom: 14,
  },
  // Exchange card container (mesmo padrão do AssetsList)
  exchangeCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  exchangeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
  },
  exchangeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exchangeCardLogo: {
    width: 20,
    height: 20,
  },
  exchangeCardName: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
  },
  exchangeCardCount: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },
  exchangeCardBody: {
    // Container for order rows
  },
  // Order row - compact inline (mesmo padrão dos asset rows)
  orderItemRow: {
    borderBottomWidth: 0.5,
  },
  orderRowTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    gap: 8,
  },
  orderSymbolContainer: {
    minWidth: 64,
  },
  orderSymbolText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
  },
  orderSideBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 36,
    alignItems: 'center',
  },
  orderSideText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.bold,
  },
  orderPnlBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    minWidth: 36,
    alignItems: 'center',
  },
  orderPnlText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.bold,
  },
  orderValuesContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  orderPriceText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
    minWidth: 50,
    textAlign: 'right',
  },
  orderValueText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
    minWidth: 50,
    textAlign: 'right',
  },
  orderCancelIcon: {
    padding: 2,
    marginLeft: 2,
  },
});
