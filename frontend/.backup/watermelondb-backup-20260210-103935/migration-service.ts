import database from '../lib/watermelon/database'
import { snapshotService } from './snapshot-service'
import { BalanceHistory } from '../lib/watermelon/models/BalanceHistory'

/**
 * Migration Service
 * 
 * Importa dados do MongoDB para o WatermelonDB local
 * - Snapshots de balanço
 * - Histórico detalhado de balances
 */

interface MongoSnapshot {
  _id: { $oid: string }
  date: string
  user_id: string
  exchanges: Array<{
    exchange_id: string
    exchange_name: string
    balance_usd: number
    is_active: boolean
    tokens_count: number
  }>
  timestamp: { $numberLong: string }
  total_usd: number
  updated_at: { $date: string }
}

interface MongoBalance {
  user_id: string
  exchange_name: string
  symbol: string
  free: number
  used: number
  total: number
  usd_value?: number
  brl_value?: number
  timestamp?: number
}

class MigrationService {
  /**
   * Importa snapshot do MongoDB para WatermelonDB
   */
  async importMongoSnapshot(mongoSnapshot: MongoSnapshot): Promise<boolean> {
    try {
      console.log('📥 Importando snapshot do MongoDB...')

      // Converter timestamp do MongoDB
      const timestamp = parseInt(mongoSnapshot.timestamp.$numberLong) * 1000 // Converter para ms

      // Calcular total em BRL (assumindo taxa de câmbio 5.0)
      const exchangeRate = 5.0 // TODO: Pegar taxa real
      const totalBrl = mongoSnapshot.total_usd * exchangeRate

      // Criar snapshot no WatermelonDB
      const snapshot = await snapshotService.createSnapshot({
        userId: mongoSnapshot.user_id,
        totalUsd: mongoSnapshot.total_usd,
        totalBrl: totalBrl,
        timestamp: timestamp,
      })

      console.log('✅ Snapshot importado:', {
        id: snapshot.id,
        totalUsd: mongoSnapshot.total_usd,
        totalBrl: totalBrl,
        timestamp: new Date(timestamp).toLocaleString(),
      })

      // Importar balance_history detalhado de cada exchange
      await this.importExchangeBalances(
        mongoSnapshot.user_id,
        mongoSnapshot.exchanges,
        timestamp
      )

      return true
    } catch (error) {
      console.error('❌ Erro ao importar snapshot:', error)
      return false
    }
  }

  /**
   * Importa balances detalhados de exchanges
   */
  private async importExchangeBalances(
    userId: string,
    exchanges: MongoSnapshot['exchanges'],
    timestamp: number
  ): Promise<void> {
    const collection = database.get<BalanceHistory>('balance_history')

    await database.write(async () => {
      for (const exchange of exchanges) {
        if (exchange.balance_usd > 0) {
          await collection.create(balance => {
            balance.userId = userId
            balance.exchangeName = exchange.exchange_name
            balance.symbol = 'TOTAL' // Placeholder
            balance.free = 0
            balance.used = 0
            balance.total = exchange.balance_usd
            balance.usdValue = exchange.balance_usd
            balance.brlValue = exchange.balance_usd * 5.0 // TODO: Taxa real
            balance.timestamp = timestamp
          })
        }
      }
    })

    console.log(`✅ Importados ${exchanges.length} balances de exchanges`)
  }

  /**
   * Importa múltiplos snapshots de uma vez
   */
  async importMongoSnapshots(snapshots: MongoSnapshot[]): Promise<{
    success: number
    failed: number
  }> {
    let success = 0
    let failed = 0

    console.log(`📦 Importando ${snapshots.length} snapshots...`)

    for (const snapshot of snapshots) {
      const result = await this.importMongoSnapshot(snapshot)
      if (result) {
        success++
      } else {
        failed++
      }
    }

    console.log(`✅ Importação concluída: ${success} sucesso, ${failed} falhas`)

    return { success, failed }
  }

