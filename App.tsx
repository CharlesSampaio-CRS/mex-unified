import { useMemo } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { StatusBar } from "expo-status-bar"
import { View, LogBox } from "react-native"
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { typography, fontWeights } from "@/lib/typography"


// Desabilitar warnings de desenvolvimento (mas manter erros)
if (__DEV__) {
  LogBox.ignoreLogs([
    'Warning:',
    'VirtualizedLists',
    'Non-serializable'
  ])
}

import { HomeScreen } from "./screens/HomeScreen"
import { AssetsScreen } from "./screens/AssetsScreen"
import { OrdersScreen } from "./screens/OrdersScreen"
import { ExchangesScreen } from "./screens/ExchangesScreen"
import { StrategyScreen } from "./screens/StrategyScreen"
import { SettingsScreen } from "./screens/SettingsScreen"
import { ProfileScreen } from "./screens/ProfileScreen"
import { SystemScreen } from "./screens/SystemScreen"
import { LoginScreen } from "./screens/LoginScreen"
import { SignUpScreen } from "./screens/SignUpScreen"
import { WatchlistManager } from "./components/WatchlistManager"
import { StarScreen } from "./screens/StarScreen"
import { HeartScreen } from "./screens/HeartScreen"
import { FireScreen } from "./screens/FireScreen"
import { LightningScreen } from "./screens/LightningScreen"
import { RocketScreen } from "./screens/RocketScreen"
import { TrophyScreen } from "./screens/TrophyScreen"
import { ShieldScreen } from "./screens/ShieldScreen"
import { CrownScreen } from "./screens/CrownScreen"
import { DiamondScreen } from "./screens/DiamondScreen"
import { TargetScreen } from "./screens/TargetScreen"
import { FlagScreen } from "./screens/FlagScreen"
import { AnalyticsScreen } from "./screens/AnalyticsScreen"
import { StrategyTemplatesScreen } from "./screens/StrategyTemplatesScreen"
import { Header } from "./components/Header"
import { ThemeProvider, useTheme } from "./contexts/ThemeContext"
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext"
import { BalanceProvider, useBalance } from "./contexts/BalanceContext"
import { CacheInvalidationProvider } from "./contexts/CacheInvalidationContext"
import { OrdersProvider } from "./contexts/OrdersContext"
import { LayoutProvider } from "./contexts/LayoutContext"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { PrivacyProvider } from "./contexts/PrivacyContext"
import { NotificationsProvider } from "./contexts/NotificationsContext"
import { AlertsProvider } from "./contexts/AlertsContext"
import { WatchlistProvider } from "./contexts/WatchlistContext"
import { HeaderProvider } from "./contexts/HeaderContext"
import { AnimatedLogoIcon } from "./components/AnimatedLogoIcon"

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header GLOBAL - renderizado UMA vez, nunca remonta ao trocar de aba */}
      <Header global />
      
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 0.5,
            height: 70,
            paddingBottom: 16,
            paddingTop: 6,
            paddingHorizontal: 12,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: {
            fontSize: typography.micro,
            fontWeight: fontWeights.regular,
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
          name="Assets"
          component={AssetsScreen}
          options={{
            tabBarLabel: 'Assets',
            tabBarIcon: ({ color }) => <WalletIcon color={color} />,
          }}
        />
        <Tab.Screen
          name="Orders"
          component={OrdersScreen}
          options={{
            tabBarLabel: 'Orders',
            tabBarIcon: ({ color }) => <OrdersIcon color={color} />,
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
            tabBarButton: () => null, // Oculta da navegação inferior
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarButton: () => null, // Oculta da navegação inferior
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="System"
          component={SystemScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="Star"
          component={StarScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="Heart"
          component={HeartScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="Fire"
          component={FireScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="Lightning"
          component={LightningScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="Rocket"
          component={RocketScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="Trophy"
          component={TrophyScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="Shield"
          component={ShieldScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="Crown"
          component={CrownScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="Diamond"
          component={DiamondScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="Target"
          component={TargetScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="Flag"
          component={FlagScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
        <Tab.Screen
          name="StrategyTemplates"
          component={StrategyTemplatesScreen}
          options={{
            tabBarButton: () => null,
          }}
        />
      </Tab.Navigator>
    </SafeAreaView>
  )
}

// App Navigator - decide entre Auth ou Main baseado no login
function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth()
  const { data: balanceData } = useBalance()
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()

  // Mensagens dinâmicas que rotacionam durante o loading pós-login
  const loadingMessages = useMemo(() => [
    t('loading.connecting'),
    t('loading.syncExchanges'),
    t('loading.loadingPortfolio'),
    t('loading.almostReady'),
  ], [t])

  // Init do app (verificando token salvo, restaurando sessão)
  // OU autenticado mas ainda sem dados (aguarda primeiro fetchBalances completar)
  if (isLoading || (isAuthenticated && !balanceData)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <AnimatedLogoIcon 
          size={48} 
          messages={isAuthenticated ? loadingMessages : undefined}
          textColor={colors.text}
          fontSize={14}
        />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <StatusBar style={isDark ? "light" : "dark"} />
      {isAuthenticated ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <PrivacyProvider>
              <HeaderProvider>
                <NotificationsProvider>
                  <AlertsProvider>
                    <WatchlistProvider>
                      <BalanceProvider>
                        <CacheInvalidationProvider>
                          <OrdersProvider>
                            <LayoutProvider>
                              <AppNavigator />
                            </LayoutProvider>
                          </OrdersProvider>
                        </CacheInvalidationProvider>
                      </BalanceProvider>
                    </WatchlistProvider>
                  </AlertsProvider>
                </NotificationsProvider>
              </HeaderProvider>
            </PrivacyProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  )
}

// Icon components usando Ionicons (fonte única)
const HomeIcon = ({ color }: { color: string }) => (
  <Ionicons name="home-outline" size={22} color={color} />
)

const WalletIcon = ({ color }: { color: string }) => (
  <Ionicons name="wallet-outline" size={22} color={color} />
)

const ExchangeIcon = ({ color }: { color: string }) => (
  <Ionicons name="swap-horizontal-outline" size={22} color={color} />
)

const RobotIcon = ({ color }: { color: string }) => (
  <Ionicons name="hardware-chip-outline" size={22} color={color} />
)

const OrdersIcon = ({ color }: { color: string }) => (
  <Ionicons name="document-text-outline" size={22} color={color} />
)

const StarIcon = ({ color }: { color: string }) => (
  <Ionicons name="star-outline" size={22} color={color} />
)

const NotificationsIcon = ({ color }: { color: string }) => (
  <Ionicons name="notifications-outline" size={22} color={color} />
)

const SettingsIcon = ({ color }: { color: string }) => (
  <Ionicons name="options-outline" size={22} color={color} />
)
