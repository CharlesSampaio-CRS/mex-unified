import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, RefreshControl, Text } from 'react-native';
import { PortfolioOverview } from '../PortfolioOverview';
import { MarketOverview } from '../MarketOverview';
import { TopGainersLosers } from '../TopGainersLosers';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useBalance } from '../../contexts/BalanceContext';
import { PnLSummary } from '@/services/backend-snapshot-service';
import type { BackendSnapshot } from '@/services/backend-snapshot-service';

interface HomeTabsLayoutProps {
  pnl?: PnLSummary | null
  pnlLoading?: boolean
  snapshots?: BackendSnapshot[]
}

export const HomeTabsLayout: React.FC<HomeTabsLayoutProps> = ({ pnl, pnlLoading = false, snapshots }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { refresh: refreshBalance, refreshing } = useBalance();

  return (
    <View style={{ flex: 1 }}>
      {/* Conteúdo scrollável - apenas Summary */}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshBalance} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 16, paddingTop: 16, paddingHorizontal: 16 }}>
          <PortfolioOverview pnl={pnl} pnlLoading={pnlLoading} snapshots={snapshots} />
          <MarketOverview />
          <TopGainersLosers />
        </View>
      </ScrollView>
    </View>
  );
};
