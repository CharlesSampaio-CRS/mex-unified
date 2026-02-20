import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { GradientCard } from './GradientCard';

interface CompactAssetCardProps {
  symbol: string;
  amount: string;
  valueUSD: number;
  priceUSD: number;
  variation24h?: number;
  free: number;
  used: number;
  total: number;
  isStablecoin: boolean;
  exchangeName: string;
  exchangeId: string;
  usdtBalance: number;
  
  // Ações
  onToggleFavorite?: () => void;
  onCreateAlert?: () => void;
  onTrade?: () => void;
  onViewDetails?: () => void;
  
  // Estados
  isFavorite?: boolean;
  hasAlerts?: boolean;
  hideValue?: boolean;
}

export function CompactAssetCard({
  symbol,
  amount,
  valueUSD,
  priceUSD,
  variation24h,
  free,
  used,
  total,
  isStablecoin,
  exchangeName,
  exchangeId,
  usdtBalance,
  onToggleFavorite,
  onCreateAlert,
  onTrade,
  onViewDetails,
  isFavorite = false,
  hasAlerts = false,
  hideValue = false,
}: CompactAssetCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  
  // Formatação de valores
  const formatCurrency = (value: number) => {
    if (hideValue) return '••••••';
    return `$${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const formatAmount = (amount: string | number) => {
    if (hideValue) return '••••';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (numAmount >= 1) {
      return numAmount.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
    }
    return numAmount.toFixed(8).replace(/\.?0+$/, '');
  };

  const variationColor = !variation24h || variation24h === 0 
    ? colors.textSecondary 
    : variation24h > 0 
      ? colors.success 
      : colors.danger;

  return (
    <GradientCard style={[styles.card, { borderColor: colors.border }]}>
      {/* Linha Compacta - Sempre Visível */}
      <TouchableOpacity 
        style={styles.compactRow}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        {/* Esquerda: Símbolo + Valor */}
        <View style={styles.leftSection}>
          <View style={styles.symbolRow}>
            <Text style={[styles.symbol, { color: colors.text }]}>{symbol}</Text>
            <View style={styles.actions}>
              {/* Alerta */}
              {onCreateAlert && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    onCreateAlert();
                  }}
                  style={styles.iconButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={hasAlerts ? "notifications" : "notifications-outline"}
                    size={14}
                    color={hasAlerts ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
              
              {/* Favorito */}
              {onToggleFavorite && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                  }}
                  style={styles.iconButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={isFavorite ? "star" : "star-outline"}
                    size={14}
                    color={isFavorite ? colors.warning : colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text style={[styles.value, { color: colors.text }]}>
            {formatCurrency(valueUSD)}
          </Text>
        </View>

        {/* Centro: Variação (se não for stablecoin) */}
        {!isStablecoin && variation24h !== undefined && variation24h !== null && (
          <View style={styles.centerSection}>
            <Text style={[styles.variation, { color: variationColor }]}>
              {variation24h > 0 ? '+' : ''}{Number(variation24h).toFixed(2)}%
            </Text>
          </View>
        )}

        {/* Direita: Ícone expandir */}
        <View style={styles.rightSection}>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {/* Detalhes Expandidos */}
      {expanded && (
        <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
          {/* Informações Detalhadas */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Quantidade</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{formatAmount(amount)}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Preço</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{formatCurrency(priceUSD)}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Disponível</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{formatAmount(free)}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Em Ordens</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{formatAmount(used)}</Text>
            </View>
          </View>

          {/* Botões de Ação */}
          <View style={styles.buttonRow}>
            {onViewDetails && (
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary, { borderColor: colors.border }]}
                onPress={onViewDetails}
              >
                <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                <Text style={[styles.buttonText, { color: colors.primary }]}>Detalhes</Text>
              </TouchableOpacity>
            )}
            
            {onTrade && !isStablecoin && (
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, { backgroundColor: colors.success + '20', borderColor: colors.success }]}
                onPress={onTrade}
              >
                <Ionicons name="trending-up" size={16} color={colors.success} />
                <Text style={[styles.buttonText, { color: colors.success }]}>Negociar</Text>
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
    borderRadius: 12,
    marginBottom: 8,
    padding: 0,
    overflow: 'hidden',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  leftSection: {
    flex: 1,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconButton: {
    padding: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
  },
  centerSection: {
    marginRight: 12,
  },
  variation: {
    fontSize: 14,
    fontWeight: '600',
  },
  rightSection: {
    paddingLeft: 8,
  },
  expandedSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  detailsGrid: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonPrimary: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
