import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  addClothes,
  addFitting,
  deleteClothing,
  getAllClothesIncludingDeleted,
  getClothes,
  getFittings,
  getUserProfile,
  markClothingSynced,
  setPersonImage,
  updateClothing,
  upsertClothesFromRemote,
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

describe('storage clothes — round-trip & meta defaults', () => {
  it('addClothes / getClothes 라운드트립 (메타 default 채워짐)', async () => {
    const items = [makeClothing({ id: 'a' }), makeClothing({ id: 'b' })];
    await addClothes(items);
    const got = await getClothes();
    expect(got).toHaveLength(2);
    expect(got[0]).toMatchObject({ id: 'a', imageUri: 'file:///c1.jpg', category: '상의' });
    expect(got[1]).toMatchObject({ id: 'b' });
    // 메타 default
    expect(got[0].updated_at).toEqual(expect.any(String));
    expect(got[0].deleted_at).toBeNull();
    expect(got[0].remote_synced_at).toBeNull();
  });

  it('updateClothing 이 patch 를 반영하고 updated_at 갱신 + remote_synced_at 리셋', async () => {
    await addClothes([makeClothing({ id: 'a', material: 'cotton' })]);
    await markClothingSynced('a', '2026-04-26T00:00:00.000Z');
    const before = (await getClothes())[0];
    expect(before.remote_synced_at).toBe('2026-04-26T00:00:00.000Z');

    await new Promise((r) => setTimeout(r, 5));
    await updateClothing('a', { material: 'linen', tags: ['summer'] });

    const after = (await getClothes())[0];
    expect(after).toMatchObject({ id: 'a', material: 'linen', tags: ['summer'] });
    expect(after.updated_at).not.toBe(before.updated_at); // 갱신됨
    expect(after.remote_synced_at).toBeNull(); // push 큐로 다시 들어감
  });

  it('deleteClothing 후 getClothes 에 사라지지만 getAllClothesIncludingDeleted 에는 남는다 (soft delete)', async () => {
    await addClothes([makeClothing({ id: 'a' }), makeClothing({ id: 'b' })]);
    await deleteClothing('a');

    const visible = await getClothes();
    expect(visible.map((c) => c.id)).toEqual(['b']);

    const all = await getAllClothesIncludingDeleted();
    const dead = all.find((c) => c.id === 'a');
    expect(dead?.deleted_at).toEqual(expect.any(String));
    expect(dead?.remote_synced_at).toBeNull(); // push 대상
  });
});

describe('storage clothes — pull / LWW', () => {
  it('서버에만 있는 row 는 로컬에 추가된다', async () => {
    const remote: Clothing = {
      ...makeClothing({ id: 'r1' }),
      updated_at: '2026-04-27T01:00:00.000Z',
    };
    await upsertClothesFromRemote([remote]);
    const got = await getAllClothesIncludingDeleted();
    expect(got.find((c) => c.id === 'r1')).toMatchObject({ id: 'r1' });
  });

  it('동일 id, 서버가 더 최신이면 로컬을 덮어쓴다', async () => {
    await addClothes([makeClothing({ id: 'a', material: 'cotton' })]);
    // 로컬은 방금 add 됐으니 updated_at = now. 서버는 현재 시각보다 미래.
    const future = new Date(Date.now() + 60_000).toISOString();
    await upsertClothesFromRemote([
      { ...makeClothing({ id: 'a', material: 'wool' }), updated_at: future },
    ]);
    const got = (await getClothes())[0];
    expect(got.material).toBe('wool');
    expect(got.remote_synced_at).toBe(future);
  });

  it('동일 id, 로컬이 더 최신이면 서버 row 를 무시한다', async () => {
    await addClothes([makeClothing({ id: 'a', material: 'cotton' })]);
    // 서버는 과거 시각
    await upsertClothesFromRemote([
      {
        ...makeClothing({ id: 'a', material: 'wool' }),
        updated_at: '2020-01-01T00:00:00.000Z',
      },
    ]);
    const got = (await getClothes())[0];
    expect(got.material).toBe('cotton'); // 로컬 유지
  });
});

describe('storage fittings', () => {
  it('addFitting 후 getFittings 에 포함', async () => {
    const fitting: FittingResult = {
      id: 'f1',
      resultImageUri: 'file:///f1.jpg',
      clothingIds: ['a', 'b'],
      createdAt: 2000,
    };
    await addFitting(fitting);
    const got = await getFittings();
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ id: 'f1', resultImageUri: 'file:///f1.jpg' });
  });
});

describe('storage user profile', () => {
  it('setPersonImage 후 getUserProfile 이 uri 반환', async () => {
    await setPersonImage('file:///person.jpg');
    const profile = await getUserProfile();
    expect(profile).toMatchObject({ personImageUri: 'file:///person.jpg' });
    expect(profile.updated_at).toEqual(expect.any(String));
  });

  it('setPersonImage 호출 전에는 personImageUri 가 null', async () => {
    const profile = await getUserProfile();
    expect(profile.personImageUri).toBeNull();
  });
});
