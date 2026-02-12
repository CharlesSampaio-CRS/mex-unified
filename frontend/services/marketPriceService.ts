/**
 * Serviço para buscar preços de mercado de criptomoedas
 * Usa APIs públicas gratuitas (sem necessidade de chave)
 */

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap?: number;
  high24h?: number;
  low24h?: number;
  lastUpdate: number;
}

interface CoinGeckoResponse {
  [key: string]: {
    usd: number;
    usd_24h_change: number;
    usd_24h_vol: number;
    usd_market_cap: number;
  };
}

class MarketPriceService {
  private cache: Map<string, { data: MarketData; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 segundos
  private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';

  // Mapeia símbolos para IDs do CoinGecko
  private readonly SYMBOL_TO_ID: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    BNB: 'binancecoin',
    SOL: 'solana',
    XRP: 'ripple',
    ADA: 'cardano',
    AVAX: 'avalanche-2',
    DOT: 'polkadot',
    MATIC: 'matic-network',
    LINK: 'chainlink',
    UNI: 'uniswap',
    ATOM: 'cosmos',
    LTC: 'litecoin',
    ETC: 'ethereum-classic',
    XLM: 'stellar',
    ALGO: 'algorand',
    VET: 'vechain',
    ICP: 'internet-computer',
    FIL: 'filecoin',
    NEAR: 'near',
    AAVE: 'aave',
    MKR: 'maker',
    SNX: 'synthetix-network-token',
    CRV: 'curve-dao-token',
    COMP: 'compound-governance-token',
    SUSHI: 'sushi',
    YFI: 'yearn-finance',
    CAKE: 'pancakeswap-token',
    RUNE: 'thorchain',
    MANA: 'decentraland',
    SAND: 'the-sandbox',
    AXS: 'axie-infinity',
    GALA: 'gala',
    ENJ: 'enjincoin',
    CHZ: 'chiliz',
  };

