/**
 * Helper para normalizar dados de Exchange que podem vir em diferentes formatos
 */

import { Exchange, Balance, Token } from '@/types/api'

/**
 * Capitaliza o nome da exchange: "binance" → "Binance", "gate.io" → "Gate.io"
 * Usado em TODOS os pontos de exibição do app.
 */
export function capitalizeExchangeName(name: string): string {
  if (!name) return 'Unknown'
  // Nomes especiais que não seguem capitalização padrão
  const specialNames: Record<string, string> = {
    'okx': 'OKX',
    'mexc': 'MEXC',
    'htx': 'HTX',
    'gate.io': 'Gate.io',
    'gateio': 'Gate.io',
    'kucoin': 'KuCoin',
    'coinex': 'CoinEx',
    'bitget': 'Bitget',
    'bybit': 'Bybit',
    'binance': 'Binance',
    'coinbase': 'Coinbase',
    'kraken': 'Kraken',
    'novadax': 'NovaDAX',
  }
  const lower = name.toLowerCase().trim()
  if (specialNames[lower]) return specialNames[lower]
  // Fallback: capitalize primeira letra de cada palavra
  return lower.replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Obtém o ID da exchange de forma segura
 */
export function getExchangeId(exchange: Exchange): string {
  return exchange.exchange_id || exchange.exchange || exchange.name || 'unknown'
}

/**
 * Obtém o nome da exchange de forma segura (já capitalizado)
 */
export function getExchangeName(exchange: Exchange): string {
  const raw = exchange.name || exchange.exchange || exchange.exchange_id || 'Unknown'
  return capitalizeExchangeName(raw)
}

/**
 * Obtém o total_usd como número
 */
export function getTotalUsd(exchange: Exchange): number {
  const value = exchange.total_usd
  if (typeof value === 'number') return value
  return parseFloat(value || '0')
}

/**
 * Obtém os balances ou tokens de forma unificada
 * Converte estrutura nova (balances) para estrutura antiga (tokens) para compatibilidade
 */
export function getExchangeBalances(exchange: Exchange): Record<string, any> {
  // Se tem balances (nova estrutura), converte para formato de tokens
  if (exchange.balances) {
    const tokens: Record<string, any> = {}
    Object.entries(exchange.balances).forEach(([symbol, balance]) => {
      tokens[symbol] = {
        amount: balance.total?.toString() || '0',
        total: balance.total || 0,           // 🆕 Total
        free: balance.free || 0,             // 🆕 Disponível
        used: balance.used || 0,             // 🆕 Em ordens
        price_usd: balance.usd_value && balance.total 
          ? (balance.usd_value / balance.total).toString() 
          : '0',
        value_usd: balance.usd_value?.toString() || '0',
        usd_value: balance.usd_value || 0,   // 🆕 Adiciona também como número
        change_24h: balance.change_24h ?? null,  // ✅ Mantém como número (não converte para string)
        // Mantém dados originais também
        _original: balance
      }
    })
    return tokens
  }
  
  // Se tem tokens (estrutura antiga), retorna diretamente
  return exchange.tokens || {}
}

/**
 * Verifica se a exchange foi carregada com sucesso
 */
export function isExchangeSuccess(exchange: Exchange): boolean {
  return exchange.success !== false
}
