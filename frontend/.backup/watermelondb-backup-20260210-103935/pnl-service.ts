import database from '../lib/watermelon/database'
import { Q } from '@nozbe/watermelondb'
import { BalanceSnapshot } from '../lib/watermelon/models/BalanceSnapshot'
import { BalanceResponse } from '@/types/api'

/**
 * PNL Service - Local
 * 
 * Calcula PNL (Profit and Loss) usando:
 * 1. Live data do endpoint /balances (com change_24h de cada token)
 * 2. Snapshots do WatermelonDB local (para períodos maiores)
 * 
 * Períodos suportados:
 * - Hoje (últimas 24h) - usa change_24h do backend
 * - 7 dias - usa snapshots
 * - 15 dias - usa snapshots
 * - 30 dias - usa snapshots
 */

export interface PnLData {
  current: number
  previous: number
  change: number
  changePercent: number
  period: string
}

export interface PnLSummary {
  currentBalance: number
  today: PnLData
  week: PnLData
  twoWeeks: PnLData
  month: PnLData
}

class PnLService {
  /**
   * ✅ CORRIGIDO: Calcula PNL do PORTFOLIO TOTAL (não de cada token)
   * 
   * LÓGICA CORRETA:
   * 1. Pega o valor TOTAL atual do portfolio (total_usd do response)
   * 2. Para cada token, calcula quanto o portfolio valia há 24h
   * 3. Portfolio_anterior = Σ (valor_token_atual / (1 + change_24h%))
   * 4. PNL = Portfolio_atual - Portfolio_anterior
   */
  calculatePnLFromLiveBalances(balanceResponse: BalanceResponse): PnLData {
    try {
      if (!balanceResponse?.exchanges || balanceResponse.exchanges.length === 0) {
        return {
          current: 0,
          previous: 0,
          change: 0,
          changePercent: 0,
          period: '24h'
        }
      }

      // 1. VALOR ATUAL TOTAL DO PORTFOLIO (direto do response)
      const currentTotal = typeof balanceResponse.total_usd === 'string' 
        ? parseFloat(balanceResponse.total_usd) 
        : (balanceResponse.total_usd || 0)

      if (currentTotal === 0) {
        return {
          current: 0,
          previous: 0,
          change: 0,
          changePercent: 0,
          period: '24h'
        }
      }

      // 2. CALCULA QUANTO O PORTFOLIO VALIA HÁ 24H
      let previousTotal = 0

      balanceResponse.exchanges.forEach(exchange => {
        if (!exchange.success || !exchange.balances) return

        Object.entries(exchange.balances).forEach(([symbol, balance]) => {
          const currentValue = balance.usd_value || 0
          const change24hPercent = balance.change_24h || 0

          if (currentValue > 0) {
            const previousValue = currentValue / (1 + (change24hPercent / 100))
            previousTotal += previousValue
          }
        })
      })

      // 3. CALCULA PNL DO PORTFOLIO
      const change = currentTotal - previousTotal
      const changePercent = previousTotal > 0 ? (change / previousTotal) * 100 : 0

      const result = {
        current: currentTotal,
        previous: previousTotal,
        change,
        changePercent,
        period: '24h'
      }

      return result
      
    } catch (error) {
      return {
        current: 0,
        previous: 0,
        change: 0,
        changePercent: 0,
        period: '24h'
      }
    }
  }
  /**
   * Busca snapshot mais próximo de uma data específica
   * Usa janela de ±3 dias para maior flexibilidade
   */
  private async getSnapshotNearDate(
    userId: string,
    targetTimestamp: number,
    windowMs: number = 3 * 24 * 60 * 60 * 1000 // Janela de ±3 dias (mais flexível)
  ): Promise<BalanceSnapshot | null> {
    const collection = database.get<BalanceSnapshot>('balance_snapshots')
    
    const minTimestamp = targetTimestamp - windowMs
    const maxTimestamp = targetTimestamp + windowMs
    
    // Busca TODOS os snapshots dentro da janela
    const snapshots = await collection
      .query(
        Q.where('user_id', userId),
        Q.where('timestamp', Q.gte(minTimestamp)),
        Q.where('timestamp', Q.lte(maxTimestamp)),
      )
      .fetch()
    
    // Se encontrou snapshots, escolhe o MAIS PRÓXIMO da data alvo
    if (snapshots.length > 0) {
      // Encontra o snapshot com timestamp mais próximo do target
      const closestSnapshot = snapshots.reduce((closest, current) => {
        const closestDiff = Math.abs(closest.timestamp - targetTimestamp)
        const currentDiff = Math.abs(current.timestamp - targetTimestamp)
        return currentDiff < closestDiff ? current : closest
      })
      
      return closestSnapshot
    }
    
    return null
  }

