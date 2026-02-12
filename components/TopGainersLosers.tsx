import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useBalance } from '../contexts/BalanceContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

interface TokenWithChange {
  symbol: string;
  name: string;
  price: number;
  change: number;
  value_usd: number;
  exchange: string;
}

type ModalType = 'gainers' | 'losers' | null;

export const TopGainersLosers: React.FC = () => {
  const { colors } = useTheme();
  const { data, isLoading } = useBalance();
  const { t } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);

  // Processa tokens do BalanceContext e separa gainers/losers
  const { topGainers, topLosers, allGainers, allLosers } = useMemo(() => {
    if (!data?.exchanges) {
      return { topGainers: [], topLosers: [], allGainers: [], allLosers: [] };
    }

    const allTokens: TokenWithChange[] = [];

    // Coleta todos os tokens com suas variações
    data.exchanges.forEach(exchange => {
      // ✅ FIXED: Suporta ambas estruturas (balances e tokens)
      const items = exchange.balances || exchange.tokens;
      if (!items || typeof items !== 'object') {
        return;
      }

      Object.entries(items).forEach(([symbol, item]) => {
        // ✅ FIXED: Suporta ambas estruturas
        const amount = (item as any).total || parseFloat((item as any).amount || '0');
        const valueUsd = (item as any).usd_value || parseFloat((item as any).value_usd || '0');
        
        if (amount <= 0 || isNaN(amount) || isNaN(valueUsd) || valueUsd <= 0) {
          return;
        }

        // Pega change_24h do token (já vem do balance)
        let change24h = 0;
        const changeValue = (item as any).change_24h;
        if (changeValue !== undefined && changeValue !== null) {
          const parsed = typeof changeValue === 'number' ? changeValue : parseFloat(changeValue);
          if (!isNaN(parsed)) {
            change24h = parsed;
          }
        }
        
        // ✅ AGORA INCLUI tokens com variação 0 (estáveis)
        
        allTokens.push({
          symbol,
          name: symbol,
          price: valueUsd / amount,
          change: change24h,
          value_usd: valueUsd,
          exchange: exchange.name || exchange.exchange || 'Unknown',
        });
      });
    });

    if (allTokens.length === 0) {
      return { topGainers: [], topLosers: [], allGainers: [], allLosers: [] };
    }

    // Remove duplicatas (mantém maior variação absoluta)
    const tokenMap = new Map<string, TokenWithChange>();
    allTokens.forEach(token => {
      const existing = tokenMap.get(token.symbol);
      if (!existing || Math.abs(token.change) > Math.abs(existing.change)) {
        tokenMap.set(token.symbol, token);
      }
    });

    const uniqueTokens = Array.from(tokenMap.values());
    // Separa em 2 categorias:
    // 1️⃣ Maiores Altas: apenas positivos (ordenados)
    const allGainers = uniqueTokens
      .filter(t => t.change > 0)
      .sort((a, b) => b.change - a.change);
    
    // 2️⃣ Maiores Baixas: apenas negativos (ordenados)
    const allLosers = uniqueTokens
      .filter(t => t.change < 0)
      .sort((a, b) => a.change - b.change);


    // Top 3 de cada categoria para exibição inicial
    const topGainers = allGainers.slice(0, 3);
    const topLosers = allLosers.slice(0, 3);

    return {
      topGainers,
      topLosers,
      allGainers,
      allLosers,
    };
  }, [data]);

  // Funções para abrir o modal
  const openGainersModal = () => {
    setModalType('gainers');
    setModalVisible(true);
  };

  const openLosersModal = () => {
    setModalType('losers');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setTimeout(() => setModalType(null), 300); // Delay para animação
  };

  const formatPrice = (price: number) => {
    // Tokens muito baratos (< $0.00000001) - até 10 dígitos
    if (price < 0.00000001) {
      return `$${price.toFixed(10)}`;
    }
    // Tokens baratos (< $0.001) - 8 dígitos
    if (price < 0.001) {
      return `$${price.toFixed(8)}`;
    }
    // Tokens médio-baratos (< $0.01) - 6 dígitos
    if (price < 0.01) {
      return `$${price.toFixed(6)}`;
    }
    // Tokens normais (>= $0.01) - 2 dígitos com separador de milhar
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  const renderTokenItem = (token: TokenWithChange, isGainer: boolean) => {
    const changeColor = isGainer ? colors.success : colors.danger;
    const icon = isGainer ? 'trending-up' : 'trending-down';

    return (
      <TouchableOpacity
        key={`${token.symbol}-${token.exchange}`}
        style={[styles.tokenItem, { backgroundColor: colors.surface }]}
        activeOpacity={0.7}
      >
        <View style={styles.tokenLeft}>
          <Ionicons 
            name={icon as any} 
            size={20} 
            color={changeColor} 
            style={styles.tokenIcon}
          />
          <View style={styles.tokenInfo}>
            <Text style={[styles.tokenSymbol, { color: colors.text }]}>
              {token.symbol}
            </Text>
            <Text style={[styles.tokenExchange, { color: colors.textSecondary }]}>
              {token.exchange}
            </Text>
          </View>
        </View>

        <View style={styles.tokenRight}>
          <Text style={[styles.tokenPrice, { color: colors.text }]}>
            {formatPrice(token.price)}
          </Text>
          <View style={[styles.changeContainer, { backgroundColor: changeColor + '20' }]}>
            <Text style={[styles.changeText, { color: changeColor }]}>
              {formatChange(token.change)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = (text: string) => (
    <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );

  // SEMPRE renderiza os cards, mesmo sem dados
  return (
    <View style={styles.container}>
      {/* Top Gainers - Maiores Altas (24h) */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <View style={styles.header}>
          <Ionicons name="trending-up" size={20} color={colors.success} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('topGainersLosers.gainersTitle')}
          </Text>
        </View>
        
        <View style={styles.tokensList}>
          {isLoading ? (
            // Mostra skeleton enquanto carrega
            <>
              {[1, 2, 3].map((i) => (
                <View key={i} style={[styles.tokenItem, { backgroundColor: colors.surface }]}>
                  <View style={styles.tokenLeft}>
                    <View style={[styles.skeletonIcon, { backgroundColor: colors.border }]} />
                    <View style={styles.tokenInfo}>
                      <View style={[styles.skeletonText, { backgroundColor: colors.border, width: 60, height: 14 }]} />
                      <View style={[styles.skeletonText, { backgroundColor: colors.border, width: 40, height: 12, marginTop: 4 }]} />
                    </View>
                  </View>
                  <View style={[styles.skeletonText, { backgroundColor: colors.border, width: 70, height: 16 }]} />
                </View>
              ))}
            </>
          ) : topGainers.length > 0 ? (
            <>
              {/* Mostra dados reais */}
              {topGainers.map(token => renderTokenItem(token, true))}
              
              {/* Botão Ver mais (apenas se houver mais de 3) */}
              {allGainers.length > 3 && (
                <TouchableOpacity
                  style={[styles.viewMoreButton, { backgroundColor: colors.success + '15', borderColor: colors.success }]}
                  onPress={openGainersModal}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.viewMoreText, { color: colors.success }]}>
                    {t('topGainersLosers.viewAll')} ({allGainers.length})
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.success} />
                </TouchableOpacity>
              )}
            </>
          ) : (
            // Mostra estado vazio
            renderEmptyState(t('topGainersLosers.noGainers'))
          )}
        </View>
      </View>

      {/* Top Losers - Maiores Baixas (24h) */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <View style={styles.header}>
          <Ionicons name="trending-down" size={20} color={colors.danger} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('topGainersLosers.losersTitle')}
          </Text>
        </View>
        
        <View style={styles.tokensList}>
          {isLoading ? (
            // Mostra skeleton enquanto carrega
            <>
              {[1, 2, 3].map((i) => (
                <View key={i} style={[styles.tokenItem, { backgroundColor: colors.surface }]}>
                  <View style={styles.tokenLeft}>
                    <View style={[styles.skeletonIcon, { backgroundColor: colors.border }]} />
                    <View style={styles.tokenInfo}>
                      <View style={[styles.skeletonText, { backgroundColor: colors.border, width: 60, height: 14 }]} />
                      <View style={[styles.skeletonText, { backgroundColor: colors.border, width: 40, height: 12, marginTop: 4 }]} />
                    </View>
                  </View>
                  <View style={[styles.skeletonText, { backgroundColor: colors.border, width: 70, height: 16 }]} />
                </View>
              ))}
            </>
          ) : topLosers.length > 0 ? (
            <>
              {/* Mostra dados reais */}
              {topLosers.map(token => renderTokenItem(token, false))}
              
              {/* Botão Ver mais (apenas se houver mais de 3) */}
              {allLosers.length > 3 && (
                <TouchableOpacity
                  style={[styles.viewMoreButton, { backgroundColor: colors.danger + '15', borderColor: colors.danger }]}
                  onPress={openLosersModal}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.viewMoreText, { color: colors.danger }]}>
                    {t('topGainersLosers.viewAll')} ({allLosers.length})
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.danger} />
                </TouchableOpacity>
              )}
            </>
          ) : (
            // Mostra estado vazio
            renderEmptyState(t('topGainersLosers.noLosers'))
          )}
        </View>
      </View>

      {/* Modal com lista completa */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={styles.modalSafeArea} onPress={(e: any) => e.stopPropagation()}>
            <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
              {/* Header do Modal */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.modalTitleContainer}>
                  <Ionicons
                    name={modalType === 'gainers' ? 'trending-up' : 'trending-down'}
                    size={24}
                    color={modalType === 'gainers' ? colors.success : colors.danger}
                  />
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {modalType === 'gainers' 
                      ? t('topGainersLosers.allGainersTitle') 
                      : t('topGainersLosers.allLosersTitle')
                    }
                  </Text>
                </View>
                <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                  <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Lista completa */}
              <ScrollView style={styles.modalContent}>
                {(modalType === 'gainers' ? allGainers : allLosers).map((token, index) => (
                  <View key={`${token.symbol}-${token.exchange}-${index}`}>
                    {renderTokenItem(token, modalType === 'gainers')}
                  </View>
                ))}
              </ScrollView>

              {/* Footer com contador */}
              <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                  {t('topGainersLosers.total')}: {modalType === 'gainers' ? allGainers.length : allLosers.length} {t('topGainersLosers.tokens')}
                </Text>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  card: {
    borderRadius: 8,
    padding: 12,
  },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  skeletonText: {
    borderRadius: 4,
  },
  skeletonIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  tokensList: {
    gap: 8,
  },
  tokenItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  tokenIcon: {
    width: 20,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  tokenExchange: {
    fontSize: 11,
  },
  tokenRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  tokenPrice: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  changeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Botão Ver mais
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Modal - Mesmo estilo do order-details-modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSafeArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  modalContainer: {
    borderRadius: 20,
    width: '90%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '300',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
