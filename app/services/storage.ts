import AsyncStorage from '@react-native-async-storage/async-storage';

import { CLOTHES_KEY, FITTINGS_KEY, PROFILE_KEY } from '../constants/storageKeys';
import type { Clothing, FittingResult, UserProfile } from '../types';

// 모든 옷/피팅 row 는 내부적으로 메타 필드(updated_at / deleted_at /
// remote_synced_at) 를 갖는다. phase 4 sync 흐름에서 사용. 외부 함수 시그니처는
// 호환을 유지하지만 read 시 default 가 채워지고 write 시 갱신된다.

function nowIso(): string {
  return new Date().toISOString();
}

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

function withDefaultMeta<T extends { updated_at?: string; deleted_at?: string | null; remote_synced_at?: string | null }>(
  item: T
): T {
  return {
    ...item,
    updated_at: item.updated_at ?? nowIso(),
    deleted_at: item.deleted_at ?? null,
    remote_synced_at: item.remote_synced_at ?? null,
  };
}

// ============================================================================
// clothes
// ============================================================================

async function readAllClothes(): Promise<Clothing[]> {
  const items = await readArray<Clothing>(CLOTHES_KEY);
  return items.map(withDefaultMeta);
}

export async function getClothes(): Promise<Clothing[]> {
  // soft-delete 된 row 는 외부에서 보이지 않는다.
  return (await readAllClothes()).filter((c) => !c.deleted_at);
}

export async function getAllClothesIncludingDeleted(): Promise<Clothing[]> {
  return readAllClothes();
}

export async function addClothes(items: Clothing[]): Promise<void> {
  const current = await readAllClothes();
  const now = nowIso();
  const next = [
    ...current,
    ...items.map((it) => ({
      ...it,
      updated_at: it.updated_at ?? now,
      deleted_at: null,
      remote_synced_at: null,
    })),
  ];
  await writeArray(CLOTHES_KEY, next);
}

export async function updateClothing(
  id: string,
  patch: Partial<Clothing>
): Promise<void> {
  const current = await readAllClothes();
  const now = nowIso();
  const next = current.map((c) =>
    c.id === id
      ? {
          ...c,
          ...patch,
          id: c.id,
          updated_at: now,
          remote_synced_at: null,
        }
      : c
  );
  await writeArray(CLOTHES_KEY, next);
}

export async function deleteClothing(id: string): Promise<void> {
  // soft delete — row 는 유지하고 deleted_at 만 set. sync push 가 서버에도 전달.
  const current = await readAllClothes();
  const now = nowIso();
  const next = current.map((c) =>
    c.id === id
      ? {
          ...c,
          deleted_at: now,
          updated_at: now,
          remote_synced_at: null,
        }
      : c
  );
  await writeArray(CLOTHES_KEY, next);
}

export async function markClothingSynced(
  id: string,
  syncedAt: string = nowIso()
): Promise<void> {
  const current = await readAllClothes();
  const next = current.map((c) =>
    c.id === id ? { ...c, remote_synced_at: syncedAt } : c
  );
  await writeArray(CLOTHES_KEY, next);
}

function isLocalUri(uri: string | undefined | null): boolean {
  if (!uri) return false;
  return uri.startsWith('file:') || uri.startsWith('content:');
}

/** sync pull 시 서버 row 를 로컬에 반영. id 매칭 시 LWW (updated_at 큰 쪽 승).
 *
 * 한 가지 예외: 로컬 imageUri 가 file:/content: 형태면 그것을 보존한다. 그래야
 * tryOn / analyze 의 multipart fetch 가 캐시된 로컬 파일을 그대로 사용할 수
 * 있고, 표시는 ClothingCard 가 어차피 remote path 도 signed URL 로 변환하니까
 * 외부적으로 동일하다. 이미지가 로컬 캐시에 있을 때 굳이 remote path 로 바꾸면
 * 모든 fetch 가 (signed URL 받기 + 다운로드) 한 번 더 거쳐야 하는 비용도 줄어듦.
 */
export async function upsertClothesFromRemote(remoteRows: Clothing[]): Promise<void> {
  const current = await readAllClothes();
  const byId = new Map(current.map((c) => [c.id, c]));
  for (const remote of remoteRows) {
    const local = byId.get(remote.id);
    if (!local) {
      byId.set(remote.id, { ...remote, remote_synced_at: remote.updated_at ?? null });
      continue;
    }
    const localTs = local.updated_at ?? '';
    const remoteTs = remote.updated_at ?? '';
    if (remoteTs > localTs) {
      byId.set(remote.id, {
        ...local,
        ...remote,
        imageUri: isLocalUri(local.imageUri) ? local.imageUri : remote.imageUri,
        remote_synced_at: remoteTs || nowIso(),
      });
    }
  }
  await writeArray(CLOTHES_KEY, Array.from(byId.values()));
}

