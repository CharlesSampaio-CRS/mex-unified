import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, NativeScrollEvent, NativeSyntheticEvent, ScrollView, View } from 'react-native';
import { AnimatedLogoIcon } from './AnimatedLogoIcon';

const PULL_THRESHOLD = 80; // pixels que o usuário precisa puxar para disparar refresh
const INDICATOR_HEIGHT = 64;

/**
 * CustomPullToRefreshScrollView
 *
 * Implementa pull-to-refresh 100% customizado sem RefreshControl nativo.
 * Detecta o gesto de pull via onScroll + overscroll negativo e exibe
 * o AnimatedLogoIcon como indicador visual.
 */
export function CustomPullToRefreshScrollView({
  refreshing,
  onRefresh,
  children,
  contentContainerStyle,
  style,
  onScroll: externalOnScroll,
  ...rest
}: any) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-INDICATOR_HEIGHT)).current;
  const isRefreshingRef = useRef(false);
  const canTriggerRef = useRef(true);

  // Atualiza ref quando refreshing muda externamente
  useEffect(() => {
    isRefreshingRef.current = refreshing;
    if (refreshing) {
      // Mostra o indicador
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 8,
        }),
      ]).start();
    } else {
      // Esconde o indicador
      canTriggerRef.current = true;
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -INDICATOR_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [refreshing]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    const y = contentOffset.y;

    // Quando o usuário está puxando para baixo (overscroll negativo)
    if (y < 0 && !isRefreshingRef.current) {
      const pull = Math.abs(y);
      const progress = Math.min(pull / PULL_THRESHOLD, 1);

      // Atualiza visibilidade baseada no progresso do pull
      opacity.setValue(progress);
      translateY.setValue(-INDICATOR_HEIGHT + (INDICATOR_HEIGHT * progress));

      // Dispara refresh quando atinge o threshold
      if (pull >= PULL_THRESHOLD && canTriggerRef.current) {
        canTriggerRef.current = false;
        onRefresh?.();
      }
    }

    // Chama onScroll externo se existir
    externalOnScroll?.(event);
  }, [onRefresh, externalOnScroll]);

  return (
    <View style={[{ flex: 1 }, style]}>
      {/* Overlay do AnimatedLogoIcon */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: INDICATOR_HEIGHT,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          opacity,
          transform: [{ translateY }],
        }}
      >
        <AnimatedLogoIcon size={36} />
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={contentContainerStyle}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        {...rest}
      >
        {children}
      </ScrollView>
    </View>
  );
}
