import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import Svg, { Path, Circle, Line, Defs, Filter, FeGaussianBlur, FeMerge, FeMergeNode } from 'react-native-svg'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { LinearGradient } from 'expo-linear-gradient'
import { typography, fontWeights } from '@/lib/typography'
import { AnimatedLogoIcon } from '@/components/AnimatedLogoIcon'
import { config } from '@/lib/config'

interface LoginScreenProps {
  navigation: any
}

// MultExchanges Logo
const LogoIcon = () => (
  <Svg width="60" height="60" viewBox="0 0 1024 1024" fill="none">
    <Defs>
      <Filter id="glow">
        <FeGaussianBlur stdDeviation="10" result="coloredBlur"/>
        <FeMerge>
          <FeMergeNode in="coloredBlur"/>
          <FeMergeNode in="SourceGraphic"/>
        </FeMerge>
      </Filter>
    </Defs>
    
    {/* Central Hub Circle */}
    <Circle cx="512" cy="512" r="140" fill="#FFC107" filter="url(#glow)"/>
    <Circle cx="512" cy="512" r="100" fill="#F59E0B"/>
    
    {/* Connection lines */}
    <Line x1="512" y1="412" x2="512" y2="220" stroke="#60A5FA" strokeWidth="12" opacity="0.6"/>
    <Line x1="612" y1="512" x2="804" y2="512" stroke="#60A5FA" strokeWidth="12" opacity="0.6"/>
    <Line x1="512" y1="612" x2="512" y2="804" stroke="#60A5FA" strokeWidth="12" opacity="0.6"/>
    <Line x1="412" y1="512" x2="220" y2="512" stroke="#60A5FA" strokeWidth="12" opacity="0.6"/>
    
    {/* Diagonal connections */}
    <Line x1="598" y1="426" x2="738" y2="286" stroke="#60A5FA" strokeWidth="10" opacity="0.4"/>
    <Line x1="598" y1="598" x2="738" y2="738" stroke="#60A5FA" strokeWidth="10" opacity="0.4"/>
    <Line x1="426" y1="598" x2="286" y2="738" stroke="#60A5FA" strokeWidth="10" opacity="0.4"/>
    <Line x1="426" y1="426" x2="286" y2="286" stroke="#60A5FA" strokeWidth="10" opacity="0.4"/>
    
    {/* Satellite Nodes */}
    <Circle cx="512" cy="200" r="70" fill="#3B82F6" filter="url(#glow)"/>
    <Circle cx="512" cy="200" r="50" fill="#2563EB"/>
    
    <Circle cx="824" cy="512" r="70" fill="#3B82F6" filter="url(#glow)"/>
    <Circle cx="824" cy="512" r="50" fill="#2563EB"/>
    
    <Circle cx="512" cy="824" r="70" fill="#3B82F6" filter="url(#glow)"/>
    <Circle cx="512" cy="824" r="50" fill="#2563EB"/>
    
    <Circle cx="200" cy="512" r="70" fill="#3B82F6" filter="url(#glow)"/>
    <Circle cx="200" cy="512" r="50" fill="#2563EB"/>
    
    {/* Corner nodes */}
    <Circle cx="268" cy="268" r="50" fill="#3B82F6" opacity="0.8"/>
    <Circle cx="756" cy="268" r="50" fill="#3B82F6" opacity="0.8"/>
    <Circle cx="756" cy="756" r="50" fill="#3B82F6" opacity="0.8"/>
    <Circle cx="268" cy="756" r="50" fill="#3B82F6" opacity="0.8"/>
  </Svg>
)

// Google Icon Component
const GoogleIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
)

// Apple Icon Component
const AppleIcon = ({ color = "#000000" }: { color?: string }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
    <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </Svg>
)

