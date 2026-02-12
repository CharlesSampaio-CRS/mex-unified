/**
 * Layout constants for consistent spacing and sizing across the app
 * 
 * NOVA VERSÃO: Usa design-tokens.ts como base + compatibilidade com código existente
 */

import * as tokens from './design-tokens'

// Re-exporta os design tokens principais
export const spacing = tokens.spacing
export const borderRadius = tokens.borderRadius
export const sizes = tokens.sizes
export const borders = tokens.borders
export const shadows = tokens.shadows
export const animations = tokens.animations
export const opacity = tokens.opacity
export const layouts = tokens.layouts
export const gradients = tokens.gradients

/**
 * Common style presets for reusability
 * Migrado para usar os novos design tokens com nomes atualizados
 */
export const commonStyles = {
  // Container base
  screenContainer: {
    flex: 1,
  },
  
  // ScrollView
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    padding: spacing.screenHorizontal,
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.screenBottom,
    gap: spacing.sectionGap,
  },
  
  // Content (para telas sem ScrollView no root)
  content: {
    padding: spacing.screenHorizontal,
    paddingTop: 0,
  },
  
  // Cards - agora usando os novos níveis de elevação
  card: {
    borderRadius: borderRadius.lg,  // medium → lg
    padding: spacing.cardPadding,
    ...shadows.sm,  // subtle → sm
  },
  
  // Buttons - atualizados para novo sistema
  button: {
    paddingHorizontal: spacing.xl,  // buttonPaddingH → xl (20)
    paddingVertical: spacing.sm,    // buttonPaddingV → sm (8)
    minHeight: sizes.buttonSmall,
    borderRadius: borderRadius.sm,  // small → sm
    borderWidth: borders.normal,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  
  // Action button container (botão flutuante no canto)
  actionButtonContainer: {
    paddingHorizontal: spacing.xl,  // actionButtonPaddingH → xl (20)
    paddingBottom: spacing.lg,      // actionButtonPaddingBottom → lg (16)
    alignItems: 'flex-end' as const,
  },
  
  // Logout button container
  logoutButtonContainer: {
    paddingHorizontal: spacing.xl,  // actionButtonPaddingH → xl (20)
    paddingBottom: spacing.lg,      // actionButtonPaddingBottom → lg (16)
    alignItems: 'flex-end' as const,
  },
} as const
