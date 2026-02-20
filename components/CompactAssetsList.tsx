import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

  return (
    <View style={styles.container}>
      {/* Header da Exchange */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.exchangeName, { color: colors.text }]}>
          {exchangeName}
        </Text>
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
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
  },
  exchangeName: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
