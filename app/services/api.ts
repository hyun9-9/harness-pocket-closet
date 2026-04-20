import type { Clothing } from '../types';

const ANALYZE_TIMEOUT_MS = 15_000;
const RECOMMEND_TIMEOUT_MS = 15_000;
const TRYON_TIMEOUT_MS = 30_000;

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

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function ensureOk(res: Response, label: string): Promise<any> {
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

export interface AnalyzeItem {
  category: string;
  colors: string[];
  material: string;
  tags: string[];
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
  meta = ''
): Promise<TryOnResponse> {
  const form = new FormData();
  form.append('person', fileFromUri(personUri, 'person.jpg'));
  clothingUris.forEach((uri, idx) => {
    form.append('clothes', fileFromUri(uri, `clothing_${idx}.jpg`));
  });
  form.append('meta', meta);

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
