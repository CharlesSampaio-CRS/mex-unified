/**
 * useTokenIcon
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook que busca a icon_url de um token no MongoDB via
 * GET /api/v1/token-icons/{symbol}/url
 *
 * Estratégia:
 *  - Cache em memória de módulo (Map) → mesma URL não é re-buscada durante
 *    a sessão, mesmo se o componente for desmontado e remontado.
 *  - Sentinel "NOT_FOUND" armazenado para não repetir chamadas frustradas.
 *  - Silencia erros: nunca quebra a UI se o endpoint falhar.
 */

import { useState, useEffect, useRef } from 'react'
import { apiService } from '@/services/api'

// ─── Cache em memória de módulo (sobrevive re-renders e re-mounts) ────────────
// Valores possíveis:
//   string  → URL válida do ícone
//   'NOT_FOUND' → já tentamos, não existe
//   undefined   → ainda não tentamos
const iconCache = new Map<string, string>()

const NOT_FOUND = '__NOT_FOUND__'

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseTokenIconResult {
  /** URL do ícone (string) ou null se não encontrado / ainda carregando */
  iconUrl: string | null
  /** true enquanto a primeira requisição está em andamento */
  loading: boolean
}

/**
 * @param symbol  Símbolo do token em qualquer case (ex: 'BTC', 'eth', 'DOGE')
 * @param enabled Passa false para desabilitar a busca (útil em listas grandes)
 */
export function useTokenIcon(
  symbol: string | null | undefined,
  enabled: boolean = true,
): UseTokenIconResult {
  const upperSymbol = symbol?.toUpperCase() ?? ''

  // Resolve estado inicial a partir do cache (evita flash de loading)
  const cached = upperSymbol ? iconCache.get(upperSymbol) : undefined
  const initialUrl = cached && cached !== NOT_FOUND ? cached : null
  const alreadyResolved = cached !== undefined

  const [iconUrl, setIconUrl] = useState<string | null>(initialUrl)
  const [loading, setLoading] = useState(!alreadyResolved && !!upperSymbol && enabled)

  // Ref para cancelar setState após desmontagem
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

    // Se já está em cache, resolve imediatamente
    const cached = iconCache.get(upperSymbol)
    if (cached !== undefined) {
      setIconUrl(cached !== NOT_FOUND ? cached : null)
      setLoading(false)
      return
    }

    // Busca via API
    let cancelled = false
    setLoading(true)

    apiService.getTokenIconUrl(upperSymbol)
      .then((url) => {
        if (cancelled) return
        const value = url ?? NOT_FOUND
        iconCache.set(upperSymbol, value)
        if (mountedRef.current) {
          setIconUrl(url)
          setLoading(false)
        }
      })
      .catch(() => {
        if (cancelled) return
        iconCache.set(upperSymbol, NOT_FOUND)
        if (mountedRef.current) {
          setIconUrl(null)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [upperSymbol, enabled])

  return { iconUrl, loading }
}

/**
 * Limpa o cache em memória (útil em testes ou após logout)
 */
export function clearTokenIconCache() {
  iconCache.clear()
}
