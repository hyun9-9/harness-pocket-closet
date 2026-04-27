import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Button } from '../components/Button';
import { useToast } from '../components/ToastContext';
import { theme } from '../constants/theme';
import { detectMultipleClothes, type DetectMultiItem } from '../services/api';
import { cropAndSaveClothingImage } from '../services/imageUtils';

interface DetectedRow {
  item: DetectMultiItem;
  cropUri: string;
  selected: boolean;
}

export default function ClothingDetectReviewScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ uri?: string }>();
  const sourceUri = typeof params.uri === 'string' ? params.uri : '';

  const [rows, setRows] = useState<DetectedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  const run = useCallback(async () => {
    if (!sourceUri) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await detectMultipleClothes(sourceUri);
      if (items.length === 0) {
        setRows([]);
        toast.showError('감지된 옷이 없어요. 다른 사진으로 시도해주세요.');
        return;
      }
      const cropped: DetectedRow[] = [];
      for (const item of items) {
        try {
          const cropUri = await cropAndSaveClothingImage(sourceUri, item.box_2d);
          cropped.push({ item, cropUri, selected: true });
        } catch {
          // 박스 좌표 오류 등은 조용히 skip
        }
      }
      setRows(cropped);
    } catch (e: any) {
      toast.showError(e?.message ?? '인식 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [sourceUri, toast]);

  useEffect(() => {
    void run();
  }, [run]);

  const toggle = (idx: number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  };

  const selectedCount = rows.filter((r) => r.selected).length;

  const handleNext = () => {
    if (selectedCount === 0 || advancing) return;
    setAdvancing(true);
    const payload = rows
      .filter((r) => r.selected)
      .map((r) => ({
        imageUri: r.cropUri,
        meta: {
          category: r.item.category,
          colors: r.item.colors,
          material: r.item.material,
          tags: r.item.tags,
        },
      }));
    router.replace({
      pathname: '/clothing-register',
      params: { items: JSON.stringify(payload) },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.point} />
        <Text style={styles.mutedText}>옷을 인식하는 중...</Text>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>감지된 옷이 없어요</Text>
        <Text style={styles.mutedText}>다른 사진으로 다시 시도해보세요.</Text>
        <Button label="돌아가기" onPress={() => router.back()} variant="secondary" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>감지된 옷 {rows.length}벌</Text>
        <Text style={styles.subtitle}>등록할 옷을 선택해주세요</Text>
      </View>
      <ScrollView contentContainerStyle={styles.gridContent}>
        <View style={styles.grid}>
          {rows.map((row, idx) => (
            <Pressable
              key={idx}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: row.selected }}
              onPress={() => toggle(idx)}
              style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
            >
              <View style={styles.imageWrap}>
                <Image source={{ uri: row.cropUri }} style={styles.image} />
                {row.selected && (
                  <View style={styles.checkOverlay}>
                    <CheckIcon color="#FFFFFF" size={18} />
                  </View>
                )}
                {!row.selected && <View style={styles.dimOverlay} />}
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {row.item.category}
                {row.item.colors[0] ? ` · ${row.item.colors[0]}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label={`다음 (${selectedCount}벌)`}
          onPress={handleNext}
          disabled={selectedCount === 0 || advancing}
          loading={advancing}
          fullWidth
        />
      </View>
    </View>
  );
}

function CheckIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L20 7" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const GRID_GAP = 8;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg,
    gap: 12,
    padding: 24,
  },
  mutedText: { color: theme.muted, fontSize: 14 },
  header: { padding: 16, gap: 4 },
  title: { fontSize: 18, fontWeight: '600', color: theme.text },
  subtitle: { fontSize: 13, color: theme.muted },
  gridContent: { paddingHorizontal: 16, paddingBottom: 120 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -GRID_GAP / 2 },
  cell: {
    width: '33.3333%',
    paddingHorizontal: GRID_GAP / 2,
    marginBottom: 12,
  },
  imageWrap: {
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F4F4F4',
    borderWidth: 1,
    borderColor: theme.border,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  checkOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.point,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  label: { fontSize: 12, color: theme.text, marginTop: 4, textAlign: 'center' },
  pressed: { opacity: 0.7 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: theme.bg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
});
