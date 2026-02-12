/**
 * Balance Service - SQLite Version
 * 
 * Arquitetura Offline-First:
 * 1. Dados carregam instantaneamente do banco local
 * 2. Sync em background com API/CCXT
 * 3. UI atualiza automaticamente
 * 
 * Performance: ~0.1s (local) vs ~3-5s (API)
 */

import { table } from '../lib/sqlite/query-builder'
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

interface BalanceHistoryRow {
  id?: number
  user_id: string
  exchange_name: string
  symbol: string
  free: number
  used: number
  total: number
  usd_value: number
  brl_value: number
  timestamp: number
  created_at?: string
}

interface BalanceSnapshotRow {
  id?: number
  user_id: string
  total_usd: number
  total_brl: number
  timestamp: number
  created_at?: string
}

interface UserExchangeRow {
  id?: number
  user_id: string
  exchange_name: string
  api_key_encrypted: string
  api_secret_encrypted: string
  is_active: boolean
  created_at?: string
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
    let query = table<BalanceHistoryRow>('balance_history')
      .where('user_id', '=', userId)
      .orderBy('timestamp', 'DESC')

    if (exchangeName) {
      query = query.where('exchange_name', '=', exchangeName)
    }

    const balances = await query.get()
    
    return balances.map(b => ({
      symbol: b.symbol,
      free: b.free,
      used: b.used,
      total: b.total,
      usdValue: b.usd_value,
      brlValue: b.brl_value,
      exchangeName: b.exchange_name,
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
    const latestSnapshot = await table<BalanceSnapshotRow>('balance_snapshots')
      .where('user_id', '=', userId)
      .orderBy('timestamp', 'DESC')
      .first()
    
    if (!latestSnapshot) {
      return {
        totalUsd: 0,
        totalBrl: 0,
        exchanges: [],
        lastUpdate: new Date(),
      }
    }
    
    // Buscar exchanges do usuário
    const userExchanges = await table<UserExchangeRow>('user_exchanges')
      .where('user_id', '=', userId)
      .get()
    
    // Buscar balanços de cada exchange
    const exchangeSummaries = await Promise.all(
      userExchanges.map(async (exchange) => {
        const balances = await table<BalanceHistoryRow>('balance_history')
          .where('user_id', '=', userId)
          .where('exchange_name', '=', exchange.exchange_name)
          .get()

        const totalUsd = balances.reduce((sum, b) => sum + b.usd_value, 0)
        const totalBrl = balances.reduce((sum, b) => sum + b.brl_value, 0)
        
        return {
          name: exchange.exchange_name,
          totalUsd,
          totalBrl,
          isActive: exchange.is_active,
        }
      })
    )
    
    return {
      totalUsd: latestSnapshot.total_usd,
      totalBrl: latestSnapshot.total_brl,
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
    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000)
    
    const snapshots = await table<BalanceSnapshotRow>('balance_snapshots')
      .where('user_id', '=', userId)
      .where('timestamp', '>=', startDate)
      .orderBy('timestamp', 'ASC')
      .get()
    
    return snapshots.map(s => ({
      date: new Date(s.timestamp),
      usd: s.total_usd,
      brl: s.total_brl,
    }))
  } catch (error) {
    console.error('❌ [Balance] Error loading evolution:', error)
    return []
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Salva ou atualiza um balanço no histórico
 */
async function saveBalanceHistory(data: {
  userId: string
  exchangeName: string
  symbol: string
  free: number
  used: number
  total: number
  usdValue: number
  brlValue: number
  timestamp: Date
}): Promise<void> {
  try {
    // Verificar se já existe um registro recente (últimos 5 minutos)
    const fiveMinutesAgo = data.timestamp.getTime() - (5 * 60 * 1000)
    
    const existing = await table<BalanceHistoryRow>('balance_history')
      .where('user_id', '=', data.userId)
      .where('exchange_name', '=', data.exchangeName)
      .where('symbol', '=', data.symbol)
      .where('timestamp', '>=', fiveMinutesAgo)
      .first()

    if (existing?.id) {
      // Atualizar registro existente
      await table('balance_history')
        .where('id', '=', existing.id)
        .update({
          free: data.free,
          used: data.used,
          total: data.total,
          usd_value: data.usdValue,
          brl_value: data.brlValue,
          timestamp: data.timestamp.getTime(),
        })
    } else {
      // Criar novo registro
      await table('balance_history').insert({
        user_id: data.userId,
        exchange_name: data.exchangeName,
        symbol: data.symbol,
        free: data.free,
        used: data.used,
        total: data.total,
        usd_value: data.usdValue,
        brl_value: data.brlValue,
        timestamp: data.timestamp.getTime(),
      })
    }
  } catch (error) {
    console.error('❌ [Balance] Error saving balance history:', error)
    throw error
  }
}

/**
 * Salva um snapshot de balanço total
 */
async function saveBalanceSnapshot(data: {
  userId: string
  totalUsd: number
  totalBrl: number
  timestamp: Date
}): Promise<void> {
  try {
    await table('balance_snapshots').insert({
      user_id: data.userId,
      total_usd: data.totalUsd,
      total_brl: data.totalBrl,
      timestamp: data.timestamp.getTime(),
    })
  } catch (error) {
    console.error('❌ [Balance] Error saving snapshot:', error)
    throw error
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
    const userExchanges = await table<UserExchangeRow>('user_exchanges')
      .where('user_id', '=', userId)
      .where('is_active', '=', true)
      .get()
    
    if (userExchanges.length === 0) {
      console.log('⚠️ [Balance] No exchanges configured')
      return []
    }
    
    // 2. Para cada exchange, consultar API
    const allBalances: Balance[] = []
    
    for (const exchange of userExchanges) {
      try {
        console.log(`🔄 [Balance] Syncing ${exchange.exchange_name}...`)
        
        // 🔓 Decrypt credentials before using
        const apiKey = await decryptData(exchange.api_key_encrypted, userId)
        const apiSecret = await decryptData(exchange.api_secret_encrypted, userId)
        
        const response = await fetch(`${API_BASE_URL}/api/v1/balances`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            exchange_name: exchange.exchange_name,
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
            exchangeName: exchange.exchange_name,
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
            exchangeName: exchange.exchange_name,
          })
        }
        
        console.log(`✅ [Balance] Synced ${balances.length} balances from ${exchange.exchange_name}`)
      } catch (error) {
        console.error(`❌ [Balance] Error syncing ${exchange.exchange_name}:`, error)
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
