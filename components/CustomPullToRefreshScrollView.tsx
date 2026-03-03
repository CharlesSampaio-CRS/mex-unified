import React, { useEffect, useRef } from 'react';
import { Animated, RefreshControl, ScrollView, View } from 'react-native';
import { AnimatedLogoIcon } from './AnimatedLogoIcon';

/**
 * CustomPullToRefreshScrollView
 *
 * Usa o RefreshControl nativo (transparente) para detectar o gesto de pull,
 * e exibe o AnimatedLogoIcon como overlay enquanto refreshing=true.
 */
export function CustomPullToRefreshScrollView({
  refreshing,
  onRefresh,
  children,
  contentContainerStyle,
  style,
  ...rest
}: any) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    if (refreshing) {
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
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -60,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [refreshing]);

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
          height: 64,
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={['transparent']}
            progressBackgroundColor="transparent"
          />
        }
        {...rest}
      >
        {children}
      </ScrollView>
    </View>
  );
}