  /**
   * Busca dados de mercado para múltiplos símbolos
   */
  async getMarketData(symbols: string[]): Promise<Map<string, MarketData>> {
    const result = new Map<string, MarketData>();
    const symbolsToFetch: string[] = [];

    // Verifica cache primeiro
    for (const symbol of symbols) {
      const cached = this.getCachedData(symbol);
      if (cached) {
        result.set(symbol, cached);
      } else {
        symbolsToFetch.push(symbol);
      }
    }

    // Se todos estavam em cache, retorna
    if (symbolsToFetch.length === 0) {
      return result;
    }

    try {
      // Converte símbolos para IDs do CoinGecko
      const ids = symbolsToFetch
        .map(symbol => this.SYMBOL_TO_ID[symbol.toUpperCase()])
        .filter(Boolean)
        .join(',');

      if (!ids) {
        console.warn('[MarketPrice] Nenhum ID válido para buscar');
        return result;
      }

      // Busca dados do CoinGecko
      const url = `${this.COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data: CoinGeckoResponse = await response.json();

      // Processa resposta
      for (const symbol of symbolsToFetch) {
        const id = this.SYMBOL_TO_ID[symbol.toUpperCase()];
        if (!id || !data[id]) continue;

        const coinData = data[id];
        const marketData: MarketData = {
          symbol: symbol.toUpperCase(),
          price: coinData.usd,
          change24h: coinData.usd_24h_change || 0,
          volume24h: coinData.usd_24h_vol || 0,
          marketCap: coinData.usd_market_cap,
          lastUpdate: Date.now(),
        };

        // Salva no cache
        this.cache.set(symbol.toUpperCase(), {
          data: marketData,
          timestamp: Date.now(),
        });

        result.set(symbol.toUpperCase(), marketData);
      }

      console.log(`[MarketPrice] ✅ Buscou ${result.size} tokens do CoinGecko`);
    } catch (error) {
      console.error('[MarketPrice] ❌ Erro ao buscar dados:', error);
      
      // Retorna dados do cache mesmo se expirados (melhor que nada)
      for (const symbol of symbolsToFetch) {
        const cached = this.cache.get(symbol.toUpperCase());
        if (cached) {
          result.set(symbol.toUpperCase(), cached.data);
        }
      }
    }

    return result;
  }

  /**
   * Busca preço simples de um token
   */
  async getPrice(symbol: string): Promise<number | null> {
    const data = await this.getMarketData([symbol]);
    const marketData = data.get(symbol.toUpperCase());
    return marketData?.price || null;
  }

  /**
   * Busca preços simples de múltiplos tokens
   */
  async getPrices(symbols: string[]): Promise<Map<string, number>> {
    const data = await this.getMarketData(symbols);
    const prices = new Map<string, number>();
    
    data.forEach((marketData, symbol) => {
      prices.set(symbol, marketData.price);
    });

    return prices;
  }

  /**
   * Verifica se há dados em cache válidos
   */
  private getCachedData(symbol: string): MarketData | null {
    const cached = this.cache.get(symbol.toUpperCase());
    
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION;
    
    if (isExpired) {
      this.cache.delete(symbol.toUpperCase());
      return null;
    }

    return cached.data;
  }

  /**
   * Limpa cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[MarketPrice] 🗑️ Cache limpo');
  }

  /**
   * Obtém símbolos suportados
   */
  getSupportedSymbols(): string[] {
    return Object.keys(this.SYMBOL_TO_ID);
  }

  /**
   * Verifica se um símbolo é suportado
   */
  isSymbolSupported(symbol: string): boolean {
    return symbol.toUpperCase() in this.SYMBOL_TO_ID;
  }

  /**
   * Busca dados históricos de preço para gráfico
   * @param symbol - Símbolo da moeda (BTC, ETH, etc)
   * @param days - Número de dias (1, 7, 30, 90, 365)
   */
  async getChartData(symbol: string, days: number = 7): Promise<{ values: number[]; timestamps: string[] } | null> {
    try {
      const coinId = this.SYMBOL_TO_ID[symbol.toUpperCase()];
      
      if (!coinId) {
        console.warn(`[MarketPrice] ⚠️ Símbolo ${symbol} não mapeado`);
        return null;
      }

      console.log(`[MarketPrice] 📊 Buscando dados históricos de ${symbol} (${coinId}) para ${days} dias...`);

      // Endpoint: /coins/{id}/market_chart
      const url = `${this.COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[MarketPrice] ❌ CoinGecko API error: ${response.status} - ${errorText}`);
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      
      // CoinGecko retorna: { prices: [[timestamp, price], ...] }
      if (!data.prices || !Array.isArray(data.prices)) {
        console.warn('[MarketPrice] ⚠️ Formato inválido de dados históricos:', data);
        return null;
      }

      if (data.prices.length === 0) {
        console.warn(`[MarketPrice] ⚠️ Nenhum dado histórico retornado para ${symbol}`);
        return null;
      }

      const values: number[] = [];
      const timestamps: string[] = [];

      data.prices.forEach(([timestamp, price]: [number, number]) => {
        timestamps.push(new Date(timestamp).toISOString());
        values.push(price);
      });

      console.log(`[MarketPrice] ✅ ${symbol}: ${values.length} pontos históricos carregados (${days} dias)`);

      return { values, timestamps };
    } catch (error) {
      console.error(`[MarketPrice] ❌ Erro ao buscar dados históricos de ${symbol}:`, error);
      return null;
    }
  }

  /**
   * 🔍 Busca tokens por nome ou símbolo na API do CoinGecko
   * Retorna múltiplos resultados que correspondem ao termo de busca
   */
  async searchTokens(query: string): Promise<Array<{
    id: string;
    symbol: string;
    name: string;
    thumb?: string;
    market_cap_rank?: number;
  }>> {
    try {
      if (!query || query.length < 2) {
        return [];
      }

      console.log(`[MarketPrice] 🔍 Buscando tokens com termo: "${query}"`);

      // Usa o endpoint público de busca do CoinGecko
      const url = `${this.COINGECKO_API}/search?query=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`CoinGecko search failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Retorna apenas as moedas (coins), limitado a 10 resultados
      const results = (data.coins || []).slice(0, 10).map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol?.toUpperCase() || '',
        name: coin.name || '',
        thumb: coin.thumb || coin.large || coin.small,
        market_cap_rank: coin.market_cap_rank
      }));

      console.log(`[MarketPrice] ✅ Encontrados ${results.length} tokens para "${query}"`);

      return results;
    } catch (error) {
      console.error(`[MarketPrice] ❌ Erro ao buscar tokens:`, error);
      return [];
    }
  }
}

export const marketPriceService = new MarketPriceService();
