import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { AnimatedLogoIcon } from '@/components/AnimatedLogoIcon'
import { typography, fontWeights } from '@/lib/typography'
import { LogoIcon } from '@/components/LogoIcon'
import { ErrorModal } from '@/components/ErrorModal'

interface SignUpScreenProps {
  navigation: any
}

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

export function SignUpScreen({ navigation }: SignUpScreenProps) {
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const {
    register,
    registerWithGoogle,
    registerWithApple,
    isLoading,
  } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // Estados para controle do modal de erro
  const [errorModalVisible, setErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [errorTitle, setErrorTitle] = useState('')
  const [errorType, setErrorType] = useState<'error' | 'warning' | 'info'>('error')

  // Função helper para mostrar erro
  const showError = (message: string, title?: string, type: 'error' | 'warning' | 'info' = 'error') => {
    setErrorMessage(message)
    setErrorTitle(title || t('common.error'))
    setErrorType(type)
    setErrorModalVisible(true)
  }

  // Calcula a força da senha
  const getPasswordStrength = () => {
    if (!password) return { strength: 0, label: '', color: colors.textSecondary }
    
    let strength = 0
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    }
    
    if (checks.length) strength++
    if (checks.uppercase) strength++
    if (checks.lowercase) strength++
    if (checks.number) strength++
    if (checks.special) strength++
    
    if (strength <= 2) {
      return { 
        strength: 1, 
        label: t('signup.passwordWeak') || 'Fraca', 
        color: '#ef4444' 
      }
    } else if (strength <= 3) {
      return { 
        strength: 2, 
        label: t('signup.passwordMedium') || 'Média', 
        color: '#f59e0b' 
      }
    } else if (strength <= 4) {
      return { 
        strength: 3, 
        label: t('signup.passwordGood') || 'Boa', 
        color: '#10b981' 
      }
    } else {
      return { 
        strength: 4, 
        label: t('signup.passwordStrong') || 'Forte', 
        color: '#059669' 
      }
    }
  }

  const passwordStrength = getPasswordStrength()

  const handleRegister = async () => {
    // Validações básicas
    if (!name.trim()) {
      showError(t('signup.nameRequired') || 'Nome é obrigatório')
      return
    }
    
    if (!email.trim()) {
      showError(t('signup.emailRequired') || 'Email é obrigatório')
      return
    }
    
    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      showError(t('signup.invalidEmail') || 'Email inválido')
      return
    }
    
    if (!password) {
      showError(t('signup.passwordRequired') || 'Senha é obrigatória')
      return
    }
    
    if (!confirmPassword) {
      showError(t('signup.confirmPasswordRequired') || 'Confirmação de senha é obrigatória')
      return
    }

    if (password !== confirmPassword) {
      showError(t('signup.passwordMismatch'))
      return
    }

    // Validações de força da senha
    if (password.length < 8) {
      showError(
        t('signup.passwordTooShort') || 'A senha deve ter pelo menos 8 caracteres'
      )
      return
    }
    
    // Verifica se tem pelo menos uma letra maiúscula
    if (!/[A-Z]/.test(password)) {
      showError(
        t('signup.passwordNeedsUppercase') || 'A senha deve conter pelo menos uma letra maiúscula'
      )
      return
    }
    
    // Verifica se tem pelo menos uma letra minúscula
    if (!/[a-z]/.test(password)) {
      showError(
        t('signup.passwordNeedsLowercase') || 'A senha deve conter pelo menos uma letra minúscula'
      )
      return
    }
    
    // Verifica se tem pelo menos um número
    if (!/[0-9]/.test(password)) {
      showError(
        t('signup.passwordNeedsNumber') || 'A senha deve conter pelo menos um número'
      )
      return
    }

    try {
      await register(email, password, name)
      // Sucesso - Limpa os campos e navega
      setName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      
      showError(
        t('signup.accountCreatedMessage') || 'Sua conta foi criada com sucesso!',
        t('common.success') || 'Sucesso',
        'info'
      )
      
      // Aguarda um momento para o usuário ver a mensagem antes de navegar
      setTimeout(() => {
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] })
      }, 1500)
    } catch (error: any) {
      console.log('🔴 Erro no registro:', error)
      console.log('🔴 Tipo do erro:', typeof error)
      console.log('🔴 Mensagem do erro:', error.message)
      
      let message = error.message || error.toString() || t('signup.createAccountFailed')
      
      // Normaliza a mensagem para minúsculas para facilitar a detecção
      const messageLower = message.toLowerCase()
      
      // Tratamento de erros específicos com detecção case-insensitive
      if (messageLower.includes('already exists') || 
          messageLower.includes('user already exists') || 
          messageLower.includes('email already') ||
          messageLower.includes('já existe') ||
          messageLower.includes('já cadastrado')) {
        message = t('signup.userAlreadyExists') || 'Este email já está cadastrado. Tente fazer login ou use outro email.'
        console.log('✅ Erro detectado: usuário já existe')
      } else if (messageLower.includes('invalid email') || 
                 messageLower.includes('email inválido') ||
                 messageLower.includes('e-mail inválido')) {
        message = t('signup.invalidEmail') || 'Email inválido. Verifique o formato do email.'
        console.log('✅ Erro detectado: email inválido')
      } else if (messageLower.includes('password') && 
                 (messageLower.includes('weak') || 
                  messageLower.includes('short') || 
                  messageLower.includes('invalid'))) {
        message = t('signup.passwordError') || 'Senha não atende aos requisitos de segurança.'
        console.log('✅ Erro detectado: problema com senha')
      } else if (messageLower.includes('network') || 
                 messageLower.includes('failed to fetch') ||
                 messageLower.includes('conexão')) {
        message = t('signup.networkError') || 'Erro de conexão. Verifique sua internet e tente novamente.'
        console.log('✅ Erro detectado: problema de rede')
      } else if (messageLower.includes('timeout') || 
                 messageLower.includes('timed out')) {
        message = t('signup.timeoutError') || 'A operação demorou muito. Tente novamente.'
        console.log('✅ Erro detectado: timeout')
      } else if (messageLower.includes('registration failed') ||
                 messageLower.includes('cadastro falhou')) {
        message = t('signup.registrationFailed') || 'Falha ao criar conta. Tente novamente mais tarde.'
        console.log('✅ Erro detectado: falha no registro')
      } else {
        console.log('⚠️  Erro não mapeado:', message)
        // Se a mensagem for muito técnica ou em JSON, usa uma mensagem genérica
        if (message.includes('{') || message.includes('Error:')) {
          message = t('signup.createAccountFailed') || 'Não foi possível criar sua conta. Tente novamente.'
        }
      }
      
      showError(message)
    }
  }

  const handleGoogleRegister = async () => {
    try {
      await registerWithGoogle()
    } catch (error: any) {
      const message = error.message || t('signup.googleSignupFailed') || 'Falha no registro com Google'
      showError(message)
    }
  }

  const handleAppleRegister = async () => {
    try {
      await registerWithApple()
    } catch (error: any) {
      const message = error.message || t('signup.appleSignupFailed') || 'Falha no registro com Apple'
      showError(message)
    }
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: 40,
      paddingBottom: 16,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backButtonText: {
      color: colors.text,
      fontSize: typography.h2,
      fontWeight: fontWeights.regular,
    },
    logo: {
      marginBottom: 12,
      alignItems: 'center',
      justifyContent: 'center',
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
      marginBottom: 12,
    },
    label: {
      fontSize: typography.body,
      fontWeight: fontWeights.regular,
      color: colors.text,
      marginBottom: 6,
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
    passwordStrengthContainer: {
      marginTop: 8,
      marginBottom: 8,
    },
    passwordStrengthBar: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
      flexDirection: 'row',
      gap: 4,
    },
    passwordStrengthSegment: {
      flex: 1,
      backgroundColor: colors.border,
      borderRadius: 2,
    },
    passwordStrengthSegmentActive: {
      backgroundColor: '#10b981',
    },
    passwordStrengthLabel: {
      marginTop: 4,
      fontSize: typography.caption,
      fontWeight: fontWeights.regular,
    },
    passwordRequirements: {
      marginTop: 8,
      gap: 4,
    },
    passwordRequirement: {
      fontSize: typography.caption,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    passwordRequirementMet: {
      color: '#10b981',
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
    registerButton: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
      marginBottom: 12,
    },
    registerButtonDisabled: {
      opacity: 0.6,
    },
    registerButtonText: {
      color: '#3b82f6',
      fontSize: typography.bodyLarge,
      fontWeight: fontWeights.semibold,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 16,
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
    socialButtons: {
      gap: 10,
      marginBottom: 16,
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
      gap: 12,
    },
    socialButtonText: {
      color: colors.text,
      fontSize: typography.bodyLarge,
      fontWeight: fontWeights.regular,
    },
    loginContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 24,
      paddingBottom: 32,
    },
    loginText: {
      color: colors.textSecondary,
      fontSize: typography.body,
    },
    loginLink: {
      color: '#3b82f6',
      fontSize: typography.body,
      fontWeight: fontWeights.regular,
      marginLeft: 4,
    },
    termsContainer: {
      marginTop: 16,
      marginBottom: 8,
    },
    termsText: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      textAlign: 'center',
      lineHeight: 18,
    },
    termsLink: {
      color: '#3b82f6',
      fontWeight: '400',
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>

          <View style={styles.logo}>
            <LogoIcon size={40} />
          </View>
          <Text style={styles.title}>{t('signup.title')}</Text>
          <Text style={styles.subtitle}>{t('signup.subtitle')}</Text>
        </View>

        <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('signup.nameLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('signup.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('signup.emailLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('signup.emailPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('signup.passwordLabel')}</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder={t('signup.passwordPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.showPasswordText}>
                {showPassword ? t('signup.hidePassword') : t('signup.showPassword')}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Indicador de força da senha */}
          {password.length > 0 && (
            <View style={styles.passwordStrengthContainer}>
              <View style={styles.passwordStrengthBar}>
                {[1, 2, 3, 4].map((segment) => (
                  <View
                    key={segment}
                    style={[
                      styles.passwordStrengthSegment,
                      segment <= passwordStrength.strength && {
                        backgroundColor: passwordStrength.color
                      }
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.passwordStrengthLabel, { color: passwordStrength.color }]}>
                {t('signup.passwordStrength') || 'Força'}: {passwordStrength.label}
              </Text>
            </View>
          )}
          
          {/* Requisitos da senha */}
          {password.length > 0 && (
            <View style={styles.passwordRequirements}>
              <Text style={[
                styles.passwordRequirement,
                password.length >= 8 && styles.passwordRequirementMet
              ]}>
                {password.length >= 8 ? '✓' : '○'} Mínimo 8 caracteres
              </Text>
              <Text style={[
                styles.passwordRequirement,
                /[A-Z]/.test(password) && styles.passwordRequirementMet
              ]}>
                {/[A-Z]/.test(password) ? '✓' : '○'} Letra maiúscula
              </Text>
              <Text style={[
                styles.passwordRequirement,
                /[a-z]/.test(password) && styles.passwordRequirementMet
              ]}>
                {/[a-z]/.test(password) ? '✓' : '○'} Letra minúscula
              </Text>
              <Text style={[
                styles.passwordRequirement,
                /[0-9]/.test(password) && styles.passwordRequirementMet
              ]}>
                {/[0-9]/.test(password) ? '✓' : '○'} Número
              </Text>
            </View>
          )}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('signup.confirmPasswordLabel')}</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder={t('signup.confirmPasswordPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Text style={styles.showPasswordText}>
                {showConfirmPassword ? t('signup.hidePassword') : t('signup.showPassword')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            {t('signup.termsText')}{'\n'}
            <Text style={styles.termsLink}>{t('signup.termsOfService')}</Text> {t('signup.and')}{' '}
            <Text style={styles.termsLink}>{t('signup.privacyPolicy')}</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.registerButton,
            { backgroundColor: colors.surface, borderColor: '#3b82f6' },
            isLoading && styles.registerButtonDisabled,
          ]}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <AnimatedLogoIcon size={24} />
          ) : (
            <Text style={styles.registerButtonText}>{t('signup.createButton')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('signup.orSignUpWith')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleRegister}
            disabled={isLoading}
          >
            <GoogleIcon />
            <Text style={styles.socialButtonText}>{t('signup.google')}</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: isDark ? '#ffffff' : '#000000' }]}
              onPress={handleAppleRegister}
              disabled={isLoading}
            >
              <AppleIcon color={isDark ? '#000000' : '#ffffff'} />
              <Text style={[styles.socialButtonText, { color: isDark ? '#000000' : '#ffffff' }]}>
                {t('signup.apple')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>{t('signup.alreadyHaveAccount')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>{t('signup.signIn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modal de Erro */}
      <ErrorModal
        visible={errorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        title={errorTitle}
        message={errorMessage}
        type={errorType}
        buttonText={t('common.ok') || 'Entendi'}
      />
    </KeyboardAvoidingView>
  )
}
