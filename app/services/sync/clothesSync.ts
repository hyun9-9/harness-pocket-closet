import {
  listClothesSince,
  type RemoteClothing,
  upsertClothesRemote,
} from '../api';
import {
  getAllClothesIncludingDeleted,
  markClothingSynced,
  upsertClothesFromRemote,
} from '../storage';
import type { Category, Clothing } from '../../types';
import { uploadClothingImage } from './imageUpload';

function isPushPending(c: Clothing): boolean {
  if (!c.remote_synced_at) return true;
  if (c.updated_at && c.updated_at > c.remote_synced_at) return true;
  return false;
}

function isLocalImageUri(uri: string | undefined | null): boolean {
  if (!uri) return false;
  return uri.startsWith('file:') || uri.startsWith('content:');
}

function nowIso(): string {
  return new Date().toISOString();
}

function toRemote(c: Clothing, imageUrl: string): RemoteClothing {
  return {
    id: c.id,
    image_url: imageUrl,
    category: c.category,
    colors: c.colors,
    material: c.material,
    tags: c.tags,
    created_at: c.createdAt
      ? new Date(c.createdAt).toISOString()
      : undefined,
    updated_at: c.updated_at,
    deleted_at: c.deleted_at ?? null,
  };
}

function fromRemote(r: RemoteClothing): Clothing {
  return {
    id: r.id,
    imageUri: r.image_url ?? '',
    category: (r.category as Category) ?? '상의',
    colors: r.colors ?? [],
    material: r.material ?? '',
    tags: r.tags ?? [],
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    updated_at: r.updated_at ?? undefined,
    deleted_at: r.deleted_at ?? null,
    remote_synced_at: r.updated_at ?? null,
  };
}

export async function pushPendingClothes(): Promise<{ pushed: number }> {
  const all = await getAllClothesIncludingDeleted();
  const pending = all.filter(isPushPending);
  if (pending.length === 0) return { pushed: 0 };

  const items: RemoteClothing[] = [];
  for (const c of pending) {
    let imageUrl = c.imageUri;
    // 살아있는 row 의 이미지가 로컬 URI 면 업로드 후 remote path 로 교체.
    if (!c.deleted_at && isLocalImageUri(imageUrl)) {
      try {
        const { remotePath } = await uploadClothingImage(imageUrl);
        imageUrl = remotePath;
      } catch (e) {
        // 이 row 의 이미지 업로드 실패 — 이번 push 에서 건너뛰고 다음 기회에 재시도.
        continue;
      }
    }
    items.push(toRemote(c, imageUrl ?? ''));
  }

  if (items.length === 0) return { pushed: 0 };

  await upsertClothesRemote(items);

  const syncedAt = nowIso();
  for (const it of items) {
    await markClothingSynced(it.id, syncedAt);
  }
  return { pushed: items.length };
}

export async function pullRemoteClothes(): Promise<{ pulled: number }> {
  const all = await getAllClothesIncludingDeleted();
  const sinces = all
    .map((c) => c.remote_synced_at)
    .filter((s): s is string => !!s);
  const since = sinces.length > 0 ? sinces.sort().pop() : undefined;

  const remoteRows = await listClothesSince(since);
  if (remoteRows.length === 0) return { pulled: 0 };

  await upsertClothesFromRemote(remoteRows.map(fromRemote));
  return { pulled: remoteRows.length };
}

export async function syncClothes(): Promise<{ pushed: number; pulled: number }> {
  const push = await pushPendingClothes();
  const pull = await pullRemoteClothes();
  return { pushed: push.pushed, pulled: pull.pulled };
}
