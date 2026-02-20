import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { GradientCard } from './GradientCard';
import { OpenOrder } from '../types/orders';

interface CompactOrderCardProps {
  order: OpenOrder;
  exchangeId: string;
  exchangeName: string;
  isCancelling?: boolean;
  hideValue?: boolean;
  
  // Ações
  onCancel?: () => void;
  onClone?: () => void;
  onViewDetails?: () => void;
  
  // Formatadores
  formatAmount: (amount: number) => string;
  formatPrice: (price: number) => string;
  formatDate: (timestamp: number) => string;
}

export function CompactOrderCard({
  order,
  exchangeId,
  exchangeName,
  isCancelling = false,
  hideValue = false,
  onCancel,
  onClone,
  onViewDetails,
  formatAmount,
  formatPrice,
  formatDate,
}: CompactOrderCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const formatValue = (value: string) => {
    if (hideValue) return '••••••';
    return value;
  };

  return (
    <GradientCard style={[styles.card, { borderColor: colors.border }, isCancelling && { opacity: 0.5 }]}>
      {/* Linha Compacta - Sempre Visível */}
      <TouchableOpacity 
        style={styles.compactRow}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        disabled={isCancelling}
      >
        {/* Esquerda: Símbolo + Badge */}
        <View style={styles.leftSection}>
          <Text style={[styles.symbol, { color: colors.text }]}>
            {order.symbol.charAt(0).toUpperCase() + order.symbol.slice(1).toLowerCase()}
          </Text>
          
          <View style={[
            styles.sideBadge,
            { backgroundColor: order.side === 'buy' ? colors.successLight : colors.dangerLight }
          ]}>
            <Text style={[
              styles.sideText,
              { color: order.side === 'buy' ? colors.success : colors.danger }
            ]}>
              {order.side === 'buy' ? 'Buy' : 'Sell'}
            </Text>
          </View>
        </View>

        {/* Direita: Chevron */}
        <View style={styles.rightSection}>
          <Ionicons 
            name={expanded ? "chevron-up" : "chevron-down"} 
            size={16} 
            color={colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {/* Detalhes Expandidos */}
      {expanded && (
        <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
          {/* Informações de Preço e Quantidade */}
          <View style={styles.priceInfoRow}>
            <View style={styles.priceInfoItem}>
              <Text style={[styles.priceInfoLabel, { color: colors.textSecondary }]}>Amount:</Text>
              <Text style={[styles.priceInfoValue, { color: colors.text }]}>
                {formatValue(formatAmount(order.amount))}
              </Text>
            </View>
            <View style={styles.priceInfoItem}>
              <Text style={[styles.priceInfoLabel, { color: colors.textSecondary }]}>Price:</Text>
              <Text style={[styles.priceInfoValue, { color: colors.text }]}>
                {formatValue(`$${formatPrice(order.price)}`)}
              </Text>
            </View>
            <View style={styles.priceInfoItem}>
              <Text style={[styles.priceInfoLabel, { color: colors.textSecondary }]}>Time:</Text>
              <Text style={[styles.priceInfoValue, { color: colors.text }]}>
                {formatDate(order.timestamp)}
              </Text>
            </View>
          </View>
          
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {/* Detalhes da Ordem */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Type:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {order.type.toUpperCase()}
              </Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {order.status}
              </Text>
            </View>

            {order.filled !== undefined && (
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Filled:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {formatValue(formatAmount(order.filled))}
                </Text>
              </View>
            )}

            {order.remaining !== undefined && (
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Remaining:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {formatValue(formatAmount(order.remaining))}
                </Text>
              </View>
            )}

            {order.cost !== undefined && (
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Cost:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {formatValue(`$${formatPrice(order.cost)}`)}
                </Text>
              </View>
            )}
          </View>

          {/* Ações */}
          <View style={styles.actionsRow}>
            {onClone && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                onPress={onClone}
                activeOpacity={0.7}
              >
                <Ionicons name="copy-outline" size={16} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.primary }]}>Clone</Text>
              </TouchableOpacity>
            )}

            {onViewDetails && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={onViewDetails}
                activeOpacity={0.7}
              >
                <Ionicons name="information-circle-outline" size={16} color={colors.text} />
                <Text style={[styles.actionText, { color: colors.text }]}>Details</Text>
              </TouchableOpacity>
            )}

            {onCancel && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.danger + '15', borderColor: colors.danger }]}
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                <Text style={[styles.actionText, { color: colors.danger }]}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </GradientCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    marginBottom: 2,
    padding: 0,
    overflow: 'hidden',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
    minHeight: 40,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    gap: 6,
  },
  symbol: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sideText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0,
    flexShrink: 0,
  },
  expandedSection: {
    paddingTop: 8,
    paddingHorizontal: 6,
    paddingBottom: 6,
    borderTopWidth: 1,
  },
  priceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  priceInfoItem: {
    flex: 1,
  },
  priceInfoLabel: {
    fontSize: 10,
    opacity: 0.7,
    marginBottom: 2,
  },
  priceInfoValue: {
    fontSize: 11,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: '45%',
  },
  detailLabel: {
    fontSize: 10,
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
    flex: 1,
    minWidth: 80,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
