import { StyleSheet, ScrollView, SafeAreaView, RefreshControl, View, TouchableOpacity, Text, Alert } from "react-native"
import { useRef, useState, useCallback, memo } from "react"
import { Header } from "../components/Header"
import { HomeVerticalLayout } from "../components/layouts/HomeVerticalLayout"
import { HomeTabsLayout } from "../components/layouts/HomeTabsLayout"
import { NotificationsModal } from "../components/NotificationsModal"
// import { TokenSearchModal } from "../components/TokenSearchModal" // Busca removida - agora está dentro da lista
import { OpenOrdersModal } from "../components/open-orders-modal"
import { OrderDetailsModal } from "../components/order-details-modal"
import { useTheme } from "../contexts/ThemeContext"
import { useBalance } from "../contexts/BalanceContext"
import { useLayout } from "../contexts/LayoutContext"
import { useNotifications } from "../contexts/NotificationsContext"
import { useAuth } from "../contexts/AuthContext"
import { commonStyles } from "@/lib/layout"
import { snapshotService } from "../services/snapshot-service"

export const HomeScreen = memo(function HomeScreen({ navigation }: any) {
  
  const { colors } = useTheme()
  const { layout } = useLayout()
  
  const { user } = useAuth()
  const { refresh: refreshBalance, refreshing } = useBalance()
  const { unreadCount } = useNotifications()
  const [isUpdating, setIsUpdating] = useState(false)
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false)
  // const [searchModalVisible, setSearchModalVisible] = useState(false) // Busca removida - agora está dentro da lista
  const [openOrdersModalVisible, setOpenOrdersModalVisible] = useState(false)
  const [orderDetailsModalVisible, setOrderDetailsModalVisible] = useState(false)
  const [selectedExchangeId, setSelectedExchangeId] = useState<string>("")
  const [selectedExchangeName, setSelectedExchangeName] = useState<string>("")
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [pnlRefreshTrigger, setPnlRefreshTrigger] = useState<number>(Date.now())
  const refreshOrdersRef = useRef<(() => void) | null>(null)

  const onNotificationsPress = useCallback(() => {
    setNotificationsModalVisible(true)
  }, [])

  // Busca removida do header - agora está dentro da lista de tokens
  // const onSearchPress = useCallback(() => {
  //   setSearchModalVisible(true)
  // }, [])

  const onProfilePress = useCallback(() => {
    navigation?.navigate('Settings', { initialTab: 'profile' })
  }, [navigation])
  
  const onSnapshotSaved = useCallback(() => {
    setPnlRefreshTrigger(Date.now())
  }, [])


  const onAddExchange = useCallback(() => {
    navigation?.navigate('Exchanges', { openTab: 'available' })
  }, [navigation])

  const onModalClose = useCallback(() => {
    setNotificationsModalVisible(false)
  }, [])

  const onOpenOrdersPress = useCallback((exchangeId: string, exchangeName: string) => {
    setSelectedExchangeId(exchangeId)
    setSelectedExchangeName(exchangeName)
    setOpenOrdersModalVisible(true)
  }, [])

  const onSelectOrder = useCallback((order: any) => {
    setSelectedOrder(order)
    setOrderDetailsModalVisible(true)
  }, [])

  // Refresh completo: apenas balances
  const handleRefresh = useCallback(async () => {
    console.log('🔄 [HomeScreen] Atualizando balances...')
    setIsUpdating(true)
    try {
      await refreshBalance()
      console.log('✅ [HomeScreen] Balances atualizados')
    } finally {
      // Mantém isUpdating true até que os dados sejam realmente carregados
      setTimeout(() => setIsUpdating(false), 300)
    }
  }, [refreshBalance])
  
  // Adicionar snapshots de teste para os últimos 30 dias
  const handleAddTestSnapshots = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Erro', 'Usuário não encontrado')
      return
    }

    try {
      Alert.alert(
        'Adicionar Snapshots de Teste',
        'Isso irá criar snapshots fictícios para os últimos 30 dias. Continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Adicionar',
            onPress: async () => {
              try {
                console.log('🧪 Criando snapshots de teste para últimos 30 dias...')
                
                // Criar snapshots para os últimos 30 dias
                const promises = []
                for (let i = 0; i < 30; i++) {
                  const date = new Date()
                  date.setDate(date.getDate() - i)
                  date.setHours(0, 0, 0, 0) // Meia-noite
                  
                  // Gera valor aleatório para simular variação de portfólio
                  const baseValue = 10000 + (Math.random() * 5000)
                  const variation = (Math.random() - 0.5) * 1000
                  const totalUsd = baseValue + variation
                  const totalBrl = totalUsd * 5.0 // Conversão fictícia
                  
                  promises.push(
                    snapshotService.createSnapshot({
                      userId: user.id,
                      totalUsd,
                      totalBrl,
                      timestamp: date.getTime()
                    })
                  )
                }
                
                await Promise.all(promises)
                console.log('✅ Snapshots de teste criados com sucesso!')
                
                // Atualizar PNL
                setPnlRefreshTrigger(Date.now())
                
                Alert.alert('Sucesso', '30 snapshots de teste foram criados!')
              } catch (error) {
                console.error('❌ Erro ao criar snapshots:', error)
                Alert.alert('Erro', 'Falha ao criar snapshots de teste')
              }
            }
          }
        ]
      )
    } catch (error) {
      console.error('❌ Erro:', error)
    }
  }, [user?.id])
  
  // Renderizar layout baseado na escolha do usuário
  const renderLayout = () => {
    switch (layout) {
      case 'tabs':
        return <HomeTabsLayout />
      default:
        return <HomeVerticalLayout />
    }
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        onNotificationsPress={onNotificationsPress}
        onProfilePress={onProfilePress}
        unreadCount={unreadCount}
      />
      {/* <View style={styles.testActions}>
        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: colors.primary }]}
          onPress={handleAddTestSnapshots}
        >
          <Text style={[styles.testButtonText, { color: colors.primaryText || '#fff' }]}>Adicionar snapshots 30d</Text>
        </TouchableOpacity>
      </View> */}
      
      {/* Layout tabs não precisa de ScrollView - ele já tem scroll interno */}
      {layout === 'tabs' ? (
        <HomeTabsLayout />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <HomeVerticalLayout 
            pnlRefreshTrigger={pnlRefreshTrigger}
            isUpdating={isUpdating}
          />
        </ScrollView>
      )}

      <NotificationsModal 
        visible={notificationsModalVisible}
        onClose={onModalClose}
      />

      {/* TokenSearchModal removido - busca agora está dentro da lista de tokens */}

      <OpenOrdersModal
        visible={openOrdersModalVisible}
        onClose={() => setOpenOrdersModalVisible(false)}
        exchangeId={selectedExchangeId}
        exchangeName={selectedExchangeName}
        userId={user?.id || ''}
        onSelectOrder={onSelectOrder}
      />

      <OrderDetailsModal
        visible={orderDetailsModalVisible}
        onClose={() => {
          setOrderDetailsModalVisible(false)
          // Reabre o modal de lista quando fechar os detalhes
          setOpenOrdersModalVisible(true)
        }}
        order={selectedOrder}
      />
    </SafeAreaView>
  )
})

const styles = StyleSheet.create({
  container: commonStyles.screenContainer,
  scrollView: commonStyles.scrollView,
  scrollContent: commonStyles.scrollContent,
  testActions: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  testButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