  /**
   * Busca o snapshot mais recente
   */
  async getLatestSnapshot(userId: string): Promise<BalanceSnapshot | null> {
    const collection = database.get<BalanceSnapshot>('balance_snapshots')
    
    const snapshots = await collection
      .query(
        Q.where('user_id', userId),
        Q.sortBy('timestamp', Q.desc),
        Q.take(1)
      )
      .fetch()
        
    return snapshots.length > 0 ? snapshots[0] : null
  }

  /**
   * ✅ SIMPLIFICADO: Calcula PNL para um período específico
   * 
   * LÓGICA SIMPLES:
   * 1. Pega o valor atual (ou do último snapshot)
   * 2. Busca snapshot próximo da data alvo (X dias atrás)
   * 3. Calcula: PNL = atual - anterior
   */
  private async calculatePnL(
    userId: string,
    daysAgo: number,
    period: string,
    currentBalance?: number
  ): Promise<PnLData> {
    // Valor atual
    const currentValue = currentBalance !== undefined 
      ? currentBalance 
      : (await this.getLatestSnapshot(userId))?.totalUsd || 0
    
    if (currentValue === 0) {
      return { current: 0, previous: 0, change: 0, changePercent: 0, period }
    }

    // Busca snapshot de X dias atrás
    const now = Date.now()
    const targetTimestamp = now - (daysAgo * 24 * 60 * 60 * 1000)
    
    const previousSnapshot = await this.getSnapshotNearDate(userId, targetTimestamp)
    
    if (!previousSnapshot) {
      // Sem snapshot anterior, não há PNL
      return { current: currentValue, previous: currentValue, change: 0, changePercent: 0, period }
    }
    
    // Calcula mudança
    const change = currentValue - previousSnapshot.totalUsd
    const changePercent = previousSnapshot.totalUsd > 0 
      ? (change / previousSnapshot.totalUsd) * 100 
      : 0

    return {
      current: currentValue,
      previous: previousSnapshot.totalUsd,
      change,
      changePercent,
      period
    }
  }

  /**
   * ✅ SIMPLIFICADO: Calcula PNL de Hoje (últimas 24h)
   * 
   * LÓGICA SIMPLES:
   * 1. Pega o valor atual
   * 2. Busca snapshot de ~24h atrás (com janela de tolerância)
   * 3. Calcula: PNL = atual - ontem
   */
  async getTodayPnL(userId: string, currentBalance?: number): Promise<PnLData> {
    // Valor atual
    const currentValue = currentBalance !== undefined
      ? currentBalance
      : (await this.getLatestSnapshot(userId))?.totalUsd || 0
    
    if (currentValue === 0) {
      return { current: 0, previous: 0, change: 0, changePercent: 0, period: 'today' }
    }

    // Busca snapshot de ~24h atrás (com janela de 24h para encontrar o mais próximo)
    const yesterdayTimestamp = Date.now() - (24 * 60 * 60 * 1000)
    const yesterdaySnapshot = await this.getSnapshotNearDate(userId, yesterdayTimestamp, 24 * 60 * 60 * 1000)
    
    if (!yesterdaySnapshot) {
      // Sem snapshot de ontem, não há PNL
      return { current: currentValue, previous: currentValue, change: 0, changePercent: 0, period: 'today' }
    }
    
    // Calcula mudança
    const change = currentValue - yesterdaySnapshot.totalUsd
    const changePercent = yesterdaySnapshot.totalUsd > 0 
      ? (change / yesterdaySnapshot.totalUsd) * 100 
      : 0

    return {
      current: currentValue,
      previous: yesterdaySnapshot.totalUsd,
      change,
      changePercent,
      period: 'today'
    }
  }

  // Últimos 7 dias
  async getWeekPnL(userId: string, currentBalance?: number): Promise<PnLData> {
    return this.calculatePnL(userId, 7, 'week', currentBalance)
  }

  // Últimos 15 dias
  async getTwoWeeksPnL(userId: string, currentBalance?: number): Promise<PnLData> {
    return this.calculatePnL(userId, 15, 'twoWeeks', currentBalance)
  }

  // Últimos 30 dias
  async getMonthPnL(userId: string, currentBalance?: number): Promise<PnLData> {
    return this.calculatePnL(userId, 30, 'month', currentBalance)
  }

  /**
   * Resumo completo de PNL (todos os períodos)
   */
  async getPnLSummary(userId: string, currentBalance?: number): Promise<PnLSummary> {
    const effectiveBalance = currentBalance !== undefined
      ? currentBalance
      : (await this.getLatestSnapshot(userId))?.totalUsd || 0
    
    if (effectiveBalance === 0) {
      const zeroPnl = { current: 0, previous: 0, change: 0, changePercent: 0, period: '' }
      return {
        currentBalance: 0,
        today: { ...zeroPnl, period: 'today' },
        week: { ...zeroPnl, period: 'week' },
        twoWeeks: { ...zeroPnl, period: 'twoWeeks' },
        month: { ...zeroPnl, period: 'month' }
      }
    }

    const [today, week, twoWeeks, month] = await Promise.all([
      this.getTodayPnL(userId, effectiveBalance),
      this.getWeekPnL(userId, effectiveBalance),
      this.getTwoWeeksPnL(userId, effectiveBalance),
      this.getMonthPnL(userId, effectiveBalance)
    ])

    return { currentBalance: effectiveBalance, today, week, twoWeeks, month }
  }

