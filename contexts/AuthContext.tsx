import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import * as LocalAuthentication from 'expo-local-authentication'
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import { Platform } from 'react-native'
import { secureStorage } from '@/lib/secure-storage'
import { config } from '@/lib/config'

interface User {
  id: string
  email: string
  name: string
  avatar?: string
  authProvider?: 'google' | 'apple' | 'email'
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isLoadingData: boolean
  isAuthenticated: boolean
  biometricAvailable: boolean
  biometricType: string | null
  
  // Auth methods
  login: (email: string, password: string) => Promise<void>
  loginWithBiometric: (isAutoAuth?: boolean) => Promise<void>
  loginWithGoogle: () => Promise<void>
  loginWithApple: () => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  registerWithGoogle: () => Promise<void>
  registerWithApple: () => Promise<void>
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
  
  // Loading control
  setLoadingDataComplete: () => void
  
  // Biometric settings
  enableBiometric: () => Promise<boolean>
  disableBiometric: () => Promise<void>
  isBiometricEnabled: boolean
  isAutoLoginEnabled: boolean
  setAutoLoginEnabled: (enabled: boolean) => Promise<void>
  
  // Auto-auth control
  hasTriedAutoAuth: boolean
  autoAuthCancelled: boolean
  markAutoAuthTried: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricType, setBiometricType] = useState<string | null>(null)
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false)
  const [isAutoLoginEnabled, setIsAutoLoginEnabledState] = useState(false) // 🆕 Auto-login DESABILITADO por padrão para evitar loops
  const [hasValidToken, setHasValidToken] = useState(false)
  const [hasTriedAutoAuth, setHasTriedAutoAuth] = useState(false) // 🆕 Controle global de auto-auth
  const [autoAuthCancelled, setAutoAuthCancelled] = useState(false) // 🆕 Indica se usuário cancelou

  // Check biometric availability on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        await checkBiometricAvailability()
        await checkBiometricEnabled()
        
        // 🔄 Verifica se existe sessão salva e biometria habilitada
        const hasBiometric = await secureStorage.getItemAsync('biometric_enabled')
        const hasUserData = await secureStorage.getItemAsync('user_data')
        
        console.log('🔍 Verificando sessão salva...')
        console.log('  - Biometria habilitada:', hasBiometric === 'true')
        console.log('  - Dados de usuário:', hasUserData ? 'SIM' : 'NÃO')
        
        // ⚠️ Limpa apenas os tokens de sessão (não os dados do usuário)
        // Mantém: user_data, user_id, user_email, user_name, biometric_enabled
        // Remove: access_token, refresh_token (serão renovados no próximo login)
        console.log('🧹 Limpando apenas tokens de sessão...')
        await secureStorage.deleteItemAsync('access_token')
        await secureStorage.deleteItemAsync('refresh_token')
        
        console.log('✅ Tokens de sessão limpos - usuário pode usar biometria para relogar')
        
        // Não carrega usuário automaticamente - sempre mostra tela de login
        // Mas mantém os dados salvos para que o FaceID funcione
        setUser(null)
      } catch (error) {
        console.error('❌ Erro ao inicializar autenticação:', error)
      } finally {
        // Sempre marca como não loading após inicialização
        console.log('✅ Inicialização completa')
        setIsLoading(false)
      }
    }
    
    initAuth()
  }, [])

  // 📝 NOTA: Snapshots diários agora são gerenciados pelo backend (Rust scheduler)
  // O backend cria snapshots automaticamente às 00:00 UTC todos os dias
  // Não é mais necessário scheduler no frontend

  // Listen for OAuth callback events
  useEffect(() => {
    const handleOAuthCallback = async (event: any) => {
      const { access_token, refresh_token, user_id, email, name } = event.detail
      
      console.log('📨 Recebido evento oauth-callback')
      
      if (access_token && user_id) {
        try {
          // ✅ VALIDA O TOKEN NO BACKEND ANTES DE SALVAR
          console.log('🔍 Validando token OAuth no handler do evento...')
          
          const response = await fetch(`${config.kongBaseUrl}/auth/verify`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (!response.ok) {
            console.error(`❌ Token validation failed: ${response.status}`)
            throw new Error(`Token validation failed: ${response.status}`)
          }
          
          const validationData = await response.json()
          
          if (!validationData.valid || validationData.user_id !== user_id) {
            console.error('❌ Token inválido ou user_id não corresponde')
            throw new Error('Token inválido ou não pertence ao usuário')
          }
          
          console.log('✅ Token validado com sucesso no handler')
          
          // Salvar tokens
          await secureStorage.setItemAsync('access_token', access_token)
          if (refresh_token) {
            await secureStorage.setItemAsync('refresh_token', refresh_token)
          }
          
          // Criar objeto user
          const userData = {
            id: user_id,
            email: email,
            name: name || email,
            authProvider: 'google' as const
          }
          
          // Salvar user
          await secureStorage.setItemAsync('user_data', JSON.stringify(userData))
          await secureStorage.setItemAsync('user_id', user_id)
          
          console.log('✅ Setando usuário autenticado no estado (via evento)...')
          // Atualizar estado
          setUser(userData)
        } catch (error) {
          console.error('❌ Error processing OAuth callback:', error)
          // Limpa qualquer dado que possa ter sido salvo parcialmente
          await secureStorage.deleteItemAsync('access_token')
          await secureStorage.deleteItemAsync('refresh_token')
          await secureStorage.deleteItemAsync('user_data')
          await secureStorage.deleteItemAsync('user_id')
          
          // NÃO seta o user em caso de erro
          setUser(null)
        }
      }
    }
    
    if (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      navigator.product !== 'ReactNative' &&
      typeof window.addEventListener === 'function'
    ) {
      window.addEventListener('oauth-callback', handleOAuthCallback)
      return () => {
        window.removeEventListener('oauth-callback', handleOAuthCallback)
      }
    }
  }, [])

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync()
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      
      if (compatible && enrolled) {
        setBiometricAvailable(true)
        
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID')
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Touch ID')
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType('Iris')
        }
      }
    } catch (error) {
      console.error('Error checking biometric:', error)
    }
  }

  const checkBiometricEnabled = async () => {
    try {
      const enabled = await secureStorage.getItemAsync('biometric_enabled')
      setIsBiometricEnabled(enabled === 'true')
      
      // Carrega também a configuração de auto-login (padrão: DESABILITADO para evitar loops)
      const autoLogin = await secureStorage.getItemAsync('auto_login_enabled')
      setIsAutoLoginEnabledState(autoLogin === 'true') // Padrão é false se não existir
    } catch (error) {
      console.error('Error checking biometric enabled:', error)
    }
  }

  // Função desabilitada - sistema sempre inicia no login
  // Pode ser reativada no futuro para implementar "lembrar-me"
  const loadUser = async () => {
    try {
      setIsLoading(true)
      
      const [userData, accessToken] = await Promise.all([
        secureStorage.getItemAsync('user_data'),
        secureStorage.getItemAsync('access_token')
      ])
      
      if (userData && accessToken) {
        // ✅ SEMPRE VALIDA O TOKEN ANTES DE CARREGAR O USUÁRIO
        console.log('🔍 Validando token salvo antes de carregar usuário...')
        
        try {
          const response = await fetch(`${config.kongBaseUrl}/auth/verify`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (!response.ok) {
            console.error(`❌ Token salvo inválido: ${response.status}`)
            throw new Error('Token expired or invalid')
          }
          
          const validationData = await response.json()
          const parsedUser = JSON.parse(userData)
          
          if (!validationData.valid || validationData.user_id !== parsedUser.id) {
            console.error('❌ Token não pertence ao usuário salvo')
            throw new Error('Token does not match user')
          }
          
          console.log('✅ Token salvo é válido, carregando usuário')
          setUser(parsedUser)
        } catch (validationError) {
          console.error('❌ Erro ao validar token salvo:', validationError)
          // Limpa dados inválidos
          await secureStorage.deleteItemAsync('access_token')
          await secureStorage.deleteItemAsync('refresh_token')
          await secureStorage.deleteItemAsync('user_data')
          await secureStorage.deleteItemAsync('user_id')
          setUser(null)
        }
      }
    } catch (error) {
      console.error('Error loading user:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const saveUser = async (userData: User) => {
    try {
      await secureStorage.setItemAsync('user_data', JSON.stringify(userData))
      setUser(userData)
    } catch (error) {
      console.error('Error saving user:', error)
      throw error
    }
  }

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true)
      setIsLoadingData(true)
      
      // Chama API real de login
      const response = await fetch(`${config.kongBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Login failed')
      }
      
      const data = await response.json()
      
      // Salva tokens
      await secureStorage.setItemAsync('access_token', data.token)
      if (data.refresh_token) {
        await secureStorage.setItemAsync('refresh_token', data.refresh_token)
      }
      
      // Salva dados do usuário
      await secureStorage.setItemAsync('user_id', data.user.id)
      
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || email.split('@')[0],
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.name || email)}&background=random`,
        authProvider: 'email'
      }
      
      await saveUser(user)
      
      // ✅ Removido delay desnecessário - React atualiza estado imediatamente
      console.log('✅ Setando usuário autenticado no estado...')
      setHasValidToken(true)
      setUser(user)
      
      console.log('✅ Login completo!')
    } catch (error) {
      console.error('Login error:', error)
      setHasValidToken(false)
      setIsLoadingData(false)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const loginWithBiometric = async (isAutoAuth = false) => {
    try {
      setIsLoading(true)
      
      if (!biometricAvailable || !isBiometricEnabled) {
        throw new Error('Biometric authentication not available or not enabled')
      }

      // ⚠️ NÃO define isLoadingData antes da autenticação
      // Deixa o usuário ver a tela de login normalmente
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: isAutoAuth ? 'Login automático' : 'Faça login com biometria',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      })

      if (result.success) {
        // 🔐 FaceID autenticou com sucesso!
        console.log('✅ Biometria autenticada com sucesso')
        
        // AGORA sim, define isLoadingData (usuário autenticou)
        setIsLoadingData(true)
        
        // Busca dados do usuário salvos
        const userData = await secureStorage.getItemAsync('user_data')
        const userId = await secureStorage.getItemAsync('user_id')
        const userEmail = await secureStorage.getItemAsync('user_email')
        
        if (!userData || !userId || !userEmail) {
          console.error('❌ Dados do usuário não encontrados')
          throw new Error('User data not found. Please login again.')
        }
        
        const parsedUser = JSON.parse(userData)
        console.log('📧 Fazendo login para:', userEmail)
        
        // 🔄 Busca novos tokens do backend
        // Se for usuário Google/Apple, usa refresh token ou reautentica
        // Se for email/senha, precisa fazer login normal
        
        if (parsedUser.authProvider === 'google' || parsedUser.authProvider === 'apple') {
          // Tenta usar refresh token se existir
          const refreshToken = await secureStorage.getItemAsync('refresh_token')
          
          if (refreshToken) {
            console.log('🔄 Renovando token com refresh token...')
            const response = await fetch(`${config.kongBaseUrl}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refreshToken })
            })
            
            if (response.ok) {
              const data = await response.json()
              await secureStorage.setItemAsync('access_token', data.access_token)
              if (data.refresh_token) {
                await secureStorage.setItemAsync('refresh_token', data.refresh_token)
              }
              
              console.log('✅ Token renovado com sucesso')
              setUser(parsedUser)
              return
            }
          }
          
          // Se refresh falhou, reautentica com OAuth
          console.log('⚠️ Refresh token inválido, redirecionando para OAuth...')
          if (parsedUser.authProvider === 'google') {
            await loginWithGoogle()
          } else {
            await loginWithApple()
          }
        } else {
          // Para email/senha, não podemos fazer login automático (não temos a senha)
          console.error('❌ Login com biometria não suportado para email/senha sem refresh token')
          setIsLoadingData(false)
          throw new Error('Para usar biometria, faça login com Google ou Apple')
        }
        
        // O loading será desativado pelo App.tsx quando os dados estiverem prontos
      } else {
        // ❌ Usuário cancelou ou falhou a autenticação
        console.log('👤 Usuário cancelou a autenticação biométrica')
        setIsLoadingData(false)
        
        // ✅ Marca que usuário cancelou (evita tentativas futuras automáticas)
        if (isAutoAuth) {
          setAutoAuthCancelled(true)
          console.log('🚫 Auto-auth cancelado pelo usuário - não tentará novamente nesta sessão')
        }
        
        // Cria erro específico para cancelamento
        const cancelError = new Error('User canceled biometric authentication')
        cancelError.name = 'BiometricCancelError'
        throw cancelError
      }
    } catch (error: any) {
      console.error('Biometric login error:', error)
      setIsLoadingData(false)
      
      // ✅ Marca cancelamento se foi auto-auth
      if (isAutoAuth && (
        error.name === 'BiometricCancelError' ||
        error?.message?.toLowerCase().includes('cancel')
      )) {
        setAutoAuthCancelled(true)
        console.log('🚫 Auto-auth cancelado pelo usuário - não tentará novamente nesta sessão')
      }
      
      // Se já é um erro de cancelamento, apenas repropaga
      if (error.name === 'BiometricCancelError') {
        throw error
      }
      
      // Para outros erros, cria um erro genérico
      const wrappedError = new Error(error.message || 'Biometric authentication failed')
      wrappedError.name = 'BiometricError'
      throw wrappedError
    } finally {
      setIsLoading(false)
    }
  }

  const loginWithGoogle = async () => {
    try {
      setIsLoading(true)
      
      // 1. Solicita URL de autenticação do Google via Trading Service (Rust)
      const response = await fetch(`${config.kongBaseUrl}/auth/google`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Auth URL request failed:', response.status, errorText)
        throw new Error(`Trading Service returned ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (!data.auth_url) {
        throw new Error('Failed to get Google auth URL')
      }
      
      // 2. Detecta se está rodando em web ou mobile
      const isWeb = Platform.OS === 'web'
      
      if (isWeb) {
        // Para web, usa popup com postMessage (transparente)
        await new Promise<void>((resolve, reject) => {
          let storageCheckTimer: ReturnType<typeof setInterval> | undefined
          
          // Listener para mensagem do popup
          const messageHandler = async (event: MessageEvent) => {
            if (event.data?.type === 'OAUTH_SUCCESS') {
              window.removeEventListener('message', messageHandler)
              
              // Limpa o fallback de localStorage
              if (storageCheckTimer) {
                clearInterval(storageCheckTimer)
              }
              
              const { access_token, refresh_token, user_id, email, name } = event.data
              
              if (!access_token || !user_id || !email) {
                console.error('Invalid OAuth response - missing required fields')
                reject(new Error('Invalid OAuth response'))
                return
              }
              
              try {
                const verifyResponse = await fetch(`${config.kongBaseUrl}/auth/verify`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Content-Type': 'application/json'
                  }
                })
                
                if (!verifyResponse.ok) {
                  console.error(`❌ Token validation failed: ${verifyResponse.status}`)
                  throw new Error(`Token validation failed: ${verifyResponse.status}`)
                }
                
                const validationData = await verifyResponse.json()
                
                if (refresh_token) {
                  await secureStorage.setItemAsync('refresh_token', refresh_token)
                }
                
                // Salva dados do usuário
                await secureStorage.setItemAsync('user_id', user_id)
                await secureStorage.setItemAsync('user_email', email)
                if (name) await secureStorage.setItemAsync('user_name', name)
                
                const user: User = {
                  id: user_id,
                  email: email,
                  name: name || email.split('@')[0],
                  avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email)}&background=random`,
                  authProvider: 'google'
                }
                
                await saveUser(user)
                
                // IMPORTANTE: Define isLoadingData ANTES de setUser para evitar flash da tela de login
                setIsLoadingData(true)
                
                // ✅ Removido delay - React atualiza estado imediatamente
                setHasValidToken(true)
                setUser(user)
                resolve()
              } catch (saveError) {
                console.error('❌ Error validating or saving user data:', saveError)
                // Limpa dados parciais em caso de erro
                await secureStorage.deleteItemAsync('access_token')
                await secureStorage.deleteItemAsync('refresh_token')
                await secureStorage.deleteItemAsync('user_id')
                await secureStorage.deleteItemAsync('user_email')
                await secureStorage.deleteItemAsync('user_name')
                reject(saveError)
              }
            }
          }
          
          if (
            typeof window !== 'undefined' &&
            typeof navigator !== 'undefined' &&
            navigator.product !== 'ReactNative' &&
            typeof window.addEventListener === 'function'
          ) {
            window.addEventListener('message', messageHandler)
          }
          
          // Configuração otimizada do popup
          const width = 480
          const height = 620
          const left = Math.floor(window.screen.width / 2 - width / 2)
          const top = Math.floor(window.screen.height / 2 - height / 2)
          
          const popup = window.open(
            data.auth_url,
            'Google OAuth',
            `width=${width},height=${height},left=${left},top=${top},toolbar=0,location=0,menubar=0,resizable=1,scrollbars=1`
          )
          
          if (!popup) {
            console.error('Failed to open popup - blocked by browser')
            window.removeEventListener('message', messageHandler)
            reject(new Error('Failed to open OAuth popup - please allow popups'))
            return
          }
          
          // ESTRATÉGIA: Usa localStorage polling pois window.opener é bloqueado por COOP
          let pollCount = 0
          
          // Timeout de 2 minutos (declarado primeiro para usar no pollInterval)
          const timeoutId = setTimeout(() => {
            if (pollInterval) clearInterval(pollInterval)
            window.removeEventListener('message', messageHandler)
            if (popup && !popup.closed) {
              popup.close()
            }
            reject(new Error('OAuth timeout - no response received after 2 minutes'))
          }, 2 * 60 * 1000)
          
          // Poll a cada 200ms (mais rápido para melhor UX)
          const pollInterval = setInterval(() => {
            pollCount++
            
            // Verifica se popup foi fechado manualmente (COOP-safe check)
            try {
              if (popup.closed) {
                clearInterval(pollInterval)
                clearTimeout(timeoutId)
                window.removeEventListener('message', messageHandler)
                reject(new Error('OAuth cancelled - popup was closed'))
                return
              }
            } catch (e) {
              // COOP pode bloquear acesso ao popup.closed, ignora o erro
            }
            
            const oauthResult = localStorage.getItem('oauth_result')
            
            if (oauthResult) {
              localStorage.removeItem('oauth_result')
              
              clearInterval(pollInterval)
              clearTimeout(timeoutId)
              window.removeEventListener('message', messageHandler)
              
              try {
                const oauthData = JSON.parse(oauthResult)
                // Processa como se fosse postMessage com o formato correto
                messageHandler({ data: oauthData } as MessageEvent)
              } catch (err) {
                console.error('❌ Failed to parse OAuth result:', err)
                reject(new Error('Failed to parse OAuth result'))
              }
            }
          }, 300)
        })
      } else {
        // 📱 MOBILE: Usa AuthSession.makeRedirectUri() para gerar URI correto
        // Funciona automaticamente com Expo Go, Dev Client e Standalone
        const redirectUri = AuthSession.makeRedirectUri({
          scheme: 'cryptohub', // Deve bater com app.json
          path: 'auth/callback',
        })

        // Log para depuração: mostrar a URL de autenticação recebida do backend
        console.log('[Google OAuth] auth_url recebido:', data.auth_url)
        console.log('[Google OAuth] redirectUri gerado:', redirectUri)
        console.log('[Google OAuth] Platform:', Platform.OS)

        const result = await WebBrowser.openAuthSessionAsync(
          data.auth_url,
          redirectUri
        )
        
        if (result.type === 'success' && 'url' in result && result.url) {
          const url = new URL(result.url)
          const accessToken = url.searchParams.get('access_token')
          const refreshToken = url.searchParams.get('refresh_token')
          const userId = url.searchParams.get('user_id')
          const email = url.searchParams.get('email')
          const name = url.searchParams.get('name')
          
          if (!accessToken || !userId || !email) {
            throw new Error('Invalid OAuth response from Kong')
          }
          
          await secureStorage.setItemAsync('access_token', accessToken)
          if (refreshToken) {
            await secureStorage.setItemAsync('refresh_token', refreshToken)
          }
          await secureStorage.setItemAsync('user_id', userId)
          await secureStorage.setItemAsync('user_email', email)
          if (name) await secureStorage.setItemAsync('user_name', name)
          
          const user: User = {
            id: userId,
            email: email,
            name: name || email.split('@')[0],
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email)}&background=random`,
            authProvider: 'google'
          }
          
          await saveUser(user)
          setUser(user)
          setIsLoadingData(true)
        } else {
          throw new Error('OAuth cancelled or failed')
        }
      }
    } catch (error) {
      console.error('Google login error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const loginWithApple = async () => {
    try {
      if (Platform.OS !== 'ios') {
        throw new Error('Apple Sign-In is only available on iOS')
      }
      
      setIsLoading(true)
      
      // TODO: Implementar OAuth com Apple
      // Por enquanto, usa o userId fixo do config para desenvolvimento
      const mockUser: User = {
        id: 'charles_test_user', // ID fixo para desenvolvimento
        email: 'user@icloud.com',
        name: 'Apple User',
        authProvider: 'apple'
      }
      
      await saveUser(mockUser)
      
      // Ativa o loading de dados após login bem-sucedido
      setIsLoadingData(true)
      
      // ✅ Removido delay - React atualiza estado imediatamente
      // O loading será desativado pelo App.tsx quando os dados estiverem prontos
    } catch (error) {
      console.error('Apple login error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true)
      setIsLoadingData(true)

      // Chama API real de registro
      const registerPayload = {
        email,
        password,
        name
      }
      const registerUrl = `${config.kongBaseUrl}/auth/register`
      console.log('[REGISTER] Enviando request:', registerUrl, registerPayload)
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registerPayload)
      })

      console.log('[REGISTER] Status:', response.status)
      let responseText = await response.text()
      console.log('[REGISTER] Response:', responseText)
      let data: any = null
      try {
        data = JSON.parse(responseText)
        console.log('[REGISTER] Parsed data:', data)
      } catch (e) {
        console.log('[REGISTER] Response is not JSON:', responseText)
      }

      if (!response.ok) {
        const errorMessage = (data && data.error) || responseText || 'Registration failed'
        console.error('[REGISTER] ❌ Erro do servidor:', errorMessage)
        console.error('[REGISTER] ❌ Status HTTP:', response.status)
        console.error('[REGISTER] ❌ Data completo:', data)
        throw new Error(errorMessage)
      }

      // Salva tokens
      await secureStorage.setItemAsync('access_token', data.token)
      if (data.refresh_token) {
        await secureStorage.setItemAsync('refresh_token', data.refresh_token)
      }

      // Salva dados do usuário
      await secureStorage.setItemAsync('user_id', data.user.id)

      const user: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || email.split('@')[0],
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.name || email)}&background=random`,
        authProvider: 'email'
      }

      console.log('[REGISTER] Antes de saveUser:', user)
      await saveUser(user)
      console.log('[REGISTER] Depois de saveUser')

      // ✅ Removido delay - React atualiza estado imediatamente
      console.log('[REGISTER] Antes de setUser')
      setHasValidToken(true)
      setUser(user)
      console.log('[REGISTER] Depois de setUser')

      console.log('✅ Registro completo!')
    } catch (error) {
      console.error('Register error:', error)
      setHasValidToken(false)
      setIsLoadingData(false)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const registerWithGoogle = async () => {
    // Mesma implementação do login com Google
    return loginWithGoogle()
  }

  const registerWithApple = async () => {
    // Mesma implementação do login com Apple
    return loginWithApple()
  }

  const logout = async () => {
    try {
      console.log('🚪 Iniciando logout...')
      
      // Lista de todas as chaves relacionadas à autenticação
      const authKeys = [
        'user_data',
        'access_token',
        'refresh_token',
        'user_id',
        'user_email',
        'user_name',
        'biometric_enabled'
      ]
      
      // Limpa TODOS os dados do storage
      console.log('🧹 Limpando dados do storage...')
      for (const key of authKeys) {
        await secureStorage.deleteItemAsync(key)
      }
      
      // Limpa localStorage completamente para web (força limpeza de cache)
      if (Platform.OS === 'web') {
        console.log('🌐 Limpando localStorage da web...')
        try {
          // Remove apenas as chaves de auth do localStorage
          authKeys.forEach(key => {
            localStorage.removeItem(key)
          })
          // Remove oauth_result se existir
          localStorage.removeItem('oauth_result')
          console.log('✅ localStorage limpo')
        } catch (error) {
          console.error('❌ Erro ao limpar localStorage:', error)
        }
      }
      
      // Reseta TODOS os estados
      setUser(null)
      setHasValidToken(false)
      setIsBiometricEnabled(false)
      setIsLoadingData(false)
      setIsLoading(false)
      
      // Reset auto-auth flags
      setHasTriedAutoAuth(false)
      setAutoAuthCancelled(false)
      
      console.log('✅ Logout completo - todos os dados limpos')
    } catch (error) {
      console.error('❌ Logout error:', error)
      throw error
    }
  }

  const deleteAccount = async () => {
    try {
      console.log('🗑️ Iniciando exclusão de conta...')
      
      // 1. Chamar API para deletar conta do MongoDB
      console.log('📡 Deletando dados do usuário no MongoDB...')
      const response = await fetch(`${config.kongBaseUrl}/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await secureStorage.getItemAsync('access_token')}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Falha ao deletar conta')
      }
      
      console.log('✅ Conta deletada do MongoDB')
      
      // 2. Limpar banco local (WatermelonDB/IndexedDB)
      if (Platform.OS === 'web') {
        console.log('🗑️ Deletando banco local (IndexedDB)...')
        
        if (typeof window !== 'undefined' && window.indexedDB) {
          try {
            const databases = await window.indexedDB.databases()
            console.log('📦 Bancos encontrados:', databases.map(db => db.name))
            
            for (const db of databases) {
              if (db.name && (db.name.includes('cryptohub') || db.name.includes('watermelon') || db.name.includes('loki'))) {
                console.log(`🗑️ Deletando banco: ${db.name}`)
                window.indexedDB.deleteDatabase(db.name)
              }
            }
            
            console.log('✅ Bancos locais deletados')
          } catch (idbError) {
            console.error('⚠️ Erro ao deletar IndexedDB:', idbError)
          }
        }
        
        // Limpar localStorage e sessionStorage
        console.log('🗑️ Limpando localStorage e sessionStorage...')
        if (window.localStorage) {
          localStorage.clear()
        }
        if (window.sessionStorage) {
          sessionStorage.clear()
        }
        console.log('✅ Storage limpo')
      }
      
      // 3. Fazer logout (limpa autenticação)
      console.log('🚪 Fazendo logout...')
      await logout()
      
      console.log('✅ Conta excluída com sucesso!')
    } catch (error) {
      console.error('❌ Erro ao deletar conta:', error)
      throw error
    }
  }

  const enableBiometric = async (): Promise<boolean> => {
    try {
      if (!biometricAvailable) {
        return false
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autentique para habilitar biometria',
        cancelLabel: 'Cancelar',
      })

      if (result.success) {
        await secureStorage.setItemAsync('biometric_enabled', 'true')
        setIsBiometricEnabled(true)
        return true
      }
      
      return false
    } catch (error) {
      console.error('Enable biometric error:', error)
      return false
    }
  }

  const disableBiometric = async () => {
    try {
      await secureStorage.deleteItemAsync('biometric_enabled')
      setIsBiometricEnabled(false)
    } catch (error) {
      console.error('Disable biometric error:', error)
    }
  }

  const setAutoLoginEnabled = async (enabled: boolean) => {
    try {
      await secureStorage.setItemAsync('auto_login_enabled', enabled ? 'true' : 'false')
      setIsAutoLoginEnabledState(enabled)
    } catch (error) {
      console.error('Error setting auto login:', error)
    }
  }

  const setLoadingDataComplete = () => {
    setIsLoadingData(false)
  }

  const markAutoAuthTried = () => {
    setHasTriedAutoAuth(true)
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isLoadingData,
    isAuthenticated: !!user,
    biometricAvailable,
    biometricType,
    isBiometricEnabled,
    isAutoLoginEnabled,
    hasTriedAutoAuth,
    autoAuthCancelled,
    
    login,
    loginWithBiometric,
    loginWithGoogle,
    loginWithApple,
    register,
    registerWithGoogle,
    registerWithApple,
    logout,
    deleteAccount,
    
    setLoadingDataComplete,
    markAutoAuthTried,
    
    enableBiometric,
    disableBiometric,
    setAutoLoginEnabled,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
