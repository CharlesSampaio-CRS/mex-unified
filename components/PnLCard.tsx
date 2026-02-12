'use client'

import React, { useMemo, useRef, useEffect } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useBalance } from '../contexts/BalanceContext'
import { useLanguage } from '../contexts/LanguageContext'

interface PnLCardProps {
  userId: string
  refreshTrigger?: number
}

/**
 * PnLCard - SIMPLIFICADO
 * 
 * Exibe PNL (Profit and Loss) calculado DIRETAMENTE dos dados do balance.
 * Usa change_24h de cada token para calcular o valor anterior.
 */
export default function PnLCard({ userId, refreshTrigger }: PnLCardProps) {
  const { data: balanceData, loading: balanceLoading } = useBalance()
  const { t, language } = useLanguage()
  
  // 💾 Mantém os valores anteriores durante o loading
  const previousPnlData = useRef<any>(null)

  // 🔍 Debug: Log para verificar idioma e traduções
  console.log('🌍 [PnLCard] Language:', language)
  console.log('📝 [PnLCard] Translation test:', t('pnl.title'), '|', t('pnl.currentBalance'))

  // 🚀 CÁLCULO DIRETO E SIMPLES do PNL
  const pnlData = useMemo(() => {
    // Se não tem dados E não está carregando, retorna null
    if (!balanceData && !balanceLoading) {
      return null
    }
    
    // Se está carregando mas não tem dados ainda, retorna null (primeira carga)
    if (balanceLoading && !balanceData) {
      return null
    }
    
    // Se está carregando mas já tem dados, mantém os dados anteriores
    if (balanceLoading && previousPnlData.current) {
      return previousPnlData.current
    }
    
    // Se não está carregando e não tem dados, retorna null
    if (!balanceData) {
      return null
    }

    try {
      // 1. Valor atual do portfolio
      const currentTotal = typeof balanceData.total_usd === 'string' 
        ? parseFloat(balanceData.total_usd) 
        : (balanceData.total_usd || 0)

      if (currentTotal === 0) {
        return null
      }

      // 2. Calcula o valor anterior usando change_24h
      let previousTotal = 0

      if (balanceData.exchanges) {
        for (const exchange of balanceData.exchanges) {
          if (!exchange.balances) continue

          // balances é um objeto, não array - precisa iterar sobre Object.values
          const balancesArray = Object.values(exchange.balances)
          for (const balance of balancesArray) {
            const currentValue = typeof balance.usd_value === 'string'
              ? parseFloat(balance.usd_value)
              : (balance.usd_value || 0)

            const change24hPercent = balance.change_24h || 0

            const previousValue = change24hPercent !== 0
              ? currentValue / (1 + (change24hPercent / 100))
              : currentValue

            previousTotal += previousValue
          }
        }
      }

      // 3. Calcula a mudança
      const change = currentTotal - previousTotal
      const changePercent = previousTotal !== 0 ? (change / previousTotal) * 100 : 0

      return {
        current: currentTotal,
        previous: previousTotal,
        change,
        changePercent,
        isProfit: change >= 0
      }
    } catch (error) {
      console.error('❌ [PnLCard] Erro no cálculo:', error)
      return previousPnlData.current || null
    }
  }, [balanceData, balanceLoading])
  
  // 💾 Atualiza a referência quando temos novos dados válidos
  useEffect(() => {
    if (pnlData && !balanceLoading) {
      previousPnlData.current = pnlData
    }
  }, [pnlData, balanceLoading])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  // Estados de loading e erro - APENAS na primeira carga
  if (!pnlData && balanceLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>{t('pnl.calculating')}</Text>
        </View>
      </View>
    )
  }

  if (!pnlData) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>📊</Text>
          <Text style={styles.errorText}>{t('pnl.noData')}</Text>
        </View>
      </View>
    )
  }

  const { current, previous, change, changePercent, isProfit } = pnlData

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('pnl.title')}</Text>
        <View style={styles.liveIndicator}>
          {balanceLoading ? (
            <View style={styles.refreshingIndicator}>
              <ActivityIndicator size="small" color="#10b981" />
              <Text style={styles.refreshingText}>{t('pnl.updating')}</Text>
            </View>
          ) : (
            <Text style={styles.liveText}>{t('pnl.live')}</Text>
          )}
        </View>
      </View>

      {/* Current Balance */}
      <View style={styles.currentBalance}>
        <Text style={styles.currentLabel}>{t('pnl.currentBalance')}</Text>
        <Text style={styles.currentValue}>{formatCurrency(current)}</Text>
      </View>

      {/* PNL Card */}
      <View style={[styles.pnlCard, isProfit ? styles.positive : styles.negative]}>
        <Text style={styles.pnlPeriod}>{t('pnl.last24h')}</Text>
        <Text style={[styles.pnlChange, { color: isProfit ? '#10b981' : '#ef4444' }]}>
          {isProfit ? '↗' : '↘'} {formatCurrency(Math.abs(change))}
        </Text>
        <Text style={[styles.pnlPercent, { color: isProfit ? '#10b981' : '#ef4444' }]}>
          {formatPercent(changePercent)}
        </Text>
        <Text style={styles.previousValue}>
          {t('pnl.previous')}: {formatCurrency(previous)}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  currentBalance: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  currentLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  currentValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
  },
  liveIndicator: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  refreshingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshingText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  pnlCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
  },
  positive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  negative: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  pnlPeriod: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  pnlChange: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  pnlPercent: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  previousValue: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
})
