import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { snapshotService, SnapshotStats } from '../services/snapshot-service'

/**
 * SnapshotManager Component
 * 
 * Gerencia snapshots de balanço:
 * - Cria snapshots manuais
 * - Mostra estatísticas
 * - Agenda snapshots automáticos
 * - Exporta dados
 */

interface SnapshotManagerProps {
  userId: string
}

export default function SnapshotManager({ userId }: SnapshotManagerProps) {
  const [stats, setStats] = useState<SnapshotStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastSnapshotTime, setLastSnapshotTime] = useState<string>('')
  const [autoSnapshotEnabled, setAutoSnapshotEnabled] = useState(false)
  const [cancelAutoSnapshot, setCancelAutoSnapshot] = useState<(() => void) | null>(null)

  // Carregar estatísticas ao montar
  useEffect(() => {
    loadStats()
    loadLastSnapshot()
  }, [userId])

  const loadStats = async () => {
    try {
      const data = await snapshotService.getStats(userId)
      setStats(data)
    } catch (error) {
      console.error('Erro ao carregar stats:', error)
    }
  }

  const loadLastSnapshot = async () => {
    try {
      const snapshot = await snapshotService.getLatestSnapshot(userId)
      if (snapshot) {
        const date = new Date(snapshot.timestamp)
        setLastSnapshotTime(date.toLocaleString())
      }
    } catch (error) {
      console.error('Erro ao carregar último snapshot:', error)
    }
  }

  const handleCreateSnapshot = async () => {
    setLoading(true)
    try {
      const snapshot = await snapshotService.createSnapshotFromHistory(userId)
      if (snapshot) {
        alert('✅ Snapshot criado com sucesso!')
        await loadStats()
        await loadLastSnapshot()
      } else {
        alert('⚠️ Nenhum balanço encontrado para criar snapshot')
      }
    } catch (error) {
      console.error('Erro ao criar snapshot:', error)
      alert('❌ Erro ao criar snapshot')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAutoSnapshot = () => {
    if (autoSnapshotEnabled) {
      // Desabilitar
      if (cancelAutoSnapshot) {
        cancelAutoSnapshot()
        setCancelAutoSnapshot(null)
      }
      setAutoSnapshotEnabled(false)
      alert('⏹️ Snapshot automático desabilitado')
    } else {
      // Habilitar
      const cancel = snapshotService.scheduleDailySnapshot(userId)
      setCancelAutoSnapshot(() => cancel)
      setAutoSnapshotEnabled(true)
      alert('✅ Snapshot automático habilitado! (Diariamente às 00:00)')
    }
  }

  const handleExportCSV = async () => {
    try {
      const csv = await snapshotService.exportToCSV(userId)
      
      // Criar blob e download
      if (typeof window !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `snapshots_${userId}_${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)
        alert('✅ CSV exportado!')
      }
    } catch (error) {
      console.error('Erro ao exportar CSV:', error)
      alert('❌ Erro ao exportar CSV')
    }
  }

  const handleCleanOld = async () => {
    setLoading(true)
    try {
      const count = await snapshotService.cleanOldSnapshots(userId, 365)
      alert(`🗑️ ${count} snapshots antigos removidos`)
      await loadStats()
    } catch (error) {
      console.error('Erro ao limpar snapshots:', error)
      alert('❌ Erro ao limpar snapshots')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📸 Snapshot Manager</Text>
        <Text style={styles.subtitle}>Histórico de Balanços</Text>
      </View>

      {/* Estatísticas */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Balanço Atual</Text>
            <Text style={styles.statValue}>{formatCurrency(stats.todayTotal)}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Mudança Diária</Text>
            <Text style={[
              styles.statValue,
              stats.dailyChange >= 0 ? styles.positive : styles.negative
            ]}>
              {formatCurrency(stats.dailyChange)}
            </Text>
            <Text style={[
              styles.statPercent,
              stats.dailyChange >= 0 ? styles.positive : styles.negative
            ]}>
              {formatPercent(stats.dailyChangePercent)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Mudança Semanal</Text>
            <Text style={[
              styles.statValue,
              stats.weeklyChange >= 0 ? styles.positive : styles.negative
            ]}>
              {formatCurrency(stats.weeklyChange)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Mudança Mensal</Text>
            <Text style={[
              styles.statValue,
              stats.monthlyChange >= 0 ? styles.positive : styles.negative
            ]}>
              {formatCurrency(stats.monthlyChange)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>All Time High</Text>
            <Text style={[styles.statValue, styles.positive]}>
              {formatCurrency(stats.allTimeHigh)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>All Time Low</Text>
            <Text style={[styles.statValue, styles.negative]}>
              {formatCurrency(stats.allTimeLow)}
            </Text>
          </View>
        </View>
      )}

      {/* Info do último snapshot */}
      {lastSnapshotTime && (
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Último Snapshot:</Text>
          <Text style={styles.infoValue}>{lastSnapshotTime}</Text>
        </View>
      )}

      {/* Ações */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreateSnapshot}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>📸 Criar Snapshot Manual</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, autoSnapshotEnabled && styles.buttonActive]}
          onPress={handleToggleAutoSnapshot}
        >
          <Text style={styles.buttonText}>
            {autoSnapshotEnabled ? '⏹️ Desabilitar Auto-Snapshot' : '⏰ Habilitar Auto-Snapshot'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buttonSecondary}
          onPress={handleExportCSV}
        >
          <Text style={styles.buttonText}>📊 Exportar CSV</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.buttonSecondary, loading && styles.buttonDisabled]}
          onPress={handleCleanOld}
          disabled={loading}
        >
          <Text style={styles.buttonText}>🗑️ Limpar Snapshots Antigos</Text>
        </TouchableOpacity>
      </View>

      {/* Instruções */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>ℹ️ Como Funciona:</Text>
        <Text style={styles.instructionsText}>
          • <Text style={styles.bold}>Snapshot Manual:</Text> Cria um snapshot do balanço atual{'\n'}
          • <Text style={styles.bold}>Auto-Snapshot:</Text> Cria snapshot automático diariamente às 00:00{'\n'}
          • <Text style={styles.bold}>Exportar CSV:</Text> Baixa histórico completo em CSV{'\n'}
          • <Text style={styles.bold}>Limpar Antigos:</Text> Remove snapshots com mais de 365 dias
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statsContainer: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    minWidth: '47%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statPercent: {
    fontSize: 14,
    marginTop: 4,
  },
  positive: {
    color: '#10b981',
  },
  negative: {
    color: '#ef4444',
  },
  infoCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: '#10b981',
  },
  buttonSecondary: {
    backgroundColor: '#6b7280',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  bold: {
    fontWeight: '600',
    color: '#333',
  },
})
