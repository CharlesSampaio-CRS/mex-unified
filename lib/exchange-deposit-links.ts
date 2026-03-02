/**
 * Configuração de deep links para depósito nas exchanges.
 * Cada exchange pode ter:
 * - appScheme: URL scheme do app nativo (para tentar abrir direto)
 * - depositUrl: URL web para depósito (fallback)
 * - supportsBRL: se aceita depósito em BRL
 * - supportsPIX: se aceita PIX especificamente
 */

export interface ExchangeDepositConfig {
  ccxtId: string
  name: string
  supportsBRL: boolean
  supportsPIX: boolean
  /** URL scheme do app nativo (ex: 'binance://') */
  appScheme?: string
  /** Deep link direto para depósito no app (se suportado) */
  appDepositUrl?: string
  /** URL web de depósito (fallback se app não está instalado) */
  webDepositUrl: string
  /** Notas adicionais para o usuário */
  note?: string
}

/**
 * Mapa de configurações de depósito por ccxt_id.
 * Atualizado com base em testes reais (março/2026).
 */
export const exchangeDepositConfigs: Record<string, ExchangeDepositConfig> = {
  binance: {
    ccxtId: 'binance',
    name: 'Binance',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'bnc://',
    appDepositUrl: 'bnc://app.binance.com/payment/funds/deposit/fiat/BRL',
    webDepositUrl: 'https://www.binance.com/pt-BR/fiat/deposit/BRL',
    note: 'Depósito PIX instantâneo, sem taxas',
  },
  mexc: {
    ccxtId: 'mexc',
    name: 'MEXC',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'mexc://',
    appDepositUrl: 'mexc://fiat/deposit?currency=BRL',
    webDepositUrl: 'https://www.mexc.com/pt-BR/fiat/deposit/BRL',
    note: 'Depósito PIX disponível',
  },
  novadax: {
    ccxtId: 'novadax',
    name: 'NovaDAX',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'novadax://',
    appDepositUrl: 'novadax://deposit',
    webDepositUrl: 'https://www.novadax.com.br/balances/deposit/BRL',
    note: 'Exchange brasileira — PIX nativo',
  },
  bybit: {
    ccxtId: 'bybit',
    name: 'Bybit',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'bybitapp://',
    appDepositUrl: 'bybitapp://fiat/deposit',
    webDepositUrl: 'https://www.bybit.com/fiat/trade/otc/fiattocrypto/BRL/USDT',
    note: 'Depósito via PIX (P2P)',
  },
  bitget: {
    ccxtId: 'bitget',
    name: 'Bitget',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'bitget://',
    appDepositUrl: 'bitget://fiat/deposit',
    webDepositUrl: 'https://www.bitget.com/pt-BR/express/buy?fiatCurrency=BRL',
    note: 'Compra com PIX via parceiro',
  },
  kucoin: {
    ccxtId: 'kucoin',
    name: 'KuCoin',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'kucoin://',
    appDepositUrl: 'kucoin://fiat/deposit',
    webDepositUrl: 'https://www.kucoin.com/pt/buy-crypto?fiat=BRL',
    note: 'Compra com PIX disponível',
  },
  okx: {
    ccxtId: 'okx',
    name: 'OKX',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'okx://',
    appDepositUrl: 'okx://buy',
    webDepositUrl: 'https://www.okx.com/pt-br/buy-crypto',
    note: 'PIX via P2P',
  },
  // Exchanges sem suporte a BRL
  kraken: {
    ccxtId: 'kraken',
    name: 'Kraken',
    supportsBRL: false,
    supportsPIX: false,
    webDepositUrl: 'https://www.kraken.com/u/funding',
    note: 'Sem suporte a BRL/PIX',
  },
  coinbase: {
    ccxtId: 'coinbase',
    name: 'Coinbase',
    supportsBRL: false,
    supportsPIX: false,
    appScheme: 'coinbase://',
    webDepositUrl: 'https://www.coinbase.com/buy',
    note: 'Sem suporte a PIX',
  },
  coinex: {
    ccxtId: 'coinex',
    name: 'CoinEx',
    supportsBRL: false,
    supportsPIX: false,
    webDepositUrl: 'https://www.coinex.com/asset/deposit',
    note: 'Sem suporte a BRL',
  },
  gateio: {
    ccxtId: 'gateio',
    name: 'Gate.io',
    supportsBRL: false,
    supportsPIX: false,
    webDepositUrl: 'https://www.gate.io/myaccount/deposit',
    note: 'Sem suporte a BRL/PIX',
  },
}

/**
 * Retorna configs de depósito apenas para exchanges que suportam PIX/BRL
 */
export function getPixExchanges(): ExchangeDepositConfig[] {
  return Object.values(exchangeDepositConfigs).filter(e => e.supportsPIX)
}

/**
 * Retorna config de depósito por ccxt_id
 */
export function getDepositConfig(ccxtId: string): ExchangeDepositConfig | null {
  return exchangeDepositConfigs[ccxtId] || null
}
