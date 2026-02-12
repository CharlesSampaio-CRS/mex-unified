import { database, ensureDatabaseInitialized } from '@/lib/watermelon/database';
import { Q } from '@nozbe/watermelondb';
import { decryptData } from '@/lib/encryption';
import { apiService } from './api';
import { BalanceResponse } from '@/types/api';

class BackgroundSyncService {
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private userId: string | null = null;
  private currentSyncPromise: Promise<BalanceResponse | null> | null = null; // ✨ Nova: Promise em andamento

  /**
   * Inicia o sync automático a cada 5 minutos
   */
  async start(userId: string) {
    if (this.syncInterval) {
      return;
    }

    this.userId = userId;

    // Sync imediato ao iniciar
    await this.syncNow();

    // Depois a cada 5 minutos
    this.syncInterval = setInterval(() => {
      this.syncNow();
    }, 5 * 60 * 1000); // 5 minutos
  }

  /**
   * Para o sync automático
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.userId = null;
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
    const effectiveUserId = userId || this.userId;

    // ✨ Se já está sincronizando, retorna a promise em andamento
    if (this.isSyncing && this.currentSyncPromise) {
      return this.currentSyncPromise;
    }

    if (!effectiveUserId) {
      console.error('❌ userId não definido, não é possível fazer sync');
      return null;
    }

    // ✨ Marca como sincronizando ANTES de criar a promise
    this.isSyncing = true;

    // ✨ Cria e armazena a promise
    this.currentSyncPromise = (async () => {
      try {
        // 0. Garantir que o database está inicializado
        await ensureDatabaseInitialized();
        
        // Verificar se database está realmente disponível
        if (!database) {
          throw new Error('Database não inicializado mesmo após ensureDatabaseInitialized()');
        }

        // 1. Buscar exchanges do WatermelonDB
        const exchangesCollection = database.get('user_exchanges');
        
        if (!exchangesCollection) {
          throw new Error('Collection "user_exchanges" não encontrada no database');
        }
        
        const exchanges = await exchangesCollection
          .query(Q.where('user_id', effectiveUserId))
          .fetch();

        if (exchanges.length === 0) {
          return null;
        }

        // 2. Decriptar credenciais
        const exchangesData = await Promise.all(
          exchanges.map(async (ex: any) => {
            try {
              const apiKey = await decryptData(ex.apiKeyEncrypted, effectiveUserId);
              const apiSecret = await decryptData(ex.apiSecretEncrypted, effectiveUserId);
              const passphrase = ex.apiPassphraseEncrypted
                ? await decryptData(ex.apiPassphraseEncrypted, effectiveUserId)
                : undefined;

              return {
                exchange_id: ex.id,
                ccxt_id: ex.exchangeType,
                name: ex.exchangeName,
                api_key: apiKey,
                api_secret: apiSecret,
                passphrase,
              };
            } catch (error) {
              console.error(`❌ Erro ao decriptar exchange ${ex.exchangeName}:`, error);
              return null;
            }
          })
        );

        // Filtrar exchanges com erro de decriptação
        const validExchanges = exchangesData.filter((ex) => ex !== null);

        if (validExchanges.length === 0) {
          console.error('❌ Nenhuma exchange válida após decriptação');
          return null;
        }

        // 3. Enviar para o trading-service processar
        const response = await apiService.post<BalanceResponse>('/balances', {
          exchanges: validExchanges,
        });

        // Retorna os dados para quem chamou
        return response.data;

      } catch (error: any) {
        console.error('❌ Erro no sync:', error);

        // Retry com backoff exponencial (apenas se não for erro de auth)
        if (error?.response?.status !== 401) {
          setTimeout(() => this.syncNow(effectiveUserId), 30000);
        }
        
        throw error; // Propaga o erro para quem chamou
      } finally {
        // ✨ Limpa o estado após conclusão (sucesso ou erro)
        this.isSyncing = false;
        this.currentSyncPromise = null;
      }
    })();

    // ✨ Retorna a promise armazenada
    return this.currentSyncPromise;
  }
}

export const backgroundSyncService = new BackgroundSyncService();
