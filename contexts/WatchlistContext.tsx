import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Chave para salvar a watchlist no AsyncStorage
const WATCHLIST_STORAGE_KEY = '@cryptohub:watchlist'

// Tipo para um token na watchlist
interface WatchlistToken {
  symbol: string      // Símbolo do token (ex: "BTC", "ETH")
  name?: string       // Nome opcional do token (ex: "Bitcoin")
  addedAt: string     // Timestamp de quando foi adicionado
}

// Interface do contexto
interface WatchlistContextData {
  watchlist: WatchlistToken[]
  addToken: (symbol: string, name?: string) => Promise<void>
  removeToken: (symbol: string) => Promise<void>
  isWatching: (symbol: string) => boolean
  clearWatchlist: () => Promise<void>
  loading: boolean
}

// Criação do contexto
const WatchlistContext = createContext<WatchlistContextData>({} as WatchlistContextData)

// Provider do contexto
export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [watchlist, setWatchlist] = useState<WatchlistToken[]>([])
  const [loading, setLoading] = useState(true)

  // Carregar watchlist do AsyncStorage ao iniciar
  useEffect(() => {
    loadWatchlist()
  }, [])

  // Função para carregar a watchlist do AsyncStorage
  const loadWatchlist = async () => {
    try {
      const stored = await AsyncStorage.getItem(WATCHLIST_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setWatchlist(parsed)
      }
    } catch (error) {
      console.warn('[WatchlistContext] Erro ao carregar watchlist:', error)
    } finally {
      setLoading(false)
    }
  }

  // Função para salvar a watchlist no AsyncStorage
  const saveWatchlist = async (newWatchlist: WatchlistToken[]) => {
    try {
      await AsyncStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(newWatchlist))
    } catch (error) {
      console.warn('[WatchlistContext] Erro ao salvar watchlist:', error)
    }
  }

  const addToken = useCallback(async (symbol: string, name?: string) => {
    const upperSymbol = symbol.toUpperCase()
    
    if (watchlist.some(token => token.symbol === upperSymbol)) {
      return
    }

    const newToken: WatchlistToken = {
      symbol: upperSymbol,
      name,
      addedAt: new Date().toISOString()
    }

    const newWatchlist = [...watchlist, newToken]
    setWatchlist(newWatchlist)
    await saveWatchlist(newWatchlist)
  }, [watchlist])

  const removeToken = useCallback(async (symbol: string) => {
    const upperSymbol = symbol.toUpperCase()
    const newWatchlist = watchlist.filter(token => token.symbol !== upperSymbol)
    setWatchlist(newWatchlist)
    await saveWatchlist(newWatchlist)
  }, [watchlist])

  // Verificar se um token está na watchlist
  const isWatching = useCallback((symbol: string) => {
    const upperSymbol = symbol.toUpperCase()
    return watchlist.some(token => token.symbol === upperSymbol)
  }, [watchlist])

  // Limpar toda a watchlist
  const clearWatchlist = useCallback(async () => {
    setWatchlist([])
    await AsyncStorage.removeItem(WATCHLIST_STORAGE_KEY)
  }, [])

  return (
    <WatchlistContext.Provider
      value={{
        watchlist,
        addToken,
        removeToken,
        isWatching,
        clearWatchlist,
        loading
      }}
    >
      {children}
    </WatchlistContext.Provider>
  )
}

// Hook para usar o contexto
export function useWatchlist() {
  const context = useContext(WatchlistContext)
  
  if (!context) {
    throw new Error('useWatchlist must be used within a WatchlistProvider')
  }
  
  return context
}
