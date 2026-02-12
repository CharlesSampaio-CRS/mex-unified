import React, { useState } from 'react';
import { View } from 'react-native';
import { PortfolioOverview } from '../PortfolioOverview';
import { MarketOverview } from '../MarketOverview';
import { TopGainersLosers } from '../TopGainersLosers';
import { AssetsList } from '../AssetsList';

interface HomeVerticalLayoutProps {
  pnlRefreshTrigger?: number
}

export const HomeVerticalLayout: React.FC<HomeVerticalLayoutProps> = ({ pnlRefreshTrigger }) => {
  return (
    <View style={{ gap: 24 }}>
      <PortfolioOverview />
      <MarketOverview />
      <TopGainersLosers />
      <AssetsList />
    </View>
  );
};
