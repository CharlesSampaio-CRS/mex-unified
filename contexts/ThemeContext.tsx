import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = '@cryptohub:theme'

interface ThemeColors {
  // Backgrounds
  background: string
  surface: string
  surfaceSecondary: string
  surfaceHover: string  // Para hover states
  
  // Borders
  border: string
  borderLight: string
  
  // Text
  text: string
  textSecondary: string
  textTertiary: string
  textInverse: string  // Texto em fundos escuros (sempre branco)
  
  // Primary Colors
  primary: string
  primaryDark: string
  primaryLight: string
  primaryText: string  // Texto sobre fundo azul
  
  // Semantic Colors
  success: string
  successLight: string
  danger: string
  dangerLight: string
  warning: string
  warningLight: string
  info: string
  infoLight: string
  
  // Component Specific
  card: string
  cardBorder: string
  input: string
  inputBorder: string
  badge: string
  badgeBorder: string
  
  // Toggle/Switch
  toggleInactive: string
  toggleActive: string
  toggleThumb: string
  
  // Tab
  tabInactive: string
  tabActive: string
  tabText: string
  tabTextActive: string
}

interface ThemeContextType {
  theme: Theme
  colors: ThemeColors
  isDark: boolean
  setTheme: (theme: Theme) => void
  isLoading: boolean
}

const lightColors: ThemeColors = {
  // Backgrounds - tons suaves bege/cinza para reduzir brilho
  background: '#f7f6f4',      // Bege muito claro
  surface: '#fafaf9',         // Off-white suave
  surfaceSecondary: '#f5f4f1', // Bege claríssimo
  surfaceHover: '#f0efeb',    // Bege claro hover
  
  // Borders - mais suaves e menos contrastantes
  border: '#e7e5e0',          // Bege/cinza claro
  borderLight: '#f0efeb',     // Bege muito claro
  
  // Text - mantendo boa legibilidade mas menos intenso
  text: '#1f1f1f',            // Preto mais suave
  textSecondary: '#737373',   // Cinza médio
  textTertiary: '#a3a3a3',    // Cinza claro
  textInverse: '#ffffff',
  
  // Primary Colors
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  primaryLight: '#60a5fa',
  primaryText: '#ffffff',
  
  // Semantic Colors
  success: '#10b981',
  successLight: '#d1fae5',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  info: '#3b82f6',
  infoLight: '#dbeafe',
  
  // Component Specific
  card: '#fafaf9',            // Off-white suave
  cardBorder: '#e7e5e0',      // Bege/cinza claro
  input: '#fafaf9',           // Off-white suave
  inputBorder: '#d6d3cc',     // Bege médio
  badge: '#f5f4f1',           // Bege claríssimo
  badgeBorder: '#d6d3cc',     // Bege médio
  
  // Toggle/Switch
  toggleInactive: '#e7e5e0',  // Bege/cinza claro
  toggleActive: '#3b82f6',
  toggleThumb: '#ffffff',
  
  // Tab
  tabInactive: '#f5f4f1',     // Bege claríssimo
  tabActive: '#3b82f6',
  tabText: '#737373',         // Cinza médio
  tabTextActive: '#ffffff',
}

const darkColors: ThemeColors = {
  // Backgrounds - tom intermediário para melhor nitidez
  background: '#27272a',        // Zinc 800 (tom intermediário)
  surface: '#3f3f46',            // Zinc 700
  surfaceSecondary: '#52525b',   // Zinc 600
  surfaceHover: '#52525b',       // Zinc 600
  
  // Borders - melhor visibilidade mantendo sutileza
  border: '#52525b',             // Zinc 600
  borderLight: '#3f3f46',        // Zinc 700
  
  // Text - alta legibilidade em fundo mais claro
  text: '#fafafa',               // Zinc 50 (mantido - excelente contraste)
  textSecondary: '#d4d4d8',      // Zinc 300 (mantido)
  textTertiary: '#a1a1aa',       // Zinc 400 (mantido)
  textInverse: '#ffffff',
  
  // Primary Colors
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  primaryLight: '#60a5fa',
  primaryText: '#ffffff',
  
  // Semantic Colors
  success: '#10b981',
  successLight: '#065f46',
  danger: '#ef4444',
  dangerLight: '#7f1d1d',
  warning: '#f59e0b',
  warningLight: '#78350f',
  info: '#3b82f6',
  infoLight: '#1e3a8a',
  
  // Component Specific
  card: '#3f3f46',               // Zinc 700
  cardBorder: '#52525b',         // Zinc 600
  input: '#52525b',              // Zinc 600
  inputBorder: '#71717a',        // Zinc 500
  badge: '#52525b',              // Zinc 600
  badgeBorder: '#71717a',        // Zinc 500
  
  // Toggle/Switch
  toggleInactive: '#52525b',     // Zinc 600
  toggleActive: '#3b82f6',
  toggleThumb: '#ffffff',
  
  // Tab
  tabInactive: '#52525b',        // Zinc 600
  tabActive: '#3b82f6',
  tabText: '#d4d4d8',            // Zinc 300
  tabTextActive: '#ffffff',
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark') // Default to dark
  const [isLoading, setIsLoading] = useState(true)

  // Load theme from storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY)
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setTheme(savedTheme)
        }
      } catch (error) {
        console.error('Error loading theme:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTheme()
  }, [])

  // Memoize colors to prevent recreation on every render
  const colors = useMemo(() => 
    theme === 'light' ? lightColors : darkColors, 
    [theme]
  )

  // Memoize setTheme to maintain stable reference and save to storage
  const handleSetTheme = useCallback(async (newTheme: Theme) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme)
      setTheme(newTheme)
    } catch (error) {
      console.error('Error saving theme:', error)
      // Still update the state even if storage fails
      setTheme(newTheme)
    }
  }, [])

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    theme,
    colors,
    isDark: theme === 'dark',
    setTheme: handleSetTheme,
    isLoading
  }), [theme, colors, handleSetTheme, isLoading])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
