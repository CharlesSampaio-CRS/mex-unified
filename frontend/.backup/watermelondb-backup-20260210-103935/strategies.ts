import { config } from "@/lib/config"
import { secureStorage } from "@/lib/secure-storage"

const API_BASE_URL = config.apiBaseUrl

// Helper para obter o token de autenticação
async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    const token = await secureStorage.getItemAsync('access_token')
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    }
  } catch (error) {
    
  }
  return {
    'Content-Type': 'application/json',
  }
}

export interface Strategy {
  _id?: string  // MongoDB format
  id?: string   // Alternative format from API
  user_id: string
  exchange_id: string
  exchange_name?: string
  token: string
  template?: "simple" | "conservative" | "aggressive"
  rules?: {
    take_profit_levels?: Array<{ percent: number; sell_percent: number }>
    stop_loss?: { percent: number; enabled: boolean }
    buy_dip?: { enabled: boolean; percent?: number }
    trailing_stop?: { enabled: boolean; activation?: number; distance?: number }
    max_daily_loss?: { enabled: boolean; amount?: number }
  }
  // Legacy fields
  take_profit_percent?: number
  stop_loss_percent?: number
  buy_dip_percent?: number
  is_active: boolean
  created_at: string
  updated_at: string
  execution_history?: Array<{
    timestamp: string
    action: string
    reason: string
    price: number
    amount: number
    pnl_usd: number
  }>
}

export interface CreateStrategyRequest {
  user_id: string
  exchange_id: string
  token: string
  template: "simple" | "conservative" | "aggressive"
  is_active?: boolean
}

export interface CreateStrategyLegacyRequest {
  user_id: string
  exchange_id: string
  token: string
  take_profit_percent: number
  stop_loss_percent: number
  buy_dip_percent?: number
  is_active?: boolean
}

export interface UpdateStrategyRequest {
  take_profit_percent?: number
  stop_loss_percent?: number
  buy_dip_percent?: number
  is_active?: boolean
}

export interface CheckTriggerRequest {
  current_price: number
  entry_price: number
}

export interface CheckTriggerResponse {
  should_trigger: boolean
  action: "SELL" | null
  reason: "TAKE_PROFIT" | "STOP_LOSS" | null
  trigger_percent: number | null
  current_change_percent: number
  strategy: Strategy
}

export interface StrategyStats {
  total_executions: number
  total_buys: number
  total_sells: number
  last_execution_at: string | null
  last_execution_type: "BUY" | "SELL" | null
  last_execution_reason: string | null
  last_execution_price: number | null
  last_execution_amount: number | null
  total_pnl_usd: number
  daily_pnl_usd: number
  weekly_pnl_usd: number
  monthly_pnl_usd: number
  win_rate: number
  avg_profit_per_trade: number
}

export interface StrategyStatsResponse {
  success: boolean
  stats: StrategyStats
  strategy_info: {
    _id?: string
    id?: string
    token: string
    exchange_name: string
    is_active: boolean
    created_at: string
  }
  from_cache: boolean
}

