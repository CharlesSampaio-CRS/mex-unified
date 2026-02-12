import { backgroundSyncService } from './background-sync'
import { snapshotService } from './snapshot-service'
import { exchangeService } from './exchange-service'

/**
 * Daily Snapshot Scheduler - SQLite Version
 * 
 * Agendador automático de snapshots diários às 00:00
 * - Busca balances de todas as exchanges conectadas
 * - Salva snapshot no SQLite
 * - Retry automático em caso de erro (até 3 tentativas)
 * - Roda em background independente do usuário
 */

interface SchedulerState {
  isRunning: boolean
  lastSnapshot: number | null
  nextSnapshot: number | null
  retryCount: number
  lastError: string | null
}

class DailySnapshotScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private state: SchedulerState = {
    isRunning: false,
    lastSnapshot: null,
    nextSnapshot: null,
    retryCount: 0,
    lastError: null
  }
  
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY = 5 * 60 * 1000 // 5 minutos
  private readonly CHECK_INTERVAL = 60 * 1000 // Verifica a cada 1 minuto

  /**
   * Inicia o agendador
   */
  start(userId: string): void {
    if (this.intervalId) {
      console.log('⚠️  [DailySnapshotScheduler] Agendador já está rodando')
      return
    }
    
    console.log('🚀 [DailySnapshotScheduler] Iniciando agendador...')
    
    // Calcula próximo snapshot (meia-noite de hoje ou amanhã)
    this.state.nextSnapshot = this.getNextMidnight()
    
    console.log(`⏰ [DailySnapshotScheduler] Próximo snapshot agendado para: ${new Date(this.state.nextSnapshot).toLocaleString()}`)
    
    // Verifica a cada 1 minuto se chegou a hora
    this.intervalId = setInterval(() => {
      this.checkAndRunSnapshot(userId)
    }, this.CHECK_INTERVAL)
  }

  /**
   * Para o agendador
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('⏹️  [DailySnapshotScheduler] Agendador parado')
    }
  }

  /**
   * Verifica se chegou a hora de criar snapshot
   */
  private async checkAndRunSnapshot(userId: string): Promise<void> {
    const now = Date.now()
    
    // Se já está rodando, aguarda
    if (this.state.isRunning) {
      return
    }

    // Se ainda não chegou a hora
    if (this.state.nextSnapshot && now < this.state.nextSnapshot) {
      return
    }

    // Chegou a hora! Executa snapshot
    console.log('📸 [DailySnapshotScheduler] Hora do snapshot diário!')
    await this.runDailySnapshot(userId)
  }

  /**
   * Executa o snapshot diário com retry
   */
  private async runDailySnapshot(userId: string): Promise<void> {
    this.state.isRunning = true
    this.state.retryCount = 0

    let success = false

    // Retry até 3 vezes
    while (this.state.retryCount < this.MAX_RETRIES && !success) {
      try {
        console.log(`🔄 [DailySnapshotScheduler] Tentativa ${this.state.retryCount + 1}/${this.MAX_RETRIES}`)
        
        // 1. Busca exchanges conectadas
        const exchanges = await exchangeService.getConnectedExchanges(userId)

        if (!exchanges || exchanges.length === 0) {
          console.log('⚠️  [DailySnapshotScheduler] Nenhuma exchange conectada')
          success = true // Não é erro, apenas não tem exchanges
          break
        }

        // 2. Busca balances de todas as exchanges via backend
        const balanceResponse = await backgroundSyncService.syncNow(userId)

        if (!balanceResponse) {
          throw new Error('Balance response retornou null')
        }

        // 3. Salva snapshot no SQLite
        const totalUsd = typeof balanceResponse.total_usd === 'string' 
          ? parseFloat(balanceResponse.total_usd) 
          : balanceResponse.total_usd
        const totalBrl = totalUsd * 5.5 // TODO: Pegar taxa real do BRL

        const snapshot = await snapshotService.createSnapshot({
          userId,
          totalUsd,
          totalBrl,
          timestamp: Date.now()
        })

        // Sucesso!
        success = true
        this.state.lastSnapshot = Date.now()
        this.state.lastError = null
        this.state.nextSnapshot = this.getNextMidnight()
        
        console.log(`✅ [DailySnapshotScheduler] Snapshot criado com sucesso! Total: $${totalUsd.toFixed(2)} USD`)
        console.log(`⏰ [DailySnapshotScheduler] Próximo snapshot: ${new Date(this.state.nextSnapshot).toLocaleString()}`)

      } catch (error) {
        this.state.retryCount++
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido'
        this.state.lastError = errorMsg

        console.error(`❌ [DailySnapshotScheduler] Erro na tentativa ${this.state.retryCount}/${this.MAX_RETRIES}:`, errorMsg)

        if (this.state.retryCount < this.MAX_RETRIES) {
          console.log(`⏳ [DailySnapshotScheduler] Aguardando ${this.RETRY_DELAY / 1000}s antes de tentar novamente...`)
          await this.sleep(this.RETRY_DELAY)
        } else {
          console.error('❌ [DailySnapshotScheduler] Máximo de tentativas atingido, pulando snapshot')
          // Agenda próximo snapshot mesmo com erro
          this.state.nextSnapshot = this.getNextMidnight()
          console.log(`⏰ [DailySnapshotScheduler] Próximo snapshot: ${new Date(this.state.nextSnapshot).toLocaleString()}`)
        }
      }
    }

    this.state.isRunning = false
  }

  /**
   * Calcula timestamp da próxima meia-noite
   */
  private getNextMidnight(): number {
    const now = new Date()
    const midnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1, // Amanhã
      0, 0, 0, 0 // 00:00:00.000
    )
    return midnight.getTime()
  }

  /**
   * Helper para aguardar
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Retorna estado atual do agendador
   */
  getState(): SchedulerState {
    return { ...this.state }
  }

  /**
   * Força execução imediata do snapshot (para testes)
   */
  async forceSnapshot(userId: string): Promise<void> {
    console.log('🔨 [DailySnapshotScheduler] Forçando snapshot imediato...')
    await this.runDailySnapshot(userId)
  }
}

// Singleton
export const dailySnapshotScheduler = new DailySnapshotScheduler()
