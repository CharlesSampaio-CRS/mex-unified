/**
 * Gerenciador de Watchlist e Alertas
 * Tela com abas: Favoritos | Alertas
 */

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useState, useCallback, useMemo } from "react"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/contexts/ThemeContext"
import { useWatchlist } from "@/contexts/WatchlistContext"
import { useAlerts } from "@/contexts/AlertsContext"
import { useNotifications } from "@/contexts/NotificationsContext"
import { Header } from "./Header"
import { TabBar } from "./TabBar"
import { NotificationsModal } from "./NotificationsModal"
import { AlertsList } from "@/components/price-alerts-list"
import { WatchlistFavorites } from "@/components/watchlist-favorites"
import { spacing } from "@/lib/layout"

type TabType = 'favorites' | 'alerts'

export function WatchlistManager() {
  const { colors } = useTheme()
  const { watchlist } = useWatchlist()
  const { alerts, activeAlerts } = useAlerts()
  const { unreadCount } = useNotifications()
  const [activeTab, setActiveTab] = useState<TabType>('favorites')
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false)

  const onNotificationsPress = useCallback(() => {
    setNotificationsModalVisible(true)
  }, [])

  // Títulos e subtítulos dinâmicos baseados na aba ativa
  const headerTitle = activeTab === 'favorites' ? 'Favoritos' : 'Alertas'
  const headerSubtitle = useMemo(() => {
    if (activeTab === 'favorites') {
      return `${watchlist.length} ${watchlist.length === 1 ? 'token' : 'tokens'} marcados`
    } else {
      return `${activeAlerts.length} ativos de ${alerts.length} total`
    }
  }, [activeTab, watchlist.length, activeAlerts.length, alerts.length])

  // Tabs para o TabBar component
  const tabs = ['Favoritos', 'Alertas']
  const activeTabIndex = activeTab === 'favorites' ? 0 : 1

  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index === 0 ? 'favorites' : 'alerts')
  }, [])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        onNotificationsPress={onNotificationsPress}
        unreadCount={unreadCount}
        title={headerTitle}
        subtitle={headerSubtitle}
      />
      
      {/* TabBar padronizado */}
      <TabBar 
        tabs={tabs}
        activeTab={activeTabIndex}
        onTabChange={handleTabChange}
      />

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'favorites' ? (
          <WatchlistFavorites />
        ) : (
          <AlertsList />
        )}
      </View>

      {/* Modal de Notificações */}
      <NotificationsModal
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
})
