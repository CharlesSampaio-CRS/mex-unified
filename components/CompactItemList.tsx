import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { AnimatedLogoIcon } from './AnimatedLogoIcon';
import { CollapsibleAssetCard } from './CollapsibleAssetCard';

// Tipo genérico para o item
interface GenericItem {
  id: string;
  symbol: string;
  [key: string]: any;
}

// Configuração para renderização COMPACTA
interface CompactItemConfig<T extends GenericItem> {
  // Dados para o card compacto
  getValue: (item: T) => string;
  getVariation?: (item: T) => number | undefined;
  isStablecoin?: (item: T) => boolean;
  isFavorite?: (item: T) => boolean;
  onToggleFavorite?: (item: T) => void;
  
  // Renderização compacta customizada (opcional)
  renderCompactInfo?: (item: T, colors: any) => React.ReactNode;
  
  // Renderização expandida
  renderExpandedDetails: (item: T, colors: any) => Array<{ label: string; value: string; bold?: boolean }>;
  
  // Botões de ação
  buttons?: {
    primary: {
      label: string | ((item: T) => string);
      onPress: (item: T) => void;
      icon?: string;
      visible?: (item: T) => boolean;
    };
    secondary?: {
      label: string | ((item: T) => string);
      onPress: (item: T) => void;
      icon?: string;
      visible?: (item: T) => boolean;
      loading?: boolean;
    };
  };
  
  // ID do item sendo processado
  processingItemId?: string | null;
  getItemId: (item: T) => string;
}

// Props para uma exchange/section
interface ExchangeSection<T extends GenericItem> {
  exchangeId: string;
  exchangeName: string;
  items: T[];
  loading?: boolean;
}

// Props do componente
interface CompactItemListProps<T extends GenericItem> {
  sections: ExchangeSection<T>[];
  config: CompactItemConfig<T>;
  emptyMessage?: string;
}

export function CompactItemList<T extends GenericItem>({
  sections,
  config,
  emptyMessage = 'Nenhum item encontrado'
}: CompactItemListProps<T>) {
  const { colors } = useTheme();

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
        return (
          <View key={section.exchangeId} style={styles.exchangeSection}>
            {/* Header da exchange */}
            <View style={[styles.exchangeHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.exchangeName, { color: colors.text }]}>
                {section.exchangeName}
              </Text>
              {section.loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AnimatedLogoIcon size={14} />
                  <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
                    Carregando...
                  </Text>
                </View>
              ) : (
                <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
                  {section.items.length} {section.items.length === 1 ? 'item' : 'itens'}
                </Text>
              )}
            </View>

            {/* Loading state */}
            {section.loading ? (
              <View style={[styles.loadingContainer, { backgroundColor: colors.surface }]}>
                <AnimatedLogoIcon size={24} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Carregando...
                </Text>
              </View>
            ) : section.items.length === 0 ? (
              /* Exchange sem tokens */
              <View style={[styles.emptySection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
                  Nenhum token nesta exchange
                </Text>
              </View>
            ) : (
              /* Lista de itens com cards colapsáveis */
              section.items.map((item) => {
                const itemId = config.getItemId(item);
                const isProcessing = config.processingItemId === itemId;

                return (
                  <CollapsibleAssetCard
                    key={itemId}
                    symbol={item.symbol}
                    value={config.getValue(item)}
                    variation={config.getVariation ? config.getVariation(item) : undefined}
                    isFavorite={config.isFavorite ? config.isFavorite(item) : false}
                    isStablecoin={config.isStablecoin ? config.isStablecoin(item) : false}
                    onToggleFavorite={config.onToggleFavorite ? () => config.onToggleFavorite!(item) : undefined}
                    renderCompactContent={config.renderCompactInfo ? () => config.renderCompactInfo!(item, colors) : undefined}
                    renderExpandedContent={() => {
                      const details = config.renderExpandedDetails(item, colors);
                      return (
                        <View style={styles.detailsContainer}>
                          {details.map((detail, idx) => (
                            <View key={idx} style={styles.detailRow}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                {detail.label}
                              </Text>
                              <Text style={[
                                styles.detailValue,
                                { color: colors.text },
                                detail.bold && { fontWeight: '600' }
                              ]}>
                                {detail.value}
                              </Text>
                            </View>
                          ))}
                        </View>
                      );
                    }}
                    renderActions={config.buttons ? () => (
                      <View style={styles.actionButtons}>
                        {/* Primary button */}
                        {(!config.buttons!.primary.visible || config.buttons!.primary.visible(item)) && (
                          <TouchableOpacity
                            style={[
                              styles.primaryButton,
                              { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }
                            ]}
                            onPress={() => config.buttons!.primary.onPress(item)}
                          >
                            {config.buttons!.primary.icon && (
                              <Ionicons name={config.buttons!.primary.icon as any} size={16} color={colors.primary} />
                            )}
                            <Text style={[styles.buttonText, { color: colors.primary }]}>
                              {typeof config.buttons!.primary.label === 'function' 
                                ? config.buttons!.primary.label(item) 
                                : config.buttons!.primary.label}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Secondary button */}
                        {config.buttons!.secondary && (!config.buttons!.secondary.visible || config.buttons!.secondary.visible(item)) && (
                          <TouchableOpacity
                            style={[
                              styles.secondaryButton,
                              { backgroundColor: colors.success + '15', borderColor: colors.success + '40' },
                              isProcessing && styles.buttonDisabled
                            ]}
                            onPress={() => config.buttons!.secondary!.onPress(item)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <>
                                <AnimatedLogoIcon size={14} />
                                <Text style={[styles.buttonText, { color: colors.success }]}>
                                  Processando...
                                </Text>
                              </>
                            ) : (
                              <>
                                {config.buttons!.secondary.icon && (
                                  <Ionicons name={config.buttons!.secondary.icon as any} size={16} color={colors.success} />
                                )}
                                <Text style={[styles.buttonText, { color: colors.success }]}>
                                  {typeof config.buttons!.secondary.label === 'function' 
                                    ? config.buttons!.secondary.label(item) 
                                    : config.buttons!.secondary.label}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : undefined}
                  />
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
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  exchangeSection: {
    marginBottom: 16,
  },
  exchangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  exchangeName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemCount: {
    fontSize: 12,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginBottom: 8,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
  },
  emptySection: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  emptySectionText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  detailsContainer: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
