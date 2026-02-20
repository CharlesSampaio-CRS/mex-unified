import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

// Types from backend API
export interface Strategy {
  id: string;
  user_id: string;
  exchange_id: string;
  exchange_name?: string;  // Optional: nome da exchange
  symbol: string;
  strategy_type: string;
  is_active: boolean;
  buy_price?: number;
  sell_price?: number;
  stop_loss?: number;
  take_profit?: number;
  amount?: number;
  name?: string;  // Optional: nome da estratégia
  description?: string;
  config?: any;  // Optional: configuração adicional
  created_at: string;
  updated_at: string;
}

export interface CreateStrategyRequest {
  exchange_id: string;
  symbol: string;
  strategy_type: string;
  name?: string;
  description?: string;
  buy_price?: number;
  sell_price?: number;
  stop_loss?: number;
  take_profit?: number;
  amount?: number;
  config?: any;
}

export interface UpdateStrategyRequest {
  is_active?: boolean;
  buy_price?: number;
  sell_price?: number;
  stop_loss?: number;
  take_profit?: number;
  amount?: number;
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
   * 🔄 Alterna status ativo/inativo
   */
  const toggleActive = useCallback(async (id: string, isActive: boolean): Promise<Strategy> => {
    try {
      setError(null);
      console.log(`🔄 [useBackendStrategies] Alternando status da estratégia ${id} para ${isActive ? 'ativa' : 'inativa'}`);
      
      const response = await apiService.toggleStrategy(id, isActive);
      const updatedStrategy = response.data.strategy;
      
      // Atualiza no estado local
      setStrategies(prev => 
        prev.map(s => s.id === id ? updatedStrategy : s)
      );
      
      console.log(`✅ [useBackendStrategies] Status alterado: ${id} -> ${isActive ? 'ativa' : 'inativa'}`);
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
