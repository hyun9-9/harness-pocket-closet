import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  addClothes,
  getClothes,
  updateClothing,
  deleteClothing,
  addFitting,
  getFittings,
  setPersonImage,
  getUserProfile,
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

describe('storage clothes', () => {
  it('addClothes / getClothes 라운드트립', async () => {
    const items = [makeClothing({ id: 'a' }), makeClothing({ id: 'b' })];
    await addClothes(items);
    const got = await getClothes();
    expect(got).toEqual(items);
  });

  it('updateClothing 이 patch 를 반영한다', async () => {
    await addClothes([makeClothing({ id: 'a', material: 'cotton' })]);
    await updateClothing('a', { material: 'linen', tags: ['summer'] });
    const got = await getClothes();
    expect(got[0]).toMatchObject({ id: 'a', material: 'linen', tags: ['summer'] });
  });

  it('deleteClothing 이 id 를 제거한다', async () => {
    await addClothes([makeClothing({ id: 'a' }), makeClothing({ id: 'b' })]);
    await deleteClothing('a');
    const got = await getClothes();
    expect(got.map((c) => c.id)).toEqual(['b']);
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
    expect(got).toContainEqual(fitting);
  });
});

describe('storage user profile', () => {
  it('setPersonImage 후 getUserProfile 이 uri 반환', async () => {
    await setPersonImage('file:///person.jpg');
    const profile = await getUserProfile();
    expect(profile).toEqual({ personImageUri: 'file:///person.jpg' });
  });

  it('setPersonImage 호출 전에는 personImageUri 가 null', async () => {
    const profile = await getUserProfile();
    expect(profile).toEqual({ personImageUri: null });
  });
});
