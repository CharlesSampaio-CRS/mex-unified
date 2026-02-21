import React, { memo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useBalance } from '@/contexts/BalanceContext';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fontWeights } from '@/lib/typography';

// Paleta de cores para os indicadores
const EXCHANGE_COLORS = [
  '#60A5FA', '#93C5FD', '#7DD3FC', '#A5B4FC', '#94A3B8', '#BAE6FD',
  '#6B7280', '#9CA3AF', '#64748B', '#84CC16', '#A78BFA', '#5EEAD4',
];

// Ícones das exchanges
const EXCHANGE_ICONS: Record<string, any> = {
  'Binance': require('../assets/binance.png'),
  'Bybit': require('../assets/bybit.png'),
  'Coinbase': require('../assets/coinbase.png'),
  'Gate.io': require('../assets/gateio.png'),
  'Kraken': require('../assets/kraken.png'),
  'KuCoin': require('../assets/kucoin.png'),
  'MEXC': require('../assets/mexc.png'),
  'NovaDAX': require('../assets/novadax.png'),
  'OKX': require('../assets/okx.png'),
};

export const ExchangesList = memo(function ExchangesList() {
  const { colors } = useTheme();
  const { data } = useBalance();
  const { hideValue } = usePrivacy();

  if (!data?.exchanges || data.exchanges.length === 0) {
    return null;
  }

  // Calcular o total para percentuais
  const totalValue = data.exchanges.reduce((sum, exchange) => {
    const value = typeof exchange.total_usd === 'string' 
      ? parseFloat(exchange.total_usd) 
      : exchange.total_usd;
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  // Ordenar exchanges por valor (maior para menor)
  const sortedExchanges = [...data.exchanges].sort((a, b) => {
    const valueA = typeof a.total_usd === 'string' ? parseFloat(a.total_usd) : a.total_usd;
    const valueB = typeof b.total_usd === 'string' ? parseFloat(b.total_usd) : b.total_usd;
    return valueB - valueA;
  });

  return (
    <View style={styles.container}>
      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      
      {/* Título */}
      <Text style={[styles.title, { color: colors.textTertiary }]}>
        By Exchange
      </Text>

      {/* Lista de exchanges */}
      <View style={styles.list}>
        {sortedExchanges.map((exchange, index) => {
          const value = typeof exchange.total_usd === 'string' 
            ? parseFloat(exchange.total_usd) 
            : exchange.total_usd;
          
          const percentage = totalValue > 0 
            ? ((value / totalValue) * 100).toFixed(1) 
            : '0.0';
          
          const color = EXCHANGE_COLORS[index % EXCHANGE_COLORS.length];
          const icon = EXCHANGE_ICONS[exchange.name] || EXCHANGE_ICONS['Binance'];

          return (
            <View key={exchange.name} style={styles.row}>
              {/* Indicador de cor */}
              <View style={[styles.colorIndicator, { backgroundColor: color }]} />
              
              {/* Ícone da exchange */}
              <Image source={icon} style={styles.icon} />
              
              {/* Nome da exchange */}
              <Text 
                style={[styles.name, { color: colors.text }]}
                numberOfLines={1}
              >
                {exchange.name}
              </Text>
              
              {/* Percentual */}
              <Text style={[styles.percentage, { color: colors.text }]}>
                {percentage}%
              </Text>
              
              {/* Valor */}
              <Text style={[styles.value, { color: colors.textSecondary }]}>
                {hideValue(`$${value.toLocaleString('en-US', { 
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 8,
  },
  divider: {
    height: 1,
    width: '100%',
    opacity: 0.3,
    marginBottom: 6,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
  },
  list: {
    width: '100%',
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  colorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  icon: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  name: {
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  percentage: {
    fontSize: 12,
    fontWeight: '700',
    width: 45,
    textAlign: 'right',
    lineHeight: 18,
  },
  value: {
    fontSize: 11,
    fontWeight: fontWeights.regular,
    width: 65,
    textAlign: 'right',
    lineHeight: 18,
  },
});
