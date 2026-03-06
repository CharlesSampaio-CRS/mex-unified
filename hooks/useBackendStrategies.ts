import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';

// ═══════════════════════════════════════════════════════════════════
// TYPES — Alinhados com backend Rust (modelo simplificado)
// ═══════════════════════════════════════════════════════════════════

export type StrategyStatus =
  | 'idle'
  | 'monitoring'
  | 'in_position'
  | 'gradual_selling'
  | 'completed'
  | 'stopped_out'
  | 'expired'
  | 'paused'
  | 'error'
  | 'archived';

export interface GradualLot {
  lot_number: number;
  sell_percent: number;
  executed: boolean;
  executed_at?: number;
  executed_price?: number;
  realized_pnl?: number;
}

export interface StrategyConfig {
  base_price: number;
  invested_amount?: number;
  take_profit_percent: number;
  stop_loss_enabled?: boolean;
  stop_loss_percent: number;
  gradual_take_percent: number;
  fee_percent: number;
  gradual_sell: boolean;
  gradual_lots: GradualLot[];
  timer_gradual_min: number;
  time_execution_min: number;
  /** DCA (Dollar Cost Averaging) — compra mais quando o preço cai */
  dca_enabled?: boolean;
  /** Valor em USD para cada compra DCA (ex: 36 = comprar +$36) */
  dca_buy_amount_usd?: number;
  /** Queda % do preço médio para acionar DCA (ex: 5 = -5%) */
  dca_trigger_percent?: number;
  /** Máximo de compras DCA extras */
  dca_max_buys?: number;
  /** Auto Buy Dip — compra automática na queda (SEM posição aberta) */
  auto_buy_dip_enabled?: boolean;
  /** Queda % do base_price para acionar compra (ex: 5 = -5%) */
  auto_buy_dip_percent?: number;
  /** Valor em USDT de cada compra */
  auto_buy_dip_amount_usd?: number;
  /** Máximo de compras automáticas */
  auto_buy_dip_max_buys?: number;
}

export type ExecutionAction =
  | 'buy'
  | 'sell'
  | 'buy_failed'
  | 'sell_failed';

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
  source?: 'system' | 'user';
}

export type SignalType =
  | 'take_profit'
  | 'stop_loss'
  | 'gradual_sell'
  | 'dca_buy'
  | 'buy_dip'
  | 'expired'
  | 'info';

export interface StrategySignal {
  signal_type: SignalType;
  price: number;
  message: string;
  acted: boolean;
  price_change_percent: number;
  created_at: number;
  source?: 'system' | 'user';
}

export interface PositionInfo {
  entry_price: number;
  quantity: number;
  total_cost: number;
  current_price: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  highest_price: number;
  opened_at: number;
}

export interface Strategy {
  id: string;
  name: string;
  symbol: string;
  exchange_id: string;
  exchange_name: string;
  is_active: boolean;
  status: StrategyStatus;
  config: StrategyConfig;
  trigger_price: number;
  stop_loss_price: number;
  position?: PositionInfo;
  last_checked_at?: number;
  last_price?: number;
  error_message?: string;
  total_pnl_usd: number;
  total_executions: number;
  dca_buys_done?: number;
  buy_dip_buys_done?: number;
  deleted_at?: number;
  started_at: number;
  created_at: number;
  updated_at: number;
}

export interface StrategyDetail extends Strategy {
  executions: StrategyExecution[];
  signals: StrategySignal[];
  stats?: StrategyStatsResponse;
}

export interface StrategyStatsResponse {
  total_executions: number;
  total_sells: number;
  total_pnl_usd: number;
  total_fees: number;
  win_rate: number;
  current_position?: PositionInfo;
}

export interface CreateStrategyRequest {
  name: string;
  symbol: string;
  exchange_id: string;
  exchange_name: string;
  config: StrategyConfig;
}

export interface UpdateStrategyRequest {
  name?: string;
  symbol?: string;
  exchange_id?: string;
  exchange_name?: string;
  is_active?: boolean;
  config?: Partial<StrategyConfig>;
}

