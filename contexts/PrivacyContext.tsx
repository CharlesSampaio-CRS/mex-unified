import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface PrivacyContextType {
  valuesHidden: boolean
  toggleValuesVisibility: () => void
  hideValue: (value: string | number) => string
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

export const PrivacyProvider = ({ children }: PrivacyProviderProps) => {
  const [valuesHidden, setValuesHidden] = useState(true) // Valores sempre ocultos ao iniciar
  const [isLoading, setIsLoading] = useState(true)

  // Carregar preferência ao iniciar
  useEffect(() => {
    const loadPrivacyPreference = async () => {
      try {
        const saved = await AsyncStorage.getItem(PRIVACY_KEY)
        if (saved !== null) {
          setValuesHidden(JSON.parse(saved))
        } else {
          // Se não houver preferência salva, mantém oculto (padrão)
          setValuesHidden(true)
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
      // Ainda atualiza o estado mesmo se falhar ao salvar
      setValuesHidden(!valuesHidden)
    }
  }, [valuesHidden])

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
    isLoading,
  }), [valuesHidden, toggleValuesVisibility, hideValue, isLoading])

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}
