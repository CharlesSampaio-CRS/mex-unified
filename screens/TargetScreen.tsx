import { View, Text, StyleSheet } from "react-native"
import { memo } from "react"
import { useHeader } from "../contexts/HeaderContext"
import { useTheme } from "../contexts/ThemeContext"
import { typography, fontWeights } from "../lib/typography"
import { CustomPullToRefreshScrollView } from "../components/CustomPullToRefreshScrollView"

export const TargetScreen = memo(function TargetScreen({ navigation }: any) {
  const { colors } = useTheme()

  useHeader({ title: "Target", subtitle: "Recurso Target" })

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <CustomPullToRefreshScrollView
        refreshing={false}
        onRefresh={() => {}}
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>🎯 Target Feature</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Esta é uma tela de exemplo para o ícone Target. Aqui você pode adicionar funcionalidades relacionadas a metas, objetivos de investimento ou price targets.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.subtitle, { color: colors.text }]}>Possíveis Funcionalidades:</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Price targets</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Investment goals</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Target tracking</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Goal achievements</Text>
        </View>
      </CustomPullToRefreshScrollView>
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
