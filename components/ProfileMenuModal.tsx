import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { typography, fontWeights } from '@/lib/typography';

interface ProfileMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onAlertsPress: () => void;
  onSettingsPress: () => void;
}

export const ProfileMenuModal: React.FC<ProfileMenuModalProps> = ({
  visible,
  onClose,
  onAlertsPress,
  onSettingsPress,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();

  const handleAlertsPress = () => {
    onAlertsPress();
    onClose();
  };

  const handleSettingsPress = () => {
    onSettingsPress();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.menuContainer}>
          {/* Menu posicionado no canto superior direito */}
          <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* User Info Header */}
            <View style={styles.userInfo}>
              <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>
                  {user?.name?.substring(0, 2).toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                  {user?.name || 'Usuário'}
                </Text>
                <Text style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                  {user?.email || 'email@example.com'}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Menu Items */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleAlertsPress}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>
                  {t('profileMenu.alerts')}
                </Text>
                <Text style={[styles.menuItemDescription, { color: colors.textTertiary }]}>
                  {t('notifications.desc')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleSettingsPress}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="settings-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>
                  {t('profileMenu.settings')}
                </Text>
                <Text style={[styles.menuItemDescription, { color: colors.textTertiary }]}>
                  {t('profileMenu.settingsDesc')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    minWidth: 280,
    maxWidth: 320,
  },
  menu: {
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: typography.icon,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 1,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: typography.body,
    fontWeight: fontWeights.semibold,
    marginBottom: 2,
  },
  menuItemDescription: {
    fontSize: typography.tiny,
    fontWeight: fontWeights.regular,
  },
});
