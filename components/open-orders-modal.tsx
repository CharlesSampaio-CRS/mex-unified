import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Alert, ActivityIndicator } from "react-native"
import { useState, useEffect, useRef } from "react"
import { useTheme } from "../contexts/ThemeContext"
import { useLanguage } from "../contexts/LanguageContext"
import { useBalance } from "../contexts/BalanceContext"
import { typography, fontWeights } from "../lib/typography"
import { OpenOrder } from "../types/orders"
import { apiService } from "../services/api"
import { ordersSyncService } from "../services/orders-sync"
import { orderOperationsService } from "../services/order-operations"
import { AnimatedLogoIcon } from "./AnimatedLogoIcon"

// ❌ Cache removido - sempre busca dados atualizados

interface OpenOrdersModalProps {
  visible: boolean
  onClose: () => void
  exchangeId: string
  exchangeName: string
  userId: string
  onSelectOrder: (order: OpenOrder) => void
  onOrderCancelled?: () => void  // Callback chamado após cancelamento de ordem
}

export function OpenOrdersModal({ 
  visible, 
  onClose, 
  exchangeId, 
  exchangeName,
  userId,
  onSelectOrder,
  onOrderCancelled
}: OpenOrdersModalProps) {
  const { colors } = useTheme()
  const { t, language } = useLanguage()
  const { refresh: refreshBalance } = useBalance()
  const [orders, setOrders] = useState<OpenOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [confirmCancelVisible, setConfirmCancelVisible] = useState(false)
  const [orderToCancel, setOrderToCancel] = useState<OpenOrder | null>(null)
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [confirmCancelAllVisible, setConfirmCancelAllVisible] = useState(false)
  const [cancellingAll, setCancellingAll] = useState(false)
  const [menuOpenForOrderId, setMenuOpenForOrderId] = useState<string | null>(null)
  
  // Estados para modal de cancelamento individual
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [showErrorDetail, setShowErrorDetail] = useState(false)
  
  // Estados para modal de cancelar todas
  const [cancelAllLoading, setCancelAllLoading] = useState(false)
  const [cancelAllError, setCancelAllError] = useState<string | null>(null)
  const [showCancelAllErrorDetail, setShowCancelAllErrorDetail] = useState(false)

  useEffect(() => {
    if (visible && exchangeId) {
      loadOrders()
    }
  }, [visible, exchangeId])

  const loadOrders = async () => {
    
    setLoading(true)
    setError(null)
    
    try {
      // ✅ Novo fluxo: usa credentials locais criptografadas
      const response = await ordersSyncService.fetchOrders(userId)
      
      if (!response) {
        setError('Erro ao buscar ordens')
        setOrders([])
        setLastUpdate(new Date())
        return
      }
      
      // Filtra ordens da exchange selecionada
      const exchangeOrders = response.orders.filter(order => 
        order.exchange_id === exchangeId || order.exchange === exchangeId
      )
      
      setOrders(exchangeOrders)
      setLastUpdate(new Date())
      
      
    } catch (err: any) {
      console.error('❌ Erro ao carregar ordens:', err)
      setError(err.message || 'Erro ao carregar ordens')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const getOrderTypeColor = (type: string) => {
    switch (type) {
      case 'limit': return '#3b82f6'
      case 'market': return '#10b981'
      case 'stop_loss': return '#ef4444'
      case 'stop_loss_limit': return '#f59e0b'
      default: return colors.textSecondary
    }
  }

  const getSideColor = (side: string) => {
    return side === 'buy' ? '#10b981' : '#ef4444'
  }
  
  // Função para extrair informações de erro estruturado de todas as exchanges
  const parseErrorResponse = (error: string | null): { code?: string, message: string, raw?: any } => {
    if (!error) return { message: '' }
    
    // 1. Verifica se o erro tem prefixo de exchange (ex: "bybit {...}", "binance {...}")
    const exchangePrefixMatch = error.match(/^(\w+)\s+(\{.+\})$/)
    if (exchangePrefixMatch) {
      const exchangeName = exchangePrefixMatch[1]
      const jsonStr = exchangePrefixMatch[2]
      try {
        const jsonObj = JSON.parse(jsonStr)
        
        // Bybit: retCode + retMsg
        if (jsonObj.retCode !== undefined && jsonObj.retMsg) {
          return {
            code: String(jsonObj.retCode),
            message: jsonObj.retMsg,
            raw: jsonObj
          }
        }
        
        // Binance: code + msg
        if (jsonObj.code !== undefined && jsonObj.msg) {
          return {
            code: String(jsonObj.code),
            message: jsonObj.msg,
            raw: jsonObj
          }
        }
        
        // Padrão genérico: code + message
        if (jsonObj.code !== undefined && jsonObj.message) {
          return {
            code: String(jsonObj.code),
            message: jsonObj.message,
            raw: jsonObj
          }
        }
      } catch (e) {
        // Se falhar ao parsear, continua para as outras tentativas
      }
    }
    
    try {
      // 2. Tenta parsear como JSON direto
      const jsonObj = JSON.parse(error)
      
      // Bybit: retCode + retMsg
      if (jsonObj.retCode !== undefined && jsonObj.retMsg) {
        return {
          code: String(jsonObj.retCode),
          message: jsonObj.retMsg,
          raw: jsonObj
        }
      }
      
      // Binance: code + msg
      if (jsonObj.code !== undefined && jsonObj.msg) {
        return {
          code: String(jsonObj.code),
          message: jsonObj.msg,
          raw: jsonObj
        }
      }
      
      // OKX, Kraken, Coinbase: code + message
      if (jsonObj.code !== undefined && jsonObj.message) {
        return {
          code: String(jsonObj.code),
          message: jsonObj.message,
          raw: jsonObj
        }
      }
      
      // KuCoin: code + msg
      if (jsonObj.code !== undefined && jsonObj.msg) {
        return {
          code: String(jsonObj.code),
          message: jsonObj.msg,
          raw: jsonObj
        }
      }
      
      // Gate.io: label + message
      if (jsonObj.label && jsonObj.message) {
        return {
          code: jsonObj.label,
          message: jsonObj.message,
          raw: jsonObj
        }
      }
      
      // Padrão error_code + error_message
      if (jsonObj.error_code !== undefined && jsonObj.error_message) {
        return {
          code: String(jsonObj.error_code),
          message: jsonObj.error_message,
          raw: jsonObj
        }
      }
      
      // Padrão error + error_description
      if (jsonObj.error && jsonObj.error_description) {
        return {
          code: jsonObj.error,
          message: jsonObj.error_description,
          raw: jsonObj
        }
      }
      
      // MEXC: error + details
      if (jsonObj.error && jsonObj.details) {
        return {
          message: jsonObj.details,
          raw: jsonObj
        }
      }
      
      // Se tem apenas details
      if (jsonObj.details) {
        return { message: jsonObj.details, raw: jsonObj }
      }
      
      // Se tem apenas message
      if (jsonObj.message) {
        return { message: jsonObj.message, raw: jsonObj }
      }
      
      // Se tem apenas msg
      if (jsonObj.msg) {
        return { message: jsonObj.msg, raw: jsonObj }
      }
      
      // Se não reconhecer o padrão, retorna o objeto completo como raw
      return { message: error, raw: jsonObj }
    } catch {
      // 3. Se não for JSON, retorna como está
      return { message: error }
    }
  }
  
  // Função para formatar erro (tenta parsear JSON)
  const formatError = (error: string | null): string => {
    if (!error) return ''
    
    try {
      // Tenta parsear como JSON
      const jsonObj = JSON.parse(error)
      return JSON.stringify(jsonObj, null, 2)
    } catch {
      // Se não for JSON, retorna como está
      return error
    }
  }

  // Função auxiliar para obter ID único da ordem
  const getOrderId = (order: OpenOrder): string => {
    return order.id || `${order.symbol}-${order.timestamp}`
  }

  const handleCancelOrder = async (order: OpenOrder) => {
    console.log('🔍 [OpenOrdersModal] handleCancelOrder chamado:', {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side
    })
    // Abre o modal de confirmação
    setOrderToCancel(order)
    setConfirmCancelVisible(true)
    console.log('✅ [OpenOrdersModal] Modal de confirmação aberto')
  }

  const confirmCancelOrder = async () => {
    if (!orderToCancel) {
      console.log('⚠️ [OpenOrdersModal] Nenhuma ordem para cancelar')
      return
    }
    
    console.log('🔍 [OpenOrdersModal] Cancelando ordem:', { 
      orderId: orderToCancel.id, 
      symbol: orderToCancel.symbol,
      side: orderToCancel.side
    })
    
    setCancelLoading(true)
    setCancelError(null)
    setCancellingOrderId(orderToCancel.id)
    
    try {
      // ✅ Usa orderOperationsService que já cria a notificação automaticamente
      const result = await orderOperationsService.cancelOrder({
        userId,
        exchangeId,
        orderId: orderToCancel.id,
        symbol: orderToCancel.symbol
      })
      
      const isSuccess = result.success === true || (!result.error && !result.success)
      
      if (isSuccess) {
        console.log('✅ [OpenOrdersModal] Ordem cancelada com sucesso')
        
        // ✅ REMOÇÃO OTIMISTA: Remove da lista IMEDIATAMENTE
        setOrders(prev => prev.filter(o => o.id !== orderToCancel.id))
        
        // ✅ FEEDBACK IMEDIATO: Fecha modais
        setConfirmCancelVisible(false)
        onClose()
        setCancelLoading(false)
        setCancellingOrderId(null)
        
        // Atualiza em background (silencioso)
        refreshBalance().catch(console.error)
        
        // Chama callback se existir
        if (onOrderCancelled) {
          onOrderCancelled()
        }
      } else {
        // ❌ API retornou success=false (erro lógico)
        console.error('❌ [OpenOrdersModal] API retornou success=false:', result)
        const errorMsg = result.error || result.message || 'Erro ao cancelar ordem'
        setCancelError(errorMsg)
        setCancelLoading(false)
        // Modal de confirmação fica aberto mostrando o erro
      }
    } catch (error: any) {
      // ❌ Erro de rede, timeout, ou HTTP 400/500
      console.error('❌ [OpenOrdersModal] Erro ao cancelar:', error)
      console.error('❌ [OpenOrdersModal] Stack:', error.stack)
      
      // Mensagem de erro mais específica
      let errorMessage = 'Erro desconhecido ao cancelar ordem'
      if (error.message) {
        // Se a mensagem já vem da API (erro HTTP 400/500), usa ela
        errorMessage = error.message
      } else if (error.toString().includes('timeout')) {
        errorMessage = 'Timeout: A exchange não respondeu a tempo'
      } else if (error.toString().includes('network')) {
        errorMessage = 'Erro de rede: Verifique sua conexão'
      }
      
      setCancelError(errorMessage)
      setCancelLoading(false)
      setCancellingOrderId(null)
      // Modal de confirmação fica aberto mostrando o erro
    }
  }

  const handleCancelAllOrders = () => {
    // Abre o modal de confirmação
    setConfirmCancelAllVisible(true)
  }

  const confirmCancelAllOrders = async () => {
    setCancelAllLoading(true)
    setCancelAllError(null)
    
    try {
      
      
      // Chama a API para cancelar todas
      const result = await apiService.cancelAllOrders(userId, exchangeId)
      
      
      // ✅ SUCESSO: Cancela todas as ordens e atualiza os dados
      if (result.success) {
        
        
        const cancelledCount = result.cancelled_count || result.cancelledCount || result.canceled_count || 0
        const failedCount = result.failed_count || result.failedCount || 0
        
        // Se TODAS falharam, mostra erro no modal
        if (cancelledCount === 0 && failedCount > 0 && result.failed_orders && result.failed_orders.length > 0) {
          console.error('❌ [OpenOrdersModal] Todas as ordens falharam:', result.failed_orders)
          const firstError = result.failed_orders[0].error || 'Erro ao cancelar ordens'
          setCancelAllError(firstError)
          setCancelAllLoading(false)
          // NÃO fecha o modal, NÃO atualiza os dados
          return
        }
        
        // Se teve falha parcial (algumas canceladas, outras falharam)
        if (cancelledCount > 0 && failedCount > 0 && result.failed_orders && result.failed_orders.length > 0) {
          
          const firstError = result.failed_orders[0].error || 'Algumas ordens falharam'
          const errorMsg = `${cancelledCount} cancelada(s), ${failedCount} falhou(ram).\n\nPrimeiro erro:\n${firstError}`
          setCancelAllError(errorMsg)
          setCancelAllLoading(false)
          
          // ✅ REMOÇÃO PARCIAL: Remove as ordens que foram canceladas
          const failedOrderIds = new Set(result.failed_orders.map((fo: any) => fo.order_id || fo.orderId));
          setOrders(prev => prev.filter(order => failedOrderIds.has(order.id)));
          
          // NÃO fecha o modal para mostrar o erro
          return
        }
        
        // Se teve sucesso total, fecha o modal e mostra resultado
        
        // ✅ REMOÇÃO OTIMISTA: Limpa TODAS as ordens imediatamente
        setOrders([])
        
        // ✅ FEEDBACK IMEDIATO: Fecha modais
        setConfirmCancelAllVisible(false)
        onClose()
        setCancelAllLoading(false)
        
        // Chama callback
        if (onOrderCancelled) {
          onOrderCancelled()
        }
        
        // Notifica sucesso total
        setTimeout(() => {
          Alert.alert('Sucesso', `✅ ${cancelledCount} ordem(ns) cancelada(s) com sucesso!`)
        }, 100)
      } else {
        // ❌ API retornou success=false (erro lógico)
        console.error('❌ [OpenOrdersModal] API retornou success=false:', result)
        
        // Tenta extrair mensagem de erro de diferentes campos
        let errorMsg = 'Erro ao cancelar ordens'
        
        // Se for limitação da exchange (ex: MEXC), usa details diretamente
        if (result.exchange_limitation && result.details) {
          errorMsg = result.details
        } else if (result.details) {
          errorMsg = result.details // MEXC usa "details"
        } else if (result.error) {
          errorMsg = result.error
        } else if (result.message) {
          errorMsg = result.message
        }
        
        setCancelAllError(errorMsg)
        setCancelAllLoading(false)
        // NÃO fecha o modal, NÃO atualiza os dados
      }
    } catch (error: any) {
      // ❌ Erro de rede, timeout, ou HTTP 400/500
      console.error('❌ [OpenOrdersModal] Erro ao cancelar todas:', error)
      
      // Mensagem de erro mais específica
      let errorMessage = 'Erro desconhecido ao cancelar ordens'
      if (error.message) {
        errorMessage = error.message
      } else if (error.toString().includes('timeout')) {
        errorMessage = 'Timeout: A exchange não respondeu a tempo'
      } else if (error.toString().includes('network')) {
        errorMessage = 'Erro de rede: Verifique sua conexão'
      }
      
      setCancelAllError(errorMessage)
      setCancelAllLoading(false)
      // NÃO fecha o modal, NÃO atualiza os dados
    }
  }

  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case 'limit': return t('orders.type.limit')
      case 'market': return t('orders.type.market')
      case 'stop_loss': return t('orders.type.stopLoss')
      default: return type.toUpperCase()
    }
  }

  const getSideLabel = (side: string) => {
    return side === 'buy' ? t('orders.side.buy') : t('orders.side.sell')
  }

  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`
    } else if (value >= 1) {
      return `$${value.toFixed(2)}`
    } else {
      // Para valores muito pequenos (como 0.0026484), mostrar mais casas decimais
      return `$${value.toFixed(8).replace(/\.?0+$/, '')}`
    }
  }

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M`
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K`
    } else if (amount >= 1) {
      return amount.toFixed(2)
    } else {
      return amount.toFixed(8).replace(/\.?0+$/, '')
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRelativeTime = () => {
    if (!lastUpdate) return ''
    
    const timeStr = lastUpdate.toLocaleTimeString(language, { 
      hour: '2-digit', 
      minute: '2-digit'
    })
    
    return `${t('portfolio.updatedAt')}: ${timeStr}`
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSafeArea} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.headerTitleContainer}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.modalTitle, { color: colors.text }]}> 
                  {t('orders.title')}
                </Text>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.exchangeName, { color: colors.textSecondary }]}> 
                  {exchangeName}
                </Text>
                {/* Info sobre atualização automática */}
                <View style={[styles.infoBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <View style={styles.infoIconContainer}>
                    <Text style={styles.infoIconYellow}>i</Text>
                  </View>
                  <Text style={[styles.infoText, { color: colors.text }]}>
                    {t('orders.autoUpdate')}
                  </Text>
                </View>
                {lastUpdate && (
                  <View style={styles.updateContainer}>
                    <Text style={[styles.lastUpdateText, { color: colors.textSecondary }]}>
                      {getRelativeTime()}
                    </Text>
                    <TouchableOpacity 
                      onPress={() => {
                        // Sempre busca dados frescos
                        loadOrders()
                      }}
                      style={[styles.refreshButton, loading && styles.refreshButtonDisabled]}
                      disabled={loading}
                      activeOpacity={loading ? 1 : 0.7}
                    >
                      {loading ? (
                        <AnimatedLogoIcon size={16} />
                      ) : (
                        <Text style={[styles.refreshIcon, { color: colors.primary }]}>↻</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
                
                {/* Botão Cancelar Todas */}
                {orders.length > 0 && !loading && (
                  <TouchableOpacity 
                    onPress={handleCancelAllOrders}
                    style={[styles.cancelAllButton, { backgroundColor: '#ef4444' + '15', borderColor: '#ef4444' + '40' }]}
                    disabled={cancellingAll}
                  >
                    {cancellingAll ? (
                      <AnimatedLogoIcon size={14} />
                    ) : (
                      <Text style={[styles.cancelAllButtonText, { color: '#ef4444' }]}>
                        {t('orders.cancelAll')}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Content */}
            <ScrollView style={styles.modalContent}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <AnimatedLogoIcon size={48} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    {t('orders.loading')}
                  </Text>
                </View>
              ) : error ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.errorText, { color: '#ef4444' }]}>
                    {error}
                  </Text>
                  <TouchableOpacity onPress={loadOrders} style={styles.retryButton}>
                    <Text style={[styles.retryButtonText, { color: colors.primary }]}>
                      {t('orders.retry')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : orders.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyIcon, { color: colors.textSecondary }]}>📋</Text>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    {t('orders.empty')}
                  </Text>
                  <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
                    {t('orders.emptyMessage')}
                  </Text>
                </View>
              ) : (
                <View style={styles.ordersList}>
                  {orders.map((order) => {
                    const orderId = getOrderId(order);
                    const isCancelling = cancellingOrderId === orderId;
                    
                    return (
                    <View
                      key={orderId}
                      style={[styles.orderItemCompact, { 
                        backgroundColor: colors.surface,
                        borderBottomColor: colors.border,
                        opacity: isCancelling ? 0.5 : 1
                      }]}
                    >
                      {isCancelling && (
                        <View style={styles.cancellingOverlayCompact}>
                          <AnimatedLogoIcon size={20} />
                          <Text style={[styles.cancellingTextCompact, { color: colors.textSecondary }]}>
                            {t('orders.cancelingOrder')}
                          </Text>
                        </View>
                      )}
                      <View style={styles.orderCompactRow}>
                        {/* Symbol - clicável para abrir detalhes */}
                        <TouchableOpacity
                          onPress={() => {
                            onSelectOrder(order)
                            onClose()
                          }}
                          activeOpacity={0.7}
                          style={styles.symbolContainer}
                        >
                          <Text style={[styles.orderSymbolCompact, { color: colors.text }]} numberOfLines={1}>
                            {order.symbol.toLowerCase()}
                          </Text>
                        </TouchableOpacity>

                        {/* Side (Buy/Sell) */}
                        <View style={[styles.orderSideBadgeCompact, { backgroundColor: getSideColor(order.side) + '10' }]}>
                          <Text style={[styles.orderSideTextCompact, { color: getSideColor(order.side) }]}>
                            {getSideLabel(order.side)}
                          </Text>
                        </View>

                        {/* Values container */}
                        <View style={styles.valuesContainer}>
                          {/* Amount */}
                          <Text style={[styles.orderAmountCompact, { color: colors.textSecondary }]} numberOfLines={1}>
                            {formatAmount(order.amount)}
                          </Text>

                          {/* Price */}
                          <Text style={[styles.orderPriceCompact, { color: colors.textSecondary }]} numberOfLines={1}>
                            {formatValue(order.price)}
                          </Text>
                        </View>

                        {/* Actions container */}
                        <View style={styles.actionsContainer}>
                          {/* Status badge (se parcialmente preenchida) */}
                          {order.filled > 0 && (
                            <View style={[styles.orderStatusBadgeCompact, { backgroundColor: '#f59e0b' + '10' }]}>
                              <Text style={[styles.orderStatusTextCompact, { color: '#f59e0b' }]}>
                                {((order.filled / order.amount) * 100).toFixed(0)}%
                              </Text>
                            </View>
                          )}

                          {/* Menu Button (3 dots) */}
                          <View>
                            <TouchableOpacity
                              onPress={() => setMenuOpenForOrderId(menuOpenForOrderId === getOrderId(order) ? null : getOrderId(order))}
                              style={[styles.menuButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                              disabled={isCancelling}
                            >
                              <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: fontWeights.bold, lineHeight: 16 }}>
                                ⋮
                              </Text>
                            </TouchableOpacity>

                            {/* Dropdown Menu */}
                            {menuOpenForOrderId === getOrderId(order) && !isCancelling && (
                              <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <TouchableOpacity
                                  onPress={() => {
                                    setMenuOpenForOrderId(null)
                                    handleCancelOrder(order)
                                  }}
                                  style={styles.dropdownItem}
                                >
                                  <Text style={[styles.dropdownItemText, { color: '#ef4444' }]}>
                                    {t('orders.cancel')}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  )})}
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>

      {/* Modal de Confirmação de Cancelamento */}
      <Modal
        visible={confirmCancelVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setConfirmCancelVisible(false)}
      >
        <Pressable 
          style={styles.confirmOverlay} 
          onPress={() => setConfirmCancelVisible(false)}
        >
          <Pressable 
            style={styles.confirmSafeArea} 
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.confirmContainer, { backgroundColor: colors.surface }]}>
              {/* Header */}
              <View style={[styles.confirmHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmTitle, { color: colors.text }]}>
                  {t('orders.confirmCancel')}
                </Text>
              </View>

              {/* Content */}
              <View style={styles.confirmContent}>
                {/* Mostra loading enquanto cancela */}
                {cancelLoading && (
                  <View style={styles.loadingContainer}>
                    <AnimatedLogoIcon />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      {t('orders.cancelingOrder')}
                    </Text>
                  </View>
                )}
                
                {/* Mostra erro se houver */}
                {cancelError && !cancelLoading && (
                  <View style={styles.errorContainerClean}>
                    {(() => {
                      const errorInfo = parseErrorResponse(cancelError)
                      return (
                        <>
                          <Text style={[styles.errorTitleClean, { color: colors.textSecondary }]}>
                            {t('orders.cancelFailed')}
                          </Text>
                          
                          {errorInfo.code && (
                            <Text style={[styles.errorCodeText, { color: colors.textSecondary }]}>
                              {t('orders.errorCode')}: {errorInfo.code}
                            </Text>
                          )}
                          
                          <Text style={[styles.errorMessageText, { color: colors.text }]}>
                            {errorInfo.message}
                          </Text>
                        </>
                      )
                    })()}
                  </View>
                )}
                
                {/* Mostra detalhes da ordem apenas se não está em loading e sem erro */}
                {!cancelLoading && !cancelError && (
                  <>
                    <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
                      {orderToCancel && `Deseja realmente cancelar esta ordem ${orderToCancel.side === 'buy' ? 'de compra' : 'de venda'}?`}
                    </Text>
                    
                    {orderToCancel && (
                      <View style={[styles.confirmDetails, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.confirmDetailRow}>
                          <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                            Par:
                          </Text>
                          <Text style={[styles.confirmValue, { color: colors.text }]}>
                            {orderToCancel.symbol}
                          </Text>
                        </View>
                        
                        <View style={styles.confirmDetailRow}>
                          <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                            Lado:
                          </Text>
                          <Text style={[styles.confirmValue, { color: getSideColor(orderToCancel.side) }]}>
                            {getSideLabel(orderToCancel.side)}
                          </Text>
                        </View>
                        
                        <View style={styles.confirmDetailRow}>
                          <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                            Quantidade:
                          </Text>
                          <Text style={[styles.confirmValue, { color: colors.text }]}>
                            {formatAmount(orderToCancel.amount)}
                          </Text>
                        </View>
                        
                        <View style={styles.confirmDetailRow}>
                          <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
                            Preço:
                          </Text>
                          <Text style={[styles.confirmValue, { color: colors.text }]}>
                            {formatValue(orderToCancel.price)}
                          </Text>
                        </View>
                        
                        <View style={[styles.confirmDetailRow, styles.confirmTotalRow, { borderTopColor: colors.border }]}>
                          <Text style={[styles.confirmLabel, { color: colors.textSecondary, fontWeight: fontWeights.semibold }]}>
                            Total:
                          </Text>
                          <Text style={[styles.confirmValue, { color: colors.text, fontWeight: fontWeights.semibold }]}>
                            {formatValue(orderToCancel.amount * orderToCancel.price)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Footer com botões */}
              <View style={styles.confirmFooter}>
                {/* Botão Voltar - sempre disponível */}
                <TouchableOpacity
                  onPress={() => {
                    setConfirmCancelVisible(false)
                    setOrderToCancel(null)
                    setCancelError(null) // Limpa erro ao fechar
                  }}
                  disabled={cancelLoading}
                  style={[styles.confirmButton, styles.confirmButtonCancel, { 
                    borderColor: colors.border,
                    opacity: cancelLoading ? 0.5 : 1
                  }]}
                >
                  <Text style={[styles.confirmButtonText, { color: colors.textSecondary }]}>
                    {cancelError ? t('common.close') : t('common.back')}
                  </Text>
                </TouchableOpacity>
                
                {/* Botão Cancelar Ordem ou Tentar Novamente */}
                {!cancelLoading && (
                  <TouchableOpacity
                    onPress={confirmCancelOrder}
                    style={[styles.confirmButton, styles.confirmButtonConfirm, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.confirmButtonText, { color: '#fff' }]}>
                      {cancelError ? t('common.tryAgain') : t('orders.cancelOrder')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Confirmação de Cancelar Todas */}
      <Modal
        visible={confirmCancelAllVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setConfirmCancelAllVisible(false)}
      >
        <Pressable 
          style={styles.confirmOverlay} 
          onPress={() => setConfirmCancelAllVisible(false)}
        >
          <Pressable 
            style={styles.confirmSafeArea} 
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.confirmContainer, { backgroundColor: colors.surface }]}>
              {/* Header */}
              <View style={[styles.confirmHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmTitle, { color: colors.text }]}>
                  {t('orders.cancelAllTitle')}
                </Text>
              </View>

              {/* Content */}
              <View style={styles.confirmContent}>
                {/* Mostra loading enquanto cancela todas */}
                {cancelAllLoading && (
                  <View style={styles.loadingContainer}>
                    <AnimatedLogoIcon />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      {t('orders.cancelingAllOrders')}
                    </Text>
                  </View>
                )}
                
                {/* Mostra erro se houver */}
                {cancelAllError && !cancelAllLoading && (
                  <View style={styles.errorContainerClean}>
                    {(() => {
                      const errorInfo = parseErrorResponse(cancelAllError)
                      return (
                        <>
                          <Text style={[styles.errorTitleClean, { color: colors.textSecondary }]}>
                            {t('orders.cancelFailed')}
                          </Text>
                          
                          {errorInfo.code && (
                            <Text style={[styles.errorCodeText, { color: colors.textSecondary }]}>
                              {t('orders.errorCode')}: {errorInfo.code}
                            </Text>
                          )}
                          
                          <Text style={[styles.errorMessageText, { color: colors.text }]}>
                            {errorInfo.message}
                          </Text>
                        </>
                      )
                    })()}
                  </View>
                )}
                
                {/* Mostra mensagem de confirmação apenas se não está em loading e sem erro */}
                {!cancelAllLoading && !cancelAllError && (
                  <>
                    <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
                      {t('orders.cancelAllMessage').replace('{count}', String(orders.length))}
                    </Text>
                    
                    <Text style={[styles.confirmWarningClean, { color: colors.textSecondary }]}>
                      {t('orders.cancelAllWarning')}
                    </Text>
                  </>
                )}
              </View>

              {/* Footer com botões */}
              <View style={styles.confirmFooter}>
                {/* Botão Voltar - sempre disponível */}
                <TouchableOpacity
                  onPress={() => {
                    setConfirmCancelAllVisible(false)
                    setCancelAllError(null) // Limpa erro ao fechar
                  }}
                  disabled={cancelAllLoading}
                  style={[styles.confirmButton, styles.confirmButtonCancel, { 
                    borderColor: colors.border,
                    opacity: cancelAllLoading ? 0.5 : 1
                  }]}
                >
                  <Text style={[styles.confirmButtonText, { color: colors.textSecondary }]}>
                    {cancelAllError ? t('common.close') : t('orders.cancelAllNo')}
                  </Text>
                </TouchableOpacity>
                
                {/* Botão Cancelar Todas ou Tentar Novamente */}
                {!cancelAllLoading && (
                  <TouchableOpacity
                    onPress={confirmCancelAllOrders}
                    style={[styles.confirmButton, styles.confirmButtonConfirm, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.confirmButtonText, { color: '#fff' }]}>
                      {cancelAllError ? t('common.tryAgain') : t('orders.cancelAllYes')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      
      {/* Modal de Detalhes do Erro - Ordem Individual */}
      <Modal
        visible={showErrorDetail}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowErrorDetail(false)}
      >
        <Pressable 
          style={styles.confirmOverlay} 
          onPress={() => setShowErrorDetail(false)}
        >
          <Pressable 
            style={styles.confirmSafeArea} 
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.confirmContainer, { backgroundColor: colors.surface }]}>
              {/* Header */}
              <View style={[styles.confirmHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmTitle, { color: colors.text }]}>
                  Detalhes do Erro
                </Text>
              </View>

              {/* Content */}
              <View style={styles.confirmContent}>
                <ScrollView>
                  {(() => {
                    const errorInfo = parseErrorResponse(cancelError)
                    return (
                      <>
                        {errorInfo.code && (
                          <View style={styles.errorInfoRow}>
                            <Text style={[styles.errorInfoLabel, { color: colors.textSecondary }]}>
                              Código:
                            </Text>
                            <Text style={[styles.errorInfoValue, { color: colors.text }]}>
                              {errorInfo.code}
                            </Text>
                          </View>
                        )}
                        
                        <View style={styles.errorInfoRow}>
                          <Text style={[styles.errorInfoLabel, { color: colors.textSecondary }]}>
                            Mensagem:
                          </Text>
                          <Text style={[styles.errorInfoValue, { color: colors.text }]}>
                            {errorInfo.message}
                          </Text>
                        </View>
                        
                        {errorInfo.raw && (
                          <>
                            <View style={[styles.errorDivider, { backgroundColor: colors.border }]} />
                            <Text style={[styles.errorRawLabel, { color: colors.textSecondary }]}>
                              Resposta completa:
                            </Text>
                            <Text style={[styles.errorDetailText, { 
                              color: colors.textSecondary,
                              backgroundColor: colors.background,
                            }]}>
                              {JSON.stringify(errorInfo.raw, null, 2)}
                            </Text>
                          </>
                        )}
                      </>
                    )
                  })()}
                </ScrollView>
              </View>

              {/* Footer */}
              <View style={styles.confirmFooter}>
                <TouchableOpacity
                  onPress={() => setShowErrorDetail(false)}
                  style={[styles.confirmButton, styles.confirmButtonConfirm, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.confirmButtonText, { color: '#fff' }]}>
                    Fechar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      
      {/* Modal de Detalhes do Erro - Cancelar Todas */}
      <Modal
        visible={showCancelAllErrorDetail}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCancelAllErrorDetail(false)}
      >
        <Pressable 
          style={styles.confirmOverlay} 
          onPress={() => setShowCancelAllErrorDetail(false)}
        >
          <Pressable 
            style={styles.confirmSafeArea} 
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.confirmContainer, { backgroundColor: colors.surface }]}>
              {/* Header */}
              <View style={[styles.confirmHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmTitle, { color: colors.text }]}>
                  Detalhes do Erro
                </Text>
              </View>

              {/* Content */}
              <View style={styles.confirmContent}>
                <ScrollView>
                  {(() => {
                    const errorInfo = parseErrorResponse(cancelAllError)
                    return (
                      <>
                        {errorInfo.code && (
                          <View style={styles.errorInfoRow}>
                            <Text style={[styles.errorInfoLabel, { color: colors.textSecondary }]}>
                              Código:
                            </Text>
                            <Text style={[styles.errorInfoValue, { color: colors.text }]}>
                              {errorInfo.code}
                            </Text>
                          </View>
                        )}
                        
                        <View style={styles.errorInfoRow}>
                          <Text style={[styles.errorInfoLabel, { color: colors.textSecondary }]}>
                            Mensagem:
                          </Text>
                          <Text style={[styles.errorInfoValue, { color: colors.text }]}>
                            {errorInfo.message}
                          </Text>
                        </View>
                        
                        {errorInfo.raw && (
                          <>
                            <View style={[styles.errorDivider, { backgroundColor: colors.border }]} />
                            <Text style={[styles.errorRawLabel, { color: colors.textSecondary }]}>
                              Resposta completa:
                            </Text>
                            <Text style={[styles.errorDetailText, { 
                              color: colors.textSecondary,
                              backgroundColor: colors.background,
                            }]}>
                              {JSON.stringify(errorInfo.raw, null, 2)}
                            </Text>
                          </>
                        )}
                      </>
                    )
                  })()}
                </ScrollView>
              </View>

              {/* Footer */}
              <View style={styles.confirmFooter}>
                <TouchableOpacity
                  onPress={() => setShowCancelAllErrorDetail(false)}
                  style={[styles.confirmButton, styles.confirmButtonConfirm, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.confirmButtonText, { color: '#fff' }]}>
                    Fechar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSafeArea: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  modalContainer: {
    borderRadius: 20,
    width: "90%",
    maxHeight: "85%",
    height: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  modalTitle: {
    fontSize: typography.h4,
    fontWeight: fontWeights.medium,
    flexShrink: 1,
  },
  exchangeName: {
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
    marginTop: 2,
    flexShrink: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 0.5,
    opacity: 0.8,
  },
  infoIconContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFA500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconYellow: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.bold,
    color: '#FFFFFF',
  },
  infoText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.light,
    flex: 1,
    lineHeight: 14,
  },
  autoUpdateInfo: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.light,
    marginTop: 2,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  lastUpdateText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.light,
    marginTop: 2,
    fontStyle: 'italic',
  },
  updateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: typography.h3,
    fontWeight: fontWeights.light,
    opacity: 0.7,
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cancelAllButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelAllButtonText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
  },
  closeButton: {
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  closeButtonText: {
    fontSize: typography.h3,
    fontWeight: fontWeights.light,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: typography.body,
    marginTop: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.3,
  },
  emptyTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeights.medium,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyMessage: {
    fontSize: typography.body,
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: {
    fontSize: typography.body,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    padding: 12,
  },
  retryButtonText: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  ordersList: {
    gap: 12,
  },
  orderCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderSymbol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  symbolText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.semibold,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.bold,
  },
  sideBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sideText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.bold,
  },
  orderDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: typography.bodySmall,
  },
  detailValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  dateText: {
    fontSize: typography.caption,
  },
  totalText: {
    fontSize: typography.bodyLarge,
    fontWeight: fontWeights.semibold,
  },
  // Compact list styles (similar to tokens list)
  orderItemCompact: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
  },
  orderCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbolContainer: {
    minWidth: 80,
  },
  orderSymbolCompact: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },
  orderSideBadgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 36,
  },
  orderSideTextCompact: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.medium,
    textAlign: 'center',
  },
  valuesContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  orderAmountCompact: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
    minWidth: 60,
    textAlign: 'right',
  },
  orderPriceCompact: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
    minWidth: 60,
    textAlign: 'right',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderStatusBadgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 36,
  },
  orderStatusTextCompact: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.medium,
    textAlign: 'center',
  },
  menuButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },
  cancelButton: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderRadius: 4,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Estilos do modal de confirmação
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmSafeArea: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  confirmContainer: {
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  confirmHeader: {
    padding: 20,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  confirmTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeights.semibold,
  },
  confirmContent: {
    padding: 20,
    gap: 16,
  },
  confirmMessage: {
    fontSize: typography.body,
    textAlign: "center",
    lineHeight: 20,
  },
  confirmWarning: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  confirmWarningText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
    textAlign: "center",
  },
  confirmDetails: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  confirmDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confirmTotalRow: {
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
  },
  confirmLabel: {
    fontSize: typography.bodySmall,
  },
  confirmValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  confirmFooter: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonCancel: {
    borderWidth: 1,
  },
  confirmButtonConfirm: {
    // backgroundColor definido inline
  },
  confirmButtonText: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  errorContainer: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  errorTitle: {
    fontSize: typography.body,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: typography.caption,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorDetailButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'center',
  },
  errorDetailButtonText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
  },
  // Estilos clean e minimalistas
  errorContainerClean: {
    paddingVertical: 16,
    gap: 12,
    alignItems: 'center',
  },
  errorTitleClean: {
    fontSize: typography.body,
    textAlign: 'center',
  },
  errorCodeText: {
    fontSize: typography.caption,
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 4,
  },
  errorMessageText: {
    fontSize: typography.body,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  errorDetailButtonClean: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  errorDetailButtonTextClean: {
    fontSize: typography.caption,
  },
  confirmWarningClean: {
    fontSize: typography.caption,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  // Estilos para modal de detalhes de erro
  errorInfoRow: {
    marginBottom: 16,
  },
  errorInfoLabel: {
    fontSize: typography.caption,
    marginBottom: 4,
    opacity: 0.7,
  },
  errorInfoValue: {
    fontSize: typography.body,
    lineHeight: 24,
  },
  errorDivider: {
    height: 1,
    marginVertical: 20,
  },
  errorRawLabel: {
    fontSize: typography.caption,
    marginBottom: 8,
    opacity: 0.7,
  },
  errorDetailText: {
    fontSize: typography.caption,
    fontFamily: 'monospace',
    padding: 12,
    borderRadius: 8,
    lineHeight: 18,
  },
  // Overlay de cancelamento compacto
  cancellingOverlayCompact: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cancellingTextCompact: {
    fontSize: 12,
    fontWeight: '600',
  },
})
