import AsyncStorage from '@react-native-async-storage/async-storage';

import { CLOTHES_KEY, FITTINGS_KEY, PROFILE_KEY } from '../constants/storageKeys';
import type { Clothing, FittingResult, UserProfile } from '../types';

async function readArray<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeArray<T>(key: string, value: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getClothes(): Promise<Clothing[]> {
  return readArray<Clothing>(CLOTHES_KEY);
}

export async function addClothes(items: Clothing[]): Promise<void> {
  const current = await getClothes();
  await writeArray(CLOTHES_KEY, [...current, ...items]);
}

export async function updateClothing(
  id: string,
  patch: Partial<Clothing>
): Promise<void> {
  const current = await getClothes();
  const next = current.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c));
  await writeArray(CLOTHES_KEY, next);
}

export async function deleteClothing(id: string): Promise<void> {
  const current = await getClothes();
  await writeArray(
    CLOTHES_KEY,
    current.filter((c) => c.id !== id)
  );
}

export async function getFittings(): Promise<FittingResult[]> {
  return readArray<FittingResult>(FITTINGS_KEY);
}

export async function addFitting(item: FittingResult): Promise<void> {
  const current = await getFittings();
  await writeArray(FITTINGS_KEY, [...current, item]);
}

export async function getUserProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return { personImageUri: null };
  try {
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return { personImageUri: parsed.personImageUri ?? null };
  } catch {
    return { personImageUri: null };
  }
}

export async function setPersonImage(uri: string | null): Promise<void> {
  const profile: UserProfile = { personImageUri: uri };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function clearAllLocal(): Promise<void> {
  await AsyncStorage.multiRemove([CLOTHES_KEY, FITTINGS_KEY, PROFILE_KEY]);
}
