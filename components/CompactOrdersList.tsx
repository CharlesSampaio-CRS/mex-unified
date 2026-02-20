import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { OpenOrder } from '../types/orders';
import { CompactOrderCard } from './CompactOrderCard';
import { AnimatedLogoIcon } from './AnimatedLogoIcon';

interface CompactOrdersListProps {
  exchangeId: string;
  exchangeName: string;
  orders: OpenOrder[];
  loading?: boolean;
  hideValue?: boolean;
  cancellingOrderIds?: Set<string>;
  
  // Ações
  onCancelOrder: (order: OpenOrder) => void;
  onCloneOrder: (order: OpenOrder) => void;
  onViewDetails: (order: OpenOrder) => void;
  
  // Formatadores
  formatAmount: (amount: number) => string;
  formatPrice: (price: number) => string;
  formatDate: (timestamp: number) => string;
  getOrderId: (order: OpenOrder) => string;
}

export function CompactOrdersList({
  exchangeId,
  exchangeName,
  orders,
  loading = false,
  hideValue = false,
  cancellingOrderIds = new Set(),
  onCancelOrder,
  onCloneOrder,
  onViewDetails,
  formatAmount,
  formatPrice,
  formatDate,
  getOrderId,
}: CompactOrdersListProps) {
  const { colors } = useTheme();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <View style={styles.container}>
      {/* Header da Exchange - Clicável para expandir/colapsar */}
      <TouchableOpacity 
        style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setCollapsed(!collapsed)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons 
            name={collapsed ? "chevron-forward" : "chevron-down"} 
            size={14} 
            color={colors.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.exchangeName, { color: colors.text }]}>
            {exchangeName}
          </Text>
        </View>
        
        {loading ? (
          <View style={styles.loadingRow}>
            <AnimatedLogoIcon size={16} />
            <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
              Loading...
            </Text>
          </View>
        ) : (
          <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
            {orders.length} {orders.length === 1 ? 'order' : 'orders'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Lista de Orders - Condicional */}
      {!collapsed && (
        <>
      {loading ? (
        /* Loading State */
        <View style={[styles.loadingContainer, { backgroundColor: colors.surface }]}>
          <AnimatedLogoIcon size={32} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading orders...
          </Text>
        </View>
      ) : orders.length === 0 ? (
        /* Empty State */
        <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No open orders
          </Text>
        </View>
      ) : (
        /* Lista de Orders Compacta */
        orders.map((order) => {
          const orderId = getOrderId(order);
          const isCancelling = cancellingOrderIds.has(orderId);
          
          return (
            <CompactOrderCard
              key={orderId}
              order={order}
              exchangeId={exchangeId}
              exchangeName={exchangeName}
              isCancelling={isCancelling}
              hideValue={hideValue}
              onCancel={() => onCancelOrder(order)}
              onClone={() => onCloneOrder(order)}
              onViewDetails={() => onViewDetails(order)}
              formatAmount={formatAmount}
              formatPrice={formatPrice}
              formatDate={formatDate}
            />
          );
        })
      )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginBottom: 3,
    borderWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exchangeName: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'capitalize',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemCount: {
    fontSize: 11,
    opacity: 0.7,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 6,
  },
  loadingText: {
    marginTop: 6,
    fontSize: 11,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 11,
    fontStyle: 'italic',
    opacity: 0.6,
  },
});
