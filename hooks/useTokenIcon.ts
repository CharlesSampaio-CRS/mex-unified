/**
 * useTokenIcon
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook que busca a icon_url de um token no MongoDB via
 * GET /api/v1/token-icons/{symbol}/url
 *
 * Sem cache em memória — o MongoDB é a fonte de verdade.
 * O React Native cacheia automaticamente as imagens pelo HTTP cache do SO,
 * então não há custo extra de rede para ícones já exibidos.
 */

import { useState, useEffect, useRef } from 'react'
import { apiService } from '@/services/api'

interface UseTokenIconResult {
  iconUrl: string | null
  loading: boolean
}

export function useTokenIcon(
  symbol: string | null | undefined,
  enabled: boolean = true,
): UseTokenIconResult {
  const upperSymbol = symbol?.toUpperCase() ?? ''

  const [iconUrl, setIconUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!upperSymbol && enabled)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!upperSymbol || !enabled) {
      setIconUrl(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    apiService.getTokenIconUrl(upperSymbol)
      .then((url) => {
        if (cancelled || !mountedRef.current) return
        setIconUrl(url)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled || !mountedRef.current) return
        setIconUrl(null)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [upperSymbol, enabled])

  return { iconUrl, loading }
}

export function clearTokenIconCache() {
  // sem cache em memória — no-op mantido para compatibilidade
}
