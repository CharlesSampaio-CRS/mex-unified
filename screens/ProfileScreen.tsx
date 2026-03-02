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
import { useState, useCallback } from "react"
import { useTheme } from "../contexts/ThemeContext"
import { useLanguage } from "../contexts/LanguageContext"
import { useAuth } from "../contexts/AuthContext"
import { useNotifications } from "../contexts/NotificationsContext"
import { useHeader } from "../contexts/HeaderContext"
import { NotificationsModal } from "../components/NotificationsModal"
import { ConfirmModal } from "../components/ConfirmModal"
import { typography, fontWeights } from "../lib/typography"
import { commonStyles, spacing, borderRadius, shadows, borders, sizes } from "@/lib/layout"
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg"

export function ProfileScreen({ navigation }: any) {
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const { unreadCount } = useNotifications()
  const { 
    user,
    logout,
    deleteAccount,
  } = useAuth()
  
  // Dados do usuário
  const userData = {
    name: user?.name || "Carregando...",
    email: user?.email || "usuario@exemplo.com",
    phone: "+55 (11) 98765-4321",
    memberSince: "Janeiro 2024",
    avatar: null
  }

  // Estados dos modais
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false)
  const [exportDataModalVisible, setExportDataModalVisible] = useState(false)
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false)
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false)
  const [logoutModalVisible, setLogoutModalVisible] = useState(false)

  // Handlers
  const handleLogout = () => {
    setLogoutModalVisible(true)
  }

  const confirmLogout = async () => {
    try {
      await logout()
      if (navigation?.reset) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
      } else if (navigation?.navigate) {
        navigation.navigate('Login')
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

  const onNotificationsPress = useCallback(() => {
    setNotificationsModalVisible(true)
  }, [])

  // Define o Header global para esta tela
  useHeader({
    title: t('profile.title'),
    subtitle: t('profile.subtitle'),
    onNotificationsPress,
    unreadCount,
  })

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
                  <Defs>
                    <LinearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor={colors.primary} />
                      <Stop offset="100%" stopColor={colors.warning} />
                    </LinearGradient>
                  </Defs>
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
            <Text style={[styles.profileName, { color: colors.primary }]}>
              {userData.name}
            </Text>
            <Text style={[styles.profileMember, { color: colors.primaryLight }]}>
              {t('profile.memberSince')} {userData.memberSince}
            </Text>
          </View>
        </View>

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
                  <Path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0z" fill="#1F2937" />
                  <Path d="M12 23c6.075 0 11-4.925 11-11S18.075 1 12 1 1 5.925 1 12s4.925 11 11 11z" fill="white" />
                  <Path d="M12 5.5c3.589 0 6.5 2.911 6.5 6.5s-2.911 6.5-6.5 6.5S5.5 15.589 5.5 12 8.411 5.5 12 5.5z" fill="white" />
                  <Path d="M16 12c0 2.209-1.791 4-4 4s-4-1.791-4-4 1.791-4 4-4 4 1.791 4 4z" fill="#1F2937" />
                </Svg>
              ) : user?.authProvider === 'apple' ? (
                <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <Path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0z" fill="black" />
                  <Path d="M12 23c6.075 0 11-4.925 11-11S18.075 1 12 1 1 5.925 1 12s4.925 11 11 11z" fill="white" />
                  <Path d="M15.5 7c-1 0-2 1-2.5 2-.5-1-1.5-2-2.5-2-2 0-3.5 1.5-3.5 3.5 0 2 1 3 3.5 5.5 2.5 2.5 3.5 3.5 5 3.5s2.5-1 5-3.5c2.5-2.5 3.5-3.5 3.5-5.5 0-2-1.5-3.5-3.5-3.5z" fill="black" />
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

        {/* Exportar Dados */}
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

        {/* Logout */}
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

        {/* Excluir Conta */}
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

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modais */}
      <NotificationsModal 
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />

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
                            await deleteAccount()
                            setDeleteAccountModalVisible(false)
                            Alert.alert('✓', t('settings.deleteAccountSuccess'))
                            setTimeout(() => {
                              if (navigation?.reset) {
                                navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
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
                            { text: t('settings.cancel'), style: 'cancel' },
                            {
                              text: t('settings.deleteAccountButton'),
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await deleteAccount()
                                  setDeleteAccountModalVisible(false)
                                  Alert.alert('✓', t('settings.deleteAccountSuccess'))
                                  setTimeout(() => {
                                    if (navigation?.reset) {
                                      navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: commonStyles.screenContainer,
  scrollView: commonStyles.scrollView,
  content: commonStyles.content,
  // Profile Header
  profileHeader: {
    borderRadius: borderRadius.xxl,
    padding: spacing.cardPaddingLarge,
    marginTop: spacing.cardGap,
    marginBottom: spacing.sectionGap,
    borderWidth: 0,
    alignItems: 'center',
    ...shadows.lg,
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
  // Profile Info Items
  profileInfoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.cardPaddingLarge,
    borderRadius: borderRadius.xl,
    borderWidth: borders.thin,
    marginBottom: spacing.cardGap,
    ...shadows.md,
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
    borderRadius: borderRadius.sm,
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
  // Action Items
  actionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.cardPaddingLarge,
    borderRadius: borderRadius.xl,
    borderWidth: borders.thin,
    marginBottom: spacing.cardGap,
    ...shadows.md,
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
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
  },
  // Delete Account
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
  // Modals
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
  // Delete Account Modal
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
})
