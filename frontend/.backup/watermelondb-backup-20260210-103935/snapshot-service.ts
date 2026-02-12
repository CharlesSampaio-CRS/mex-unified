import database from '../lib/watermelon/database'
import { Q } from '@nozbe/watermelondb'
import { BalanceSnapshot } from '../lib/watermelon/models/BalanceSnapshot'
import { BalanceHistory } from '../lib/watermelon/models/BalanceHistory'

/**
 * Snapshot Service
 * 
 * Gerencia snapshots periódicos de balanços para:
 * - Gráficos de evolução patrimonial
 * - Análise de performance ao longo do tempo
 * - Histórico de PnL
 * 
 * Estratégia:
 * - Snapshot diário às 00:00 (automático)
 * - Snapshot manual quando solicitado
 * - Mantém últimos 365 dias (1 ano)
 */

export interface SnapshotData {
  userId: string
  totalUsd: number
  totalBrl: number
  timestamp?: number
}

export interface SnapshotStats {
  todayTotal: number
  yesterdayTotal: number
  dailyChange: number
  dailyChangePercent: number
  weeklyChange: number
  monthlyChange: number
  allTimeHigh: number
  allTimeLow: number
}

class SnapshotService {
  /**
   * Cria um snapshot do balanço atual
   */
  async createSnapshot(data: SnapshotData): Promise<BalanceSnapshot> {
    const collection = database.get<BalanceSnapshot>('balance_snapshots')
    
    const snapshot = await database.write(async () => {
      return await collection.create(snapshot => {
        snapshot.userId = data.userId
        snapshot.totalUsd = data.totalUsd
        snapshot.totalBrl = data.totalBrl
        snapshot.timestamp = data.timestamp || Date.now()
      })
    })
    
    return snapshot
  }

  /**
   * Cria snapshot baseado no balance_history atual
   */
  async createSnapshotFromHistory(userId: string): Promise<BalanceSnapshot | null> {
    try {
      const historyCollection = database.get<BalanceHistory>('balance_history')
      
      // Buscar todos os balanços mais recentes do usuário
      const recentBalances = await historyCollection
        .query(
          Q.where('user_id', userId),
          Q.sortBy('timestamp', Q.desc),
          Q.take(100) // últimos 100 registros para calcular total
        )
        .fetch()

      if (recentBalances.length === 0) {
        console.log('📊 Nenhum balanço encontrado para criar snapshot')
        return null
      }

      // Agrupar por symbol e pegar o mais recente de cada
      const latestBySymbol = new Map<string, BalanceHistory>()
      
      for (const balance of recentBalances) {
        const key = `${balance.exchangeName}_${balance.symbol}`
        if (!latestBySymbol.has(key)) {
          latestBySymbol.set(key, balance)
        }
      }

      // Calcular totais
      let totalUsd = 0
      let totalBrl = 0

      for (const balance of latestBySymbol.values()) {
        totalUsd += balance.usdValue || 0
        totalBrl += balance.brlValue || 0
      }

      // Criar snapshot
      const snapshot = await this.createSnapshot({
        userId,
        totalUsd,
        totalBrl,
      })

      console.log(`✅ Snapshot criado: $${totalUsd.toFixed(2)} USD / R$${totalBrl.toFixed(2)} BRL`)
      return snapshot
    } catch (error) {
      console.error('❌ Erro ao criar snapshot:', error)
      return null
    }
  }

  /**
   * Busca snapshots do usuário
   */
  async getSnapshots(
    userId: string,
    options: {
      startDate?: number
      endDate?: number
      limit?: number
    } = {}
  ): Promise<BalanceSnapshot[]> {
    const collection = database.get<BalanceSnapshot>('balance_snapshots')
    
    const queries = [
      Q.where('user_id', userId),
      Q.sortBy('timestamp', Q.desc),
    ]

    if (options.startDate) {
      queries.push(Q.where('timestamp', Q.gte(options.startDate)))
    }

    if (options.endDate) {
      queries.push(Q.where('timestamp', Q.lte(options.endDate)))
    }

    let query = collection.query(...queries)
    
    if (options.limit) {
      query = query.extend(Q.take(options.limit))
    }

    return await query.fetch()
  }

  /**
   * Busca último snapshot
   */
  async getLatestSnapshot(userId: string): Promise<BalanceSnapshot | null> {
    const snapshots = await this.getSnapshots(userId, { limit: 1 })
    return snapshots[0] || null
  }

  /**
   * Busca snapshot do dia
   */
  async getTodaySnapshot(userId: string): Promise<BalanceSnapshot | null> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()

    const collection = database.get<BalanceSnapshot>('balance_snapshots')
    
