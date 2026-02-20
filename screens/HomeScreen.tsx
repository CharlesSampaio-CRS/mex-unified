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
import { useBackendSnapshots } from "../hooks/useBackendSnapshots"

export const HomeScreen = memo(function HomeScreen({ navigation }: any) {
  
  const { colors } = useTheme()
  const { layout } = useLayout()
  
  const { user } = useAuth()
  const { refresh: refreshBalance, refreshing, data: balanceData } = useBalance()
  const { unreadCount } = useNotifications()
  
  // Calcula total USD do balance atual
  const totalUSD = typeof balanceData?.total_usd === 'string' 
    ? parseFloat(balanceData.total_usd) 
    : (balanceData?.total_usd || 0)
  
  // Hook para snapshots e PNL do MongoDB
  const { pnl, loading: pnlLoading, refresh: refreshPnl, saveSnapshot } = useBackendSnapshots(totalUSD)
  
  const [isUpdating, setIsUpdating] = useState(false)
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false)
  // const [searchModalVisible, setSearchModalVisible] = useState(false) // Busca removida - agora está dentro da lista
  const [openOrdersModalVisible, setOpenOrdersModalVisible] = useState(false)
  const [orderDetailsModalVisible, setOrderDetailsModalVisible] = useState(false)
  const [selectedExchangeId, setSelectedExchangeId] = useState<string>("")
  const [selectedExchangeName, setSelectedExchangeName] = useState<string>("")
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
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
  
  const onSnapshotSaved = useCallback(async () => {
    // Atualiza os snapshots do backend
    await refreshPnl()
  }, [refreshPnl])


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
  
  // Renderizar layout baseado na escolha do usuário
  const renderLayout = () => {
    switch (layout) {
      case 'tabs':
        return <HomeTabsLayout pnl={pnl} pnlLoading={pnlLoading} />
      default:
        return <HomeVerticalLayout pnl={pnl} pnlLoading={pnlLoading} isUpdating={isUpdating} />
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
        <HomeTabsLayout pnl={pnl} pnlLoading={pnlLoading} />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isUpdating || refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          }
        >
          <HomeVerticalLayout 
            pnl={pnl}
            pnlLoading={pnlLoading}
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
