import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { Animated } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

interface HeaderConfig {
  title?: string
  subtitle?: string
  onNotificationsPress?: () => void
  unreadCount?: number
  hideIcons?: boolean
  selectedIcon?: string
  onIconSelect?: (iconName: string) => void
}

interface HeaderContextType {
  config: HeaderConfig
  setHeaderConfig: (config: HeaderConfig) => void
  titleOpacity: Animated.Value
}

const HeaderContext = createContext<HeaderContextType>({
  config: {},
  setHeaderConfig: () => {},
  titleOpacity: new Animated.Value(1),
})

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<HeaderConfig>({})
  const titleOpacity = useRef(new Animated.Value(1)).current
  const isFirstRender = useRef(true)
  const lastTitleRef = useRef<string | undefined>(undefined)

  const setHeaderConfig = useCallback((newConfig: HeaderConfig) => {
    const titleChanged = newConfig.title !== lastTitleRef.current
    lastTitleRef.current = newConfig.title

    if (isFirstRender.current || !titleChanged) {
      // Primeira renderização ou só subtitle/unreadCount mudou: atualiza sem animação
      isFirstRender.current = false
      setConfigState(newConfig)
      return
    }

    // Título mudou (troca de tela) → fade out rápido → troca → fade in
    Animated.timing(titleOpacity, {
      toValue: 0,
      duration: 80,
      useNativeDriver: true,
    }).start(() => {
      setConfigState(newConfig)
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }).start()
    })
  }, [titleOpacity])

  return (
    <HeaderContext.Provider value={{ config, setHeaderConfig, titleOpacity }}>
      {children}
    </HeaderContext.Provider>
  )
}

/**
 * Hook para as telas definirem o conteúdo do Header.
 * Usa useFocusEffect para que ao voltar a uma tela em cache (Tab Navigator),
 * o header atualize corretamente.
 * Também usa useEffect para mudanças dinâmicas (ex: subtitle com contadores).
 */
export function useHeader(config: HeaderConfig) {
  const { setHeaderConfig } = useContext(HeaderContext)
  const configRef = useRef(config)

  // Mantém ref atualizada
  useEffect(() => {
    configRef.current = config
  })

  // Quando a tela recebe foco → seta o header (importante para Tab Navigator)
  useFocusEffect(
    useCallback(() => {
      setHeaderConfig(configRef.current)
    }, [setHeaderConfig])
  )

  // Quando valores dinâmicos mudam (subtitle, unreadCount) → atualiza sem animação
  useEffect(() => {
    setHeaderConfig(config)
  }, [
    config.title,
    config.subtitle,
    config.unreadCount,
    config.hideIcons,
    config.selectedIcon,
  ])
}

/**
 * Hook interno usado pelo Header global para ler a config atual.
 */
export function useHeaderConfig() {
  return useContext(HeaderContext)
}
