import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { ClothingForm } from '../../components/ClothingForm';
import { useToast } from '../../components/ToastContext';
import { theme } from '../../constants/theme';
import { deleteImage } from '../../services/imageUtils';
import { deleteClothing, getClothes, updateClothing } from '../../services/storage';
import { pushPendingClothes } from '../../services/sync/clothesSync';

function triggerPush(): void {
  pushPendingClothes().catch(() => {
    /* 실패해도 closet focus 시 재시도됨 */
  });
}
import type { Clothing } from '../../types';

function diffEqual(a: Partial<Clothing>, b: Partial<Clothing>): boolean {
  return (
    a.category === b.category &&
    a.material === b.material &&
    sameStrArray(a.colors ?? [], b.colors ?? []) &&
    sameStrArray(a.tags ?? [], b.tags ?? [])
  );
}

function sameStrArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export default function ClothingDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [original, setOriginal] = useState<Clothing | null>(null);
  const [form, setForm] = useState<Partial<Clothing> | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const list = await getClothes();
      const found = list.find((c) => c.id === id) ?? null;
      if (!active) return;
      setOriginal(found);
      setForm(found ? { ...found } : null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const changed = useMemo(() => {
    if (!original || !form) return false;
    return !diffEqual(original, form);
  }, [original, form]);

  const handleUpdate = async () => {
    if (!original || !form || busy) return;
    setBusy(true);
    try {
      await updateClothing(original.id, {
        category: form.category,
        colors: form.colors ?? [],
        material: form.material ?? '',
        tags: form.tags ?? [],
      });
      triggerPush();
      toast.show('수정되었습니다');
      router.back();
    } catch (e: any) {
      setBusy(false);
      toast.showError(e?.message ?? '수정에 실패했습니다');
    }
  };

  const handleDelete = () => {
    if (!original || busy) return;
    Alert.alert('삭제하시겠습니까?', '이 옷을 옷장에서 삭제합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteClothing(original.id);
            if (original.imageUri) {
              try {
                await deleteImage(original.imageUri);
              } catch {}
            }
            triggerPush();
            router.back();
          } catch (e: any) {
            setBusy(false);
            toast.showError(e?.message ?? '삭제에 실패했습니다');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.mutedText}>불러오는 중...</Text>
      </View>
    );
  }

  if (!original || !form) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.mutedText}>존재하지 않는 항목입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ClothingForm value={form} onChange={(patch) => setForm({ ...form, ...patch })} />
        <View style={styles.deleteWrap}>
          <Button
            label="삭제하기"
            onPress={handleDelete}
            variant="danger"
            fullWidth
            disabled={busy}
          />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label="수정 완료"
          onPress={handleUpdate}
          disabled={!changed || busy}
          loading={busy && changed}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scroll: { paddingBottom: 120 },
  deleteWrap: { paddingHorizontal: 16, paddingTop: 16 },
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg,
  },
  mutedText: { color: theme.muted },
});