  /**
   * Retorna todos os snapshots do usuário (para gráficos)
   */
  async getAllSnapshots(
    userId: string,
    limit?: number
  ): Promise<BalanceSnapshot[]> {
    const collection = database.get<BalanceSnapshot>('balance_snapshots')
    
    let query = collection
      .query(
        Q.where('user_id', userId),
        Q.sortBy('timestamp', Q.desc)
      )
    
    if (limit) {
      query = query.extend(Q.take(limit))
    }
    
    return await query.fetch()
  }

  /**
   * Retorna snapshots de um período específico
   */
  async getSnapshotsInRange(
    userId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<BalanceSnapshot[]> {
    const collection = database.get<BalanceSnapshot>('balance_snapshots')
    
    return await collection
      .query(
        Q.where('user_id', userId),
        Q.where('timestamp', Q.gte(startTimestamp)),
        Q.where('timestamp', Q.lte(endTimestamp)),
        Q.sortBy('timestamp', Q.asc)
      )
      .fetch()
  }

  /**
   * Conta quantos snapshots existem
   */
  async getSnapshotCount(userId: string): Promise<number> {
    const collection = database.get<BalanceSnapshot>('balance_snapshots')
    
    const snapshots = await collection
      .query(Q.where('user_id', userId))
      .fetchCount()
    
    return snapshots
  }

  /**
   * Retorna dados de evolução para o gráfico
   * Formato compatível com PortfolioChart
   * 
   * ✅ CORRIGIDO: Interpola dados para garantir exatamente N pontos (onde N = days)
   * - Se pedir 7 dias, retorna 7 pontos
   * - Se pedir 15 dias, retorna 15 pontos
   * - Se pedir 30 dias, retorna 30 pontos
   */
  async getEvolutionData(userId: string, days: number = 7): Promise<{
    values_usd: number[]
    timestamps: string[]
  }> {
    const endTimestamp = Date.now()
    const startTimestamp = endTimestamp - (days * 24 * 60 * 60 * 1000)
    
    const snapshots = await this.getSnapshotsInRange(userId, startTimestamp, endTimestamp)
    
    if (snapshots.length === 0) {
      return {
        values_usd: [],
        timestamps: []
      }
    }
    
    // Se temos exatamente o número de pontos desejado ou mais, retorna direto
    if (snapshots.length >= days) {
      return {
        values_usd: snapshots.map(s => s.totalUsd),
        timestamps: snapshots.map(s => new Date(s.timestamp).toISOString())
      }
    }
    
    // ✨ INTERPOLAÇÃO: Gera exatamente N pontos distribuídos uniformemente
    const values_usd: number[] = []
    const timestamps: string[] = []
    
    // Cria N timestamps uniformemente espaçados
    const interval = (endTimestamp - startTimestamp) / (days - 1)
    
    for (let i = 0; i < days; i++) {
      const targetTimestamp = startTimestamp + (i * interval)
      timestamps.push(new Date(targetTimestamp).toISOString())
      
      // Encontra os 2 snapshots mais próximos (antes e depois)
      let beforeSnapshot: BalanceSnapshot | null = null
      let afterSnapshot: BalanceSnapshot | null = null
      
      for (const snapshot of snapshots) {
        if (snapshot.timestamp <= targetTimestamp) {
          if (!beforeSnapshot || snapshot.timestamp > beforeSnapshot.timestamp) {
            beforeSnapshot = snapshot
          }
        }
        if (snapshot.timestamp >= targetTimestamp) {
          if (!afterSnapshot || snapshot.timestamp < afterSnapshot.timestamp) {
            afterSnapshot = snapshot
          }
        }
      }
      
      // Interpola o valor
      if (beforeSnapshot && afterSnapshot && beforeSnapshot.id !== afterSnapshot.id) {
        // Interpolação linear entre os 2 pontos
        const timeDiff = afterSnapshot.timestamp - beforeSnapshot.timestamp
        const valueDiff = afterSnapshot.totalUsd - beforeSnapshot.totalUsd
        const ratio = (targetTimestamp - beforeSnapshot.timestamp) / timeDiff
        const interpolatedValue = beforeSnapshot.totalUsd + (valueDiff * ratio)
        values_usd.push(interpolatedValue)
      } else if (beforeSnapshot) {
        // Usa o valor mais próximo antes
        values_usd.push(beforeSnapshot.totalUsd)
      } else if (afterSnapshot) {
        // Usa o valor mais próximo depois
        values_usd.push(afterSnapshot.totalUsd)
      } else {
        // Fallback: usa o primeiro snapshot disponível
        values_usd.push(snapshots[0].totalUsd)
      }
    }
    
    return {
      values_usd,
      timestamps
    }
  }
}

export const pnlService = new PnLService()
