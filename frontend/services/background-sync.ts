import { table } from '@/lib/sqlite/query-builder'
import { decryptData } from '@/lib/encryption'
import { apiService } from './api'
import { BalanceResponse } from '@/types/api'

interface UserExchange {
  id?: number
  user_id: string
  exchange_name: string
  exchange_type: string
  api_key_encrypted: string
  api_secret_encrypted: string
  api_passphrase_encrypted?: string
  is_active: boolean
  created_at?: string
}

class BackgroundSyncService {
  private syncInterval: ReturnType<typeof setInterval> | null = null
  private isSyncing = false
  private userId: string | null = null
  private currentSyncPromise: Promise<BalanceResponse | null> | null = null // ✨ Nova: Promise em andamento

  /**
   * Inicia o sync automático a cada 5 minutos
   */
  async start(userId: string) {
    if (this.syncInterval) {
      return
    }

    this.userId = userId

    // Sync imediato ao iniciar
    await this.syncNow()

    // Depois a cada 5 minutos
    this.syncInterval = setInterval(() => {
      this.syncNow()
    }, 5 * 60 * 1000) // 5 minutos
  }

  /**
   * Para o sync automático
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      this.userId = null
    }
  }

  /**
   * Executa um sync agora (manual ou automático)
   * @param userId - Opcional. Se não fornecido, usa o userId armazenado do start()
   * @returns BalanceResponse com os dados atualizados
   * 
   * ✨ IMPORTANTE: Se já houver um sync em andamento, retorna a promise existente
   * ao invés de fazer uma nova chamada ao backend
   */
  async syncNow(userId?: string): Promise<BalanceResponse | null> {
    const effectiveUserId = userId || this.userId

    // ✨ Se já está sincronizando, retorna a promise em andamento
    if (this.isSyncing && this.currentSyncPromise) {
      return this.currentSyncPromise
    }

    if (!effectiveUserId) {
      console.error('❌ userId não definido, não é possível fazer sync')
      return null
    }

    // ✨ Marca como sincronizando ANTES de criar a promise
    this.isSyncing = true

    // ✨ Cria e armazena a promise
    this.currentSyncPromise = (async () => {
      try {
        console.log('🔄 [BackgroundSync] Iniciando syncNow() para userId:', effectiveUserId)
        
        // 1. Buscar exchanges ativas do SQLite
        console.log('📊 [BackgroundSync] Buscando exchanges do SQLite...')
        const exchanges = await table<UserExchange>('user_exchanges')
          .where('user_id', '=', effectiveUserId)
          .where('is_active', '=', true)
          .get()

        console.log(`✅ [BackgroundSync] Encontradas ${exchanges.length} exchanges ativas`)
        
        if (exchanges.length === 0) {
          console.log('⚠️ [BackgroundSync] Nenhuma exchange ativa, retornando null')
          return null
        }

        // 2. Decriptar credenciais
        console.log('🔐 [BackgroundSync] Decriptando credenciais...')
        const exchangesData = await Promise.all(
          exchanges.map(async (ex) => {
            try {
              const apiKey = await decryptData(ex.api_key_encrypted, effectiveUserId)
              const apiSecret = await decryptData(ex.api_secret_encrypted, effectiveUserId)
              const passphrase = ex.api_passphrase_encrypted
                ? await decryptData(ex.api_passphrase_encrypted, effectiveUserId)
                : undefined

              return {
                exchange_id: ex.id,
                ccxt_id: ex.exchange_type,
                name: ex.exchange_name,
                api_key: apiKey,
                api_secret: apiSecret,
                passphrase,
              }
            } catch (error) {
              console.error(`❌ Erro ao decriptar exchange ${ex.exchange_name}:`, error)
              return null
            }
          })
        )

        // Filtrar exchanges com erro de decriptação
        const validExchanges = exchangesData.filter((ex) => ex !== null)
        console.log(`✅ [BackgroundSync] ${validExchanges.length} exchanges válidas após decriptação`)

        if (validExchanges.length === 0) {
          console.error('❌ [BackgroundSync] Nenhuma exchange válida após decriptação')
          return null
        }

        // 3. Enviar para o trading-service processar
        console.log('📡 [BackgroundSync] Enviando POST /balances para API...')
        const response = await apiService.post<BalanceResponse>('/balances', {
          exchanges: validExchanges,
        })

        console.log('✅ [BackgroundSync] Resposta recebida da API:', response.data ? 'COM DADOS' : 'SEM DADOS')
        
        // Retorna os dados para quem chamou
        return response.data

      } catch (error: any) {
        console.error('❌ [BackgroundSync] Erro no sync:', error)
        console.error('❌ [BackgroundSync] Stack:', error.stack)

        // Retry com backoff exponencial (apenas se não for erro de auth)
        if (error?.response?.status !== 401) {
          console.log('⏰ [BackgroundSync] Agendando retry em 30s...')
          setTimeout(() => this.syncNow(effectiveUserId), 30000)
        }
        
        throw error // Propaga o erro para quem chamou
      } finally {
        // ✨ Limpa o estado após conclusão (sucesso ou erro)
        console.log('🧹 [BackgroundSync] Finalizando sync, limpando estado...')
        this.isSyncing = false
        this.currentSyncPromise = null
      }
    })()

    // ✨ Retorna a promise armazenada
    return this.currentSyncPromise
  }
}

export const backgroundSyncService = new BackgroundSyncService()
