import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { CompactAssetCard } from './CompactAssetCard';
import { AnimatedLogoIcon } from './AnimatedLogoIcon';

interface Asset {
  id: string;
  symbol: string;
  amount: string;
  free: number;
  used: number;
  total: number;
  priceUSD: number;
  valueUSD: number;
  usdtBalance: number;
  isStablecoin: boolean;
  variation24h?: number;
  exchangeId: string;
  exchangeName: string;
}

interface CompactAssetsListProps {
  exchangeId: string;
  exchangeName: string;
  exchangeTotalUSD: number;
  assets: Asset[];
  loading?: boolean;
  
  // Callbacks
  onToggleFavorite: (symbol: string) => void;
  onCreateAlert: (asset: Asset) => void;
  onTrade: (asset: Asset) => void;
  onViewDetails: (asset: Asset) => void;
  
  // Estados
  getFavoriteState: (symbol: string) => boolean;
  getAlertState: (symbol: string, exchangeId: string) => boolean;
  hideValue?: boolean;
}

export function CompactAssetsList({
  exchangeId,
  exchangeName,
  exchangeTotalUSD,
  assets,
  loading = false,
  onToggleFavorite,
  onCreateAlert,
  onTrade,
  onViewDetails,
  getFavoriteState,
  getAlertState,
  hideValue = false,
}: CompactAssetsListProps) {
  const { colors } = useTheme();
  const [collapsed, setCollapsed] = useState(true);

  // Formatar valor USD
  const formatCurrency = (value: number): string => {
    if (hideValue) return '••••••';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

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
          <Text style={[styles.exchangeTotal, { color: colors.textSecondary }]}>
            {formatCurrency(exchangeTotalUSD)}
          </Text>
        </View>
        
        {loading ? (
          <View style={styles.loadingRow}>
            <AnimatedLogoIcon size={16} />
            <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
              Carregando...
            </Text>
          </View>
        ) : (
          <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
            {assets.length} {assets.length === 1 ? 'token' : 'tokens'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Conteúdo - Mostra apenas se não estiver colapsado */}
      {!collapsed && (
        <>
          {/* Loading State */}
      {loading ? (
        <View style={[styles.loadingContainer, { backgroundColor: colors.surface }]}>
          <AnimatedLogoIcon size={24} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Carregando tokens...
          </Text>
        </View>
      ) : assets.length === 0 ? (
        /* Empty State */
        <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Nenhum token nesta exchange
          </Text>
        </View>
      ) : (
        /* Lista de Assets Compacta */
        assets.map((asset) => (
          <CompactAssetCard
            key={asset.id}
            symbol={asset.symbol}
            amount={asset.amount}
            valueUSD={asset.valueUSD}
            priceUSD={asset.priceUSD}
            variation24h={asset.variation24h}
            free={asset.free}
            used={asset.used}
            total={asset.total}
            isStablecoin={asset.isStablecoin}
            exchangeName={asset.exchangeName}
            exchangeId={asset.exchangeId}
            usdtBalance={asset.usdtBalance}
            onToggleFavorite={() => onToggleFavorite(asset.symbol)}
            onCreateAlert={() => onCreateAlert(asset)}
            onTrade={() => onTrade(asset)}
            onViewDetails={() => onViewDetails(asset)}
            isFavorite={getFavoriteState(asset.symbol)}
            hasAlerts={getAlertState(asset.symbol, asset.exchangeId)}
            hideValue={hideValue}
          />
        ))
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
  exchangeTotal: {
    fontSize: 11,
    fontWeight: '400',
    marginLeft: 8,
    opacity: 0.7,
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