  /**
   * Importa balance detalhado (com tokens individuais)
   */
  async importBalanceHistory(balances: MongoBalance[]): Promise<number> {
    try {
      const collection = database.get<BalanceHistory>('balance_history')
      let count = 0

      await database.write(async () => {
        for (const balance of balances) {
          await collection.create(b => {
            b.userId = balance.user_id
            b.exchangeName = balance.exchange_name
            b.symbol = balance.symbol
            b.free = balance.free
            b.used = balance.used
            b.total = balance.total
            b.usdValue = balance.usd_value || 0
            b.brlValue = balance.brl_value || 0
            b.timestamp = balance.timestamp || Date.now()
          })
          count++
        }
      })

      console.log(`✅ Importados ${count} registros de balance_history`)
      return count
    } catch (error) {
      console.error('❌ Erro ao importar balance_history:', error)
      return 0
    }
  }

  /**
   * Busca snapshots do MongoDB via API
   */
  async fetchMongoSnapshots(
    userId: string,
    apiUrl: string = 'http://localhost:3002'
  ): Promise<MongoSnapshot[]> {
    try {
      console.log(`🌐 Buscando snapshots do MongoDB para user ${userId}...`)

      const response = await fetch(
        `${apiUrl}/api/v1/snapshots?user_id=${userId}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`✅ ${data.length || 0} snapshots encontrados`)
      
      return data
    } catch (error) {
      console.error('❌ Erro ao buscar snapshots do MongoDB:', error)
      return []
    }
  }

  /**
   * Migração completa: MongoDB → WatermelonDB
   */
  async migrateFromMongo(
    userId: string,
    apiUrl: string = 'http://localhost:3002'
  ): Promise<boolean> {
    try {
      console.log('🚀 Iniciando migração MongoDB → WatermelonDB...')

      // 1. Buscar snapshots do MongoDB
      const snapshots = await this.fetchMongoSnapshots(userId, apiUrl)

      if (snapshots.length === 0) {
        console.log('⚠️  Nenhum snapshot encontrado no MongoDB')
        return false
      }

      // 2. Importar para WatermelonDB
      const result = await this.importMongoSnapshots(snapshots)

      console.log(`✅ Migração concluída: ${result.success}/${snapshots.length} snapshots`)

      // 3. Criar snapshot atual se necessário
      const today = await snapshotService.getTodaySnapshot(userId)
      if (!today) {
        console.log('📸 Criando snapshot do dia...')
        await snapshotService.createSnapshotFromHistory(userId)
      }

      return true
    } catch (error) {
      console.error('❌ Erro na migração:', error)
      return false
    }
  }

  /**
   * Importa dados de exemplo/teste
   */
  async importTestData(): Promise<void> {
    const testSnapshot: MongoSnapshot = {
      _id: { $oid: '697c1ed702aa49660af34553' },
      date: '2026-01-30',
      user_id: '6950290f5d594da225720e58',
      exchanges: [
        {
          exchange_id: '693481148b0a41e8b6acb079',
          exchange_name: 'NovaDAX',
          balance_usd: 0.0006162698492431068,
          is_active: true,
          tokens_count: 43,
        },
        {
          exchange_id: '693481148b0a41e8b6acb07b',
          exchange_name: 'MEXC',
          balance_usd: 0,
          is_active: true,
          tokens_count: 0,
        },
        {
          exchange_id: '693481148b0a41e8b6acb078',
          exchange_name: 'Bybit',
          balance_usd: 0.000063097508,
          is_active: true,
          tokens_count: 2,
        },
      ],
      timestamp: { $numberLong: '1769742027' },
      total_usd: 0.0006793673572431068,
      updated_at: { $date: '2026-01-30T03:00:39.853Z' },
    }

    await this.importMongoSnapshot(testSnapshot)
  }
}

export const migrationService = new MigrationService()
