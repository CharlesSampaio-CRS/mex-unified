/**
 * Configurações da aplicação
 */

import { secureStorage } from './secure-storage'
import { translate, loadLanguage, saveLanguage, type Language } from './translations'

export const config = {
  /**
   * Trading-Service Rust (ALL ENDPOINTS)
   * Port 3002 - Auth, Balances, Exchanges, Orders, Portfolio, PNL
   */
  apiBaseUrl: 'http://localhost:3002/api/v1',
  
  /**
   * Auth via Rust trading-service
   */
  kongBaseUrl: 'http://localhost:3002/api/v1',
  
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
