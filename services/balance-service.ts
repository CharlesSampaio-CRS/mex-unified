/**
 * Balance Service - MongoDB APENAS (via API Backend)
 * 
 * ✅ TUDO vem do MongoDB via API Backend
 * ❌ SEM cache SQLite local
 * ❌ SEM fallback offline
 * 
 * Motivo:
 * - MongoDB é a única fonte da verdade
 * - Dados sempre sincronizados e corretos
 * - Se API falhar, app trata erro (não mostra dados desatualizados)
 */

import { apiService } from './api'

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

/**
 * Busca balanços do MongoDB via API
 */
export const getBalances = async (
  userId: string,
  exchangeName?: string
): Promise<Balance[]> => {
  try {
    console.log('🔍 [BalanceService] Buscando balances do MongoDB via API...')
    
    const response = await apiService.getBalances(userId, false)
    
    if (!response.success || !response.exchanges) {
      console.warn('⚠️ [BalanceService] Resposta vazia ou inválida')
      return []
    }

    console.log(`✅ [BalanceService] ${response.exchanges.length} exchanges com balances no MongoDB`)
    
    const allBalances: Balance[] = []
    
    for (const exchange of response.exchanges) {
      const exchangeNameValue = exchange.exchange || exchange.name || ''
      
      if (exchangeName && exchangeNameValue !== exchangeName) {
        continue
      }
      
      const balances = exchange.balances || {}
      
      for (const [symbol, b] of Object.entries(balances)) {
        const free = Number(b.free || 0)
        const used = Number(b.used || 0)
        const total = Number(b.total || 0)
        const usdValue = Number(b.usd_value || 0)
        
        allBalances.push({
          symbol: b.symbol || symbol,
          free,
          used,
          total,
          usdValue,
          brlValue: 0,
          exchangeName: exchangeNameValue,
        })
      }
    }

    return allBalances
  } catch (error) {
    console.error('❌ [BalanceService] Erro ao buscar balances:', error)
    return []
  }
}

/**
 * Busca resumo dos balanços do MongoDB via API
 */
export const getBalanceSummary = async (
  userId: string
): Promise<BalanceSummary> => {
  try {
    console.log('🔍 [BalanceService] Buscando summary do MongoDB via API...')
    
    const [balancesResponse, exchangesResponse] = await Promise.all([
      apiService.getBalances(userId, false),
      apiService.listExchanges()
    ])
    
    if (!balancesResponse.success || !exchangesResponse.success) {
      return {
        totalUsd: 0,
        totalBrl: 0,
        exchanges: [],
        lastUpdate: new Date(),
      }
    }

    const totalUsd = Number(balancesResponse.total_usd || 0)
    
    const exchangeSummaries = exchangesResponse.exchanges?.map(ex => {
      const exchangeName = ex.exchange_name
      
      const exchangeData = balancesResponse.exchanges?.find(
        e => (e.exchange || e.name) === exchangeName
      )
      
      const exchangeTotal = exchangeData ? Number(exchangeData.total_usd || 0) : 0
      
      return {
        name: exchangeName,
        totalUsd: exchangeTotal,
        totalBrl: 0,
        isActive: ex.is_active,
      }
    }) || []
    
    console.log(`✅ [BalanceService] Summary calculado: $${totalUsd.toFixed(2)} USD`)
    
    return {
      totalUsd,
      totalBrl: 0,
      exchanges: exchangeSummaries,
      lastUpdate: new Date(),
    }
  } catch (error) {
    console.error('❌ [BalanceService] Erro ao buscar summary:', error)
    return {
      totalUsd: 0,
      totalBrl: 0,
      exchanges: [],
      lastUpdate: new Date(),
    }
  }
}

/**
 * Busca histórico de snapshots do MongoDB via API (gráfico de evolução)
 */
export const getBalanceEvolution = async (
  userId: string,
  days: number = 30
): Promise<Array<{ date: Date; usd: number; brl: number }>> => {
  try {
    console.log(`🔍 [BalanceService] Buscando evolução (${days} dias) do MongoDB via API...`)
    
    const response = await apiService.getPortfolioEvolution(userId)
    
    if (!response.success || !response.evolution) {
      console.warn('⚠️ [BalanceService] Sem snapshots disponíveis')
      return []
    }

    const { timestamps, values_usd, values_brl } = response.evolution
    
    if (!timestamps || !values_usd) {
      return []
    }
    
    console.log(`✅ [BalanceService] ${timestamps.length} snapshots encontrados`)
    
    return timestamps.map((timestamp, index) => ({
      date: new Date(timestamp),
      usd: values_usd[index] || 0,
      brl: values_brl?.[index] || 0,
    }))
  } catch (error) {
    console.error('❌ [BalanceService] Erro ao buscar evolução:', error)
    return []
  }
}

/**
 * Sincroniza balanços com CCXT via API Backend
 */
export const syncBalances = async (userId: string): Promise<Balance[]> => {
  try {
    console.log('🔄 [BalanceService] Forçando refresh no backend...')
    
    await apiService.getBalances(userId, true)
    
    console.log('✅ [BalanceService] Sync concluído com sucesso')
    
    return await getBalances(userId)
  } catch (error) {
    console.error('❌ [BalanceService] Erro ao sincronizar:', error)
    return []
  }
}

/**
 * Limpa cache de balanços (não faz nada - sem cache local)
 */
export const clearBalanceCache = async (): Promise<void> => {
  console.log('ℹ️ [BalanceService] clearBalanceCache() chamado - sem cache local, nada a fazer')
}

// Exporta funções com nomes legados para compatibilidade
export const getLocalBalances = getBalances
export const getLocalBalanceSummary = getBalanceSummary
export const syncBalancesFromAPI = syncBalances
