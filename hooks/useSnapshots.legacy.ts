import { useState, useEffect } from 'react'
// import { snapshotService, SnapshotStats } from '../services/snapshot-service' // ⚠️ DESABILITADO: snapshot-service foi removido

/**
 * ⚠️ LEGACY HOOK - Não mais utilizado
 * 
 * useSnapshots Hookt { useState, useEffect, useCallback } from 'react'
import { snapshotService, SnapshotStats } from '../services/snapshot-service'

/**
 * useSnapshots Hook
 * 
 * Hook React para gerenciar snapshots de balanço
 * 
 * @example
 * ```tsx
 * const { stats, createSnapshot, loading } = useSnapshots('user-123')
 * 
 * // Criar snapshot manual
 * await createSnapshot()
 * 
 * // Ver estatísticas
 * console.log(stats?.dailyChange)
 * ```
 */

export function useSnapshots(userId: string) {
  const [stats, setStats] = useState<SnapshotStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSnapshotTime, setLastSnapshotTime] = useState<Date | null>(null)

  // Carregar estatísticas
  const loadStats = useCallback(async () => {
    if (!userId) return

    try {
      setLoading(true)
      setError(null)
      const data = await snapshotService.getStats(userId)
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar stats')
      console.error('Erro ao carregar stats:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Carregar último snapshot
  const loadLastSnapshot = useCallback(async () => {
    if (!userId) return

    try {
      const snapshot = await snapshotService.getLatestSnapshot(userId)
      if (snapshot) {
        setLastSnapshotTime(new Date(snapshot.timestamp))
      }
    } catch (err) {
      console.error('Erro ao carregar último snapshot:', err)
    }
  }, [userId])

  // Criar snapshot manual
  const createSnapshot = useCallback(async () => {
    if (!userId) return false

    try {
      setLoading(true)
      setError(null)
      const snapshot = await snapshotService.createSnapshotFromHistory(userId)
      
      if (snapshot) {
        await loadStats()
        await loadLastSnapshot()
        return true
      }
      return false
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar snapshot')
      console.error('Erro ao criar snapshot:', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [userId, loadStats, loadLastSnapshot])

  // Exportar para CSV
  const exportCSV = useCallback(async () => {
    if (!userId) return null

    try {
      const csv = await snapshotService.exportToCSV(userId)
      return csv
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar CSV')
      console.error('Erro ao exportar CSV:', err)
      return null
    }
  }, [userId])

  // Limpar snapshots antigos
  const cleanOldSnapshots = useCallback(async (daysToKeep: number = 365) => {
    if (!userId) return 0

    try {
      setLoading(true)
      const count = await snapshotService.cleanOldSnapshots(userId, daysToKeep)
      await loadStats()
      return count
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao limpar snapshots')
      console.error('Erro ao limpar snapshots:', err)
      return 0
    } finally {
      setLoading(false)
    }
  }, [userId, loadStats])

  // Inicializar snapshots automáticos
  const enableAutoSnapshot = useCallback(() => {
    if (!userId) return () => {}

    const cancel = snapshotService.scheduleDailySnapshot(userId)
    return cancel
  }, [userId])

  // Carregar dados ao montar
  useEffect(() => {
    loadStats()
    loadLastSnapshot()
  }, [loadStats, loadLastSnapshot])

  return {
    stats,
    loading,
    error,
    lastSnapshotTime,
    createSnapshot,
    exportCSV,
    cleanOldSnapshots,
    enableAutoSnapshot,
    refresh: loadStats,
  }
}

/**
 * useSnapshotScheduler Hook
 * 
 * Hook para gerenciar agendamento automático de snapshots
 * 
 * @example
 * ```tsx
 * const { enabled, toggle } = useSnapshotScheduler('user-123')
 * ```
 */

export function useSnapshotScheduler(userId: string) {
  const [enabled, setEnabled] = useState(false)
  const [cancelFn, setCancelFn] = useState<(() => void) | null>(null)

  const enable = useCallback(() => {
    if (enabled || !userId) return

    const cancel = snapshotService.scheduleDailySnapshot(userId)
    setCancelFn(() => cancel)
    setEnabled(true)
  }, [enabled, userId])

  const disable = useCallback(() => {
    if (!enabled || !cancelFn) return

    cancelFn()
    setCancelFn(null)
    setEnabled(false)
  }, [enabled, cancelFn])

  const toggle = useCallback(() => {
    if (enabled) {
      disable()
    } else {
      enable()
    }
  }, [enabled, enable, disable])

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (cancelFn) {
        cancelFn()
      }
    }
  }, [cancelFn])

  return {
    enabled,
    enable,
    disable,
    toggle,
  }
}