interface UseBackendStrategiesReturn {
  strategies: Strategy[];
  archivedStrategies: Strategy[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  
  loadStrategies: () => Promise<void>;
  loadHistory: () => Promise<void>;
  createStrategy: (data: CreateStrategyRequest) => Promise<Strategy>;
  updateStrategy: (id: string, data: UpdateStrategyRequest) => Promise<Strategy>;
  deleteStrategy: (id: string) => Promise<void>;
  toggleActive: (id: string, isActive: boolean) => Promise<Strategy>;
  
  /** Estratégias que tiveram novas execuções desde o último load */
  newExecutions: Array<{ strategyId: string; strategyName: string; symbol: string; prevCount: number; newCount: number }>;
  clearNewExecutions: () => void;

  activeStrategies: Strategy[];
  inactiveStrategies: Strategy[];
  filterByExchange: (exchangeId: string) => Strategy[];
  filterBySymbol: (symbol: string) => Strategy[];
}

export const useBackendStrategies = (autoLoad: boolean = true): UseBackendStrategiesReturn => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [archivedStrategies, setArchivedStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [newExecutions, setNewExecutions] = useState<Array<{ strategyId: string; strategyName: string; symbol: string; prevCount: number; newCount: number }>>([]);

  // Ref para guardar contagem de execuções anterior (por estratégia)
  const prevExecutionCountsRef = useRef<Record<string, number>>({});

  const clearNewExecutions = useCallback(() => setNewExecutions([]), []);

  const loadStrategies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 [useBackendStrategies] Carregando estratégias...');
      const response = await apiService.listStrategies();
      const data: Strategy[] = response.data.strategies || [];
      
      // ── Detectar novas execuções ──
      const prevCounts = prevExecutionCountsRef.current;
      const detected: Array<{ strategyId: string; strategyName: string; symbol: string; prevCount: number; newCount: number }> = [];

      for (const s of data) {
        const prev = prevCounts[s.id];
        if (prev !== undefined && s.total_executions > prev) {
          detected.push({
            strategyId: s.id,
            strategyName: s.name,
            symbol: s.symbol,
            prevCount: prev,
            newCount: s.total_executions,
          });
        }
      }

      // Atualiza ref com contagens atuais
      const newCounts: Record<string, number> = {};
      for (const s of data) {
        newCounts[s.id] = s.total_executions;
      }
      prevExecutionCountsRef.current = newCounts;

      if (detected.length > 0) {
        console.log(`🔔 [useBackendStrategies] ${detected.length} novas execuções detectadas`);
        setNewExecutions(detected);
      }

      setStrategies(data);
      console.log(`✅ [useBackendStrategies] ${data.length} estratégias carregadas`);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar estratégias';
      console.warn('❌ [useBackendStrategies] Erro:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      console.log('🔄 [useBackendStrategies] Carregando histórico...');
      const response = await apiService.listStrategiesHistory();
      const data = response.data.strategies || [];
      setArchivedStrategies(data);
      console.log(`✅ [useBackendStrategies] ${data.length} estratégias arquivadas`);
    } catch (err: any) {
      console.warn('❌ [useBackendStrategies] Erro histórico:', err.message);
    }
  }, []);

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
      console.warn('❌ [useBackendStrategies] Erro ao criar:', errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, []);

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
      console.warn(`❌ [useBackendStrategies] Erro ao atualizar ${id}:`, errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, []);

  const deleteStrategy = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      console.log(`🔄 [useBackendStrategies] Arquivando estratégia ${id}`);
      
      await apiService.deleteStrategy(id);
      
      // Remove a estratégia da lista ativa (agora está arquivada no backend)
      setStrategies(prev => prev.filter(s => s.id !== id));
      
      console.log('✅ [useBackendStrategies] Estratégia arquivada:', id);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao arquivar estratégia';
      console.warn(`❌ [useBackendStrategies] Erro ao arquivar ${id}:`, errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, []);

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
      console.warn(`❌ [useBackendStrategies] Erro ao alternar ${id}:`, errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, []);

  const activeStrategies = strategies.filter(s => s.is_active);
  const inactiveStrategies = strategies.filter(s => !s.is_active);

  const filterByExchange = useCallback((exchangeId: string): Strategy[] => {
    return strategies.filter(s => s.exchange_id === exchangeId);
  }, [strategies]);

  const filterBySymbol = useCallback((symbol: string): Strategy[] => {
    return strategies.filter(s => 
      s.symbol.toLowerCase().includes(symbol.toLowerCase())
    );
  }, [strategies]);

  useEffect(() => {
    if (autoLoad) {
      loadStrategies();
    }
  }, [autoLoad, loadStrategies]);

  return {
    strategies,
    archivedStrategies,
    loading,
    error,
    refreshing,
    
    // CRUD Operations
    loadStrategies,
    loadHistory,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    toggleActive,

    // Execution detection
    newExecutions,
    clearNewExecutions,
    
    // Filters
    activeStrategies,
    inactiveStrategies,
    filterByExchange,
    filterBySymbol,
  };
};

export default useBackendStrategies;
