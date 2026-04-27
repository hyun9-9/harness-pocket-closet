import {
  getRemoteProfile,
  upsertRemoteProfile,
} from '../api';
import {
  applyRemoteProfile,
  getUserProfile,
  markProfileSynced,
} from '../storage';
import type { UserProfile } from '../../types';
import { uploadPersonImage } from './imageUpload';

function isLocalImageUri(uri: string | undefined | null): boolean {
  if (!uri) return false;
  return uri.startsWith('file:') || uri.startsWith('content:');
}

function nowIso(): string {
  return new Date().toISOString();
}

function isPushPending(p: UserProfile): boolean {
  if (!p.remote_synced_at) return true;
  if (p.updated_at && p.updated_at > p.remote_synced_at) return true;
  return false;
}

export async function pushProfile(): Promise<{ pushed: boolean }> {
  const local = await getUserProfile();
  if (!isPushPending(local)) return { pushed: false };

  let personUrl = local.personImageUri;
  if (personUrl && !local.deleted_at && isLocalImageUri(personUrl)) {
    try {
      const { remotePath } = await uploadPersonImage(personUrl);
      personUrl = remotePath;
    } catch {
      return { pushed: false };
    }
  }

  await upsertRemoteProfile({
    person_image_url: personUrl ?? null,
    updated_at: local.updated_at,
    deleted_at: local.deleted_at ?? null,
  });
  await markProfileSynced(local.updated_at ?? nowIso());
  return { pushed: true };
}

export async function pullProfile(): Promise<{ pulled: boolean }> {
  const remote = await getRemoteProfile();
  if (!remote) return { pulled: false };
  await applyRemoteProfile({
    personImageUri: remote.person_image_url ?? null,
    updated_at: remote.updated_at ?? undefined,
    deleted_at: remote.deleted_at ?? null,
    remote_synced_at: remote.updated_at ?? null,
  });
  return { pulled: true };
}

export async function syncProfile(): Promise<{
  pushed: boolean;
  pulled: boolean;
}> {
  const push = await pushProfile();
  const pull = await pullProfile();
  return { pushed: push.pushed, pulled: pull.pulled };
}
