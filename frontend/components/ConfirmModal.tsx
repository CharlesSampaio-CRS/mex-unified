import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from "react-native"
import { useTheme } from "../contexts/ThemeContext"
import { typography, fontWeights } from "../lib/typography"

interface ConfirmModalProps {
  visible: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmColor?: string
  icon?: string
}

export function ConfirmModal({ 
  visible, 
  onClose, 
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmColor = "#ef4444",
  icon
}: ConfirmModalProps) {
  const { colors } = useTheme()

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

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
            {icon && (
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>{icon}</Text>
              </View>
            )}

            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

            {/* Message */}
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

            {/* Buttons */}
            <View style={styles.buttonsContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton, { borderColor: colors.border }]} 
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.confirmButton, { backgroundColor: confirmColor }]} 
                onPress={handleConfirm}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmButtonText}>
                  {confirmText}
                </Text>
              </TouchableOpacity>
            </View>
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
    padding: 20,
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
    marginBottom: 12,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: typography.h4,
    fontWeight: fontWeights.semibold,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.body,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1.5,
  },
  cancelButtonText: {
    fontSize: typography.button,
    fontWeight: fontWeights.medium,
  },
  confirmButton: {
    // backgroundColor definido via prop
  },
  confirmButtonText: {
    fontSize: typography.button,
    fontWeight: fontWeights.semibold,
    color: '#ffffff',
  },
})
