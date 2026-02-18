import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, RefreshControl, Text } from 'react-native';
import { TabBar } from '../TabBar';
import { PortfolioOverview } from '../PortfolioOverview';
import { MarketOverview } from '../MarketOverview';
import { AssetsList } from '../AssetsList';
import { AllOpenOrdersList } from '../AllOpenOrdersList';
import { ExchangesPieChart } from '../ExchangesPieChart';
import { TopGainersLosers } from '../TopGainersLosers';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useBalance } from '../../contexts/BalanceContext';

export const HomeTabsLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { refresh: refreshBalance, refreshing } = useBalance();
  const ordersListRef = useRef<{ refresh: () => Promise<void> } | null>(null);

  const tabs = [
    t('home.tabSummary'),
    t('home.tabAssets'),
    t('home.tabOrders')
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* TabBar fixo no topo - sempre visível */}
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Conteúdo scrollável abaixo do TabBar */}
      <ScrollView 
        style={{ flex: 1 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshBalance}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Mantém todos os componentes montados mas oculta os inativos */}
        <View style={{ display: activeTab === 0 ? 'flex' : 'none', gap: 16, paddingTop: 16, paddingHorizontal: 16 }}>
          <PortfolioOverview />
          <MarketOverview />
          <TopGainersLosers />
          <ExchangesPieChart />
        </View>
        
        <View style={{ display: activeTab === 1 ? 'flex' : 'none', paddingTop: 16, paddingHorizontal: 16 }}>
          <AssetsList />
        </View>
        
        <View style={{ display: activeTab === 2 ? 'flex' : 'none', paddingTop: 16, paddingHorizontal: 16 }}>
          <AllOpenOrdersList ref={ordersListRef} />
        </View>
      </ScrollView>
    </View>
  );
};
