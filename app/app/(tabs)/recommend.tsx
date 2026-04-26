import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { CombinationCard } from '../../components/CombinationCard';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useToast } from '../../components/ToastContext';
import { OCCASIONS } from '../../constants/occasions';
import { theme } from '../../constants/theme';
import { recommend, RecommendCombination } from '../../services/api';
import { getClothes } from '../../services/storage';
import type { Clothing, Occasion } from '../../types';

export default function RecommendScreen() {
  const router = useRouter();
  const toast = useToast();

  const [clothes, setClothes] = useState<Clothing[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Occasion | null>(null);
  const [loading, setLoading] = useState(false);
  const [combinations, setCombinations] = useState<RecommendCombination[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const list = await getClothes();
        if (!active) return;
        setClothes(list);
        setLoaded(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const canRecommend = clothes.length >= 2;

  const requestRecommend = async (occasion: Occasion) => {
    setLoading(true);
    setSelected(occasion);
    try {
      const res = await recommend(occasion, clothes);
      setCombinations(res.combinations ?? []);
    } catch (e: any) {
      toast.showError(e?.message ?? '추천 요청 실패');
      setCombinations(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTryOn = (ids: string[], stylingPrompt: string) => {
    if (ids.length === 0) return;
    router.push({
      pathname: '/fitting-result-new',
      params: { ids: ids.join(','), sp: stylingPrompt },
    });
  };

  const handleRetry = () => {
    if (selected) {
      void requestRecommend(selected);
    }
  };

  const handleReset = () => {
    setCombinations(null);
    setSelected(null);
  };

  if (!loaded) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.mutedText}>불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>오늘 어떤 옷을 입을까요?</Text>

        {!canRecommend && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>옷을 더 등록해보세요</Text>
            <Text style={styles.noticeSub}>
              최소 2벌 이상 등록되어야 추천을 받을 수 있어요.
            </Text>
          </View>
        )}

        <View style={styles.grid}>
          {OCCASIONS.map((o) => {
            const isSelected = selected === o;
            return (
              <View key={o} style={styles.gridCell}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: !canRecommend }}
                  onPress={() => (canRecommend ? void requestRecommend(o) : undefined)}
                  disabled={!canRecommend}
                  style={({ pressed }) => [
                    styles.occasionBtn,
                    isSelected && styles.occasionBtnSelected,
                    !canRecommend && styles.occasionBtnDisabled,
                    pressed && canRecommend && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.occasionLabel,
                      isSelected && styles.occasionLabelSelected,
                      !canRecommend && styles.occasionLabelDisabled,
                    ]}
                  >
                    {o}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {combinations && combinations.length > 0 && (
          <View style={styles.resultSection}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>{selected} 추천</Text>
              <Pressable
                accessibilityRole="button"
                onPress={handleReset}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text style={styles.resetLink}>다른 상황 선택</Text>
              </Pressable>
            </View>
            {combinations.map((combo, idx) => (
              <CombinationCard
                key={`${selected}-${idx}`}
                clothingIds={combo.clothing_ids}
                comment={combo.comment}
                stylingPrompt={combo.styling_prompt ?? ''}
                allClothes={clothes}
                onTryOn={handleTryOn}
              />
            ))}
            <Button
              label="다시 추천받기"
              onPress={handleRetry}
              variant="secondary"
              fullWidth
            />
          </View>
        )}

        {combinations && combinations.length === 0 && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>추천 결과가 없어요</Text>
            <Button label="다시 추천받기" onPress={handleRetry} variant="secondary" fullWidth />
          </View>
        )}
      </ScrollView>
      <LoadingOverlay visible={loading} message="추천 받는 중..." />
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
  scrollContent: { padding: 16, gap: 16, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '600', color: theme.text, marginTop: 8 },
  noticeBox: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  noticeText: { fontSize: 15, color: theme.text, fontWeight: '500' },
  noticeSub: { fontSize: 13, color: theme.muted, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridCell: {
    width: '33.3333%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  occasionBtn: {
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg,
  },
  occasionBtnSelected: {
    borderColor: theme.point,
    borderWidth: 2,
    backgroundColor: theme.point,
  },
  occasionBtnDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  occasionLabel: { fontSize: 16, fontWeight: '500', color: theme.text },
  occasionLabelSelected: { color: '#FFFFFF', fontWeight: '600' },
  occasionLabelDisabled: { color: theme.muted },
  resultSection: { gap: 12 },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultTitle: { fontSize: 16, fontWeight: '600', color: theme.text },
  resetLink: { fontSize: 13, color: theme.muted },
});
