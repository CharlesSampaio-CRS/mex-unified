import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { PortfolioOverview } from '../PortfolioOverview';
import { PortfolioChartsCard } from '../PortfolioChartsCard';
import { MarketOverview } from '../MarketOverview';
import { TopGainersLosers } from '../TopGainersLosers';
import { AssetsList } from '../AssetsList';
import { PnLSummary } from '@/services/backend-snapshot-service';

interface HomeVerticalLayoutProps {
  pnl?: PnLSummary | null
  pnlLoading?: boolean
  isUpdating?: boolean
}

export const HomeVerticalLayout: React.FC<HomeVerticalLayoutProps> = ({ 
  pnl, 
  pnlLoading = false,
  isUpdating = false 
}) => {
  const { colors } = useTheme();
  
  return (
    <View style={{ gap: 24 }}>
      {/* Indicador de atualização */}
      {isUpdating && (
        <View style={[styles.updatingBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={[styles.updatingText, { color: colors.primary }]}>
            Atualizando dados...
          </Text>
        </View>
      )}
      
      <PortfolioOverview pnl={pnl} pnlLoading={pnlLoading} />
      <PortfolioChartsCard />
      <MarketOverview />
      <TopGainersLosers />
      <AssetsList />
    </View>
  );
};

const styles = StyleSheet.create({
  updatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  updatingText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
