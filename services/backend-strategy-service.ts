import api from './api';

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  strategy_type: string;
  symbol: string;
  exchange_id: string;
  exchange_name: string;
  is_active: boolean;
  config: Record<string, any>;
  created_at: number;
  updated_at: number;
}

export interface CreateStrategyRequest {
  name: string;
  description?: string;
  strategy_type: string;
  symbol: string;
  exchange_id: string;
  exchange_name: string;
  config: Record<string, any>;
}

export interface UpdateStrategyRequest {
  name?: string;
  description?: string;
  strategy_type?: string;
  symbol?: string;
  exchange_id?: string;
  exchange_name?: string;
  is_active?: boolean;
  config?: Record<string, any>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface GetStrategiesResponse {
  success: boolean;
  strategies: Strategy[];
  total: number;
  error?: string;
}

interface GetStrategyResponse {
  success: boolean;
  strategy: Strategy;
  error?: string;
}

interface CreateStrategyResponse {
  success: boolean;
  strategy: Strategy;
  error?: string;
}

interface UpdateStrategyResponse {
  success: boolean;
  strategy: Strategy;
  error?: string;
}

interface DeleteStrategyResponse {
  success: boolean;
  message: string;
  error?: string;
}

class BackendStrategyService {
  private readonly baseUrl = '/api/v1/strategies';

  /**
   * 📋 Lista todas as estratégias do usuário autenticado
   */
  async getStrategies(): Promise<Strategy[]> {
    try {
      const response = await api.get<GetStrategiesResponse>(this.baseUrl);
      
      if (response.data.success) {
        return response.data.strategies;
      }
      
      throw new Error(response.data.error || 'Failed to fetch strategies');
    } catch (error: any) {
      console.error('❌ [BackendStrategyService] Error fetching strategies:', error);
      throw error;
    }
  }

  /**
   * 🔍 Busca uma estratégia específica por ID
   */
  async getStrategy(strategyId: string): Promise<Strategy> {
    try {
      const response = await api.get<GetStrategyResponse>(`${this.baseUrl}/${strategyId}`);
      
      if (response.data.success) {
        return response.data.strategy;
      }
      
      throw new Error(response.data.error || 'Failed to fetch strategy');
    } catch (error: any) {
      console.error(`❌ [BackendStrategyService] Error fetching strategy ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * ➕ Cria uma nova estratégia
   */
  async createStrategy(data: CreateStrategyRequest): Promise<Strategy> {
    try {
      console.log('🔄 [BackendStrategyService] Creating strategy:', data);
      
      const response = await api.post<CreateStrategyResponse>(this.baseUrl, data);
      
      if (response.data.success) {
        console.log('✅ [BackendStrategyService] Strategy created successfully:', response.data.strategy);
        return response.data.strategy;
      }
      
      throw new Error(response.data.error || 'Failed to create strategy');
    } catch (error: any) {
      console.error('❌ [BackendStrategyService] Error creating strategy:', error);
      throw error;
    }
  }

  /**
   * ✏️ Atualiza uma estratégia existente
   */
  async updateStrategy(strategyId: string, data: UpdateStrategyRequest): Promise<Strategy> {
    try {
      console.log(`🔄 [BackendStrategyService] Updating strategy ${strategyId}:`, data);
      
      const response = await api.put<UpdateStrategyResponse>(`${this.baseUrl}/${strategyId}`, data);
      
      if (response.data.success) {
        console.log('✅ [BackendStrategyService] Strategy updated successfully:', response.data.strategy);
        return response.data.strategy;
      }
      
      throw new Error(response.data.error || 'Failed to update strategy');
    } catch (error: any) {
      console.error(`❌ [BackendStrategyService] Error updating strategy ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * 🗑️ Deleta uma estratégia
   */
  async deleteStrategy(strategyId: string): Promise<void> {
    try {
      console.log(`🔄 [BackendStrategyService] Deleting strategy ${strategyId}`);
      
      const response = await api.delete<DeleteStrategyResponse>(`${this.baseUrl}/${strategyId}`);
      
      if (response.data.success) {
        console.log(`✅ [BackendStrategyService] Strategy ${strategyId} deleted successfully`);
        return;
      }
      
      throw new Error(response.data.error || 'Failed to delete strategy');
    } catch (error: any) {
      console.error(`❌ [BackendStrategyService] Error deleting strategy ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * 🔄 Alterna o status ativo/inativo de uma estratégia
   */
  async toggleActive(strategyId: string, isActive: boolean): Promise<Strategy> {
    try {
      console.log(`🔄 [BackendStrategyService] Toggling strategy ${strategyId} to ${isActive ? 'active' : 'inactive'}`);
      
      return await this.updateStrategy(strategyId, { is_active: isActive });
    } catch (error: any) {
      console.error(`❌ [BackendStrategyService] Error toggling strategy ${strategyId}:`, error);
      throw error;
    }
  }

  /**
   * 📊 Filtra estratégias por exchange
   */
  filterByExchange(strategies: Strategy[], exchangeId: string): Strategy[] {
    return strategies.filter(s => s.exchange_id === exchangeId);
  }

  /**
   * 🎯 Filtra estratégias ativas
   */
  getActiveStrategies(strategies: Strategy[]): Strategy[] {
    return strategies.filter(s => s.is_active);
  }

  /**
   * 💤 Filtra estratégias inativas
   */
  getInactiveStrategies(strategies: Strategy[]): Strategy[] {
    return strategies.filter(s => !s.is_active);
  }

  /**
   * 🔤 Filtra estratégias por símbolo (par de trading)
   */
  filterBySymbol(strategies: Strategy[], symbol: string): Strategy[] {
    return strategies.filter(s => s.symbol.toLowerCase() === symbol.toLowerCase());
  }

  /**
   * 🏷️ Filtra estratégias por tipo
   */
  filterByType(strategies: Strategy[], type: string): Strategy[] {
    return strategies.filter(s => s.strategy_type === type);
  }
}

export const backendStrategyService = new BackendStrategyService();
export default backendStrategyService;
