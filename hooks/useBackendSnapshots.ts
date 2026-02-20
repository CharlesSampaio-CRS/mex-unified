import { useState, useEffect, useCallback } from 'react'
import { backendSnapshotService, PnLSummary, BackendSnapshot } from '../services/backend-snapshot-service'

/**
 * Hook para gerenciar snapshots e PNL do backend (MongoDB)
 * 
 * Uso:
 * ```tsx
 * const { snapshots, pnl, loading, error, refresh, saveSnapshot } = useBackendSnapshots()
 * 
 * // Exibir PNL
 * <Text>PNL 24h: ${pnl?.today.change.toFixed(2)} ({pnl?.today.changePercent.toFixed(2)}%)</Text>
 * 
 * // Salvar snapshot manual
 * await saveSnapshot()
 * ```
 */
export function useBackendSnapshots(currentBalance?: number) {
  const [snapshots, setSnapshots] = useState<BackendSnapshot[]>([])
  const [pnl, setPnl] = useState<PnLSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Busca snapshots e calcula PNL
   */
  const fetchSnapshots = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const data = await backendSnapshotService.getSnapshots()
      setSnapshots(data)
      
      // Calcula PNL se houver balance atual
      if (currentBalance !== undefined && currentBalance > 0) {
        const pnlData = await backendSnapshotService.calculatePnL(currentBalance)
        setPnl(pnlData)
      }
    } catch (err: any) {
      console.error('❌ Erro ao buscar snapshots:', err)
      setError(err.message || 'Falha ao carregar snapshots')
    } finally {
      setLoading(false)
    }
  }, [currentBalance])

  /**
   * Salva snapshot manualmente
   */
  const saveSnapshot = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      await backendSnapshotService.saveSnapshot()
      
      // Recarrega snapshots após salvar
      await fetchSnapshots()
      
      return { success: true }
    } catch (err: any) {
      console.error('❌ Erro ao salvar snapshot:', err)
      setError(err.message || 'Falha ao salvar snapshot')
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [fetchSnapshots])

  /**
   * Busca estatísticas dos snapshots
   */
  const getStats = useCallback(async () => {
    try {
      return await backendSnapshotService.getStats()
    } catch (err: any) {
      console.error('❌ Erro ao buscar estatísticas:', err)
      return null
    }
  }, [])

  /**
   * Busca dados de evolução para o gráfico
   */
  const getEvolutionData = useCallback(async (days: number = 7) => {
    try {
      return await backendSnapshotService.getEvolutionData(days)
    } catch (err: any) {
      console.error('❌ Erro ao buscar dados de evolução:', err)
      return { values_usd: [], timestamps: [] }
    }
  }, [])

  /**
   * Recarrega dados
   */
  const refresh = useCallback(async () => {
    await fetchSnapshots()
  }, [fetchSnapshots])

  // Carrega snapshots automaticamente quando o hook é montado
  useEffect(() => {
    fetchSnapshots()
  }, [fetchSnapshots])

  return {
    snapshots,
    pnl,
    loading,
    error,
    refresh,
    saveSnapshot,
    getStats,
    getEvolutionData,
  }
}
