import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { theme } from '../constants/theme';
import type { Category, Clothing } from '../types';
import { CategoryFilter, CategoryFilterValue } from './CategoryFilter';
import { ClothingCard } from './ClothingCard';

const GRID_COLS = 3;
const GRID_GAP = 8;
const GRID_PADDING = 16;

export interface SelectableClothingGridProps {
  clothes: Clothing[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  initialCategoryFilter?: CategoryFilterValue;
}

/**
 * 선택 규칙을 적용해 새로운 선택 id 배열을 반환.
 * - 같은 카테고리 내 기존 선택은 새 선택으로 대체(최대 1개)
 * - 원피스 선택 시 상의·하의 해제
 * - 상의·하의 선택 시 원피스 해제
 * - 이미 선택된 id를 다시 탭하면 선택 해제
 */
export function toggleWithRules(
  clothes: Clothing[],
  selectedIds: string[],
  targetId: string
): string[] {
  const target = clothes.find((c) => c.id === targetId);
  if (!target) return selectedIds;

  if (selectedIds.includes(targetId)) {
    return selectedIds.filter((id) => id !== targetId);
  }

  const byId = new Map(clothes.map((c) => [c.id, c] as const));
  const keep = selectedIds.filter((id) => {
    const c = byId.get(id);
    if (!c) return false;
    if (c.category === target.category) return false;
    if (target.category === '원피스' && (c.category === '상의' || c.category === '하의')) {
      return false;
    }
    if ((target.category === '상의' || target.category === '하의') && c.category === '원피스') {
      return false;
    }
    return true;
  });

  return [...keep, targetId];
}

export function SelectableClothingGrid({
  clothes,
  selectedIds,
  onChange,
  initialCategoryFilter = 'all',
}: SelectableClothingGridProps) {
  const [filter, setFilter] = useState<CategoryFilterValue>(initialCategoryFilter);

  const filtered = useMemo(
    () =>
      clothes.filter((c) =>
        filter === 'all' || filter === null ? true : c.category === (filter as Category)
      ),
    [clothes, filter]
  );

  const handlePress = (id: string) => {
    const next = toggleWithRules(clothes, selectedIds, id);
    onChange(next);
  };

  return (
    <View style={styles.container}>
      <CategoryFilter value={filter} onChange={setFilter} includeAll />
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
              selected={selectedIds.includes(item.id)}
              onPress={() => handlePress(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>해당 카테고리에 옷이 없습니다</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gridContent: { padding: GRID_PADDING, paddingBottom: 24 },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  cell: { flex: 1 / GRID_COLS, maxWidth: `${100 / GRID_COLS}%` },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: theme.muted, fontSize: 14 },
});
