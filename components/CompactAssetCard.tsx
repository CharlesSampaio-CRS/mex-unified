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
        {/* Esquerda: Ícone + Símbolo + Ações */}
        <View style={styles.leftSection}>
          {/* Ícone do Token (padrão BTC para testes futuros) */}
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="logo-bitcoin" size={14} color={colors.primary} />
          </View>
          
          <Text style={[styles.symbol, { color: colors.text }]}>
            {symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase()}
          </Text>
          
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
                  size={12}
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
                  size={12}
                  color={isFavorite ? colors.warning : colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Centro: Valor USD + Variação */}
        <View style={styles.centerSection}>
          <Text style={[styles.value, { color: colors.text }]}>
            {formatCurrency(valueUSD)}
          </Text>
          {!isStablecoin && variation24h !== undefined && variation24h !== null && (
            <Text style={[styles.variationInline, { color: variationColor, marginLeft: 6 }]}>
              {variation24h > 0 ? '+' : ''}{Number(variation24h).toFixed(2)}%
            </Text>
          )}
        </View>

        {/* Direita: Ícone expandir */}
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
                <Ionicons name="information-circle-outline" size={12} color={colors.primary} />
                <Text style={[styles.buttonText, { color: colors.primary }]}>Detalhes</Text>
              </TouchableOpacity>
            )}
            
            {onTrade && !isStablecoin && (
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, { backgroundColor: colors.success + '20', borderColor: colors.success }]}
                onPress={onTrade}
              >
                <Ionicons name="trending-up" size={12} color={colors.success} />
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
    borderRadius: 8,
    marginBottom: 3,
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
    flex: 0,
    flexShrink: 0,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  iconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  symbol: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
    letterSpacing: 0.3,
  },
  actions: {
    flexDirection: 'row',
    gap: 2,
    marginLeft: 4,
  },
  iconButton: {
    padding: 2,
  },
  centerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    marginRight: 8,
  },
  value: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.85,
  },
  variationInline: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  rightSection: {
    paddingLeft: 4,
  },
  expandedSection: {
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  detailsGrid: {
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  detailLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonPrimary: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