// ============================================================================
// fittings
// ============================================================================

async function readAllFittings(): Promise<FittingResult[]> {
  const items = await readArray<FittingResult>(FITTINGS_KEY);
  return items.map(withDefaultMeta);
}

export async function getFittings(): Promise<FittingResult[]> {
  return (await readAllFittings()).filter((f) => !f.deleted_at);
}

export async function getAllFittingsIncludingDeleted(): Promise<FittingResult[]> {
  return readAllFittings();
}

export async function addFitting(item: FittingResult): Promise<void> {
  const current = await readAllFittings();
  const now = nowIso();
  await writeArray(FITTINGS_KEY, [
    ...current,
    {
      ...item,
      updated_at: item.updated_at ?? now,
      deleted_at: null,
      remote_synced_at: null,
    },
  ]);
}

export async function deleteFitting(id: string): Promise<void> {
  const current = await readAllFittings();
  const now = nowIso();
  const next = current.map((f) =>
    f.id === id
      ? { ...f, deleted_at: now, updated_at: now, remote_synced_at: null }
      : f
  );
  await writeArray(FITTINGS_KEY, next);
}

export async function markFittingSynced(
  id: string,
  syncedAt: string = nowIso()
): Promise<void> {
  const current = await readAllFittings();
  const next = current.map((f) =>
    f.id === id ? { ...f, remote_synced_at: syncedAt } : f
  );
  await writeArray(FITTINGS_KEY, next);
}

export async function upsertFittingsFromRemote(
  remoteRows: FittingResult[]
): Promise<void> {
  const current = await readAllFittings();
  const byId = new Map(current.map((f) => [f.id, f]));
  for (const remote of remoteRows) {
    const local = byId.get(remote.id);
    if (!local) {
      byId.set(remote.id, { ...remote, remote_synced_at: remote.updated_at ?? null });
      continue;
    }
    const localTs = local.updated_at ?? '';
    const remoteTs = remote.updated_at ?? '';
    if (remoteTs > localTs) {
      byId.set(remote.id, {
        ...local,
        ...remote,
        // clothes 와 같은 이유로 로컬 file URI 는 보존 — multipart fetch 안정성.
        resultImageUri: isLocalUri(local.resultImageUri)
          ? local.resultImageUri
          : remote.resultImageUri,
        remote_synced_at: remoteTs || nowIso(),
      });
    }
  }
  await writeArray(FITTINGS_KEY, Array.from(byId.values()));
}

// ============================================================================
// user profile
// ============================================================================

export async function getUserProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return { personImageUri: null };
  try {
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      personImageUri: parsed.personImageUri ?? null,
      updated_at: parsed.updated_at,
      deleted_at: parsed.deleted_at ?? null,
      remote_synced_at: parsed.remote_synced_at ?? null,
    };
  } catch {
    return { personImageUri: null };
  }
}

export async function setPersonImage(uri: string | null): Promise<void> {
  const prev = await getUserProfile();
  const profile: UserProfile = {
    personImageUri: uri,
    updated_at: nowIso(),
    deleted_at: prev.deleted_at ?? null,
    remote_synced_at: null,
  };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function markProfileSynced(
  syncedAt: string = nowIso()
): Promise<void> {
  const prev = await getUserProfile();
  const next: UserProfile = {
    ...prev,
    remote_synced_at: syncedAt,
  };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
}

export async function applyRemoteProfile(remote: UserProfile): Promise<void> {
  const local = await getUserProfile();
  const localTs = local.updated_at ?? '';
  const remoteTs = remote.updated_at ?? '';
  if (!localTs || remoteTs > localTs) {
    // 로컬에 file:// 캐시가 있으면 보존 — clothes/fittings 와 같은 이유.
    // person camera 화면이 그 file:// 를 그대로 Image 에 넘기므로 remote path
    // 로 덮어쓰면 표시되지 않는다.
    const personImageUri = isLocalUri(local.personImageUri)
      ? local.personImageUri
      : remote.personImageUri;
    await AsyncStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        ...remote,
        personImageUri,
        remote_synced_at: remoteTs || nowIso(),
      })
    );
  }
}

// ============================================================================
// 전체 클리어 — signOut 시 호출.
// ============================================================================

export async function clearAllLocal(): Promise<void> {
  await AsyncStorage.multiRemove([CLOTHES_KEY, FITTINGS_KEY, PROFILE_KEY]);
}
