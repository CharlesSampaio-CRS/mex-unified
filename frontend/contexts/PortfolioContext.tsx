import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { PortfolioEvolutionResponse } from '@/types/api'
import { useAuth } from './AuthContext'

interface PortfolioContextType {
  evolutionData: PortfolioEvolutionResponse | null
  loading: boolean
  error: string | null
  refreshEvolution: (days?: number) => Promise<void>
  currentPeriod: number
  cachedData: Map<number, PortfolioEvolutionResponse>
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined)

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [evolutionData, setEvolutionData] = useState<PortfolioEvolutionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPeriod, setCurrentPeriod] = useState(7)
  const [cachedData, setCachedData] = useState<Map<number, PortfolioEvolutionResponse>>(new Map())

  // 🔄 REMOVIDO: Evolution data agora vem do WatermelonDB local (pnlService.getEvolutionData)
  // Este contexto não é mais necessário para evolution, mas mantido para compatibilidade
  const loadEvolutionData = useCallback(async (days: number, showLoading = true) => {
    if (showLoading) setLoading(false)
  }, [user?.id, cachedData])

  // 🔄 REMOVIDO: Dados agora são carregados diretamente do WatermelonDB em cada componente
  const loadAllPeriods = useCallback(async () => {
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      loadAllPeriods()
    }
  }, [user?.id, loadAllPeriods])

  // 🔄 REMOVIDO: useEffect do portfolioVersion (cache invalidation não é mais necessário)

  const refreshEvolution = useCallback(async (days?: number) => {
    const daysToUse = days !== undefined ? days : currentPeriod
    
    if (days === undefined || days === currentPeriod) {
      setCachedData(prev => {
        const newCache = new Map(prev)
        newCache.delete(daysToUse)
        return newCache
      })
      await loadEvolutionData(daysToUse, false)
      return
    }
    
    if (cachedData.has(days)) {
      const cached = cachedData.get(days)!
      setEvolutionData(cached)
      setCurrentPeriod(days)
      return
    }
    
    await loadEvolutionData(days, true)
  }, [loadEvolutionData, currentPeriod, cachedData])

  const value = useMemo(() => ({
    evolutionData,
    loading,
    error,
    refreshEvolution,
    currentPeriod,
    cachedData
  }), [evolutionData, loading, error, refreshEvolution, currentPeriod, cachedData])

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  const context = useContext(PortfolioContext)
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider')
  }
  return context
}
