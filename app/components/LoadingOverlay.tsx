import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { theme } from '../constants/theme';

export interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  if (!visible) return null;
  return (
    <View style={styles.overlay} pointerEvents="auto" accessibilityRole="progressbar">
      <View style={styles.box}>
        <ActivityIndicator size="large" color={theme.point} />
        {message ? <Text style={styles.text}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  box: {
    minWidth: 140,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 12,
    color: theme.text,
    fontSize: 14,
  },
});
