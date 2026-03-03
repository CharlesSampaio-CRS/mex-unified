import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from "react-native"
import { memo } from "react"
import { Ionicons } from "@expo/vector-icons"
import { typography, fontWeights } from "../lib/typography"
import { useTheme } from "../contexts/ThemeContext"
import { useLanguage } from "../contexts/LanguageContext"

// Grid de ícones disponíveis - todos agora são de navegação
const AVAILABLE_ICONS = [
  { id: 'star', name: 'Star', icon: 'star', screen: 'Star' },
  { id: 'heart', name: 'Heart', icon: 'heart', screen: 'Heart' },
  { id: 'fire', name: 'Fire', icon: 'fire', screen: 'Fire' },
  { id: 'lightning', name: 'Lightning', icon: 'lightning', screen: 'Lightning' },
  { id: 'rocket', name: 'Rocket', icon: 'rocket', screen: 'Rocket' },
  { id: 'trophy', name: 'Trophy', icon: 'trophy', screen: 'Trophy' },
  { id: 'shield', name: 'Shield', icon: 'shield', screen: 'Shield' },
  { id: 'crown', name: 'Crown', icon: 'crown', screen: 'Crown' },
  { id: 'diamond', name: 'Diamond', icon: 'diamond', screen: 'Diamond' },
  { id: 'target', name: 'Target', icon: 'target', screen: 'Target' },
  { id: 'flag', name: 'Flag', icon: 'flag', screen: 'Flag' },
  { id: 'chart', name: 'Analytics', icon: 'chart', screen: 'Analytics' },
  { id: 'robot', name: 'Strategies', icon: 'robot', screen: 'StrategyTemplates' },
  { id: 'bell', name: 'Alerts', icon: 'bell', screen: 'Favoritos' },
  { id: 'settings', name: 'Settings', icon: 'settings', screen: 'Settings' },
]

// Icon components usando Ionicons (fonte única)
const StarIcon = ({ color }: { color: string }) => (
  <Ionicons name="star-outline" size={24} color={color} />
)

const HeartIcon = ({ color }: { color: string }) => (
  <Ionicons name="heart-outline" size={24} color={color} />
)

const FireIcon = ({ color }: { color: string }) => (
  <Ionicons name="flame-outline" size={24} color={color} />
)

const LightningIcon = ({ color }: { color: string }) => (
  <Ionicons name="flash-outline" size={24} color={color} />
)

const RocketIcon = ({ color }: { color: string }) => (
  <Ionicons name="rocket-outline" size={24} color={color} />
)

const TrophyIcon = ({ color }: { color: string }) => (
  <Ionicons name="trophy-outline" size={24} color={color} />
)

const ShieldIcon = ({ color }: { color: string }) => (
  <Ionicons name="shield-outline" size={24} color={color} />
)

const CrownIcon = ({ color }: { color: string }) => (
  <Ionicons name="ribbon-outline" size={24} color={color} />
)

const DiamondIcon = ({ color }: { color: string }) => (
  <Ionicons name="diamond-outline" size={24} color={color} />
)

const TargetIcon = ({ color }: { color: string }) => (
  <Ionicons name="locate-outline" size={24} color={color} />
)

const FlagIcon = ({ color }: { color: string }) => (
  <Ionicons name="flag-outline" size={24} color={color} />
)

const ChartIcon = ({ color }: { color: string }) => (
  <Ionicons name="analytics-outline" size={24} color={color} />
)

const BellIcon = ({ color }: { color: string }) => (
  <Ionicons name="notifications-outline" size={24} color={color} />
)

const SettingsIcon = ({ color }: { color: string }) => (
  <Ionicons name="settings-outline" size={24} color={color} />
)

const RobotIcon = ({ color }: { color: string }) => (
  <Ionicons name="hardware-chip-outline" size={24} color={color} />
)

const iconComponents: Record<string, React.FC<{ color: string }>> = {
  star: StarIcon,
  heart: HeartIcon,
  fire: FireIcon,
  lightning: LightningIcon,
  rocket: RocketIcon,
  trophy: TrophyIcon,
  shield: ShieldIcon,
  crown: CrownIcon,
  diamond: DiamondIcon,
  target: TargetIcon,
  flag: FlagIcon,
  chart: ChartIcon,
  robot: RobotIcon,
  bell: BellIcon,
  settings: SettingsIcon,
}

interface IconSelectorModalProps {
  visible: boolean
  onClose: () => void
  onNavigate?: (screenName: string) => void
  selectedIconId?: string
}

export const IconSelectorModal = memo(function IconSelectorModal({
  visible,
  onClose,
  onNavigate,
  selectedIconId,
}: IconSelectorModalProps) {
  const { colors } = useTheme()
  const { t } = useLanguage()

  const handleIconPress = (item: typeof AVAILABLE_ICONS[0]) => {
    // Navega para a tela correspondente
    if (onNavigate && item.screen) {
      onNavigate(item.screen)
      onClose()
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('iconSelector.title')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeButton, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Grid de ícones */}
          <ScrollView style={styles.modalContent}>
            <View style={styles.iconsGrid}>
              {AVAILABLE_ICONS.map((item) => {
                const IconComponent = iconComponents[item.icon]
                const isSelected = selectedIconId === item.id

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.iconItem,
                      {
                        backgroundColor: isSelected ? colors.primary + '20' : colors.background,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => handleIconPress(item)}
                  >
                    <IconComponent color={isSelected ? colors.primary : colors.text} />
                    <Text style={[styles.iconName, { color: colors.textSecondary }]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 24,
    fontWeight: '300',
  },
  modalContent: {
    padding: 20,
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  iconItem: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  iconName: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
})
