/**
 * Lista de Alertas de Preço Ativos
 * Mostra todos os alertas configurados pelo usuário
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlerts } from '../contexts/AlertsContext';
import {
  TokenAlert,
  formatAlertCondition,
  getAlertIcon,
  getAlertFrequencyLabel,
} from '../types/alerts';
import { CreateAlertModal } from './create-price-alert-modal';
import { typography, fontWeights } from '@/lib/typography';
import { GenericItemList } from './GenericItemList';
import { ConfirmModal } from './ConfirmModal';

interface AlertsListProps {
  filterSymbol?: string;
  exchanges?: Array<{ id: string; name: string }>;
}

export function AlertsList({ filterSymbol, exchanges }: AlertsListProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const {
    alerts,
    activeAlerts,
    loading,
    toggleAlert,
    deleteAlert,
    refreshAlerts,
    isMonitoring,
  } = useAlerts();

  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [alertToDelete, setAlertToDelete] = useState<TokenAlert | null>(null);

  // Filtrar alertas se filterSymbol for fornecido
  const filteredAlerts = filterSymbol
    ? alerts.filter(a => a.symbol === filterSymbol.toUpperCase())
    : alerts;

  // Refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAlerts();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAlerts]);

  // Toggle alerta
  const handleToggle = useCallback(async (alertId: string, currentEnabled: boolean) => {
    try {
      await toggleAlert(alertId, !currentEnabled);
    } catch (err) {
      console.error('[AlertsList] Erro ao alternar alerta:', err);
    }
  }, [toggleAlert]);

  // Deletar alerta
  const handleDelete = useCallback((alert: TokenAlert) => {
    console.log('[AlertsList] 🗑️ handleDelete chamado para:', alert.symbol, alert.id);
    setAlertToDelete(alert);
    setConfirmModalVisible(true);
  }, []);

  // Confirmar deleção
  const confirmDelete = useCallback(async () => {
    if (!alertToDelete) return;
    
    console.log('[AlertsList] ✅ Confirmado! Removendo alerta:', alertToDelete.id);
    try {
      await deleteAlert(alertToDelete.id);
      console.log('[AlertsList] ✅ Alerta removido com sucesso');
    } catch (err) {
      console.error('[AlertsList] ❌ Erro ao remover alerta:', err);
    } finally {
      setAlertToDelete(null);
    }
  }, [alertToDelete, deleteAlert]);

  // Transform alerts to GenericItemList format - Grouped by Exchange/Status
  const alertSections = useMemo(() => {
    const exchangeMap = new Map<string, { exchangeId: string; exchangeName: string; items: any[] }>();
    const withoutExchange: any[] = [];

    // Sort: active first, then by creation date
    const sortedAlerts = [...filteredAlerts].sort((a, b) => {
      if (a.enabled !== b.enabled) return b.enabled ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    sortedAlerts.forEach(alert => {
      const alertData = {
        id: alert.id,
        symbol: alert.symbol,
        enabled: alert.enabled,
        status: alert.status,
        condition: alert.condition,
        alertType: alert.alertType,
        value: alert.value, // Preço alvo ou porcentagem
        currentPrice: alert.lastCheckedPrice || 0,
        frequency: alert.frequency,
        triggerCount: alert.triggerCount,
        lastTriggeredAt: alert.lastTriggeredAt,
        message: alert.message,
        exchangeId: alert.exchangeId,
        exchangeName: alert.exchangeName,
        createdAt: alert.createdAt,
        // GenericItemList required fields
        amount: 0,
        free: 0,
        used: 0,
        priceUSD: alert.value, // Usa value como preço
        valueUSD: 0,
        variation24h: null,
        isStablecoin: false,
        usdtBalance: 0,
        exchanges: alert.exchangeName ? [alert.exchangeName] : [],
      };

      // Group by exchange if available
      if (alert.exchangeId && alert.exchangeName) {
        if (!exchangeMap.has(alert.exchangeId)) {
          exchangeMap.set(alert.exchangeId, {
            exchangeId: alert.exchangeId,
            exchangeName: alert.exchangeName,
            items: []
          });
        }
        exchangeMap.get(alert.exchangeId)!.items.push(alertData);
      } else {
        withoutExchange.push(alertData);
      }
    });

    // Convert to array
    const sections: any[] = Array.from(exchangeMap.values()).map(section => ({
      ...section,
      loading: false,
    })).sort((a, b) => a.exchangeName.localeCompare(b.exchangeName));

    // Add "Todos os Alertas" section if there are alerts without exchange
    if (withoutExchange.length > 0) {
      sections.push({
        exchangeId: 'all-alerts',
        exchangeName: 'Todos os Alertas',
        items: withoutExchange,
        loading: false,
      });
    }

    return sections;
  }, [filteredAlerts]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Status do Monitoramento */}
      <View style={[styles.monitoringStatus, { backgroundColor: colors.surface }]}>
        <View style={styles.monitoringStatusLeft}>
          <View style={[
            styles.monitoringIndicator,
            { backgroundColor: isMonitoring ? '#22c55e' : '#ef4444' }
          ]} />
          <Text style={[styles.monitoringText, { color: colors.text }]}>
            Monitoramento {isMonitoring ? 'Ativo' : 'Pausado'}
          </Text>
        </View>
        <Ionicons 
          name={isMonitoring ? 'checkmark-circle' : 'alert-circle'} 
          size={20} 
          color={isMonitoring ? '#22c55e' : '#ef4444'} 
        />
      </View>

      {/* Lista */}
      {loading && alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              {t('alerts.loadingAlerts')}
            </Text>
          </View>
        ) : filteredAlerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
              {t('alerts.noAlerts')}
            </Text>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              {t('alerts.noAlertsDesc')}
            </Text>
            <TouchableOpacity
              style={[styles.emptyStateButton, { backgroundColor: colors.primary }]}
              onPress={() => setCreateModalVisible(true)}
            >
              <Text style={[styles.emptyStateButtonText, { color: '#FFFFFF' }]}>
                {t('alerts.createButton')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ padding: 16 }}>
            <GenericItemList
              sections={alertSections}
              config={{
                renderBadge: (item, colors) => {
                  // Status Badge
                  if (item.status === 'triggered') {
                    return (
                      <View style={[styles.statusBadge, { backgroundColor: '#22c55e15' }]}>
                        <Text style={[styles.statusText, { color: '#22c55e' }]}>
                          ✓ Disparado
                        </Text>
                      </View>
                    );
                  }
                  
                  if (item.status === 'paused') {
                    return (
                      <View style={[styles.statusBadge, { backgroundColor: '#f59e0b15' }]}>
                        <Text style={[styles.statusText, { color: '#f59e0b' }]}>
                          ⏸ Pausado
                        </Text>
                      </View>
                    );
                  }

                  // Alert icon - apenas para alertas sem status especial
                  if (item.enabled && item.status === 'active') {
                    return (
                      <Text style={styles.alertIcon}>{getAlertIcon(item.condition)}</Text>
                    );
                  }

                  return null;
                },
                renderSubtitle: (item, colors) => {
                  const alert = item as any; // Cast para acessar propriedades do alerta
                  return (
                    <View style={styles.alertSubtitle}>
                      {/* Condição */}
                      <Text style={[styles.conditionText, { color: colors.text }]}>
                        {formatAlertCondition(alert as TokenAlert)}
                      </Text>
                      
                      {/* Metadados */}
                      <View style={styles.alertMeta}>
                        <View style={styles.metaItem}>
                          <Ionicons name="repeat-outline" size={12} color={colors.textTertiary} />
                          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                            {getAlertFrequencyLabel(alert.frequency)}
                          </Text>
                        </View>

                        {alert.triggerCount > 0 && (
                          <View style={styles.metaItem}>
                            <Ionicons name="notifications-outline" size={12} color={colors.textTertiary} />
                            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                              Disparado {alert.triggerCount}x
                            </Text>
                          </View>
                        )}

                        {alert.lastTriggeredAt && (
                          <View style={styles.metaItem}>
                            <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                              {new Date(alert.lastTriggeredAt).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Mensagem customizada */}
                      {alert.message && (
                        <View style={[styles.customMessage, { backgroundColor: colors.background }]}>
                          <Ionicons name="chatbubble-outline" size={12} color={colors.textTertiary} />
                          <Text style={[styles.customMessageText, { color: colors.textSecondary }]}>
                            {alert.message}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                },
                renderDetails: () => [],
                buttons: {
                  primary: {
                    label: (item: any) => item.enabled ? 'Pausar' : 'Ativar',
                    onPress: (item: any) => handleToggle(item.id, item.enabled)
                  },
                  secondary: {
                    label: 'Remover',
                    onPress: (item: any) => {
                      console.log('[AlertsList] 🔘 Botão Remover clicado! Item:', item.id, item.symbol);
                      
                      // Constrói um TokenAlert válido a partir do item
                      const alert: TokenAlert = {
                        id: item.id,
                        symbol: item.symbol,
                        enabled: item.enabled,
                        status: item.status,
                        condition: item.condition,
                        alertType: item.alertType,
                        value: item.value,
                        lastCheckedPrice: item.currentPrice,
                        frequency: item.frequency,
                        triggerCount: item.triggerCount,
                        lastTriggeredAt: item.lastTriggeredAt,
                        message: item.message,
                        exchangeId: item.exchangeId,
                        exchangeName: item.exchangeName,
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt || new Date().toISOString(),
                        userId: '',
                        notificationSent: false,
                      };
                      
                      console.log('[AlertsList] 📦 TokenAlert construído:', alert);
                      handleDelete(alert);
                    }
                  }
                },
                getItemId: (item) => item.id,
                processingItemId: null
              }}
            />
          </View>
        )}

      {/* Modal de Confirmação de Remoção */}
      <ConfirmModal
        visible={confirmModalVisible}
        onClose={() => {
          setConfirmModalVisible(false);
          setAlertToDelete(null);
        }}
        onConfirm={confirmDelete}
        title={t('alerts.removeAlert')}
        message={`${t('common.confirm')}? ${alertToDelete?.symbol}`}
        confirmText={t('common.remove')}
        cancelText={t('common.cancel')}
        confirmColor="#ef4444"
        icon="🗑️"
      />

      {/* Modal de Criar Alerta */}
      <CreateAlertModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        exchanges={exchanges}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  monitoringStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
  },
  monitoringStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monitoringIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  monitoringText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: typography.icon,
    fontWeight: fontWeights.semibold,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: typography.body,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    fontSize: typography.bodyLarge,
    fontWeight: fontWeights.semibold,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
  },
  alertIcon: {
    fontSize: typography.displaySmall,
  },
  alertSubtitle: {
    gap: 8,
  },
  conditionText: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },
  alertMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: typography.caption,
  },
  customMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  customMessageText: {
    fontSize: typography.caption,
    flex: 1,
  },
});
