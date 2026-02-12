import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from "react-native"
import { useTheme } from "../contexts/ThemeContext"
import { typography, fontWeights } from "../lib/typography"

interface ErrorModalProps {
  visible: boolean
  onClose: () => void
  title?: string
  message: string
  buttonText?: string
  type?: 'error' | 'warning' | 'info'
}

export function ErrorModal({ 
  visible, 
  onClose, 
  title,
  message,
  buttonText = "Entendi",
  type = 'error'
}: ErrorModalProps) {
  const { colors } = useTheme()

  const getTypeConfig = () => {
    switch (type) {
      case 'error':
        return {
          icon: '❌',
          color: '#ef4444',
          defaultTitle: 'Erro'
        }
      case 'warning':
        return {
          icon: '⚠️',
          color: '#f59e0b',
          defaultTitle: 'Atenção'
        }
      case 'info':
        return {
          icon: 'ℹ️',
          color: '#3b82f6',
          defaultTitle: 'Informação'
        }
      default:
        return {
          icon: '❌',
          color: '#ef4444',
          defaultTitle: 'Erro'
        }
    }
  }

  const config = getTypeConfig()
  const displayTitle = title || config.defaultTitle

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.safeArea} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{config.icon}</Text>
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>{displayTitle}</Text>

            {/* Message */}
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

            {/* Button */}
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: config.color }]} 
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>
                {buttonText}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: typography.h4,
    fontWeight: fontWeights.semibold,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: typography.button,
    fontWeight: fontWeights.semibold,
    color: '#ffffff',
  },
})
