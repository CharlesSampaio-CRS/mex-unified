import { apiService } from './api'
import { config } from '@/lib/config'
import { secureStorage } from '@/lib/secure-storage'

/**
 * Backend Snapshot Service
 * 
 * Serviço que consome os endpoints do backend para:
 * - Buscar snapshots históricos (MongoDB)
 * - Salvar snapshots manualmente
 * - Calcular PNL baseado em snapshots do backend
 * 
 * ✅ Centralizado: Todos os dados vêm do MongoDB via backend
 * ✅ Seguro: Dados criptografados no banco
 * ✅ Consistente: Única fonte da verdade
 */

const API_BASE_URL = config.apiBaseUrl;

export interface BackendSnapshot {
  user_id: string
  date: string // YYYY-MM-DD
  total_usd: number
  total_brl: number
  timestamp: number // ⚠️ MongoDB retorna em MILISSEGUNDOS (não segundos!)
  exchanges: ExchangeSnapshotDetail[]
}

export interface ExchangeSnapshotDetail {
  exchange_id: string
  exchange_name: string
  balance_usd: number
  is_active: boolean
  tokens_count: number
}

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

class BackendSnapshotService {
  /**
   * Busca todos os snapshots do usuário autenticado
   */
  async getSnapshots(): Promise<BackendSnapshot[]> {
    try {
      const token = await secureStorage.getItemAsync('access_token')
      
      const response = await fetch(`${API_BASE_URL}/snapshots`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success && data.snapshots) {
      // Ordena por timestamp decrescente (mais recente primeiro)
        return data.snapshots.sort((a: BackendSnapshot, b: BackendSnapshot) => b.timestamp - a.timestamp)
      }
      
      return []
    } catch (error) {
      console.error('❌ Erro ao buscar snapshots:', error)
      throw error
    }
  }

  /**
   * Salva um snapshot manualmente
   */
  async saveSnapshot(): Promise<void> {
    try {
      const { data } = await apiService.post<{
        success: boolean
        message: string
      }>('/snapshots/save', {})
      
      if (!data.success) {
        throw new Error(data.message || 'Falha ao salvar snapshot')
      }
      
      console.log('✅ Snapshot salvo com sucesso')
    } catch (error) {
      console.error('❌ Erro ao salvar snapshot:', error)
      throw error
    }
  }

  /**
   * Calcula PNL baseado nos snapshots do backend
   */
  async calculatePnL(currentBalance: number): Promise<PnLSummary> {
    try {
      const snapshots = await this.getSnapshots()
      
      if (snapshots.length === 0) {
        // Sem histórico, retorna zeros
        return this.createEmptyPnL(currentBalance)
      }

      const now = Date.now()
      const oneDayAgo = now - (24 * 60 * 60 * 1000)
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000)
      const fourteenDaysAgo = now - (14 * 24 * 60 * 60 * 1000)
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000)

