import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { spacing } from '@/lib/layout';
import { typography, fontWeights } from '@/lib/typography';

interface TabBarProps {
  tabs: string[];
  activeTab: number;
  onTabChange: (index: number) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ tabs, activeTab, onTabChange }) => {
  const { colors } = useTheme();

  const handleTabChange = (index: number) => {
    onTabChange(index);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {tabs.map((tab, index) => {
        const isActive = activeTab === index;
        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.tab,
              isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
            ]}
            onPress={() => handleTabChange(index)}
          >
            <Text
              style={[
                styles.tabText,
                { color: isActive ? colors.text : colors.textSecondary },
                isActive && styles.tabTextActive
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: spacing.screenHorizontal, // 20px padronizado
    marginTop: spacing.itemGap, // 12px padronizado
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.itemGap, // 12px padronizado
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: typography.caption, // 14px - reduzido
    fontWeight: fontWeights.regular,
  },
  tabTextActive: {
    fontWeight: fontWeights.semibold,
  },
});
