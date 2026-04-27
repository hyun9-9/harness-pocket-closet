import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  addClothes,
  addFitting,
  deleteClothing,
  getAllClothesIncludingDeleted,
  getClothes,
  getFittings,
} from '../services/storage';
import type { Clothing, FittingResult } from '../types';

beforeEach(async () => {
  await AsyncStorage.clear();
});

const makeClothing = (overrides: Partial<Clothing> = {}): Clothing => ({
  id: 'c1',
  imageUri: 'file:///c1.jpg',
  category: '상의',
  colors: ['white'],
  material: 'cotton',
  tags: ['basic'],
  createdAt: 1000,
  ...overrides,
});

/**
 * ADR-008 회귀 — 옷 삭제 후에도 그 옷을 사용한 피팅 기록은 보존되어야 한다.
 * 사용된 옷은 이후 placeholder 로 표시. sync 환경에서도 같은 동작 유지.
 */
describe('ADR-008: 옷 삭제 시 피팅 기록 유지', () => {
  it('옷 A 를 삭제해도 A 를 사용한 피팅은 그대로 살아있고 clothingIds 에 A 가 유지된다', async () => {
    await addClothes([
      makeClothing({ id: 'A' }),
      makeClothing({ id: 'B', category: '하의' }),
    ]);
    const fitting: FittingResult = {
      id: 'f1',
      resultImageUri: 'file:///fit1.jpg',
      clothingIds: ['A', 'B'],
      createdAt: 2000,
    };
    await addFitting(fitting);

    await deleteClothing('A');

    // 옷장에는 A 가 안 보임 (soft delete)
    const visibleClothes = await getClothes();
    expect(visibleClothes.map((c) => c.id)).toEqual(['B']);

    // 그러나 sync 흐름에서는 deleted 상태로 존재 (서버에 push 하기 위함)
    const all = await getAllClothesIncludingDeleted();
    const dead = all.find((c) => c.id === 'A');
    expect(dead?.deleted_at).toEqual(expect.any(String));

    // 피팅은 그대로 — 옷 A 가 사라졌다고 fitting 자체가 영향받지 않음.
    // clothingIds 도 그대로라 'A' 자리에 placeholder 로 표시될 수 있다.
    const fittings = await getFittings();
    expect(fittings).toHaveLength(1);
    expect(fittings[0].id).toBe('f1');
    expect(fittings[0].clothingIds).toEqual(['A', 'B']);
    expect(fittings[0].deleted_at ?? null).toBeNull();
  });

  it('피팅 렌더링 시 사용된 옷 id 가 visible clothes 에 없으면 placeholder 분기 — 데이터로 검증', async () => {
    await addClothes([makeClothing({ id: 'A' })]);
    await addFitting({
      id: 'f1',
      resultImageUri: 'file:///fit1.jpg',
      clothingIds: ['A'],
      createdAt: 2000,
    });
    await deleteClothing('A');

    const visibleClothes = await getClothes();
    const fittings = await getFittings();
    const targetFitting = fittings[0];

    // 컴포넌트가 사용하는 패턴: clothingIds 의 각 id 를 visibleClothes 에서 lookup,
    // 없으면 placeholder. 그 lookup 이 의도대로 None 을 돌려주는지 검증.
    const lookups = targetFitting.clothingIds.map((id) =>
      visibleClothes.find((c) => c.id === id)
    );
    expect(lookups).toEqual([undefined]); // A 는 lookup 실패 → placeholder
  });
});
