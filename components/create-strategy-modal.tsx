import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
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

// Tipo para exchange no modal (dados locais do WatermelonDB)
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
}

const TEMPLATES = [
  {
    id: "simple",
    nameKey: "strategy.simple",
    descriptionKey: "strategy.simpleDesc",
    icon: "📊",
  },
  {
    id: "conservative",
    nameKey: "strategy.conservative",
    descriptionKey: "strategy.conservativeDesc",
    icon: "🛡️",
  },
  {
    id: "aggressive",
    nameKey: "strategy.aggressive",
    descriptionKey: "strategy.aggressiveDesc",
    icon: "🚀",
  },
]

export function CreateStrategyModal({ visible, onClose, onSuccess, userId }: CreateStrategyModalProps) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { data: balanceData, loading: balanceLoading } = useBalance()
  const { createStrategy } = useBackendStrategies(false) // Não auto-load
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
  const [showTokenDropdown, setShowTokenDropdown] = useState(false)

  useEffect(() => {
    if (visible) {
      loadExchanges()
    } else {
      // Reset form when modal closes
      setStep(1)
      setSelectedTemplate("")
      setSelectedExchange("")
      setToken("")
      setTokens([])
      setShowCustomTokenInput(false)
      setTokenSearchResults([])
    }
  }, [visible])

  // Load tokens when reaching step 3
  useEffect(() => {
    if (step === 3 && selectedExchange) {
      setToken("") // Clear token selection when exchange changes
      setTokenSearchQuery("") // Clear search
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
      const connectedExchanges = await exchangeService.getActiveExchanges(userId)
      
      console.log(`✅ Loaded ${connectedExchanges.length} active exchanges from MongoDB`)
      
      // Converter para o formato esperado pelo componente
      const formattedExchanges = connectedExchanges.map(ex => ({
        _id: ex.id,
        exchange_id: ex.id,
        exchange_type: ex.exchangeType,  // CCXT ID: binance, bybit, etc
        name: ex.exchangeName,
        ccxt_id: ex.exchangeType,
        is_active: ex.isActive,
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
      
      // Busca exchange do WatermelonDB para pegar o nome
      const exchange = await exchangeService.getExchangeById(selectedExchange)
      if (!exchange) {
        throw new Error("Exchange não encontrada")
      }
      
      // Mapeia template para tipo de estratégia
      const strategyTypeMap: Record<string, string> = {
        simple: 'grid',
        conservative: 'dca',
        aggressive: 'trailing_stop'
      }
      
      const strategyData = {
        name: `${token} - ${selectedTemplate}`,
        description: `Estratégia ${selectedTemplate} para ${token} na ${exchange.exchange_name}`,
        symbol: token,
        exchange_id: selectedExchange,
        exchange_name: exchange.exchange_name,
        strategy_type: strategyTypeMap[selectedTemplate] || 'grid',
        config: {
          template: selectedTemplate,
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
      
      // Aguarda um pouco para o modal fechar antes de recarregar
      setTimeout(() => {
        Alert.alert(t("common.success"), `${t("success.strategyCreated")}\n\nToken: ${token}`)
        onSuccess(strategyId)
      }, 300)
    } catch (error: any) {
      console.error("❌ Error creating strategy:", error)
      setLoading(false)
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
    return exchange?.name || ""
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
          {/* Steps Indicator */}
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
          {/* Content */}
          <ScrollView 
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
          >
            {/* Step 1: Template Selection */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>
                  {t("strategy.chooseTemplate")}
                </Text>
                <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
                  {t("strategy.selectTemplate")}
                </Text>

                <View style={styles.templatesList}>
                  {TEMPLATES.map((template) => (
                    <TouchableOpacity
                      key={template.id}
                      style={[
                        styles.templateCard,
                        { backgroundColor: colors.background, borderColor: colors.border },
                        selectedTemplate === template.id && {
                          borderColor: colors.primary,
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => {
                        setSelectedTemplate(template.id)
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.templateIcon}>{template.icon}</Text>
                      <Text style={[styles.templateName, { color: colors.text }]}>
                        {t(template.nameKey)}
                      </Text>
                      <Text style={[styles.templateDescription, { color: colors.textSecondary }]}>
                        {t(template.descriptionKey)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                      // Use exchange_id (WatermelonDB ID) and exchangeType (CCXT ID)
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
                            {exchange.name}
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
            {/* Step 3: Token Selection */}
            {step === 3 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>
                  {t("strategy.chooseToken")}
                </Text>
                <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
                  {t("strategy.selectTokenDesc")}
                </Text>

                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                      Template:
                    </Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {t(TEMPLATES.find(t => t.id === selectedTemplate)?.nameKey || '')}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                      Exchange:
                    </Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {getSelectedExchangeName()}
                    </Text>
                  </View>
                </View>
                {loadingTokens ? (
                  <View style={styles.loadingContainer}>
                    <AnimatedLogoIcon size={48} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      Carregando tokens...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.customInputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                      Token
                    </Text>
                    <View style={{ position: "relative" }}>
                      <TextInput
                        style={[
                          styles.tokenSearchInput,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                            color: colors.text,
                          },
                        ]}
                        placeholder="Buscar ou selecionar token..."
                        placeholderTextColor={colors.textSecondary}
                        value={tokenSearchQuery || token}
                        onChangeText={(text) => {
                          setTokenSearchQuery(text)
                          setShowTokenDropdown(true)
                          // Se limpar, limpa a seleção
                          if (!text) {
                            setToken("")
                          }
                        }}
                        onFocus={() => {
                          // Chama o endpoint para buscar tokens disponíveis
                          if (selectedExchange && tokens.length === 0) {
                            loadTokens()
                          }
                          
                          setShowTokenDropdown(true)
                          // Se já tem um token selecionado, limpa para mostrar todos
                          if (token && !tokenSearchQuery) {
                            setTokenSearchQuery("")
                          }
                        }}
                      />
                      {showTokenDropdown && filteredTokens.length > 0 && (
                        <View
                          style={[
                            styles.dropdown,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <ScrollView
                            style={{ maxHeight: 200 }}
                            nestedScrollEnabled={true}
                            keyboardShouldPersistTaps="handled"
                          >
                            {filteredTokens.map((tokenSymbol) => (
                              <TouchableOpacity
                                key={tokenSymbol}
                                style={[
                                  styles.dropdownItem,
                                  {
                                    backgroundColor:
                                      token === tokenSymbol
                                        ? `${colors.primary}15`
                                        : "transparent",
                                  },
                                ]}
                                onPress={() => {
                                  setToken(tokenSymbol)
                                  setTokenSearchQuery("")
                                  setShowTokenDropdown(false)
                                }}
                              >
                                <Text
                                  style={[
                                    styles.dropdownItemText,
                                    {
                                      color:
                                        token === tokenSymbol
                                          ? colors.primary
                                          : colors.text,
                                    },
                                  ]}
                                >
                                  {tokenSymbol}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                      {token && !showTokenDropdown && (
                        <TouchableOpacity
                          style={styles.clearButton}
                          onPress={() => {
                            setToken("")
                            setTokenSearchQuery("")
                          }}
                        >
                          <Text style={{ color: colors.textSecondary, fontSize: typography.h3 }}>×</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {token && (
                      <View
                        style={[
                          styles.selectedTokenBadge,
                          { backgroundColor: `${colors.primary}15` },
                        ]}
                      >
                        <Text style={[styles.selectedTokenText, { color: colors.primary }]}>
                          Token selecionado: {token}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
          {/* Footer */}
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
