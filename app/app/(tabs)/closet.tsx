import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Button } from '../../components/Button';
import { CategoryFilter, CategoryFilterValue } from '../../components/CategoryFilter';
import { ClothingCard } from '../../components/ClothingCard';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useToast } from '../../components/ToastContext';
import { theme } from '../../constants/theme';
import { analyzeClothes, type AnalyzeItem } from '../../services/api';
import { pickImagesFromGallery, takePhoto } from '../../services/imagePicker';
import { resizeAndSaveClothingImage } from '../../services/imageUtils';
import { getClothes } from '../../services/storage';
import type { Clothing } from '../../types';

const GRID_COLS = 3;
const GRID_GAP = 8;
const GRID_PADDING = 16;

export default function ClosetScreen() {
  const router = useRouter();
  const toast = useToast();

  const [clothes, setClothes] = useState<Clothing[]>([]);
  const [filter, setFilter] = useState<CategoryFilterValue>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const items = await getClothes();
        if (!active) return;
        const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
        setClothes(sorted);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const filtered = clothes.filter((c) =>
    filter === 'all' || filter === null ? true : c.category === filter
  );

  const handleSelect = async (source: 'camera' | 'gallery') => {
    setSheetOpen(false);
    try {
      let uris: string[] = [];
      if (source === 'camera') {
        const uri = await takePhoto();
        if (!uri) return;
        uris = [uri];
      } else {
        uris = await pickImagesFromGallery(5);
        if (uris.length === 0) return;
      }

      setLoading(true);
      const resized = await Promise.all(uris.map(resizeAndSaveClothingImage));
      const metas: AnalyzeItem[] = await analyzeClothes(resized);

      const items = resized.map((imageUri, idx) => ({
        imageUri,
        meta: metas[idx] ?? { category: '상의', colors: [], material: '', tags: [] },
      }));
      setLoading(false);
      router.push({
        pathname: '/clothing-register',
        params: { items: JSON.stringify(items) },
      });
    } catch (e: any) {
      setLoading(false);
      toast.show(e?.message ?? '처리 중 오류가 발생했습니다');
    }
  };

  const isEmpty = clothes.length === 0;

  return (
    <View style={styles.container}>
      {!isEmpty && (
        <CategoryFilter value={filter} onChange={setFilter} includeAll />
      )}

      {isEmpty ? (
        <View style={styles.emptyWrap}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSheetOpen(true)}
            style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
          >
            <PlusIcon color={theme.point} size={28} />
          </Pressable>
          <Text style={styles.emptyText}>옷을 등록해보세요</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={GRID_COLS}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <ClothingCard
                clothing={item}
                onPress={() => router.push(`/clothing/${item.id}`)}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.filterEmptyWrap}>
              <Text style={styles.emptyText}>해당 카테고리에 옷이 없습니다</Text>
            </View>
          }
        />
      )}

      {!isEmpty && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="옷 추가"
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        >
          <PlusIcon color="#FFFFFF" size={28} />
        </Pressable>
      )}

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>사진 선택</Text>
            <Button
              label="카메라로 촬영"
              onPress={() => handleSelect('camera')}
              fullWidth
              style={styles.sheetBtn}
            />
            <Button
              label="갤러리에서 선택 (최대 5장)"
              onPress={() => handleSelect('gallery')}
              variant="secondary"
              fullWidth
              style={styles.sheetBtn}
            />
            <Button
              label="취소"
              onPress={() => setSheetOpen(false)}
              variant="secondary"
              fullWidth
              style={styles.sheetBtn}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <LoadingOverlay visible={loading} message="분석 중..." />
    </View>
  );
}

function PlusIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  gridContent: { padding: GRID_PADDING, paddingBottom: 120 },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  cell: { flex: 1 / GRID_COLS, maxWidth: `${100 / GRID_COLS}%` },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: theme.point,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: theme.muted, fontSize: 15 },
  filterEmptyWrap: { alignItems: 'center', paddingVertical: 40 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.point,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  pressed: { opacity: 0.85 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.bg,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  sheetBtn: { alignSelf: 'stretch' },
});
