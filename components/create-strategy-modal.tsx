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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Switch,
ActivityIndicator } from "react-native"
import { useTheme } from "@/contexts/ThemeContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { useBackendStrategies, CreateStrategyRequest } from "@/hooks/useBackendStrategies"
import { typography, fontWeights } from "@/lib/typography"
import { apiService } from "@/services/api"
import { config } from "@/lib/config"
import { capitalizeExchangeName } from "@/lib/exchange-helpers"
import { useNotifications } from "@/contexts/NotificationsContext"
import { notify } from "@/services/notify"
import { TokenIcon } from "@/components/TokenIcon"

interface LocalExchange {
  _id: string
  exchange_id: string
  exchange_type: string
  name: string
  ccxt_id: string
  is_active: boolean
}

interface SimulatorPreset {
  token?: string
  basePrice?: string
  investedAmount?: string
  takeProfitPercent?: string
  stopLossEnabled?: boolean
  stopLossPercent?: string
  gradualSell?: boolean
  gradualLots?: string
  gradualTakePercent?: string
  timerGradualMin?: string
  timeExecutionMin?: string
  feePercent?: string
  dcaEnabled?: boolean
  dcaBuyAmountUsd?: string
  dcaTriggerPercent?: string
  dcaMaxBuys?: string
  buyDipEnabled?: boolean
  buyDipPercent?: string
  buyDipAmountUsd?: string
  buyDipMaxBuys?: string
}

interface CreateStrategyModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: (strategyId: string) => void
  userId: string
  navigation?: any
  simulatorPreset?: SimulatorPreset
}

