import { StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useState, useCallback, useEffect } from "react"
import { ExchangesManager } from "../components/exchanges-manager"
import { useHeader } from "../contexts/HeaderContext"
import { NotificationsModal } from "../components/NotificationsModal"
import { useTheme } from "../contexts/ThemeContext"
import { useNotifications } from "../contexts/NotificationsContext"
import { useLanguage } from "../contexts/LanguageContext"
import { useAuth } from "@/contexts/AuthContext"
import { apiService } from "@/services/api"
import { exchangeService } from "@/services/exchange-service"
import { commonStyles } from "@/lib/layout"
import { useCacheInvalidation } from "@/contexts/CacheInvalidationContext"

export function ExchangesScreen({ route, navigation }: any) {
  const { colors } = useTheme()
  const { unreadCount } = useNotifications()
  const { t } = useLanguage()
  const { user } = useAuth()
  const { registerExchangesRefreshCallback, unregisterExchangesRefreshCallback } = useCacheInvalidation()
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false)
  const [linkedCount, setLinkedCount] = useState(0)
  const [availableCount, setAvailableCount] = useState(0)
  const openTab = route?.params?.openTab || 'linked'
  const [activeTab, setActiveTab] = useState<'all' | 'linked' | 'available'>(openTab === 'available' ? 'available' : 'all')
  
  // Função para carregar contadores
  const loadExchangesCounts = useCallback(async () => {
    if (!user?.id) return
    
    try {
      const counts = await exchangeService.getExchangesCounts(user.id)
      
      setLinkedCount(counts.connected)
      setAvailableCount(counts.available)
    } catch (error) {
      console.warn('❌ [ExchangesScreen] Error loading exchanges counts:', error)
    }
  }, [user?.id])
  
  // Carrega contadores inicialmente
  useEffect(() => {
    if (user?.id) {
      loadExchangesCounts()
    }
  }, [user?.id, loadExchangesCounts])

  // 🔄 Registra callback para atualizar contadores quando exchanges mudarem
  useEffect(() => {
    const refreshCallback = async () => {
      await loadExchangesCounts()
    }
    
    registerExchangesRefreshCallback(refreshCallback)
    
    return () => {
      unregisterExchangesRefreshCallback(refreshCallback)
    }
  }, [loadExchangesCounts, registerExchangesRefreshCallback, unregisterExchangesRefreshCallback])
  
  const onNotificationsPress = useCallback(() => {
    setNotificationsModalVisible(true)
  }, [])

  const subtitle = `${linkedCount} conectada${linkedCount !== 1 ? 's' : ''} • ${availableCount} disponíve${availableCount !== 1 ? 'is' : 'l'}`

  // Define o Header global para esta tela
  useHeader({
    title: t('exchanges.title'),
    subtitle,
    onNotificationsPress,
    unreadCount,
  })
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <ExchangesManager initialTab={openTab} />
      </View>
      
      <NotificationsModal 
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: commonStyles.screenContainer,
  content: {
    flex: 1,
  },
})
