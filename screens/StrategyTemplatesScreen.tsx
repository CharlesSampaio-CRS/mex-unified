import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native"
import { memo, useState } from "react"
import { Header } from "../components/Header"
import { useTheme } from "../contexts/ThemeContext"
import { useLanguage } from "../contexts/LanguageContext"
import { typography, fontWeights } from "../lib/typography"

/**
 * Detalhes completos de cada estratégia padrão
 */
const STRATEGY_TEMPLATES = [
  {
    id: "simple",
    nameKey: "strategy.simple",
    icon: "📊",
    type: "Grid Trading",
    risk: { label: "Médio", color: "#f59e0b" },
    summary: "Cria ordens de compra e venda em intervalos fixos de preço. Ideal para mercados laterais.",
    configs: [
      { label: "Tipo", value: "Grid Trading" },
      { label: "Take Profit", value: "5%", detail: "1 nível — fecha 100% da posição" },
      { label: "Stop Loss", value: "2%", detail: "Fecha posição se cair 2%" },
      { label: "Grid Levels", value: "5", detail: "5 ordens espaçadas" },
      { label: "Espaçamento", value: "0.5%", detail: "Entre cada nível do grid" },
      { label: "Investimento mín.", value: "50 USDT" },
      { label: "Modo", value: "Spot" },
    ],
    howItWorks: [
      "1. Divide o range de preço em 5 níveis (grid)",
      "2. Coloca ordens de compra abaixo do preço atual",
      "3. Coloca ordens de venda acima do preço atual",
      "4. Lucra com as oscilações entre os níveis",
      "5. Stop Loss em 2% protege contra queda forte",
      "6. Take Profit em 5% encerra quando atingir o alvo",
    ],
  },
  {
    id: "conservative",
    nameKey: "strategy.conservative",
    icon: "🛡️",
    type: "DCA (Dollar Cost Averaging)",
    risk: { label: "Baixo", color: "#10b981" },
    summary: "Compra em parcelas para diluir o preço médio. Proteção máxima com 2 TPs + trailing stop.",
    configs: [
      { label: "Tipo", value: "Dollar Cost Averaging" },
      { label: "Take Profit 1", value: "3%", detail: "Vende 50% da posição" },
      { label: "Take Profit 2", value: "6%", detail: "Vende os 50% restantes" },
      { label: "Stop Loss", value: "3%", detail: "Proteção contra queda" },
      { label: "Trailing Stop", value: "1.5%", detail: "Protege lucros em alta" },
      { label: "Intervalo DCA", value: "60 min", detail: "Compra a cada 60 min" },
      { label: "Máx. DCA Orders", value: "3", detail: "Até 3 compras parciais" },
      { label: "Investimento mín.", value: "100 USDT" },
      { label: "Modo", value: "Spot" },
    ],
    howItWorks: [
      "1. Primeira compra no preço atual",
      "2. Se cair, compra mais a cada 60 min (até 3x)",
      "3. Preço médio melhora a cada DCA",
      "4. TP1 em +3%: vende metade, garante lucro",
      "5. TP2 em +6%: vende o resto, lucro máximo",
      "6. Trailing stop 1.5% acompanha o preço em alta",
      "7. Stop loss 3% limita perda se não recuperar",
    ],
  },
  {
    id: "aggressive",
    nameKey: "strategy.aggressive",
    icon: "🚀",
    type: "Trailing Stop + DCA",
    risk: { label: "Alto", color: "#ef4444" },
    summary: "Busca lucro máximo com 3 TPs progressivos, trailing stop agressivo e DCA ativo.",
    configs: [
      { label: "Tipo", value: "Trailing Stop + DCA" },
      { label: "Take Profit 1", value: "5%", detail: "Vende 30% da posição" },
      { label: "Take Profit 2", value: "10%", detail: "Vende 30% da posição" },
      { label: "Take Profit 3", value: "20%", detail: "Vende 40% restantes" },
      { label: "Stop Loss", value: "5%", detail: "Margem maior para volatilidade" },
      { label: "Trailing Stop", value: "2%", detail: "Segue o preço em alta" },
      { label: "DCA Ativo", value: "Sim", detail: "Compra nas quedas" },
      { label: "Intervalo DCA", value: "30 min", detail: "Agressivo, a cada 30 min" },
      { label: "Máx. DCA Orders", value: "5", detail: "Até 5 compras parciais" },
      { label: "Investimento mín.", value: "200 USDT" },
      { label: "Modo", value: "Spot" },
    ],
    howItWorks: [
      "1. Compra inicial no preço atual",
      "2. DCA agressivo: compra a cada 30 min se cair (até 5x)",
      "3. TP1 em +5%: realiza 30%, garante parcial",
      "4. TP2 em +10%: realiza mais 30%",
      "5. TP3 em +20%: fecha 40% restantes — lucro máximo",
      "6. Trailing stop 2% sobe junto com o preço",
      "7. Stop loss 5% — margem ampla para swing",
      "⚠️ Recomendado para traders experientes",
    ],
  },
]

export const StrategyTemplatesScreen = memo(function StrategyTemplatesScreen({ navigation }: any) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggle = (id: string) => setExpandedId(prev => (prev === id ? null : id))

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title={t("strategy.templates")} subtitle={t("strategy.templatesSubtitle")} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* ── Lista de templates padrão ── */}
        {STRATEGY_TEMPLATES.map((tpl) => {
          const isOpen = expandedId === tpl.id
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
                  <Text style={[styles.cardName, { color: colors.text }]}>{t(tpl.nameKey)}</Text>
                  <Text style={[styles.cardType, { color: colors.textSecondary }]}>{tpl.type}</Text>
                </View>
                <View style={[styles.riskBadge, { backgroundColor: `${tpl.risk.color}15` }]}>
                  <View style={[styles.riskDot, { backgroundColor: tpl.risk.color }]} />
                  <Text style={[styles.riskLabel, { color: tpl.risk.color }]}>{tpl.risk.label}</Text>
                </View>
                <Text style={{ fontSize: 16, color: colors.textSecondary, marginLeft: 6 }}>
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
                    {tpl.howItWorks.map((step, i) => (
                      <Text key={i} style={[styles.howStep, { color: colors.textSecondary }]}>{step}</Text>
                    ))}
                  </View>

                  {/* Botão: Criar com este template → navega para Strategy e abre o modal */}
                  <TouchableOpacity
                    style={[styles.createBtn, { backgroundColor: colors.primary }]}
                    onPress={() => navigation?.navigate("Strategy", { openCreate: true, template: tpl.id })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.createBtnText}>🚀 Criar com este template</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          )
        })}

        {/* ── Botão: Criar Nova Estratégia ── */}
        <TouchableOpacity
          style={[styles.newCard, { borderColor: colors.primary }]}
          onPress={() => navigation?.navigate("Strategy", { openCreate: true })}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 28 }}>➕</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.newTitle, { color: colors.primary }]}>{t("strategy.createNew")}</Text>
            <Text style={[styles.newSub, { color: colors.textSecondary }]}>
              Escolha um template e configure sua estratégia
            </Text>
          </View>
          <Text style={{ fontSize: 20, color: colors.primary }}>→</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
})

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1, padding: 16 },

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
  cardIcon: { fontSize: 30 },
  cardName: {
    fontSize: typography.h4,
    fontWeight: fontWeights.medium,
  },
  cardType: {
    fontSize: typography.caption,
    fontWeight: fontWeights.light,
    marginTop: 2,
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

  // New strategy card
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
})
