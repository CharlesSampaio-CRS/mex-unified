import { 
  Text, 
  StyleSheet, 
  ScrollView, 
  View, 
  TouchableOpacity, 
  Alert, 
  Modal, 
  Platform,
  KeyboardAvoidingView,
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
import { LogoIcon } from "../components/LogoIcon"
import { typography, fontWeights } from "../lib/typography"
import { commonStyles, spacing, borderRadius, shadows, borders, sizes } from "@/lib/layout"
import Svg, { Path, Circle } from "react-native-svg"

export function SystemScreen({ navigation }: any) {
  const { theme, setTheme, colors, isDark } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { unreadCount } = useNotifications()
  const { 
    biometricAvailable, 
    biometricType, 
    isBiometricEnabled,
    isAutoLoginEnabled,
    enableBiometric,
    disableBiometric,
    setAutoLoginEnabled
  } = useAuth()
  
  // Estados dos modais
  const [aboutModalVisible, setAboutModalVisible] = useState(false)
  const [termsModalVisible, setTermsModalVisible] = useState(false)
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false)
  const [securityModalVisible, setSecurityModalVisible] = useState(false)
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false)
  
  // Estados de segurança  
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(false)
  const [autoLockEnabled, setAutoLockEnabled] = useState(true)
  const [autoLockTime, setAutoLockTime] = useState('5')
  const [loginAlertsEnabled, setLoginAlertsEnabled] = useState(true)
  const [deviceIp, setDeviceIp] = useState<string>('Carregando...')

  // Themed toggle styles
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

  // Busca IP público ao abrir modal de segurança
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

  const handleAutoLoginToggle = async () => {
    try {
      await setAutoLoginEnabled(!isAutoLoginEnabled)
    } catch (error) {
      Alert.alert(t('common.error'), 'Erro ao alterar configuração de login automático')
    }
  }

  const onNotificationsPress = useCallback(() => {
    setNotificationsModalVisible(true)
  }, [])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        title={t('settings.systemTitle')}
        subtitle={t('settings.subtitle')}
        onNotificationsPress={onNotificationsPress}
        unreadCount={unreadCount}
      />

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
            <View style={styles.menuTextContainer}>
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
            <View style={styles.menuTextContainer}>
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
              <View style={styles.menuTextContainer}>
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

        {/* Login Automático com Biometria */}
        {biometricAvailable && isBiometricEnabled && (
          <View style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.itemGap }]}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: colors.surface }]}>
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Circle cx="9" cy="7" r="4" stroke={colors.text} strokeWidth="2" />
                  <Path
                    d="M23 21v-2a4 4 0 0 0-3-3.87"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M16 3.13a4 4 0 0 1 0 7.75"
                    stroke={colors.text}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuItemText, { color: colors.text }]}>Login Automático</Text>
                <Text style={[styles.menuItemSubtext, { color: colors.textSecondary }]}>
                  {isAutoLoginEnabled ? 'FaceID ao abrir o app' : 'Desativado'}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[
                styles.toggle,
                isAutoLoginEnabled ? themedToggleStyles.toggleActive : themedToggleStyles.toggle
              ]}
              onPress={handleAutoLoginToggle}
              activeOpacity={0.7}
            >
              <View style={[
                styles.toggleThumb,
                isAutoLoginEnabled ? themedToggleStyles.toggleThumbActive : themedToggleStyles.toggleThumb,
                isAutoLoginEnabled && styles.toggleThumbActive
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

        {/* Termos de Uso */}
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

        {/* Política de Privacidade */}
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
              <View style={[styles.aboutModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.aboutModalTitle, { color: colors.text }]}>
                  Sobre o App
                </Text>
                <TouchableOpacity onPress={() => setAboutModalVisible(false)} style={styles.modalCloseButton}>
                  <Text style={[styles.modalCloseIcon, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>
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
              <View style={[styles.termsModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.termsModalTitle, { color: colors.text }]}>
                  Termos de Uso
                </Text>
                <TouchableOpacity onPress={() => setTermsModalVisible(false)} style={styles.modalCloseButton}>
                  <Text style={[styles.modalCloseIcon, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>
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
        <SafeAreaView style={[styles.privacyModalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.privacyModalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.privacyModalTitle, { color: colors.text }]}>Política de Privacidade</Text>
            <TouchableOpacity onPress={() => setPrivacyModalVisible(false)}>
              <Text style={[styles.privacyModalClose, { color: colors.primary }]}>Fechar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.privacyModalContent}>
            <Text style={[styles.termsText, { color: colors.text }]}>
              [Conteúdo da Política de Privacidade aqui]
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: commonStyles.screenContainer,
  scrollView: commonStyles.scrollView,
  content: commonStyles.content,
  // Menu Items
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.cardPaddingLarge,
    borderRadius: borderRadius.xl,
    borderWidth: borders.thin,
    marginBottom: spacing.cardGap,
    ...shadows.md,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.itemGap,
    flex: 1,
  },
  menuTextContainer: {
    flex: 1,
    flexShrink: 1,
  },
  menuIconContainer: {
    width: sizes.iconLarge,
    height: sizes.iconLarge,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  menuItemText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  menuItemSubtext: {
    fontSize: typography.bodySmall,
    marginTop: 2,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  menuItemArrow: {
    fontSize: typography.h1,
    fontWeight: fontWeights.light,
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
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
  // Modals shared
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
  modalCloseButton: {
    padding: 4,
  },
  modalCloseIcon: {
    fontSize: 22,
    fontWeight: fontWeights.light,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
    marginBottom: 12,
  },
  // Security Modal
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
  securityModalContent: {
    flex: 1,
  },
  securityModalContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    flexGrow: 1,
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
  // About Modal
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
  // Terms Modal
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
  termsText: {
    fontSize: typography.body,
    lineHeight: 22,
  },
  // Privacy Modal
  privacyModalContainer: {
    flex: 1,
  },
  privacyModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  privacyModalTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeights.regular,
  },
  privacyModalClose: {
    fontSize: typography.h4,
    fontWeight: fontWeights.medium,
  },
  privacyModalContent: {
    flex: 1,
    padding: 20,
  },
})
