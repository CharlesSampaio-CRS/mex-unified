import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, Animated } from 'react-native';
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
import { Header } from '@/components/Header';
import { NotificationsModal } from '@/components/NotificationsModal';
import { OrderDetailsModal } from '@/components/order-details-modal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { OpenOrder } from '@/types/orders';
import { commonStyles } from '@/lib/layout';
import { typography, fontWeights } from '@/lib/typography';

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

  // Renderiza order card
  const renderOrderCard = useCallback((order: OpenOrder, exchangeId: string) => {
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
    // Para VENDA: lucro = orderValue - currentValue (vender acima do preço atual = lucro)
    // Para COMPRA: lucro = currentValue - orderValue (comprar abaixo do preço atual = lucro)  
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
          styles.orderCard,
          { 
            backgroundColor: colors.surface,
            borderColor: isRecentlyAdded ? colors.primary : colors.border,
          }
        ]}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
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
              <View style={styles.symbolWithPnl}>
                <Text style={[styles.orderSymbol, { color: colors.text }]}>
                  {String(order.symbol || 'N/A')}
                </Text>
                {hasPnl && (
                  <View style={[
                    styles.pnlBadge,
                    { backgroundColor: isPnlPositive ? colors.successLight : colors.dangerLight }
                  ]}>
                    <Ionicons
                      name={isPnlPositive ? 'caret-up' : 'caret-down'}
                      size={10}
                      color={isPnlPositive ? colors.success : colors.danger}
                    />
                    <Text style={[
                      styles.pnlText,
                      { color: isPnlPositive ? colors.success : colors.danger }
                    ]}>
                      {String(hideValue(`$${apiService.formatUSD(Math.abs(pnlValue), Math.abs(pnlValue) < 1 ? 4 : 2)}`))}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.badgeRow}>
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
                <View style={[styles.typeBadge, { backgroundColor: colors.card }]}>
                  <Text style={[styles.typeBadgeText, { color: colors.textSecondary }]}>
                    {String((order.type || 'LIMIT').toString().toUpperCase())}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.valueSection}>
            <Text style={[styles.orderValue, { color: colors.text }]}>
              {String(hideValue(`$${apiService.formatUSD(orderValue, orderValue < 1 ? 6 : 2)}`))}
            </Text>
            {hasPnl && (
              <Text style={[styles.pnlPercent, { color: isPnlPositive ? colors.success : colors.danger }]}>
                {String(hideValue(`${isPnlPositive ? '+' : ''}${pnlPercent.toFixed(2)}%`))}
              </Text>
            )}
          </View>
        </View>

        {/* Body */}
        <View style={styles.cardBody}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
              Preço
            </Text>
            <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
              {String(hideValue(`$${apiService.formatUSD(price, priceDecimals)}`))}
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

          {order.filled != null && Number(order.filled) > 0 && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                Executado
              </Text>
              <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                {String(hideValue(apiService.formatTokenAmount(String(order.filled))))}
              </Text>
            </View>
          )}

          {order.timestamp != null && order.timestamp > 0 && (
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
      </AnimatedOrderCard>
    );
  }, [cancellingOrderIds, recentlyAddedIds, colors, hideValue, handleOrderPress, handleCancelOrder, tokenPrices]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        title="Orders"
        subtitle={`${String(totals.count)} ${totals.count === 1 ? 'order' : 'orders'} • ${String(hideValue(`$${apiService.formatUSD(totals.value)}`))}`}
        onNotificationsPress={onNotificationsPress}
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
  },
  symbolWithPnl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pnlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pnlText: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
  },
  pnlPercent: {
    fontSize: typography.micro,
    fontWeight: fontWeights.bold,
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
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
