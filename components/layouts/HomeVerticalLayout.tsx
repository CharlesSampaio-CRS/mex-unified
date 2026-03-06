import React, { useState, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { typography, fontWeights } from '@/lib/typography';
import { PortfolioOverview } from '../PortfolioOverview';
import { MarketOverview } from '../MarketOverview';
import { TopGainersLosers } from '../TopGainersLosers';
import { AssetsList } from '../AssetsList';
import { PnLSummary } from '@/services/backend-snapshot-service';
import type { BackendSnapshot } from '@/services/backend-snapshot-service';

interface HomeVerticalLayoutProps {
  pnl?: PnLSummary | null
  pnlLoading?: boolean
  snapshots?: BackendSnapshot[]
  isUpdating?: boolean
}

export const HomeVerticalLayout = memo(function HomeVerticalLayout({ 
  pnl, 
  pnlLoading = false,
  snapshots,
  isUpdating = false 
}: HomeVerticalLayoutProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  
  return (
    <View style={{ gap: 16 }}>
      {/* Indicador de atualização */}
      {isUpdating && (
        <View style={[styles.updatingBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="refresh-outline" size={16} color={colors.primary} />
          <Text style={[styles.updatingText, { color: colors.primary }]}>
            {t('common.updatingData')}
          </Text>
        </View>
      )}
      
      <PortfolioOverview pnl={pnl} pnlLoading={pnlLoading} snapshots={snapshots} />
      <MarketOverview />
      <TopGainersLosers />
      <AssetsList />
    </View>
  );
});

const styles = StyleSheet.create({
  updatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginHorizontal: 14,
    marginTop: 6,
    gap: 6,
  },
  updatingText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.medium,
  },
});
