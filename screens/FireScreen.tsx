import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native"
import { memo, useState, useCallback } from "react"
import { useHeader } from "../contexts/HeaderContext"
import { useTheme } from "../contexts/ThemeContext"
import { typography, fontWeights } from "../lib/typography"
export const FireScreen = memo(function FireScreen({ navigation }: any) {
  const { colors } = useTheme()
  const [refreshing, setRefreshing] = useState(false)

  useHeader({ title: "Fire", subtitle: "Recurso Fire" })

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 1200))
    setRefreshing(false)
  }, [])

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>🔥 Fire Feature</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Esta é uma tela de exemplo para o ícone Fire. Aqui você pode adicionar funcionalidades relacionadas a tendências quentes, tokens em alta ou oportunidades urgentes.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.subtitle, { color: colors.text }]}>Possíveis Funcionalidades:</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Tokens em alta</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Oportunidades hot</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Trending markets</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Alertas de volatilidade</Text>
        </View>
      </ScrollView>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: typography.h3,
    fontWeight: fontWeights.bold,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
    marginBottom: 12,
  },
  description: {
    fontSize: typography.body,
    lineHeight: 24,
  },
  item: {
    fontSize: typography.body,
    lineHeight: 28,
    paddingLeft: 8,
  },
})
