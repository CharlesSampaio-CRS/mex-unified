/**
 * Tela de Alertas de Preço
 * Mostra todos os alertas configurados e permite criar novos
 */

import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { memo, useState, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlerts } from '@/contexts/AlertsContext';
import { useBalance } from '@/contexts/BalanceContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useHeader } from '@/contexts/HeaderContext';
import { NotificationsModal } from '@/components/NotificationsModal';
import { AlertsList } from '@/components/price-alerts-list';
import { CreateAlertModal } from '@/components/create-price-alert-modal';
import { getExchangeId, getExchangeName } from '@/lib/exchange-helpers';
import { typography, fontWeights } from '@/lib/typography';

export const AlertsScreen = memo(function AlertsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { alerts, activeAlerts } = useAlerts();
  const { data: balanceData } = useBalance();
  const { unreadCount } = useNotifications();
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [newAlertModalVisible, setNewAlertModalVisible] = useState(false);

  const onNotificationsPress = useCallback(() => {
    setNotificationsModalVisible(true);
  }, []);

  const headerSubtitle = useMemo(() => {
    return `${activeAlerts.length} ativos de ${alerts.length} total`;
  }, [activeAlerts.length, alerts.length]);

  useHeader({
    title: '🔔 Alertas',
    subtitle: headerSubtitle,
    onNotificationsPress,
    unreadCount,
  });

  // Exchanges disponíveis (do balance)
  const availableExchanges = useMemo(() => {
    if (!balanceData?.exchanges) return [];
    return balanceData.exchanges
      .filter(e => e.success)
      .map(e => ({
        id: getExchangeId(e),
        name: getExchangeName(e),
      }))
      .filter(e => e.id && e.name);
  }, [balanceData]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Barra de ação: botão Nova */}
      <View style={[styles.actionBar, { borderBottomColor: colors.border }]}>
        <Text style={[styles.actionBarLabel, { color: colors.textSecondary }]}>
          {alerts.length} {alerts.length === 1 ? 'alerta configurado' : 'alertas configurados'}
        </Text>
        <TouchableOpacity
          style={[styles.newAlertButton, { borderColor: colors.primary }]}
          onPress={() => setNewAlertModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add-outline" size={14} color={colors.primary} />
          <Text style={[styles.newAlertText, { color: colors.primary }]}>Nova</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Alertas */}
      <AlertsList exchanges={availableExchanges} />

      {/* Modal de Novo Alerta (genérico - escolher exchange + token) */}
      <CreateAlertModal
        visible={newAlertModalVisible}
        onClose={() => setNewAlertModalVisible(false)}
        exchanges={availableExchanges}
      />

      <NotificationsModal
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  actionBarLabel: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },
  newAlertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  newAlertText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
  },
});
