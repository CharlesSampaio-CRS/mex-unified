import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from "react-native"
import { useEffect, useRef, memo } from "react"
import Svg, { Path, Circle } from "react-native-svg"
import { typography, fontWeights } from "../lib/typography"
import { useTheme } from "../contexts/ThemeContext"
import { useLanguage } from "../contexts/LanguageContext"
import { usePrivacy } from "../contexts/PrivacyContext"
import { useAuth } from "../contexts/AuthContext"
import { LogoIcon } from "./LogoIcon"

// Eye Icon (valores visíveis)
const EyeIcon = ({ color }: { color: string }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5C7 5 2.73 8.11 1 12.5 2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
  </Svg>
)

// Eye Off Icon (valores ocultos)
const EyeOffIcon = ({ color }: { color: string }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 3l18 18M10.5 10.677a2.5 2.5 0 0 0 3.323 3.323"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M7.362 7.561C5.68 8.74 4.279 10.42 3 12.5c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.85M12 5c.87 0 1.71.09 2.52.26M19.82 15.13C21.16 13.73 22.27 12.23 23 12.5c-.73-1.84-1.84-3.34-3.18-4.37"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
)

// Bell Icon (notificações)
const BellIcon = ({ color }: { color: string }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
)

// Search Icon (lupa para pesquisa)
const SearchIcon = ({ color }: { color: string }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <Circle 
      cx="11" 
      cy="11" 
      r="8" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <Path
      d="m21 21-4.35-4.35"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
)

interface HeaderProps {
  hideIcons?: boolean
  onNotificationsPress?: () => void
  onProfilePress?: () => void
  // onSearchPress removido - busca agora está dentro da lista de tokens
  unreadCount?: number
  title?: string
  subtitle?: string
}

// User Icon (perfil)
const UserIcon = ({ color }: { color: string }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth="2" />
  </Svg>
)

export const Header = memo(function Header({ 
  hideIcons = false, 
  onNotificationsPress, 
  onProfilePress,
  // onSearchPress removido - busca agora está dentro da lista de tokens
  unreadCount = 0,
  title,
  subtitle
}: HeaderProps) {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const { valuesHidden, toggleValuesVisibility } = usePrivacy()
  const { user } = useAuth()
  const iconOpacity = useRef(new Animated.Value(1)).current
  const iconScale = useRef(new Animated.Value(1)).current
  
  // Gera as iniciais do usuário para o avatar
  const getUserInitials = () => {
    if (!user?.name) return 'U'
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(iconOpacity, {
        toValue: hideIcons ? 0 : 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(iconScale, {
        toValue: hideIcons ? 0.8 : 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [hideIcons])
  
  return (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <View style={styles.headerContent}>
        <LogoIcon size={24} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>
            {title || 'MeX'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle || t('home.subtitle')}
          </Text>
        </View>
      </View>

      <Animated.View 
        style={[
          styles.actions,
          {
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          }
        ]}
        pointerEvents={hideIcons ? "none" : "auto"}
      >
        <TouchableOpacity 
          style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={toggleValuesVisibility}
        >
          {valuesHidden ? (
            <EyeOffIcon color={colors.text} />
          ) : (
            <EyeIcon color={colors.text} />
          )}
        </TouchableOpacity>
        
        {/* Botão de busca removido - agora está dentro da lista de tokens */}
        
        <TouchableOpacity 
          style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={onNotificationsPress}
        >
          <BellIcon color={colors.text} />
          {(unreadCount ?? 0) > 0 && (
            <View style={[styles.badge, { backgroundColor: '#ef4444' }]}>
              <Text style={styles.badgeText}>
                {unreadCount! > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        
        {/* User Avatar - Primeiro à direita */}
        <TouchableOpacity 
          style={[styles.userAvatar, { backgroundColor: colors.primary, borderColor: colors.border }]}
          onPress={onProfilePress}
          activeOpacity={0.7}
        >
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{getUserInitials()}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
})

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,      // Reduzido para mobile
    paddingVertical: 16,        // Reduzido
    paddingBottom: 12,          // Reduzido
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,                    // Reduzido
  },
  headerText: {
    flexDirection: "column",
  },
  title: {
    fontSize: typography.h3,
    fontWeight: fontWeights.light,
    letterSpacing: -0.2,
    opacity: 0.95,
  },
  subtitle: {
    fontSize: typography.caption,
    marginTop: 2,
    fontWeight: fontWeights.light,
    opacity: 0.6,
  },
  actions: {
    flexDirection: "row",
    gap: 6,                     // Reduzido para mobile
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: typography.caption,
    fontWeight: fontWeights.semibold,
  },
  iconButton: {
    width: 32,                  // Reduzido para mobile
    height: 32,                 // Reduzido
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 0,
    position: "relative",
    opacity: 0.9,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: typography.micro,
    fontWeight: fontWeights.medium,
    textAlign: "center",
    includeFontPadding: false,
  },
})
