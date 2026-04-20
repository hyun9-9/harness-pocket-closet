import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { theme } from '../constants/theme';
import type { Clothing } from '../types';

export interface ClothingCardProps {
  clothing: Clothing;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function ClothingCard({
  clothing,
  onPress,
  selected,
  disabled,
  style,
}: ClothingCardProps) {
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !clothing.imageUri || failed;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {showPlaceholder ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>{clothing.category}</Text>
        </View>
      ) : (
        <Image
          source={{ uri: clothing.imageUri }}
          style={styles.image}
          onError={() => setFailed(true)}
        />
      )}
      {selected && (
        <View style={styles.checkBadge}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 12l5 5L20 6"
              stroke="#FFFFFF"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1,
    width: '100%',
    backgroundColor: '#F4F4F4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: theme.point,
    borderWidth: 2,
  },
  cardDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F4',
  },
  placeholderText: {
    color: theme.muted,
    fontSize: 13,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.point,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
