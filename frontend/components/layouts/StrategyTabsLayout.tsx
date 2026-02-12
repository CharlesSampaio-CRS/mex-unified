import React, { useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { TabBar } from '../TabBar';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface StrategyTabsLayoutProps {
  strategiesContent: React.ReactNode;
  executionsContent: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export const StrategyTabsLayout: React.FC<StrategyTabsLayoutProps> = ({
  strategiesContent,
  executionsContent,
  onRefresh,
  refreshing = false,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const { colors } = useTheme();
  const { t } = useLanguage();

  const tabs = [t('strategy.title'), t('strategy.executions')];

  return (
    <View style={{ flex: 1 }}>
      {/* TabBar fixo no topo */}
      <View style={{ backgroundColor: colors.surface, zIndex: 100 }}>
        <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </View>

      {/* Conteúdo scrollável */}
      <ScrollView 
        style={{ flex: 1 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      >
        {/* Renderiza todas as abas, mas oculta as inativas */}
        <View style={{ paddingTop: 16, paddingHorizontal: 16, display: activeTab === 0 ? 'flex' : 'none' }}>
          {strategiesContent}
        </View>
        
        <View style={{ paddingTop: 16, paddingHorizontal: 16, display: activeTab === 1 ? 'flex' : 'none' }}>
          {executionsContent}
        </View>
      </ScrollView>
    </View>
  );
};
