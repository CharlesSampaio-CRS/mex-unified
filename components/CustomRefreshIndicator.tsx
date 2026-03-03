import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AnimatedLogoIcon } from '../components/AnimatedLogoIcon';

export const CustomRefreshIndicator = () => (
  <View style={styles.container}>
    <AnimatedLogoIcon size={32} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
});
