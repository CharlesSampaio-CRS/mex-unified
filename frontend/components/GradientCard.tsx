import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { ReactNode } from 'react';

interface GradientCardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Card com gradiente sutil para modo dark/light
 * Usado em toda a aplicação para manter consistência visual
 */
export function GradientCard({ children, style }: GradientCardProps) {
  const { colors, isDark } = useTheme();

  // Gradiente sutil - tons neutros com melhor nitidez
  const gradientColors: readonly [string, string, ...string[]] = isDark 
    ? ['rgba(39, 39, 42, 1)', 'rgba(63, 63, 70, 1)', 'rgba(39, 39, 42, 1)']  // Dark mode - Zinc 800-700 (opacidade total)
    : ['rgba(250, 250, 249, 1)', 'rgba(247, 246, 244, 1)', 'rgba(250, 250, 249, 1)']  // Light mode - bege suave

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { borderColor: colors.border }, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
});
