import { v4 as uuidv4 } from 'uuid';

import {
  type Bucket,
  requestSignedReadUrl,
  requestSignedUploadUrl,
} from '../api';

const READ_CACHE = new Map<string, { url: string; expiresAt: number }>();
const READ_TTL_MS = 5 * 60 * 1000;

async function uploadImage(bucket: Bucket, localUri: string): Promise<string> {
  const filename = `${uuidv4()}.jpg`;
  const { upload_url, read_path } = await requestSignedUploadUrl(bucket, filename);

  const fileRes = await fetch(localUri);
  const blob = await fileRes.blob();

  const putRes = await fetch(upload_url, {
    method: 'PUT',
    body: blob as any,
    headers: { 'Content-Type': 'image/jpeg' },
  });
  if (!putRes.ok) {
    throw new Error(`이미지 업로드 실패 (status ${putRes.status})`);
  }
  return read_path;
}

export async function uploadClothingImage(
  localUri: string
): Promise<{ remotePath: string }> {
  return { remotePath: await uploadImage('clothes', localUri) };
}

export async function uploadFittingImage(
  localUri: string
): Promise<{ remotePath: string }> {
  return { remotePath: await uploadImage('fittings', localUri) };
}

export async function uploadPersonImage(
  localUri: string
): Promise<{ remotePath: string }> {
  return { remotePath: await uploadImage('person', localUri) };
}

/** path 의 마지막 segment 가 filename — 서버가 user_id prefix 를 자동으로 붙인다. */
function filenameFromPath(remotePath: string): string {
  return remotePath.split('/').pop() ?? remotePath;
}

export async function getReadUrl(
  bucket: Bucket,
  remotePath: string
): Promise<string> {
  const cacheKey = `${bucket}/${remotePath}`;
  const cached = READ_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const filename = filenameFromPath(remotePath);
  const { url, expires_in } = await requestSignedReadUrl(bucket, filename);
  // 만료 시간 90% 지점에 캐시 expire — 라우트 유예 시간 확보.
  const ttl = Math.max(60_000, Math.min(READ_TTL_MS, (expires_in ?? 600) * 1000 * 0.9));
  READ_CACHE.set(cacheKey, { url, expiresAt: Date.now() + ttl });
  return url;
}

export function clearReadUrlCache(): void {
  READ_CACHE.clear();
}
