/**
 * Deep link config for exchange deposits.
 * - appScheme: native app URL scheme
 * - appDepositUrl: direct deep link to deposit screen
 * - Fallback: search by exchange name on App Store / Google Play
 */

export interface ExchangeDepositConfig {
  ccxtId: string
  name: string
  supportsBRL: boolean
  supportsPIX: boolean
  /** Native app URL scheme (e.g. 'binance://') */
  appScheme?: string
  /** Direct deep link to deposit screen */
  appDepositUrl?: string
  /** Additional notes */
  note?: string
}

/**
 * Deposit config map by ccxt_id.
 * Updated based on real tests (March/2026).
 */
export const exchangeDepositConfigs: Record<string, ExchangeDepositConfig> = {
  binance: {
    ccxtId: 'binance',
    name: 'Binance',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'bnc://',
    appDepositUrl: 'bnc://app.binance.com/payment/funds/deposit/fiat/BRL',
  },
  mexc: {
    ccxtId: 'mexc',
    name: 'MEXC',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'mexc://',
    appDepositUrl: 'mexc://fiat/deposit?currency=BRL',
  },
  novadax: {
    ccxtId: 'novadax',
    name: 'NovaDAX',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'novadax://',
    appDepositUrl: 'novadax://deposit',
  },
  bybit: {
    ccxtId: 'bybit',
    name: 'Bybit',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'bybitapp://',
    appDepositUrl: 'bybitapp://fiat/deposit',
  },
  bitget: {
    ccxtId: 'bitget',
    name: 'Bitget',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'bitget://',
    appDepositUrl: 'bitget://fiat/deposit',
  },
  kucoin: {
    ccxtId: 'kucoin',
    name: 'KuCoin',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'kucoin://',
    appDepositUrl: 'kucoin://fiat/deposit',
  },
  okx: {
    ccxtId: 'okx',
    name: 'OKX',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'okx://',
    appDepositUrl: 'okx://buy',
  },
  kraken: {
    ccxtId: 'kraken',
    name: 'Kraken',
    supportsBRL: false,
    supportsPIX: false,
  },
  coinbase: {
    ccxtId: 'coinbase',
    name: 'Coinbase',
    supportsBRL: false,
    supportsPIX: false,
    appScheme: 'coinbase://',
  },
  coinex: {
    ccxtId: 'coinex',
    name: 'CoinEx',
    supportsBRL: false,
    supportsPIX: false,
  },
  gateio: {
    ccxtId: 'gateio',
    name: 'Gate.io',
    supportsBRL: false,
    supportsPIX: false,
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
