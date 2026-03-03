import React, { useState, useEffect, useRef, useCallback } from 'react'
import { View, StyleSheet, Animated, Easing } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useBalance } from '@/contexts/BalanceContext'
import { typography, fontWeights } from '@/lib/typography'
import { AnimatedLogoIcon } from './AnimatedLogoIcon'

interface LoadingProgressProps {
  onComplete: () => void
}

/**
 * Tela de loading pós-login.
 * Renderizada como tela PRINCIPAL (flex:1, não overlay).
 * Monitora BalanceContext e chama onComplete quando dados prontos.
 */
export function LoadingProgress({ onComplete }: LoadingProgressProps) {
  const { colors, isDark } = useTheme()
  const { t } = useLanguage()
  const { data: balanceData, loading: balanceLoading, error: balanceError } = useBalance()
  const [currentStep, setCurrentStep] = useState(0)
  const hasCompletedRef = useRef(false)
  const mountTimeRef = useRef(Date.now())

  const steps = [
    { key: 'loading.authenticating' },
    { key: 'loading.fetchingExchanges' },
    { key: 'loading.loadingBalances' },
    { key: 'loading.calculatingPortfolio' },
    { key: 'loading.almostReady' },
  ]

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.9)).current
  const textFadeAnim = useRef(new Animated.Value(1)).current
  const textShimmer = useRef(new Animated.Value(0)).current
  const dotsAnimations = useRef(
    steps.map(() => new Animated.Value(0))
  ).current

  // Chama onComplete respeitando tempo mínimo de exibição (1.5s)
  const finishLoading = useCallback(() => {
    if (hasCompletedRef.current) return
    hasCompletedRef.current = true

    const elapsed = Date.now() - mountTimeRef.current
    const MIN_TIME = 1500
    const remaining = Math.max(0, MIN_TIME - elapsed)

    if (remaining > 0) {
      setTimeout(() => onComplete(), remaining)
    } else {
      onComplete()
    }
  }, [onComplete])

  // ── Monitora dados do BalanceContext e avança steps ──
  useEffect(() => {
    const dataReady = !balanceLoading && (balanceData !== null || balanceError !== null)

    if (dataReady) {
      setCurrentStep(4)
      finishLoading()
    } else if (balanceLoading) {
      setCurrentStep(prev => Math.max(prev, 2))
    }
  }, [balanceLoading, balanceData, balanceError, finishLoading])

  // Step 0 → 1 com delay (feedback visual de "autenticando")
  useEffect(() => {
    const timer = setTimeout(() => setCurrentStep(prev => Math.max(prev, 1)), 400)
    return () => clearTimeout(timer)
  }, [])

  // Timeout de segurança: libera após 10s
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasCompletedRef.current) {
        console.warn('⏰ [LoadingProgress] TIMEOUT 10s - forçando onComplete()')
        hasCompletedRef.current = true
        onComplete()
      }
    }, 10000)
    return () => clearTimeout(timeout)
  }, [onComplete])

  // ── Animações visuais ──

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  useEffect(() => {
    Animated.sequence([
      Animated.timing(textFadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start()
  }, [currentStep])

  useEffect(() => {
    Animated.loop(
      Animated.timing(textShimmer, {
        toValue: 1,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start()
  }, [])

  useEffect(() => {
    dotsAnimations.forEach((anim, index) => {
      if (index <= currentStep) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start()
      } else {
        anim.setValue(0)
      }
    })
  }, [currentStep])

  const currentStepText = currentStep < steps.length
    ? t(steps[currentStep].key)
    : t('loading.almostReady')

  const shimmerOpacity = textShimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.7, 1, 0.7],
  })

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#27272a' : '#ffffff',
          opacity: fadeAnim,
        },
      ]}
    >
      <Animated.View
        style={[styles.content, { transform: [{ scale: scaleAnim }] }]}
      >
        <View style={styles.spinnerWrapper}>
          <AnimatedLogoIcon size={50} />
        </View>

        <Animated.Text
          style={[
            styles.stepText,
            {
              color: colors.text,
              opacity: Animated.multiply(textFadeAnim, shimmerOpacity),
            },
          ]}
        >
          {currentStepText}
        </Animated.Text>

        <View style={styles.dotsContainer}>
          {steps.map((_, index) => {
            const dotScale = dotsAnimations[index].interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.3],
            })
            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index <= currentStep ? colors.primary : colors.border,
                    opacity: index <= currentStep ? 1 : 0.3,
                    transform: [{ scale: index === currentStep ? dotScale : 1 }],
                  },
                ]}
              />
            )
          })}
        </View>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  spinnerWrapper: {
    position: 'relative',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: typography.body,
    fontWeight: fontWeights.regular,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})
