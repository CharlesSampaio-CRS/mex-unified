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
  Switch,
ActivityIndicator } from "react-native"
import { useTheme } from "@/contexts/ThemeContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { useBackendStrategies, Strategy, UpdateStrategyRequest } from "@/hooks/useBackendStrategies"
import { typography, fontWeights } from "@/lib/typography"

interface EditStrategyModalProps {
  visible: boolean
  strategy: Strategy | null
  onClose: () => void
  onSuccess: (strategy: Strategy) => void
}

export function EditStrategyModal({ visible, strategy, onClose, onSuccess }: EditStrategyModalProps) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { updateStrategy } = useBackendStrategies(false)
  const [loading, setLoading] = useState(false)

  // ── Form State ──
  const [name, setName] = useState("")
  const [basePrice, setBasePrice] = useState("")
  const [investedAmount, setInvestedAmount] = useState("")
  const [takeProfitPercent, setTakeProfitPercent] = useState("")
  const [stopLossEnabled, setStopLossEnabled] = useState(true)
  const [stopLossPercent, setStopLossPercent] = useState("")
  const [gradualTakePercent, setGradualTakePercent] = useState("")
  const [feePercent, setFeePercent] = useState("")
  const [gradualSell, setGradualSell] = useState(false)
  const [timerGradualMin, setTimerGradualMin] = useState("")
  const [timeExecutionMin, setTimeExecutionMin] = useState("")

  // ── Populate form when strategy changes ──
  useEffect(() => {
    if (visible && strategy) {
      const cfg = strategy.config
      setName(strategy.name || "")
      setBasePrice(cfg.base_price > 0 ? cfg.base_price.toString() : "")
      setInvestedAmount((cfg as any).invested_amount > 0 ? (cfg as any).invested_amount.toString() : "")
      setTakeProfitPercent(cfg.take_profit_percent.toString())
      setStopLossEnabled((cfg as any).stop_loss_enabled !== false)
      setStopLossPercent(cfg.stop_loss_percent.toString())
      setGradualTakePercent(cfg.gradual_take_percent.toString())
      setFeePercent(cfg.fee_percent.toString())
      setGradualSell(cfg.gradual_sell || false)
      setTimerGradualMin(cfg.timer_gradual_min.toString())
      setTimeExecutionMin(cfg.time_execution_min.toString())
    }
  }, [visible, strategy])

  const bp = parseFloat(basePrice) || 0
  const ia = parseFloat(investedAmount) || 0
  const tp = parseFloat(takeProfitPercent) || 0
  const sl = parseFloat(stopLossPercent) || 0
  const fee = parseFloat(feePercent) || 0
  const triggerPrice = bp > 0 ? bp * (1 + tp / 100 + fee / 100) : 0
  const stopLossPrice = bp > 0 ? bp * (1 - sl / 100) : 0

  const canSave = name.trim().length > 0 && tp > 0 && (stopLossEnabled ? sl > 0 : true)

  const handleSave = async () => {
    if (!strategy || !canSave) return

    try {
      setLoading(true)

      const data: UpdateStrategyRequest = {
        name: name.trim(),
        config: {
          base_price: bp,
          invested_amount: ia > 0 ? ia : 0,
          take_profit_percent: tp,
          stop_loss_enabled: stopLossEnabled,
          stop_loss_percent: stopLossEnabled ? sl : (strategy.config.stop_loss_percent || 5.0),
          gradual_take_percent: parseFloat(gradualTakePercent) || 2.0,
          fee_percent: fee,
          gradual_sell: gradualSell,
          timer_gradual_min: parseInt(timerGradualMin) || 15,
          time_execution_min: parseInt(timeExecutionMin) || 120,
        },
      }

      const updated = await updateStrategy(strategy.id, data)
      setLoading(false)

      Alert.alert("✅ Sucesso", `Estratégia "${name.trim()}" atualizada com sucesso.`)

      onSuccess(updated)
      onClose()
    } catch (error: any) {
      setLoading(false)
      Alert.alert(t("common.error"), error.message || "Erro ao atualizar estratégia")
    }
  }

  if (!strategy) return null

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>✏️ Editar Estratégia</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={[styles.closeIcon, { color: colors.text }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Strategy Info (read-only) */}
              <View style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: typography.body, color: colors.textSecondary }}>🪙 {strategy.symbol}</Text>
                  <Text style={{ fontSize: typography.body, color: colors.textSecondary }}>
                    {strategy.exchange_name || strategy.exchange_id}
                  </Text>
                </View>
              </View>

              {/* Name */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>📝 Nome</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: colors.primary, color: colors.text, backgroundColor: colors.background }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Nome da estratégia"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Base Price */}
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
              </View>

              {/* Invested Amount */}
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
                {ia > 0 && bp > 0 && (
                  <View style={{ marginTop: 6, padding: 8, backgroundColor: '#f59e0b10', borderRadius: 6, borderWidth: 1, borderColor: '#f59e0b30' }}>
                    <Text style={{ fontSize: typography.caption, color: '#f59e0b', fontWeight: fontWeights.semibold }}>
                      🔒 Double-check ativo: ~{(ia / bp).toFixed(4)} moedas
                    </Text>
                  </View>
                )}
              </View>

              {/* Take Profit */}
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

              {/* Stop Loss */}
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

              {/* Fee */}
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

              {/* Gradual Sell */}
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

              {/* Execution Time */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>⏱️ Tempo de Execução (min)</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="120"
                  placeholderTextColor={colors.textSecondary}
                  value={timeExecutionMin}
                  onChangeText={(v) => setTimeExecutionMin(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
                <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
                  Estratégia expira após {timeExecutionMin || '120'} min ({((parseInt(timeExecutionMin) || 120) / 60).toFixed(1)}h)
                </Text>
              </View>

              {/* Summary */}
              <View style={[styles.summaryCard, { backgroundColor: `${colors.primary}10`, borderColor: colors.primary + '30' }]}>
                <Text style={{ fontSize: typography.bodySmall, fontWeight: fontWeights.semibold, color: colors.primary, marginBottom: 8 }}>📋 Resumo das Alterações</Text>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: typography.caption, color: colors.text }}>
                    {strategy.symbol} — {strategy.exchange_name}
                  </Text>
                  <Text style={{ fontSize: typography.caption, color: colors.text }}>
                    Preço de Compra: {bp > 0 ? `$${bp.toFixed(4)}` : '🔄 Auto'}
                  </Text>
                  {ia > 0 && (
                    <Text style={{ fontSize: typography.caption, color: '#f59e0b' }}>
                      💵 Investido: ${ia.toFixed(2)} — Double-check ativo
                    </Text>
                  )}
                  <Text style={{ fontSize: typography.caption, color: '#10b981' }}>
                    Trigger (TP): {triggerPrice > 0 ? `$${triggerPrice.toFixed(4)}` : '—'} (+{tp}% + {fee}% fee)
                  </Text>
                  <Text style={{ fontSize: typography.caption, color: '#ef4444' }}>
                    Stop Loss: {stopLossEnabled ? (stopLossPrice > 0 ? `$${stopLossPrice.toFixed(4)} (-${sl}%)` : `(-${sl}%)`) : '🚫 Desativado'}
                  </Text>
                  <Text style={{ fontSize: typography.caption, color: colors.text }}>
                    Gradual: {gradualSell ? `timer ${timerGradualMin}min, step ${gradualTakePercent}%` : 'OFF'}
                  </Text>
                  <Text style={{ fontSize: typography.caption, color: colors.text }}>
                    Expiração: {timeExecutionMin}min ({((parseInt(timeExecutionMin) || 120) / 60).toFixed(1)}h)
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary, { borderColor: colors.border }]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button, styles.buttonPrimary, { backgroundColor: colors.primary },
                  !canSave || loading ? { opacity: 0.5 } : {},
                ]}
                onPress={handleSave}
                disabled={!canSave || loading}
              >
                {loading ? <ActivityIndicator size="small" /> : (
                  <Text style={styles.buttonTextPrimary}>💾 Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  safeArea: { width: "100%", alignItems: "center", justifyContent: "center", flex: 1 },
  modalContainer: { borderRadius: 20, width: "90%", maxHeight: "85%", height: "85%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  title: { fontSize: typography.h2, fontWeight: fontWeights.medium },
  closeButton: { padding: 4 },
  closeIcon: { fontSize: typography.h1, fontWeight: fontWeights.light },
  content: { flex: 1 },
  infoCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
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
