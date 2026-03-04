import { StyleSheet, ScrollView, RefreshControl, SafeAreaView, View, TouchableOpacity, Text, Alert } from "react-native"
import { useRef, useState, useCallback, memo } from "react"
import { useHeader } from "../contexts/HeaderContext"
import { HomeVerticalLayout } from "../components/layouts/HomeVerticalLayout"
import { HomeTabsLayout } from "../components/layouts/HomeTabsLayout"
import { NotificationsModal } from "../components/NotificationsModal"
// import { TokenSearchModal } from "../components/TokenSearchModal" // Busca removida - agora está dentro da lista
import { OpenOrdersModal } from "../components/open-orders-modal"
import { OrderDetailsModal } from "../components/order-details-modal"
import { useTheme } from "../contexts/ThemeContext"
import { typography, fontWeights } from "../lib/typography"
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
  const { pnl, snapshots, loading: pnlLoading, refresh: refreshPnl, saveSnapshot } = useBackendSnapshots(totalUSD)
  
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

  // Define o Header global para esta tela
  useHeader({
    onNotificationsPress,
    unreadCount,
  })

  // Busca removida do header - agora está dentro da lista de tokens
  // const onSearchPress = useCallback(() => {
  //   setSearchModalVisible(true)
  // }, [])

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

  // Refresh completo: balances + PnL
  const handleRefresh = useCallback(async () => {
    console.log('🔄 [HomeScreen] Atualizando balances...')
    await refreshBalance()
    console.log('✅ [HomeScreen] Balances atualizados')
  }, [refreshBalance])
  
  // Renderizar layout baseado na escolha do usuário
  const renderLayout = () => {
    switch (layout) {
      case 'tabs':
        return <HomeTabsLayout pnl={pnl} pnlLoading={pnlLoading} snapshots={snapshots} />
      default:
        return <HomeVerticalLayout pnl={pnl} pnlLoading={pnlLoading} snapshots={snapshots} isUpdating={refreshing} />
    }
  }
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Layout tabs não precisa de ScrollView - ele já tem scroll interno */}
      {layout === 'tabs' ? (
        <HomeTabsLayout pnl={pnl} pnlLoading={pnlLoading} snapshots={snapshots} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          keyboardShouldPersistTaps="handled"
        >
          <HomeVerticalLayout 
            pnl={pnl}
            pnlLoading={pnlLoading}
            snapshots={snapshots}
            isUpdating={refreshing}
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
    </View>
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
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
  },
})
