import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native"
import { memo, useState, useCallback } from "react"
import { useHeader } from "../contexts/HeaderContext"
import { useTheme } from "../contexts/ThemeContext"
import { useLanguage } from "../contexts/LanguageContext"
import { typography, fontWeights } from "../lib/typography"
import { apiService } from "../services/api"
import { useFocusEffect } from "@react-navigation/native"

/** Tipo de um template vindo da API */
interface TemplateConfig {
  label: string
  value: string
  detail?: string
}
interface TemplateRisk {
  label: string
  color: string
}
interface StrategyTemplateItem {
  id: string
  user_id: string
  name: string
  icon: string
  strategy_type: string
  risk: TemplateRisk
  summary: string
  configs: TemplateConfig[]
  how_it_works: string[]
  is_default: boolean
  created_at: number
  updated_at: number
}

/** Opções de risco para o formulário */
const RISK_OPTIONS: TemplateRisk[] = [
  { label: "Baixo", color: "#10b981" },
  { label: "Médio", color: "#f59e0b" },
  { label: "Alto", color: "#ef4444" },
]

const ICON_OPTIONS = ["📊", "🛡️", "🚀", "⚡", "🎯", "💎", "🔥", "📈", "🤖", "🧠"]

export const StrategyTemplatesScreen = memo(function StrategyTemplatesScreen({ navigation }: any) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<StrategyTemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // ── Fetch templates da API ──
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiService.listStrategyTemplates()
      // this.get() retorna { data: { success, templates } }
      const body = res?.data ?? res
      if (body?.success && body.templates) {
        setTemplates(body.templates)
      }
    } catch (e) {
      console.warn("❌ Erro ao carregar templates:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Recarrega ao focar na tela
  useFocusEffect(useCallback(() => { fetchTemplates() }, [fetchTemplates]))

  const toggle = (id: string) => setExpandedId(prev => (prev === id ? null : id))

  const handleDelete = (tpl: StrategyTemplateItem) => {
    if (tpl.is_default) {
      Alert.alert("Ação não permitida", "Templates padrão não podem ser excluídos.")
      return
    }
    Alert.alert(
      "Excluir template",
      `Deseja excluir "${tpl.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir", style: "destructive",
          onPress: async () => {
            try {
              await apiService.deleteStrategyTemplate(tpl.id)
              fetchTemplates()
            } catch (e) {
              Alert.alert("Erro", "Não foi possível excluir o template.")
            }
          },
        },
      ]
    )
  }

  // Define o Header global para esta tela
  useHeader({
    title: t("strategy.templates"),
    subtitle: t("strategy.templatesSubtitle"),
  })

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" />
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTemplates} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >

          {/* ── Lista de templates da API ── */}
          {templates.map((tpl) => {
            const isOpen = expandedId === tpl.id
            const isCustom = !tpl.is_default
            return (
              <TouchableOpacity
                key={tpl.id}
                activeOpacity={0.8}
                onPress={() => toggle(tpl.id)}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isOpen && { borderColor: colors.primary, borderWidth: 1.5 },
                ]}
              >
                {/* ── Header do card ── */}
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>{tpl.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.cardName, { color: colors.text }]}>{tpl.name}</Text>
                      {isCustom && (
                        <View style={[styles.customBadge, { backgroundColor: `${colors.primary}20` }]}>
                          <Text style={[styles.customBadgeText, { color: colors.primary }]}>Custom</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.cardType, { color: colors.textSecondary }]}>{tpl.strategy_type}</Text>
                  </View>
                  <View style={[styles.riskBadge, { backgroundColor: `${tpl.risk.color}15` }]}>
                    <View style={[styles.riskDot, { backgroundColor: tpl.risk.color }]} />
                    <Text style={[styles.riskLabel, { color: tpl.risk.color }]}>{tpl.risk.label}</Text>
                  </View>
                  <Text style={{ fontSize: typography.h4, color: colors.textSecondary, marginLeft: 6 }}>
                    {isOpen ? "▲" : "▼"}
                  </Text>
                </View>

                {/* ── Conteúdo expandido ── */}
                {isOpen && (
                  <View style={[styles.cardBody, { borderTopColor: colors.border }]}>
                    {/* Resumo */}
                    <Text style={[styles.summary, { color: colors.textSecondary }]}>{tpl.summary}</Text>

                    {/* Configurações */}
                    <View style={[styles.configsBox, { backgroundColor: `${colors.primary}06`, borderColor: colors.border }]}>
                      <Text style={[styles.configsTitle, { color: colors.primary }]}>
                        ⚙️ {t("strategy.configs")}
                      </Text>
                      {tpl.configs.map((cfg, i) => (
                        <View key={i}>
                          <View style={styles.configRow}>
                            <Text style={[styles.cfgLabel, { color: colors.textSecondary }]}>{cfg.label}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
                              <Text style={[styles.cfgValue, { color: colors.text }]}>{cfg.value}</Text>
                              {cfg.detail && (
                                <Text style={[styles.cfgDetail, { color: colors.textSecondary }]} numberOfLines={1}>
                                  {cfg.detail}
                                </Text>
                              )}
                            </View>
                          </View>
                          {i < tpl.configs.length - 1 && (
                            <View style={{ height: 0.5, backgroundColor: colors.border, opacity: 0.4 }} />
                          )}
                        </View>
                      ))}
                    </View>

                    {/* Como funciona */}
                    <View style={[styles.howBox, { backgroundColor: `${colors.textSecondary}08`, borderColor: colors.border }]}>
                      <Text style={[styles.howTitle, { color: colors.text }]}>📖 Como funciona</Text>
                      {tpl.how_it_works.map((step, i) => (
                        <Text key={i} style={[styles.howStep, { color: colors.textSecondary }]}>{step}</Text>
                      ))}
                    </View>

                    {/* Botões de ação */}
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity
                        style={[styles.createBtn, { backgroundColor: colors.primary, flex: 1 }]}
                        onPress={() => navigation?.navigate("Strategy", { openCreate: true, template: tpl.id })}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.createBtnText}>🚀 Usar template</Text>
                      </TouchableOpacity>
                      {isCustom && (
                        <TouchableOpacity
                          style={[styles.createBtn, { backgroundColor: "#ef4444", paddingHorizontal: 16 }]}
                          onPress={() => handleDelete(tpl)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.createBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}

          {/* ── Botão: Criar Novo Template ── */}
          <TouchableOpacity
            style={[styles.newCard, { borderColor: colors.primary }]}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: typography.emoji }}>➕</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.newTitle, { color: colors.primary }]}>Criar Novo Template</Text>
              <Text style={[styles.newSub, { color: colors.textSecondary }]}>
                Configure seu próprio template personalizado
              </Text>
            </View>
            <Text style={{ fontSize: typography.displaySmall, color: colors.primary }}>→</Text>
          </TouchableOpacity>

        </ScrollView>
      )}

      {/* ── Modal Criar Template ── */}
      <CreateTemplateModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => { setShowCreateModal(false); fetchTemplates() }}
        colors={colors}
      />
    </View>
  )
})

// ═══════════════════════════════════════════════
// Modal para criar novo template customizado
// ═══════════════════════════════════════════════
function CreateTemplateModal({ visible, onClose, onSuccess, colors }: {
  visible: boolean; onClose: () => void; onSuccess: () => void; colors: any
}) {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("📊")
  const [strategyType, setStrategyType] = useState("")
  const [riskIdx, setRiskIdx] = useState(1) // Médio
  const [summary, setSummary] = useState("")
  const [howText, setHowText] = useState("") // 1 step por linha
  const [saving, setSaving] = useState(false)

  // Campos de configuração individuais
  const [priceBase, setPriceBase] = useState("")
  const [takeProfit, setTakeProfit] = useState("")
  const [stopLoss, setStopLoss] = useState("")
  const [sellCascade, setSellCascade] = useState("")

  const reset = () => {
    setName(""); setIcon("📊"); setStrategyType(""); setRiskIdx(1)
    setSummary(""); setHowText("")
    setPriceBase(""); setTakeProfit(""); setStopLoss(""); setSellCascade("")
  }

  const handleSave = async () => {
    if (!name.trim() || !strategyType.trim()) {
      Alert.alert("Campos obrigatórios", "Preencha nome e tipo de estratégia.")
      return
    }

    // Monta configs a partir dos campos individuais
    const configs: { label: string; value: string; detail?: string }[] = []
    if (priceBase.trim()) {
      configs.push({ label: "Price Base", value: `${priceBase.trim()} USDT`, detail: "Preço de referência" })
    }
    if (takeProfit.trim()) {
      configs.push({ label: "Take Profit", value: `${takeProfit.trim()}%`, detail: "Percentual de lucro alvo" })
    }
    if (stopLoss.trim()) {
      configs.push({ label: "Stop Loss", value: `${stopLoss.trim()}%`, detail: "Perda máxima permitida" })
    }
    if (sellCascade.trim()) {
      configs.push({ label: "Sell Cascade", value: `${sellCascade.trim()}%`, detail: "Venda em níveis progressivos" })
    }

    const howSteps = howText.split("\n").filter(l => l.trim())

    try {
      setSaving(true)
      const res = await apiService.createStrategyTemplate({
        name: name.trim(),
        icon,
        strategy_type: strategyType.trim(),
        risk: RISK_OPTIONS[riskIdx],
        summary: summary.trim(),
        configs,
        how_it_works: howSteps,
      })
      const body = res?.data ?? res
      if (body?.success) {
        reset()
        onSuccess()
      } else {
        Alert.alert("Erro", "Não foi possível criar o template.")
      }
    } catch (e) {
      Alert.alert("Erro", "Falha ao salvar template.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>✨ Novo Template</Text>
                <TouchableOpacity onPress={onClose}>
                  <Text style={{ fontSize: typography.h1, color: colors.textSecondary }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Ícone */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Ícone</Text>
              <View style={styles.iconRow}>
                {ICON_OPTIONS.map(ic => (
                  <TouchableOpacity
                    key={ic}
                    style={[styles.iconOption, icon === ic && { borderColor: colors.primary, borderWidth: 2 }]}
                    onPress={() => setIcon(ic)}
                  >
                    <Text style={{ fontSize: typography.h1 }}>{ic}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Nome */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nome *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={name} onChangeText={setName}
                placeholder="Ex: DCA Semanal" placeholderTextColor={colors.textSecondary}
              />

              {/* Tipo */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tipo de Estratégia *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={strategyType} onChangeText={setStrategyType}
                placeholder="Ex: Grid Trading, DCA, Scalping" placeholderTextColor={colors.textSecondary}
              />

              {/* Risco */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nível de Risco</Text>
              <View style={styles.riskRow}>
                {RISK_OPTIONS.map((r, i) => (
                  <TouchableOpacity
                    key={r.label}
                    style={[
                      styles.riskOption,
                      { borderColor: r.color },
                      riskIdx === i && { backgroundColor: `${r.color}20`, borderWidth: 2 },
                    ]}
                    onPress={() => setRiskIdx(i)}
                  >
                    <View style={[styles.riskDot, { backgroundColor: r.color }]} />
                    <Text style={[styles.riskOptText, { color: r.color }]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Resumo */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Resumo</Text>
              <TextInput
                style={[styles.input, styles.multiline, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={summary} onChangeText={setSummary}
                placeholder="Breve descrição da estratégia..." placeholderTextColor={colors.textSecondary}
                multiline numberOfLines={3}
              />

              {/* ── Configurações (inputs separados) ── */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 18 }]}>⚙️ Configurações</Text>

              {/* Price Base */}
              <Text style={[styles.cfgInputLabel, { color: colors.text }]}>💰 Price Base (USDT)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={priceBase} onChangeText={setPriceBase}
                placeholder="Ex: 95000.00" placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />

              {/* Take Profit */}
              <Text style={[styles.cfgInputLabel, { color: colors.text }]}>🎯 Take Profit (%)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={takeProfit} onChangeText={setTakeProfit}
                placeholder="Ex: 5.0" placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />

              {/* Stop Loss */}
              <Text style={[styles.cfgInputLabel, { color: colors.text }]}>🛑 Stop Loss (%)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={stopLoss} onChangeText={setStopLoss}
                placeholder="Ex: 2.0" placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />

              {/* Sell Cascade */}
              <Text style={[styles.cfgInputLabel, { color: colors.text }]}>📉 Sell Cascade (%)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={sellCascade} onChangeText={setSellCascade}
                placeholder="Ex: 1.5 (opcional)" placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />

              {/* Como funciona */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 18 }]}>Como Funciona</Text>
              <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
                Um passo por linha
              </Text>
              <TextInput
                style={[styles.input, styles.multiline, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={howText} onChangeText={setHowText}
                placeholder={"1. Compra no preço atual\n2. Vende quando sobe 5%"}
                placeholderTextColor={colors.textSecondary}
                multiline numberOfLines={5}
              />

              {/* Botão Salvar */}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.7}
              >
                {saving ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>💾 Salvar Template</Text>
                )}
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Card
  card: {
    borderRadius: 16,
    borderWidth: 0.5,
    marginBottom: 14,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  cardIcon: { fontSize: typography.emoji },
  cardName: {
    fontSize: typography.h4,
    fontWeight: fontWeights.medium,
  },
  cardType: {
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
    marginTop: 2,
  },

  // Custom badge
  customBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  customBadgeText: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },

  // Risk badge
  riskBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  riskDot: { width: 7, height: 7, borderRadius: 4 },
  riskLabel: {
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
  },

  // Card body
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 0.5,
  },
  summary: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.light,
    lineHeight: 22,
    marginTop: 14,
    marginBottom: 14,
  },

  // Configs box
  configsBox: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 14,
    marginBottom: 14,
  },
  configsTitle: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  configRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  cfgLabel: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.light,
  },
  cfgValue: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  cfgDetail: {
    fontSize: typography.micro,
    fontWeight: fontWeights.light,
    maxWidth: 140,
  },

  // How it works
  howBox: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 14,
    marginBottom: 14,
  },
  howTitle: {
    fontSize: typography.caption,
    fontWeight: fontWeights.medium,
    marginBottom: 10,
  },
  howStep: {
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
    lineHeight: 20,
    marginBottom: 4,
  },

  // Create button
  createBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  createBtnText: {
    color: "#FFFFFF",
    fontSize: typography.body,
    fontWeight: fontWeights.medium,
  },

  // New template card
  newCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed" as any,
    marginBottom: 14,
  },
  newTitle: {
    fontSize: typography.h4,
    fontWeight: fontWeights.medium,
  },
  newSub: {
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
    marginTop: 2,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeights.semibold,
  },
  fieldLabel: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
    marginBottom: 6,
    marginTop: 14,
  },
  fieldHint: {
    fontSize: typography.micro,
    fontWeight: fontWeights.light,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.body,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  iconRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 6,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  riskRow: {
    flexDirection: "row",
    gap: 10,
  },
  riskOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  riskOptText: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.medium,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
  },

  // Config inputs label
  cfgInputLabel: {
    fontSize: typography.bodySmall,
    fontWeight: fontWeights.semibold,
    marginTop: 12,
    marginBottom: 6,
  },
})
