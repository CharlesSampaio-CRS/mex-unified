/**
 * Tela de Favoritos (Watchlist)
 * Mostra tokens marcados como favoritos pelo usuário
 */

import { View, StyleSheet } from 'react-native';
import { memo, useState, useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useHeader } from '@/contexts/HeaderContext';
import { NotificationsModal } from '@/components/NotificationsModal';
import { WatchlistFavorites } from '@/components/watchlist-favorites';

export const FavoritesScreen = memo(function FavoritesScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { watchlist } = useWatchlist();
  const { unreadCount } = useNotifications();
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);

  const onNotificationsPress = useCallback(() => {
    setNotificationsModalVisible(true);
  }, []);

  const headerSubtitle = useMemo(() => {
    return `${watchlist.length} ${watchlist.length === 1 ? 'token' : 'tokens'} marcados`;
  }, [watchlist.length]);

  useHeader({
    title: 'Favoritos',
    subtitle: headerSubtitle,
    onNotificationsPress,
    unreadCount,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <WatchlistFavorites />

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
});
