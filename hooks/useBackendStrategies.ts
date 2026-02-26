import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

// ═══════════════════════════════════════════════════════════════════
// TYPES — Alinhados com backend Rust (Fases 2-5)
// ═══════════════════════════════════════════════════════════════════

export type StrategyStatus =
  | 'idle'
  | 'monitoring'
  | 'buy_pending'
  | 'in_position'
  | 'sell_pending'
  | 'paused'
  | 'completed'
  | 'error';

export interface TakeProfitLevel {
  percent: number;
  sell_percent: number;
  executed: boolean;
  executed_at?: number;
}

export interface StopLossConfig {
  enabled: boolean;
  percent: number;
  trailing: boolean;
  trailing_distance?: number;
  highest_price?: number;
}

export interface DcaConfig {
  enabled: boolean;
  interval_seconds?: number;
  amount_per_buy?: number;
  max_buys?: number;
  buys_done: number;
  dip_percent?: number;
}

export interface GridConfig {
  enabled: boolean;
  levels?: number;
  spacing_percent?: number;
  center_price?: number;
}

export interface StrategyConfig {
  take_profit_levels: TakeProfitLevel[];
  stop_loss?: StopLossConfig;
  dca?: DcaConfig;
  grid?: GridConfig;
  min_investment?: number;
  max_daily_operations?: number;
  auto_close_time?: number;
  mode: string;
}

export type ExecutionAction =
  | 'buy'
  | 'sell'
  | 'buy_failed'
  | 'sell_failed'
  | 'dca_buy'
  | 'grid_buy'
  | 'grid_sell';

export interface StrategyExecution {
  execution_id: string;
  action: ExecutionAction;
  reason: string;
  price: number;
  amount: number;
  total: number;
  fee: number;
  pnl_usd: number;
  exchange_order_id?: string;
  executed_at: number;
  error_message?: string;
}

export type SignalType =
  | 'buy'
  | 'take_profit'
  | 'stop_loss'
  | 'trailing_stop'
  | 'dca_buy'
  | 'grid_trade'
  | 'info'
  | 'price_alert';

export interface StrategySignal {
  signal_type: SignalType;
  price: number;
  message: string;
  acted: boolean;
  price_change_percent: number;
  created_at: number;
}

export interface PositionInfo {
  entry_price: number;
  quantity: number;
  total_cost: number;
  current_price: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  highest_price: number;
  lowest_price: number;
  opened_at: number;
}

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

  // Phase 2-5 fields
  status: StrategyStatus;
  config: StrategyConfig;
  position?: PositionInfo;
  executions_count: number;
  signals_count: number;
  last_checked_at?: number;
  last_price?: number;
  check_interval_secs: number;
  error_message?: string;
  total_pnl_usd: number;
  total_executions: number;

  created_at: number;
  updated_at: number;
}

/** Full detail response (includes executions + signals arrays) */
export interface StrategyDetail extends Strategy {
  executions: StrategyExecution[];
  signals: StrategySignal[];
  stats?: StrategyStatsResponse;
}

export interface StrategyStatsResponse {
  total_executions: number;
  total_buys: number;
  total_sells: number;
  total_pnl_usd: number;
  win_rate: number;
  avg_profit_per_trade: number;
  total_fees: number;
  last_execution_at?: number;
  last_signal_at?: number;
  days_active: number;
  current_position?: PositionInfo;
}

export interface CreateStrategyRequest {
  exchange_id: string;
  exchange_name: string;
  symbol: string;
  strategy_type: string;
  name?: string;
  description?: string;
  config?: Partial<StrategyConfig>;
  check_interval_secs?: number;
}

export interface UpdateStrategyRequest {
  name?: string;
  description?: string;
  strategy_type?: string;
  symbol?: string;
  exchange_id?: string;
  exchange_name?: string;
  is_active?: boolean;
  status?: StrategyStatus;
  config?: Partial<StrategyConfig>;
  check_interval_secs?: number;
}

interface UseBackendStrategiesReturn {
  strategies: Strategy[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  
  // CRUD Operations
  loadStrategies: () => Promise<void>;
  createStrategy: (data: CreateStrategyRequest) => Promise<Strategy>;
  updateStrategy: (id: string, data: UpdateStrategyRequest) => Promise<Strategy>;
  deleteStrategy: (id: string) => Promise<void>;
  toggleActive: (id: string, isActive: boolean) => Promise<Strategy>;
  
  // Filters
  activeStrategies: Strategy[];
  inactiveStrategies: Strategy[];
  filterByExchange: (exchangeId: string) => Strategy[];
  filterBySymbol: (symbol: string) => Strategy[];
  filterByType: (type: string) => Strategy[];
}

/**
 * 🎯 Hook para gerenciar estratégias do MongoDB
 * 
 * Fornece CRUD completo e filtros para estratégias de trading
 * 
 * @param autoLoad Se true, carrega estratégias automaticamente ao montar
 * @returns Objeto com estratégias, loading states e métodos CRUD
 * 
 * @example
 * ```tsx
 * const { strategies, loading, createStrategy } = useBackendStrategies(true);
 * 
 * const handleCreate = async () => {
 *   await createStrategy({
 *     name: "DCA Bitcoin",
 *     strategy_type: "dca",
 *     symbol: "BTC/USDT",
 *     exchange_id: "binance_123",
 *     exchange_name: "Binance",
 *     config: { interval: "1h", amount: 100 }
 *   });
 * };
 * ```
 */
export const useBackendStrategies = (autoLoad: boolean = true): UseBackendStrategiesReturn => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 📋 Carrega todas as estratégias do usuário
   */
  const loadStrategies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 [useBackendStrategies] Carregando estratégias...');
      const response = await apiService.listStrategies();
      const data = response.data.strategies || [];
      
