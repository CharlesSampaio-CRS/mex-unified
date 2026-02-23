import { BalanceResponse, AvailableExchangesResponse, LinkedExchangesResponse, PortfolioEvolutionResponse, DailyPnlResponse } from '@/types/api';
import { config } from '@/lib/config';
import { decryptData } from '@/lib/encryption';
import { curlLogger } from './curl-logger';
// ❌ CACHE DESABILITADO - Mocks que não fazem nada, sempre busca dados frescos
const cacheService = { 
  get: <T = any>(...args: any[]): T | null => null, 
  set: (...args: any[]) => {}, 
  delete: (...args: any[]) => {},
  invalidate: (...args: any[]) => {},
  getStats: () => ({ entries: 0, size: 0, hitRate: 0 })
};
const CacheService = {
  balanceKey: (...args: any[]) => '',
  balanceSummaryKey: (...args: any[]) => '',
  portfolioEvolutionKey: (...args: any[]) => '',
  dailyPnlKey: (...args: any[]) => '',
  availableExchangesKey: (...args: any[]) => '',
  linkedExchangesKey: (...args: any[]) => '',
  exchangeDetailsKey: (...args: any[]) => '',
};
const CACHE_TTL = { BALANCES: 0, PORTFOLIO: 0, EXCHANGES: 0, EXCHANGE_DETAILS: 0, TOKEN_DETAILS: 0, STRATEGIES: 0 };
import { secureStorage } from '@/lib/secure-storage';

const API_BASE_URL = config.apiBaseUrl;

interface LocalUserExchangeRow {
  id: string;
  user_id: string;
  exchange_name: string;
  exchange_type: string;
  api_key_encrypted: string;
  api_secret_encrypted: string;
  api_passphrase_encrypted?: string | null;
  is_active: number;
}

/**
 * Request timeout constants (in milliseconds)
 * Timeouts são configurados baseados na complexidade da operação
 * ⚡ OTIMIZADO: Timeouts mais agressivos para melhor UX
 */
const TIMEOUTS = {
  /** 5 seconds - Fast operations (single item fetch, token search) */
  FAST: 5000,
  
  /** 10 seconds - Standard operations (list exchanges, check availability) */
  STANDARD: 10000,
  
  /** 12 seconds - Normal operations (list with filters, token details, markets) */
  NORMAL: 12000,
  
  /** 20 seconds - Slow operations (create/update orders, complex calculations) */
  SLOW: 20000,
  
  /** 25 seconds - Balance sync with multiple exchanges (otimizado para MongoDB cache) */
  BALANCE_SYNC: 25000,
  
  /** 45 seconds - Very slow (cold start on Render, first request after idle) */
  VERY_SLOW: 45000,
  
  /** 90 seconds - Critical operations (full balance fetch with all exchanges/tokens) */
  CRITICAL: 90000,
} as const;

const MAX_RETRIES = 2;

// Helper para obter o token de autenticação
async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    const token = await secureStorage.getItemAsync('access_token');
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    }
  } catch (error) {
    // Failed to get auth token
  }
  return {
    'Content-Type': 'application/json',
  };
}

// Helper para adicionar timeout às requisições com retry
async function fetchWithTimeout(
  url: string, 
  options: RequestInit = {}, 
  timeout: number = TIMEOUTS.VERY_SLOW,
  retries = MAX_RETRIES
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const mergedOptions: RequestInit = {
    ...options,
    mode: 'cors',
    credentials: 'include',
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  };
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    
    try {
      // 📋 Log curl antes de fazer a requisição
      curlLogger.logRequest(
        mergedOptions.method || 'GET',
        url,
        mergedOptions.headers as Record<string, string>,
        mergedOptions.body
      );
      
      const fetchPromise = fetch(url, mergedOptions);
      const timeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
      );
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      return response;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error;
      }
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw error;
      }
    }
  }
  
  throw new Error('Failed after all retries');
}

async function buildExchangesPayload(userId: string) {
  try {
    // MongoDB-only: busca exchanges via API
    const response = await apiService.listExchanges();
    const exchanges = response.exchanges.filter((ex: any) => ex.is_active);

    if (!exchanges.length) return [];

    const exchangesData = await Promise.all(
      exchanges.map(async (ex: any) => {
        try {
          const apiKey = await decryptData(ex.api_key_encrypted, userId);
          const apiSecret = await decryptData(ex.api_secret_encrypted, userId);
          const passphrase = ex.api_passphrase_encrypted
            ? await decryptData(ex.api_passphrase_encrypted, userId)
            : undefined;

          return {
            exchange_id: ex.id,
            ccxt_id: ex.exchange_type,
            name: ex.exchange_name,
            api_key: apiKey,
            api_secret: apiSecret,
            passphrase,
          };
        } catch (error) {
          console.error(`❌ Erro ao decriptar exchange ${ex.exchange_name}:`, error);
          return null;
        }
      })
    );

    return exchangesData.filter((ex) => ex !== null);
  } catch (error) {
    console.error('❌ Falha ao montar exchanges locais:', error);
    return [];
  }
}

