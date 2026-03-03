import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { GradientCard } from './GradientCard';
import { typography, fontWeights } from '../lib/typography';

// Tipo genérico para o item
interface GenericItem {
  id: string;
  symbol: string;
  [key: string]: any;
}

// Configuração para renderização
interface ItemConfig<T extends GenericItem> {
  // Função para renderizar o botão de favorito no header
  renderFavoriteButton?: (item: T, colors: any) => React.ReactNode;
  
  // Função para renderizar o badge no header (ex: COMPRA/VENDA ou variação)
  renderBadge: (item: T, colors: any) => React.ReactNode;
  
  // Função para renderizar o texto abaixo do header (ex: data/hora)
  renderSubtitle?: (item: T, colors: any) => React.ReactNode;
  
  // Função para renderizar as 3 linhas de detalhes
  renderDetails: (item: T, colors: any) => Array<{ label: string; value: string; bold?: boolean }>;
  
  // Configuração dos botões
  buttons?: {
    primary: {
      label: string | ((item: T) => string); // 🆕 Aceita string ou função
      onPress: (item: T) => void;
      visible?: (item: T) => boolean; // Controla se o botão deve aparecer
    };
    secondary: {
      label: string | ((item: T) => string); // 🆕 Aceita string ou função
      onPress: (item: T) => void;
      loading?: boolean;
      loadingText?: string;
      visible?: (item: T) => boolean; // Controla se o botão deve aparecer
    };
  };
  
  // Função para pegar o ID do item para loading state
  getItemId: (item: T) => string;
  
  // ID do item que está sendo processado (para loading state)
  processingItemId?: string | null;
}

// Props para uma exchange/section
interface ExchangeSection<T extends GenericItem> {
  exchangeId: string;
  exchangeName: string;
  items: T[];
  loading?: boolean;
}

// Props do componente
interface GenericItemListProps<T extends GenericItem> {
  sections: ExchangeSection<T>[];
  config: ItemConfig<T>;
  emptyMessage?: string;
}

