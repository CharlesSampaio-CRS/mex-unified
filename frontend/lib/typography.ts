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
  // TÍTULOS (Headings)
  // ========================================
  h1: 28,      // Título principal de página (otimizado mobile)
  h2: 24,      // Título de seção grande
  h3: 20,      // Título de seção média
  h4: 18,      // Subtítulo/Card title
  
  // ========================================
  // CORPO DE TEXTO (Body)
  // ========================================
  body: 16,         // Texto principal padrão
  bodyLarge: 17,    // Texto destacado/importante
  bodySmall: 15,    // Texto secundário
  
  // ========================================
  // TEXTOS PEQUENOS (Small text)
  // ========================================
  caption: 14,  // Labels, descrições, helper text
  tiny: 13,     // Metadados, timestamps, contadores
  micro: 12,    // Badges, tags, variações de preço
  
  // ========================================
  // VALORES NUMÉRICOS (Display)
  // ========================================
  displayLarge: 48,   // Valor principal do portfolio
  display: 32,        // Valores grandes (gráficos)
  displaySmall: 24,   // Valores médios
  
  // ========================================
  // BOTÕES (Buttons)
  // ========================================
  button: 16,       // Botão primário/principal
  buttonSmall: 14,  // Botão secundário/pequeno
  
  // ========================================
  // FORMULÁRIOS (Forms)
  // ========================================
  input: 16,        // Texto de input
  label: 14,        // Labels de formulário
  placeholder: 16,  // Placeholder text
  errorText: 13,    // Mensagens de erro
  
  // ========================================
  // ÍCONES E EMOJIS (Icons)
  // ========================================
  iconSmall: 16,    // Ícones pequenos
  icon: 20,         // Ícones médios
  iconLarge: 24,    // Ícones grandes
  emoji: 32,        // Emojis decorativos
  emojiLarge: 48,   // Emojis de destaque
  emojiHuge: 64,    // Emojis de empty state
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
