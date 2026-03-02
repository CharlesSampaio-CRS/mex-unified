/**
 * Configuração de deep links para depósito nas exchanges.
 * Cada exchange pode ter:
 * - appScheme: URL scheme do app nativo (para tentar abrir direto)
 * - appDepositUrl: deep link direto para seção de depósito
 * - appStoreUrl: URL da App Store (iOS) para fallback
 * - playStoreUrl: URL do Google Play (Android) para fallback
 * - supportsBRL / supportsPIX: flags de suporte
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
  /** URL da App Store (iOS) — fallback se app não instalado */
  appStoreUrl: string
  /** URL do Google Play (Android) — fallback se app não instalado */
  playStoreUrl: string
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
    appStoreUrl: 'https://apps.apple.com/app/binance-buy-bitcoin-crypto/id1436799971',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.binance.dev',
    note: 'Depósito PIX instantâneo, sem taxas',
  },
  mexc: {
    ccxtId: 'mexc',
    name: 'MEXC',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'mexc://',
    appDepositUrl: 'mexc://fiat/deposit?currency=BRL',
    appStoreUrl: 'https://apps.apple.com/app/mexc-buy-bitcoin-crypto/id1482189735',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.mexc.spot',
    note: 'Depósito PIX disponível',
  },
  novadax: {
    ccxtId: 'novadax',
    name: 'NovaDAX',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'novadax://',
    appDepositUrl: 'novadax://deposit',
    appStoreUrl: 'https://apps.apple.com/app/novadax/id1456419067',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.novadax.exchange',
    note: 'Exchange brasileira — PIX nativo',
  },
  bybit: {
    ccxtId: 'bybit',
    name: 'Bybit',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'bybitapp://',
    appDepositUrl: 'bybitapp://fiat/deposit',
    appStoreUrl: 'https://apps.apple.com/app/bybit-buy-trade-crypto/id1488296980',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.bybit.app',
    note: 'Depósito via PIX (P2P)',
  },
  bitget: {
    ccxtId: 'bitget',
    name: 'Bitget',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'bitget://',
    appDepositUrl: 'bitget://fiat/deposit',
    appStoreUrl: 'https://apps.apple.com/app/bitget-buy-bitcoin-crypto/id1442778704',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.bitget.exchange',
    note: 'Compra com PIX via parceiro',
  },
  kucoin: {
    ccxtId: 'kucoin',
    name: 'KuCoin',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'kucoin://',
    appDepositUrl: 'kucoin://fiat/deposit',
    appStoreUrl: 'https://apps.apple.com/app/kucoin-buy-bitcoin-crypto/id1378956601',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.kubi.kucoin',
    note: 'Compra com PIX disponível',
  },
  okx: {
    ccxtId: 'okx',
    name: 'OKX',
    supportsBRL: true,
    supportsPIX: true,
    appScheme: 'okx://',
    appDepositUrl: 'okx://buy',
    appStoreUrl: 'https://apps.apple.com/app/okx-buy-bitcoin-btc-crypto/id1327268470',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.okinc.okex.gp',
    note: 'PIX via P2P',
  },
  // Exchanges sem suporte a BRL
  kraken: {
    ccxtId: 'kraken',
    name: 'Kraken',
    supportsBRL: false,
    supportsPIX: false,
    appStoreUrl: 'https://apps.apple.com/app/kraken-buy-crypto-bitcoin/id1481947260',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.kraken.invest.app',
    note: 'Sem suporte a BRL/PIX',
  },
  coinbase: {
    ccxtId: 'coinbase',
    name: 'Coinbase',
    supportsBRL: false,
    supportsPIX: false,
    appScheme: 'coinbase://',
    appStoreUrl: 'https://apps.apple.com/app/coinbase-buy-bitcoin-ether/id886427730',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.coinbase.android',
    note: 'Sem suporte a PIX',
  },
  coinex: {
    ccxtId: 'coinex',
    name: 'CoinEx',
    supportsBRL: false,
    supportsPIX: false,
    appStoreUrl: 'https://apps.apple.com/app/coinex-buy-crypto-bitcoin/id1626498495',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.coinex.trade.play',
    note: 'Sem suporte a BRL',
  },
  gateio: {
    ccxtId: 'gateio',
    name: 'Gate.io',
    supportsBRL: false,
    supportsPIX: false,
    appStoreUrl: 'https://apps.apple.com/app/gate-io-buy-bitcoin-crypto/id1294998195',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.gateio.gateio',
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
