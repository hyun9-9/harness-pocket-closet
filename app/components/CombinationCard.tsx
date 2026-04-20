import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '../constants/theme';
import type { Clothing } from '../types';
import { Button } from './Button';
import { ClothingCard } from './ClothingCard';

const THUMB_SIZE = 88;

export interface CombinationCardProps {
  clothingIds: string[];
  comment: string;
  allClothes: Clothing[];
  onTryOn: (ids: string[]) => void;
}

export function CombinationCard({
  clothingIds,
  comment,
  allClothes,
  onTryOn,
}: CombinationCardProps) {
  const byId = new Map(allClothes.map((c) => [c.id, c] as const));

  return (
    <View style={styles.card}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbRow}
      >
        {clothingIds.map((id, idx) => {
          const c = byId.get(id);
          return (
            <View key={`${id}-${idx}`} style={styles.thumbWrap}>
              {c ? (
                <ClothingCard clothing={c} style={styles.thumbCard} />
              ) : (
                <View style={[styles.thumbCard, styles.missingThumb]}>
                  <Text style={styles.missingText}>삭제된 옷</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
      <Text style={styles.comment} numberOfLines={2}>
        {comment}
      </Text>
      <Button
        label="입어보기"
        onPress={() => onTryOn(clothingIds)}
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: theme.bg,
  },
  thumbRow: { gap: 8 },
  thumbWrap: { width: THUMB_SIZE },
  thumbCard: { width: THUMB_SIZE, height: THUMB_SIZE },
  missingThumb: {
    backgroundColor: '#F4F4F4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingText: { color: theme.muted, fontSize: 12 },
  comment: { fontSize: 14, color: theme.text, lineHeight: 20 },
});
