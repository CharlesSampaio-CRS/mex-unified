import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface PrivacyContextType {
  valuesHidden: boolean
  toggleValuesVisibility: () => void
  hideValue: (value: string | number) => string
  hideZeroBalances: boolean
  toggleHideZeroBalances: () => void
  isLoading: boolean
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined)

export const usePrivacy = () => {
  const context = useContext(PrivacyContext)
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider')
  }
  return context
}

interface PrivacyProviderProps {
  children: ReactNode
}

const PRIVACY_KEY = '@cryptohub:privacy_values_hidden'
const HIDE_ZERO_KEY = '@cryptohub:hide_zero_balances'

export const PrivacyProvider = ({ children }: PrivacyProviderProps) => {
  const [valuesHidden, setValuesHidden] = useState(true)
  const [hideZeroBalances, setHideZeroBalances] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Carregar preferências ao iniciar
  useEffect(() => {
    const loadPrivacyPreference = async () => {
      try {
        const [saved, savedZero] = await Promise.all([
          AsyncStorage.getItem(PRIVACY_KEY),
          AsyncStorage.getItem(HIDE_ZERO_KEY),
        ])
        if (saved !== null) {
          setValuesHidden(JSON.parse(saved))
        } else {
          setValuesHidden(true)
        }
        if (savedZero !== null) {
          setHideZeroBalances(JSON.parse(savedZero))
        }
      } catch (error) {
        console.error('Error loading privacy preference:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPrivacyPreference()
  }, [])

  // Memoize toggleValuesVisibility para manter referência estável
  const toggleValuesVisibility = useCallback(async () => {
    try {
      const newValue = !valuesHidden
      await AsyncStorage.setItem(PRIVACY_KEY, JSON.stringify(newValue))
      setValuesHidden(newValue)
    } catch (error) {
      console.error('Error saving privacy preference:', error)
      setValuesHidden(!valuesHidden)
    }
  }, [valuesHidden])

  const toggleHideZeroBalances = useCallback(async () => {
    try {
      const newValue = !hideZeroBalances
      await AsyncStorage.setItem(HIDE_ZERO_KEY, JSON.stringify(newValue))
      setHideZeroBalances(newValue)
    } catch (error) {
      console.error('Error saving hide zero preference:', error)
      setHideZeroBalances(!hideZeroBalances)
    }
  }, [hideZeroBalances])

  // Memoize hideValue para evitar recriação
  const hideValue = useCallback((value: string | number): string => {
    if (!valuesHidden) {
      return typeof value === 'number' ? value.toFixed(2) : value
    }
    
    // Ocultar valores com asteriscos
    if (typeof value === 'string') {
      // Para valores monetários como "$1,234.56"
      if (value.includes('$') || value.includes('R$')) {
        const prefix = value.match(/^[^\d]*/)?.[0] || ''
        return prefix + '••••••'
      }
      // Para outros strings
      return '••••••'
    }
    
    // Para números
    return '••••••'
  }, [valuesHidden])

  // Memoize context value para prevenir re-renders desnecessários
  const value = useMemo<PrivacyContextType>(() => ({
    valuesHidden,
    toggleValuesVisibility,
    hideValue,
    hideZeroBalances,
    toggleHideZeroBalances,
    isLoading,
  }), [valuesHidden, toggleValuesVisibility, hideValue, hideZeroBalances, toggleHideZeroBalances, isLoading])

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}
