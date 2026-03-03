import React, { useCallback, useEffect, useRef, useState } from 'react';
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
 *
 * Enquanto `refreshing=true`, o scroll fica travado no topo com o indicador
 * visível e o conteúdo empurrado para baixo — só volta ao normal quando
 * refreshing=false.
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
  const contentPadding = useRef(new Animated.Value(0)).current;
  const isRefreshingRef = useRef(false);
  const canTriggerRef = useRef(true);
  const scrollRef = useRef<ScrollView>(null);
  const [scrollLocked, setScrollLocked] = useState(false);

  // Quando refreshing muda externamente
  useEffect(() => {
    const wasRefreshing = isRefreshingRef.current;
    isRefreshingRef.current = refreshing;

    if (refreshing && !wasRefreshing) {
      // ── INÍCIO DO REFRESH ──
      // Trava o scroll imediatamente para impedir o bounce-back
      setScrollLocked(true);

      // Força scroll ao topo
      scrollRef.current?.scrollTo({ y: 0, animated: false });

      // Garante que o indicador está 100% visível e conteúdo empurrado
      // Usa stop() para cancelar qualquer animação anterior em andamento
      opacity.stopAnimation();
      translateY.stopAnimation();
      contentPadding.stopAnimation();

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: false,
          tension: 80,
          friction: 8,
        }),
        Animated.spring(contentPadding, {
          toValue: INDICATOR_HEIGHT,
          useNativeDriver: false,
          tension: 80,
          friction: 8,
        }),
      ]).start();
    } else if (!refreshing && wasRefreshing) {
      // ── FIM DO REFRESH ──
      // Esconde o indicador e volta o conteúdo ao normal
      opacity.stopAnimation();
      translateY.stopAnimation();
      contentPadding.stopAnimation();

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(translateY, {
          toValue: -INDICATOR_HEIGHT,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(contentPadding, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
      ]).start(() => {
        // Só libera o scroll e permite novo trigger DEPOIS da animação de saída
        setScrollLocked(false);
        canTriggerRef.current = true;
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      });
    }
  }, [refreshing]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    const y = contentOffset.y;

    // Só processa pull-to-refresh se NÃO está em refresh ativo
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
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={contentContainerStyle}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        scrollEnabled={!scrollLocked}
        bounces={!scrollLocked}
        {...rest}
      >
        {/* Padding animado que empurra o conteúdo para baixo durante refresh */}
        <Animated.View style={{ height: contentPadding }} />
        {children}
      </ScrollView>
    </View>
  );
}
