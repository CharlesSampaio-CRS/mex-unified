import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { marketPriceService } from '../services/marketPriceService';
import { AnimatedLogoIcon } from './AnimatedLogoIcon';
import { PortfolioChart } from './PortfolioChart';
import { typography, fontWeights } from '@/lib/typography';
import Ionicons from '@expo/vector-icons/Ionicons';

interface MarketToken {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h?: number;
}

const MAIN_TOKENS = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'DOT', name: 'Polkadot' },
  { symbol: 'MATIC', name: 'Polygon' },
  { symbol: 'LINK', name: 'Chainlink' },
];

export const MarketOverview: React.FC = () => {
  const { colors, theme } = useTheme();
  const { t } = useLanguage();
  const [tokens, setTokens] = useState<MarketToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [updateTimeText, setUpdateTimeText] = useState<string>('Carregando...');
  const [selectedToken, setSelectedToken] = useState<MarketToken | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [chartData, setChartData] = useState<{ values_usd: number[]; timestamps: string[] } | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [chartPeriod, setChartPeriod] = useState(7);

  const fetchMarketData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Buscar símbolos
      const symbols = MAIN_TOKENS.map(t => t.symbol);
      
      // Buscar dados reais do CoinGecko
      const marketData = await marketPriceService.getMarketData(symbols);
      
      // Converter Map para array
      const tokensData: MarketToken[] = MAIN_TOKENS.map(token => {
        const data = marketData.get(token.symbol);
        
        if (data) {
          return {
            symbol: data.symbol,
            name: token.name,
            price: data.price,
            change24h: data.change24h,
            volume24h: data.volume24h,
          };
        }
        
        // Fallback se não encontrou dados
        return {
          symbol: token.symbol,
          name: token.name,
          price: 0,
          change24h: 0,
          volume24h: 0,
        };
      }).filter(t => t.price > 0); // Remove tokens sem dados

      setTokens(tokensData);
      setLastUpdateTime(new Date());
      
      console.log(`[MarketOverview] ✅ ${tokensData.length} tokens carregados`);
    } catch (err) {
      console.error('[MarketOverview] ❌ Erro ao carregar dados:', err);
      setError('Erro ao carregar dados do mercado');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketData();

    // Atualizar a cada 2 minutos
    const interval = setInterval(() => {
      fetchMarketData(true);
    }, 120000);

    return () => clearInterval(interval);
  }, [fetchMarketData]);

  // Atualizar o texto com a hora da última atualização
  useEffect(() => {
    const updateTimeDisplay = () => {
      if (!lastUpdateTime) {
        setUpdateTimeText('Carregando...');
        return;
      }

      // Formatar hora no formato HH:MM:SS
      const hours = lastUpdateTime.getHours().toString().padStart(2, '0');
      const minutes = lastUpdateTime.getMinutes().toString().padStart(2, '0');
      const seconds = lastUpdateTime.getSeconds().toString().padStart(2, '0');
      
      setUpdateTimeText(`Atualizado às ${hours}:${minutes}:${seconds}`);
    };

    updateTimeDisplay();
  }, [lastUpdateTime]);

  // Carregar dados do gráfico quando o modal abrir
  const loadChartData = useCallback(async (symbol: string, days: number) => {
    console.log(`[MarketOverview] 📊 Carregando gráfico para ${symbol}, ${days} dias...`);
    setLoadingChart(true);
    setChartData(null); // Limpa dados anteriores
    try {
      const data = await marketPriceService.getChartData(symbol, days);
      if (data) {
        console.log(`[MarketOverview] ✅ Gráfico carregado: ${data.values.length} pontos`);
        setChartData({ values_usd: data.values, timestamps: data.timestamps });
      } else {
        console.warn(`[MarketOverview] ⚠️ Sem dados para ${symbol}`);
        setChartData(null);
      }
    } catch (error) {
      console.error('[MarketOverview] ❌ Erro ao carregar gráfico:', error);
      setChartData(null);
    } finally {
      setLoadingChart(false);
    }
  }, []);

  // Abrir modal e carregar gráfico
  const handleTokenPress = useCallback((token: MarketToken) => {
    setSelectedToken(token);
    setModalVisible(true);
    setChartPeriod(7);
    loadChartData(token.symbol, 7);
  }, [loadChartData]);

  // Mudar período do gráfico
  const handlePeriodChange = useCallback((days: number) => {
    setChartPeriod(days);
    if (selectedToken) {
      loadChartData(selectedToken.symbol, days);
    }
  }, [selectedToken, loadChartData]);

  const handleRefresh = useCallback(() => {
    fetchMarketData(true);
  }, [fetchMarketData]);

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    } else if (price >= 1) {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
    }
  };

  const formatChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  if (loading && tokens.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('token.market')}
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error && tokens.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('token.market')}
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={handleRefresh}
          >
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('token.market')}
          </Text>
          <Text style={[styles.updateTime, { color: colors.textSecondary }]}>
            {updateTimeText}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleRefresh}
          disabled={refreshing}
          style={[styles.refreshButton, refreshing && styles.refreshButtonDisabled]}
          activeOpacity={refreshing ? 1 : 0.7}
        >
          {refreshing ? (
            <AnimatedLogoIcon size={20} />
          ) : (
            <Text style={[styles.refreshIcon, { color: colors.primary }]}>↻</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tokens.map((token) => (
          <TouchableOpacity
            key={token.symbol}
            style={[
              styles.tokenCard,
              {
                backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
              },
            ]}
            activeOpacity={0.7}
            onPress={() => handleTokenPress(token)}
          >
            <View style={styles.tokenHeader}>
              <Text style={[styles.tokenSymbol, { color: colors.text }]}>
                {token.symbol}
              </Text>
              <Text style={[styles.tokenName, { color: colors.textSecondary }]}>
                {token.name}
              </Text>
            </View>

            <View style={styles.tokenBody}>
              <Text style={[styles.tokenPrice, { color: colors.text }]}>
                {formatPrice(token.price)}
              </Text>
            </View>

            <View style={styles.tokenFooter}>
              <View
                style={[
                  styles.changeContainer,
                  {
                    backgroundColor:
                      token.change24h >= 0
                        ? 'rgba(34, 197, 94, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                  },
                ]}
              >
                <Ionicons
                  name={token.change24h >= 0 ? 'trending-up' : 'trending-down'}
                  size={12}
                  color={token.change24h >= 0 ? '#22c55e' : '#ef4444'}
                />
                <Text
                  style={[
                    styles.changeText,
                    { color: token.change24h >= 0 ? '#22c55e' : '#ef4444' },
                  ]}
                >
                  {formatChange(token.change24h)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Modal de Detalhes do Token */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedToken?.name} ({selectedToken?.symbol})
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedToken && (
                <>
                  {/* Gráfico de Evolução */}
                  <View style={styles.chartSection}>
                    {loadingChart ? (
                      <View style={styles.chartLoading}>
                        <ActivityIndicator size="large" color={colors.primary} />
                      </View>
                    ) : chartData ? (
                      <PortfolioChart
                        localEvolutionData={chartData}
                        onPeriodChange={handlePeriodChange}
                        currentPeriod={chartPeriod}
                      />
                    ) : (
                      <View style={styles.chartLoading}>
                        <Text style={[styles.errorText, { color: colors.textSecondary, textAlign: 'center' }]}>
                          ⚠️ Gráfico não disponível{'\n'}
                          <Text style={{ fontSize: typography.micro }}>
                            Pode ser um problema temporário da API
                          </Text>
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Preço Atual */}
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Preço Atual
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {formatPrice(selectedToken.price)}
                    </Text>
                  </View>

                  {/* Variação 24h */}
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Variação 24h
                    </Text>
                    <View style={styles.detailRow}>
                      <Text style={[
                        styles.detailValue,
                        { color: selectedToken.change24h >= 0 ? '#22c55e' : '#ef4444' }
                      ]}>
                        {formatChange(selectedToken.change24h)}
                      </Text>
                      <Ionicons
                        name={selectedToken.change24h >= 0 ? 'trending-up' : 'trending-down'}
                        size={20}
                        color={selectedToken.change24h >= 0 ? '#22c55e' : '#ef4444'}
                      />
                    </View>
                  </View>

                  {/* Volume 24h */}
                  {selectedToken.volume24h && (
                    <View style={styles.detailSection}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        Volume 24h
                      </Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        ${selectedToken.volume24h.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </Text>
                    </View>
                  )}

                  {/* Informações Adicionais */}
                  <View style={[styles.infoBox, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                      💡 Dados em tempo real fornecidos por CoinGecko
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: typography.caption,  // 14px - Mesmo tamanho das abas
    fontWeight: fontWeights.semibold,
  },
  updateTime: {
    fontSize: typography.micro,  // 12px - Timestamps
    fontWeight: fontWeights.medium,
    marginTop: 2,
    opacity: 0.7,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
  refreshIcon: {
    fontSize: typography.h4,
    fontWeight: fontWeights.light,
    opacity: 0.6,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: typography.caption,  // 14px - Helper text
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: typography.caption,  // 14px - Botão secundário
    fontWeight: fontWeights.semibold,
  },
  scrollContent: {
    gap: 10,
    paddingRight: 12,
  },
  tokenCard: {
    width: 120,
    padding: 10,
    borderRadius: 10,
  },
  tokenHeader: {
    marginBottom: 6,
  },
  tokenSymbol: {
    fontSize: typography.caption,  // 14px - Texto principal
    fontWeight: fontWeights.semibold,
    marginBottom: 1,
  },
  tokenName: {
    fontSize: typography.tiny,  // 11px - Metadados
    fontWeight: fontWeights.regular,
  },
  tokenBody: {
    marginBottom: 6,
  },
  tokenPrice: {
    fontSize: typography.body,  // 16px - Valor destacado
    fontWeight: fontWeights.medium,
  },
  tokenFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  changeText: {
    fontSize: typography.micro,  // 12px - Badges/variações
    fontWeight: fontWeights.medium,  // Reduzido de semibold para medium
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: typography.h3,  // 20px
    fontWeight: fontWeights.semibold,
    flex: 1,
  },
  modalBody: {
    flex: 1,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: typography.caption,  // 14px
    fontWeight: fontWeights.medium,
    marginBottom: 8,
  },
  detailValue: {
    fontSize: typography.h4,  // 18px
    fontWeight: fontWeights.semibold,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    fontSize: typography.caption,  // 14px
    lineHeight: 20,
  },
  chartSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  chartLoading: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
