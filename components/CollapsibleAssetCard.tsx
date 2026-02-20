import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';

interface CollapsibleAssetCardProps {
  // Dados principais (sempre visíveis)
  symbol: string;
  value: string;
  variation?: number;
  isFavorite: boolean;
  isStablecoin?: boolean;
  
  // Renderização personalizada
  renderCompactContent?: () => React.ReactNode;
  renderExpandedContent?: () => React.ReactNode;
  renderActions?: () => React.ReactNode;
  
  // Callbacks
  onToggleFavorite?: () => void;
  onPress?: () => void;
}

export const CollapsibleAssetCard: React.FC<CollapsibleAssetCardProps> = ({
  symbol,
  value,
  variation,
  isFavorite,
  isStablecoin = false,
  renderCompactContent,
  renderExpandedContent,
  renderActions,
  onToggleFavorite,
  onPress,
}) => {
  const { colors, isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const gradientColors: readonly [string, string, ...string[]] = isDark 
    ? ['rgba(26, 26, 26, 0.95)', 'rgba(38, 38, 38, 0.95)', 'rgba(26, 26, 26, 0.95)']
    : ['rgba(250, 250, 249, 1)', 'rgba(247, 246, 244, 1)', 'rgba(250, 250, 249, 1)'];

  const handleCardPress = () => {
    if (onPress) {
      onPress();
    } else {
      setExpanded(!expanded);
    }
  };

  return (
    <TouchableOpacity 
      activeOpacity={0.8}
      onPress={handleCardPress}
      style={styles.container}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.card,
          { borderColor: colors.border }
        ]}
      >
        {/* COMPACT VIEW - Sempre visível */}
        <View style={styles.compactView}>
          {/* Left: Symbol + Favorite */}
          <View style={styles.leftSection}>
            <View style={styles.symbolRow}>
              <Text style={[styles.symbol, { color: colors.text }]}>
                {symbol}
              </Text>
              {onToggleFavorite && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                  }}
                  style={styles.favoriteButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={isFavorite ? "star" : "star-outline"}
                    size={14}
                    color={isFavorite ? "#fbbf24" : colors.textSecondary}
                    style={{ opacity: isFavorite ? 1 : 0.4 }}
                  />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Custom compact content */}
            {renderCompactContent && (
              <View style={styles.compactContent}>
                {renderCompactContent()}
              </View>
            )}
          </View>

          {/* Right: Value + Variation + Expand Icon */}
          <View style={styles.rightSection}>
            <Text style={[styles.value, { color: colors.text }]}>
              {value}
            </Text>
            
            {variation !== undefined && !isStablecoin && (
              <View style={[
                styles.variationBadge,
                { backgroundColor: variation >= 0 ? colors.successLight + '40' : colors.dangerLight + '40' }
              ]}>
                <Text style={[
                  styles.variationText,
                  { color: variation >= 0 ? colors.success : colors.danger }
                ]}>
                  {variation >= 0 ? '▲' : '▼'} {Math.abs(variation).toFixed(2)}%
                </Text>
              </View>
            )}
            
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.textSecondary}
              style={styles.expandIcon}
            />
          </View>
        </View>

        {/* EXPANDED VIEW - Mostra quando expandido */}
        {expanded && (
          <View style={styles.expandedView}>
            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            
            {/* Expanded Content */}
            {renderExpandedContent && (
              <View style={styles.expandedContent}>
                {renderExpandedContent()}
              </View>
            )}
            
            {/* Actions */}
            {renderActions && (
              <View style={styles.actions}>
                {renderActions()}
              </View>
            )}
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  compactView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flex: 1,
    gap: 4,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  symbol: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  favoriteButton: {
    padding: 2,
  },
  compactContent: {
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 12,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
  },
  variationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  variationText: {
    fontSize: 11,
    fontWeight: '600',
  },
  expandIcon: {
    marginTop: 2,
  },
  expandedView: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    marginBottom: 12,
    opacity: 0.3,
  },
  expandedContent: {
    gap: 8,
  },
  actions: {
    marginTop: 12,
  },
});
