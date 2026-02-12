import { NavigationContainer } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { StatusBar } from "expo-status-bar"
import { ActivityIndicator, View, LogBox } from "react-native"
import { useEffect, useRef, useState } from "react"
import Svg, { Path, Rect, Circle } from "react-native-svg"
import { sqliteDatabase } from "./lib/sqlite/database"

// 🔥 ERROR HANDLER GLOBAL - Captura TODOS os erros não tratados
if (__DEV__) {
  const originalConsoleError = console.error
  console.error = (...args) => {
    originalConsoleError(...args)
  }
  
  // Captura erros não tratados do JavaScript
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('FATAL ERROR:', { error, isFatal, stack: error?.stack })
    alert(`FATAL ERROR: ${error?.message}`)
  })
}

// Desabilitar warnings de desenvolvimento (mas manter erros)
if (__DEV__) {
  LogBox.ignoreLogs([
    'Warning:',
    'VirtualizedLists',
    'Non-serializable'
  ])
}

import { HomeScreen } from "./screens/HomeScreen"
import { ExchangesScreen } from "./screens/ExchangesScreen"
import { StrategyScreen } from "./screens/StrategyScreen"
import { SettingsScreen } from "./screens/SettingsScreen"
import { LoginScreen } from "./screens/LoginScreen"
import { SignUpScreen } from "./screens/SignUpScreen"
import { WatchlistManager } from "./components/WatchlistManager"
import { ThemeProvider, useTheme } from "./contexts/ThemeContext"
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext"
import { BalanceProvider, useBalance } from "./contexts/BalanceContext"
import { CacheInvalidationProvider } from "./contexts/CacheInvalidationContext"
import { OrdersProvider, useOrders } from "./contexts/OrdersContext"
import { PortfolioProvider } from "./contexts/PortfolioContext"
import { LayoutProvider } from "./contexts/LayoutContext"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { PrivacyProvider } from "./contexts/PrivacyContext"
import { NotificationsProvider } from "./contexts/NotificationsContext"
import { AlertsProvider } from "./contexts/AlertsContext"
import { WatchlistProvider } from "./contexts/WatchlistContext"
import { LoadingProgress } from "./components/LoadingProgress"
import { MaintenanceScreen } from "./components/MaintenanceScreen"

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

// DataLoader - monitora quando os dados estão prontos e notifica
function DataLoader({ children, onDataReady }: { children: React.ReactNode, onDataReady: () => void }) {
  const { data: balanceData, loading: balanceLoading, error: balanceError, refresh: refreshBalance } = useBalance()
  const hasCalledRef = useRef(false)
  const [showMaintenance, setShowMaintenance] = useState(false)

  // 🚀 REMOVED: Não precisa mais forçar refresh automático!
  // O pré-carregamento no login + BalanceContext já carregam os dados automaticamente
  // Isso elimina a chamada duplicada após login
  
  // ❌ REMOVED: refreshOrders não é mais necessário aqui
  // OrdersContext agora usa callback onBalanceLoaded para carregar automaticamente

  // Detecta erros críticos de API (erro ao carregar balance = API offline)
  const isCriticalError = balanceError !== null && !balanceLoading

  useEffect(() => {
    // Se erro crítico detectado, mostra tela de manutenção
    if (isCriticalError && !showMaintenance) {
      setShowMaintenance(true)
      hasCalledRef.current = true
      onDataReady()
      return
    }

    // ✅ NOVO: Considera dados prontos quando:
    // 1. Loading terminou (!balanceLoading)
    // 2. E: (tem dados OU tem erro OU usuário novo sem exchanges)
    const balanceReady = !balanceLoading && (
      balanceData !== null ||  // Tem dados
      balanceError !== null ||  // Tem erro (vai mostrar mensagem)
      (balanceData as any)?.exchanges?.length === 0  // Usuário novo sem exchanges (válido!)
    )

    // ❌ REMOVIDO: Não carrega orders aqui! OrdersContext já faz isso via callback onBalanceLoaded
    // if (balanceReady && !hasLoadedOrdersRef.current) {
    //   hasLoadedOrdersRef.current = true
    //   console.log('✅ Balance carregado, iniciando carregamento de orders...')
    //   refreshOrders().catch(err => {
    //     console.error('❌ Erro ao carregar orders:', err)
    //   })
    // }

    console.log('🔍 [DataLoadingManager] Estado atual:', {
      balanceLoading,
      hasBalanceData: !!balanceData,
      hasBalanceError: !!balanceError,
      balanceReady,
      hasCalledRef: hasCalledRef.current
    })

    // Chama onDataReady quando balance terminou de carregar
    if (balanceReady && !hasCalledRef.current) {
      console.log('✅ [DataLoadingManager] Balance pronto, chamando onDataReady()')
      hasCalledRef.current = true
      onDataReady()
    }
  }, [balanceLoading, balanceData, balanceError, onDataReady, isCriticalError, showMaintenance])

  // Timeout de segurança: se demorar mais de 10 segundos, finaliza o loading
  useEffect(() => {
    console.log('⏰ [DataLoadingManager] Timeout de 10s iniciado')
    const timeout = setTimeout(() => {
      if (!hasCalledRef.current) {
        console.warn('⏰ [DataLoadingManager] TIMEOUT! Forçando onDataReady() após 10s')
        hasCalledRef.current = true
        onDataReady()
      }
    }, 10000) // 10 segundos

    return () => clearTimeout(timeout)
  }, [onDataReady])

  // Reset quando desmonta (logout)
  useEffect(() => {
    return () => {
      hasCalledRef.current = false
      setShowMaintenance(false)
    }
  }, [])

  // Função de retry
  const handleRetry = async () => {
    setShowMaintenance(false)
    hasCalledRef.current = false
    
    // Tenta recarregar os dados
    try {
      await refreshBalance()
    } catch (error) {
      console.error('❌ Erro ao tentar reconectar:', error)
    }
  }

  // Se erro crítico, mostra tela de manutenção
  if (showMaintenance) {
    return <MaintenanceScreen onRetry={handleRetry} />
  }

  return <>{children}</>
}

