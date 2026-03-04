/**
 * 🚀 Balance Local Cache - Stale-While-Revalidate
 * 
 * Persiste o último BalanceResponse no SecureStore para que
 * na próxima abertura do app os dados apareçam instantaneamente.
 * 
 * Fluxo:
 *   1. App abre → lê cache local → mostra dados antigos imediatamente
 *   2. Em background → chama /balances/cached (MongoDB, ~100ms)
 *   3. Se cache do backend for mais recente, atualiza
 *   4. Em background → chama /balances/secure (CCXT real-time, ~5-25s)
 *   5. Quando chega, atualiza dados + salva no cache local
 */

import { secureStorage } from './secure-storage'
import { BalanceResponse } from '@/types/api'

const CACHE_KEY = 'balance_cache_data'
const CACHE_TIMESTAMP_KEY = 'balance_cache_timestamp'

export interface CachedBalance {
  data: BalanceResponse
  cachedAt: number // Unix timestamp (ms)
  source: 'local' | 'backend_cache' | 'live'
}

/**
 * Salva o BalanceResponse no cache local (SecureStore)
 */
export async function saveBalanceToLocalCache(data: BalanceResponse): Promise<void> {
  try {
    const now = Date.now()
    await Promise.all([
      secureStorage.setItemAsync(CACHE_KEY, JSON.stringify(data)),
      secureStorage.setItemAsync(CACHE_TIMESTAMP_KEY, String(now)),
    ])
    console.log('💾 [BalanceCache] Dados salvos no cache local')
  } catch (error) {
    console.warn('⚠️ [BalanceCache] Erro ao salvar cache local:', error)
  }
}

/**
 * Lê o BalanceResponse do cache local (SecureStore)
 * Retorna null se não houver cache
 */
export async function loadBalanceFromLocalCache(): Promise<CachedBalance | null> {
  try {
    const [rawData, rawTimestamp] = await Promise.all([
      secureStorage.getItemAsync(CACHE_KEY),
      secureStorage.getItemAsync(CACHE_TIMESTAMP_KEY),
    ])

    if (!rawData) {
      console.log('📭 [BalanceCache] Sem cache local')
      return null
    }

    const data: BalanceResponse = JSON.parse(rawData)
    const cachedAt = rawTimestamp ? parseInt(rawTimestamp, 10) : 0
    const ageSeconds = Math.floor((Date.now() - cachedAt) / 1000)

    console.log(`✅ [BalanceCache] Cache local encontrado (idade: ${ageSeconds}s)`)

    return {
      data,
      cachedAt,
      source: 'local',
    }
  } catch (error) {
    console.warn('⚠️ [BalanceCache] Erro ao ler cache local:', error)
    return null
  }
}

/**
 * Limpa o cache local (chamado no logout)
 */
export async function clearBalanceLocalCache(): Promise<void> {
  try {
    await Promise.all([
      secureStorage.deleteItemAsync(CACHE_KEY),
      secureStorage.deleteItemAsync(CACHE_TIMESTAMP_KEY),
    ])
    console.log('🗑️ [BalanceCache] Cache local limpo')
  } catch (error) {
    console.warn('⚠️ [BalanceCache] Erro ao limpar cache:', error)
  }
}

/**
 * Retorna a idade do cache local em segundos, ou Infinity se não existir
 */
export async function getLocalCacheAge(): Promise<number> {
  try {
    const rawTimestamp = await secureStorage.getItemAsync(CACHE_TIMESTAMP_KEY)
    if (!rawTimestamp) return Infinity
    return Math.floor((Date.now() - parseInt(rawTimestamp, 10)) / 1000)
  } catch {
    return Infinity
  }
}
