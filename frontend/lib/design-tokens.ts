/**
 * Design Tokens - Sistema de design avançado para um app moderno e fluido
 * Inspirado em princípios de Material Design 3 e iOS Human Interface Guidelines
 */

/**
 * Espaçamento com escala harmônica (baseado em múltiplos de 4)
 * Otimizado para telas mobile (iPhone 14 - 390px width)
 */
export const spacing = {
  // Atomic spacing
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  
  // Screen padding - reduzido para mobile
  screenHorizontal: 16,
  screenTop: 12,
  screenBottom: 100,
  
  // Component spacing - otimizado
  cardPadding: 14,
  cardPaddingLarge: 16,
  cardGap: 12,
  sectionGap: 20,
  itemGap: 10,
  
  // Header
  headerPaddingH: 16,
  headerPaddingV: 16,
  
  // Title section (para compatibilidade com código legado)
  titleSectionPaddingH: 16,
  titleSectionPaddingTop: 8,
  titleSectionPaddingBottom: 12,
} as const

/**
 * Border Radius - arredondamentos modernos
 */
export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const

/**
 * Tamanhos de componentes
 */
export const sizes = {
  // Buttons
  buttonSmall: 36,
  buttonMedium: 44,
  buttonLarge: 52,
  buttonXLarge: 60,
  
  // Icons
  iconXSmall: 16,
  iconSmall: 20,
  iconMedium: 24,
  iconLarge: 32,
  iconXLarge: 40,
  iconXXLarge: 48,
  
  // Avatar
  avatarSmall: 32,
  avatarMedium: 40,
  avatarLarge: 56,
  avatarXLarge: 80,
  avatarXXLarge: 120,
  
  // Input
  inputHeight: 48,
  inputHeightSmall: 40,
  inputHeightLarge: 56,
} as const

/**
 * Borders
 */
export const borders = {
  none: 0,
  thin: 0.5,
  normal: 1,
  thick: 2,
  heavy: 3,
} as const

/**
 * Sombras com níveis de elevação
 */
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  // Elevação 1 - cards em repouso
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  // Elevação 2 - cards com leve interação
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  // Elevação 3 - cards em destaque
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  // Elevação 4 - modais e popups
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  // Sombra colorida para ações primárias
  primary: {
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
} as const

/**
 * Animações - durações e curvas
 */
export const animations = {
  // Durações
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 400,
    slower: 600,
  },
  // Curvas de easing
  easing: {
    linear: 'linear',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const

/**
 * Opacidades
 */
export const opacity = {
  disabled: 0.38,
  secondary: 0.6,
  hint: 0.38,
  divider: 0.12,
  overlay: 0.5,
  overlayDark: 0.7,
} as const

/**
 * Common Styles - Estilos pré-definidos para componentes
 */
export const commonStyles = {
  // Screen
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
  
  // Cards - com diferentes níveis de destaque
  cardFlat: {
    borderRadius: borderRadius.lg,
    padding: spacing.cardPadding,
    borderWidth: borders.thin,
  },
  
  cardElevated: {
    borderRadius: borderRadius.lg,
    padding: spacing.cardPadding,
    ...shadows.sm,
  },
  
  cardHighlight: {
    borderRadius: borderRadius.xl,
    padding: spacing.cardPaddingLarge,
    ...shadows.md,
  },
  
  cardPremium: {
    borderRadius: borderRadius.xxl,
    padding: spacing.cardPaddingLarge,
    ...shadows.lg,
  },
  
  // Buttons
  buttonPrimary: {
    height: sizes.buttonMedium,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...shadows.primary,
  },
  
  buttonSecondary: {
    height: sizes.buttonMedium,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: borders.normal,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  
  buttonGhost: {
    height: sizes.buttonMedium,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  
  // Inputs
  input: {
    height: sizes.inputHeight,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: borders.normal,
  },
  
  // Icon containers
  iconContainer: {
    width: sizes.iconLarge,
    height: sizes.iconLarge,
    borderRadius: borderRadius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  
  iconContainerLarge: {
    width: sizes.iconXLarge,
    height: sizes.iconXLarge,
    borderRadius: borderRadius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  
  // Dividers
  divider: {
    height: borders.thin,
    opacity: opacity.divider,
  },
  
  dividerVertical: {
    width: borders.thin,
    opacity: opacity.divider,
  },
} as const

/**
 * Layout presets para telas específicas
 */
export const layouts = {
  // Lista de items com separação uniforme
  list: {
    gap: spacing.itemGap,
  },
  
  // Grid de 2 colunas
  grid2: {
    gap: spacing.cardGap,
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
  },
  
  // Stack vertical com espaçamento
  stack: {
    gap: spacing.md,
  },
  
  // Stack horizontal
  stackHorizontal: {
    flexDirection: 'row' as const,
    gap: spacing.md,
  },
  
  // Centro absoluto
  center: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
} as const

/**
 * Gradientes - cores para uso com LinearGradient
 * Gradientes modernos inspirados em apps premium
 */
export const gradients = {
  // Gradiente primário - azul vibrante
  primary: {
    colors: ['#3b82f6', '#2563eb'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Gradiente secundário - roxo/azul
  secondary: {
    colors: ['#8b5cf6', '#6366f1'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Gradiente de sucesso - verde
  success: {
    colors: ['#10b981', '#059669'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Gradiente de erro - vermelho
  error: {
    colors: ['#ef4444', '#dc2626'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Gradiente de aviso - amarelo/laranja
  warning: {
    colors: ['#f59e0b', '#ea580c'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Gradiente escuro - preto/cinza
  dark: {
    colors: ['#18181b', '#27272a'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Gradiente claro - branco/cinza claro
  light: {
    colors: ['#f9fafb', '#f3f4f6'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Gradiente sutil para backgrounds
  subtleLight: {
    colors: ['#ffffff', '#f8fafc'] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  
  subtleDark: {
    colors: ['#1e293b', '#0f172a'] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
} as const
