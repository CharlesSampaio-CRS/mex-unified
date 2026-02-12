import { useState, useEffect } from 'react'
import { currencyService } from '../services/currencyService'

interface UseCurrencyConversionResult {
  brlValue: number | null
  usdToBrlRate: number | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Hook para converter USD → BRL em tempo real
 * 
 * @param usdAmount - Valor em USD para converter
 * @param autoRefresh - Se true, atualiza automaticamente a cada 5 minutos (padrão: true)
 * 
 * @example
 * const { brlValue, usdToBrlRate, isLoading } = useCurrencyConversion(totalUsd)
 */
export function useCurrencyConversion(
  usdAmount: number | null | undefined,
  autoRefresh: boolean = true
): UseCurrencyConversionResult {
  const [brlValue, setBrlValue] = useState<number | null>(null)
  const [usdToBrlRate, setUsdToBrlRate] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConversion = async () => {
    if (!usdAmount || usdAmount <= 0) {
      setBrlValue(null)
      setUsdToBrlRate(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const rate = await currencyService.getUsdToBrlRate()
      const converted = usdAmount * rate

      setUsdToBrlRate(rate)
      setBrlValue(converted)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao converter moeda'
      setError(errorMessage)
      console.warn('⚠️ Conversão USD → BRL indisponível:', errorMessage)
      
      // Define valores como null para não exibir nada
      setBrlValue(null)
      setUsdToBrlRate(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchConversion()

    // Auto-refresh a cada 5 minutos se habilitado
    if (autoRefresh) {
      const interval = setInterval(fetchConversion, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [usdAmount, autoRefresh])

  return {
    brlValue,
    usdToBrlRate,
    isLoading,
    error,
    refresh: fetchConversion,
  }
}
