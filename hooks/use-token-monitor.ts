import { useEffect, useRef, useState, useCallback } from 'react'
import { useNotifications } from '../contexts/NotificationsContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useAlerts } from '../contexts/AlertsContext'
import { notify } from '../services/notify'

// Função helper para formatar preços muito pequenos
const formatPrice = (price: number): string => {
  if (price === 0) return '0'
  
  // Para valores muito pequenos, mostra até 20 casas decimais e remove zeros à direita
  // Ex: 0.000000000023 → "0.000000000023"
  if (price < 0.01) {
    return price.toFixed(20).replace(/\.?0+$/, '')
  }
  
  // Para valores normais, mostra 4 casas decimais
  if (price < 1000) {
    return price.toFixed(4)
  }
  
  // Para valores grandes, mostra 2 casas decimais
  return price.toFixed(2)
}

interface TokenVariation {
  symbol: string
  exchange: string
  variation24h: number
  price: number
  previousPrice?: number
}

interface TokenMonitorConfig {
  symbol: string
  exchange: string
  thresholdPercentage: number // Ex: -10 para queda de 10%, +15 para subida de 15%
  enabled: boolean
}

// Configurações de monitoramento padrão
const DEFAULT_MONITORS: TokenMonitorConfig[] = [
  {
    symbol: 'REKTCOIN', // ✅ Nome correto do símbolo
    exchange: '', // Não precisa mais verificar exchange, busca por símbolo apenas
    thresholdPercentage: -1.5, // Alerta quando cair 1.5% (configurado para testes - atualmente em -1.80%)
    enabled: true
  },
  {
    symbol: 'BTC',
    exchange: '',
    thresholdPercentage: -5, // Alerta quando cair 5%
    enabled: true
  },
  {
    symbol: 'ETH',
    exchange: '',
    thresholdPercentage: -5, // Alerta quando cair 5%
    enabled: true
  }
]

