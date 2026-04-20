import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ClothingCard } from '../../components/ClothingCard';
import { theme } from '../../constants/theme';
import { getClothes, getFittings } from '../../services/storage';
import type { Clothing, FittingResult } from '../../types';

function placeholderClothing(id: string): Clothing {
  return {
    id,
    imageUri: '',
    category: '상의',
    colors: [],
    material: '',
    tags: [],
    createdAt: 0,
  };
}

export default function FittingResultDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [fitting, setFitting] = useState<FittingResult | null>(null);
  const [clothes, setClothes] = useState<Clothing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [fittings, allClothes] = await Promise.all([getFittings(), getClothes()]);
      if (!active) return;
      const found = fittings.find((f) => f.id === id) ?? null;
      setFitting(found);
      if (found) {
        const byId = new Map(allClothes.map((c) => [c.id, c] as const));
        setClothes(found.clothingIds.map((cid) => byId.get(cid) ?? placeholderClothing(cid)));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.mutedText}>불러오는 중...</Text>
      </View>
    );
  }

  if (!fitting) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.mutedText}>존재하지 않는 피팅 기록입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image source={{ uri: fitting.resultImageUri }} style={styles.resultImage} />

        <Text style={styles.sectionLabel}>사용된 옷</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clothesRow}>
          {clothes.map((c, idx) => (
            <View key={`${c.id}-${idx}`} style={styles.clothItem}>
              <ClothingCard clothing={c} />
            </View>
          ))}
        </ScrollView>
      </ScrollView>
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
  scroll: { paddingBottom: 24 },
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
    width: 88,
  },
});
