import React, { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
} from "react-native"
import { Picker } from "@react-native-picker/picker"
import { useTheme } from "@/contexts/ThemeContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { useBalance } from "@/contexts/BalanceContext"
import { useBackendStrategies } from "@/hooks/useBackendStrategies"
import { exchangeService } from "@/services/exchange-service"
import { AnimatedLogoIcon } from "./AnimatedLogoIcon"
import { typography, fontWeights } from "@/lib/typography"
import { apiService } from "@/services/api"
import { LinkedExchange } from "@/types/api"
import { config } from "@/lib/config"
import { capitalizeExchangeName } from "@/lib/exchange-helpers"
import { useNotifications } from "@/contexts/NotificationsContext"
import { notify } from "@/services/notify"

// Tipo para exchange no modal
interface LocalExchange {
  _id: string
  exchange_id: string
  exchange_type: string  // CCXT ID: binance, bybit, etc
  name: string
  ccxt_id: string
  is_active: boolean
}

interface CreateStrategyModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: (strategyId: string) => void
  userId: string
  navigation?: any
}

export function CreateStrategyModal({ visible, onClose, onSuccess, userId, navigation }: CreateStrategyModalProps) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { data: balanceData, loading: balanceLoading } = useBalance()
  const { createStrategy } = useBackendStrategies(false) // Não auto-load
  const { addNotification } = useNotifications()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [exchanges, setExchanges] = useState<LocalExchange[]>([])
  const [loadingExchanges, setLoadingExchanges] = useState(false)
  const [tokens, setTokens] = useState<string[]>([])
  const [loadingTokens, setLoadingTokens] = useState(false)
  const [searchingToken, setSearchingToken] = useState(false)
  const [tokenSearchResults, setTokenSearchResults] = useState<any[]>([])

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [selectedExchange, setSelectedExchange] = useState<string>("")
  const [selectedExchangeType, setSelectedExchangeType] = useState<string>("")  // CCXT ID: binance, bybit, etc
  const [token, setToken] = useState<string>("")
  const [showCustomTokenInput, setShowCustomTokenInput] = useState(false)
  
  // Token search/filter state
  const [tokenSearchQuery, setTokenSearchQuery] = useState<string>("")
  const [showTokenList, setShowTokenList] = useState(true)
  const tokenInputRef = useRef<TextInput>(null)
  const [keyboardVisible, setKeyboardVisible] = useState(false)

  // Templates da API
  const [apiTemplates, setApiTemplates] = useState<any[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Detectar teclado aberto/fechado
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    )
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    )
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  useEffect(() => {
    if (visible) {
      loadExchanges()
      loadApiTemplates()
    } else {
      // Reset form when modal closes
      setStep(1)
      setSelectedTemplate("")
      setSelectedExchange("")
      setToken("")
      setTokens([])
      setShowCustomTokenInput(false)
      setTokenSearchResults([])
      setTokenSearchQuery("")
      setShowTokenList(true)
    }
  }, [visible])

  // Carrega templates da API
  const loadApiTemplates = async () => {
    try {
      setLoadingTemplates(true)
      const res = await apiService.listStrategyTemplates()
      // this.get() retorna { data: { success, templates } }
      const body = res?.data ?? res
      if (body?.success && body.templates) {
        setApiTemplates(body.templates)
      }
    } catch (e) {
      console.error("❌ Erro ao carregar templates:", e)
    } finally {
      setLoadingTemplates(false)
    }
  }

  // Load tokens when reaching step 3
  useEffect(() => {
    if (step === 3 && selectedExchange) {
      setToken("") // Clear token selection when exchange changes
      setTokenSearchQuery("") // Clear search
      setShowTokenList(true)
      loadTokens()
    }
  }, [step, selectedExchange])

  // Filtrar tokens com base na busca
  const filteredTokens = React.useMemo(() => {
    
    // Garante que tokens é um array válido
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return []
    }
    
    // Se não há busca, retorna todos os tokens
    if (!tokenSearchQuery.trim()) {
      return tokens
    }
    
    // Filtra tokens pela busca
    const query = tokenSearchQuery.toLowerCase()
    const filtered = tokens.filter(tokenSymbol => 
      tokenSymbol && typeof tokenSymbol === 'string' && tokenSymbol.toLowerCase().includes(query)
    )
    return filtered
  }, [tokens, tokenSearchQuery])

  const loadExchanges = async () => {
    try {
      setLoadingExchanges(true)
      console.log('📊 Loading connected exchanges from MongoDB via API...')
      
      // � Busca exchanges do MongoDB (via API backend)
      const response = await apiService.listExchanges()
      const connectedExchanges = response.exchanges.filter((ex: any) => ex.is_active)
      
      console.log(`✅ Loaded ${connectedExchanges.length} active exchanges from MongoDB`)
      
      // Converter para o formato esperado pelo componente
      const formattedExchanges = connectedExchanges.map(ex => ({
        _id: ex.exchange_id,
        exchange_id: ex.exchange_id,
        exchange_type: ex.exchange_type,  // CCXT ID: binance, bybit, etc
        name: capitalizeExchangeName(ex.exchange_name),
        ccxt_id: ex.exchange_type,
        is_active: ex.is_active,
      }))
      
      setExchanges(formattedExchanges)
    } catch (error) {
      console.error("❌ Error loading exchanges:", error)
      Alert.alert(t("common.error"), t("error.loadExchanges") || "Erro ao carregar exchanges")
    } finally {
      setLoadingExchanges(false)
    }
  }

  const loadTokens = async () => {
    // Validação: verifica se exchange foi selecionada
    if (!selectedExchange || !selectedExchangeType) {
      console.log('⚠️ No exchange selected')
      setTokens([])
      return
    }

    try {
      setLoadingTokens(true)
      setTokens([])
      
      console.log(`📊 Loading tokens for exchange: ${selectedExchangeType} (id: ${selectedExchange})`)
      
      // 🗄️ Busca tokens do MongoDB cache usando ccxt_id (binance, bybit, mexc, etc)
      const url = `${config.apiBaseUrl}/tokens/by-ccxt?ccxt_id=${selectedExchangeType}&quote=USDT`
      
      console.log(`🔗 Calling GET: ${url}`)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error("❌ HTTP error:", response.status, errorText)
        throw new Error(`Erro ao buscar tokens: ${response.status}`)
      }
      
      const data = await response.json()
      console.log(`✅ Received ${data.tokens?.length || 0} tokens from MongoDB cache`)
      
      if (data && Array.isArray(data.tokens)) {
        // Extrai símbolos dos tokens
        const tokenSymbols = data.tokens.map((token: any) => {
          // Se for string, retorna direto
          if (typeof token === 'string') {
            return token
          }
          // Se for objeto, pega o campo symbol ou base
          if (token && typeof token === 'object') {
            return token.symbol || token.base || null
          }
          return null
        }).filter((symbol: any): symbol is string => symbol !== null)
        
        // Remove duplicatas e ordena
        const uniqueTokens = [...new Set<string>(tokenSymbols)].sort()
        
        if (uniqueTokens.length > 0) {
          console.log(`✅ Setting ${uniqueTokens.length} unique tokens`)
          setTokens(uniqueTokens)
        } else {
          console.log('⚠️ No tokens found')
          setTokens([])
          Alert.alert(t("common.warning"), t("warning.noTokensAvailable") || "Nenhum token disponível para esta exchange")
        }
      } else {
        console.log('⚠️ Invalid response format')
        setTokens([])
        Alert.alert(t("common.warning"), t("error.invalidResponse") || "Resposta inválida do servidor")
      }
    } catch (error) {
      console.error("❌ Error loading available tokens:", error)
      const errorMessage = error instanceof Error ? error.message : t("error.unknownError")
      Alert.alert(t("common.error"), `${t("error.loadTokens") || "Erro ao carregar tokens"}: ${errorMessage}`)
      setTokens([])
    } finally {
      setLoadingTokens(false)
    }
  }

  // Busca token específico na API
  const handleCreateStrategy = async () => {
    if (!selectedTemplate || !selectedExchange || !token.trim()) {
      Alert.alert(t("common.attention"), t("error.fillAllFields"))
      return
    }

    try {
      setLoading(true)
      
      // Busca exchange do array local
      const exchange = exchanges.find(ex => ex.exchange_id === selectedExchange)
      if (!exchange) {
        throw new Error("Exchange não encontrada")
      }
      
      // Template selecionado vem do MongoDB (via API)
      const tplInfo = getSelectedTemplate()
      
      const strategyData = {
        name: generateStrategyName(),
        description: `Estratégia ${tplInfo.name} para ${token} na ${capitalizeExchangeName(exchange.name)}`,
        symbol: token,
        exchange_id: selectedExchange,
        exchange_name: capitalizeExchangeName(exchange.name),
        strategy_type: tplInfo.type,
        config: {
          template_id: selectedTemplate,
          template_name: tplInfo.name,
          exchange_id: selectedExchange,
          created_via: 'modal'
        },
      }
      
      console.log('💾 Saving strategy to MongoDB:', strategyData)
      const createdStrategy = await createStrategy(strategyData)

      // Fecha o modal e limpa o loading antes de chamar onSuccess
      setLoading(false)
      onClose()
      
      const strategyId = createdStrategy.id || ""
      
      // 🔔 Notificação: Estratégia criada
      notify.strategyCreated(addNotification, {
        name: strategyData.name,
        symbol: token,
        exchange: capitalizeExchangeName(exchange.name),
        template: selectedTemplate,
        strategyId,
      })
      
      // Aguarda um pouco para o modal fechar antes de recarregar
      setTimeout(() => {
        onSuccess(strategyId)
      }, 300)
    } catch (error: any) {
      console.error("❌ Error creating strategy:", error)
      setLoading(false)
      
      // 🔔 Notificação: Erro ao criar
      notify.strategyError(addNotification, {
        name: generateStrategyName(),
        action: 'criar',
        error: error.message || 'Erro desconhecido',
      })
      
      Alert.alert(t("common.error"), error.message || t("error.createStrategy"))
    }
  }

  const canProceedToStep2 = selectedTemplate !== ""
  const canProceedToStep3 = selectedExchange !== ""
  const canCreate = token.trim() !== ""

  const getSelectedExchangeName = () => {
    const exchange = exchanges.find(e => {
      const exchangeId = e.exchange_id || e._id || ""
      return exchangeId === selectedExchange
    })
    return capitalizeExchangeName(exchange?.name || "")
  }

  // Gera nome da estratégia: Token_Exchange_timestamp
  const generateStrategyName = () => {
    const exchName = getSelectedExchangeName()
    const ts = Math.floor(Date.now() / 1000)
    return `${token}_${exchName}_${ts}`
  }

  // Helper: busca o template selecionado da API (MongoDB)
  const getSelectedTemplate = () => {
    const tpl = apiTemplates.find(t => t.id === selectedTemplate)
    if (tpl) return { name: tpl.name, icon: tpl.icon, type: tpl.strategy_type }
    return { name: selectedTemplate, icon: "📊", type: selectedTemplate }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t("strategy.newStrategy")}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={[styles.closeIcon, { color: colors.text }]}>✕</Text>
              </TouchableOpacity>
            </View>
          {/* Steps Indicator - esconde quando teclado aberto no step 3 */}
          {!(step === 3 && keyboardVisible) && (
          <View style={styles.stepsContainer}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  { borderColor: colors.primary },
                  step >= 1 && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.stepNumber,
                    { color: step >= 1 ? colors.primaryText : colors.primary },
                  ]}
                >
                  1
                </Text>
              </View>
              <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
                {t("strategy.labelTemplate")}
              </Text>
            </View>
            <View style={[styles.stepLine, { backgroundColor: colors.border }]} />
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  { borderColor: step >= 2 ? colors.primary : colors.border },
                  step >= 2 && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.stepNumber,
                    { color: step >= 2 ? colors.primaryText : colors.textSecondary },
                  ]}
                >
                  2
                </Text>
              </View>
              <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
                {t("strategy.labelExchange")}
              </Text>
            </View>
            <View style={[styles.stepLine, { backgroundColor: colors.border }]} />
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  { borderColor: step >= 3 ? colors.primary : colors.border },
                  step >= 3 && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.stepNumber,
                    { color: step >= 3 ? colors.primaryText : colors.textSecondary },
                  ]}
                >
                  3
                </Text>
              </View>
              <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
                {t("strategy.labelToken")}
              </Text>
            </View>
          </View>
          )}
          {/* Content */}
          {step === 3 ? (
            <View style={[styles.content, { paddingHorizontal: 20, paddingTop: 8 }]}>
              {/* Título + resumo — esconde quando teclado está aberto */}
              {!keyboardVisible && (
                <>
                  <Text style={[styles.stepTitle, { color: colors.text, marginBottom: 10 }]}>
                    {t("strategy.chooseToken")}
                  </Text>
                  <View style={[styles.summaryCard, { marginBottom: 10, padding: 10, gap: 2 }]}>
                    <View style={styles.summaryRow}>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Template:</Text>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                        {getSelectedTemplate().name}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Exchange:</Text>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                        {getSelectedExchangeName()}
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {loadingTokens ? (
                <View style={styles.loadingContainer}>
                  <AnimatedLogoIcon size={48} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Carregando tokens...
                  </Text>
                </View>
              ) : token && !showTokenList ? (
                /* ── Token selecionado: resumo completo da estratégia ── */
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                  {/* Card do token selecionado (toque para alterar) */}
                  <TouchableOpacity
                    onPress={() => {
                      setShowTokenList(true)
                      setTokenSearchQuery("")
                    }}
                    activeOpacity={0.7}
                    style={{
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                      borderRadius: 16,
                      padding: 16,
                      backgroundColor: `${colors.primary}08`,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <Text style={{ fontSize: 32 }}>🪙</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.primary, letterSpacing: 1 }}>
                        {token}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        Toque para alterar
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18, color: colors.textSecondary }}>✏️</Text>
                  </TouchableOpacity>

                  {/* Resumo completo da estratégia */}
                  <View style={{
                    marginTop: 16,
                    borderRadius: 14,
                    borderWidth: 0.5,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    overflow: 'hidden',
                  }}>
                    {/* Header do resumo */}
                    <View style={{
                      backgroundColor: `${colors.primary}10`,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: 0.5,
                      borderBottomColor: colors.border,
                    }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                        📋 Resumo da Estratégia
                      </Text>
                    </View>

                    {/* Linhas de detalhe */}
                    <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                      {/* Nome */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '400' }}>Nome</Text>
                        <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500', maxWidth: '65%', textAlign: 'right' }} numberOfLines={1}>
                          {token}_{getSelectedExchangeName()}_{Math.floor(Date.now() / 1000)}
                        </Text>
                      </View>
                      <View style={{ height: 0.5, backgroundColor: colors.border, opacity: 0.5 }} />

                      {/* Template */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '400' }}>Template</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 16 }}>
                            {getSelectedTemplate().icon}
                          </Text>
                          <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>
                            {getSelectedTemplate().name}
                          </Text>
                        </View>
                      </View>
                      <View style={{ height: 0.5, backgroundColor: colors.border, opacity: 0.5 }} />

                      {/* Exchange */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '400' }}>Exchange</Text>
                        <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>
                          {getSelectedExchangeName()}
                        </Text>
                      </View>
                      <View style={{ height: 0.5, backgroundColor: colors.border, opacity: 0.5 }} />

                      {/* Tipo de Estratégia */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '400' }}>Tipo</Text>
                        <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '500' }}>
                          {getSelectedTemplate().type}
                        </Text>
                      </View>
                      <View style={{ height: 0.5, backgroundColor: colors.border, opacity: 0.5 }} />

                      {/* Par de Trading */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '400' }}>Par</Text>
                        <Text style={{ fontSize: 14, color: colors.text, fontWeight: '600' }}>
                          {token}/USDT
                        </Text>
                      </View>
                      <View style={{ height: 0.5, backgroundColor: colors.border, opacity: 0.5 }} />

                      {/* Status */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '400' }}>Status</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                          <Text style={{ fontSize: 14, color: '#10b981', fontWeight: '500' }}>
                            Ativa
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Descrição */}
                  <View style={{
                    marginTop: 12,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: `${colors.textSecondary}08`,
                    borderWidth: 0.5,
                    borderColor: colors.border,
                  }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20, fontStyle: 'italic' }}>
                      {`Estratégia ${getSelectedTemplate().name} para ${token} na ${getSelectedExchangeName()}`}
                    </Text>
                  </View>
                </ScrollView>
              ) : (
                /* ── Lista de tokens: busca + FlatList ── */
                <View style={{ flex: 1 }}>
                  {/* Campo de busca */}
                  <View style={[
                    styles.tokenSearchInputWrapper,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      marginBottom: 6,
                    },
                  ]}>
                    <Text style={{ fontSize: 16 }}>🔍</Text>
                    <TextInput
                      ref={tokenInputRef}
                      style={{
                        flex: 1,
                        fontSize: 17,
                        fontWeight: '400',
                        color: colors.text,
                        paddingVertical: 0,
                      }}
                      placeholder="Buscar token (ex: BTC, ETH, SOL...)"
                      placeholderTextColor={colors.textSecondary}
                      value={tokenSearchQuery}
                      onChangeText={setTokenSearchQuery}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="search"
                    />
                    {tokenSearchQuery.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setTokenSearchQuery("")
                          tokenInputRef.current?.focus()
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={{ color: colors.textSecondary, fontSize: 18 }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Contagem */}
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, paddingHorizontal: 4 }}>
                    {tokenSearchQuery
                      ? `${filteredTokens.length} resultado${filteredTokens.length !== 1 ? 's' : ''}`
                      : `${tokens.length} tokens disponíveis`
                    }
                  </Text>

                  {/* Lista */}
                  <FlatList
                    data={filteredTokens}
                    keyExtractor={(item) => item}
                    keyboardShouldPersistTaps="always"
                    keyboardDismissMode="on-drag"
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderRadius: 12,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    }}
                    contentContainerStyle={{ paddingVertical: 4 }}
                    renderItem={({ item: tokenSymbol }) => {
                      const isSelected = token === tokenSymbol
                      return (
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            backgroundColor: isSelected ? `${colors.primary}12` : 'transparent',
                          }}
                          onPress={() => {
                            setToken(tokenSymbol)
                            setTokenSearchQuery("")
                            setShowTokenList(false)
                            Keyboard.dismiss()
                          }}
                          activeOpacity={0.5}
                        >
                          <Text style={{ fontSize: 17, marginRight: 12 }}>🪙</Text>
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 17,
                              fontWeight: isSelected ? '600' : '400',
                              color: isSelected ? colors.primary : colors.text,
                              letterSpacing: 0.3,
                            }}
                          >
                            {tokenSymbol}
                          </Text>
                          {isSelected && (
                            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '600' }}>✓</Text>
                          )}
                        </TouchableOpacity>
                      )
                    }}
                    ItemSeparatorComponent={() => (
                      <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16, opacity: 0.4 }} />
                    )}
                    ListEmptyComponent={
                      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center' }}>
                          {tokenSearchQuery
                            ? `Nenhum token encontrado para "${tokenSearchQuery}"`
                            : "Nenhum token disponível"
                          }
                        </Text>
                      </View>
                    }
                    initialNumToRender={30}
                    maxToRenderPerBatch={30}
                    windowSize={7}
                    getItemLayout={(_, index) => ({
                      length: 49,
                      offset: 49 * index,
                      index,
                    })}
                  />
                </View>
              )}
            </View>
          ) : (
          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
          >
            {/* Step 1: Template Selection - da API */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>
                  {t("strategy.chooseTemplate")}
                </Text>
                <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
                  {t("strategy.selectTemplate")}
                </Text>

                {loadingTemplates ? (
                  <View style={styles.loadingContainer}>
                    <AnimatedLogoIcon size={48} />
                  </View>
                ) : (
                  <View style={styles.templatesList}>
                    {apiTemplates.map((tpl) => (
                      <TouchableOpacity
                        key={tpl.id}
                        style={[
                          styles.templateCard,
                          { backgroundColor: colors.background, borderColor: colors.border },
                          selectedTemplate === tpl.id && {
                            borderColor: colors.primary,
                            borderWidth: 2,
                          },
                        ]}
                        onPress={() => setSelectedTemplate(tpl.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.templateIcon}>{tpl.icon}</Text>
                        <Text style={[styles.templateName, { color: colors.text }]}>
                          {tpl.name}
                        </Text>
                        <Text style={[styles.templateDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                          {tpl.summary || tpl.strategy_type}
                        </Text>
                      </TouchableOpacity>
                    ))}

                    {/* Botão: Criar novo template → navega para StrategyTemplates */}
                    <TouchableOpacity
                      style={[
                        styles.templateCard,
                        {
                          backgroundColor: 'transparent',
                          borderColor: colors.primary,
                          borderWidth: 1.5,
                          borderStyle: 'dashed' as any,
                        },
                      ]}
                      onPress={() => {
                        onClose()
                        setTimeout(() => {
                          navigation?.navigate("StrategyTemplates")
                        }, 300)
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.templateIcon}>➕</Text>
                      <Text style={[styles.templateName, { color: colors.primary }]}>
                        Criar Novo Template
                      </Text>
                      <Text style={[styles.templateDescription, { color: colors.textSecondary }]}>
                        Personalize seu próprio template
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
            {/* Step 2: Exchange Selection */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>
                  {t("strategy.chooseExchange")}
                </Text>
                <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
                  {t("strategy.selectExchangeDesc")}
                </Text>
                {loadingExchanges ? (
                  <View style={styles.loadingContainer}>
                    <AnimatedLogoIcon size={48} />
                  </View>
                ) : exchanges.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📭</Text>
                    <Text style={[styles.emptyText, { color: colors.text }]}>
                      Nenhuma exchange conectada
                    </Text>
                    <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
                      Conecte uma exchange na aba "Exchanges"
                    </Text>
                  </View>
                ) : (
                  <View style={styles.exchangesList}>
                    {exchanges.map((exchange) => {
                      // Use exchange_id and exchangeType (CCXT ID)
                      const exchangeId = exchange.exchange_id || exchange._id || ""
                      const exchangeType = exchange.exchange_type || exchange.ccxt_id || ""
                      return (
                        <TouchableOpacity
                          key={exchangeId}
                          style={[
                            styles.exchangeCard,
                            { backgroundColor: colors.background, borderColor: colors.border },
                            selectedExchange === exchangeId && {
                              borderColor: colors.primary,
                              borderWidth: 2,
                            },
                          ]}
                          onPress={() => {
                            setSelectedExchange(exchangeId)
                            setSelectedExchangeType(exchangeType)  // Guardar o CCXT ID
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.exchangeName, { color: colors.text }]}>
                            {capitalizeExchangeName(exchange.name)}
                          </Text>
                          <Text
                            style={[
                              styles.exchangeStatus,
                              {
                                color: "#10b981",
                              },
                            ]}
                          >
                            ● Conectada
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
          )}
          {/* Footer - esconde quando teclado aberto no step 3 */}
          {!(step === 3 && keyboardVisible) && (
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            {step > 1 && (
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary, { borderColor: colors.border }]}
                onPress={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
                disabled={loading}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>{t("common.back")}</Text>
              </TouchableOpacity>
            )}
            {step < 3 ? (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.buttonPrimary,
                  { backgroundColor: colors.primary },
                  (step === 1 && !canProceedToStep2) || (step === 2 && !canProceedToStep3)
                    ? { opacity: 0.5 }
                    : {},
                ]}
                onPress={() => {
                  const nextStep = (step + 1) as 1 | 2 | 3
                  setStep(nextStep)
                }}
                disabled={
                  (step === 1 && !canProceedToStep2) || (step === 2 && !canProceedToStep3)
                }
              >
                <Text style={styles.buttonTextPrimary}>{step === 3 ? t("common.create") : t("common.next")}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.buttonPrimary,
                  { backgroundColor: colors.primary },
                  !canCreate || loading ? { opacity: 0.5 } : {},
                ]}
                onPress={handleCreateStrategy}
                disabled={!canCreate || loading}
              >
                {loading ? (
                  <AnimatedLogoIcon size={24} />
                ) : (
                  <Text style={styles.buttonTextPrimary}>Criar Estratégia</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          )}
        </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
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
  modalContainer: {
    borderRadius: 20,
    width: "90%",
    maxHeight: "85%",
    height: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: typography.h2,
    fontWeight: fontWeights.medium,
  },
  closeButton: {
    padding: 4,
  },
  closeIcon: {
    fontSize: typography.h1,
    fontWeight: fontWeights.light,
  },
  stepsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  stepItem: {
    alignItems: "center",
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  stepNumber: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },
  stepLabel: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.light,
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
    marginBottom: 22,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    flexGrow: 1,
  },
  stepContent: {
    paddingBottom: 20,
  },
  stepTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeights.medium,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: typography.body,
    fontWeight: fontWeights.light,
    marginBottom: 24,
  },
  templatesList: {
    gap: 12,
    paddingBottom: 12,
  },
  templateCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 4,
  },
  templateIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  templateName: {
    fontSize: typography.h4,
    fontWeight: fontWeights.medium,
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
    textAlign: "center",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.light,
    textAlign: "center",
  },
  exchangesList: {
    gap: 12,
  },
  exchangeCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  exchangeName: {
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
    marginBottom: 6,
  },
  exchangeStatus: {
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    marginBottom: 20,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryLabel: {
    fontSize: typography.body,
    fontWeight: fontWeights.light,
  },
  summaryValue: {
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },
  input: {
    borderWidth: 0.5,
    borderRadius: 12,
    padding: 14,
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
  },
  loadingText: {
    fontSize: typography.body,
    fontWeight: fontWeights.light,
    marginTop: 12,
    textAlign: "center",
  },
  tokenInputContainer: {
    marginBottom: 16,
  },
  searchContainer: {
    marginBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingRight: 4,
  },
  searchInputText: {
    flex: 1,
    padding: 12,
    fontSize: typography.h4,
    fontWeight: fontWeights.regular,
  },
  searchIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  searchIcon: {
    fontSize: typography.h3,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontWeight: "400",
  },
  searchButton: {
    width: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    fontSize: 20,
  },
  suggestionsDropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
    overflow: 'hidden',
  },
  suggestionsScrollView: {
    maxHeight: 200,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: "400",
  },
  tokenInfoCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  tokenInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tokenInfoTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  tokenInfoClose: {
    fontSize: 18,
    fontWeight: '300',
    paddingHorizontal: 4,
  },
  tokenInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenInfoLabel: {
    fontSize: 13,
    fontWeight: '300',
  },
  tokenInfoValue: {
    fontSize: 14,
    fontWeight: '400',
  },
  inputHint: {
    fontSize: 12,
    fontWeight: '300',
    marginTop: 6,
    fontStyle: 'italic',
  },
  toggleListButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  toggleListText: {
    fontSize: 14,
    fontWeight: '400',
  },
  tokenCount: {
    fontSize: 12,
    fontWeight: '300',
  },
  noResultsCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  tokensListContainer: {
    flex: 1,
  },
  tokensScrollView: {
    maxHeight: 200,
    borderWidth: 1,
    borderRadius: 8,
  },
  tokenListItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  tokenListItemText: {
    fontSize: 15,
    fontWeight: "300",
  },
  noResultsContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 14,
    fontWeight: '300',
    marginBottom: 8,
  },
  noResultsHint: {
    fontSize: 13,
    fontWeight: "400",
  },
  selectWrapper: {
    borderWidth: 0.5,
    borderRadius: 12,
    overflow: "hidden",
  },
  pickerWrapper: {
    borderWidth: 0.5,
    borderRadius: 12,
    overflow: "hidden",
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  picker: {
    height: Platform.OS === "ios" ? 180 : 50,
    width: "100%",
    fontSize: 16,
  },
  customInputContainer: {
    gap: 12,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "400",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  // ── Step 3 Token Selection (redesigned) ──
  selectedTokenCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  selectedTokenCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectedTokenIcon: {
    fontSize: 28,
  },
  selectedTokenCardTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeights.medium,
  },
  selectedTokenCardSub: {
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
    marginTop: 2,
  },
  tokenSearchRow: {
    marginBottom: 8,
  },
  tokenSearchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 14,
    gap: 10,
  },
  tokenSearchIcon: {
    fontSize: 16,
  },
  tokenSearchField: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: fontWeights.regular,
    paddingVertical: 0,
  },
  tokenSearchClear: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  tokenCountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  tokenCountText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
  },
  tokenDismissText: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
  },
  tokenFlatList: {
    borderWidth: 1,
    borderRadius: 14,
    maxHeight: 320,
    flexGrow: 0,
  },
  tokenFlatListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    gap: 10,
  },
  tokenFlatListIcon: {
    fontSize: 18,
  },
  tokenFlatListText: {
    flex: 1,
    fontSize: typography.body,
  },
  tokenEmptyList: {
    paddingVertical: 32,
    alignItems: "center",
  },
  tokenEmptyText: {
    fontSize: typography.body,
    fontWeight: fontWeights.light,
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,       // Adiciona padding horizontal padrão
    borderRadius: 12,            // 8→12 (padrão primary button)
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,               // Adiciona minHeight padrão
  },
  buttonSecondary: {
    borderWidth: 1,
  },
  buttonPrimary: {},
  buttonText: {
    fontSize: 14,
    fontWeight: "400",
  },
  buttonTextPrimary: {
    color: "#1a1a1a",
    fontSize: 14,
    fontWeight: "500",
  },
  tokenSearchInput: {
    height: 48,
    borderWidth: 0.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  dropdown: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 12,
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: "400",
  },
  clearButton: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedTokenBadge: {
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  selectedTokenText: {
    fontSize: 13,
    fontWeight: "500",
  },
})