export const apiService = {
  /**
   * Busca os balances de todas as exchanges para um usuário
   * 🔐 NOVA VERSÃO: Prioriza endpoint seguro /balances/secure (sem credenciais)
   * Fallback: Tenta método antigo se o seguro falhar (compatibilidade)
   * 
   * @param userId ID do usuário
   * @param forceRefresh Se true, força atualização sem cache (cache: false no backend)
   * @returns Promise com os dados de balance
   */
  async getBalances(userId: string, forceRefresh: boolean = false): Promise<BalanceResponse> {
    // Consulta apenas o endpoint SEGURO (MongoDB)
    return await this.getBalancesSecure();
  },

  // ==================== 🔐 NOVA ARQUITETURA SEGURA ====================

  /**
   * 🔐 SECURE: Busca balances usando JWT (sem credenciais no body)
   * Endpoint: POST /balances/secure
   * Backend busca exchanges do MongoDB automaticamente
   */
  async getBalancesSecure(): Promise<BalanceResponse> {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/balances/secure`,
        {
          method: 'POST',
          cache: 'no-store'
        },
        TIMEOUTS.BALANCE_SYNC
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data: BalanceResponse = await response.json();
      return data;
    } catch (error) {
      console.error('❌ [API] Erro ao buscar balances (seguro):', error);
      throw error;
    }
  },

  /**
   * 🔐 SECURE: Busca orders usando JWT (sem credenciais no body)
   * Endpoint: POST /orders/fetch/secure
   * Backend busca exchanges do MongoDB automaticamente
   */
  async getOrdersSecure(): Promise<any> {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/orders/fetch/secure`,
        {
          method: 'POST',
          cache: 'no-store'
        },
        TIMEOUTS.SLOW
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ [API] Erro ao buscar orders (seguro):', error);
      throw error;
    }
  },

  // ==================== 📝 GERENCIAMENTO DE EXCHANGES (MongoDB) ====================

  /**
   * 📝 Adiciona nova exchange no MongoDB
   * Endpoint: POST /user/exchanges
   * Credenciais são criptografadas no backend
   */
  async addExchange(exchangeData: {
    exchange_type: string;
    api_key: string;
    api_secret: string;
    passphrase?: string;
  }): Promise<{ success: boolean; exchange_id: string; error?: string }> {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/user/exchanges`,
        {
          method: 'POST',
          body: JSON.stringify(exchangeData)
        },
        TIMEOUTS.STANDARD
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add exchange');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ [API] Erro ao adicionar exchange:', error);
      throw error;
    }
  },

  /**
   * 📋 Lista exchanges cadastradas (sem credenciais)
   * Endpoint: GET /user/exchanges
   */
  async listExchanges(): Promise<{
    success: boolean;
    exchanges: Array<{
      exchange_id: string;
      exchange_type: string;
      exchange_name: string;
      is_active: boolean;
      logo?: string;
      icon?: string;
      requires_passphrase?: boolean;
      created_at: string;
    }>;
    count: number;
  }> {
    try {
      console.log('📋 [API] Listando exchanges do usuário');
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/user/exchanges`,
        {
          method: 'GET',
          cache: 'no-store'
        },
        TIMEOUTS.STANDARD
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      console.log('✅ [API] Exchanges listadas:', data.count);

      return data;
    } catch (error) {
      console.error('❌ [API] Erro ao listar exchanges:', error);
      throw error;
    }
  },

  /**
   * 🔧 Atualiza exchange existente
   * Endpoint: PATCH /user/exchanges/{exchange_id}
   */
  async updateExchange(
    exchangeId: string,
    updateData: {
      is_active?: boolean;
      api_key?: string;
      api_secret?: string;
      passphrase?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔧 [API] Atualizando exchange:', exchangeId);
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/user/exchanges/${exchangeId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updateData)
        },
        TIMEOUTS.STANDARD
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update exchange');
      }

      const data = await response.json();

      console.log('✅ [API] Exchange atualizada');

      return data;
    } catch (error) {
      console.error('❌ [API] Erro ao atualizar exchange:', error);
      throw error;
    }
  },

  /**
   * 🗑️ Remove exchange
   * Endpoint: DELETE /user/exchanges/{exchange_id}
   */
  async deleteExchange(exchangeId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/user/exchanges/${exchangeId}`,
        {
          method: 'DELETE'
        },
        TIMEOUTS.STANDARD
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete exchange');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ [API] Erro ao remover exchange:', error);
      throw error;
    }
  },

  // ==================== 📊 MARKET MOVERS ====================

  /**
   * 🎯 FAST: Busca top gainers e losers do portfólio do usuário
   * Retorna tokens com maiores/menores variações de preço (1h, 4h ou 24h)
   * @param userId ID do usuário
   * @param limit Número de tokens top/bottom (padrão: 5)
   * @param timeframe Período de variação: '1h', '4h', '24h' (padrão: '1h')
   * @param forceRefresh Força atualização sem cache
   * @returns Promise com gainers e losers
   */
  async getMarketMovers(
    userId: string, 
    limit: number = 5, 
    timeframe: '1h' | '4h' | '24h' = '1h',
    forceRefresh: boolean = false
  ): Promise<{
    success: boolean;
    timeframe: string;
    gainers: Array<{
      symbol: string;
      name: string;
      exchange: string;
      amount: number;
      price: number;
      value_usd: number;
      change: number;
    }>;
    losers: Array<{
      symbol: string;
      name: string;
      exchange: string;
      amount: number;
      price: number;
      value_usd: number;
      change: number;
    }>;
    meta: {
      total_tokens: number;
      unique_tokens: number;
      tokens_with_change: number;
      fetch_time: number;
    };
  }> {
    try {
      // 🚫 SEM CACHE - Depende de balances que é sem cache
      const timestamp = Date.now();
      const url = `${API_BASE_URL}/balances/market-movers?user_id=${userId}&limit=${limit}&timeframe=${timeframe}&_t=${timestamp}`;
            
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        cache: 'no-store' // Sempre no-cache
      }, TIMEOUTS.FAST);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();

      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Busca a evolução do portfólio nos últimos N dias
   * @param userId ID do usuário
   * @param days Número de dias (padrão: 7)
   * @param forceRefresh Força atualização sem cache
   * @returns Promise com os dados de evolução
   */
  async getPortfolioEvolution(userId: string, days: number = 7, forceRefresh: boolean = false): Promise<PortfolioEvolutionResponse> {
    const cacheKey = CacheService.portfolioEvolutionKey(userId, days);

    // Check local cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = cacheService.get<PortfolioEvolutionResponse>(cacheKey, CACHE_TTL.PORTFOLIO);
      if (cached) {
        return cached;
      }
    }

    try {
      const url = `${API_BASE_URL}/history/evolution?user_id=${userId}&days=${days}${forceRefresh ? '&force_refresh=true' : ''}`;
      
      // Timeout progressivo baseado no período (mais dias = mais dados = mais tempo de processamento)
      const timeout = days <= 7 ? TIMEOUTS.NORMAL : days <= 15 ? TIMEOUTS.SLOW : TIMEOUTS.VERY_SLOW;
      
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: forceRefresh ? 'no-store' : 'default'
      }, timeout);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Cache locally
      if (!forceRefresh || (data as any).from_cache) {
        cacheService.set(cacheKey, data);
      }

      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Busca o PNL (Profit and Loss) diário do portfólio
   * Compara o valor de hoje (desde 00:00 UTC) com o valor de ontem
   * @param userId ID do usuário
   * @param forceRefresh Força atualização sem cache
   * @returns Promise com os dados de PNL diário
   */
  async getDailyPnl(userId: string, forceRefresh: boolean = false): Promise<DailyPnlResponse> {
    const cacheKey = CacheService.dailyPnlKey(userId);

    // Check local cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = cacheService.get<DailyPnlResponse>(cacheKey, CACHE_TTL.PORTFOLIO);
      if (cached) {
        return cached;
      }
    }

    try {
      // Adiciona a data atual no formato YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];
      const url = `${API_BASE_URL}/balances/pnl/daily?user_id=${userId}&date=${today}`;
      
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: forceRefresh ? 'no-store' : 'default'
      }, TIMEOUTS.NORMAL);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Cache locally (5 minutos, mesmo TTL do portfolio)
      if (!forceRefresh) {
        cacheService.set(cacheKey, data);
      } 

      return data;
    } catch (error) {
      throw error;
    }
  },

  async getExchangeDetails(userId: string, exchangeId: string, includeVariations: boolean = false): Promise<any> {
    try {
      // 🚫 SEM CACHE - Sempre busca direto da API CCXT
      const timestamp = Date.now();
      const variationsParam = includeVariations ? '&include_variations=true' : '';
      const url = `${API_BASE_URL}/balances/exchange/${exchangeId}?user_id=${userId}${variationsParam}&_t=${timestamp}`;
      

      
      const response = await fetchWithTimeout(
        url,
        {
          cache: 'no-store' // Sempre no-cache
        },
        TIMEOUTS.STANDARD // Exchange details fetch
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * 🪙 Busca detalhes de um token específico com variações de preço
   * @param exchangeId MongoDB _id da exchange
   * @param symbol Símbolo do token (ex: BTC, ETH)
   * @param userId ID do usuário
   * @returns Promise com detalhes do token incluindo variações
   */
  async getTokenDetails(exchangeId: string, symbol: string, userId: string): Promise<any> {
    try {
      const url = `${API_BASE_URL}/exchanges/${exchangeId}/token/${symbol}?user_id=${userId}&include_variations=true`;
      
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        cache: 'default'
      }, TIMEOUTS.NORMAL); // Token details with price variations
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Busca todas as exchanges disponíveis para conexão
   * @param userId ID do usuário
   * @param forceRefresh Força atualização sem cache
   * @returns Promise com a lista de exchanges disponíveis
   */
  async getAvailableExchanges(userId: string, forceRefresh: boolean = false): Promise<AvailableExchangesResponse> {
    
    try {
      const cacheKey = CacheService.availableExchangesKey(userId);
      
      // Check local cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = cacheService.get<AvailableExchangesResponse>(cacheKey, CACHE_TTL.EXCHANGES);
        if (cached) {
          return cached;
        }
      } 
      const url = `${API_BASE_URL}/exchanges/available`;
      
      console.log('📡 [API] Buscando exchanges disponíveis:', url)
      
      const response = await fetchWithTimeout(url, { 
        method: 'GET',
        cache: forceRefresh ? 'no-store' : 'default'
      }, TIMEOUTS.STANDARD); // List available exchanges
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data: AvailableExchangesResponse = await response.json();
      
      console.log('✅ [API] Exchanges disponíveis recebidas:', {
        success: data.success,
        count: data.exchanges?.length || 0,
        firstExchange: data.exchanges?.[0]
      })
            
      // Cache locally
      if (!forceRefresh || (data as any).from_cache) {
        cacheService.set(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Busca as exchanges já conectadas do usuário
   * @param userId ID do usuário
   * @returns Promise com a lista de exchanges conectadas
   */
  async getLinkedExchanges(userId: string, forceRefresh: boolean = false): Promise<LinkedExchangesResponse> {
    try {
      const cacheKey = CacheService.linkedExchangesKey(userId);
      
      // Check local cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = cacheService.get<LinkedExchangesResponse>(cacheKey, CACHE_TTL.EXCHANGES);
        if (cached) {
          return cached;
        }
      }
      
      const url = `${API_BASE_URL}/exchanges/linked?user_id=${userId}${forceRefresh ? '&force_refresh=true' : ''}`;
      
      const response = await fetchWithTimeout(url, { 
        method: 'GET',
        cache: forceRefresh ? 'no-store' : 'default'
      }, TIMEOUTS.STANDARD); // List linked exchanges
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data: LinkedExchangesResponse = await response.json();
      
      // Cache locally
      if (!forceRefresh || (data as any).from_cache) {
        cacheService.set(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Formata valores USD para exibição
   * @param value - Valor numérico ou string
   * @param maxDecimals - Máximo de casas decimais (padrão: 2 para valores normais)
   */
  formatUSD(value: string | number, maxDecimals: number = 2): string {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '0.00';
    if (numValue === 0) return '0.00';
    
    // Para valores muito pequenos (< $0.01), mostra até 8 casas decimais (crypto)
    if (Math.abs(numValue) < 0.01 && maxDecimals === 2) {
      return numValue.toFixed(8).replace(/\.?0+$/, '');
    }
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: maxDecimals,
    }).format(numValue);
  },

  /**
   * Formata quantidade de tokens
   */
  formatTokenAmount(amount: string): string {
    const numValue = parseFloat(amount);
    if (numValue === 0) return '0';
    
    // Para valores muito pequenos (< 0.000001), mostra até 10 casas decimais
    if (numValue < 0.000001) {
      return numValue.toFixed(10).replace(/\.?0+$/, '');
    }
    
    // Para valores grandes, usa abreviações
    if (numValue >= 1_000_000_000) {
      return `${(numValue / 1_000_000_000).toFixed(2)}Bi`;
    }
    if (numValue >= 1_000_000) {
      return `${(numValue / 1_000_000).toFixed(2)}Mi`;
    }
    if (numValue >= 1_000) {
      return `${(numValue / 1_000).toFixed(2)}K`;
    }
    
    // Para valores entre 0.000001 e 1, mostra até 3 casas decimais
    if (numValue < 1) {
      return numValue.toFixed(3);
    }
    
    // Para valores entre 1 e 1000, mostra até 2 casas decimais
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  },

  /**
   * Busca informações de um token em uma exchange específica
   * @param userId ID do usuário
   * @param exchangeId ID da exchange (MongoDB _id)
   * @param token Símbolo do token (ex: BTC, ETH, PEPE)
   * @returns Promise com os dados do token ou erro se não encontrado
   */
  async searchToken(userId: string, exchangeId: string, token: string): Promise<any> {
    try {
      const upperToken = token.toUpperCase();
      const url = `${API_BASE_URL}/tokens/search?user_id=${userId}&exchange_id=${exchangeId}&token=${upperToken}`;
      
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        cache: 'no-store'
      }, TIMEOUTS.STANDARD); // Token search
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        return {
          success: false,
          message: errorData.message || 'Token não encontrado nesta exchange',
          error: errorData.error || 'NOT_FOUND'
        };
      }
      
      const data = await response.json();
      return {
        success: true,
        ...data
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Erro ao buscar token. Tente novamente.',
        error: error.message
      };
    }
  },

  /**
   * Busca detalhes completos de uma exchange (fees, markets, etc)
   * @param exchangeId MongoDB _id da exchange
   * @param includeFees Se deve incluir informações de taxas
   * @param includeMarkets Se deve incluir informações de mercados
   * @param forceRefresh Se true, ignora o cache e busca dados frescos
   * @returns Promise com todos os detalhes da exchange
   */
  async getExchangeFullDetails(
    userId: string,
    exchangeId: string, 
    includeFees: boolean = true, 
    includeMarkets: boolean = true,
    forceRefresh: boolean = false
  ): Promise<any> {
    const cacheKey = CacheService.exchangeDetailsKey(exchangeId, includeFees, includeMarkets);

    // Verifica se existe cache válido (somente se não forçar refresh)
    if (!forceRefresh) {
      const cached = cacheService.get<any>(cacheKey, CACHE_TTL.EXCHANGE_DETAILS);
      if (cached) {
        return cached;
      }
    }

    try {
      const feesParam = includeFees ? 'include_fees=true' : '';
      const marketsParam = includeMarkets ? 'include_markets=true' : '';
      const userIdParam = `user_id=${userId}`;
      const params = [userIdParam, feesParam, marketsParam].filter(p => p).join('&');
      const url = `${API_BASE_URL}/exchanges/${exchangeId}${params ? '?' + params : ''}`;
      
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        cache: forceRefresh ? 'no-store' : 'default'
      }, TIMEOUTS.NORMAL); // Exchange full details
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Cache locally
      cacheService.set(cacheKey, data);
      
      return data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Limpa o cache de detalhes de uma exchange específica ou de todas
   * @param exchangeId ID da exchange (opcional). Se não fornecido, limpa todo o cache
   */
  clearExchangeDetailsCache(exchangeId?: string) {
    if (exchangeId) {
      // Limpa apenas o cache da exchange específica usando pattern matching
      cacheService.invalidate(`exchange_details_${exchangeId}`);
    } else {
      // Limpa todo o cache de exchange details
      cacheService.invalidate('exchange_details_');
    }
  },

  /**
   * 📋 Busca ordens abertas de uma exchange específica
   * ⚡ SEM CACHE: Sempre busca dados frescos para garantir ordens atualizadas
   * 🛡️  RATE LIMIT: Backend limita 1 req/s por user+exchange
   * @param userId ID do usuário
   * @param exchangeId MongoDB _id da exchange
  /**
   * 📊 Cria ordem de compra (market ou limit)
   * @param userId ID do usuário
   * @param exchangeId ID da exchange
   * @param token Símbolo do token (ex: BTC/USDT)
   * @param amount Quantidade a comprar
   * @param orderType Tipo de ordem: 'market' ou 'limit'
   * @param price Preço (obrigatório para limit, opcional para market)
   * @returns Promise com resultado da ordem
   */
  async createBuyOrder(
    userId: string,
    exchangeId: string,
    token: string,
    amount: number,
    orderType: 'market' | 'limit',
    price?: number
  ): Promise<any> {
    try {
      // TODO: Implementar chamada direta à API do trading-service
      throw new Error('Funcionalidade de criar ordem de compra não implementada. Usar trading-service diretamente.');
    } catch (error: any) {
      // Melhora mensagens de erro comuns
      let errorMessage = error.message || 'Erro ao criar ordem de compra'
      
      if (errorMessage.includes('BadSymbol')) {
        const match = errorMessage.match(/does not have market symbol (\w+)/)
        const symbol = match ? match[1] : token
        errorMessage = `Token "${symbol}" não está disponível nesta exchange`
      } else if (errorMessage.includes('InsufficientFunds')) {
        errorMessage = 'Saldo insuficiente para realizar esta ordem'
      } else if (errorMessage.includes('InvalidOrder')) {
        errorMessage = 'Ordem inválida. Verifique os valores e tente novamente'
      }
      
      throw new Error(errorMessage)
    }
  },

  /**
   * 📉 Cria ordem de venda (market ou limit)
   * @param userId ID do usuário
   * @param exchangeId ID da exchange
   * @param token Símbolo do token (ex: BTC/USDT)
   * @param amount Quantidade a vender
   * @param orderType Tipo de ordem: 'market' ou 'limit'
   * @param price Preço (obrigatório para limit, opcional para market)
   * @returns Promise com resultado da ordem
   */
  async createSellOrder(
    userId: string,
    exchangeId: string,
    token: string,
    amount: number,
    orderType: 'market' | 'limit',
    price?: number
  ): Promise<any> {
    try {
      // TODO: Implementar endpoint direto do trading-service: POST /orders/sell
      throw new Error(
        "Funcionalidade não implementada. Usar trading-service diretamente."
      );
    } catch (error: any) {
      // Melhora mensagens de erro comuns
      let errorMessage = error.message || 'Erro ao criar ordem de venda'
      
      if (errorMessage.includes('BadSymbol')) {
        const match = errorMessage.match(/does not have market symbol (\w+)/)
        const symbol = match ? match[1] : token
        errorMessage = `Token "${symbol}" não está disponível nesta exchange`
      } else if (errorMessage.includes('InsufficientFunds')) {
        errorMessage = 'Saldo insuficiente para realizar esta ordem'
      } else if (errorMessage.includes('InvalidOrder')) {
        errorMessage = 'Ordem inválida. Verifique os valores e tente novamente'
      }
      
      throw new Error(errorMessage)
    }
  },

  /**
   * 💰 Consulta saldo disponível de um token específico
   * @param userId ID do usuário
   * @param exchangeId MongoDB _id da exchange
   * @param token Símbolo do token (ex: BTC, DOGE, USDT)
   * @returns Promise com saldo disponível, usado e total
   */
  async getTokenBalance(
    userId: string,
    exchangeId: string,
    token: string
  ): Promise<any> {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/exchanges/${exchangeId}/token/${token}?user_id=${userId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        TIMEOUTS.NORMAL // Normal operation
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * 📊 Lista tokens disponíveis para negociação (markets)
   * @param userId ID do usuário
   * @param exchangeId MongoDB _id da exchange
   * @param quote (opcional) Moeda de cotação (default: USDT)
   * @param search (opcional) Buscar token específico
   * @returns Promise com lista de markets e seus limites
   */
  async getMarkets(
    userId: string,
    exchangeId: string,
    quote: string = 'USDT',
    search?: string
  ): Promise<any> {
    try {
      let url = `${API_BASE_URL}/exchanges/${exchangeId}/markets?user_id=${userId}&quote=${quote}`;
      if (search) {
        url += `&search=${search}`;
      }

      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        TIMEOUTS.NORMAL // Normal operation
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * 📜 Histórico de ordens fechadas/canceladas (com cache de 5 min)
   * @param userId ID do usuário
   * @param exchangeId MongoDB _id da exchange
   * @param symbol (opcional) Par específico (ex: BTC/USDT)
   * @param limit (opcional) Número de ordens (default: 100, max: 500)
   * @param useCache (opcional) Usar cache (default: true)
   * @returns Promise com histórico de ordens
   */
  async getOrderHistory(
    userId: string,
    exchangeId: string,
    symbol?: string,
    limit: number = 100,
    useCache: boolean = true
  ): Promise<any> {
    try {
      let url = `${API_BASE_URL}/orders/history?user_id=${userId}&exchange_id=${exchangeId}&limit=${limit}&use_cache=${useCache}`;
      if (symbol) {
        url += `&symbol=${symbol}`;
      }

      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        TIMEOUTS.NORMAL // Normal operation
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * ❌ Cancela uma ordem aberta (usando credenciais salvas - JWT)
   * @param exchangeId ID da exchange
   * @param symbol Par de negociação
   * @param orderId ID da ordem a cancelar
   * @returns Promise com resultado do cancelamento
   */
  async cancelOrder(
    exchangeId: string,
    symbol: string,
    orderId: string
  ): Promise<any> {
    try {
      const body = {
        exchange_id: exchangeId,
        symbol: symbol,
        order_id: orderId
      }
      
      const token = await this.getAuthToken();
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/orders/cancel/secure`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body),
        },
        TIMEOUTS.NORMAL
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao cancelar ordem')
    }
  },

  /**
   * Cancela todas as ordens abertas de uma exchange
   * @param userId ID do usuário
   * @param exchangeId ID da exchange
   * @returns Promise com resultado do cancelamento
   */
  async cancelAllOrders(
    userId: string,
    exchangeId: string
  ): Promise<any> {
    try {
      const body = {
        user_id: userId,
        exchange_id: exchangeId
      }
      
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/orders/cancel-all`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        TIMEOUTS.SLOW // Cancel all orders
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Invalida o cache de ordens abertas para um usuário/exchange específico
   * Usado após criar ou cancelar ordens para forçar atualização
   */
  invalidateOrdersCache(userId: string, exchangeId: string) {
    // O cache está no componente OpenOrdersModal, não aqui
    // Este método serve como trigger para componentes que importam este serviço
    // Os componentes podem usar este método como sinal para limpar seus próprios caches
  },

  /**
   * Retorna informações sobre o cache atual
   */
  getCacheInfo() {
    return cacheService.getStats();
  },

  // ==========================================
  // 🦎 EXTERNAL API - CoinGecko & Exchange Rates
  // ==========================================

  /**
   * 🔍 Busca informações detalhadas de um token na CoinGecko
   * 
   * @param coingeckoId ID do token no CoinGecko (ex: 'bitcoin', 'ethereum')
   * @returns Promise com informações detalhadas do token
   * 
   * @example
   * ```ts
   * const btcInfo = await apiService.getTokenInfo('bitcoin');
   * 
   * ```
   */
  async getTokenInfo(coingeckoId: string): Promise<any> {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/external/token/info?coingecko_id=${encodeURIComponent(coingeckoId)}`,
        { method: 'GET' },
        TIMEOUTS.NORMAL // 15 segundos
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch token info: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * 🔍 Busca tokens na CoinGecko por símbolo
   * 
   * @param symbol Símbolo do token (ex: 'BTC', 'ETH')
   * @returns Promise com lista de tokens encontrados
   * 
   * @example
   * ```ts
   * const results = await apiService.searchTokenCoinGecko('BTC');
   * // results = [{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }, ...]
   * ```
   */
  async searchTokenCoinGecko(symbol: string): Promise<any[]> {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/external/token/search?symbol=${encodeURIComponent(symbol)}`,
        { method: 'GET' },
        TIMEOUTS.FAST // 5 segundos
      );

      if (!response.ok) {
        throw new Error(`Failed to search token: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * 💰 Busca preços de múltiplos tokens na CoinGecko
   * 
   * @param coingeckoIds Array de IDs CoinGecko (máximo 100)
   * @returns Promise com objeto { token_id: price_usd }
   * 
   * @example
   * ```ts
   * const prices = await apiService.getBatchPrices(['bitcoin', 'ethereum', 'cardano']);
   * // prices = { bitcoin: 45000.50, ethereum: 3200.75, cardano: 1.25 }
   * ```
   */
  async getBatchPrices(coingeckoIds: string[]): Promise<Record<string, number>> {
    try {
      if (coingeckoIds.length === 0) {
        return {};
      }

      if (coingeckoIds.length > 100) {
        coingeckoIds = coingeckoIds.slice(0, 100);
      }

      const idsParam = coingeckoIds.join(',');
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/external/token/prices?ids=${encodeURIComponent(idsParam)}`,
        { method: 'GET' },
        TIMEOUTS.NORMAL // 15 segundos
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch batch prices: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * 💱 Busca taxa de câmbio entre duas moedas
   * 
   * @param from Moeda de origem (ex: 'USD', 'BRL')
   * @param to Moeda de destino (ex: 'BRL', 'USD')
   * @returns Promise com taxa de conversão
   * 
   * @example
   * ```ts
   * const rate = await apiService.getExchangeRate('USD', 'BRL');
   * // rate = { from: 'USD', to: 'BRL', rate: 5.02, last_updated: '...' }
   * ```
   */
  async getExchangeRate(from: string, to: string): Promise<any> {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/external/exchange-rate?from=${from}&to=${to}`,
        { method: 'GET' },
        TIMEOUTS.FAST // 5 segundos
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rate: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * 💸 Converte valor entre duas moedas
   * 
   * @param from Moeda de origem
   * @param to Moeda de destino
   * @param amount Valor a converter
   * @returns Promise com resultado da conversão
   * 
   * @example
   * ```ts
   * const result = await apiService.convertCurrency('USD', 'BRL', 100);
   * // result = { from: 'USD', to: 'BRL', amount: 100, result: 502.00, rate: 5.02 }
   * ```
   */
  async convertCurrency(from: string, to: string, amount: number): Promise<any> {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/external/convert?from=${from}&to=${to}&amount=${amount}`,
        { method: 'GET' },
        TIMEOUTS.FAST // 5 segundos
      );

      if (!response.ok) {
        throw new Error(`Failed to convert currency: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * 🗑️ Deleta a conta do usuário
   * Remove todos os dados do usuário do MongoDB incluindo:
   * - Dados do usuário
   * - Exchanges vinculadas
   * - Históricos
   * - Configurações
   * 
   * @returns Promise<void>
   * 
   * @example
   * ```ts
   * await apiService.deleteAccount();
   * ```
   */
  async deleteAccount(): Promise<void> {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/auth/delete-account`,
        { method: 'DELETE' },
        TIMEOUTS.STANDARD // 10 segundos
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete account: ${response.status}`);
      }

      return;
    } catch (error) {
      console.error('❌ Error deleting account:', error);
      throw error;
    }
  },

  /**
   * Generic GET request helper with timeout
   */
  async get<T = any>(endpoint: string, timeout: number = TIMEOUTS.FAST): Promise<{ data: T }> {
    const token = await secureStorage.getItemAsync('access_token');
    
    const response = await fetchWithTimeout(
      `${API_BASE_URL}${endpoint}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      timeout
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    const data = await response.json();
    return { data };
  },

  /**
   * Generic PUT request helper with timeout
   */
  async put<T = any>(endpoint: string, body: any, timeout: number = TIMEOUTS.FAST): Promise<{ data: T }> {
    const token = await secureStorage.getItemAsync('access_token');
    
    const response = await fetchWithTimeout(
      `${API_BASE_URL}${endpoint}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      },
      timeout
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    const data = await response.json();
    return { data };
  },

  /**
   * Generic DELETE request helper with timeout
   */
  async delete<T = any>(endpoint: string, timeout: number = TIMEOUTS.FAST): Promise<{ data: T }> {
    const token = await secureStorage.getItemAsync('access_token');
    
    const response = await fetchWithTimeout(
      `${API_BASE_URL}${endpoint}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      timeout
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    const data = await response.json();
    return { data };
  },

  /**
   * Generic POST request helper with timeout
   */
  async post<T = any>(endpoint: string, body: any, timeout: number = TIMEOUTS.BALANCE_SYNC): Promise<{ data: T }> {
    const token = await secureStorage.getItemAsync('access_token');
    
    const response = await fetchWithTimeout(
      `${API_BASE_URL}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      },
      timeout
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    const data = await response.json();
    return { data };
  },

  // ==========================================
  // 🤖 STRATEGIES - MongoDB Backend
  // ==========================================

  /**
   * Lista todas as estratégias do usuário
   */
  async listStrategies() {
    return this.get('/strategies', TIMEOUTS.FAST);
  },

  /**
   * Cria nova estratégia
   */
  async createStrategy(data: any) {
    return this.post('/strategies', data, TIMEOUTS.FAST);
  },

  /**
   * Atualiza estratégia existente
   */
  async updateStrategy(id: string, data: any) {
    return this.put(`/strategies/${id}`, data, TIMEOUTS.FAST);
  },

  /**
   * Deleta estratégia
   */
  async deleteStrategy(id: string) {
    return this.delete(`/strategies/${id}`, TIMEOUTS.FAST);
  },

  /**
   * Alterna status ativo/inativo da estratégia
   */
  async toggleStrategy(id: string, is_active: boolean) {
    return this.put(`/strategies/${id}`, { is_active }, TIMEOUTS.FAST);
  },
};

// Export default para facilitar imports
export default apiService;

