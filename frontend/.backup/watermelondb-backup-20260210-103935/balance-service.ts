/**
 * Balance Service - Integrado com WatermelonDB
 * 
 * Arquitetura Offline-First:
 * 1. Dados carregam instantaneamente do banco local
 * 2. Sync em background com API/CCXT
 * 3. UI atualiza automaticamente
 * 
 * Performance: ~0.1s (local) vs ~3-5s (API)
 */

import {
  getBalanceHistory,
  saveBalanceHistory,
  getBalanceSnapshots,
  saveBalanceSnapshot,
  getUserExchanges,
} from '../lib/watermelon/helpers'
import type { BalanceHistory, BalanceSnapshot } from '../lib/watermelon/models'
import { config } from '../lib/config'
import { decryptData } from '../lib/encryption'

const API_BASE_URL = config.apiBaseUrl

// ==================== TYPES ====================

export interface Balance {
  symbol: string
  free: number
  used: number
  total: number
  usdValue: number
  brlValue: number
  exchangeName: string
}

export interface BalanceSummary {
  totalUsd: number
  totalBrl: number
  exchanges: Array<{
    name: string
    totalUsd: number
    totalBrl: number
    isActive: boolean
  }>
  lastUpdate: Date
}

// ==================== LOCAL DATA ====================

/**
 * 🚀 ULTRA-FAST: Busca balanços do banco local (0.1s)
 * Retorna dados imediatamente sem esperar API
 */
export const getLocalBalances = async (
  userId: string,
  exchangeName?: string
): Promise<Balance[]> => {
  try {
    const balances = await getBalanceHistory(userId, exchangeName)
    
    return balances.map(b => ({
      symbol: b.symbol,
      free: b.free,
      used: b.used,
      total: b.total,
      usdValue: b.usdValue,
      brlValue: b.brlValue,
      exchangeName: b.exchangeName,
    }))
  } catch (error) {
    console.error('❌ [Balance] Error loading local balances:', error)
    return []
  }
}

/**
 * 🚀 ULTRA-FAST: Busca resumo dos balanços (0.1s)
 */
export const getLocalBalanceSummary = async (
  userId: string
): Promise<BalanceSummary> => {
  try {
    // Buscar último snapshot
    const snapshots = await getBalanceSnapshots(userId, 1)
    const latestSnapshot = snapshots[0]
    
    if (!latestSnapshot) {
      return {
        totalUsd: 0,
        totalBrl: 0,
        exchanges: [],
        lastUpdate: new Date(),
      }
    }
    
    // Buscar exchanges do usuário
    const userExchanges = await getUserExchanges(userId)
    
    // Buscar balanços de cada exchange
    const exchangeSummaries = await Promise.all(
      userExchanges.map(async (exchange) => {
        const balances = await getBalanceHistory(userId, exchange.exchangeName)
        const totalUsd = balances.reduce((sum, b) => sum + b.usdValue, 0)
        const totalBrl = balances.reduce((sum, b) => sum + b.brlValue, 0)
        
        return {
          name: exchange.exchangeName,
          totalUsd,
          totalBrl,
          isActive: exchange.isActive,
        }
      })
    )
    
    return {
      totalUsd: latestSnapshot.totalUsd,
      totalBrl: latestSnapshot.totalBrl,
      exchanges: exchangeSummaries,
      lastUpdate: new Date(latestSnapshot.timestamp),
    }
  } catch (error) {
    console.error('❌ [Balance] Error loading local summary:', error)
    return {
      totalUsd: 0,
      totalBrl: 0,
      exchanges: [],
      lastUpdate: new Date(),
    }
  }
}

/**
 * 📊 Busca histórico de snapshots (gráfico de evolução)
 */
export const getBalanceEvolution = async (
  userId: string,
  days: number = 30
): Promise<Array<{ date: Date; usd: number; brl: number }>> => {
  try {
    const snapshots = await getBalanceSnapshots(userId, days)
    
    return snapshots.map(s => ({
      date: new Date(s.timestamp),
      usd: s.totalUsd,
      brl: s.totalBrl,
    }))
  } catch (error) {
    console.error('❌ [Balance] Error loading evolution:', error)
    return []
  }
}

// ==================== API SYNC ====================

/**
 * 🔄 SYNC: Sincroniza balanços com API/CCXT
 * Chama backend, salva localmente, retorna dados atualizados
 */
