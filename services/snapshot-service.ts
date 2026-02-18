import { table } from '../lib/sqlite/query-builder'
import { apiService } from './api'

/**
 * Snapshot Service - SQLite Version
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

export interface BalanceSnapshot {
  id?: number
  user_id: string
  total_usd: number
  total_brl: number
  timestamp: number
  created_at?: string
}

export interface BalanceHistory {
  id?: number
  user_id: string
  exchange_name: string
  symbol: string
  amount: number
  usd_value: number
  brl_value: number
  timestamp: number
}

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
    const id = await table<BalanceSnapshot>('balance_snapshots')
      .insert({
        user_id: data.userId,
        total_usd: data.totalUsd,
        total_brl: data.totalBrl,
        timestamp: data.timestamp || Date.now(),
      })
    
    // Buscar o snapshot recém-criado
    const snapshot = await table<BalanceSnapshot>('balance_snapshots')
      .where('id', '=', id)
      .first()
    
    return snapshot!
  }

  /**
   * Cria snapshot baseado nos dados ATUALIZADOS da API
   */
  async createSnapshotFromHistory(userId: string): Promise<BalanceSnapshot | null> {
    try {
      console.log('📸 Criando snapshot - buscando dados frescos da API...')
      
      // 1️⃣ Buscar dados atualizados da API
      const balanceData = await apiService.getBalances(userId, true)
      
      if (!balanceData.exchanges || balanceData.exchanges.length === 0) {
        console.log('📊 Nenhum balanço encontrado para criar snapshot')
        return null
      }

      // 2️⃣ Salvar no balance_history e calcular totais
      const now = new Date()
      let totalUsd = 0
      let totalBrl = 0

      for (const exchange of balanceData.exchanges) {
        if (!exchange.success || !exchange.balances) continue

        for (const [symbol, balance] of Object.entries(exchange.balances)) {
          const balanceInfo: any = balance
          totalUsd += balanceInfo.usd_value || 0
          totalBrl += balanceInfo.brl_value || 0

          // Salvar cada token no histórico
          await table<BalanceHistory>('balance_history').insert({
            user_id: userId,
            exchange_name: exchange.exchange,
            symbol: symbol,
            amount: balanceInfo.total || 0,
            usd_value: balanceInfo.usd_value || 0,
            brl_value: balanceInfo.brl_value || 0,
            timestamp: now.getTime(),
          })
        }
      }

      // 3️⃣ Criar snapshot com totais atualizados
      const snapshot = await this.createSnapshot({
        userId,
        totalUsd,
        totalBrl,
      })

      console.log(`✅ Snapshot criado com dados frescos: $${totalUsd.toFixed(2)} USD / R$${totalBrl.toFixed(2)} BRL`)
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
    let query = table<BalanceSnapshot>('balance_snapshots')
      .where('user_id', '=', userId)
      .orderBy('timestamp', 'DESC')

    if (options.startDate) {
      query = query.where('timestamp', '>=', options.startDate)
    }

    if (options.endDate) {
      query = query.where('timestamp', '<=', options.endDate)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    return await query.get()
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

    const snapshot = await table<BalanceSnapshot>('balance_snapshots')
      .where('user_id', '=', userId)
      .where('timestamp', '>=', todayTimestamp)
      .orderBy('timestamp', 'DESC')
      .first()

    return snapshot || null
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

      const todayTotal = latest.total_usd
      const yesterdayTotal = yesterday[0]?.total_usd || todayTotal
      const weekTotal = week[0]?.total_usd || todayTotal
      const monthTotal = month[0]?.total_usd || todayTotal

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
        if (snapshot.total_usd > allTimeHigh) allTimeHigh = snapshot.total_usd
        if (snapshot.total_usd < allTimeLow) allTimeLow = snapshot.total_usd
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
      
      const oldSnapshots = await table<BalanceSnapshot>('balance_snapshots')
        .where('user_id', '=', userId)
        .where('timestamp', '<', cutoffDate)
        .get()

      if (oldSnapshots.length === 0) {
        return 0
      }

      // Deletar snapshots antigos
      for (const snapshot of oldSnapshots) {
        if (snapshot.id) {
          await table('balance_snapshots')
            .where('id', '=', snapshot.id)
            .delete()
        }
      }

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
    let timeoutId: NodeJS.Timeout | number

    const scheduleNextSnapshot = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0) // Meia-noite

      const msUntilMidnight = tomorrow.getTime() - now.getTime()

      console.log(`⏰ Próximo snapshot agendado para: ${tomorrow.toLocaleString()}`)

      timeoutId = setTimeout(async () => {
        console.log('📸 Criando snapshot diário automático...')
        await this.createSnapshotFromHistory(userId)
        await this.cleanOldSnapshots(userId)
        
        // Reagendar para próximo dia
        scheduleNextSnapshot()
      }, msUntilMidnight)
    }

    scheduleNextSnapshot()

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
      
      csv += `${dateStr},${timeStr},${snapshot.total_usd.toFixed(2)},${snapshot.total_brl.toFixed(2)}\n`
    }
    
    return csv
  }

  /**
   * Busca snapshots para gráfico (dados agregados por dia)
   */
  async getChartData(
    userId: string,
    days: number = 30
  ): Promise<Array<{ date: string; total_usd: number; total_brl: number }>> {
    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000)
    
    const snapshots = await table<BalanceSnapshot>('balance_snapshots')
      .where('user_id', '=', userId)
      .where('timestamp', '>=', startDate)
      .orderBy('timestamp', 'ASC')
      .get()

    // Agrupar por dia
    const groupedByDay = new Map<string, BalanceSnapshot>()
    
    for (const snapshot of snapshots) {
      const date = new Date(snapshot.timestamp)
      const dateKey = date.toISOString().split('T')[0] // YYYY-MM-DD
      
      // Pegar o último snapshot de cada dia
      if (!groupedByDay.has(dateKey) || snapshot.timestamp > groupedByDay.get(dateKey)!.timestamp) {
        groupedByDay.set(dateKey, snapshot)
      }
    }

    // Converter para array ordenado
    return Array.from(groupedByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, snapshot]) => ({
        date,
        total_usd: snapshot.total_usd,
        total_brl: snapshot.total_brl,
      }))
  }

  /**
   * Deleta todos os snapshots de um usuário
   */
  async deleteAllSnapshots(userId: string): Promise<number> {
    const snapshots = await table<BalanceSnapshot>('balance_snapshots')
      .where('user_id', '=', userId)
      .get()

    for (const snapshot of snapshots) {
      if (snapshot.id) {
        await table('balance_snapshots')
          .where('id', '=', snapshot.id)
          .delete()
      }
    }

    console.log(`🗑️  Removidos ${snapshots.length} snapshots do usuário`)
    return snapshots.length
  }
}

export const snapshotService = new SnapshotService()
