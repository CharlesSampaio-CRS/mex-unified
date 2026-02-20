export interface Token {
  amount: string;
  price_usd: string;
  value_usd: string;
  change_1h?: string;
  change_4h?: string;
  change_24h?: string;
}

export interface Exchange {
  exchange_id?: string; // Estrutura antiga
  exchange?: string; // ✅ Nova estrutura - nome da exchange diretamente
  name?: string; // Nome da exchange
  success: boolean;
  error?: string; // Erro caso falhe
  tokens?: Record<string, Token>; // Estrutura antiga
  balances?: Record<string, Balance>; // ✅ Nova estrutura
  total_usd: string | number; // Pode ser string ou number
  token_count?: number; // Número de tokens (disponível no summary)
}

// ✅ NOVO: Estrutura de balance individual da nova API
export interface Balance {
  symbol: string;
  free: number;
  used: number;
  total: number;
  usd_value?: number | null; // Pode ser null se não tem preço
  change_24h?: number | null;
}

export interface BalanceResponse {
  success?: boolean; // ✅ Nova estrutura da API
  exchanges: Exchange[];
  meta?: { // Opcional - pode não vir na resposta
    from_cache: boolean;
    fetch_time?: string;
  };
  summary?: { // Opcional - estrutura antiga
    exchanges_count: number;
    total_usd: string;
  };
  total_usd?: number | string; // ✅ Nova estrutura - total direto na raiz
  timestamp: string | number; // Pode ser string ou number
  user_id?: string;
}

export interface AvailableExchange {
  _id: string;
  ccxt_id: string;
  icon: string;
  nome: string;
  pais_de_origem: string;
  requires_passphrase: boolean;
  url: string;
}

export interface AvailableExchangesResponse {
  exchanges: AvailableExchange[];
  success: boolean;
  total: number;
}

export interface LinkedExchange {
  _id?: string;
  user_id?: string;
  exchange_id: string;
  ccxt_id: string;
  name: string;
  icon: string;
  country?: string;  // país de origem
  pais_de_origem?: string;  // fallback (backend pode retornar country)
  url?: string;
  status?: 'active' | 'inactive';
  is_active?: boolean;
  linked_at: string;  // Data de conexão (ISO string)
  created_at?: string;  // Alias (backend retorna ambos)
  updated_at?: string;
  disconnected_at?: string;
  reconnected_at?: string;
  api_key?: string;
  api_secret?: string;
  passphrase?: string;
  logo?: string;
  requires_passphrase?: boolean;
}

export interface LinkedExchangesResponse {
  exchanges: LinkedExchange[];
  success: boolean;
  total: number;
}

export interface PortfolioEvolutionSummary {
  period_days: number;
  data_points: number;
  start_value_usd: string;
  end_value_usd: string;
  min_value_usd: string;
  max_value_usd: string;
  change_usd: string;
  change_percent: string;
}

export interface PortfolioEvolution {
  timestamps: string[];
  values_usd: number[];
  values_brl: number[];
  summary: PortfolioEvolutionSummary;
}

export interface PortfolioEvolutionResponse {
  user_id: string;
  days: number;
  success: boolean;
  evolution: PortfolioEvolution;
}

export interface DailyPnlResponse {
  user_id: string;
  today_usd: string;
  yesterday_usd: string;
  pnl_usd: string;
  pnl_percent: string;
  is_profit: boolean;
  _raw: {
    today_usd: number;
    yesterday_usd: number;
    pnl_usd: number;
    pnl_percent: number;
  };
}