    const snapshots = await collection
      .query(
        Q.where('user_id', userId),
        Q.where('timestamp', Q.gte(todayTimestamp)),
        Q.sortBy('timestamp', Q.desc),
        Q.take(1)
      )
      .fetch()

    return snapshots[0] || null
  }

  /**
   * Calcula estatísticas baseadas nos snapshots
   */
  async getStats(userId: string): Promise<SnapshotStats | null> {
    try {
      const now = Date.now()
      const oneDayAgo = now - 24 * 60 * 60 * 1000
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000
      const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000

      // Buscar snapshots necessários
      const [latest, yesterday, week, month, all] = await Promise.all([
        this.getLatestSnapshot(userId),
        this.getSnapshots(userId, { endDate: oneDayAgo, limit: 1 }),
        this.getSnapshots(userId, { endDate: oneWeekAgo, limit: 1 }),
        this.getSnapshots(userId, { endDate: oneMonthAgo, limit: 1 }),
        this.getSnapshots(userId, {}),
      ])

      if (!latest) {
        return null
      }

      const todayTotal = latest.totalUsd
      const yesterdayTotal = yesterday[0]?.totalUsd || todayTotal
      const weekTotal = week[0]?.totalUsd || todayTotal
      const monthTotal = month[0]?.totalUsd || todayTotal

      // Calcular mudanças
      const dailyChange = todayTotal - yesterdayTotal
      const dailyChangePercent = yesterdayTotal > 0 
        ? (dailyChange / yesterdayTotal) * 100 
        : 0

      const weeklyChange = todayTotal - weekTotal
      const monthlyChange = todayTotal - monthTotal

      // All time high/low
      let allTimeHigh = todayTotal
      let allTimeLow = todayTotal

      for (const snapshot of all) {
        if (snapshot.totalUsd > allTimeHigh) allTimeHigh = snapshot.totalUsd
        if (snapshot.totalUsd < allTimeLow) allTimeLow = snapshot.totalUsd
      }

      return {
        todayTotal,
        yesterdayTotal,
        dailyChange,
        dailyChangePercent,
        weeklyChange,
        monthlyChange,
        allTimeHigh,
        allTimeLow,
      }
    } catch (error) {
      console.error('❌ Erro ao calcular estatísticas:', error)
      return null
    }
  }

  /**
   * Limpa snapshots antigos (mantém últimos 365 dias)
   */
  async cleanOldSnapshots(userId: string, daysToKeep: number = 365): Promise<number> {
    try {
      const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
      
      const collection = database.get<BalanceSnapshot>('balance_snapshots')
      
      const oldSnapshots = await collection
        .query(
          Q.where('user_id', userId),
          Q.where('timestamp', Q.lt(cutoffDate))
        )
        .fetch()

      if (oldSnapshots.length === 0) {
        return 0
      }

      await database.write(async () => {
        await Promise.all(
          oldSnapshots.map(snapshot => snapshot.markAsDeleted())
        )
      })

      console.log(`🗑️  Removidos ${oldSnapshots.length} snapshots antigos`)
      return oldSnapshots.length
    } catch (error) {
      console.error('❌ Erro ao limpar snapshots:', error)
      return 0
    }
  }

  /**
   * Agenda snapshot diário automático
   * Retorna função para cancelar o agendamento
   */
  scheduleDailySnapshot(userId: string): () => void {
    const scheduleNextSnapshot = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0) // Meia-noite

      const msUntilMidnight = tomorrow.getTime() - now.getTime()

      console.log(`⏰ Próximo snapshot agendado para: ${tomorrow.toLocaleString()}`)

      return setTimeout(async () => {
        console.log('📸 Criando snapshot diário automático...')
        await this.createSnapshotFromHistory(userId)
        await this.cleanOldSnapshots(userId)
        
        // Reagendar para próximo dia
        scheduleNextSnapshot()
      }, msUntilMidnight)
    }

    const timeoutId = scheduleNextSnapshot()

    // Retorna função para cancelar
    return () => {
      clearTimeout(timeoutId)
      console.log('⏹️  Snapshot automático cancelado')
    }
  }

  /**
   * Exporta snapshots para CSV
   */
  async exportToCSV(userId: string): Promise<string> {
    const snapshots = await this.getSnapshots(userId, {})
    
    let csv = 'Date,Time,Total USD,Total BRL\n'
    
    for (const snapshot of snapshots.reverse()) {
      const date = new Date(snapshot.timestamp)
      const dateStr = date.toLocaleDateString()
      const timeStr = date.toLocaleTimeString()
      
      csv += `${dateStr},${timeStr},${snapshot.totalUsd.toFixed(2)},${snapshot.totalBrl.toFixed(2)}\n`
    }
    
    return csv
  }
}

export const snapshotService = new SnapshotService()
