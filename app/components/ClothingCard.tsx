import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { theme } from '../constants/theme';
import { getReadUrl } from '../services/sync/imageUpload';
import type { Clothing } from '../types';

const LOCAL_OR_HTTP_RE = /^(file|content|https?|data):/;

function useResolvedImageUri(rawUri: string | undefined | null): {
  uri: string | null;
  failed: boolean;
} {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (!rawUri) {
      setUri(null);
      return;
    }
    if (LOCAL_OR_HTTP_RE.test(rawUri)) {
      setUri(rawUri);
      return;
    }
    setUri(null);
    getReadUrl('clothes', rawUri)
      .then((signed) => {
        if (!cancelled) setUri(signed);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [rawUri]);

  return { uri, failed };
}

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
  const [imgFailed, setImgFailed] = useState(false);
  const { uri: resolvedUri, failed: resolveFailed } = useResolvedImageUri(
    clothing.imageUri
  );
  const showPlaceholder = !resolvedUri || imgFailed || resolveFailed;
  const isAnalyzing = clothing.status === 'analyzing';
  const isAnalyzeFailed = clothing.status === 'failed';

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
          source={{ uri: resolvedUri }}
          style={styles.image}
          onError={() => setImgFailed(true)}
        />
      )}
      {isAnalyzing && (
        <View style={styles.statusOverlay}>
          <ActivityIndicator color="#FFFFFF" size="small" />
          <Text style={styles.statusText}>등록중…</Text>
        </View>
      )}
      {isAnalyzeFailed && (
        <View style={styles.statusOverlay}>
          <Text style={styles.statusText}>분석 실패</Text>
        </View>
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
  statusOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
