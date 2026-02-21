import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { PortfolioChart } from './PortfolioChart';
import { ExchangeBarChart } from './ExchangeBarChart';

export const PortfolioChartsCard: React.FC = () => {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderWidth: isDark ? 0 : 1,
          borderColor: colors.border,
        }
      ]}
    >
      {/* Gráfico de Evolução no topo */}
      <View style={styles.chartContainer}>
        <PortfolioChart />
      </View>

      {/* Divisor sutil */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Gráfico de Barras embaixo */}
      <View style={styles.chartContainer}>
        <ExchangeBarChart showTitle={true} embedded={true} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  chartContainer: {
    padding: 0,
  },
  divider: {
    height: 1,
    width: '100%',
    opacity: 0.3,
  },
});
