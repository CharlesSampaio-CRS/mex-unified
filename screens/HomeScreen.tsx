import { StyleSheet, ScrollView, SafeAreaView, RefreshControl, View } from "react-native"
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

export const HomeScreen = memo(function HomeScreen({ navigation }: any) {
  
  const { colors } = useTheme()
  const { layout } = useLayout()
  
  const { user } = useAuth()
  const { refresh: refreshBalance, refreshing } = useBalance()
  const { unreadCount } = useNotifications()
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
    await refreshBalance()
  }, [refreshBalance])
  
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
          <HomeVerticalLayout pnlRefreshTrigger={pnlRefreshTrigger} />
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
})
