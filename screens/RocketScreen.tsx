import { View, Text, StyleSheet } from "react-native"
import { memo } from "react"
import { useHeader } from "../contexts/HeaderContext"
import { useTheme } from "../contexts/ThemeContext"
import { typography, fontWeights } from "../lib/typography"
import { CustomPullToRefreshScrollView } from "../components/CustomPullToRefreshScrollView"

export const RocketScreen = memo(function RocketScreen({ navigation }: any) {
  const { colors } = useTheme()

  useHeader({ title: "Rocket", subtitle: "Recurso Rocket" })

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <CustomPullToRefreshScrollView
        refreshing={false}
        onRefresh={() => {}}
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>🚀 Rocket Feature</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Esta é uma tela de exemplo para o ícone Rocket. Aqui você pode adicionar funcionalidades relacionadas a crescimento, tokens em ascensão ou potencial de valorização.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.subtitle, { color: colors.text }]}>Possíveis Funcionalidades:</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Moedas em crescimento</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• High potential</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Performance tracking</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Launch pad</Text>
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