export function CreateStrategyModal({ visible, onClose, onSuccess, userId, navigation, simulatorPreset }: CreateStrategyModalProps) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { createStrategy } = useBackendStrategies(false)
  const { addNotification } = useNotifications()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [exchanges, setExchanges] = useState<LocalExchange[]>([])
  const [loadingExchanges, setLoadingExchanges] = useState(false)
  const [tokens, setTokens] = useState<string[]>([])
  const [loadingTokens, setLoadingTokens] = useState(false)
  const [keyboardVisible, setKeyboardVisible] = useState(false)

  const [selectedExchange, setSelectedExchange] = useState<string>("")
  const [selectedExchangeType, setSelectedExchangeType] = useState<string>("")
  const [token, setToken] = useState<string>("")
  const [tokenSearchQuery, setTokenSearchQuery] = useState<string>("")
  const [showTokenList, setShowTokenList] = useState(true)
  const tokenInputRef = useRef<TextInput>(null)

  const [basePrice, setBasePrice] = useState<string>("")
  const [investedAmount, setInvestedAmount] = useState<string>("")
  const [takeProfitPercent, setTakeProfitPercent] = useState<string>("5.0")
  const [stopLossPercent, setStopLossPercent] = useState<string>("3.0")
  const [stopLossEnabled, setStopLossEnabled] = useState(true)
  const [gradualTakePercent, setGradualTakePercent] = useState<string>("2.0")
  const [feePercent, setFeePercent] = useState<string>("0.1")
  const [gradualSell, setGradualSell] = useState(true)
  const [timerGradualMin, setTimerGradualMin] = useState<string>("15")
  const [timeExecutionMin, setTimeExecutionMin] = useState<string>("120")
  const [dcaEnabled, setDcaEnabled] = useState(false)
  const [dcaBuyAmountUsd, setDcaBuyAmountUsd] = useState<string>("")
  const [dcaTriggerPercent, setDcaTriggerPercent] = useState<string>("5.0")
  const [dcaMaxBuys, setDcaMaxBuys] = useState<string>("3")
  const [buyDipEnabled, setBuyDipEnabled] = useState(false)
  const [buyDipPercent, setBuyDipPercent] = useState<string>("5.0")
  const [buyDipAmountUsd, setBuyDipAmountUsd] = useState<string>("")
  const [buyDipMaxBuys, setBuyDipMaxBuys] = useState<string>("3")

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    )
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    )
    return () => { showSub.remove(); hideSub.remove() }
  }, [])

  useEffect(() => {
    if (visible) {
      loadExchanges()
      // Pré-preenche com dados do simulador se disponível
      if (simulatorPreset) {
        if (simulatorPreset.token) {
          setToken(simulatorPreset.token)
          setTokenSearchQuery(simulatorPreset.token)
          setShowTokenList(false)
        }
        if (simulatorPreset.basePrice) setBasePrice(simulatorPreset.basePrice)
        if (simulatorPreset.investedAmount) setInvestedAmount(simulatorPreset.investedAmount)
        if (simulatorPreset.takeProfitPercent) setTakeProfitPercent(simulatorPreset.takeProfitPercent)
        if (simulatorPreset.stopLossEnabled !== undefined) setStopLossEnabled(simulatorPreset.stopLossEnabled)
        if (simulatorPreset.stopLossPercent) setStopLossPercent(simulatorPreset.stopLossPercent)
        if (simulatorPreset.gradualSell !== undefined) setGradualSell(simulatorPreset.gradualSell)
        if (simulatorPreset.gradualTakePercent) setGradualTakePercent(simulatorPreset.gradualTakePercent)
        if (simulatorPreset.timerGradualMin) setTimerGradualMin(simulatorPreset.timerGradualMin)
        if (simulatorPreset.timeExecutionMin) setTimeExecutionMin(simulatorPreset.timeExecutionMin)
        if (simulatorPreset.feePercent) setFeePercent(simulatorPreset.feePercent)
        if (simulatorPreset.dcaEnabled !== undefined) setDcaEnabled(simulatorPreset.dcaEnabled)
        if (simulatorPreset.dcaBuyAmountUsd) setDcaBuyAmountUsd(simulatorPreset.dcaBuyAmountUsd)
        if (simulatorPreset.dcaTriggerPercent) setDcaTriggerPercent(simulatorPreset.dcaTriggerPercent)
        if (simulatorPreset.dcaMaxBuys) setDcaMaxBuys(simulatorPreset.dcaMaxBuys)
        if (simulatorPreset.buyDipEnabled !== undefined) setBuyDipEnabled(simulatorPreset.buyDipEnabled)
        if (simulatorPreset.buyDipPercent) setBuyDipPercent(simulatorPreset.buyDipPercent)
        if (simulatorPreset.buyDipAmountUsd) setBuyDipAmountUsd(simulatorPreset.buyDipAmountUsd)
        if (simulatorPreset.buyDipMaxBuys) setBuyDipMaxBuys(simulatorPreset.buyDipMaxBuys)
      }
    } else {
      setStep(1)
      setSelectedExchange("")
      setSelectedExchangeType("")
      setToken("")
      setTokens([])
      setTokenSearchQuery("")
      setShowTokenList(true)
      setBasePrice("")
      setInvestedAmount("")
      setTakeProfitPercent("5.0")
      setStopLossPercent("3.0")
      setStopLossEnabled(true)
      setGradualTakePercent("2.0")
      setFeePercent("0.1")
      setGradualSell(true)
      setTimerGradualMin("15")
      setTimeExecutionMin("120")
      setDcaEnabled(false)
      setDcaBuyAmountUsd("")
      setDcaTriggerPercent("5.0")
      setDcaMaxBuys("3")
      setBuyDipEnabled(false)
      setBuyDipPercent("5.0")
      setBuyDipAmountUsd("")
      setBuyDipMaxBuys("3")
    }
  }, [visible])

  useEffect(() => {
    if (step === 2 && selectedExchange) {
      // Só reseta token se NÃO veio do simulador
      if (!simulatorPreset?.token) {
        setToken("")
        setTokenSearchQuery("")
        setShowTokenList(true)
      }
      loadTokens()
    }
  }, [step, selectedExchange])

  const filteredTokens = React.useMemo(() => {
    if (!Array.isArray(tokens) || tokens.length === 0) return []
    if (!tokenSearchQuery.trim()) return tokens
    const query = tokenSearchQuery.toLowerCase()
    return tokens.filter(t => t && typeof t === 'string' && t.toLowerCase().includes(query))
  }, [tokens, tokenSearchQuery])

  const loadExchanges = async () => {
    try {
      setLoadingExchanges(true)
      const response = await apiService.listExchanges()
      const connected = response.exchanges.filter((ex: any) => ex.is_active)
      setExchanges(connected.map((ex: any) => ({
        _id: ex.exchange_id,
        exchange_id: ex.exchange_id,
        exchange_type: ex.exchange_type,
        name: capitalizeExchangeName(ex.exchange_name),
        ccxt_id: ex.exchange_type,
        is_active: ex.is_active,
      })))
    } catch (error) {
      Alert.alert(t("common.error"), "Erro ao carregar exchanges")
    } finally {
      setLoadingExchanges(false)
    }
  }

  const loadTokens = async () => {
    if (!selectedExchange || !selectedExchangeType) { setTokens([]); return }
    try {
      setLoadingTokens(true)
      setTokens([])
      const url = `${config.apiBaseUrl}/tokens/by-ccxt?ccxt_id=${selectedExchangeType}&quote=USDT`
      const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
      if (!response.ok) throw new Error(`Erro: ${response.status}`)
      const data = await response.json()
      if (data && Array.isArray(data.tokens)) {
        const pairs = data.tokens.map((t: any) => {
          if (typeof t === 'string') return t
          if (t && typeof t === 'object') return t.pair || t.symbol || t.base || null
          return null
        }).filter((p: any): p is string => p !== null)
        const unique = [...new Set<string>(pairs)].sort()
        setTokens(unique)
        if (unique.length === 0) Alert.alert(t("common.warning"), "Nenhum token disponivel")
      }
    } catch (error) {
      Alert.alert(t("common.error"), "Erro ao carregar tokens")
      setTokens([])
    } finally {
      setLoadingTokens(false)
    }
  }

  const bp = parseFloat(basePrice) || 0
  const ia = parseFloat(investedAmount) || 0
  const tp = parseFloat(takeProfitPercent) || 0
  const sl = parseFloat(stopLossPercent) || 0
  const fee = parseFloat(feePercent) || 0
  const triggerPrice = bp > 0 ? bp * (1 + tp / 100 + fee / 100) : 0
  const stopLossPrice = bp > 0 ? bp * (1 - sl / 100) : 0

  const getSelectedExchangeName = () => {
    const ex = exchanges.find(e => e.exchange_id === selectedExchange)
    return capitalizeExchangeName(ex?.name || "")
  }

  const generateStrategyName = () => {
    const exchName = getSelectedExchangeName()
    const ts = Math.floor(Date.now() / 1000)
    const base = token.includes('/') ? token.split('/')[0] : token
    return `${base}_${exchName}_${ts}`
  }

  const handleCreateStrategy = async () => {
    if (!selectedExchange || !token.trim()) {
      Alert.alert(t("common.attention"), "Selecione exchange e token")
      return
    }
    if (tp <= 0 || (stopLossEnabled && sl <= 0)) {
      Alert.alert(t("common.attention"), "Take Profit e Stop Loss sao obrigatorios")
      return
    }
    try {
      setLoading(true)
      const exchange = exchanges.find(ex => ex.exchange_id === selectedExchange)
      if (!exchange) throw new Error("Exchange nao encontrada")

      const strategyData: CreateStrategyRequest = {
        name: generateStrategyName(),
        symbol: token,
        exchange_id: selectedExchange,
        exchange_name: capitalizeExchangeName(exchange.name),
        config: {
          base_price: bp,
          invested_amount: ia > 0 ? ia : undefined,
          take_profit_percent: tp,
          stop_loss_enabled: stopLossEnabled,
          stop_loss_percent: stopLossEnabled ? sl : 5.0,
          gradual_take_percent: parseFloat(gradualTakePercent) || 2.0,
          fee_percent: fee,
          gradual_sell: gradualSell,
          gradual_lots: [],
          timer_gradual_min: parseInt(timerGradualMin) || 15,
          time_execution_min: parseInt(timeExecutionMin) || 120,
          dca_enabled: dcaEnabled,
          dca_buy_amount_usd: dcaEnabled ? (parseFloat(dcaBuyAmountUsd) || 0) : undefined,
          dca_trigger_percent: dcaEnabled ? (parseFloat(dcaTriggerPercent) || 5.0) : undefined,
          dca_max_buys: dcaEnabled ? (parseInt(dcaMaxBuys) || 3) : undefined,
          auto_buy_dip_enabled: buyDipEnabled,
          auto_buy_dip_percent: buyDipEnabled ? (parseFloat(buyDipPercent) || 5.0) : undefined,
          auto_buy_dip_amount_usd: buyDipEnabled ? (parseFloat(buyDipAmountUsd) || 0) : undefined,
          auto_buy_dip_max_buys: buyDipEnabled ? (parseInt(buyDipMaxBuys) || 3) : undefined,
        },
      }

      const created = await createStrategy(strategyData)
      setLoading(false)
      onClose()

      const tokenBase = token.includes('/') ? token.split('/')[0] : token
      notify.strategyCreated(addNotification, {
        name: strategyData.name,
        symbol: tokenBase,
        exchange: capitalizeExchangeName(exchange.name),
        template: 'simple',
        strategyId: created.id || "",
      })
      setTimeout(() => onSuccess(created.id || ""), 300)
    } catch (error: any) {
      setLoading(false)
      notify.strategyError(addNotification, {
        name: generateStrategyName(),
        action: 'criar',
        error: error.message || 'Erro desconhecido',
      })
      Alert.alert(t("common.error"), error.message || "Erro ao criar estrategia")
    }
  }

  const canProceedToStep2 = selectedExchange !== ""
  const canProceedToStep3 = token.trim() !== ""
  const canCreate = tp > 0 && (stopLossEnabled ? sl > 0 : true)

  const renderStepIndicator = () => (
    <View style={styles.stepsContainer}>
      {[1, 2, 3].map((s, i) => (
        <React.Fragment key={s}>
          {i > 0 && <View style={[styles.stepLine, { backgroundColor: colors.border }]} />}
          <View style={styles.stepItem}>
            <View style={[
              styles.stepCircle,
              { borderColor: step >= s ? colors.primary : colors.border },
              step >= s && { backgroundColor: colors.primary },
            ]}>
              <Text style={[styles.stepNumber, { color: step >= s ? colors.primaryText : colors.textSecondary }]}>
                {s}
              </Text>
            </View>
            <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
              {s === 1 ? 'Exchange' : s === 2 ? 'Token' : 'Config'}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  )

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>{t("strategy.chooseExchange")}</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        {t("strategy.selectExchangeDesc")}
      </Text>
      {loadingExchanges ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="small" /></View>
      ) : exchanges.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: typography.emojiHuge, marginBottom: 12 }}>📭</Text>
          <Text style={{ fontSize: typography.h4, color: colors.text }}>{t('strategy.noExchanges')}</Text>
          <Text style={{ fontSize: typography.body, color: colors.textSecondary, textAlign: 'center' }}>
            {t('strategy.connectExchange')}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {exchanges.map((exchange) => (
            <TouchableOpacity
              key={exchange.exchange_id}
              style={[
                styles.card,
                { backgroundColor: colors.background, borderColor: colors.border },
                selectedExchange === exchange.exchange_id && { borderColor: colors.primary, borderWidth: 2 },
              ]}
              onPress={() => {
                setSelectedExchange(exchange.exchange_id)
                setSelectedExchangeType(exchange.exchange_type)
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: typography.h4, fontWeight: fontWeights.medium, color: colors.text }}>
                {capitalizeExchangeName(exchange.name)}
              </Text>
              <Text style={{ color: "#10b981", fontSize: typography.caption }}>● {t('strategy.connected')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )

  const renderStep2 = () => (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8 }}>
      {!keyboardVisible && (
        <Text style={[styles.stepTitle, { color: colors.text, marginBottom: 10 }]}>
          {t("strategy.chooseToken")}
        </Text>
      )}
      {loadingTokens ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
          <Text style={{ color: colors.textSecondary, marginTop: 12 }}>{t('common.loadingTokens')}</Text>
        </View>
      ) : token && !showTokenList ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
          <TouchableOpacity
            onPress={() => { setShowTokenList(true); setTokenSearchQuery("") }}
            activeOpacity={0.7}
            style={{
              borderWidth: 1.5, borderColor: colors.primary, borderRadius: 16, padding: 16,
              backgroundColor: `${colors.primary}08`, flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <TokenIcon symbol={token.split('/')[0]} size={40} style={{ flexShrink: 0 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.h1, fontWeight: fontWeights.bold, color: colors.primary, letterSpacing: 1 }}>{token}</Text>
              <Text style={{ fontSize: typography.caption, color: colors.textSecondary, marginTop: 2 }}>{t('strategy.tapToChange')}</Text>
            </View>
            <Text style={{ fontSize: typography.icon, color: colors.textSecondary }}>✏️</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={[styles.searchInputWrapper, { borderColor: colors.border, backgroundColor: colors.background, marginBottom: 6 }]}>
            <Text style={{ fontSize: typography.h4 }}>🔍</Text>
            <TextInput
              ref={tokenInputRef}
              style={{ flex: 1, fontSize: typography.h3, color: colors.text, paddingVertical: 0 }}
              placeholder={t('strategy.searchToken')}
              placeholderTextColor={colors.textSecondary}
              value={tokenSearchQuery}
              onChangeText={setTokenSearchQuery}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {tokenSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setTokenSearchQuery(""); tokenInputRef.current?.focus() }}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.icon }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: typography.caption, marginBottom: 6, paddingHorizontal: 4 }}>
            {tokenSearchQuery ? `${filteredTokens.length} resultado${filteredTokens.length !== 1 ? 's' : ''}` : `${tokens.length} tokens`}
          </Text>
          <FlatList
            data={filteredTokens}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            style={{ flex: 1, borderWidth: 1, borderRadius: 12, borderColor: colors.border, backgroundColor: colors.background }}
            contentContainerStyle={{ paddingVertical: 4 }}
            renderItem={({ item: sym }) => {
              const isSelected = token === sym
              return (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
                    backgroundColor: isSelected ? `${colors.primary}12` : 'transparent',
                  }}
                  onPress={() => { setToken(sym); setTokenSearchQuery(""); setShowTokenList(false); Keyboard.dismiss() }}
                  activeOpacity={0.5}
                >
                  <TokenIcon symbol={sym.split('/')[0]} size={24} style={{ marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: typography.h3, fontWeight: isSelected ? fontWeights.semibold : fontWeights.regular, color: isSelected ? colors.primary : colors.text }}>
                    {sym}
                  </Text>
                  {isSelected && <Text style={{ color: colors.primary, fontSize: typography.icon, fontWeight: fontWeights.semibold }}>✓</Text>}
                </TouchableOpacity>
              )
            }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16, opacity: 0.4 }} />}
            ListEmptyComponent={
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.bodyLarge }}>
                  {tokenSearchQuery ? `Nenhum resultado para "${tokenSearchQuery}"` : 'Nenhum token disponivel'}
                </Text>
              </View>
            }
            initialNumToRender={30}
            maxToRenderPerBatch={30}
            windowSize={7}
            getItemLayout={(_, index) => ({ length: 49, offset: 49 * index, index })}
          />
        </View>
      )}
    </View>
  )

  const renderStep3 = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 }}
      showsVerticalScrollIndicator={true}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Configuração</Text>
        <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Configure preço de compra, valor investido, take profit, stop loss e venda gradual.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>💰 Preço de Compra (USDT)</Text>
          <TextInput
            style={[styles.fieldInput, { borderColor: basePrice ? colors.primary : colors.border, color: colors.text, backgroundColor: colors.background }]}
            placeholder="Deixe vazio para buscar automaticamente"
            placeholderTextColor={colors.textSecondary}
            value={basePrice}
            onChangeText={(v) => setBasePrice(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
          />
          <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
            Preço unitário da moeda na compra. Se vazio, busca o preço atual da exchange automaticamente.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>💵 Valor Investido (USDT)</Text>
          <TextInput
            style={[styles.fieldInput, { borderColor: investedAmount ? '#f59e0b' : colors.border, color: colors.text, backgroundColor: colors.background }]}
            placeholder="Ex: 36.00 (opcional)"
            placeholderTextColor={colors.textSecondary}
            value={investedAmount}
            onChangeText={(v) => setInvestedAmount(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
          />
          <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
            Quanto você investiu em $. Ativa double-check: só vende se o investimento realmente der lucro.
          </Text>
          {ia > 0 && bp > 0 && (
            <View style={{ marginTop: 6, padding: 8, backgroundColor: '#f59e0b10', borderRadius: 6, borderWidth: 1, borderColor: '#f59e0b30' }}>
              <Text style={{ fontSize: typography.caption, color: '#f59e0b', fontWeight: fontWeights.semibold }}>
                🔒 Double-check ativo: ~{(ia / bp).toFixed(4)} moedas
              </Text>
              <Text style={{ fontSize: typography.tiny, color: colors.textSecondary, marginTop: 2 }}>
                Venda só executa se ${ia.toFixed(2)} realmente der lucro no momento do trigger.
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.fieldCard, { borderColor: '#10b98140', backgroundColor: '#10b98108' }]}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>🎯 Take Profit (%)</Text>
          <TextInput
            style={[styles.fieldInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            placeholder="5.0"
            placeholderTextColor={colors.textSecondary}
            value={takeProfitPercent}
            onChangeText={(v) => setTakeProfitPercent(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
          />
          {bp > 0 && triggerPrice > 0 && (
            <Text style={{ fontSize: typography.caption, color: '#10b981', marginTop: 6, fontWeight: fontWeights.medium }}>
              Trigger: ${triggerPrice.toFixed(4)} (base + {tp}% + {fee}% fee)
            </Text>
          )}
        </View>

        <View style={[styles.fieldCard, { borderColor: stopLossEnabled ? '#ef444440' : colors.border + '40', backgroundColor: stopLossEnabled ? '#ef444408' : colors.background }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: stopLossEnabled ? 12 : 0 }}>
            <Text style={[styles.fieldLabel, { color: colors.text, marginBottom: 0 }]}>🛡️ Stop Loss</Text>
            <Switch
              value={stopLossEnabled}
              onValueChange={setStopLossEnabled}
              trackColor={{ false: colors.border, true: '#ef444460' }}
              thumbColor={stopLossEnabled ? '#ef4444' : '#f4f3f4'}
            />
          </View>
          {!stopLossEnabled && (
            <Text style={{ fontSize: typography.caption, color: colors.textSecondary, fontStyle: 'italic' }}>
              Stop loss desativado — a estratégia nunca vende por queda de preço (hold).
            </Text>
          )}
          {stopLossEnabled && (
            <>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Stop Loss (%)</Text>
              <TextInput
                style={[styles.fieldInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="3.0"
                placeholderTextColor={colors.textSecondary}
                value={stopLossPercent}
                onChangeText={(v) => setStopLossPercent(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
              />
              {bp > 0 && stopLossPrice > 0 && (
                <Text style={{ fontSize: typography.caption, color: '#ef4444', marginTop: 6, fontWeight: fontWeights.medium }}>
                  Stop: ${stopLossPrice.toFixed(4)} (base - {sl}%)
                </Text>
              )}
            </>
          )}
        </View>

        <View style={[styles.fieldCard, { borderColor: dcaEnabled ? '#3b82f640' : colors.border + '40', backgroundColor: dcaEnabled ? '#3b82f608' : colors.background }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: dcaEnabled ? 12 : 0 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.fieldLabel, { color: colors.text, marginBottom: 2 }]}>📉 DCA (Compra na Queda)</Text>
              <Text style={{ fontSize: typography.tiny, color: colors.textSecondary }}>
                Compra mais quando o preço cai, baixando o preço médio
              </Text>
            </View>
            <Switch
              value={dcaEnabled}
              onValueChange={(v) => {
                setDcaEnabled(v)
                if (v && stopLossEnabled) setStopLossEnabled(false)
              }}
              trackColor={{ false: colors.border, true: '#3b82f660' }}
              thumbColor={dcaEnabled ? '#3b82f6' : '#f4f3f4'}
            />
          </View>
          {dcaEnabled && (
            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ fontSize: typography.bodySmall, color: colors.textSecondary, marginBottom: 4 }}>Valor por compra (USD)</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="36.00"
                  placeholderTextColor={colors.textSecondary}
                  value={dcaBuyAmountUsd}
                  onChangeText={(v) => setDcaBuyAmountUsd(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                />
                <Text style={{ fontSize: typography.tiny, color: colors.textSecondary, marginTop: 4 }}>
                  Quanto comprar a cada queda (ex: $36)
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: typography.bodySmall, color: colors.textSecondary, marginBottom: 4 }}>Queda para acionar (%)</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="5.0"
                  placeholderTextColor={colors.textSecondary}
                  value={dcaTriggerPercent}
                  onChangeText={(v) => setDcaTriggerPercent(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                />
              </View>
              <View>
                <Text style={{ fontSize: typography.bodySmall, color: colors.textSecondary, marginBottom: 4 }}>Máx. de compras DCA</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="3"
                  placeholderTextColor={colors.textSecondary}
                  value={dcaMaxBuys}
                  onChangeText={(v) => setDcaMaxBuys(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
                <Text style={{ fontSize: typography.tiny, color: colors.textSecondary, marginTop: 4 }}>
                  Máx investido: ${((parseFloat(dcaBuyAmountUsd) || 0) * (parseInt(dcaMaxBuys) || 3) + ia).toFixed(2)}
                </Text>
              </View>
              {bp > 0 && ia > 0 && (parseFloat(dcaBuyAmountUsd) || 0) > 0 && (
                <View style={{ padding: 10, backgroundColor: '#3b82f610', borderRadius: 8, borderWidth: 1, borderColor: '#3b82f630' }}>
                  <Text style={{ fontSize: typography.caption, fontWeight: fontWeights.semibold, color: '#3b82f6', marginBottom: 4 }}>📊 Simulação DCA</Text>
                  {Array.from({ length: parseInt(dcaMaxBuys) || 3 }).map((_, i) => {
                    const dcaAmt = parseFloat(dcaBuyAmountUsd) || 0
                    const dcaTrig = parseFloat(dcaTriggerPercent) || 5
                    const dcaPrice = bp * Math.pow(1 - dcaTrig / 100, i + 1)
                    const totalInvested = ia + dcaAmt * (i + 1)
                    const totalQty = ia / bp + Array.from({ length: i + 1 }).reduce<number>((sum, _, j) => sum + dcaAmt / (bp * Math.pow(1 - dcaTrig / 100, j + 1)), 0)
                    const avgPrice = totalInvested / (totalQty as number)
                    return (
                      <Text key={i} style={{ fontSize: typography.tiny, color: colors.textSecondary, marginTop: 2 }}>
                        DCA #{i + 1}: a ${dcaPrice.toFixed(2)} → médio ${avgPrice.toFixed(2)} (total: ${totalInvested.toFixed(0)})
                      </Text>
                    )
                  })}
                </View>
              )}
            </View>
          )}
        </View>

        <View style={[styles.fieldCard, { borderColor: buyDipEnabled ? '#05966940' : colors.border + '40', backgroundColor: buyDipEnabled ? '#05966908' : colors.background }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: buyDipEnabled ? 12 : 0 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.fieldLabel, { color: colors.text, marginBottom: 2 }]}>🛒 Auto Buy Dip</Text>
              <Text style={{ fontSize: typography.tiny, color: colors.textSecondary }}>
                Compra automaticamente quando o preço cair X% do preço base
              </Text>
            </View>
            <Switch
              value={buyDipEnabled}
              onValueChange={setBuyDipEnabled}
              trackColor={{ false: colors.border, true: '#05966960' }}
              thumbColor={buyDipEnabled ? '#059669' : '#f4f3f4'}
            />
          </View>
          {buyDipEnabled && (
            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ fontSize: typography.bodySmall, color: colors.textSecondary, marginBottom: 4 }}>Queda para comprar (%)</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="5.0"
                  placeholderTextColor={colors.textSecondary}
                  value={buyDipPercent}
                  onChangeText={(v) => setBuyDipPercent(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                />
                <Text style={{ fontSize: typography.tiny, color: colors.textSecondary, marginTop: 4 }}>
                  Compra quando o preço cair este % do preço base
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: typography.bodySmall, color: colors.textSecondary, marginBottom: 4 }}>Valor por compra (USD)</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="50.00"
                  placeholderTextColor={colors.textSecondary}
                  value={buyDipAmountUsd}
                  onChangeText={(v) => setBuyDipAmountUsd(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                />
              </View>
              <View>
                <Text style={{ fontSize: typography.bodySmall, color: colors.textSecondary, marginBottom: 4 }}>Máx. de compras</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="3"
                  placeholderTextColor={colors.textSecondary}
                  value={buyDipMaxBuys}
                  onChangeText={(v) => setBuyDipMaxBuys(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
              </View>
              {bp > 0 && (
                <View style={{ padding: 10, backgroundColor: '#05966910', borderRadius: 8, borderWidth: 1, borderColor: '#05966930' }}>
                  <Text style={{ fontSize: typography.caption, fontWeight: fontWeights.semibold, color: '#059669', marginBottom: 4 }}>🛒 Simulação Buy Dip</Text>
                  {Array.from({ length: parseInt(buyDipMaxBuys) || 3 }).map((_, i) => {
                    const dipPct = parseFloat(buyDipPercent) || 5
                    const dipPrice = bp * (1 - (dipPct * (i + 1)) / 100)
                    const dipAmt = parseFloat(buyDipAmountUsd) || 50
                    return (
                      <Text key={i} style={{ fontSize: typography.tiny, color: colors.textSecondary, marginTop: 2 }}>
                        Buy #{i + 1}: a ${dipPrice.toFixed(4)} (−{(dipPct * (i + 1)).toFixed(1)}%) → ${dipAmt.toFixed(0)}
                      </Text>
                    )
                  })}
                  <Text style={{ fontSize: typography.tiny, color: '#059669', marginTop: 4, fontWeight: fontWeights.semibold }}>
                    Total máx: ${((parseFloat(buyDipAmountUsd) || 50) * (parseInt(buyDipMaxBuys) || 3)).toFixed(0)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>📊 Taxa / Fee (%)</Text>
          <TextInput
            style={[styles.fieldInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            placeholder="0.1"
            placeholderTextColor={colors.textSecondary}
            value={feePercent}
            onChangeText={(v) => setFeePercent(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={[styles.fieldCard, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '08' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: gradualSell ? 16 : 0 }}>
            <Text style={[styles.fieldLabel, { color: colors.text, marginBottom: 0 }]}>📦 Venda Gradual</Text>
            <Switch
              value={gradualSell}
              onValueChange={setGradualSell}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={gradualSell ? colors.primary : '#f4f3f4'}
            />
          </View>
          {gradualSell && (
            <View style={{ gap: 12 }}>
              <Text style={{ fontSize: typography.caption, color: colors.textSecondary }}>
                4 lotes de 25% cada, com timer entre vendas
              </Text>
              <View>
                <Text style={{ fontSize: typography.bodySmall, color: colors.textSecondary, marginBottom: 4 }}>Gradual Take (%)</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="2.0"
                  placeholderTextColor={colors.textSecondary}
                  value={gradualTakePercent}
                  onChangeText={(v) => setGradualTakePercent(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                />
                <Text style={{ fontSize: typography.tiny, color: colors.textSecondary, marginTop: 4 }}>
                  Step de preco entre cada lote gradual
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: typography.bodySmall, color: colors.textSecondary, marginBottom: 4 }}>Timer entre lotes (min)</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="15"
                  placeholderTextColor={colors.textSecondary}
                  value={timerGradualMin}
                  onChangeText={(v) => setTimerGradualMin(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>⏱️ Tempo de Execucao (min)</Text>
          <TextInput
            style={[styles.fieldInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            placeholder="120"
            placeholderTextColor={colors.textSecondary}
            value={timeExecutionMin}
            onChangeText={(v) => setTimeExecutionMin(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />
          <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
            Estrategia expira apos {timeExecutionMin || '120'} min ({((parseInt(timeExecutionMin) || 120) / 60).toFixed(1)}h)
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: `${colors.primary}10`, borderColor: colors.primary + '30' }]}>
          <Text style={{ fontSize: typography.bodySmall, fontWeight: fontWeights.semibold, color: colors.primary, marginBottom: 8 }}>📋 Resumo</Text>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: typography.caption, color: colors.text }}>
              {token.includes('/') ? token.split('/')[0] : token} — {getSelectedExchangeName()}
            </Text>
            <Text style={{ fontSize: typography.caption, color: colors.text }}>
              Preço de Compra: {bp > 0 ? `$${bp.toFixed(4)}` : '🔄 Auto (buscar da exchange)'}
            </Text>
            {ia > 0 && (
              <Text style={{ fontSize: typography.caption, color: '#f59e0b' }}>
                💵 Investido: ${ia.toFixed(2)} {bp > 0 ? `(~${(ia / bp).toFixed(4)} moedas)` : ''} — Double-check ativo
              </Text>
            )}
            <Text style={{ fontSize: typography.caption, color: '#10b981' }}>
              Trigger (TP): {triggerPrice > 0 ? `$${triggerPrice.toFixed(4)}` : '—'} (+{tp}% + {fee}% fee)
            </Text>
            <Text style={{ fontSize: typography.caption, color: '#ef4444' }}>
              Stop Loss: {stopLossEnabled ? (stopLossPrice > 0 ? `$${stopLossPrice.toFixed(4)} (-${sl}%)` : `(-${sl}%)`) : '🚫 Desativado'}
            </Text>
            {dcaEnabled && (
              <Text style={{ fontSize: typography.caption, color: '#3b82f6' }}>
                📉 DCA: ${dcaBuyAmountUsd || '0'}/compra, queda {dcaTriggerPercent}%, máx {dcaMaxBuys}x
              </Text>
            )}
            <Text style={{ fontSize: typography.caption, color: colors.text }}>
              Gradual: {gradualSell ? `4 lotes, timer ${timerGradualMin}min, step ${gradualTakePercent}%` : 'OFF'}
            </Text>
            <Text style={{ fontSize: typography.caption, color: colors.text }}>
              Expiracao: {timeExecutionMin}min ({((parseInt(timeExecutionMin) || 120) / 60).toFixed(1)}h)
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>{t("strategy.newStrategy")}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={[styles.closeIcon, { color: colors.text }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {!(step >= 2 && keyboardVisible) && renderStepIndicator()}

            {step === 1 ? (
              <ScrollView style={styles.content} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, flexGrow: 1 }}>
                {renderStep1()}
              </ScrollView>
            ) : step === 2 ? (
              renderStep2()
            ) : (
              renderStep3()
            )}

            {!(step >= 2 && keyboardVisible) && (
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
                      styles.button, styles.buttonPrimary, { backgroundColor: colors.primary },
                      (step === 1 && !canProceedToStep2) || (step === 2 && !canProceedToStep3) ? { opacity: 0.5 } : {},
                    ]}
                    onPress={() => setStep((prev) => (prev + 1) as 1 | 2 | 3)}
                    disabled={(step === 1 && !canProceedToStep2) || (step === 2 && !canProceedToStep3)}
                  >
                    <Text style={styles.buttonTextPrimary}>{t("common.next")}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.button, styles.buttonPrimary, { backgroundColor: colors.primary },
                      !canCreate || loading ? { opacity: 0.5 } : {},
                    ]}
                    onPress={handleCreateStrategy}
                    disabled={!canCreate || loading}
                  >
                    {loading ? <ActivityIndicator size="small" /> : (
                      <Text style={styles.buttonTextPrimary}>{t('strategy.createNew')}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: 'center', alignItems: 'center' },
  safeArea: { flex: 1 },
  modalContainer: { borderRadius: 20, width: '90%', maxHeight: '85%', height: '85%', overflow: 'hidden' },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  title: { fontSize: typography.h2, fontWeight: fontWeights.medium },
  closeButton: { padding: 4 },
  closeIcon: { fontSize: typography.h1, fontWeight: fontWeights.light },
  stepsContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 20, paddingHorizontal: 20 },
  stepItem: { alignItems: "center" },
  stepCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  stepNumber: { fontSize: typography.body, fontWeight: fontWeights.medium },
  stepLabel: { fontSize: typography.tiny, fontWeight: fontWeights.light },
  stepLine: { width: 50, height: 2, marginHorizontal: 10, marginBottom: 22 },
  content: { flex: 1 },
  stepContent: { paddingBottom: 20 },
  stepTitle: { fontSize: typography.h3, fontWeight: fontWeights.medium, marginBottom: 8 },
  stepDescription: { fontSize: typography.body, fontWeight: fontWeights.light, marginBottom: 24 },
  loadingContainer: { paddingVertical: 40, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 6 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1 },
  searchInputWrapper: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 14, height: 50, paddingHorizontal: 14, gap: 10 },
  fieldGroup: { marginBottom: 20 },
  fieldCard: { marginBottom: 20, borderWidth: 1, borderRadius: 14, padding: 16 },
  fieldLabel: { fontSize: typography.bodyLarge, fontWeight: fontWeights.semibold, marginBottom: 8 },
  fieldInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: typography.icon, fontWeight: fontWeights.semibold },
  fieldHint: { fontSize: typography.caption, marginTop: 6, fontStyle: 'italic' },
  summaryCard: { padding: 14, borderRadius: 12, borderWidth: 0.5, marginTop: 8 },
  footer: { flexDirection: "row", gap: 12, padding: 20, borderTopWidth: 1 },
  button: { flex: 1, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", minHeight: 48 },
  buttonSecondary: { borderWidth: 1 },
  buttonPrimary: {},
  buttonText: { fontSize: typography.body, fontWeight: fontWeights.regular },
  buttonTextPrimary: { color: "#1a1a1a", fontSize: typography.body, fontWeight: fontWeights.medium },
})