export const syncBalancesFromAPI = async (userId: string): Promise<Balance[]> => {
  try {
    console.log('🔄 [Balance] Starting sync from API...')
    
    // 1. Buscar exchanges do usuário (localmente)
    const userExchanges = await getUserExchanges(userId)
    
    if (userExchanges.length === 0) {
      console.log('⚠️ [Balance] No exchanges configured')
      return []
    }
    
    // 2. Para cada exchange, consultar API
    const allBalances: Balance[] = []
    
    for (const exchange of userExchanges) {
      try {
        console.log(`🔄 [Balance] Syncing ${exchange.exchangeName}...`)
        
        // 🔓 Decrypt credentials before using
        const apiKey = await decryptData(exchange.apiKeyEncrypted, userId)
        const apiSecret = await decryptData(exchange.apiSecretEncrypted, userId)
        
        const response = await fetch(`${API_BASE_URL}/api/v1/balances`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            exchange_name: exchange.exchangeName,
            api_key: apiKey,
            api_secret: apiSecret,
          }),
        })
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }
        
        const balances = await response.json()
        
        // 3. Salvar localmente
        const timestamp = new Date()
        
        for (const balance of balances) {
          await saveBalanceHistory({
            userId,
            exchangeName: exchange.exchangeName,
            symbol: balance.symbol,
            free: balance.free || 0,
            used: balance.used || 0,
            total: balance.total || 0,
            usdValue: balance.usd_value || 0,
            brlValue: balance.brl_value || 0,
            timestamp,
          })
          
          allBalances.push({
            symbol: balance.symbol,
            free: balance.free || 0,
            used: balance.used || 0,
            total: balance.total || 0,
            usdValue: balance.usd_value || 0,
            brlValue: balance.brl_value || 0,
            exchangeName: exchange.exchangeName,
          })
        }
        
        console.log(`✅ [Balance] Synced ${balances.length} balances from ${exchange.exchangeName}`)
      } catch (error) {
        console.error(`❌ [Balance] Error syncing ${exchange.exchangeName}:`, error)
      }
    }
    
    // 4. Salvar snapshot do total
    const totalUsd = allBalances.reduce((sum, b) => sum + b.usdValue, 0)
    const totalBrl = allBalances.reduce((sum, b) => sum + b.brlValue, 0)
    
    await saveBalanceSnapshot({
      userId,
      totalUsd,
      totalBrl,
      timestamp: new Date(),
    })
    
    console.log(`✅ [Balance] Sync completed: ${allBalances.length} balances, $${totalUsd.toFixed(2)} USD`)
    
    return allBalances
  } catch (error) {
    console.error('❌ [Balance] Sync error:', error)
    throw error
  }
}

/**
 * 🎯 HYBRID: Busca local + sync em background
 * Retorna dados locais imediatamente, sync em background
 */
export const getBalancesWithSync = async (
  userId: string,
  options: {
    forceSync?: boolean // Força sync mesmo se tiver dados locais
    syncInBackground?: boolean // Sync sem bloquear
  } = {}
): Promise<Balance[]> => {
  const { forceSync = false, syncInBackground = true } = options
  
  try {
    // 1. Buscar dados locais (instantâneo)
    const localBalances = await getLocalBalances(userId)
    
    // 2. Se não tem dados locais OU forceSync, buscar da API
    if (localBalances.length === 0 || forceSync) {
      if (syncInBackground) {
        // Sync em background, retorna dados locais
        syncBalancesFromAPI(userId).catch(error => {
          console.error('❌ [Balance] Background sync failed:', error)
        })
        
        return localBalances
      } else {
        // Sync bloqueante
        return await syncBalancesFromAPI(userId)
      }
    }
    
    // 3. Tem dados locais, sync em background
    if (syncInBackground) {
      syncBalancesFromAPI(userId).catch(error => {
        console.error('❌ [Balance] Background sync failed:', error)
      })
    }
    
    return localBalances
  } catch (error) {
    console.error('❌ [Balance] Error:', error)
    throw error
  }
}

// ==================== EXPORTS ====================

export const BalanceService = {
  // Local (instantâneo)
  getLocal: getLocalBalances,
  getLocalSummary: getLocalBalanceSummary,
  getEvolution: getBalanceEvolution,
  
  // Sync com API
  syncFromAPI: syncBalancesFromAPI,
  
  // Híbrido (recomendado)
  getWithSync: getBalancesWithSync,
}

export default BalanceService
