import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { Button } from '../components/Button';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useToast } from '../components/ToastContext';
import { theme } from '../constants/theme';
import { tryOn } from '../services/api';
import { deleteImage, saveFittingResultFromBase64 } from '../services/imageUtils';
import { addFitting, getClothes, getUserProfile } from '../services/storage';
import type { Clothing } from '../types';

function parseIds(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const str = Array.isArray(raw) ? raw.join(',') : raw;
  return str
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function buildMeta(items: Clothing[]): string {
  return items
    .map((c) => {
      const parts: string[] = [c.category];
      if (c.colors.length) parts.push(c.colors.join('/'));
      if (c.material) parts.push(c.material);
      if (c.tags.length) parts.push(c.tags.join(','));
      return parts.join(' ');
    })
    .join(' | ');
}

export default function FittingResultNewScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ ids?: string }>();

  const [loading, setLoading] = useState(true);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [usedClothes, setUsedClothes] = useState<Clothing[]>([]);
  const [saving, setSaving] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const ids = parseIds(params.ids);
    (async () => {
      try {
        const [profile, allClothes] = await Promise.all([getUserProfile(), getClothes()]);
        if (!profile.personImageUri) throw new Error('전신 사진이 등록되어 있지 않습니다');
        const byId = new Map(allClothes.map((c) => [c.id, c] as const));
        const picked = ids.map((id) => byId.get(id)).filter((c): c is Clothing => !!c);
        if (picked.length === 0) throw new Error('선택된 옷이 없습니다');

        const clothingUris = picked.map((c) => c.imageUri);
        const res = await tryOn(profile.personImageUri, clothingUris, buildMeta(picked));
        const localUri = await saveFittingResultFromBase64(res.image_base64);

        setUsedClothes(picked);
        setResultUri(localUri);
        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        toast.showError(e?.message ?? '피팅에 실패했습니다');
        router.back();
      }
    })();
  }, [params.ids, router, toast]);

  const handleRetry = async () => {
    if (resultUri) {
      try {
        await deleteImage(resultUri);
      } catch {}
    }
    router.back();
  };

  const handleSave = async () => {
    if (!resultUri || saving) return;
    setSaving(true);
    try {
      await addFitting({
        id: uuidv4(),
        resultImageUri: resultUri,
        clothingIds: usedClothes.map((c) => c.id),
        createdAt: Date.now(),
      });
      router.replace('/(tabs)/fitting');
    } catch (e: any) {
      setSaving(false);
      toast.showError(e?.message ?? '저장에 실패했습니다');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingOverlay visible message="피팅 중..." />
      </View>
    );
  }

  if (!resultUri) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.mutedText}>결과를 불러올 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image source={{ uri: resultUri }} style={styles.resultImage} />

        <Text style={styles.sectionLabel}>사용된 옷</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clothesRow}>
          {usedClothes.map((c) => (
            <View key={c.id} style={styles.clothItem}>
              <Image source={{ uri: c.imageUri }} style={styles.clothImage} />
            </View>
          ))}
        </ScrollView>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="바꿔보기" onPress={handleRetry} variant="secondary" style={styles.footerBtn} />
        <Button label="저장" onPress={handleSave} loading={saving} style={styles.footerBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg,
  },
  mutedText: { color: theme.muted },
  scroll: { paddingBottom: 120 },
  resultImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#F4F4F4',
  },
  sectionLabel: {
    fontSize: 13,
    color: theme.muted,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  clothesRow: { paddingHorizontal: 16, gap: 8 },
  clothItem: {
    width: 72,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F4F4F4',
    borderWidth: 1,
    borderColor: theme.border,
  },
  clothImage: { width: '100%', height: '100%' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: theme.bg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  footerBtn: { flex: 1 },
});
