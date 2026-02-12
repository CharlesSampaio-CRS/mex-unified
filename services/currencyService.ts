/**
 * 💱 Currency Conversion Service
 * Converte USD para BRL usando a AwesomeAPI (brasileira, gratuita e ilimitada)
 */

interface ExchangeRateResponse {
  USDBRL: {
    code: string
    codein: string
    name: string
    high: string
    low: string
    varBid: string
    pctChange: string
    bid: string // Preço de compra (usado para conversão)
    ask: string // Preço de venda
    timestamp: string
    create_date: string
  }
}

class CurrencyService {
  private cachedRate: number | null = null
  private cacheTimestamp: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutos
  private readonly FALLBACK_RATE = 5.50 // Taxa padrão caso a API falhe

  /**
   * Busca a taxa de câmbio USD → BRL
   * Com cache de 5 minutos para evitar muitas requisições
   */
  async getUsdToBrlRate(): Promise<number> {
    const now = Date.now()
    
    // Retorna do cache se ainda válido
    if (this.cachedRate && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.cachedRate
    }

    try {
      const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Timeout de 5 segundos
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`API retornou status ${response.status}`)
      }

      const data: ExchangeRateResponse = await response.json()
      const rate = parseFloat(data.USDBRL.bid)

      if (isNaN(rate) || rate <= 0) {
        throw new Error('Taxa inválida retornada pela API')
      }

      // Atualiza cache
      this.cachedRate = rate
      this.cacheTimestamp = now

      console.log(`💱 Taxa USD → BRL atualizada: R$ ${rate.toFixed(4)}`)
      return rate
    } catch (error) {
      console.warn('⚠️ Erro ao buscar taxa USD/BRL:', error)
      
      // Se tem cache antigo, usa ele (mesmo que expirado)
      if (this.cachedRate) {
        console.log(`💾 Usando taxa do cache (expirado): R$ ${this.cachedRate.toFixed(4)}`)
        return this.cachedRate
      }
      
      // Último recurso: taxa fallback
      console.log(`📊 Usando taxa fallback: R$ ${this.FALLBACK_RATE}`)
      this.cachedRate = this.FALLBACK_RATE
      this.cacheTimestamp = now
      return this.FALLBACK_RATE
    }
  }

  /**
   * Converte valor de USD para BRL
   */
  async convertUsdToBrl(usdAmount: number): Promise<number> {
    const rate = await this.getUsdToBrlRate()
    return usdAmount * rate
  }

  /**
   * Formata valor em BRL
   */
  formatBrl(amount: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  /**
   * Formata valor em USD
   */
  formatUsd(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  /**
   * Limpa o cache (útil para forçar atualização)
   */
  clearCache(): void {
    this.cachedRate = null
    this.cacheTimestamp = 0
    console.log('🗑️ Cache de taxa de câmbio limpo')
  }
}

export const currencyService = new CurrencyService()
