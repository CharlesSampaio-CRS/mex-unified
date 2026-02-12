/**
 * Mapeamento centralizado dos logos das exchanges
 * Todos os logos são carregados no início para melhor performance
 */

export const exchangeLogos: Record<string, any> = {
  "binance": require("@/assets/binance.png"),
  "novadax": require("@/assets/novadax.png"),
  "mexc": require("@/assets/mexc.png"),
  "coinbase": require("@/assets/coinbase.png"),
  "coinex": require("@/assets/coinex.png"),
  "bitget": require("@/assets/bitget.png"),
  "kraken": require("@/assets/kraken.png"),
  "bybit": require("@/assets/bybit.png"),
  "gate.io": require("@/assets/gateio.png"),
  "gateio": require("@/assets/gateio.png"), // Alias
  "kucoin": require("@/assets/kucoin.png"),
  "okx": require("@/assets/okx.png"),
}

/**
 * Retorna o logo de uma exchange pelo nome (case-insensitive)
 */
export function getExchangeLogo(exchangeName: string): any {
  const key = exchangeName.toLowerCase().replace(/\s+/g, '')
  return exchangeLogos[key] || null
}

/**
 * Lista de todos os logos para pré-carregamento
 */
export const allExchangeLogos = Object.values(exchangeLogos)
