import { View, Text, StyleSheet, SafeAreaView, ScrollView } from "react-native"
import { memo } from "react"
import { Header } from "../components/Header"
import { useTheme } from "../contexts/ThemeContext"
import { typography, fontWeights } from "../lib/typography"

export const ShieldScreen = memo(function ShieldScreen({ navigation }: any) {
  const { colors } = useTheme()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header 
        title="Shield"
        subtitle="Recurso Shield"
      />
      
      <ScrollView style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>🛡️ Shield Feature</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Esta é uma tela de exemplo para o ícone Shield. Aqui você pode adicionar funcionalidades relacionadas a segurança, proteção de investimentos ou gestão de risco.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.subtitle, { color: colors.text }]}>Possíveis Funcionalidades:</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Proteção de capital</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Risk management</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Stop loss automation</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>• Security alerts</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