      setStrategies(data);
      console.log(`✅ [useBackendStrategies] ${data.length} estratégias carregadas`);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar estratégias';
      console.error('❌ [useBackendStrategies] Erro:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * ➕ Cria nova estratégia
   */
  const createStrategy = useCallback(async (data: CreateStrategyRequest): Promise<Strategy> => {
    try {
      setError(null);
      console.log('🔄 [useBackendStrategies] Criando estratégia:', data);
      
      const response = await apiService.createStrategy(data);
      const newStrategy = response.data.strategy;
      
      // Adiciona a nova estratégia ao estado local
      setStrategies(prev => [newStrategy, ...prev]);
      
      console.log('✅ [useBackendStrategies] Estratégia criada:', newStrategy.id);
      return newStrategy;
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao criar estratégia';
      console.error('❌ [useBackendStrategies] Erro ao criar:', errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * ✏️ Atualiza estratégia existente
   */
  const updateStrategy = useCallback(async (id: string, data: UpdateStrategyRequest): Promise<Strategy> => {
    try {
      setError(null);
      console.log(`🔄 [useBackendStrategies] Atualizando estratégia ${id}:`, data);
      
      const response = await apiService.updateStrategy(id, data);
      const updatedStrategy = response.data.strategy;
      
      // Atualiza a estratégia no estado local
      setStrategies(prev => 
        prev.map(s => s.id === id ? updatedStrategy : s)
      );
      
      console.log('✅ [useBackendStrategies] Estratégia atualizada:', id);
      return updatedStrategy;
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao atualizar estratégia';
      console.error(`❌ [useBackendStrategies] Erro ao atualizar ${id}:`, errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * 🗑️ Deleta estratégia
   */
  const deleteStrategy = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      console.log(`🔄 [useBackendStrategies] Deletando estratégia ${id}`);
      
      await apiService.deleteStrategy(id);
      
      // Remove a estratégia do estado local
      setStrategies(prev => prev.filter(s => s.id !== id));
      
      console.log('✅ [useBackendStrategies] Estratégia deletada:', id);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao deletar estratégia';
      console.error(`❌ [useBackendStrategies] Erro ao deletar ${id}:`, errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * 🔄 Alterna status ativo/inativo (usa activate/pause endpoints)
   */
  const toggleActive = useCallback(async (id: string, isActive: boolean): Promise<Strategy> => {
    try {
      setError(null);
      console.log(`🔄 [useBackendStrategies] ${isActive ? 'Activating' : 'Pausing'} estratégia ${id}`);
      
      const response = isActive
        ? await apiService.activateStrategy(id)
        : await apiService.pauseStrategy(id);
      const updatedStrategy = response.data.strategy || response.data;
      
      // Atualiza no estado local
      setStrategies(prev => 
        prev.map(s => s.id === id ? updatedStrategy : s)
      );
      
      console.log(`✅ [useBackendStrategies] Status alterado: ${id} -> ${isActive ? 'ativa' : 'pausa'}`);
      return updatedStrategy;
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao alternar status';
      console.error(`❌ [useBackendStrategies] Erro ao alternar ${id}:`, errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * 🎯 Filtra estratégias ativas
   */
  const activeStrategies = strategies.filter(s => s.is_active);

  /**
   * 💤 Filtra estratégias inativas
   */
  const inactiveStrategies = strategies.filter(s => !s.is_active);

  /**
   * 📊 Filtra por exchange
   */
  const filterByExchange = useCallback((exchangeId: string): Strategy[] => {
    return strategies.filter(s => s.exchange_id === exchangeId);
  }, [strategies]);

  /**
   * 🔤 Filtra por símbolo
   */
  const filterBySymbol = useCallback((symbol: string): Strategy[] => {
    return strategies.filter(s => 
      s.symbol.toLowerCase().includes(symbol.toLowerCase())
    );
  }, [strategies]);

  /**
   * 🏷️ Filtra por tipo
   */
  const filterByType = useCallback((type: string): Strategy[] => {
    return strategies.filter(s => s.strategy_type === type);
  }, [strategies]);

  /**
   * 🚀 Auto-load ao montar componente
   */
  useEffect(() => {
    if (autoLoad) {
      loadStrategies();
    }
  }, [autoLoad, loadStrategies]);

  return {
    strategies,
    loading,
    error,
    refreshing,
    
    // CRUD Operations
    loadStrategies,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    toggleActive,
    
    // Filters
    activeStrategies,
    inactiveStrategies,
    filterByExchange,
    filterBySymbol,
    filterByType,
  };
};

export default useBackendStrategies;