class StrategiesService {
  /**
   * Cria uma nova estratégia usando template (RECOMENDADO)
   */
  async createStrategy(data: CreateStrategyRequest): Promise<Strategy> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/strategies`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("❌ Erro na resposta da API:", error)
      throw new Error(error.error || "Failed to create strategy")
    }

    const result = await response.json()
    return result.strategy
  }

  /**
   * Cria estratégia usando modo legado (DEPRECATED)
   */
  async createStrategyLegacy(data: CreateStrategyLegacyRequest): Promise<Strategy> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/strategies`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to create strategy")
    }

    const result = await response.json()
    return result.strategy
  }

  /**
   * Lista todas as estratégias de um usuário com filtros opcionais
   */
  async getUserStrategies(
    userId: string,
    filters?: {
      exchange_id?: string
      token?: string
      is_active?: boolean
      force_refresh?: boolean
    }
  ): Promise<Strategy[]> {
    const params = new URLSearchParams({ user_id: userId })
    
    if (filters?.exchange_id) params.append("exchange_id", filters.exchange_id)
    if (filters?.token) params.append("token", filters.token)
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active))
    if (filters?.force_refresh) params.append("force_refresh", "true")

    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/strategies?${params.toString()}`, {
      headers
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch strategies")
    }

    const result = await response.json()
    return result.strategies || []
  }

  /**
   * Busca uma estratégia específica por ID
   */
  async getStrategy(strategyId: string, forceRefresh: boolean = false): Promise<Strategy> {
    let url = `${API_BASE_URL}/strategies/${strategyId}`
    if (forceRefresh) {
      url += '?force_refresh=true'
    }

    const headers = await getAuthHeaders()
    const response = await fetch(url, { headers })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch strategy")
    }

    const result = await response.json()
    return result.strategy
  }

  /**
   * Atualiza uma estratégia existente
   */
  async updateStrategy(strategyId: string, data: UpdateStrategyRequest): Promise<Strategy> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/strategies/${strategyId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to update strategy")
    }

    const result = await response.json()
    return result.strategy
  }

  /**
   * Deleta uma estratégia
   */
  async deleteStrategy(strategyId: string, userId?: string): Promise<void> {
    let url = `${API_BASE_URL}/strategies/${strategyId}`
    
    // Se userId for fornecido, adiciona como query parameter
    if (userId) {
      url += `?user_id=${userId}`
    }
    
    const headers = await getAuthHeaders()
    const response = await fetch(url, {
      method: "DELETE",
      headers
    })

    if (!response.ok) {
      let errorMessage = "Failed to delete strategy"
      try {
        const error = await response.json()
        errorMessage = error.error || error.message || errorMessage
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }
      console.error("❌ Delete failed:", errorMessage)
      throw new Error(errorMessage)
    }
  }

  /**
   * Verifica se uma estratégia deve ser acionada
   */
  async checkTrigger(strategyId: string, data: CheckTriggerRequest): Promise<CheckTriggerResponse> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/strategies/${strategyId}/check`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to check trigger")
    }

    return await response.json()
  }

  /**
   * Busca estatísticas de execução de uma estratégia
   */
  async getStrategyStats(
    strategyId: string,
    userId: string,
    forceRefresh: boolean = false
  ): Promise<StrategyStatsResponse> {
    const params = new URLSearchParams({ user_id: userId })
    if (forceRefresh) {
      params.append("force_refresh", "true")
    }

    const headers = await getAuthHeaders()
    const url = `${API_BASE_URL}/strategies/${strategyId}/stats?${params.toString()}`
    const response = await fetch(url, { headers })

    if (!response.ok) {
      let errorMessage = "Failed to fetch strategy stats"
      try {
        const error = await response.json()
        errorMessage = error.error || error.message || errorMessage
      } catch (e) {
        // Se não conseguir parsear JSON, usa o status
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }
      
      // Apenas loga erro se não for 404 (estratégia nova sem stats ainda)
      if (response.status !== 404) {
        console.error(`❌ Error fetching stats for strategy ${strategyId}:`, errorMessage)
      }
      
      throw new Error(errorMessage)
    }

    return await response.json()
  }

  /**
   * Busca todas as execuções do usuário (agregadas de todas as estratégias)
   * Nota: A API não tem endpoint específico para execuções, então buscamos
   * a última execução de cada estratégia via stats
   * @param skipStrategyIds - IDs de estratégias para pular (ex: recém-criadas)
   */
  async getUserExecutions(userId: string, skipStrategyIds: Set<string> = new Set()): Promise<Execution[]> {
    try {
      // Primeiro busca todas as estratégias do usuário
      const strategies = await this.getUserStrategies(userId)
      
      // Para cada estratégia, busca o execution_history completo
      const executionsPromises = strategies.flatMap(async (strategy) => {
        const strategyId = strategy._id || strategy.id
        if (!strategyId) return []
        
        // Pula estratégias recém-criadas (sem stats ainda)
        if (skipStrategyIds.has(strategyId)) {
          return []
        }

        try {
          // Busca a estratégia completa com execution_history
          const strategyDetails = await this.getStrategy(strategyId, true) // force refresh para pegar dados atualizados
          
          // Se não tem execution_history, retorna vazio
          if (!strategyDetails.execution_history || strategyDetails.execution_history.length === 0) {
            return []
          }

          // Converte cada item do execution_history para Execution
          return strategyDetails.execution_history.map((exec: any, index: number): Execution => {
            // Determina o tipo baseado na action
            let type: "buy" | "sell" | "check" | "buy_failed" | "sell_failed" = "check"
            let status: "success" | "failed" | "check" = "check"
            
            if (exec.action === "BUY") {
              type = "buy"
              status = "success"
            } else if (exec.action === "SELL") {
              type = "sell"
              status = "success"
            } else if (exec.action === "BUY_FAILED") {
              type = "buy_failed"
              status = "failed"
            } else if (exec.action === "SELL_FAILED") {
              type = "sell_failed"
              status = "failed"
            } else if (exec.action === "CHECK") {
              type = "check"
              status = "check"
            }

            return {
              id: `${strategyId}_${exec.timestamp || index}`,
              strategyId: strategyId,
              strategyName: `${strategy.template || 'Custom'} - ${strategy.token}`,
              type,
              exchange: strategy.exchange_name || "Unknown",
              token: strategy.token,
              amount: exec.amount || 0,
              price: exec.price || 0,
              total: (exec.amount || 0) * (exec.price || 0),
              status,
              executedAt: exec.timestamp ? new Date(exec.timestamp) : new Date(),
              message: exec.reason || undefined,
              pnl_usd: exec.pnl_usd
            }
          })
        } catch (error: any) {
          // Apenas loga se não for erro 404 (estratégia nova sem execuções)
          const errorMsg = error.message || ''
          const is404 = errorMsg.includes('404') || errorMsg.includes('Not Found')
          
          return []
        }
      })

      const executionsNested = await Promise.all(executionsPromises)
      const executions = executionsNested.flat()
      
      // Ordena por data (mais recente primeiro)
      return executions.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
    } catch (error) {
      console.error("Error loading user executions:", error)
      return []
    }
  }

  /**
   * Formata estratégia para exibição no frontend
   */
  formatStrategyDisplay(strategy: Strategy): {
    name: string
    type: string
    conditions: string
  } {
    const template = strategy.template || "custom"
    const templateNames = {
      simple: "Simple",
      conservative: "Conservative",
      aggressive: "Aggressive",
      custom: "Custom",
    }

    let conditions = ""
    
    if (strategy.rules?.take_profit_levels && strategy.rules.take_profit_levels.length > 0) {
      const tpLevels = strategy.rules.take_profit_levels
        .map(tp => `${tp.percent}%`)
        .join(", ")
      conditions = `TP: ${tpLevels}`
      
      if (strategy.rules.stop_loss?.enabled) {
        conditions += ` | SL: ${strategy.rules.stop_loss.percent}%`
      }
    } else if (strategy.take_profit_percent) {
      // Legacy format
      conditions = `TP: ${strategy.take_profit_percent}%`
      if (strategy.stop_loss_percent) {
        conditions += ` | SL: ${strategy.stop_loss_percent}%`
      }
    }

    return {
      name: `${templateNames[template as keyof typeof templateNames]} - ${strategy.token}`,
      type: template,
      conditions,
    }
  }
}

// Interface para Execution (matching StrategyScreen)
export interface Execution {
  id: string
  strategyId: string
  strategyName: string
  type: "buy" | "sell" | "check" | "buy_failed" | "sell_failed"
  exchange: string
  token: string
  amount: number
  price: number
  total: number
  status: "success" | "failed" | "pending" | "check"
  executedAt: Date
  message?: string
  pnl_usd?: number
}

export const strategiesService = new StrategiesService()
