import type { Clothing } from '../types';
import { clearAllLocal } from './storage';
import { supabase } from './supabase';
import { getReadUrl } from './sync/imageUpload';

const ANALYZE_TIMEOUT_MS = 60_000;
const DETECT_MULTI_TIMEOUT_MS = 60_000;
const RECOMMEND_TIMEOUT_MS = 30_000;
const TRYON_TIMEOUT_MS = 60_000;
const JSON_TIMEOUT_MS = 30_000;

export type Bucket = 'clothes' | 'fittings' | 'person';

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

function apiBase(): string {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base) {
    throw new Error('EXPO_PUBLIC_API_URL 이 설정되지 않았습니다');
  }
  return base.replace(/\/$/, '');
}

function fileFromUri(uri: string, name: string): any {
  const lower = uri.toLowerCase();
  const type = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.webp')
    ? 'image/webp'
    : 'image/jpeg';
  return { uri, name, type };
}

const FETCHABLE_RE = /^(file|content|https?|data):/;

/** multipart fetch 가 받을 수 있는 URI 로 변환. remote path (예: user-A/abc.jpg)
 * 면 해당 bucket 의 signed read URL 을 받아 https:// URL 로. */
async function resolveFetchableUri(
  uri: string,
  bucket: Bucket
): Promise<string> {
  if (FETCHABLE_RE.test(uri)) return uri;
  return getReadUrl(bucket, uri);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } catch (e: any) {
    if (timedOut || e?.name === 'AbortError') {
      throw new Error('요청이 시간 초과되었습니다');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function ensureOk(res: Response, label: string): Promise<any> {
  if (res.status === 401) {
    // 토큰 만료 / 무효 — 강제 로그아웃 + 로컬 캐시 클리어.
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      await clearAllLocal();
    } catch {}
    throw new Error('unauthenticated');
  }
  if (!res.ok) {
    let message = `${label} 실패 (status ${res.status})`;
    try {
      const text = await res.text();
      if (text) message += `: ${text}`;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

async function postJson<T>(path: string, body: any, label: string): Promise<T> {
  const auth = await authHeaders();
  const res = await fetchWithTimeout(
    `${apiBase()}${path}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify(body ?? {}),
    },
    JSON_TIMEOUT_MS
  );
  return ensureOk(res, label);
}

async function getJson<T>(path: string, label: string): Promise<T> {
  const auth = await authHeaders();
  const res = await fetchWithTimeout(
    `${apiBase()}${path}`,
    { method: 'GET', headers: auth },
    JSON_TIMEOUT_MS
  );
  return ensureOk(res, label);
}

export interface RemoteClothing {
  id: string;
  user_id?: string;
  image_url?: string | null;
  category?: string | null;
  colors?: string[] | null;
  material?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export async function listClothesSince(since?: string): Promise<RemoteClothing[]> {
  const q = since ? `?since=${encodeURIComponent(since)}` : '';
  return getJson<RemoteClothing[]>(`/clothes${q}`, 'clothes-list');
}

export async function upsertClothesRemote(
  items: RemoteClothing[]
): Promise<{ upserted: number }> {
  return postJson('/clothes/upsert', { items }, 'clothes-upsert');
}

export interface RemoteFitting {
  id: string;
  user_id?: string;
  result_image_url?: string | null;
  clothing_ids?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export async function listFittingsSince(since?: string): Promise<RemoteFitting[]> {
  const q = since ? `?since=${encodeURIComponent(since)}` : '';
  return getJson<RemoteFitting[]>(`/fittings${q}`, 'fittings-list');
}

export async function upsertFittingsRemote(
  items: RemoteFitting[]
): Promise<{ upserted: number }> {
  return postJson('/fittings/upsert', { items }, 'fittings-upsert');
}

export interface RemoteProfile {
  user_id?: string;
  person_image_url?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export async function getRemoteProfile(): Promise<RemoteProfile | null> {
  return getJson<RemoteProfile | null>('/profile', 'profile-get');
}

export async function upsertRemoteProfile(
  body: RemoteProfile
): Promise<RemoteProfile> {
  return postJson('/profile/upsert', body, 'profile-upsert');
}

export async function bootstrapUser(): Promise<{ user_id: string; created: boolean }> {
  return postJson('/users/bootstrap', {}, 'bootstrap');
}

export async function requestSignedUploadUrl(
  bucket: Bucket,
  filename: string
): Promise<{ upload_url: string; read_path: string; expires_in: number }> {
  return postJson('/uploads/signed-url', { bucket, filename }, 'signed-upload-url');
}

export async function requestSignedReadUrl(
  bucket: Bucket,
  filename: string
): Promise<{ url: string; expires_in: number }> {
  return postJson('/uploads/signed-read-url', { bucket, filename }, 'signed-read-url');
}

export interface AnalyzeItem {
  category: string;
  colors: string[];
  material: string;
  tags: string[];
}

export interface DetectMultiItem {
  category: string;
  colors: string[];
  material: string;
  tags: string[];
  confidence: number;
  box_2d: [number, number, number, number];
}

export async function detectMultipleClothes(uri: string): Promise<DetectMultiItem[]> {
  const form = new FormData();
  form.append('file', fileFromUri(uri, 'detect.jpg'));

  const res = await fetchWithTimeout(
    `${apiBase()}/detect-multi`,
    { method: 'POST', body: form as any },
    DETECT_MULTI_TIMEOUT_MS
  );
  return ensureOk(res, 'detect-multi');
}

export async function analyzeClothes(uris: string[]): Promise<AnalyzeItem[]> {
  const form = new FormData();
  uris.forEach((uri, idx) => {
    form.append('files', fileFromUri(uri, `clothing_${idx}.jpg`));
  });

  const res = await fetchWithTimeout(
    `${apiBase()}/analyze`,
    { method: 'POST', body: form as any },
    ANALYZE_TIMEOUT_MS
  );
  return ensureOk(res, 'analyze');
}

export interface TryOnResponse {
  image_base64: string;
  mime: string;
}

export async function tryOn(
  personUri: string,
  clothingUris: string[],
  meta = '',
  stylingPrompt = ''
): Promise<TryOnResponse> {
  // 옷/사람 이미지가 remote path 면 signed URL 로 변환해 multipart 에 사용.
  // 로컬 캐시(file:) 가 있으면 그대로.
  const [resolvedPerson, resolvedClothes] = await Promise.all([
    resolveFetchableUri(personUri, 'person'),
    Promise.all(clothingUris.map((u) => resolveFetchableUri(u, 'clothes'))),
  ]);

  const form = new FormData();
  form.append('person', fileFromUri(resolvedPerson, 'person.jpg'));
  resolvedClothes.forEach((uri, idx) => {
    form.append('clothes', fileFromUri(uri, `clothing_${idx}.jpg`));
  });
  form.append('meta', meta);
  form.append('styling_prompt', stylingPrompt);

  const res = await fetchWithTimeout(
    `${apiBase()}/try-on`,
    { method: 'POST', body: form as any },
    TRYON_TIMEOUT_MS
  );
  return ensureOk(res, 'try-on');
}

export interface RecommendCombination {
  clothing_ids: string[];
  comment: string;
  styling_prompt: string;
}

export interface RecommendResponse {
  combinations: RecommendCombination[];
}

export interface RecommendClothingMeta {
  id: string;
  category: string;
  colors: string[];
  material: string;
  tags: string[];
}

function toMeta(c: Clothing | RecommendClothingMeta): RecommendClothingMeta {
  return {
    id: c.id,
    category: c.category,
    colors: c.colors,
    material: c.material,
    tags: c.tags,
  };
}

export async function recommend(
  occasion: string,
  clothes: (Clothing | RecommendClothingMeta)[]
): Promise<RecommendResponse> {
  const body = JSON.stringify({
    occasion,
    clothes: clothes.map(toMeta),
  });
  const res = await fetchWithTimeout(
    `${apiBase()}/recommend`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
    RECOMMEND_TIMEOUT_MS
  );
  return ensureOk(res, 'recommend');
}
