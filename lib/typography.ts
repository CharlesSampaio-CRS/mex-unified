/**
 * Typography System - CryptoHub
 * 
 * Sistema centralizado de tamanhos de fonte para garantir consistência
 * visual em toda a aplicação.
 * 
 * @see docs/TYPOGRAPHY_STANDARD.md para documentação completa
 */

export const typography = {
  // ========================================
  // TÍTULOS (Headings) — compacto para mobile
  // ========================================
  h1: 22,      // Título principal de página
  h2: 19,      // Título de seção grande
  h3: 17,      // Título de seção média / Header
  h4: 15,      // Subtítulo / Card title
  
  // ========================================
  // CORPO DE TEXTO (Body)
  // ========================================
  body: 14,         // Texto principal padrão
  bodyLarge: 15,    // Texto destacado/importante
  bodySmall: 13,    // Texto secundário
  
  // ========================================
  // TEXTOS PEQUENOS (Small text)
  // ========================================
  caption: 12,  // Labels, descrições, helper text
  tiny: 11,     // Metadados, timestamps, contadores
  micro: 10,    // Badges, tags, variações de preço
  badge: 9,     // Badges compactos, status indicators
  pico: 8,      // Labels ultra-compactos (gráficos, PnL cards)
  
  // ========================================
  // VALORES NUMÉRICOS (Display)
  // ========================================
  displayLarge: 32,   // Valor principal do portfolio
  display: 24,        // Valores grandes (gráficos)
  displaySmall: 20,   // Valores médios
  
  // ========================================
  // BOTÕES (Buttons)
  // ========================================
  button: 14,       // Botão primário/principal
  buttonSmall: 12,  // Botão secundário/pequeno
  
  // ========================================
  // FORMULÁRIOS (Forms)
  // ========================================
  input: 14,        // Texto de input
  label: 12,        // Labels de formulário
  placeholder: 14,  // Placeholder text
  errorText: 11,    // Mensagens de erro
  
  // ========================================
  // ÍCONES E EMOJIS (Icons)
  // ========================================
  iconSmall: 14,    // Ícones pequenos
  icon: 18,         // Ícones médios
  iconLarge: 22,    // Ícones grandes
  emoji: 28,        // Emojis decorativos
  emojiLarge: 40,   // Emojis de destaque
  emojiHuge: 52,    // Emojis de empty state
} as const

/**
 * Font weights padronizados
 * Use strings para compatibilidade cross-platform
 */
export const fontWeights = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const

/**
 * Letter spacing para casos específicos
 */
export const letterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
} as const

/**
 * Line heights recomendados
 */
export const lineHeights = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
  loose: 1.8,
} as const

// Export type para TypeScript
export type Typography = typeof typography
export type FontWeight = typeof fontWeights[keyof typeof fontWeights]
export type LetterSpacing = typeof letterSpacing[keyof typeof letterSpacing]
export type LineHeight = typeof lineHeights[keyof typeof lineHeights]