      return {
        currentBalance,
        today: this.calculatePeriodPnL(currentBalance, snapshots, oneDayAgo, '24h'),
        week: this.calculatePeriodPnL(currentBalance, snapshots, sevenDaysAgo, '7d'),
        twoWeeks: this.calculatePeriodPnL(currentBalance, snapshots, fourteenDaysAgo, '14d'),
        month: this.calculatePeriodPnL(currentBalance, snapshots, thirtyDaysAgo, '30d'),
      }
    } catch (error) {
      console.error('❌ Erro ao calcular PnL:', error)
      return this.createEmptyPnL(currentBalance)
    }
  }

  /**
   * Calcula PnL para um período específico
   */
  private calculatePeriodPnL(
    currentBalance: number,
    snapshots: BackendSnapshot[],
    timestampThreshold: number,
    period: string
  ): PnLData {
    // Encontra o snapshot mais próximo do timestamp
    const snapshot = this.findClosestSnapshot(snapshots, timestampThreshold)
    
    if (!snapshot) {
      return {
        current: currentBalance,
        previous: 0,
        change: 0,
        changePercent: 0,
        period,
      }
    }

    const previousBalance = snapshot.total_usd
    const change = currentBalance - previousBalance
    const changePercent = previousBalance > 0 ? (change / previousBalance) * 100 : 0

    return {
      current: currentBalance,
      previous: previousBalance,
      change,
      changePercent,
      period,
    }
  }

  /**
   * Encontra o snapshot mais próximo de um timestamp
   */
  private findClosestSnapshot(
    snapshots: BackendSnapshot[],
    targetTimestamp: number
  ): BackendSnapshot | null {
    if (snapshots.length === 0) return null

    // Filtra snapshots antes do timestamp alvo
    const validSnapshots = snapshots.filter(s => s.timestamp <= targetTimestamp)
    
    if (validSnapshots.length === 0) {
      // Se não houver snapshot antes, pega o mais antigo
      return snapshots[snapshots.length - 1]
    }

    // Retorna o mais recente dos válidos (mais próximo do alvo)
    return validSnapshots[0]
  }

  /**
   * Cria estrutura de PnL vazia
   */
  private createEmptyPnL(currentBalance: number): PnLSummary {
    const emptyPnL: PnLData = {
      current: currentBalance,
      previous: 0,
      change: 0,
      changePercent: 0,
      period: '',
    }

    return {
      currentBalance,
      today: { ...emptyPnL, period: '24h' },
      week: { ...emptyPnL, period: '7d' },
      twoWeeks: { ...emptyPnL, period: '14d' },
      month: { ...emptyPnL, period: '30d' },
    }
  }

  /**
   * Busca estatísticas dos snapshots
   */
  async getStats(): Promise<{
    todayTotal: number
    yesterdayTotal: number
    dailyChange: number
    dailyChangePercent: number
    allTimeHigh: number
    allTimeLow: number
  }> {
    try {
      const snapshots = await this.getSnapshots()
      
      if (snapshots.length === 0) {
        return {
          todayTotal: 0,
          yesterdayTotal: 0,
          dailyChange: 0,
          dailyChangePercent: 0,
          allTimeHigh: 0,
          allTimeLow: 0,
        }
      }

      // Mais recente = hoje
      const todaySnapshot = snapshots[0]
      const todayTotal = todaySnapshot.total_usd

      // Segundo mais recente = ontem
      const yesterdaySnapshot = snapshots.length > 1 ? snapshots[1] : todaySnapshot
      const yesterdayTotal = yesterdaySnapshot.total_usd

      const dailyChange = todayTotal - yesterdayTotal
      const dailyChangePercent = yesterdayTotal > 0 ? (dailyChange / yesterdayTotal) * 100 : 0

      // All-time high e low
      const balances = snapshots.map(s => s.total_usd)
      const allTimeHigh = Math.max(...balances)
      const allTimeLow = Math.min(...balances)

      return {
        todayTotal,
        yesterdayTotal,
        dailyChange,
        dailyChangePercent,
        allTimeHigh,
        allTimeLow,
      }
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error)
      throw error
    }
  }

  /**
   * Busca dados de evolução do portfólio para o gráfico
   * Retorna valores históricos para um período específico
   */
  async getEvolutionData(days: number = 7): Promise<{
    values_usd: number[]
    timestamps: string[]
  }> {
    try {
      const snapshots = await this.getSnapshots()
      
      if (snapshots.length === 0) {
        return {
          values_usd: [],
          timestamps: [],
        }
      }

      // Filtra snapshots pelo período solicitado
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      cutoffDate.setHours(0, 0, 0, 0)
      
      const cutoffTimestamp = cutoffDate.getTime() // Agora em milissegundos
      
      const filteredSnapshots = snapshots
        .filter(s => s.timestamp >= cutoffTimestamp)
        .sort((a, b) => a.timestamp - b.timestamp) // Ordena do mais antigo para o mais recente

      // Se não há snapshots no período, retorna vazio
      if (filteredSnapshots.length === 0) {
        return {
          values_usd: [],
          timestamps: [],
        }
      }

      // Extrai valores e timestamps
      const values_usd = filteredSnapshots.map(s => s.total_usd)
      const timestamps = filteredSnapshots.map(s => {
        const date = new Date(s.timestamp) // timestamp JÁ em milissegundos
        const isoString = date.toISOString()
        
        return isoString
      })

      return {
        values_usd,
        timestamps,
      }
    } catch (error) {
      console.error('❌ Erro ao buscar dados de evolução:', error)
      throw error
    }
  }
}

export const backendSnapshotService = new BackendSnapshotService()
