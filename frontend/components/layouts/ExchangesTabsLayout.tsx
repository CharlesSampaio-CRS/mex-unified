import React, { useState } from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { TabBar } from '../TabBar';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface ExchangesTabsLayoutProps {
  initialTab?: 'linked' | 'available';
  linkedContent: React.ReactNode;
  availableContent: React.ReactNode;
}

export const ExchangesTabsLayout: React.FC<ExchangesTabsLayoutProps> = ({
  initialTab = 'linked',
  linkedContent,
  availableContent,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab === 'linked' ? 0 : 1);
  const { colors } = useTheme();
  const { t } = useLanguage();

  const tabs = [t('exchanges.connected'), t('exchanges.available')];

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
      >
        {/* Renderiza todas as abas, mas oculta as inativas */}
        <View style={{ paddingTop: 16, paddingHorizontal: 16, display: activeTab === 0 ? 'flex' : 'none' }}>
          {linkedContent}
        </View>
        
        <View style={{ paddingTop: 16, paddingHorizontal: 16, display: activeTab === 1 ? 'flex' : 'none' }}>
          {availableContent}
        </View>
      </ScrollView>
    </View>
  );
};