export function GenericItemList<T extends GenericItem>({
  sections,
  config,
  emptyMessage = 'Nenhum item encontrado'
}: GenericItemListProps<T>) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  // Calcula total de itens
  const totalItems = sections.reduce((sum, section) => sum + section.items.length, 0);

  // Se não houver itens
  if (totalItems === 0 && !sections.some(s => s.loading)) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return (
    <>
      {sections.map((section) => {
        // Mostra exchange mesmo sem itens (para exchanges vazias)
        // if (section.items.length === 0 && !section.loading) return null;

        return (
          <View key={section.exchangeId} style={styles.exchangeSection}>
            {/* Header da exchange */}
            <View style={[styles.exchangeHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.exchangeName, { color: colors.text }]}>
                {section.exchangeName}
              </Text>
              {section.loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator size="small" />
                  <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
                    {t('common.loading')}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
                  {section.items.length} {section.items.length === 1 ? t('genericList.item') : t('genericList.items')}
                </Text>
              )}
            </View>

            {/* Loading state */}
            {section.loading ? (
              <View style={[styles.loadingContainer, { backgroundColor: colors.surface }]}>
                <ActivityIndicator size="small" />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  {t('common.loading')}
                </Text>
              </View>
            ) : section.items.length === 0 ? (
              /* Exchange sem tokens */
              <View style={[styles.emptySection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
                  {t('genericList.noTokenInExchange')}
                </Text>
              </View>
            ) : (
              /* Lista de itens */
              section.items.map((item, index) => {
                const details = config.renderDetails(item, colors);
                const isProcessing = config.processingItemId === config.getItemId(item);

                return (
                  <GradientCard
                    key={config.getItemId(item) || index}
                    style={[
                      styles.itemCard,
                      { borderColor: colors.border }
                    ]}
                  >
                    {/* Header do card */}
                    <View style={styles.itemHeader}>
                      <View style={styles.symbolWithFavorite}>
                        <Text style={[styles.itemSymbol, { color: colors.text }]}>
                          {item.symbol}
                        </Text>
                        {config.renderFavoriteButton && config.renderFavoriteButton(item, colors)}
                      </View>
                      {config.renderBadge(item, colors)}
                    </View>

                    {config.renderSubtitle && (
                      <View style={styles.itemSubtitle}>
                        {config.renderSubtitle(item, colors)}
                      </View>
                    )}

                    {/* Detalhes (3 linhas) */}
                    <View style={styles.itemDetails}>
                      {details.map((detail, idx) => (
                        <View key={idx} style={styles.detailRow}>
                          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                            {detail.label}
                          </Text>
                          <Text style={[
                            styles.detailValue,
                            { color: colors.text },
                            detail.bold && { fontWeight: fontWeights.semibold }
                          ]}>
                            {detail.value}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Botões de ação */}
                    {config.buttons && (
                      <View style={styles.actionButtons}>
                        {/* Botão primário (Ver Detalhes) */}
                        {(!config.buttons.primary.visible || config.buttons.primary.visible(item)) && (
                          <TouchableOpacity
                            style={[
                              styles.detailsButton,
                              { backgroundColor: colors.surface, borderColor: colors.border }
                            ]}
                            onPress={() => config.buttons!.primary.onPress(item)}
                          >
                            <Text style={[styles.detailsButtonText, { color: colors.primary }]}>
                              {typeof config.buttons.primary.label === 'function' 
                                ? config.buttons.primary.label(item) 
                                : config.buttons.primary.label}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Botão secundário (Negociar/Cancelar) */}
                        {(!config.buttons.secondary.visible || config.buttons.secondary.visible(item)) && (
                          <TouchableOpacity
                            style={[
                              styles.actionButton,
                              { backgroundColor: 'transparent', borderColor: colors.success },
                              isProcessing && styles.actionButtonDisabled
                            ]}
                            onPress={() => {
                              console.log('[GenericItemList] 🔘 Botão secundário clicado:', item.id, item.symbol);
                              config.buttons!.secondary.onPress(item);
                            }}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <>
                                <ActivityIndicator size="small" />
                                <Text style={[styles.actionButtonText, { color: colors.success }]}>
                                  {config.buttons.secondary.loadingText || 'Processando...'}
                                </Text>
                              </>
                            ) : (
                              <Text style={[styles.actionButtonText, { color: colors.success }]}>
                                {typeof config.buttons.secondary.label === 'function' 
                                  ? config.buttons.secondary.label(item) 
                                  : config.buttons.secondary.label}
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </GradientCard>
                );
              })
            )}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    padding: 32,              // Reduzido para mobile
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: typography.body,
    textAlign: 'center',
  },
  exchangeSection: {
    marginBottom: 12,         // Reduzido
  },
  exchangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,              // Reduzido
    borderRadius: 10,
    marginBottom: 6,          // Reduzido
  },
  exchangeName: {
    fontSize: typography.bodyLarge,
    fontWeight: fontWeights.semibold,
  },
  itemCount: {
    fontSize: typography.bodySmall,
  },
  loadingContainer: {
    padding: 16,              // Reduzido
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginBottom: 6,          // Reduzido
  },
  loadingText: {
    marginTop: 6,
    fontSize: typography.bodySmall,
  },
  emptySection: {
    padding: 16,              // Reduzido
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginBottom: 6,          // Reduzido
  },
  emptySectionText: {
    fontSize: typography.bodySmall,
    fontStyle: 'italic',
  },
  itemCard: {
    borderRadius: 12,
    padding: 12,              // Reduzido para mobile
    marginBottom: 6,          // Reduzido
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,         // Reduzido
  },
  symbolWithFavorite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemSymbol: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.2,
  },
  itemSubtitle: {
    marginTop: 4,
  },
  itemDetails: {
    gap: 5,                   // Reduzido
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: typography.bodySmall,
  },
  detailValue: {
    fontSize: typography.bodySmall,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,                   // Reduzido para mobile
    marginTop: 10,            // Reduzido
  },
  detailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,      // Reduzido para mobile
    paddingHorizontal: 16,    // Reduzido
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 40,            // Reduzido para mobile
  },
  detailsButtonText: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,                   // Reduzido
    paddingVertical: 10,      // Reduzido
    paddingHorizontal: 16,    // Reduzido
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 40,            // Reduzido para mobile
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
});
