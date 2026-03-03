import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, RefreshControl, Modal, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, SafeAreaView } from "react-native"
import { useEffect, useState, useMemo, useCallback, memo } from "react"
import { Ionicons } from "@expo/vector-icons"
import { apiService } from "@/services/api"
import { AvailableExchange, LinkedExchange } from "@/types/api"
import { useLanguage } from "@/contexts/LanguageContext"
import { useTheme } from "@/contexts/ThemeContext"
import { useBalance } from "@/contexts/BalanceContext"
import { useAuth } from "@/contexts/AuthContext"
import { useCacheInvalidation } from "@/contexts/CacheInvalidationContext"
import { QRScanner } from "./QRScanner"
import { AnimatedLogoIcon } from "./AnimatedLogoIcon"
import { typography, fontWeights } from "@/lib/typography"
import { spacing } from "@/lib/layout"

import { capitalizeExchangeName } from "@/lib/exchange-helpers"

// Mapeamento dos logos locais das exchanges
const exchangeLogos: Record<string, any> = {
  "binance": require("@/assets/binance.png"),
  "novadax": require("@/assets/novadax.png"),
  "mexc": require("@/assets/mexc.png"),
  "coinbase": require("@/assets/coinbase.png"),
  "coinex": require("@/assets/coinex.png"),
  "bitget": require("@/assets/bitget.png"),
  "kraken": require("@/assets/kraken.png"),
  "bybit": require("@/assets/bybit.png"),
  "gate.io": require("@/assets/gateio.png"),
  "kucoin": require("@/assets/kucoin.png"),
  "okx": require("@/assets/okx.png"),
}

interface ExchangesManagerProps {
  initialTab?: 'all' | 'available' | 'linked'
}

// Subcomponente memoizado para renderizar cada card de exchange
const LinkedExchangeCard = memo(({ 
  linkedExchange, 
  index, 
  colors, 
  t, 
  onToggle, 
  onDelete,
  onPress,
  isRefreshing
}: { 
  linkedExchange: any
  index: number
  colors: any
  t: any
  onToggle: (id: string, status: string, name: string) => void
  onDelete: (id: string, name: string) => void
  onPress: () => void
  isRefreshing?: boolean
}) => {
  const exchangeNameLower = linkedExchange.name.toLowerCase()
  const localIcon = exchangeLogos[exchangeNameLower]
  const exchangeId = linkedExchange.exchange_id
  const isActive = linkedExchange.is_active === true || linkedExchange.status === 'active'
  const isDark = colors.isDark

  // API Key expiry logic
  const daysUntilExpiry = linkedExchange.days_until_expiry
  const hasExpiry = daysUntilExpiry != null && linkedExchange.api_key_expiry_days != null
  const isExpired = hasExpiry && daysUntilExpiry <= 0
  const isExpiringSoon = hasExpiry && !isExpired && daysUntilExpiry <= 15

  const expiryLabel = useMemo(() => {
    if (!hasExpiry) return null
    if (isExpired) return t('exchanges.apiKeyExpired') || 'API Key expirada'
    if (isExpiringSoon) {
      const label = t('exchanges.apiKeyExpiresSoon') || 'Expira em {days} dias'
      return label.replace('{days}', String(daysUntilExpiry))
    }
    return null
  }, [hasExpiry, isExpired, isExpiringSoon, daysUntilExpiry, t])

  const formattedDate = useMemo(() => {
    if (isRefreshing) return t('home.updating') || 'Updating...'
    if (!linkedExchange.linked_at) return t('exchanges.noDate') || 'N/A'
    try {
      return new Date(linkedExchange.linked_at).toLocaleDateString('pt-BR')
    } catch (error) {
      return 'N/A'
    }
  }, [linkedExchange.linked_at, t, isRefreshing])

  return (
    <TouchableOpacity
      style={[styles.compactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Linha única compacta */}
      <View style={styles.cardRow}>
        {/* Lado esquerdo: Ícone + Info */}
        <View style={styles.cardLeft}>
          <View style={[styles.typeIcon, isDark && { backgroundColor: '#FFFFFF' }]}>
            {localIcon ? (
              <Image 
                source={localIcon} 
                style={styles.typeIconImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.typeIconText}>🔗</Text>
            )}
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardInfoTop}>
              <Text style={[styles.cardSymbol, { color: colors.text }]} numberOfLines={1}>
                {capitalizeExchangeName(linkedExchange.name)}
              </Text>
              <View style={[
                styles.sideBadge,
                { backgroundColor: isActive ? colors.successLight : colors.dangerLight }
              ]}>
                <Text style={[
                  styles.sideBadgeText,
                  { color: isActive ? colors.success : colors.danger }
                ]}>
                  {isActive ? 'ON' : 'OFF'}
                </Text>
              </View>
              {expiryLabel && (
                <View style={[
                  styles.sideBadge,
                  { backgroundColor: isExpired ? colors.dangerLight : colors.warningLight, marginLeft: 4 }
                ]}>
                  <Text style={[
                    styles.sideBadgeText,
                    { color: isExpired ? colors.danger : colors.warning }
                  ]}>
                    {isExpired ? '🔴' : '⚠️'} {expiryLabel}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.cardSubtext, { color: colors.textTertiary }]} numberOfLines={1}>
              {formattedDate}
            </Text>
          </View>
        </View>

        {/* Lado direito: Status */}
        <View style={styles.cardRight}>
          <Text style={[styles.cardValue, { color: isActive ? colors.success : colors.danger }]} numberOfLines={1}>
            {isActive ? t('exchanges.active') : t('exchanges.inactive')}
          </Text>
          <Text style={[styles.cardSubtext, { color: colors.textTertiary }]} numberOfLines={1}>
            {linkedExchange.country || linkedExchange.pais_de_origem || ''}
          </Text>
        </View>
      </View>

      {/* Botões de ação compactos */}
      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.cardActionButton}
          onPress={() => onToggle(exchangeId, isActive ? 'active' : 'inactive', linkedExchange.name)}
        >
          <Ionicons name={isActive ? 'pause-circle-outline' : 'play-circle-outline'} size={14} color={isActive ? colors.danger : colors.success} />
          <Text style={[styles.cardActionText, { color: isActive ? colors.danger : colors.success }]}>
            {isActive ? t('exchanges.deactivate') : t('exchanges.activate')}
          </Text>
        </TouchableOpacity>
        <View style={[styles.cardActionDivider, { backgroundColor: colors.border }]} />
        <TouchableOpacity
          style={styles.cardActionButton}
          onPress={() => onDelete(exchangeId, linkedExchange.name)}
        >
          <Ionicons name="trash-outline" size={14} color={colors.danger} />
          <Text style={[styles.cardActionText, { color: colors.danger }]}>
            {t('exchanges.delete')}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
})

LinkedExchangeCard.displayName = 'LinkedExchangeCard'

