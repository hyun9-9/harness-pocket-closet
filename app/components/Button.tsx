import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { theme } from '../constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  fullWidth,
  style,
}: ButtonProps) {
  const isInactive = Boolean(disabled || loading);
  const bg = backgroundColor(variant, isInactive);
  const fg = foregroundColor(variant, isInactive);
  const border = borderColor(variant, isInactive);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isInactive }}
      onPress={isInactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor: border },
        fullWidth && styles.fullWidth,
        pressed && !isInactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

function backgroundColor(variant: ButtonVariant, inactive: boolean): string {
  if (inactive) return '#D9D9D9';
  if (variant === 'primary') return theme.point;
  if (variant === 'danger') return theme.bg;
  return theme.bg;
}

function foregroundColor(variant: ButtonVariant, inactive: boolean): string {
  if (inactive) return theme.muted;
  if (variant === 'primary') return '#FFFFFF';
  if (variant === 'danger') return '#C0392B';
  return theme.text;
}

function borderColor(variant: ButtonVariant, inactive: boolean): string {
  if (inactive) return '#D9D9D9';
  if (variant === 'primary') return theme.point;
  if (variant === 'danger') return '#C0392B';
  return theme.border;
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.8 },
  label: { fontSize: 16, fontWeight: '600' },
});