// Auth Stack (Login/SignUp)
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  )
}

// Main App Tabs (após login)
function MainTabs() {
  const { t } = useLanguage()
  const { colors } = useTheme()
  
  return (
    <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 0.5,
            height: 56,
            paddingBottom: 6,
            paddingTop: 6,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "400",
            marginTop: -2,
          },
          tabBarIconStyle: {
            marginTop: 2,
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarLabel: t('nav.home'),
            tabBarIcon: ({ color }) => <HomeIcon color={color} />,
          }}
        />
        <Tab.Screen
          name="Exchanges"
          component={ExchangesScreen}
          options={{
            tabBarLabel: t('nav.exchanges'),
            tabBarIcon: ({ color }) => <ExchangeIcon color={color} />,
          }}
        />
        <Tab.Screen
          name="Strategy"
          component={StrategyScreen}
          options={{
            tabBarLabel: t('nav.strategies'),
            tabBarIcon: ({ color }) => <RobotIcon color={color} />,
          }}
        />
        <Tab.Screen
          name="Favoritos"
          component={WatchlistManager}
          options={{
            tabBarLabel: 'Alertas',
            tabBarIcon: ({ color }) => <NotificationsIcon color={color} />,
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: 'Config',
            tabBarIcon: ({ color }) => <SettingsIcon color={color} />,
          }}
        />
      </Tab.Navigator>
  )
}

// App Navigator - decide entre Auth ou Main baseado no login
function AppNavigator() {
  const { isAuthenticated, isLoading, isLoadingData, setLoadingDataComplete, user } = useAuth()
  const { colors, isDark } = useTheme()
  const [dbInitialized, setDbInitialized] = useState(false)

  // 🗄️ Inicializa o SQLite na montagem do app
  useEffect(() => {
    const initDatabase = async () => {
      try {
        console.log('🗄️ [App] Iniciando SQLite...')
        await sqliteDatabase.initialize()
        console.log('✅ [App] SQLite inicializado com sucesso!')
        setDbInitialized(true)
      } catch (error) {
        console.error('❌ [App] Erro ao inicializar SQLite:', error)
        // Marca como inicializado mesmo com erro para não bloquear o app
        setDbInitialized(true)
      }
    }
    
    initDatabase()
  }, [])

  if (isLoading || !dbInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    )
  }


  return (
    <NavigationContainer>
      <StatusBar style={isDark ? "light" : "dark"} />
      {isAuthenticated ? (
        <>
          {!isLoadingData ? (
            <MainTabs />
          ) : (
            // Durante carregamento de dados, mostra tela de loading ao invés de voltar pro login
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          )}
          
          {/* DataLoader monitora em segundo plano DURANTE o carregamento após login */}
          {isLoadingData && (
            <DataLoader onDataReady={setLoadingDataComplete}>
              <View />
            </DataLoader>
          )}
        </>
      ) : (
        // Não autenticado - SEMPRE mostra tela de login
        <>
          <AuthStack />
        </>
      )}
      
      {/* LoadingProgress aparece sobre qualquer tela quando isLoadingData = true */}
      <LoadingProgress visible={isLoadingData} />
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <PrivacyProvider>
            <NotificationsProvider>
              <AlertsProvider>
                <WatchlistProvider>
                  <BalanceProvider>
                    <CacheInvalidationProvider>
                      <OrdersProvider>
                        <PortfolioProvider>
                          <LayoutProvider>
                            <AppNavigator />
                          </LayoutProvider>
                        </PortfolioProvider>
                      </OrdersProvider>
                    </CacheInvalidationProvider>
                  </BalanceProvider>
                </WatchlistProvider>
              </AlertsProvider>
            </NotificationsProvider>
          </PrivacyProvider>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  )
}

// Simple icon components
const HomeIcon = ({ color }: { color: string }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={color} strokeWidth="1.8" />
  </Svg>
)

const ExchangeIcon = ({ color }: { color: string }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <Path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" stroke={color} strokeWidth="1.8" />
  </Svg>
)

const RobotIcon = ({ color }: { color: string }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <Rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth="1.8" />
    <Circle cx="9" cy="16" r="1" fill={color} />
    <Circle cx="15" cy="16" r="1" fill={color} />
    <Path d="M9 19h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M12 3v5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Circle cx="12" cy="3" r="1" fill={color} />
    <Path d="M5 14h2M17 14h2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
)

const StarIcon = ({ color }: { color: string }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <Path 
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
      stroke={color} 
      strokeWidth="1.8" 
      strokeLinejoin="round"
    />
  </Svg>
)

const NotificationsIcon = ({ color }: { color: string }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <Path 
      d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" 
      stroke={color} 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <Path 
      d="M13.73 21a2 2 0 0 1-3.46 0" 
      stroke={color} 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </Svg>
)

const SettingsIcon = ({ color }: { color: string }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <Circle cx="6" cy="12" r="2" stroke={color} strokeWidth="1.8" />
    <Circle cx="18" cy="6" r="2" stroke={color} strokeWidth="1.8" />
    <Circle cx="18" cy="18" r="2" stroke={color} strokeWidth="1.8" />
    <Path
      d="M8 12h13M3 12h2M8 6h8M3 18h12"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </Svg>
)
