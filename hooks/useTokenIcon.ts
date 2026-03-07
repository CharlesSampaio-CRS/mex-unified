/**
 * useTokenIcon
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook que busca a icon_url de um token no MongoDB via
 * GET /api/v1/token-icons/{symbol}/url
 *
 * Estratégia:
 *  - Cache em memória de módulo (Map) → mesma URL válida não é re-buscada
 *    durante a sessão enquanto o componente está montado.
 *  - Tokens não encontrados NÃO são cacheados — toda vez que o componente
 *    montar (ex: pull-to-refresh, troca de tela) tenta novamente.
 *  - Silencia erros: nunca quebra a UI se o endpoint falhar.
 */

import { useState, useEffect, useRef } from 'react'
import { apiService } from '@/services/api'

// ─── Cache em memória — apenas URLs válidas ───────────────────────────────────
// Guarda somente ícones encontrados. Tokens sem ícone não entram aqui,
// então serão re-buscados quando o componente montar novamente.
const iconCache = new Map<string, string>()

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
  const initialUrl = cached ?? null
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

    // Se URL válida já está em cache, resolve imediatamente
    const cached = iconCache.get(upperSymbol)
    if (cached !== undefined) {
      setIconUrl(cached)
      setLoading(false)
      return
    }

    // Busca via API (não encontrado não vai para cache → tenta de novo na próxima montagem)
    let cancelled = false
    setLoading(true)

    apiService.getTokenIconUrl(upperSymbol)
      .then((url) => {
        if (cancelled) return
        if (url) iconCache.set(upperSymbol, url) // só cacheia se encontrou
        if (mountedRef.current) {
          setIconUrl(url)
          setLoading(false)
        }
      })
      .catch(() => {
        if (cancelled) return
        // não cacheia erro — tentará novamente na próxima montagem
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
 * Limpa o cache em memória (útil após logout ou pull-to-refresh manual)
 */
export function clearTokenIconCache() {
  iconCache.clear()
}