// Subcomponente memoizado para exchanges disponíveis
const AvailableExchangeCard = memo(({ 
  exchange, 
  isLinked, 
  colors, 
  t, 
  onConnect,
  onPress,
  isRefreshing
}: { 
  exchange: any
  isLinked: boolean
  colors: any
  t: any
  onConnect: (exchange: any) => void
  onPress: () => void
  isRefreshing?: boolean
}) => {
  const localIcon = exchange?.nome ? exchangeLogos[exchange.nome.toLowerCase()] : null
  const isDark = colors.isDark

  return (
    <TouchableOpacity
      style={[styles.compactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Linha única compacta */}
      <View style={styles.cardRow}>
        {/* Lado esquerdo: Ícone + Info */}
        <View style={styles.cardLeft}>
          <View style={[styles.typeIcon, isDark && { backgroundColor: '#FFFFFF' }]}>
            {localIcon ? (
              <Image 
                source={localIcon} 
                style={styles.typeIconImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.typeIconText}>🌐</Text>
            )}
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardInfoTop}>
              <Text style={[styles.cardSymbol, { color: colors.text }]} numberOfLines={1}>
                {capitalizeExchangeName(exchange.nome || exchange.name || 'Unknown')}
              </Text>
              {exchange.requires_passphrase && (
                <View style={[styles.sideBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.sideBadgeText, { color: colors.primary }]}>🔑</Text>
                </View>
              )}
            </View>
            <Text style={[styles.cardSubtext, { color: colors.textTertiary }]} numberOfLines={1}>
              {exchange.pais_de_origem || t('exchanges.readyToConnect')}
            </Text>
          </View>
        </View>

        {/* Lado direito: Status */}
        <View style={styles.cardRight}>
          <Text style={[styles.cardValue, { color: colors.textSecondary }]} numberOfLines={1}>
            {isLinked ? '✓ ' + t('exchanges.connectedSingular') : ''}
          </Text>
        </View>
      </View>

      {/* Botão conectar compacto */}
      {!isLinked && (
        <TouchableOpacity
          style={[styles.connectFooter, { borderTopColor: colors.border }]}
          onPress={() => onConnect(exchange)}
        >
          <Ionicons name="link-outline" size={14} color={colors.success} />
          <Text style={[styles.cardActionText, { color: colors.success }]}>
            {t('exchanges.connect')}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
})

AvailableExchangeCard.displayName = 'AvailableExchangeCard'

export function ExchangesManager({ initialTab = 'linked' }: ExchangesManagerProps) {
  const { t } = useLanguage()
  const { colors, isDark } = useTheme()
  const { user } = useAuth()
  const { data: balanceData } = useBalance()
  const { onExchangeModified, registerExchangesRefreshCallback, unregisterExchangesRefreshCallback } = useCacheInvalidation()
  const [availableExchanges, setAvailableExchanges] = useState<AvailableExchange[]>([])
  const [linkedExchanges, setLinkedExchanges] = useState<LinkedExchange[]>([])
  const [refreshKey, setRefreshKey] = useState(0) // Para forçar re-render
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'available' | 'linked'>(initialTab === 'available' ? 'available' : initialTab === 'linked' ? 'linked' : 'all')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Modal de conexão
  const [connectModalVisible, setConnectModalVisible] = useState(false)
  const [selectedExchange, setSelectedExchange] = useState<AvailableExchange | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [qrScannerVisible, setQrScannerVisible] = useState(false)
  const [currentScanField, setCurrentScanField] = useState<'apiKey' | 'apiSecret' | 'passphrase' | null>(null)
  
  // Modal de confirmação (delete/disconnect)
  const [confirmModalVisible, setConfirmModalVisible] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'delete' | 'disconnect' | null>(null)
  const [confirmExchangeId, setConfirmExchangeId] = useState<string>('')
  const [confirmExchangeName, setConfirmExchangeName] = useState<string>('')
  const [confirmLoading, setConfirmLoading] = useState(false) // Loading no botão do modal
  
  // Modal de confirmação de toggle
  const [confirmToggleModalVisible, setConfirmToggleModalVisible] = useState(false)
  const [toggleExchangeId, setToggleExchangeId] = useState<string>('')
  const [toggleExchangeName, setToggleExchangeName] = useState<string>('')
  const [toggleExchangeNewStatus, setToggleExchangeNewStatus] = useState<string>('')
  const [toggleLoading, setToggleLoading] = useState(false) // Loading no botão do modal
  
  // Modal de detalhes da exchange
  const [detailsModalVisible, setDetailsModalVisible] = useState(false)
  const [detailsExchange, setDetailsExchange] = useState<any>(null)
  const [detailsType, setDetailsType] = useState<'linked' | 'available'>('linked')
  const [detailsFullData, setDetailsFullData] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false) // Cache: carrega só uma vez

  const fetchExchanges = useCallback(async (forceRefresh: boolean = false, silent: boolean = false) => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    if (hasLoadedOnce && !forceRefresh) {
      return
    }
    try {
      if (!silent) setLoading(true)
      setError(null)
      // Buscar exchanges conectadas do MongoDB
      const { exchanges: linkedList = [] } = await apiService.listExchanges()
      // Mapear para o formato esperado pelo componente
      const mappedExchanges = linkedList.map((ex: any) => ({
        ...ex,
        name: capitalizeExchangeName(ex.exchange_name || ex.name),
        ccxt_id: ex.exchange_type || ex.ccxt_id,
        icon: ex.icon || ex.logo,
        status: ex.is_active ? 'active' : 'inactive',
        linked_at: ex.created_at,
        api_key_expiry_days: ex.api_key_expiry_days,
        days_until_expiry: ex.days_until_expiry,
        api_key_expires_at: ex.api_key_expires_at,
      }))
      setLinkedExchanges(mappedExchanges as any)
      // Buscar exchanges disponíveis (catálogo)
      let availableData
      try {
        availableData = await apiService.getAvailableExchanges(user.id, forceRefresh)
      } catch (apiError) {
        console.error('❌ [ExchangesManager] Erro ao buscar catálogo:', apiError)
        availableData = { exchanges: [] }
      }
      setAvailableExchanges(availableData.exchanges || [])
      setRefreshKey(prev => prev + 1)
      setHasLoadedOnce(true)
      setTimeout(() => {}, 100)
    } catch (err) {
      console.error('❌ Error fetching exchanges:', err)
      setError(t('exchanges.error'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [user?.id, hasLoadedOnce, t])

  // Função para limpar cache e forçar refresh SILENCIOSO (usar após conectar/desconectar)
  const invalidateCacheAndRefresh = useCallback(async () => {
    setHasLoadedOnce(false) // Limpa o flag de cache
    await fetchExchanges(true, true) // forceRefresh=true (força API), silent=true (sem loading)
  }, [fetchExchanges])

  // Registra callback no CacheInvalidationContext quando o componente monta
  useEffect(() => {
    registerExchangesRefreshCallback(invalidateCacheAndRefresh)
    
    return () => {
      unregisterExchangesRefreshCallback(invalidateCacheAndRefresh)
    }
  }, [registerExchangesRefreshCallback, unregisterExchangesRefreshCallback, invalidateCacheAndRefresh])

  // Carrega exchanges quando o componente monta (SEMPRE força refresh para garantir dados atualizados)
  useEffect(() => {
    fetchExchanges(true, false) // forceRefresh=true, silent=false (mostra loading)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 🔄 Refresh específico por aba - atualiza apenas o conteúdo da aba ativa
  const handleRefresh = useCallback(async () => {
    console.log('🔄 [ExchangesManager] Atualizando exchanges...')
    setRefreshing(true)
    
    try {
      // Ambas as abas precisam buscar as exchanges (linked e available)
      // pois a aba "available" filtra as já conectadas
      await fetchExchanges(true, false)
      console.log('✅ [ExchangesManager] Exchanges atualizadas')
    } catch (error) {
      console.error(`❌ [ExchangesManager] Erro ao atualizar aba ${activeTab}:`, error)
    } finally {
      setRefreshing(false)
    }
  }, [activeTab, fetchExchanges])

  // handleConnect não é mais necessário - a conexão é feita via handleLinkExchange
  // que já usa apiService.addExchange()
  const handleConnect = useCallback((exchange: AvailableExchange) => {
    openConnectModal(exchange)
  }, [])

  // Mostra modal de confirmação para toggle
  const toggleExchange = useCallback((exchangeId: string, currentStatus: string, exchangeName: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    
    setToggleExchangeId(exchangeId)
    setToggleExchangeName(exchangeName)
    setToggleExchangeNewStatus(newStatus)
    setConfirmToggleModalVisible(true)
  }, [])

  // Executa o toggle após confirmação
  const confirmToggle = useCallback(async () => {
    const exchangeId = toggleExchangeId
    const newStatus = toggleExchangeNewStatus
    
    if (!user?.id) {
      alert('Erro: usuário não autenticado')
      return
    }
    
    // Inicia loading NO BOTÃO (não fecha o modal ainda)
    setToggleLoading(true)
    
    // Backend retorna is_active (boolean), não status (string)
    const newIsActive = newStatus === 'active'

    try {
      console.log('🔄 Atualizando status da exchange no MongoDB...', {
        exchangeId,
        newIsActive
      })
      
      // Atualiza no MongoDB (fonte da verdade)
      await apiService.updateExchange(exchangeId, { is_active: newIsActive })
      
      console.log('✅ Status atualizado no MongoDB com sucesso!')
      
      // Atualizar lista de exchanges e home
      await onExchangeModified()
      
      // Fecha modal e remove loading
      setToggleLoading(false)
      setConfirmToggleModalVisible(false)
      
    } catch (error) {
      console.error("❌ Erro ao atualizar status da exchange:", error)
      setToggleLoading(false)
      setConfirmToggleModalVisible(false)
      alert(t("error.updateExchangeStatus"))
    }
  }, [toggleExchangeId, toggleExchangeNewStatus, onExchangeModified, user?.id, t])

  const handleDisconnect = useCallback((exchangeId: string, exchangeName: string) => {
    setOpenMenuId(null)
    setConfirmExchangeId(exchangeId)
    setConfirmExchangeName(exchangeName)
    setConfirmAction('disconnect')
    setConfirmModalVisible(true)
  }, [])

  const confirmDisconnect = useCallback(async () => {
    if (!user?.id) {
      alert('Erro: usuário não autenticado')
      return
    }
    
    // Inicia loading NO BOTÃO (não fecha o modal ainda)
    setConfirmLoading(true)
    
    try {
      console.log('🔌 Desconectando exchange do MongoDB...', {
        exchangeId: confirmExchangeId,
        exchangeName: confirmExchangeName
      })
      
      // Desconecta no MongoDB (fonte da verdade)
      // Disconnect = Delete (remove a exchange completamente)
      await apiService.deleteExchange(confirmExchangeId)
      
      console.log('✅ Exchange desconectada no MongoDB com sucesso')
      
      // Atualizar lista de exchanges e home
      await onExchangeModified()
      
      // Fecha modal e remove loading
      setConfirmLoading(false)
      setConfirmModalVisible(false)
      console.log('✅ Disconnect concluído com sucesso!')
      
    } catch (err) {
      setConfirmLoading(false)
      setConfirmModalVisible(false)
      console.error('❌ Erro ao desconectar exchange:', err)
      alert(t('error.disconnectExchange'))
    }
  }, [confirmExchangeId, confirmExchangeName, onExchangeModified, t, user?.id])

  const handleDelete = useCallback((exchangeId: string, exchangeName: string) => {
    console.log('🗑️ [handleDelete] Recebido:', {
      exchangeId,
      exchangeIdType: typeof exchangeId,
      exchangeName
    })
    setOpenMenuId(null)
    setConfirmExchangeId(exchangeId)
    setConfirmExchangeName(exchangeName)
    setConfirmAction('delete')
    setConfirmModalVisible(true)
  }, [])

  const confirmDelete = useCallback(async () => {
    console.log('�️ [Delete] Iniciando processo de delete...', {
      exchangeId: confirmExchangeId,
      exchangeName: confirmExchangeName,
      userId: user?.id
    })
    
    if (!user?.id) {
      alert('Erro: usuário não autenticado')
      return
    }
    
    // Inicia loading NO BOTÃO (não fecha o modal ainda)
    setConfirmLoading(true)
    
    try {
      console.log('🗑️ Deletando exchange do MongoDB...')
      
      // Deleta no MongoDB (fonte da verdade)
      await apiService.deleteExchange(confirmExchangeId)
      
      console.log('✅ Exchange deletada no MongoDB com sucesso')
      
      // Atualizar lista de exchanges e home
      console.log('🔄 Chamando onExchangeModified()...')
      await onExchangeModified()
      console.log('✅ onExchangeModified() concluído!')
      
      // Fecha modal e remove loading
      setConfirmLoading(false)
      setConfirmModalVisible(false)
      console.log('✅ Delete concluído com sucesso!')
      
    } catch (err) {
      setConfirmLoading(false)
      setConfirmModalVisible(false)
      console.error('❌ Erro ao deletar exchange:', err)
      alert(t('error.deleteExchange'))
    }
  }, [confirmExchangeId, confirmExchangeName, onExchangeModified, t, user?.id])

  const toggleMenu = useCallback((exchangeId: string) => {
    setOpenMenuId(openMenuId === exchangeId ? null : exchangeId)
  }, [openMenuId])

  const openConnectModal = useCallback((exchange: AvailableExchange) => {
    console.log('🔓 [openConnectModal] Modal sendo aberto para exchange:', {
      nome: exchange.nome,
      ccxt_id: exchange.ccxt_id,
      requires_passphrase: exchange.requires_passphrase
    })
    setSelectedExchange(exchange)
    setApiKey('')
    setApiSecret('')
    setPassphrase('')
    setConnecting(false) // Reset loading state
    setConnectModalVisible(true)
    console.log('✅ [openConnectModal] Modal aberto, connectModalVisible=true')
  }, [])

  const closeConnectModal = useCallback(() => {
    setConnectModalVisible(false)
    setSelectedExchange(null)
    setApiKey('')
    setApiSecret('')
    setPassphrase('')
    setQrScannerVisible(false)
    setCurrentScanField(null)
    setConnecting(false) // Reset loading state
  }, [])

  // Funções para modal de detalhes
  const openDetailsModal = useCallback(async (exchange: any, type: 'linked' | 'available') => {
    setDetailsExchange(exchange)
    setDetailsType(type)
    setDetailsModalVisible(true)
    setLoadingDetails(false)
    setDetailsFullData(null)
  }, [])

  const closeDetailsModal = useCallback(() => {
    setDetailsModalVisible(false)
    setDetailsExchange(null)
    setDetailsFullData(null)
    setLoadingDetails(false)
  }, [])

  const handleOpenQRScanner = useCallback((field: 'apiKey' | 'apiSecret' | 'passphrase') => {
    setCurrentScanField(field)
    setQrScannerVisible(true)
  }, [])

  const handleQRScanned = useCallback((data: string) => {
    console.log('📷 QR Code escaneado:', data.substring(0, 50) + '...') // Log parcial para segurança
    
    try {
      // Tenta parsear como JSON (formato mais comum para OKX e outras exchanges)
      const parsed = JSON.parse(data)
      console.log('✅ QR Code parseado como JSON')
      
      // Formato 1: OKX padrão com campos diretos
      if (parsed.apiKey && parsed.secretKey) {
        console.log('🔑 Formato detectado: OKX padrão (apiKey + secretKey)')
        setApiKey(parsed.apiKey.trim())
        setApiSecret(parsed.secretKey.trim())
        if (parsed.passphrase) setPassphrase(parsed.passphrase.trim())
        Alert.alert(t('exchanges.qrSuccess'), t('exchanges.qrLoaded'))
        setQrScannerVisible(false)
        setCurrentScanField(null)
        return
      }
      
      // Formato 2: Formato alternativo com "api_key" e "api_secret"
      if (parsed.api_key && parsed.api_secret) {
        console.log('🔑 Formato detectado: alternativo (api_key + api_secret)')
        setApiKey(parsed.api_key.trim())
        setApiSecret(parsed.api_secret.trim())
        if (parsed.passphrase) setPassphrase(parsed.passphrase.trim())
        Alert.alert(t('exchanges.qrSuccess'), t('exchanges.qrLoaded'))
        setQrScannerVisible(false)
        setCurrentScanField(null)
        return
      }
      
      // Formato 3: Campos com nomenclatura variada
      const possibleKeyFields = ['apiKey', 'api_key', 'key', 'publicKey', 'public_key']
      const possibleSecretFields = ['secretKey', 'secret_key', 'apiSecret', 'api_secret', 'secret', 'privateKey', 'private_key']
      const possiblePassphraseFields = ['passphrase', 'pass', 'password']
      
      const detectedKey = possibleKeyFields.find(field => parsed[field])
      const detectedSecret = possibleSecretFields.find(field => parsed[field])
      const detectedPassphrase = possiblePassphraseFields.find(field => parsed[field])
      
      if (detectedKey || detectedSecret) {
        console.log('🔑 Formato detectado: campos variados')
        if (detectedKey) setApiKey(parsed[detectedKey].trim())
        if (detectedSecret) setApiSecret(parsed[detectedSecret].trim())
        if (detectedPassphrase) setPassphrase(parsed[detectedPassphrase].trim())
        
        const loadedFields = []
        if (detectedKey) loadedFields.push('API Key')
        if (detectedSecret) loadedFields.push('API Secret')
        if (detectedPassphrase) loadedFields.push('Passphrase')
        
        Alert.alert(t('exchanges.qrSuccess'), t('exchanges.qrFieldsLoaded').replace('{fields}', loadedFields.join(', ')))
        setQrScannerVisible(false)
        setCurrentScanField(null)
        return
      }
      
      // Se chegou aqui, o JSON não tem os campos esperados
      console.warn('⚠️ QR Code é JSON mas não contém campos reconhecidos')
      console.log('Campos disponíveis:', Object.keys(parsed))
      Alert.alert(
        '⚠️ QR Code não reconhecido',
        `O QR Code contém: ${Object.keys(parsed).join(', ')}\n\nPor favor, cole manualmente.`
      )
      
    } catch (error) {
      // Não é JSON - trata como texto simples
      console.log('📝 QR Code não é JSON, usando como texto simples')
      
      // Detecta se é um formato de texto estruturado (ex: "key:value")
      if (data.includes(':') || data.includes('=')) {
        console.log('🔍 Tentando extrair dados de formato texto estruturado...')
        
        // Tenta diferentes delimitadores
        const lines = data.split(/[\n\r]+/)
        const keyValuePairs: { [key: string]: string } = {}
        
        lines.forEach(line => {
          const colonMatch = line.match(/^([^:=]+)[:=]\s*(.+)$/)
          if (colonMatch) {
            const key = colonMatch[1].trim().toLowerCase()
            const value = colonMatch[2].trim()
            keyValuePairs[key] = value
          }
        })
        
        // Tenta mapear os valores encontrados
        const keyFound = keyValuePairs['api key'] || keyValuePairs['apikey'] || keyValuePairs['key']
        const secretFound = keyValuePairs['api secret'] || keyValuePairs['apisecret'] || keyValuePairs['secret'] || keyValuePairs['secretkey']
        const passphraseFound = keyValuePairs['passphrase'] || keyValuePairs['password']
        
        if (keyFound || secretFound) {
          if (keyFound) setApiKey(keyFound)
          if (secretFound) setApiSecret(secretFound)
          if (passphraseFound) setPassphrase(passphraseFound)
          
          const loaded = []
          if (keyFound) loaded.push('API Key')
          if (secretFound) loaded.push('API Secret')
          if (passphraseFound) loaded.push('Passphrase')
          
          Alert.alert(t('exchanges.qrSuccess'), t('exchanges.qrFieldsExtracted').replace('{fields}', loaded.join(', ')))
          setQrScannerVisible(false)
          setCurrentScanField(null)
          return
        }
      }
      
      // Se não conseguiu extrair, coloca no campo selecionado
      if (currentScanField === 'apiKey') {
        setApiKey(data.trim())
        Alert.alert('✅ Colado!', 'Texto do QR Code colado no campo API Key')
      } else if (currentScanField === 'apiSecret') {
        setApiSecret(data.trim())
        Alert.alert('✅ Colado!', 'Texto do QR Code colado no campo API Secret')
      } else if (currentScanField === 'passphrase') {
        setPassphrase(data.trim())
        Alert.alert('✅ Colado!', 'Texto do QR Code colado no campo Passphrase')
      }
    }
    
    setQrScannerVisible(false)
    setCurrentScanField(null)
  }, [currentScanField])

  const handleLinkExchange = useCallback(async () => {
    if (!selectedExchange) {
      return
    }
    
    if (!apiKey.trim() || !apiSecret.trim()) {
      alert(t('error.fillApiKeys'))
      return
    }

    if (selectedExchange.requires_passphrase && !passphrase.trim()) {
      alert(t('error.passphraseRequired'))
      return
    }
    
    if (!user?.id) {
      alert('Erro: usuário não autenticado')
      return
    }

    try {
      setConnecting(true)
      
      console.log('� [NEW] Salvando exchange no MongoDB via API...')
      console.log('🔐 [NEW] Exchange:', {
        ccxt_id: selectedExchange.ccxt_id,
        nome: selectedExchange.nome,
        requires_passphrase: selectedExchange.requires_passphrase
      })
      
      // 🔐 NOVO: Salvar no MongoDB via API (backend criptografa)
      try {
        const response = await apiService.addExchange({
          exchange_type: selectedExchange.ccxt_id,
          api_key: apiKey.trim(),
          api_secret: apiSecret.trim(),
          passphrase: selectedExchange.requires_passphrase ? passphrase.trim() : undefined
        })
        
        console.log('✅ [MongoDB] Exchange salva com sucesso!', response.exchange_id)
        
      } catch (apiError) {
        console.error('❌ [MongoDB] Erro ao salvar no MongoDB:', apiError)
        Alert.alert(
          t('common.error'),
          t('exchanges.connectError')
        )
        setConnecting(false)
        return
      }
      
      // Fechar modal
      closeConnectModal()
      
      // Pequeno delay para garantir que processou
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Atualizar exchanges e todos os dados da home
      await onExchangeModified()
      
    } catch (err) {
      console.error('❌ [Error] Erro ao salvar exchange:', err)
      alert(t('error.connectExchange'))
    } finally {
      setConnecting(false)
    }
  }, [selectedExchange, apiKey, apiSecret, passphrase, closeConnectModal, onExchangeModified, t, user?.id])

  // Estilos dinâmicos baseados no tema
  const themedStyles = useMemo(() => ({
    container: { backgroundColor: colors.background },
    card: { backgroundColor: colors.card, borderColor: colors.cardBorder },
    modal: { backgroundColor: colors.surface },
    modalContent: { backgroundColor: colors.surface },
    menuModal: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
    menuDivider: { backgroundColor: colors.border },
    
    // Text colors
    menuItemDanger: { color: colors.danger },
    loadingText: { color: colors.textSecondary },
    errorText: { color: colors.danger },
    retryButtonText: { color: colors.textInverse },
    
    // Tabs
    tabs: { borderBottomColor: colors.border },
    tab: { borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: colors.primary },
    tabText: { color: colors.textSecondary },
    tabTextActive: { color: colors.text, fontWeight: fontWeights.semibold },
    
    // Status
    statusTextActive: { color: colors.primary },
    statusTextInactive: { color: colors.danger },
    statusActive: { color: colors.primary },
    statusInactive: { color: colors.danger },
    exchangeCountry: { color: colors.textSecondary },
    
    // Details
    detailLabel: { color: colors.textSecondary },
    
    // Connected Badge
    connectedBadge: { 
      backgroundColor: colors.primaryLight + '20',
      borderColor: colors.primary 
    },
    
    // Connect Button
    connectButtonText: { color: colors.primary },
    
    // Info Box
    infoBox: { 
      backgroundColor: colors.infoLight,
      borderColor: colors.primary + '40'
    },
    infoText: { color: colors.primary },
    
    // Empty State
    emptyText: { color: colors.textSecondary },
    
    // Primary Button
    primaryButtonText: { color: colors.primary },
    
    // Exchange Info
    exchangeInfo: { backgroundColor: colors.surfaceSecondary, padding: 16 },
    
    // Modal Exchange Country
    modalExchangeCountry: { color: colors.textSecondary },
    
    // Input
    input: { 
      backgroundColor: colors.input,
      borderColor: colors.inputBorder,
      color: colors.text 
    },
    inputWithIcons: { 
      backgroundColor: colors.input,
      borderColor: colors.inputBorder,
      color: colors.text 
    },
    inputHint: { color: colors.primaryLight },
    
    // Cancel Button
    cancelButton: { 
      backgroundColor: colors.surfaceSecondary,
      borderColor: colors.border 
    },
    cancelButtonText: { color: colors.textSecondary },
    
    // Submit Button
    submitButtonText: { color: colors.primary },
    
    // Confirm Modal
    confirmModalContent: { backgroundColor: colors.surface },
  }), [colors])

  // Removido loading customizado - usa apenas o RefreshControl do ScrollView

  if (error) {
    return (
      <View style={[styles.container, themedStyles.container]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.surface, borderColor: colors.primary }]} onPress={() => fetchExchanges(true)}>
          <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, themedStyles.container]}>
      {/* Filters - mesmo padrão Orders */}
      <View style={[styles.filtersContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Buscar exchange..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips - mesmo padrão Orders (Todas/Compra/Venda) */}
        <View style={styles.typeFilterRow}>
          <TouchableOpacity
            style={[
              styles.typeFilterChip,
              { 
                backgroundColor: activeTab === 'all' ? colors.primary : colors.surface,
                borderColor: activeTab === 'all' ? colors.primary : colors.border
              }
            ]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[
              styles.typeFilterText,
              { color: activeTab === 'all' ? colors.background : colors.text }
            ]}>
              Todas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeFilterChip,
              { 
                backgroundColor: activeTab === 'linked' ? colors.success : colors.surface,
                borderColor: activeTab === 'linked' ? colors.success : colors.border
              }
            ]}
            onPress={() => setActiveTab('linked')}
          >
            <Text style={[
              styles.typeFilterText,
              { color: activeTab === 'linked' ? colors.background : colors.text }
            ]}>
              Conectadas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeFilterChip,
              { 
                backgroundColor: activeTab === 'available' ? colors.info || colors.primary : colors.surface,
                borderColor: activeTab === 'available' ? colors.info || colors.primary : colors.border
              }
            ]}
            onPress={() => setActiveTab('available')}
          >
            <Text style={[
              styles.typeFilterText,
              { color: activeTab === 'available' ? colors.background : colors.text }
            ]}>
              Disponíveis
            </Text>
          </TouchableOpacity>
        </View>

        {/* Results Count */}
        <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
          {(() => {
            const linkedCount = linkedExchanges.filter(ex => {
              if (!searchQuery) return true
              const q = searchQuery.toLowerCase()
              return (ex.name || '').toLowerCase().includes(q)
            }).length
            const availableCount = availableExchanges.filter(ex => {
              if (!searchQuery) return true
              const q = searchQuery.toLowerCase()
              return (ex.nome || '').toLowerCase().includes(q)
            }).filter(ex => !linkedExchanges.some(l => l.name?.toLowerCase() === ex.nome?.toLowerCase() || l.ccxt_id === ex.ccxt_id)).length
            
            if (activeTab === 'linked') return `${linkedCount} ${linkedCount === 1 ? 'conectada' : 'conectadas'}`
            if (activeTab === 'available') return `${availableCount} ${availableCount === 1 ? 'disponível' : 'disponíveis'}`
            return `${linkedCount + availableCount} exchanges`
          })()}
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {/* Linked Exchanges */}
        {(activeTab === 'all' || activeTab === 'linked') && (
          <>
            {linkedExchanges.length === 0 && activeTab === 'linked' ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔗</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('home.noData')}</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('exchanges.connectModal')}
                </Text>
              </View>
            ) : (
              <>
                {activeTab === 'all' && linkedExchanges.length > 0 && (
                  <View style={[styles.sectionHeader, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={styles.sectionHeaderLeft}>
                      <Ionicons name="link-outline" size={16} color={colors.text} />
                      <Text style={[styles.sectionHeaderText, { color: colors.text }]}>
                        Conectadas
                      </Text>
                    </View>
                    <Text style={[styles.sectionHeaderCount, { color: colors.textSecondary }]}>
                      {String(linkedExchanges.length)}
                    </Text>
                  </View>
                )}
                {[...linkedExchanges]
                  .filter(ex => {
                    if (!searchQuery) return true
                    const q = searchQuery.toLowerCase()
                    return (ex.name || '').toLowerCase().includes(q) ||
                           (ex.ccxt_id || '').toLowerCase().includes(q)
                  })
                  .sort((a, b) => {
                    const aActive = a.is_active === true || a.status === 'active'
                    const bActive = b.is_active === true || b.status === 'active'
                    if (aActive && !bActive) return -1
                    if (!aActive && bActive) return 1
                    return 0
                  })
                  .map((linkedExchange, index) => (
                    <LinkedExchangeCard
                      key={`${linkedExchange.exchange_id}_${index}_${refreshKey}`}
                      linkedExchange={linkedExchange}
                      index={index}
                      colors={colors}
                      t={t}
                      onToggle={toggleExchange}
                      onDelete={handleDelete}
                      onPress={() => openDetailsModal(linkedExchange, 'linked')}
                      isRefreshing={refreshing}
                    />
                  ))}
              </>
            )}
          </>
        )}

        {/* Available Exchanges */}
        {(activeTab === 'all' || activeTab === 'available') && (
          <>
            {(() => {
              const linkedExchangeIds = new Set(
                linkedExchanges.map(linked => linked.exchange_id)
              )

              const filteredAvailable = availableExchanges.filter(
                exchange => {
                  const isLinkedById = linkedExchangeIds.has(exchange._id)
                  const isLinkedByName = linkedExchanges.some(linked => 
                    linked.name?.toLowerCase() === exchange.nome?.toLowerCase() ||
                    linked.ccxt_id === exchange.ccxt_id
                  )

                  if (searchQuery) {
                    const q = searchQuery.toLowerCase()
                    const nameMatch = (exchange.nome || '').toLowerCase().includes(q) ||
                                      (exchange.ccxt_id || '').toLowerCase().includes(q)
                    if (!nameMatch) return false
                  }

                  return !isLinkedById && !isLinkedByName
                }
              )
              
              if (filteredAvailable.length === 0 && activeTab === 'available') {
                return (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>✅</Text>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      {t('exchanges.allConnected') || 'All exchanges connected'}
                    </Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      {t('exchanges.allConnectedDescription') || 'You have already connected all available exchanges'}
                    </Text>
                  </View>
                )
              }

              return (
                <>
                  {activeTab === 'all' && filteredAvailable.length > 0 && (
                    <View style={[styles.sectionHeader, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      <View style={styles.sectionHeaderLeft}>
                        <Ionicons name="globe-outline" size={16} color={colors.text} />
                        <Text style={[styles.sectionHeaderText, { color: colors.text }]}>
                          Disponíveis
                        </Text>
                      </View>
                      <Text style={[styles.sectionHeaderCount, { color: colors.textSecondary }]}>
                        {String(filteredAvailable.length)}
                      </Text>
                    </View>
                  )}
                  {filteredAvailable.map((exchange) => {
                    const isLinked = linkedExchanges.some(
                      linked => 
                        linked.name.toLowerCase() === exchange.nome.toLowerCase() ||
                        linked.ccxt_id === exchange.ccxt_id
                    )
                    
                    return (
                      <AvailableExchangeCard
                        key={exchange._id}
                        exchange={exchange}
                        isLinked={isLinked}
                        colors={colors}
                        t={t}
                        onConnect={openConnectModal}
                        onPress={() => openDetailsModal(exchange, 'available')}
                        isRefreshing={refreshing}
                      />
                    )
                  })}
                </>
              )
            })()}
          </>
        )}
      </ScrollView>

      {/* Modal de Menu de Opções */}
      <Modal
        visible={!!openMenuId}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenMenuId(null)}
      >
        <Pressable 
          style={styles.menuModalOverlay}
          onPress={() => setOpenMenuId(null)}
        >
          <Pressable>
            <View style={[styles.menuModal, themedStyles.modal]}>
              {(() => {
                const index = openMenuId ? parseInt(openMenuId.split('_')[1]) : -1
                const exchange = index >= 0 ? linkedExchanges[index] : null
                const isActive = exchange?.status === 'active'
                
                return (
                  <>
                    <TouchableOpacity
                      style={styles.menuItem}
                      activeOpacity={0.7}
                      onPress={(e) => {
                        e.stopPropagation()
                        if (exchange) {
                          if (isActive) {
                            handleDisconnect(exchange.exchange_id, capitalizeExchangeName(exchange.name))
                          } else {
                            toggleExchange(exchange.exchange_id, 'inactive', capitalizeExchangeName(exchange.name))
                          }
                        }
                      }}
                    >
                      <Text style={[styles.menuItemText, { color: colors.text }]}>
                        {isActive ? t('exchanges.deactivate') : t('exchanges.activate')}
                      </Text>
                    </TouchableOpacity>
                    
                    <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                    
                    <TouchableOpacity
                      style={styles.menuItem}
                      activeOpacity={0.7}
                      onPress={(e) => {
                        e.stopPropagation()
                        if (exchange) {
                          console.log('🖱️ [Menu Delete Click] Exchange data:', {
                            exchange_id: exchange.exchange_id,
                            exchange_id_type: typeof exchange.exchange_id,
                            name: exchange.name,
                            fullExchange: exchange
                          })
                          handleDelete(exchange.exchange_id, capitalizeExchangeName(exchange.name))
                        }
                      }}
                    >
                      <Text style={[styles.menuItemText, { color: colors.danger }]}>{t('exchanges.delete')}</Text>
                    </TouchableOpacity>
                  </>
                )
              })()}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Conexão */}
      <Modal
        visible={connectModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeConnectModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.safeArea}
          >
            <View style={[styles.modalContent, themedStyles.modal]}>
              {/* Header do Modal */}
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('exchanges.connectModal')}</Text>
                <TouchableOpacity onPress={closeConnectModal} style={styles.closeButton}>
                  <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {selectedExchange && (
              <>
                {/* Info da Exchange */}
                <View style={styles.exchangeInfo}>
                  <View style={styles.iconContainer}>
                    {(() => {
                      const localIcon = exchangeLogos[selectedExchange.nome.toLowerCase()]
                      if (localIcon) {
                        return (
                          <Image 
                            source={localIcon} 
                            style={styles.exchangeIcon}
                            resizeMode="contain"
                          />
                        )
                      } else if (selectedExchange.icon) {
                        return (
                          <Image 
                            source={{ uri: selectedExchange.icon }} 
                            style={styles.exchangeIcon}
                            resizeMode="contain"
                          />
                        )
                      }
                      return <Text style={styles.iconText}>🔗</Text>
                    })()}
                  </View>
                  <View>
                    <Text style={[styles.modalExchangeName, { color: colors.text }]}>{capitalizeExchangeName(selectedExchange.nome)}</Text>
                  </View>
                </View>

                {/* Formulário */}
                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>{t('exchanges.apiKey')} *</Text>
                    <View style={styles.inputWithButtons}>
                      <TextInput
                        style={[styles.inputWithQR, themedStyles.input]}
                        value={apiKey}
                        onChangeText={setApiKey}
                        placeholderTextColor={colors.textSecondary}
                        placeholder={t('exchanges.enterApiKey')}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={true}
                      />
                      <View style={styles.inputActions}>
                        <TouchableOpacity
                          style={[styles.qrButton, { backgroundColor: colors.primary }]}
                          onPress={() => handleOpenQRScanner('apiKey')}
                        >
                          <Ionicons name="qr-code-outline" size={18} color={colors.textInverse} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>{t('exchanges.apiSecret')} *</Text>
                    <View style={styles.inputWithButtons}>
                      <TextInput
                        style={[styles.inputWithQR, themedStyles.input]}
                        value={apiSecret}
                        onChangeText={setApiSecret}
                        placeholder={t('exchanges.enterApiSecret')}
                        placeholderTextColor={colors.textSecondary}
                        secureTextEntry={true}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <View style={styles.inputActions}>
                        <TouchableOpacity
                          style={[styles.qrButton, { backgroundColor: colors.primary }]}
                          onPress={() => handleOpenQRScanner('apiSecret')}
                        >
                          <Ionicons name="qr-code-outline" size={18} color={colors.textInverse} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {selectedExchange.requires_passphrase && (
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.text }]}>{t('exchanges.passphrase')} *</Text>
                      <View style={styles.inputWithButtons}>
                        <TextInput
                          style={[styles.inputWithQR, themedStyles.input]}
                          value={passphrase}
                          onChangeText={setPassphrase}
                          placeholder={t('exchanges.enterPassphrase')}
                          placeholderTextColor={colors.textSecondary}
                          secureTextEntry={true}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <View style={styles.inputActions}>
                          <TouchableOpacity
                            style={[styles.qrButton, { backgroundColor: colors.primary }]}
                            onPress={() => handleOpenQRScanner('passphrase')}
                          >
                            <Ionicons name="qr-code-outline" size={18} color={colors.textInverse} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                        ℹ️ Esta exchange requer uma passphrase
                      </Text>
                    </View>
                  )}
                </View>

                {/* Botões */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={closeConnectModal}
                    disabled={connecting}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.text }]}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: colors.surface, borderColor: colors.primary }, connecting && styles.submitButtonDisabled]}
                    onPress={() => {
                      console.log('👆 [Button] Botão "Conectar" foi clicado!')
                      console.log('👆 [Button] connecting:', connecting)
                      console.log('👆 [Button] Chamando handleLinkExchange()...')
                      handleLinkExchange()
                    }}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <AnimatedLogoIcon size={20} />
                    ) : (
                      <Text style={[styles.submitButtonText, { color: colors.primary }]}>{t('exchanges.connect')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
            </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal de Confirmação de Toggle */}
      <Modal
        visible={confirmToggleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmToggleModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.confirmModalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={[styles.confirmModalContent, { backgroundColor: colors.card }]}>
              {/* Header */}
              <View style={[styles.confirmModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmModalTitle, { color: colors.text }]}>
                  {toggleExchangeNewStatus === 'active' ? `✅ ${t('exchanges.activate')} ${t('exchanges.title').slice(0, -1)}` : `⏸️ ${t('exchanges.deactivate')} ${t('exchanges.title').slice(0, -1)}`}
                </Text>
                <TouchableOpacity onPress={() => setConfirmToggleModalVisible(false)} style={styles.confirmModalCloseButton}>
                  <Text style={[styles.confirmModalCloseIcon, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Body */}
              <View style={styles.confirmModalBody}>
                <Text style={[styles.confirmModalMessage, { color: colors.textSecondary }]}>
                  {toggleExchangeNewStatus === 'active' 
                    ? `${t('exchanges.activateConfirm')} ${toggleExchangeName}? ${t('exchanges.activateWarning')}`
                    : `${t('exchanges.deactivateConfirm')} ${toggleExchangeName}? ${t('exchanges.deactivateWarning')}`
                  }
                </Text>
              </View>

              {/* Footer Actions */}
              <View style={[styles.confirmModalFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.confirmModalButton, { backgroundColor: colors.surface }]}
                  onPress={() => setConfirmToggleModalVisible(false)}
                  activeOpacity={0.7}
                  disabled={toggleLoading}
                >
                  <Text style={[styles.confirmModalButtonText, { color: colors.text }]}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmModalButton, { backgroundColor: colors.primary, opacity: toggleLoading ? 0.6 : 1 }]}
                  onPress={confirmToggle}
                  activeOpacity={0.7}
                  disabled={toggleLoading}
                >
                  {toggleLoading ? (
                    <AnimatedLogoIcon size={24} />
                  ) : (
                    <Text style={[styles.confirmModalButtonText, { color: '#ffffff' }]}>
                      {toggleExchangeNewStatus === 'active' ? t('exchanges.activate') : t('exchanges.deactivate')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de Confirmação (Delete/Disconnect) */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.confirmModalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={[styles.confirmModalContent, { backgroundColor: colors.card }]}>
              {/* Header */}
              <View style={[styles.confirmModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmModalTitle, { color: colors.text }]}>
                  {confirmAction === 'delete' ? t('exchanges.confirmDelete') : t('exchanges.confirmDisconnect')}
                </Text>
                <TouchableOpacity onPress={() => setConfirmModalVisible(false)} style={styles.confirmModalCloseButton}>
                  <Text style={[styles.confirmModalCloseIcon, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Body */}
              <View style={styles.confirmModalBody}>
                <Text style={[styles.confirmModalMessage, { color: colors.textSecondary }]}>
                  {confirmAction === 'delete' 
                    ? `${t('exchanges.deleteConfirm')} ${confirmExchangeName}? ${t('exchanges.deleteWarning')}`
                    : `${t('exchanges.disconnectConfirm')} ${confirmExchangeName}?`
                  }
                </Text>
              </View>

              {/* Footer Actions */}
              <View style={[styles.confirmModalFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.confirmModalButton, { backgroundColor: colors.surface }]}
                  onPress={() => setConfirmModalVisible(false)}
                  activeOpacity={0.7}
                  disabled={confirmLoading}
                >
                  <Text style={[styles.confirmModalButtonText, { color: colors.text }]}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.confirmModalButton, 
                    { 
                      backgroundColor: confirmAction === 'delete' ? colors.danger : colors.primary,
                      opacity: confirmLoading ? 0.6 : 1
                    }
                  ]}
                  onPress={() => {
                    if (confirmAction === 'delete') {
                      confirmDelete()
                    } else {
                      confirmDisconnect()
                    }
                  }}
                  activeOpacity={0.7}
                  disabled={confirmLoading}
                >
                  {confirmLoading ? (
                    <AnimatedLogoIcon size={24} />
                  ) : (
                    <Text style={[styles.confirmModalButtonText, { color: '#ffffff' }]}>
                      {confirmAction === 'delete' ? t('exchanges.delete') : t('exchanges.disconnect')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de Detalhes da Exchange */}
      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeDetailsModal}
      >
        <KeyboardAvoidingView 
          style={styles.confirmModalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={[styles.detailsModalContent, { backgroundColor: colors.card }]}>
              {/* Header */}
              <View style={[styles.confirmModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmModalTitle, { color: colors.text }]}>
                  {detailsType === 'linked' ? '🔗 Exchange Conectada' : '🌐 Detalhes da Exchange'}
                </Text>
                <TouchableOpacity onPress={closeDetailsModal} style={styles.confirmModalCloseButton}>
                  <Text style={[styles.confirmModalCloseIcon, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Body */}
              <ScrollView style={styles.detailsModalScroll} showsVerticalScrollIndicator={true}>
                {detailsExchange && (
                  <View style={styles.detailsModalBody}>
                    {/* Ícone e Nome da Exchange */}
                    <View style={[styles.detailsHeader, { backgroundColor: colors.surfaceSecondary }]}>
                      <View style={styles.detailsIconContainer}>
                        {(() => {
                          const exchangeName = detailsType === 'linked' 
                            ? detailsExchange.name?.toLowerCase() 
                            : detailsExchange.nome?.toLowerCase()
                          const localIcon = exchangeLogos[exchangeName]
                          const iconUrl = detailsType === 'linked' 
                            ? detailsExchange.icon 
                            : detailsExchange.icon
                          
                          if (localIcon) {
                            return (
                              <Image 
                                source={localIcon} 
                                style={styles.detailsExchangeIcon}
                                resizeMode="contain"
                              />
                            )
                          } else if (iconUrl) {
                            return (
                              <Image 
                                source={{ uri: iconUrl }} 
                                style={styles.detailsExchangeIcon}
                                resizeMode="contain"
                              />
                            )
                          }
                          return <Text style={styles.detailsIconText}>🔗</Text>
                        })()}
                      </View>
                      <View style={styles.detailsHeaderText}>
                        <Text style={[styles.detailsExchangeName, { color: colors.text }]}>
                          {capitalizeExchangeName(detailsType === 'linked' ? detailsExchange.name : (detailsExchange.nome || detailsExchange.name || 'Unknown'))}
                        </Text>
                      </View>
                    </View>

                    {/* Informações */}
                    <View style={styles.detailsSection}>
                      <Text style={[styles.detailsSectionTitle, { color: colors.text }]}>
                         {t('exchanges.generalInfo')}
                      </Text>
                      
                      {loadingDetails ? (
                        <View style={styles.detailsLoadingContainer}>
                          <AnimatedLogoIcon size={32} />
                          <Text style={[styles.detailsLoadingText, { color: colors.textSecondary }]}>
                            {t('exchanges.loadingDetails')}
                          </Text>
                        </View>
                      ) : (
                        <>
                          {detailsType === 'linked' ? (
                            <>
                              <View style={styles.detailsInfoRow}>
                                <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                  {t('exchanges.name')}:
                                </Text>
                                <Text style={[styles.detailsInfoValue, { color: colors.text }]}>
                                  {capitalizeExchangeName(detailsExchange.name)}
                                </Text>
                              </View>
                              
                              <View style={styles.detailsInfoRow}>
                                <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                  {t('exchanges.exchangeId')}:
                                </Text>
                                <Text style={[styles.detailsInfoValue, { color: colors.text }]} numberOfLines={1}>
                                  {detailsExchange.exchange_id}
                                </Text>
                              </View>
                              
                              {detailsFullData?.ccxt_id && (
                                <View style={styles.detailsInfoRow}>
                                  <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                    {t('exchanges.ccxtId')}:
                                  </Text>
                                  <Text style={[styles.detailsInfoValue, { color: colors.text }]}>
                                    {detailsFullData.ccxt_id}
                                  </Text>
                                </View>
                              )}
                              
                              {(detailsExchange.country || detailsFullData?.pais_de_origem) && (
                                <View style={styles.detailsInfoRow}>
                                  <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                    {t('exchanges.country')}:
                                  </Text>
                                  <Text style={[styles.detailsInfoValue, { color: colors.text }]}>
                                    {detailsExchange.country || detailsFullData?.pais_de_origem || 'N/A'}
                                  </Text>
                                </View>
                              )}
                              
                              {(detailsExchange.url || detailsFullData?.url) && (
                                <View style={styles.detailsInfoRow}>
                                  <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                    {t('exchanges.website')}:
                                  </Text>
                                  <Text style={[styles.detailsInfoValue, { color: colors.primary }]} numberOfLines={1}>
                                    {detailsExchange.url || detailsFullData?.url}
                                  </Text>
                                </View>
                              )}
                              
                              <View style={styles.detailsInfoRow}>
                                <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                  {t('exchanges.connectedAt')}:
                                </Text>
                                <Text style={[styles.detailsInfoValue, { color: colors.text }]}>
                                  {new Date(detailsExchange.linked_at).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: 'long',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Text>
                              </View>
                              
                              {detailsExchange.updated_at && (
                                <View style={styles.detailsInfoRow}>
                                  <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                    {t('exchanges.lastUpdate')}:
                                  </Text>
                                  <Text style={[styles.detailsInfoValue, { color: colors.text }]}>
                                    {new Date(detailsExchange.updated_at).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </Text>
                                </View>
                              )}
                              
                              {detailsExchange.reconnected_at && (
                                <View style={styles.detailsInfoRow}>
                                  <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                    {t('exchanges.reconnectedAt')}:
                                  </Text>
                                  <Text style={[styles.detailsInfoValue, { color: colors.success }]}>
                                    {new Date(detailsExchange.reconnected_at).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </Text>
                                </View>
                              )}
                              
                              {detailsExchange.disconnected_at && (
                                <View style={styles.detailsInfoRow}>
                                  <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                    {t('exchanges.disconnectedAt')}:
                                  </Text>
                                  <Text style={[styles.detailsInfoValue, { color: colors.danger }]}>
                                    {new Date(detailsExchange.disconnected_at).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </Text>
                                </View>
                              )}
                              
                              <View style={styles.detailsInfoRow}>
                                <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                  {t('exchanges.status')}:
                                </Text>
                                <Text style={[styles.detailsInfoValue, { color: colors.text }]}>
                                  {detailsExchange.status === 'active' ? t('exchanges.active') : t('exchanges.inactive')}
                                </Text>
                              </View>

                              {/* API Key Expiry Info */}
                              {detailsExchange.api_key_expiry_days != null && (
                                <>
                                  <View style={styles.detailsInfoRow}>
                                    <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                      API Key Validade:
                                    </Text>
                                    <Text style={[styles.detailsInfoValue, { 
                                      color: detailsExchange.days_until_expiry != null && detailsExchange.days_until_expiry <= 0 
                                        ? colors.danger 
                                        : detailsExchange.days_until_expiry != null && detailsExchange.days_until_expiry <= 15 
                                          ? colors.warning 
                                          : colors.success 
                                    }]}>
                                      {detailsExchange.days_until_expiry != null && detailsExchange.days_until_expiry <= 0
                                        ? `❌ ${t('exchanges.apiKeyExpired') || 'API Key expirada'}`
                                        : detailsExchange.days_until_expiry != null && detailsExchange.days_until_expiry <= 15
                                          ? `⚠️ ${(t('exchanges.apiKeyExpiresSoon') || 'Expira em {days} dias').replace('{days}', String(detailsExchange.days_until_expiry))}`
                                          : `✅ ${detailsExchange.days_until_expiry} dias restantes`
                                      }
                                    </Text>
                                  </View>
                                  {detailsExchange.api_key_expires_at && (
                                    <View style={styles.detailsInfoRow}>
                                      <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                        Expira em:
                                      </Text>
                                      <Text style={[styles.detailsInfoValue, { color: colors.textSecondary }]}>
                                        {new Date(detailsExchange.api_key_expires_at).toLocaleDateString('pt-BR', {
                                          day: '2-digit',
                                          month: 'long',
                                          year: 'numeric'
                                        })}
                                      </Text>
                                    </View>
                                  )}
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <View style={styles.detailsInfoRow}>
                                <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                  {t('exchanges.name')}:
                                </Text>
                                <Text style={[styles.detailsInfoValue, { color: colors.text }]}>
                                  {capitalizeExchangeName(detailsExchange.nome || detailsExchange.name || 'N/A')}
                                </Text>
                              </View>
                              
                              <View style={styles.detailsInfoRow}>
                                <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                  {t('exchanges.exchangeId')}:
                                </Text>
                                <Text style={[styles.detailsInfoValue, { color: colors.text }]} numberOfLines={1}>
                                  {detailsExchange._id}
                                </Text>
                              </View>
                              
                              {detailsFullData?.ccxt_id && (
                                <View style={styles.detailsInfoRow}>
                                  <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                    {t('exchanges.ccxtId')}:
                                  </Text>
                                  <Text style={[styles.detailsInfoValue, { color: colors.text }]}>
                                    {detailsFullData.ccxt_id}
                                  </Text>
                                </View>
                              )}
                              
                              {detailsExchange.pais_de_origem && (
                                <View style={styles.detailsInfoRow}>
                                  <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                    {t('exchanges.country')}:
                                  </Text>
                                  <Text style={[styles.detailsInfoValue, { color: colors.text }]}>
                                    {detailsExchange.pais_de_origem}
                                  </Text>
                                </View>
                              )}
                              
                              {detailsExchange.url && (
                                <View style={styles.detailsInfoRow}>
                                  <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                    {t('exchanges.website')}:
                                  </Text>
                                  <Text style={[styles.detailsInfoValue, { color: colors.primary }]} numberOfLines={1}>
                                    {detailsExchange.url}
                                  </Text>
                                </View>
                              )}
                              
                              <View style={styles.detailsInfoRow}>
                                <Text style={[styles.detailsInfoLabel, { color: colors.textSecondary }]}>
                                  {t('exchanges.requiresPassphrase')}:
                                </Text>
                                <Text style={[styles.detailsInfoValue, { color: detailsExchange.requires_passphrase ? colors.primary : colors.textSecondary }]}>
                                  {detailsExchange.requires_passphrase ? t('common.yes') + ' ✓' : t('common.no')}
                                </Text>
                              </View>
                            </>
                          )}
                        </>
                      )}
                    </View>

                    {/* Recursos (se disponível) */}
                    {detailsType === 'available' && (
                      <View style={styles.detailsSection}>
                        <Text style={[styles.detailsSectionTitle, { color: colors.text }]}>
                          {t('exchanges.resources')}
                        </Text>
                        <View style={[styles.detailsFeatureBox, { backgroundColor: colors.surfaceSecondary }]}>
                          <Text style={[styles.detailsFeatureText, { color: colors.text }]}>
                            • Trading de criptomoedas
                          </Text>
                          <Text style={[styles.detailsFeatureText, { color: colors.text }]}>
                            • API para integração
                          </Text>
                          <Text style={[styles.detailsFeatureText, { color: colors.text }]}>
                            • Suporte a múltiplas moedas
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Taxas (Fees) */}
                    {detailsFullData?.fees && (
                      <View style={styles.detailsSection}>
                        <Text style={[styles.detailsSectionTitle, { color: colors.text }]}>
                          💰 Taxas
                        </Text>
                        
                        {detailsFullData.fees.trading && (
                          <View style={[styles.detailsFeesBox, { backgroundColor: colors.surfaceSecondary }]}>
                            <Text style={[styles.detailsFeesTitle, { color: colors.text }]}>Trading:</Text>
                            
                            {detailsFullData.fees.trading.maker !== undefined && detailsFullData.fees.trading.maker !== null && (
                              <View style={styles.detailsFeeRow}>
                                <Text style={[styles.detailsFeeLabel, { color: colors.textSecondary }]}>
                                  • {t('exchanges.maker')}:
                                </Text>
                                <Text style={[styles.detailsFeeValue, { color: colors.text }]}>
                                  {typeof detailsFullData.fees.trading.maker === 'number'
                                    ? `${(detailsFullData.fees.trading.maker * 100).toFixed(4)}%`
                                    : String(detailsFullData.fees.trading.maker)}
                                </Text>
                              </View>
                            )}
                            
                            {detailsFullData.fees.trading.taker !== undefined && detailsFullData.fees.trading.taker !== null && (
                              <View style={styles.detailsFeeRow}>
                                <Text style={[styles.detailsFeeLabel, { color: colors.textSecondary }]}>
                                  • {t('exchanges.taker')}:
                                </Text>
                                <Text style={[styles.detailsFeeValue, { color: colors.text }]}>
                                  {typeof detailsFullData.fees.trading.taker === 'number'
                                    ? `${(detailsFullData.fees.trading.taker * 100).toFixed(4)}%`
                                    : String(detailsFullData.fees.trading.taker)}
                                </Text>
                              </View>
                            )}
                            
                            {detailsFullData.fees.trading.percentage !== undefined && (
                              <View style={styles.detailsFeeRow}>
                                <Text style={[styles.detailsFeeLabel, { color: colors.textSecondary }]}>
                                  • Tipo:
                                </Text>
                                <Text style={[styles.detailsFeeValue, { color: colors.text }]}>
                                  {detailsFullData.fees.trading.percentage ? 'Percentual' : 'Fixo'}
                                </Text>
                              </View>
                            )}
                            
                            {detailsFullData.fees.trading.tierBased !== undefined && (
                              <View style={styles.detailsFeeRow}>
                                <Text style={[styles.detailsFeeLabel, { color: colors.textSecondary }]}>
                                  • Por nível:
                                </Text>
                                <Text style={[styles.detailsFeeValue, { color: colors.text }]}>
                                  {detailsFullData.fees.trading.tierBased ? 'Sim' : 'Não'}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                        
                        {detailsFullData.fees.funding && (
                          <View style={[styles.detailsFeesBox, { backgroundColor: colors.surfaceSecondary, marginTop: 12 }]}>
                            <Text style={[styles.detailsFeesTitle, { color: colors.text }]}>Funding:</Text>
                            
                            {detailsFullData.fees.funding.withdraw !== undefined && detailsFullData.fees.funding.withdraw !== null && (
                              <View style={styles.detailsFeeRow}>
                                <Text style={[styles.detailsFeeLabel, { color: colors.textSecondary }]}>
                                  • {t('exchanges.withdraw')}:
                                </Text>
                                <Text style={[styles.detailsFeeValue, { color: colors.text }]}>
                                  {typeof detailsFullData.fees.funding.withdraw === 'object' 
                                    ? 'Varia por moeda'
                                    : typeof detailsFullData.fees.funding.withdraw === 'number'
                                    ? `${(detailsFullData.fees.funding.withdraw * 100).toFixed(4)}%`
                                    : String(detailsFullData.fees.funding.withdraw)}
                                </Text>
                              </View>
                            )}
                            
                            {detailsFullData.fees.funding.deposit !== undefined && detailsFullData.fees.funding.deposit !== null && (
                              <View style={styles.detailsFeeRow}>
                                <Text style={[styles.detailsFeeLabel, { color: colors.textSecondary }]}>
                                  • {t('exchanges.deposit')}:
                                </Text>
                                <Text style={[styles.detailsFeeValue, { color: colors.text }]}>
                                  {typeof detailsFullData.fees.funding.deposit === 'object' 
                                    ? 'Varia por moeda'
                                    : typeof detailsFullData.fees.funding.deposit === 'number'
                                    ? `${(detailsFullData.fees.funding.deposit * 100).toFixed(4)}%`
                                    : String(detailsFullData.fees.funding.deposit)}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                        
                        {/* Mostra estrutura completa se houver mais dados */}
                        {detailsFullData.fees && !detailsFullData.fees.trading && !detailsFullData.fees.funding && (
                          <View style={[styles.detailsFeesBox, { backgroundColor: colors.surfaceSecondary }]}>
                            <Text style={[styles.detailsFeatureText, { color: colors.text }]}>
                              {t('exchanges.feeStructure')}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Mercados (Markets) */}
                    {detailsFullData?.markets && Object.keys(detailsFullData.markets).length > 0 && (
                      <View style={styles.detailsSection}>
                        <Text style={[styles.detailsSectionTitle, { color: colors.text }]}>
                          {t('exchanges.availableMarkets')}
                        </Text>
                        <View style={[styles.detailsMarketsBox, { backgroundColor: colors.surfaceSecondary }]}>
                          <Text style={[styles.detailsMarketsCount, { color: colors.text }]}>
                            {Object.keys(detailsFullData.markets).length} pares de trading disponíveis
                          </Text>
                          <View style={styles.detailsMarketsSample}>
                            {Object.keys(detailsFullData.markets).slice(0, 5).map((market, index) => (
                              <View key={index} style={[styles.detailsMarketChip, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
                                <Text style={[styles.detailsMarketText, { color: colors.primary }]}>
                                  {market}
                                </Text>
                              </View>
                            ))}
                            {Object.keys(detailsFullData.markets).length > 5 && (
                              <Text style={[styles.detailsMarketsMore, { color: colors.textSecondary }]}>
                                +{Object.keys(detailsFullData.markets).length - 5} mais
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Capacidades (Has) */}
                    {detailsFullData?.has && (
                      <View style={styles.detailsSection}>
                        <Text style={[styles.detailsSectionTitle, { color: colors.text }]}>
                          ✨ Capacidades da API
                        </Text>
                        <View style={[styles.detailsCapabilitiesBox, { backgroundColor: colors.surfaceSecondary }]}>
                          {Object.entries(detailsFullData.has)
                            .filter(([key, value]) => value === true)
                            .slice(0, 10)
                            .map(([key, value], index) => (
                              <View key={index} style={styles.detailsCapabilityRow}>
                                <Text style={[styles.detailsCapabilityText, { color: colors.text }]}>
                                  ✓ {key.replace(/([A-Z])/g, ' $1').trim()}
                                </Text>
                              </View>
                            ))}
                        </View>
                      </View>
                    )}

                    {/* Informações de Segurança */}
                    <View style={styles.detailsSection}>
                      <Text style={[styles.detailsSectionTitle, { color: colors.text }]}>
                        🔒 Segurança
                      </Text>
                      <View style={[styles.detailsSecurityBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                        <Text style={[styles.detailsSecurityText, { color: colors.text }]}>
                          {detailsType === 'linked' 
                            ? '✓ Suas credenciais estão criptografadas e seguras'
                            : 'ℹ️ Ao conectar, suas API Keys serão criptografadas'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Footer Actions */}
              <View style={[styles.detailsModalFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.confirmModalButton, { backgroundColor: colors.surface }]}
                  onPress={closeDetailsModal}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.confirmModalButtonText, { color: colors.text }]}>
                    Fechar
                  </Text>
                </TouchableOpacity>
                
                {detailsType === 'available' && !linkedExchanges.some(
                  linked => linked.exchange_id === detailsExchange?._id
                ) && (
                  <TouchableOpacity
                    style={[styles.confirmModalButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      closeDetailsModal()
                      openConnectModal(detailsExchange)
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.confirmModalButtonText, { color: '#ffffff' }]}>
                      Conectar
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* QR Scanner Modal */}
      <QRScanner
        visible={qrScannerVisible}
        onClose={() => {
          setQrScannerVisible(false)
          setCurrentScanField(null)
        }}
        onScan={handleQRScanned}
        title={
          currentScanField === 'apiKey' 
            ? 'Escanear API Key' 
            : currentScanField === 'apiSecret'
            ? 'Escanear API Secret'
            : currentScanField === 'passphrase'
            ? 'Escanear Passphrase'
            : 'Escanear Credenciais da Exchange'
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Filters - mesmo padrão Orders
  filtersContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
    paddingVertical: 0,
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeFilterChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeFilterText: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.semibold,
  },
  resultsCount: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
    paddingVertical: 4,
  },
  // Menu Modal Styles
  menuModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuModal: {
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 200,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuItemIcon: {
    fontSize: typography.displaySmall,
  },
  menuItemText: {
    fontSize: typography.bodyLarge,
    fontWeight: fontWeights.medium,
  },
  menuItemDanger: {
  },
  menuDivider: {
    height: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: typography.body,
  },
  errorText: {
    fontSize: typography.body,
    textAlign: "center",
    padding: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: "center",
    marginTop: 16,
  },
  retryButtonText: {
    fontSize: typography.body,
    fontWeight: fontWeights.regular,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerText: {
    flexDirection: "column",
  },
  headerTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeights.light,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: typography.caption,
    marginTop: 2,
    fontWeight: fontWeights.light,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.cardPadding + 2, // 16px (14 + 2 = 16)
    paddingBottom: 80,
    gap: spacing.cardPadding + 2, // 16px
  },
  content: {
    flex: 1,
  },
  iconText: {
    fontSize: typography.displaySmall,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: 3,
    borderWidth: 0,
  },
  exchangeIcon: {
    width: "100%",
    height: "100%",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: typography.emojiHuge,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: typography.body,
    textAlign: "center",
    marginBottom: 24,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  safeArea: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  modalContent: {
    borderRadius: 20,
    width: "90%",
    maxHeight: "85%",
    height: "85%",
  },
  modalScrollContent: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: typography.icon,
    fontWeight: fontWeights.regular,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: typography.h1,
    fontWeight: fontWeights.light,
  },
  exchangeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  modalExchangeName: {
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
  },
  modalExchangeCountry: {
    fontSize: typography.bodySmall,
    marginTop: 2,
  },
  form: {
    gap: 20,
    marginBottom: 24,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: typography.body,
    fontWeight: fontWeights.regular,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: typography.body,
    borderWidth: 1,
  },
  inputWithButtons: {
    position: 'relative',
  },
  inputWithIcons: {
    borderRadius: 8,
    padding: 12,
    paddingRight: 96,
    fontSize: typography.body,
    borderWidth: 1,
  },
  inputWithQR: {
    borderRadius: 8,
    padding: 12,
    paddingRight: 52,
    fontSize: typography.body,
    borderWidth: 1,
  },
  inputActions: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -18 }],
    flexDirection: 'row',
    gap: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputHint: {
    fontSize: typography.caption,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,     // 14→12 (minHeight 44px - Secondary)
    minHeight: 44,           // Padrão Secondary Button
    borderRadius: 10,        // 8→10 (padrão Secondary)
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: typography.body,  // 14→16
    fontWeight: fontWeights.regular,  // '400'→regular
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,     // Já está correto (minHeight 48px)
    minHeight: 48,           // Padrão Primary Button
    borderRadius: 12,        // 8→12 (padrão Primary)
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.body,  // 14→16
    fontWeight: fontWeights.medium,  // '600'→medium
  },
  // Confirm Modal (centralizado)
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmModalContent: {
    borderRadius: 20,
    width: "90%",
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  confirmModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  confirmModalTitle: {
    fontSize: typography.icon,
    fontWeight: fontWeights.medium,
  },
  confirmModalCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalCloseIcon: {
    fontSize: typography.display,
    fontWeight: fontWeights.light,
  },
  confirmModalBody: {
    padding: 24,
  },
  confirmModalMessage: {
    fontSize: typography.body,
    fontWeight: fontWeights.light,
    lineHeight: 20,
  },
  confirmModalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 0.5,
  },
  confirmModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalButtonText: {
    fontSize: typography.bodyLarge,
    fontWeight: fontWeights.regular,
  },
  // Details Modal Styles
  detailsModalContent: {
    borderRadius: 20,
    width: "90%",
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  detailsModalScroll: {
    maxHeight: 500,
  },
  detailsModalBody: {
    padding: 20,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  detailsIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  detailsExchangeIcon: {
    width: 48,
    height: 48,
  },
  detailsIconText: {
    fontSize: typography.emoji,
  },
  detailsHeaderText: {
    flex: 1,
    gap: 8,
  },
  detailsExchangeName: {
    fontSize: typography.displaySmall,
    fontWeight: fontWeights.semibold,
  },
  detailsStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  detailsStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  detailsStatusText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },
  detailsSection: {
    marginBottom: 24,
  },
  detailsSectionTitle: {
    fontSize: typography.h4,
    fontWeight: fontWeights.semibold,
    marginBottom: 12,
  },
  detailsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  detailsInfoLabel: {
    fontSize: typography.body,
    fontWeight: fontWeights.regular,
    flex: 1,
  },
  detailsInfoValue: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
    flex: 1.5,
    textAlign: 'right',
  },
  detailsFeatureBox: {
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  detailsFeatureText: {
    fontSize: typography.body,
    fontWeight: fontWeights.regular,
    lineHeight: 22,
  },
  detailsSecurityBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  detailsSecurityText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
    lineHeight: 20,
  },
  detailsModalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 0.5,
  },
  detailsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  detailsLoadingText: {
    fontSize: typography.body,
    fontWeight: fontWeights.regular,
  },
  detailsFeesBox: {
    padding: 12,
    borderRadius: 8,
  },
  detailsFeesTitle: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
    marginBottom: 8,
  },
  detailsFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailsFeeLabel: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
  },
  detailsFeeValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  detailsMarketsBox: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  detailsMarketsCount: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },
  detailsMarketsSample: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  detailsMarketChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  detailsMarketText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },
  detailsMarketsMore: {
    fontSize: typography.caption,
    fontWeight: fontWeights.regular,
    paddingVertical: 6,
  },
  detailsCapabilitiesBox: {
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  detailsCapabilityRow: {
    paddingVertical: 4,
  },
  detailsCapabilityText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.regular,
    lineHeight: 20,
  },
  // Card compacto - mesmo padrão Orders
  compactCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  typeIconImage: {
    width: '100%',
    height: '100%',
  },
  typeIconText: {
    fontSize: typography.iconSmall,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardInfoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardSymbol: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
    flexShrink: 1,
  },
  sideBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  sideBadgeText: {
    fontSize: typography.badge,
    fontWeight: fontWeights.bold,
  },
  cardSubtext: {
    fontSize: typography.micro,
    fontWeight: fontWeights.regular,
  },
  cardRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  cardValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
  },
  // Ações do card (footer)
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
  },
  cardActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 5,
  },
  cardActionDivider: {
    width: 1,
    height: 16,
  },
  cardActionText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.semibold,
  },
  connectFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 5,
    borderTopWidth: 1,
  },
  // Section headers (para tab "Todas")
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.bold,
  },
  sectionHeaderCount: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },
})
