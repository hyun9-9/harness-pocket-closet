import {
  listFittingsSince,
  type RemoteFitting,
  upsertFittingsRemote,
} from '../api';
import {
  getAllFittingsIncludingDeleted,
  markFittingSynced,
  upsertFittingsFromRemote,
} from '../storage';
import type { FittingResult } from '../../types';
import { uploadFittingImage } from './imageUpload';

function isPushPending(f: FittingResult): boolean {
  if (!f.remote_synced_at) return true;
  if (f.updated_at && f.updated_at > f.remote_synced_at) return true;
  return false;
}

function isLocalImageUri(uri: string | undefined | null): boolean {
  if (!uri) return false;
  return uri.startsWith('file:') || uri.startsWith('content:');
}

function nowIso(): string {
  return new Date().toISOString();
}

function toRemote(f: FittingResult, imageUrl: string): RemoteFitting {
  return {
    id: f.id,
    result_image_url: imageUrl,
    clothing_ids: f.clothingIds,
    created_at: f.createdAt
      ? new Date(f.createdAt).toISOString()
      : undefined,
    updated_at: f.updated_at,
    deleted_at: f.deleted_at ?? null,
  };
}

function fromRemote(r: RemoteFitting): FittingResult {
  return {
    id: r.id,
    resultImageUri: r.result_image_url ?? '',
    clothingIds: r.clothing_ids ?? [],
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    updated_at: r.updated_at ?? undefined,
    deleted_at: r.deleted_at ?? null,
    remote_synced_at: r.updated_at ?? null,
  };
}

export async function pushPendingFittings(): Promise<{ pushed: number }> {
  const all = await getAllFittingsIncludingDeleted();
  const pending = all.filter(isPushPending);
  if (pending.length === 0) return { pushed: 0 };

  const items: RemoteFitting[] = [];
  for (const f of pending) {
    let imageUrl = f.resultImageUri;
    if (!f.deleted_at && isLocalImageUri(imageUrl)) {
      try {
        const { remotePath } = await uploadFittingImage(imageUrl);
        imageUrl = remotePath;
      } catch {
        continue;
      }
    }
    items.push(toRemote(f, imageUrl ?? ''));
  }
  if (items.length === 0) return { pushed: 0 };

  await upsertFittingsRemote(items);
  const syncedAt = nowIso();
  for (const it of items) {
    await markFittingSynced(it.id, syncedAt);
  }
  return { pushed: items.length };
}

export async function pullRemoteFittings(): Promise<{ pulled: number }> {
  const all = await getAllFittingsIncludingDeleted();
  const sinces = all
    .map((f) => f.remote_synced_at)
    .filter((s): s is string => !!s);
  const since = sinces.length > 0 ? sinces.sort().pop() : undefined;

  const remoteRows = await listFittingsSince(since);
  if (remoteRows.length === 0) return { pulled: 0 };

  await upsertFittingsFromRemote(remoteRows.map(fromRemote));
  return { pulled: remoteRows.length };
}

export async function syncFittings(): Promise<{ pushed: number; pulled: number }> {
  const push = await pushPendingFittings();
  const pull = await pullRemoteFittings();
  return { pushed: push.pushed, pulled: pull.pulled };
}
