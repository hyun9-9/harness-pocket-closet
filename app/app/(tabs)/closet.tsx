import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { v4 as uuidv4 } from 'uuid';

import { Button } from '../../components/Button';
import { CategoryFilter, CategoryFilterValue } from '../../components/CategoryFilter';
import { ClothingCard } from '../../components/ClothingCard';
import { useToast } from '../../components/ToastContext';
import { CATEGORIES } from '../../constants/categories';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { analyzeClothes } from '../../services/api';
import { pickImagesFromGallery, takePhoto } from '../../services/imagePicker';
import { resizeAndSaveClothingImage } from '../../services/imageUtils';
import { addClothes, getClothes, updateClothing } from '../../services/storage';
import {
  pushPendingClothes,
  syncClothes,
} from '../../services/sync/clothesSync';
import type { Category, Clothing } from '../../types';

function triggerPush(): void {
  pushPendingClothes().catch((e) => {
    // eslint-disable-next-line no-console
    console.warn('pushPendingClothes failed', e);
  });
}

const inFlightIds = new Set<string>();

function normalizeCategory(raw: string | undefined): Category {
  if (raw && (CATEGORIES as readonly string[]).includes(raw)) {
    return raw as Category;
  }
  return '상의';
}

const GRID_COLS = 3;
const GRID_GAP = 8;
const GRID_PADDING = 16;

export default function ClosetScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, signOut } = useAuth();

  const [clothes, setClothes] = useState<Clothing[]>([]);
  const [filter, setFilter] = useState<CategoryFilterValue>('all');
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleAccountPress = () => {
    const email = user?.email ?? '로그인됨';
    Alert.alert(
      email,
      undefined,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: () => {
            signOut().catch((e) => toast.showError(e?.message ?? '로그아웃 실패'));
          },
        },
      ],
      { cancelable: true }
    );
  };

  const refresh = useCallback(async () => {
    const items = await getClothes();
    const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
    setClothes(sorted);
    for (const c of items) {
      if (c.status === 'analyzing' && !inFlightIds.has(c.id)) {
        await updateClothing(c.id, { status: 'failed' });
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        await refresh();
        if (!active || !user) return;
        // 포커스 진입마다 1회 sync — push 누락 만회 + remote 변경 pull.
        // 실패해도 UI 는 진행. 끝나면 한번 더 refresh 로 pull 결과 반영.
        try {
          await syncClothes();
          if (!active) return;
          await refresh();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('syncClothes failed', e);
        }
      })();
      return () => {
        active = false;
      };
    }, [refresh, user])
  );

  const filtered = clothes.filter((c) =>
    filter === 'all' || filter === null ? true : c.category === filter
  );

  const runAnalyze = async (placeholders: Clothing[]) => {
    const uris = placeholders.map((p) => p.imageUri);
    try {
      const metas = await analyzeClothes(uris);
      await Promise.all(
        placeholders.map((p, idx) => {
          const meta = metas[idx];
          if (!meta) {
            return updateClothing(p.id, { status: 'failed' });
          }
          return updateClothing(p.id, {
            category: normalizeCategory(meta.category),
            colors: Array.isArray(meta.colors) ? meta.colors : [],
            material: typeof meta.material === 'string' ? meta.material : '',
            tags: Array.isArray(meta.tags) ? meta.tags : [],
            status: 'ready',
          });
        }),
      );
    } catch (e: any) {
      await Promise.all(
        placeholders.map((p) => updateClothing(p.id, { status: 'failed' })),
      );
      toast.showError(e?.message ?? '분석 중 오류가 발생했습니다');
    } finally {
      for (const p of placeholders) inFlightIds.delete(p.id);
      await refresh();
      triggerPush();
    }
  };

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

      const resized = await Promise.all(uris.map(resizeAndSaveClothingImage));
      const now = Date.now();
      const placeholders: Clothing[] = resized.map((imageUri, idx) => ({
        id: uuidv4(),
        imageUri,
        category: '상의',
        colors: [],
        material: '',
        tags: [],
        createdAt: now + idx,
        status: 'analyzing',
      }));
      for (const p of placeholders) inFlightIds.add(p.id);
      await addClothes(placeholders);
      await refresh();
      void runAnalyze(placeholders);
    } catch (e: any) {
      toast.showError(e?.message ?? '처리 중 오류가 발생했습니다');
    }
  };

  const handleDetectMulti = async () => {
    setSheetOpen(false);
    try {
      const uris = await pickImagesFromGallery(1);
      if (uris.length === 0) return;
      const resized = await resizeAndSaveClothingImage(uris[0]);
      router.push({
        pathname: '/clothing-detect-review',
        params: { uri: resized },
      });
    } catch (e: any) {
      toast.showError(e?.message ?? '처리 중 오류가 발생했습니다');
    }
  };

  const isEmpty = clothes.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerFilter}>
          {!isEmpty && (
            <CategoryFilter value={filter} onChange={setFilter} includeAll />
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="계정"
          onPress={handleAccountPress}
          style={({ pressed }) => [styles.accountBtn, pressed && styles.pressed]}
        >
          <Text style={styles.accountIcon}>👤</Text>
        </Pressable>
      </View>


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
              label="한 장에서 여러 벌 인식"
              onPress={() => handleDetectMulti()}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  headerFilter: { flex: 1, minHeight: 40 },
  accountBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  accountIcon: { fontSize: 18 },
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
