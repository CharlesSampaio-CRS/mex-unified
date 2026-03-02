import { View, Text, StyleSheet, ScrollView } from "react-native"
import { memo } from "react"
import { useHeader } from "../contexts/HeaderContext"
import { useTheme } from "../contexts/ThemeContext"
import { typography, fontWeights } from "../lib/typography"

export const TrophyScreen = memo(function TrophyScreen({ navigation }: any) {
  const { colors } = useTheme()

  useHeader({ title: "Trophy", subtitle: "Recurso Trophy" })

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>🏆 Trophy Feature</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Esta é uma tela de exemplo para o ícone Trophy. Aqui você pode adicionar funcionalidades relacionadas a conquistas, rankings ou melhores performances.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.subtitle, { color: colors.text }]}>Possíveis Funcionalidades:</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Top performers</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Achievements</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Leaderboards</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Best strategies</Text>
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
