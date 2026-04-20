import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Button } from '../../components/Button';
import { SelectableClothingGrid } from '../../components/SelectableClothingGrid';
import { theme } from '../../constants/theme';
import { getClothes, getFittings, getUserProfile } from '../../services/storage';
import type { Clothing, FittingResult } from '../../types';

function parseIds(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const str = Array.isArray(raw) ? raw.join(',') : raw;
  return str
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function FittingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ids?: string }>();

  const [personUri, setPersonUri] = useState<string | null>(null);
  const [clothes, setClothes] = useState<Clothing[]>([]);
  const [fittings, setFittings] = useState<FittingResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => parseIds(params.ids));
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [profile, clothesList, fittingsList] = await Promise.all([
          getUserProfile(),
          getClothes(),
          getFittings(),
        ]);
        if (!active) return;
        setPersonUri(profile.personImageUri);
        setClothes([...clothesList].sort((a, b) => b.createdAt - a.createdAt));
        setFittings([...fittingsList].sort((a, b) => b.createdAt - a.createdAt));
        setLoaded(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const validSelectedIds = useMemo(() => {
    const idSet = new Set(clothes.map((c) => c.id));
    return selectedIds.filter((id) => idSet.has(id));
  }, [clothes, selectedIds]);

  if (!loaded) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.mutedText}>불러오는 중...</Text>
      </View>
    );
  }

  if (!personUri) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>전신 사진을 등록해주세요</Text>
        <Text style={styles.emptySubtitle}>피팅을 시작하려면 먼저 전신 사진이 필요해요.</Text>
        <Button label="촬영하기" onPress={() => router.push('/person-camera')} />
      </View>
    );
  }

  const handleStartFitting = () => {
    if (validSelectedIds.length === 0) return;
    router.push({
      pathname: '/fitting-result-new',
      params: { ids: validSelectedIds.join(',') },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.personRow}>
          <Image source={{ uri: personUri }} style={styles.personThumb} />
          <View style={styles.personMeta}>
            <Text style={styles.personLabel}>내 전신 사진</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="전신 사진 재촬영"
            onPress={() => router.push('/person-camera')}
            style={({ pressed }) => [styles.gearBtn, pressed && styles.pressed]}
          >
            <GearIcon color={theme.text} size={20} />
          </Pressable>
        </View>

        {fittings.length > 0 && (
          <View style={styles.recentWrap}>
            <Text style={styles.sectionLabel}>최근 피팅</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentContent}>
              {fittings.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => router.push(`/fitting-result/${f.id}`)}
                  style={({ pressed }) => [styles.recentItem, pressed && styles.pressed]}
                >
                  <Image source={{ uri: f.resultImageUri }} style={styles.recentImage} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {clothes.length === 0 ? (
        <View style={styles.gridEmptyWrap}>
          <Text style={styles.emptyText}>옷을 먼저 등록해주세요</Text>
        </View>
      ) : (
        <SelectableClothingGrid
          clothes={clothes}
          selectedIds={validSelectedIds}
          onChange={setSelectedIds}
        />
      )}

      <View style={styles.footer}>
        <Button
          label={`피팅하기 (${validSelectedIds.length}개)`}
          onPress={handleStartFitting}
          disabled={validSelectedIds.length === 0}
          fullWidth
        />
      </View>
    </View>
  );
}

function GearIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
        stroke={color}
        strokeWidth={1.8}
      />
      <Path
        d="M19.4 13a7.5 7.5 0 000-2l2-1.5-2-3.4-2.4.8a7.5 7.5 0 00-1.7-1L15 3h-4l-.3 2.9a7.5 7.5 0 00-1.7 1L6.6 6 4.6 9.5l2 1.5a7.5 7.5 0 000 2l-2 1.5 2 3.4 2.4-.8a7.5 7.5 0 001.7 1L11 21h4l.3-2.9a7.5 7.5 0 001.7-1l2.4.8 2-3.4-2-1.5z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg,
    padding: 24,
    gap: 12,
  },
  mutedText: { color: theme.muted },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: theme.text },
  emptySubtitle: { fontSize: 14, color: theme.muted, textAlign: 'center', marginBottom: 8 },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingBottom: 12,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  personThumb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F4F4F4',
  },
  personMeta: { flex: 1 },
  personLabel: { fontSize: 15, fontWeight: '500', color: theme.text },
  gearBtn: {
    padding: 8,
    borderRadius: 20,
  },
  pressed: { opacity: 0.7 },
  recentWrap: { paddingTop: 12 },
  sectionLabel: {
    fontSize: 13,
    color: theme.muted,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  recentContent: { paddingHorizontal: 16, gap: 8 },
  recentItem: {
    width: 72,
    height: 96,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F4F4F4',
    borderWidth: 1,
    borderColor: theme.border,
  },
  recentImage: { width: '100%', height: '100%' },
  gridEmptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: theme.muted, fontSize: 15 },
  footer: {
    padding: 16,
    backgroundColor: theme.bg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
});
