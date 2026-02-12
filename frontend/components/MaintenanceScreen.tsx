import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Svg, { Path, Circle, Rect } from 'react-native-svg'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/contexts/LanguageContext'

interface MaintenanceScreenProps {
  onRetry?: () => void
  message?: string
}

export function MaintenanceScreen({ onRetry, message }: MaintenanceScreenProps) {
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Ícone de Manutenção */}
        <View style={styles.iconContainer}>
          <MaintenanceIcon color={colors.textSecondary} />
        </View>

        {/* Título */}
        <Text style={[styles.title, { color: colors.text }]}>
          {t('maintenance.title')}
        </Text>

        {/* Mensagem */}
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {message || t('maintenance.message')}
        </Text>

        {/* Submensagem */}
        <Text style={[styles.subMessage, { color: colors.textSecondary }]}>
          {t('maintenance.subMessage')}
        </Text>

        {/* Botão Tentar Novamente */}
        {onRetry && (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>
              {t('maintenance.retry')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Informação de contato */}
        <View style={styles.contactContainer}>
          <Text style={[styles.contactText, { color: colors.textSecondary }]}>
            {t('maintenance.contact')}
          </Text>
        </View>
      </View>
    </View>
  )
}

// Ícone de Manutenção (ferramentas)
const MaintenanceIcon = ({ color }: { color: string }) => (
  <Svg width="120" height="120" viewBox="0 0 120 120" fill="none">
    {/* Chave inglesa */}
    <Path
      d="M85 35L75 45L65 35L70 30C72 28 75 28 77 30L85 38C87 40 87 42 85 44V35Z"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.6"
    />
    <Path
      d="M65 35L35 65C33 67 33 70 35 72L48 85C50 87 53 87 55 85L85 55"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    
    {/* Martelo */}
    <Path
      d="M45 25L35 35L25 25C23 23 23 20 25 18L27 16C29 14 32 14 34 16L45 27V25Z"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.6"
    />
    <Rect
      x="30"
      y="30"
      width="8"
      height="45"
      rx="2"
      stroke={color}
      strokeWidth="3"
      transform="rotate(-45 35 35)"
    />
    
    {/* Engrenagem pequena */}
    <Circle
      cx="75"
      cy="75"
      r="12"
      stroke={color}
      strokeWidth="3"
      opacity="0.4"
    />
    <Circle
      cx="75"
      cy="75"
      r="6"
      fill={color}
      opacity="0.4"
    />
    
    {/* Parafusos decorativos */}
    <Circle cx="20" cy="90" r="3" fill={color} opacity="0.3" />
    <Circle cx="95" cy="25" r="3" fill={color} opacity="0.3" />
  </Svg>
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 12,
  },
  subMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 32,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 24,
    minWidth: 180,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  retryButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  contactContainer: {
    marginTop: 16,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    width: '100%',
  },
  contactText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
})