export function useTokenMonitor(tokens: TokenVariation[]) {
  const { addNotification } = useNotifications()
  const { t } = useLanguage()
  const { alerts: customAlerts, getAlertsForToken, updateLastTriggered } = useAlerts()
  const previousVariations = useRef<Map<string, number>>(new Map())
  const notifiedTokens = useRef<Set<string>>(new Set()) // Evita notificações duplicadas
  const notifiedAlerts = useRef<Set<string>>(new Set()) // Evita notificações duplicadas de alertas customizados

  useEffect(() => {
    if (tokens.length === 0) return

    tokens.forEach(token => {
      const key = `${token.exchange}:${token.symbol}`
      const previousVariation = previousVariations.current.get(key)
      
      // ==================== VERIFICAÇÃO DE MONITORS PADRÃO ====================
      // Procura por uma configuração de monitoramento para este token
      // ✅ Se exchange estiver vazio no monitor, busca apenas por símbolo
      const monitor = DEFAULT_MONITORS.find(
        m => m.symbol === token.symbol && 
             (m.exchange === '' || token.exchange.toLowerCase().includes(m.exchange.toLowerCase())) && 
             m.enabled
      )

      if (monitor) {
        const hasAlerted = notifiedTokens.current.has(key)
        
        // Verifica se cruzou o threshold
        if (monitor.thresholdPercentage < 0) {
          // Monitorando quedas
          if (token.variation24h <= monitor.thresholdPercentage && !hasAlerted) {
            // Token caiu abaixo do threshold
            notify.tokenDrop(addNotification, {
              symbol: token.symbol,
              variation: token.variation24h,
              price: formatPrice(token.price),
            })
            notifiedTokens.current.add(key)
          } else if (token.variation24h > monitor.thresholdPercentage && hasAlerted) {
            // Token recuperou acima do threshold, remove o alerta
            notifiedTokens.current.delete(key)
          }
        } else {
          // Monitorando subidas
          if (token.variation24h >= monitor.thresholdPercentage && !hasAlerted) {
            // Token subiu acima do threshold
            notify.tokenRise(addNotification, {
              symbol: token.symbol,
              variation: token.variation24h,
              price: formatPrice(token.price),
            })
            notifiedTokens.current.add(key)
          } else if (token.variation24h < monitor.thresholdPercentage && hasAlerted) {
            // Token caiu abaixo do threshold, remove o alerta
            notifiedTokens.current.delete(key)
          }
        }

        // Detecta mudanças bruscas (mais de 5% de diferença em relação à última checagem)
        if (previousVariation !== undefined) {
          const variationDiff = Math.abs(token.variation24h - previousVariation)
          if (variationDiff >= 5) {
            const direction = token.variation24h > previousVariation ? 'up' : 'down'
            notify.tokenSuddenChange(addNotification, {
              symbol: token.symbol,
              variation: token.variation24h,
              price: formatPrice(token.price),
              direction,
            })
          }
        }
      }

      // ==================== VERIFICAÇÃO DE ALERTAS CUSTOMIZADOS ====================
      const tokenAlerts = getAlertsForToken(token.symbol, token.exchange)

      tokenAlerts.forEach(alert => {
        const alertKey = `${alert.id}:${key}`
        const hasAlerted = notifiedAlerts.current.has(alertKey)
        
        // Verifica se o alerta deve ser disparado
        let shouldAlert = false
        let alertTitle = ''
        let alertMessage = ''
        let alertType: 'warning' | 'success' | 'info' = 'info'
        let alertIcon = '🔔'
        
        if (alert.alertType === 'percentage') {
          // Alerta baseado em variação percentual
          // Para condição 'below', o value é tratado como negativo (ex: value=5 → queda de -5%)
          if (alert.condition === 'below') {
            const targetPercent = -Math.abs(alert.value)
            if (token.variation24h <= targetPercent && !hasAlerted) {
              shouldAlert = true
              alertTitle = `📉 ${token.symbol} Caiu ${Math.abs(alert.value)}%`
              alertMessage = `${token.symbol} caiu para ${token.variation24h.toFixed(2)}% (limite: ${targetPercent}%). Preço: $${formatPrice(token.price)}`
              alertType = 'warning'
              alertIcon = '⚠️'
            }
            // Remove alerta quando recuperou acima do threshold
            if (token.variation24h > targetPercent && hasAlerted) {
              notifiedAlerts.current.delete(alertKey)
            }
          } else if (alert.condition === 'above') {
            if (token.variation24h >= alert.value && !hasAlerted) {
              shouldAlert = true
              alertTitle = `📈 ${token.symbol} Acima de ${alert.value}%`
              alertMessage = `${token.symbol} subiu para ${token.variation24h.toFixed(2)}% (limite: ${alert.value}%). Preço: $${formatPrice(token.price)}`
              alertType = 'success'
              alertIcon = '🚀'
            }
            // Remove alerta quando caiu abaixo do threshold
            if (token.variation24h < alert.value && hasAlerted) {
              notifiedAlerts.current.delete(alertKey)
            }
          }
        } else {
          // Alerta baseado em preço absoluto
          if (alert.condition === 'below' && token.price <= alert.value) {
            shouldAlert = true
            alertTitle = `💰 ${token.symbol} Abaixo de $${formatPrice(alert.value)}`
            alertMessage = `${token.symbol} atingiu $${formatPrice(token.price)} (limite: $${formatPrice(alert.value)}). Variação: ${token.variation24h > 0 ? '▲' : '▼'} ${Math.abs(token.variation24h.toFixed(2))}%`
            alertType = 'warning'
            alertIcon = '📉'
          } else if (alert.condition === 'above' && token.price >= alert.value) {
            shouldAlert = true
            alertTitle = `💰 ${token.symbol} Acima de $${formatPrice(alert.value)}`
            alertMessage = `${token.symbol} atingiu $${formatPrice(token.price)} (limite: $${formatPrice(alert.value)}). Variação: ${token.variation24h > 0 ? '▲' : '▼'} ${Math.abs(token.variation24h.toFixed(2))}%`
            alertType = 'success'
            alertIcon = '🚀'
          }
          
          // Remove alerta quando a condição não é mais verdadeira
          if (alert.condition === 'below' && token.price > alert.value && hasAlerted) {
            notifiedAlerts.current.delete(alertKey)
          } else if (alert.condition === 'above' && token.price < alert.value && hasAlerted) {
            notifiedAlerts.current.delete(alertKey)
          }
        }
        
        if (shouldAlert && !hasAlerted) {
          addNotification({
            type: alertType,
            title: alertTitle,
            message: alertMessage,
            icon: alertIcon,
            data: {
              category: 'alert',
              action: 'custom_alert_triggered',
              symbol: token.symbol,
              alertId: alert.id,
              condition: alert.condition,
              value: alert.value,
            }
          })
          
          notifiedAlerts.current.add(alertKey)
          updateLastTriggered(alert.id)
        }
      })

      // Atualiza a variação anterior
      previousVariations.current.set(key, token.variation24h)
    })
  }, [tokens, addNotification, t, customAlerts, getAlertsForToken, updateLastTriggered])
}

// Hook para configurar alertas personalizados
export function useTokenAlertConfig() {
  const [configs, setConfigs] = useState<TokenMonitorConfig[]>(DEFAULT_MONITORS)

  const addAlert = useCallback((config: TokenMonitorConfig) => {
    setConfigs((prev: TokenMonitorConfig[]) => [...prev, config])
  }, [])

  const removeAlert = useCallback((symbol: string, exchange: string) => {
    setConfigs((prev: TokenMonitorConfig[]) => prev.filter((c: TokenMonitorConfig) => !(c.symbol === symbol && c.exchange === exchange)))
  }, [])

  const updateAlert = useCallback((symbol: string, exchange: string, updates: Partial<TokenMonitorConfig>) => {
    setConfigs((prev: TokenMonitorConfig[]) => prev.map((c: TokenMonitorConfig) => 
      c.symbol === symbol && c.exchange === exchange 
        ? { ...c, ...updates } 
        : c
    ))
  }, [])

  return {
    configs,
    addAlert,
    removeAlert,
    updateAlert
  }
}