export function LoginScreen({ navigation }: LoginScreenProps) {
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const {
    login,
    loginWithBiometric,
    loginWithGoogle,
    loginWithApple,
    biometricAvailable,
    biometricType,
    isBiometricEnabled,
    isAutoLoginEnabled,
    isLoading,
    isLoadingData,
    hasTriedAutoAuth,
    autoAuthCancelled,
    markAutoAuthTried,
  } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const hasProcessedOAuth = useRef(false)
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false) // 🆕 Estado para processar OAuth

  const isFullLoading = isLoading || isLoadingData

  // 🔐 AUTO-AUTH: Tenta FaceID automaticamente quando tela carrega
  useEffect(() => {
    const tryAutoAuth = async () => {
      // ✅ Marca como tentado IMEDIATAMENTE para evitar loops
      if (hasTriedAutoAuth) {
        console.log('⏭️ Auto-auth já foi tentado, pulando...')
        return
      }
      
      // Se usuário cancelou anteriormente, não tenta mais
      if (autoAuthCancelled) {
        console.log('🚫 Auto-auth foi cancelado anteriormente, pulando...')
        return
      }
      
      // Marca ANTES de qualquer operação assíncrona
      markAutoAuthTried()
      
      // Aguarda um momento para garantir que o estado está carregado
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Verifica se pode fazer auto-auth E se está habilitado
      if (
        biometricAvailable && 
        isBiometricEnabled && 
        isAutoLoginEnabled &&  // ← Verifica configuração
        !isLoading && 
        !isLoadingData
      ) {
        console.log('🔐 Tentando autenticação automática com biometria...')
        
        try {
          await loginWithBiometric(true) // true = isAutoAuth
        } catch (error: any) {
          console.log('⚠️ Auto-auth falhou:', error)
          // Erro já tratado no AuthContext
        }
      } else {
        console.log('ℹ️ Auto-auth não disponível:', {
          biometricAvailable,
          isBiometricEnabled,
          isAutoLoginEnabled,
          isLoading,
          isLoadingData
        })
      }
    }
    
    tryAutoAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 🔐 Detecta parâmetros OAuth na URL quando LoginScreen carrega
  useEffect(() => {
    if (hasProcessedOAuth.current) return

    // Só executa OAuth se for ambiente web
    if (
      typeof window !== 'undefined' &&
      typeof window.location !== 'undefined' &&
      typeof window.location.search === 'string'
    ) {
      const urlParams = new URLSearchParams(window.location.search)
      const accessToken = urlParams.get('access_token')
      const userId = urlParams.get('user_id')
      const email = urlParams.get('email')
      const name = urlParams.get('name')

      if (accessToken && userId && email) {
        hasProcessedOAuth.current = true
        setIsProcessingOAuth(true)

        // ✅ VALIDA O TOKEN NO BACKEND ANTES DE PROCESSAR
        const validateAndProcess = async () => {
          try {
            console.log('🔍 Validando token OAuth com backend...')

            const response = await fetch(`${config.kongBaseUrl}/auth/verify`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            })

            if (!response.ok) {
              throw new Error(`Token validation failed: ${response.status}`)
            }

            const validationData = await response.json()
            
            if (!validationData.valid || validationData.user_id !== userId) {
              throw new Error('Token inválido ou não pertence ao usuário')
            }
            
            console.log('✅ Token válido, processando login...')
            
            const oauthData = {
              type: 'OAUTH_SUCCESS',
              access_token: accessToken,
              user_id: userId,
              email: email,
              name: name || '',
              timestamp: Date.now()
            }
            
            localStorage.setItem('oauth_result', JSON.stringify(oauthData))
            
            const isPopup = window.opener !== null
            
            if (isPopup) {
              // É popup - apenas salva e fecha
              setTimeout(() => {
                window.close()
              }, 300)
            } else {
              // Não é popup - processa login e aguarda conclusão
              window.dispatchEvent(new CustomEvent('oauth-callback', {
                detail: oauthData
              }))
              
              // Aguarda um momento para processar o evento antes de limpar a URL
              await new Promise(resolve => setTimeout(resolve, 100))
              
              window.history.replaceState({}, document.title, '/')
            }
            
            // Só marca como não processando após tudo concluir
            setIsProcessingOAuth(false)
          } catch (error) {
            console.error('❌ Falha na validação do token OAuth:', error)
            setIsProcessingOAuth(false)
            Alert.alert(
              'Erro de autenticação',
              'Não foi possível validar o login com Google. Tente novamente.'
            )
            // Limpa parâmetros da URL
            window.history.replaceState({}, document.title, '/')
          }
        }
        
        validateAndProcess()
      }
    }
  }, [])
  
  // 🆕 Se está processando OAuth, não renderiza nada (evita flash da tela de login)
  if (isProcessingOAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ marginTop: 16, color: colors.text }}>
          {t('auth.completingLogin')}
        </Text>
      </View>
    )
  }

  const handleLogin = async () => {
    if (!email || !password) {
      return
    }

    try {
      await login(email, password)
    } catch (error: any) {
      console.error('❌ Erro no login:', error)
    }
  }

  const handleBiometricLogin = async () => {
    try {
      await loginWithBiometric(false) // false = manual, não é auto-auth
    } catch (error: any) {
      // Se usuário cancelou, não mostra erro (comportamento esperado)
      if (
        error?.name === 'BiometricCancelError' ||
        error?.message?.toLowerCase().includes('cancel')
      ) {
        console.log('👤 Usuário cancelou o FaceID manualmente')
        return // Sai silenciosamente
      }
      
      // Para outros erros, mostra alerta
      console.error('❌ Erro no login biométrico:', error)
      Alert.alert(
        'Erro de Autenticação',
        'Não foi possível autenticar com biometria. Tente novamente ou use outro método de login.'
      )
    }
  }

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle()
    } catch (error: any) {
      console.error('❌ Erro no login com Google:', error)
    }
  }

  const handleAppleLogin = async () => {
    try {
      await loginWithApple()
    } catch (error: any) {
      console.error('❌ Erro no login com Apple:', error)
    }
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: 40,
      paddingBottom: 24,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 12,
    },
    logo: {
      fontSize: 48,
      marginBottom: 16,
      textAlign: 'center',
    },
    title: {
      fontSize: typography.h3,
      fontWeight: fontWeights.light,
      letterSpacing: -0.2,
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: typography.caption,
      fontWeight: fontWeights.light,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    formContainer: {
      flex: 1,
      paddingHorizontal: 24,
    },
    inputContainer: {
      marginBottom: 16,
    },
    label: {
      fontSize: typography.h4,
      fontWeight: fontWeights.regular,
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      fontSize: typography.body,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    passwordInput: {
      flex: 1,
      padding: 12,
      fontSize: typography.body,
      color: colors.text,
    },
    showPasswordButton: {
      padding: 12,
    },
    showPasswordText: {
      color: colors.textSecondary,
      fontSize: typography.body,
    },
    forgotPassword: {
      alignSelf: 'flex-end',
      marginBottom: 24,
    },
    forgotPasswordText: {
      color: '#3b82f6',
      fontSize: typography.body,
      fontWeight: fontWeights.regular,
    },
    loginButton: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    loginButtonDisabled: {
      opacity: 0.6,
    },
    loginButtonText: {
      color: '#3b82f6',
      fontSize: typography.bodyLarge,
      fontWeight: fontWeights.semibold,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      marginHorizontal: 16,
      color: colors.textSecondary,
      fontSize: typography.body,
    },
    biometricButton: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'center',
    },
    biometricIcon: {
      fontSize: 20,
      marginRight: 8,
    },
    biometricButtonText: {
      color: colors.text,
      fontSize: typography.h4,
      fontWeight: fontWeights.regular,
    },
    socialButtons: {
      gap: 12,
      marginBottom: 24,
    },
    socialButton: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    socialButtonText: {
      color: colors.text,
      fontSize: typography.bodyLarge,
      fontWeight: fontWeights.regular,
    },
    signupContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 24,
      paddingBottom: 32,
    },
    signupText: {
      color: colors.textSecondary,
      fontSize: typography.body,
    },
    signupLink: {
      color: '#3b82f6',
      fontSize: typography.body,
      fontWeight: fontWeights.regular,
      marginLeft: 4,
    },
  })

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <LogoIcon />
          </View>
          <Text style={styles.title}>{t('login.welcome')}</Text>
          <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
        </View>

        <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('login.email')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isFullLoading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('login.password')}</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder={t('login.passwordPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isFullLoading}
            />
            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.showPasswordText}>
                {showPassword ? t('login.hidePassword') : t('login.showPassword')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.forgotPassword}>
          <Text style={styles.forgotPasswordText}>{t('login.forgotPassword')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.loginButton, 
            { backgroundColor: colors.surface, borderColor: '#3b82f6' },
            isFullLoading && styles.loginButtonDisabled
          ]}
          onPress={handleLogin}
          disabled={isFullLoading}
        >
          {isFullLoading ? (
            <AnimatedLogoIcon size={24} />
          ) : (
            <Text style={styles.loginButtonText}>{t('login.signIn')}</Text>
          )}
        </TouchableOpacity>

        {biometricAvailable && isBiometricEnabled && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('login.orContinueWith')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              disabled={isFullLoading}
            >
              <Text style={styles.biometricIcon}>
                {biometricType === 'Face ID' ? '👤' : '👆'}
              </Text>
              <Text style={styles.biometricButtonText}>
                {t('login.signInWith')} {biometricType}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('login.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleLogin}
            disabled={isFullLoading}
          >
            <GoogleIcon />
            <Text style={styles.socialButtonText}>{t('login.google')}</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: isDark ? '#ffffff' : '#000000' }]}
              onPress={handleAppleLogin}
              disabled={isFullLoading}
            >
              <AppleIcon color={isDark ? '#000000' : '#ffffff'} />
              <Text style={[styles.socialButtonText, { color: isDark ? '#000000' : '#ffffff' }]}>
                {t('login.apple')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>{t('login.noAccount')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.signupLink}>{t('login.signUp')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
