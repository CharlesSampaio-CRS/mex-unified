import { StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useState, useCallback, useEffect } from "react"
import { ExchangesManager } from "../components/exchanges-manager"
import { Header } from "../components/Header"
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
  const [activeTab, setActiveTab] = useState<'linked' | 'available'>(openTab)
  
  // Função para carregar contadores
  const loadExchangesCounts = useCallback(async () => {
    if (!user?.id) return
    
    try {
      console.log('� [ExchangesScreen] Carregando contadores de exchanges...')
      
      // Disponíveis: da API | Conectadas: do banco local
      const [availableData, linkedCount] = await Promise.all([
        apiService.getAvailableExchanges(user.id),
        exchangeService.countExchanges(user.id)
      ])
      
      if (availableData.success && availableData.exchanges) {
        setAvailableCount(availableData.exchanges.length)
        console.log(`✅ [ExchangesScreen] ${availableData.exchanges.length} exchanges disponíveis`)
      }
      
      setLinkedCount(linkedCount)
      console.log(`✅ [ExchangesScreen] ${linkedCount} exchanges conectadas`)
    } catch (error) {
      console.error('❌ [ExchangesScreen] Error loading exchanges counts:', error)
    }
  }, [user?.id])
  
  // Carrega contadores inicialmente
  useEffect(() => {
    console.log('🔄 [ExchangesScreen] useEffect executado, user?.id:', user?.id)
    if (user?.id) {
      console.log('✅ [ExchangesScreen] Chamando loadExchangesCounts()...')
      loadExchangesCounts()
    } else {
      console.warn('⚠️ [ExchangesScreen] Usuário não autenticado, não carregando exchanges')
    }
  }, [user?.id, loadExchangesCounts])

  // 🔄 Registra callback para atualizar contadores quando exchanges mudarem
  useEffect(() => {
    const refreshCallback = async () => {
      console.log('🔄 [ExchangesScreen] Exchange modificada - atualizando contadores...')
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

  const onProfilePress = useCallback(() => {
    navigation?.navigate('Settings', { initialTab: 'profile' })
  }, [navigation])

  const subtitle = activeTab === 'linked' 
    ? `${linkedCount} ${linkedCount === 1 ? t('exchanges.connectedSingular') : t('exchanges.connectedPlural')}`
    : `${availableCount} ${availableCount === 1 ? t('exchanges.availableSingular') : t('exchanges.availablePlural')}`
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        title={t('exchanges.title')}
        subtitle={subtitle}
        onNotificationsPress={onNotificationsPress}
        onProfilePress={onProfilePress}
        unreadCount={unreadCount}
      />
      <View style={styles.content}>
        <ExchangesManager initialTab={openTab} />
      </View>
      
      <NotificationsModal 
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: commonStyles.screenContainer,
  content: {
    flex: 1,
  },
})
