/**
 * Configurações da aplicação
 */

import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { secureStorage } from './secure-storage'
import { translate, loadLanguage, saveLanguage, type Language } from './translations'

const getDevServerHost = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.hostUri ||
    (Constants as any).expoGoConfig?.hostUri

  if (!hostUri) return null
  return hostUri.split(':')[0]
}

const getDefaultHost = () => {
  if (Platform.OS === 'android') return '10.0.2.2'
  return 'localhost'
}

const resolvedHost =
  process.env.EXPO_PUBLIC_API_HOST ||
  getDevServerHost() ||
  getDefaultHost()

const resolvedApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'http://54.94.231.254:3002/api/v1'

export const config = {
  /**
   * Trading-Service Rust (ALL ENDPOINTS)
   * Port 3002 - Auth, Balances, Exchanges, Orders, Portfolio, PNL
   */
  apiBaseUrl: resolvedApiBaseUrl,
  
  /**
   * Auth via Rust trading-service
   */
  kongBaseUrl: resolvedApiBaseUrl,
  
  /**
   * Configurações de Tradução
   */
  translation: {
    defaultLanguage: 'en-US' as Language,
    supportedLanguages: ['pt-BR', 'en-US'] as Language[],
  }
}

/**
 * Exporta funções de tradução do módulo de translations
 */
export { translate, loadLanguage, saveLanguage, type Language }

/**
 * Obtém o ID do usuário logado do storage
 * @returns Promise com o user_id ou null se não estiver logado
 */
export async function getUserId(): Promise<string | null> {
  try {
    const userId = await secureStorage.getItemAsync('user_id')
    return userId
  } catch (error) {
    console.error('Error getting user_id:', error)
    return null
  }
}

/**
 * @deprecated Use getUserId() instead. This is kept for backward compatibility only.
 */
export const getUserIdSync = () => {
  return 'charles_test_user' // Fallback para desenvolvimento
}
