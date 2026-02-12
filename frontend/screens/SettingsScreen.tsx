import { 
  Text, 
  StyleSheet, 
  ScrollView, 
  View, 
  TouchableOpacity, 
  Alert, 
  Modal, 
  Pressable, 
  Platform,
  KeyboardAvoidingView,
  Image
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useState, useEffect, useMemo, useCallback } from "react"
import * as Clipboard from 'expo-clipboard'
import { useTheme } from "../contexts/ThemeContext"
import { useLanguage } from "../contexts/LanguageContext"
import { useAuth } from "../contexts/AuthContext"
import { useNotifications } from "../contexts/NotificationsContext"
import { Header } from "../components/Header"
import { NotificationsModal } from "../components/NotificationsModal"
import { ConfirmModal } from "../components/ConfirmModal"
import { TabBar } from "../components/TabBar"
import { LogoIcon } from "../components/LogoIcon"
import { typography, fontWeights } from "../lib/typography"
import { commonStyles, spacing, borderRadius, shadows, borders, sizes } from "@/lib/layout"
import Svg, { Path, Circle } from "react-native-svg"

export function SettingsScreen({ navigation, route }: any) {
  const { theme, setTheme, colors, isDark } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { unreadCount } = useNotifications()
  const { 
    user,
    logout,
    deleteAccount,
    biometricAvailable, 
    biometricType, 
    isBiometricEnabled,
    enableBiometric,
    disableBiometric
  } = useAuth()
  
  // Estado da aba ativa
  const [activeTab, setActiveTab] = useState<"profile" | "system">("profile")
  
  // Dados do usuário
  const userData = {
    name: user?.name || "Carregando...",
    email: user?.email || "usuario@exemplo.com",
    phone: "+55 (11) 98765-4321",
    memberSince: "Janeiro 2024",
    avatar: null
  }

  // Estados e handlers do Profile
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false)
  const [exportDataModalVisible, setExportDataModalVisible] = useState(false)
  
  // Estados dos modais
  const [aboutModalVisible, setAboutModalVisible] = useState(false)
  const [termsModalVisible, setTermsModalVisible] = useState(false)
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false)
  const [securityModalVisible, setSecurityModalVisible] = useState(false)
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false)
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false)
  const [logoutModalVisible, setLogoutModalVisible] = useState(false)
  
  // Estados de segurança  
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(false)
  const [autoLockEnabled, setAutoLockEnabled] = useState(true)
  const [autoLockTime, setAutoLockTime] = useState('5') // minutos
  const [loginAlertsEnabled, setLoginAlertsEnabled] = useState(true)
  const [deviceIp, setDeviceIp] = useState<string>('Carregando...')

  // Themed toggle styles (seguindo padrão do ExchangesList)
  const themedToggleStyles = useMemo(() => ({
    toggle: { 
      backgroundColor: isDark ? 'rgba(60, 60, 60, 0.4)' : 'rgba(220, 220, 220, 0.5)', 
      borderColor: isDark ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.4)' 
    },
    toggleActive: { 
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.5)', 
      borderColor: isDark ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.7)' 
    },
    toggleThumb: { 
      backgroundColor: isDark ? 'rgba(140, 140, 140, 0.9)' : 'rgba(120, 120, 120, 0.85)' 
    },
    toggleThumbActive: { 
      backgroundColor: isDark ? 'rgba(96, 165, 250, 1)' : 'rgba(59, 130, 246, 1)' 
    },
  }), [isDark])

  // Handlers do Profile
  const handleLogout = () => {
    console.log('🚪 SettingsScreen: handleLogout chamado')
    setLogoutModalVisible(true)
  }

  const confirmLogout = async () => {
    try {
      console.log('✅ Usuário confirmou logout, executando...')
      console.log('📤 Chamando função logout do AuthContext...')
      await logout()
      console.log('✅ Logout executado com sucesso!')
      console.log('🔄 Tentando resetar navegação...')
      
      // Tenta diferentes formas de resetar a navegação
      if (navigation?.reset) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }]
        })
        console.log('✅ Navegação resetada via navigation.reset')
      } else if (navigation?.navigate) {
        navigation.navigate('Login')
        console.log('✅ Navegação via navigation.navigate')
      } else {
        console.error('❌ Nenhum método de navegação disponível')
      }
    } catch (error) {
      console.error('❌ Erro no logout:', error)
      Alert.alert(t('common.error'), t('profile.logoutError'))
    }
  }

  const handleChangePassword = () => {
    setChangePasswordModalVisible(true)
  }

  const handleExportData = () => {
    setExportDataModalVisible(true)
  }

  const handleEditProfile = () => {
    Alert.alert('Em breve', 'Funcionalidade de edição em desenvolvimento')
  }

  // Busca o IP público do dispositivo ao abrir o modal de segurança
  useEffect(() => {
    if (securityModalVisible) {
      fetchDeviceIp()
    }
  }, [securityModalVisible])

  const fetchDeviceIp = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      setDeviceIp(data.ip)
    } catch (error) {
      console.error('Error fetching IP:', error)
      setDeviceIp('Não disponível')
    }
  }

  const handleCopyIp = () => {
    Clipboard.setString(deviceIp)
    Alert.alert('✓', 'IP copiado para área de transferência')
  }

  const handleBiometricToggle = async () => {
    try {
      if (isBiometricEnabled) {
        await disableBiometric()
        Alert.alert('✓', `${biometricType} ${t('settings.biometricDisabled')}`)
      } else {
        await enableBiometric()
        Alert.alert('✓', `${biometricType} ${t('settings.biometricEnabled')}`)
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('settings.biometricError'))
    }
  }

  const onNotificationsPress = useCallback(() => {
    setNotificationsModalVisible(true)
  }, [])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header padronizado */}
      <Header 
        title={t('settings.title')}
        subtitle={activeTab === "profile" ? t('profile.subtitle') : t('settings.subtitle')}
        onNotificationsPress={onNotificationsPress}
        onProfilePress={undefined}
        unreadCount={unreadCount}
      />

      {/* Tabs: Perfil e Sistema */}
      <TabBar 
        tabs={[t('profile.title'), t('settings.systemTitle')]}
        activeTab={activeTab === "profile" ? 0 : 1}
        onTabChange={(index) => setActiveTab(index === 0 ? "profile" : "system")}
      />

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "profile" ? (
          // ===== TAB: PERFIL =====
          <>
            {/* Avatar e informações do usuário */}
            <View style={[styles.profileHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.avatarContainer}>
                {userData.avatar ? (
                  <Image 
                    source={{ uri: userData.avatar }} 
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Svg width={100} height={100} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
                      <defs>
                        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3B82F6" />
                          <stop offset="100%" stopColor="#FBBF24" />
                        </linearGradient>
                      </defs>
                      <Circle cx="50" cy="50" r="50" fill="url(#grad1)" />
                    </Svg>
                    <Text style={styles.avatarText}>
                      {userData.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                
                <TouchableOpacity 
                  style={[styles.editButton, { backgroundColor: colors.primary }]}
                  onPress={handleEditProfile}
                >
                  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </TouchableOpacity>
              </View>

              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.text }]}>
                  {userData.name}
                </Text>
                <Text style={[styles.profileMember, { color: colors.textSecondary }]}>
                  {t('profile.memberSince')} {userData.memberSince}
                </Text>
              </View>
            </View>

            {/* Informações pessoais */}
            {/* Email */}
            <View style={[styles.profileInfoItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.profileInfoItemLeft}>
                <View style={[styles.profileInfoIconContainer, { backgroundColor: colors.background }]}>
                  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                      stroke={colors.primary}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M22 6l-10 7L2 6"
                      stroke={colors.primary}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <View style={styles.profileInfoTextContainer}>
                  <Text style={[styles.profileInfoLabel, { color: colors.textSecondary }]}>
                    {t('profile.email')}
                  </Text>
                  <Text style={[styles.profileInfoValue, { color: colors.text }]}>
                    {userData.email}
                  </Text>
                </View>
              </View>
            </View>

            {/* Origem de Login */}
            <View style={[styles.profileInfoItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.profileInfoItemLeft}>
                <View style={[styles.profileInfoIconContainer, { backgroundColor: colors.background }]}>
                  {user?.authProvider === 'google' ? (
                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0z"
                        fill="#1F2937"
                      />
                      <Path
                        d="M12 23c6.075 0 11-4.925 11-11S18.075 1 12 1 1 5.925 1 12s4.925 11 11 11z"
                        fill="white"
                      />
                      <Path
                        d="M12 5.5c3.589 0 6.5 2.911 6.5 6.5s-2.911 6.5-6.5 6.5S5.5 15.589 5.5 12 8.411 5.5 12 5.5z"
                        fill="white"
                      />
                      <Path
                        d="M16 12c0 2.209-1.791 4-4 4s-4-1.791-4-4 1.791-4 4-4 4 1.791 4 4z"
                        fill="#1F2937"
                      />
                    </Svg>
                  ) : user?.authProvider === 'apple' ? (
                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0z"
                        fill="black"
                      />
                      <Path
                        d="M12 23c6.075 0 11-4.925 11-11S18.075 1 12 1 1 5.925 1 12s4.925 11 11 11z"
                        fill="white"
                      />
                      <Path
                        d="M15.5 7c-1 0-2 1-2.5 2-.5-1-1.5-2-2.5-2-2 0-3.5 1.5-3.5 3.5 0 2 1 3 3.5 5.5 2.5 2.5 3.5 3.5 5 3.5s2.5-1 5-3.5c2.5-2.5 3.5-3.5 3.5-5.5 0-2-1.5-3.5-3.5-3.5z"
                        fill="black"
                      />
                    </Svg>
                  ) : (
                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                        stroke={colors.primary}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  )}
                </View>
                <View style={styles.profileInfoTextContainer}>
                  <Text style={[styles.profileInfoLabel, { color: colors.textSecondary }]}>
                    Origem de Login
                  </Text>
                  <Text style={[styles.profileInfoValue, { color: colors.text }]}>
                    {user?.authProvider === 'google' ? 'Google' : user?.authProvider === 'apple' ? 'Apple' : 'Email'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Alterar Senha */}
            <TouchableOpacity 
              style={[styles.actionItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleChangePassword}
            >
              <View style={styles.actionItemLeft}>
                <View style={[styles.actionIconContainer, { backgroundColor: colors.background }]}>
                  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
                      stroke={colors.primary}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={[styles.actionText, { color: colors.text }]}>
                  {t('profile.changePassword')}
                  </Text>
                </View>
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 18l6-6-6-6"
                    stroke={colors.textSecondary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleExportData}
              >
                <View style={styles.actionItemLeft}>
                  <View style={[styles.actionIconContainer, { backgroundColor: colors.background }]}>
                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                        stroke={colors.primary}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Path
                        d="M7 10l5 5 5-5"
                        stroke={colors.primary}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Path
                        d="M12 15V3"
                        stroke={colors.primary}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <Text style={[styles.actionText, { color: colors.text }]}>
                    {t('profile.exportData')}
                  </Text>
                </View>
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 18l6-6-6-6"
                    stroke={colors.textSecondary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleLogout}
              >
                <View style={styles.actionItemLeft}>
                  <View style={[styles.actionIconContainer, { backgroundColor: colors.background }]}>
                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                        stroke={colors.danger}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Path
                        d="M16 17l5-5-5-5"
                        stroke={colors.danger}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Path
                        d="M21 12H9"
                        stroke={colors.danger}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <Text style={[styles.actionText, { color: colors.danger }]}>
                    {t('profile.logout')}
                  </Text>
                </View>
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 18l6-6-6-6"
                    stroke={colors.textSecondary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.deleteAccountButton, { backgroundColor: colors.surface, borderColor: colors.danger }]}
                onPress={() => setDeleteAccountModalVisible(true)}
              >
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"
                    stroke={colors.danger}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={[styles.deleteAccountButtonText, { color: colors.danger }]}>{t('settings.deleteAccount')}</Text>
              </TouchableOpacity>
          </>
        ) : (
          // ===== TAB: SISTEMA =====
          <>
          {/* Idioma */}
          <View style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.itemGap, marginBottom: spacing.itemGap }]}>
            <TouchableOpacity 
              style={styles.menuItemLeft}
              onPress={() => setLanguage(language === 'pt-BR' ? 'en-US' : 'pt-BR')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="10" stroke={colors.text} strokeWidth="2" />
                  <Path
                    d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('profile.language')}</Text>
                <Text style={[styles.menuItemSubtext, { color: colors.textSecondary }]}>
                  {language === 'pt-BR' ? '🇧🇷 Português (Brasil)' : '🇺🇸 English (US)'}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.toggle,
                language === 'en-US' ? themedToggleStyles.toggleActive : themedToggleStyles.toggle
              ]}
              onPress={() => setLanguage(language === 'pt-BR' ? 'en-US' : 'pt-BR')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.toggleThumb,
                language === 'en-US' ? themedToggleStyles.toggleThumbActive : themedToggleStyles.toggleThumb,
                language === 'en-US' && styles.toggleThumbActive
              ]} />
            </TouchableOpacity>
          </View>

          {/* Dark Mode */}
          <View style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: spacing.itemGap }]}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View>
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('profile.darkMode')}</Text>
                <Text style={[styles.menuItemSubtext, { color: colors.textSecondary }]}>
                  {theme === 'dark' ? t('settings.activated') : t('settings.deactivated')}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[
                styles.toggle,
                theme === 'dark' ? themedToggleStyles.toggleActive : themedToggleStyles.toggle
              ]}
              onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.toggleThumb,
                theme === 'dark' ? themedToggleStyles.toggleThumbActive : themedToggleStyles.toggleThumb,
                theme === 'dark' && styles.toggleThumbActive
              ]} />
            </TouchableOpacity>
          </View>

          {/* Segurança */}
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setSecurityModalVisible(true)}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text style={[styles.menuItemText, { color: colors.text }]}>{t('profile.security')}</Text>
            </View>
            <Text style={[styles.menuItemArrow, { color: colors.textSecondary }]}>›</Text>
          </TouchableOpacity>

          {/* Biometria */}
          {biometricAvailable && (
            <View style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.itemGap }]}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
                  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                      stroke={colors.text}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Circle cx="12" cy="9" r="2.5" stroke={colors.text} strokeWidth="2" />
                  </Svg>
                </View>
                <View>
                  <Text style={[styles.menuItemText, { color: colors.text }]}>{biometricType}</Text>
                  <Text style={[styles.menuItemSubtext, { color: colors.textSecondary }]}>
                    {isBiometricEnabled ? 'Ativado' : 'Desativado'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[
                  styles.toggle,
                  isBiometricEnabled ? themedToggleStyles.toggleActive : themedToggleStyles.toggle
                ]}
                onPress={handleBiometricToggle}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.toggleThumb,
                  isBiometricEnabled ? themedToggleStyles.toggleThumbActive : themedToggleStyles.toggleThumb,
                  isBiometricEnabled && styles.toggleThumbActive
                ]} />
              </TouchableOpacity>
            </View>
          )}

          {/* Sobre o App */}
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setAboutModalVisible(true)}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="10" stroke={colors.text} strokeWidth="2" />
                  <Path d="M12 16v-4M12 8h.01" stroke={colors.text} strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </View>
              <Text style={[styles.menuItemText, { color: colors.text }]}>{t('profile.aboutApp')}</Text>
            </View>
            <Text style={[styles.menuItemArrow, { color: colors.textSecondary }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.itemGap }]}
            onPress={() => setTermsModalVisible(true)}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={colors.text} strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </View>
              <Text style={[styles.menuItemText, { color: colors.text }]}>{t('profile.termsOfUse')}</Text>
            </View>
            <Text style={[styles.menuItemArrow, { color: colors.textSecondary }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.itemGap }]}
            onPress={() => setPrivacyModalVisible(true)}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text style={[styles.menuItemText, { color: colors.text }]}>{t('profile.privacyPolicy')}</Text>
            </View>
            <Text style={[styles.menuItemArrow, { color: colors.textSecondary }]}>›</Text>
          </TouchableOpacity>

        <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      {/* Modais */}
      <NotificationsModal 
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />

      {/* Modal de Segurança */}
      <Modal
        visible={securityModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSecurityModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={[styles.securityModalContainer, { backgroundColor: colors.surface }]}>
              {/* Header */}
              <View style={[styles.securityModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.securityModalTitle, { color: colors.text }]}>
                  {t('profile.security')}
                </Text>
                <TouchableOpacity onPress={() => setSecurityModalVisible(false)} style={styles.modalCloseButton}>
                  <Text style={[styles.modalCloseIcon, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Content */}
              <ScrollView 
                style={styles.securityModalContent} 
                contentContainerStyle={styles.securityModalContentContainer}
                showsVerticalScrollIndicator={true}
              >
                <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Autenticação de Dois Fatores</Text>
              <View style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>2FA via SMS</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Receba códigos de verificação por SMS
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[
                    styles.toggle,
                    twoFactorEnabled ? themedToggleStyles.toggleActive : themedToggleStyles.toggle
                  ]}
                  onPress={() => setTwoFactorEnabled(!twoFactorEnabled)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.toggleThumb,
                    twoFactorEnabled ? themedToggleStyles.toggleThumbActive : themedToggleStyles.toggleThumb,
                    twoFactorEnabled && styles.toggleThumbActive
                  ]} />
                </TouchableOpacity>
              </View>

              <View style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Google Authenticator</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Use o app Google Authenticator
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[
                    styles.toggle,
                    googleAuthEnabled ? themedToggleStyles.toggleActive : themedToggleStyles.toggle
                  ]}
                  onPress={() => setGoogleAuthEnabled(!googleAuthEnabled)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.toggleThumb,
                    googleAuthEnabled ? themedToggleStyles.toggleThumbActive : themedToggleStyles.toggleThumb,
                    googleAuthEnabled && styles.toggleThumbActive
                  ]} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Bloqueio Automático</Text>
              <View style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Ativar Bloqueio</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Bloquear app após inatividade
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[
                    styles.toggle,
                    autoLockEnabled ? themedToggleStyles.toggleActive : themedToggleStyles.toggle
                  ]}
                  onPress={() => setAutoLockEnabled(!autoLockEnabled)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.toggleThumb,
                    autoLockEnabled ? themedToggleStyles.toggleThumbActive : themedToggleStyles.toggleThumb,
                    autoLockEnabled && styles.toggleThumbActive
                  ]} />
                </TouchableOpacity>
              </View>

              {autoLockEnabled && (
                <View style={[styles.timeSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Tempo de Inatividade</Text>
                  <View style={styles.timeOptions}>
                    {['1', '5', '10', '30'].map((time) => (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.timeOption,
                          { 
                            backgroundColor: autoLockTime === time ? colors.primary : colors.surface,
                            borderColor: autoLockTime === time ? colors.primary : colors.border 
                          }
                        ]}
                        onPress={() => setAutoLockTime(time)}
                      >
                        <Text style={[styles.timeOptionText, { color: autoLockTime === time ? '#fff' : colors.text }]}>
                          {time}min
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Alertas</Text>
              <View style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Alertas de Login</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Notificar sobre novos logins
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[
                    styles.toggle,
                    loginAlertsEnabled ? themedToggleStyles.toggleActive : themedToggleStyles.toggle
                  ]}
                  onPress={() => setLoginAlertsEnabled(!loginAlertsEnabled)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.toggleThumb,
                    loginAlertsEnabled ? themedToggleStyles.toggleThumbActive : themedToggleStyles.toggleThumb,
                    loginAlertsEnabled && styles.toggleThumbActive
                  ]} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalSection}>
              <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Informações do Dispositivo</Text>
              <View style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>IP Público</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Use este IP para whitelist nas exchanges
                  </Text>
                  <View style={styles.ipRow}>
                    <View style={[styles.ipContainer, { backgroundColor: colors.surfaceSecondary, borderWidth: 0.5, borderColor: colors.border, flex: 1 }]}>
                      <Text style={[styles.ipText, { color: colors.text }]}>{deviceIp}</Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.copyButton, { backgroundColor: colors.primary }]}
                      onPress={handleCopyIp}
                      activeOpacity={0.7}
                      disabled={deviceIp === 'Carregando...' || deviceIp === 'Não disponível'}
                    >
                      <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <Path 
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
                          stroke={colors.textInverse} 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View style={[styles.infoBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={styles.infoIconContainer}>
                  <Text style={styles.infoIconYellow}>i</Text>
                </View>
                <Text style={[styles.infoText, { color: colors.text }]}>
                  Ao criar APIs nas exchanges, adicione este IP na whitelist para maior segurança
                </Text>
              </View>
            </View>
          </ScrollView>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Sobre o App */}
      <Modal
        visible={aboutModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={[styles.aboutModalContainer, { backgroundColor: colors.surface }]}>
              {/* Header */}
              <View style={[styles.aboutModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.aboutModalTitle, { color: colors.text }]}>
                  Sobre o App
                </Text>
                <TouchableOpacity onPress={() => setAboutModalVisible(false)} style={styles.modalCloseButton}>
                  <Text style={[styles.modalCloseIcon, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Content */}
              <ScrollView 
                style={styles.aboutModalContent} 
                contentContainerStyle={styles.aboutModalContentContainer}
                showsVerticalScrollIndicator={true}
              >
                <View style={styles.aboutContent}>
                  <Text style={[styles.appVersion, { color: colors.textSecondary }]}>Versão 1.0.0</Text>
                  <Text style={[styles.aboutText, { color: colors.text }]}>
                    CryptoHub é um agregador de exchanges de criptomoedas que permite você gerenciar todas as suas
                    carteiras em um único lugar.
                  </Text>
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Termos de Uso */}
      <Modal
        visible={termsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTermsModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={[styles.termsModalContainer, { backgroundColor: colors.surface }]}>
              {/* Header */}
              <View style={[styles.termsModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.termsModalTitle, { color: colors.text }]}>
                  Termos de Uso
                </Text>
                <TouchableOpacity onPress={() => setTermsModalVisible(false)} style={styles.modalCloseButton}>
                  <Text style={[styles.modalCloseIcon, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Content */}
              <ScrollView 
                style={styles.termsModalContent} 
                contentContainerStyle={styles.termsModalContentContainer}
                showsVerticalScrollIndicator={true}
              >
                <Text style={[styles.termsText, { color: colors.text }]}>
                  [Conteúdo dos Termos de Uso aqui]
                </Text>
              </ScrollView>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Política de Privacidade */}
      <Modal
        visible={privacyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Política de Privacidade</Text>
            <TouchableOpacity onPress={() => setPrivacyModalVisible(false)}>
              <Text style={[styles.modalClose, { color: colors.primary }]}>Fechar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={[styles.termsText, { color: colors.text }]}>
              [Conteúdo da Política de Privacidade aqui]
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal de Confirmação de Exclusão de Conta */}
      <Modal
        visible={deleteAccountModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteAccountModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={[styles.deleteAccountModalContainer, { backgroundColor: colors.surface }]}>
              {/* Header */}
              <View style={[styles.deleteAccountModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.deleteAccountModalTitle, { color: colors.danger }]}>⚠️ {t('settings.deleteAccount')}</Text>
                <TouchableOpacity 
                  onPress={() => setDeleteAccountModalVisible(false)} 
                  style={styles.modalCloseButton}
                >
                  <Text style={[styles.modalCloseIcon, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Content */}
              <View style={styles.deleteAccountModalContent}>
                <Text style={[styles.deleteAccountWarningText, { color: colors.text }]}>
                  Esta ação é <Text style={{ fontWeight: '700', color: colors.danger }}>irreversível</Text> e resultará em:
                </Text>

                <View style={styles.deleteAccountWarningList}>
                  <View style={styles.deleteAccountWarningItem}>
                    <Text style={[styles.deleteAccountWarningBullet, { color: colors.danger }]}>•</Text>
                    <Text style={[styles.deleteAccountWarningItemText, { color: colors.textSecondary }]}>
                      Perda permanente de todos os seus dados
                    </Text>
                  </View>
                  <View style={styles.deleteAccountWarningItem}>
                    <Text style={[styles.deleteAccountWarningBullet, { color: colors.danger }]}>•</Text>
                    <Text style={[styles.deleteAccountWarningItemText, { color: colors.textSecondary }]}>
                      Desconexão de todas as exchanges vinculadas
                    </Text>
                  </View>
                  <View style={styles.deleteAccountWarningItem}>
                    <Text style={[styles.deleteAccountWarningBullet, { color: colors.danger }]}>•</Text>
                    <Text style={[styles.deleteAccountWarningItemText, { color: colors.textSecondary }]}>
                      Perda do histórico de transações e estratégias
                    </Text>
                  </View>
                  <View style={styles.deleteAccountWarningItem}>
                    <Text style={[styles.deleteAccountWarningBullet, { color: colors.danger }]}>•</Text>
                    <Text style={[styles.deleteAccountWarningItemText, { color: colors.textSecondary }]}>
                      Impossibilidade de recuperação dos dados
                    </Text>
                  </View>
                </View>

                <Text style={[styles.deleteAccountConfirmText, { color: colors.text }]}>
                  Tem certeza que deseja continuar?
                </Text>

                {/* Botões */}
                <View style={styles.deleteAccountModalButtons}>
                  <TouchableOpacity
                    style={[styles.deleteAccountCancelButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
                    onPress={() => setDeleteAccountModalVisible(false)}
                  >
                    <Text style={[styles.deleteAccountCancelButtonText, { color: colors.primary }]}>
                      {t('settings.cancel')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.deleteAccountConfirmButton, { backgroundColor: colors.surface, borderColor: colors.danger }]}
                    onPress={async () => {
                      if (Platform.OS === 'web') {
                        const confirmed = window.confirm(t('settings.deleteAccountConfirm'))
                        if (confirmed) {
                          try {
                            console.log('🗑️ Usuário confirmou exclusão da conta')
                            await deleteAccount()
                            setDeleteAccountModalVisible(false)
                            Alert.alert('✓', t('settings.deleteAccountSuccess'))
                            
                            // Redireciona para login após um pequeno delay
                            setTimeout(() => {
                              if (navigation?.reset) {
                                navigation.reset({
                                  index: 0,
                                  routes: [{ name: 'Login' }]
                                })
                              } else if (navigation?.navigate) {
                                navigation.navigate('Login')
                              }
                            }, 1500)
                          } catch (error) {
                            console.error('❌ Erro ao excluir conta:', error)
                            Alert.alert('Erro', 'Não foi possível excluir sua conta. Tente novamente.')
                          }
                        }
                      } else {
                        Alert.alert(
                          t('settings.deleteAccountTitle'),
                          t('settings.deleteAccountWarning'),
                          [
                            {
                              text: t('settings.cancel'),
                              style: 'cancel'
                            },
                            {
                              text: t('settings.deleteAccountButton'),
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  console.log('🗑️ Usuário confirmou exclusão da conta')
                                  await deleteAccount()
                                  setDeleteAccountModalVisible(false)
                                  Alert.alert('✓', t('settings.deleteAccountSuccess'))
                                  
                                  // Redireciona para login após um pequeno delay
                                  setTimeout(() => {
                                    if (navigation?.reset) {
                                      navigation.reset({
                                        index: 0,
                                        routes: [{ name: 'Login' }]
                                      })
                                    } else if (navigation?.navigate) {
                                      navigation.navigate('Login')
                                    }
                                  }, 1500)
                                } catch (error) {
                                  console.error('❌ Erro ao excluir conta:', error)
                                  Alert.alert('Erro', 'Não foi possível excluir sua conta. Tente novamente.')
                                }
                              }
                            }
                          ]
                        )
                      }
                    }}
                  >
                    <Text style={[styles.deleteAccountConfirmButtonText, { color: colors.danger }]}>
                      Excluir
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de Confirmação de Logout */}
      <ConfirmModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        onConfirm={confirmLogout}
        title={t('profile.logout')}
        message={t('profile.logoutConfirm')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        confirmColor="#ef4444"
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: commonStyles.screenContainer,
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.headerPaddingH,
    paddingVertical: spacing.headerPaddingV,
  },
  titleSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.titleSectionPaddingH,
    paddingTop: spacing.titleSectionPaddingTop,
    paddingBottom: spacing.titleSectionPaddingBottom,
  },
  titleContent: {
    flexDirection: "column",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerText: {
    flexDirection: "column",
  },
  title: {
    fontSize: typography.h3,
    fontWeight: fontWeights.light,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: typography.caption,
    marginTop: 2,
    fontWeight: fontWeights.light,
  },
  scrollView: commonStyles.scrollView,
  content: commonStyles.content,
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.5,
    marginBottom: spacing.itemGap,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.cardPaddingLarge, // Aumentado para 20px (mais premium)
    borderRadius: borderRadius.xl, // Aumentado de medium para xl (20px)
    borderWidth: borders.thin,
    marginBottom: spacing.cardGap, // Aumentado de itemGap para cardGap (16px)
    ...shadows.md, // Sombra mais forte para cards
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.itemGap,
    flex: 1,
  },
  menuIconContainer: {
    width: sizes.iconLarge,
    height: sizes.iconLarge,
    borderRadius: borderRadius.sm, // small → sm
    justifyContent: "center",
    alignItems: "center",
  },
  menuItemText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
  },
  menuItemSubtext: {
    fontSize: typography.bodySmall,
    marginTop: 2,
  },
  menuItemArrow: {
    fontSize: typography.h1,
    fontWeight: fontWeights.light,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  modalTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeights.regular,
  },
  modalClose: {
    fontSize: typography.h4,
    fontWeight: fontWeights.medium,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 0.5,
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: typography.bodyLarge,
    fontWeight: fontWeights.regular,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: typography.bodySmall,
  },
  timeSelector: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  timeOptions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  timeOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  timeOptionText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
  },
  aboutContent: {
    alignItems: "center",
    paddingVertical: 40,
  },
  appVersion: {
    fontSize: typography.body,
    marginBottom: 16,
  },
  aboutText: {
    fontSize: typography.bodyLarge,
    lineHeight: 24,
    textAlign: "center",
  },
  termsText: {
    fontSize: typography.body,
    lineHeight: 22,
  },
  // Toggle Button
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  ipContainer: {
    padding: 12,
    borderRadius: 8,
    opacity: 0.8,
  },
  ipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  ipText: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.3,
  },
  copyButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  infoBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 0.5,
    opacity: 0.8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoIconContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFA500",
    alignItems: "center",
    justifyContent: "center",
  },
  infoIconYellow: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.bold,
    color: "#FFFFFF",
  },
  infoText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.light,
    lineHeight: 16,
    flex: 1,
  },
  deleteAccountButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteAccountButtonText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.semibold,
  },
  // Security Modal Styles (following CreateStrategyModal pattern)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSafeArea: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  securityModalContainer: {
    borderRadius: 20,
    width: "90%",
    maxHeight: "85%",
    height: "85%",
  },
  securityModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  securityModalTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeights.medium,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseIcon: {
    fontSize: 22,
    fontWeight: fontWeights.light,
  },
  securityModalContent: {
    flex: 1,
  },
  securityModalContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    flexGrow: 1,
  },
  // About Modal Styles (following CreateStrategyModal pattern)
  aboutModalContainer: {
    borderRadius: 20,
    width: "90%",
    maxHeight: "85%",
    height: "85%",
  },
  aboutModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  aboutModalTitle: {
    fontSize: 20,
    fontWeight: "500",
  },
  aboutModalContent: {
    flex: 1,
  },
  aboutModalContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    flexGrow: 1,
  },
  // Terms Modal Styles (following CreateStrategyModal pattern)
  termsModalContainer: {
    borderRadius: 20,
    width: "90%",
    maxHeight: "85%",
    height: "85%",
  },
  termsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  termsModalTitle: {
    fontSize: 20,
    fontWeight: "500",
  },
  termsModalContent: {
    flex: 1,
  },
  termsModalContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    flexGrow: 1,
  },
  // Delete Account Modal Styles
  deleteAccountModalContainer: {
    width: "90%",
    maxHeight: "85%",
    borderRadius: 20,
    overflow: "hidden",
  },
  deleteAccountModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  deleteAccountModalTitle: {
    fontSize: 20,
    fontWeight: "500",
  },
  deleteAccountModalContent: {
    padding: 20,
  },
  deleteAccountWarningText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  deleteAccountWarningList: {
    marginBottom: 20,
  },
  deleteAccountWarningItem: {
    flexDirection: "row",
    marginBottom: 12,
    paddingLeft: 8,
  },
  deleteAccountWarningBullet: {
    fontSize: 18,
    marginRight: 12,
    fontWeight: "700",
  },
  deleteAccountWarningItemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  deleteAccountConfirmText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 24,
    textAlign: "center",
  },
  deleteAccountModalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  deleteAccountCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  deleteAccountCancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  deleteAccountConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  deleteAccountConfirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  // ===== Estilos do Profile Tab =====
  logoutButtonInline: {
    marginBottom: spacing.itemGap,
    alignItems: 'flex-end',
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  logoutButtonText: {
    fontSize: typography.button,
    fontWeight: fontWeights.regular,
    color: "#ffffff",
  },
  profileHeader: {
    borderRadius: borderRadius.xxl, // Aumentado de large para xxl (24px) - card premium
    padding: spacing.cardPaddingLarge, // Mais padding para card premium
    marginTop: spacing.cardGap, // Aumentado de itemGap para cardGap (16px)
    marginBottom: spacing.sectionGap,
    borderWidth: 0,
    alignItems: 'center',
    ...shadows.lg, // Sombra forte para card de destaque
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    fontSize: typography.h3,
    fontWeight: fontWeights.semibold,
    color: '#ffffff',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: typography.bodyLarge,
    fontWeight: fontWeights.regular,
    marginBottom: 4,
  },
  profileMember: {
    fontSize: typography.caption,
  },
  profileInfoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.cardPaddingLarge, // Aumentado para 20px (mais premium)
    borderRadius: borderRadius.xl, // medium → xl (20px)
    borderWidth: borders.thin,
    marginBottom: spacing.cardGap, // Aumentado de itemGap para cardGap (16px)
    ...shadows.md, // Sombra mais forte
  },
  profileInfoItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.itemGap,
    flex: 1,
  },
  profileInfoIconContainer: {
    width: sizes.iconLarge,
    height: sizes.iconLarge,
    borderRadius: borderRadius.sm, // small → sm
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfoTextContainer: {
    flex: 1,
  },
  profileInfoLabel: {
    fontSize: typography.caption,
    marginBottom: 2,
  },
  profileInfoValue: {
    fontSize: typography.bodyLarge,
    fontWeight: fontWeights.regular,
  },
  actionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.cardPaddingLarge, // Aumentado para 20px (mais premium)
    borderRadius: borderRadius.xl, // medium → xl (20px)
    borderWidth: borders.thin,
    marginBottom: spacing.cardGap, // Aumentado de itemGap para cardGap (16px)
    ...shadows.md, // Sombra mais forte
  },
  actionItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.itemGap,
    flex: 1,
  },
  actionIconContainer: {
    width: sizes.iconLarge,
    height: sizes.iconLarge,
    borderRadius: borderRadius.sm, // small → sm
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
  },
})

