import { ScrollView, StyleSheet, View } from 'react-native';

import { CATEGORIES } from '../constants/categories';
import type { Category } from '../types';
import { Chip } from './Chip';

export type CategoryFilterValue = Category | 'all' | null;

export interface CategoryFilterProps {
  value: CategoryFilterValue;
  onChange: (value: CategoryFilterValue) => void;
  includeAll?: boolean;
  categories?: readonly Category[];
}

export function CategoryFilter({
  value,
  onChange,
  includeAll,
  categories = CATEGORIES,
}: CategoryFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.scroll}
    >
      {includeAll && (
        <View style={styles.item}>
          <Chip label="전체" selected={value === 'all'} onPress={() => onChange('all')} />
        </View>
      )}
      {categories.map((c) => (
        <View key={c} style={styles.item}>
          <Chip label={c} selected={value === c} onPress={() => onChange(c)} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: 16, paddingVertical: 8 },
  item: { marginRight: 8 },
});
