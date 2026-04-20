import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { Button } from '../components/Button';
import { ClothingForm } from '../components/ClothingForm';
import { useToast } from '../components/ToastContext';
import { CATEGORIES } from '../constants/categories';
import { theme } from '../constants/theme';
import { addClothes } from '../services/storage';
import type { Category, Clothing } from '../types';

interface IncomingItem {
  imageUri: string;
  meta: {
    category?: string;
    colors?: string[];
    material?: string;
    tags?: string[];
  };
}

function normalizeCategory(raw: string | undefined): Category {
  if (raw && (CATEGORIES as readonly string[]).includes(raw)) {
    return raw as Category;
  }
  return '상의';
}

export default function ClothingRegisterScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ items?: string }>();

  const initial = useMemo<Partial<Clothing>[]>(() => {
    try {
      const raw = typeof params.items === 'string' ? params.items : '';
      const parsed = raw ? (JSON.parse(raw) as IncomingItem[]) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => ({
        imageUri: item.imageUri,
        category: normalizeCategory(item.meta?.category),
        colors: Array.isArray(item.meta?.colors) ? item.meta!.colors! : [],
        material: typeof item.meta?.material === 'string' ? item.meta!.material! : '',
        tags: Array.isArray(item.meta?.tags) ? item.meta!.tags! : [],
      }));
    } catch {
      return [];
    }
  }, [params.items]);

  const [forms, setForms] = useState<Partial<Clothing>[]>(initial);
  const [saving, setSaving] = useState(false);

  const updateForm = (idx: number, patch: Partial<Clothing>) => {
    setForms((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const now = Date.now();
      const items: Clothing[] = forms.map((f, idx) => ({
        id: uuidv4(),
        imageUri: f.imageUri ?? '',
        category: (f.category as Category) ?? '상의',
        colors: f.colors ?? [],
        material: f.material ?? '',
        tags: f.tags ?? [],
        createdAt: now + idx,
      }));
      await addClothes(items);
      router.replace('/(tabs)/closet');
    } catch (e: any) {
      setSaving(false);
      toast.show(e?.message ?? '저장에 실패했습니다');
    }
  };

  if (forms.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>등록할 항목이 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {forms.map((form, idx) => (
          <View key={idx} style={styles.card}>
            <Text style={styles.cardTitle}>
              {idx + 1} / {forms.length}
            </Text>
            <ClothingForm
              value={form}
              onChange={(patch) => updateForm(idx, patch)}
            />
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label={`저장하기 (${forms.length}벌)`}
          onPress={handleSave}
          loading={saving}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scroll: { paddingBottom: 120 },
  card: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  cardTitle: {
    fontSize: 13,
    color: theme.muted,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg,
  },
  emptyText: { color: theme.muted },
});
