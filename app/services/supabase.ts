import 'react-native-get-random-values';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // 즉시 throw 하면 jest mount 시점에 폭발하므로 console.warn 으로 경고만.
  // 실제 호출 시점에 supabase-js 가 명확한 에러를 낸다.
  // eslint-disable-next-line no-console
  console.warn(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았다. app/.env 를 확인하라.'
  );
}

// SecureStore 는 2KB 초과 값을 저장하지 못한다. Supabase session 토큰은
// 그보다 클 수 있으므로 chunk 로 쪼개 저장하는 어댑터 — 공식 RN 가이드 패턴.
const SECURE_CHUNK_SIZE = 2000;

async function secureGetChunked(key: string): Promise<string | null> {
  const sizeStr = await SecureStore.getItemAsync(`${key}_size`);
  if (!sizeStr) return null;
  const numChunks = parseInt(sizeStr, 10);
  if (!Number.isFinite(numChunks) || numChunks <= 0) return null;
  let result = '';
  for (let i = 0; i < numChunks; i++) {
    const part = await SecureStore.getItemAsync(`${key}_${i}`);
    if (part === null) return null;
    result += part;
  }
  return result;
}

async function secureSetChunked(key: string, value: string): Promise<void> {
  // 기존 chunk 정리 (값 길이가 줄어든 경우 잔여 chunk 제거)
  await secureRemoveChunked(key);
  const numChunks = Math.ceil(value.length / SECURE_CHUNK_SIZE);
  await SecureStore.setItemAsync(`${key}_size`, String(numChunks));
  for (let i = 0; i < numChunks; i++) {
    const chunk = value.slice(i * SECURE_CHUNK_SIZE, (i + 1) * SECURE_CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}_${i}`, chunk);
  }
}

async function secureRemoveChunked(key: string): Promise<void> {
  const sizeStr = await SecureStore.getItemAsync(`${key}_size`);
  if (sizeStr) {
    const numChunks = parseInt(sizeStr, 10);
    if (Number.isFinite(numChunks) && numChunks > 0) {
      for (let i = 0; i < numChunks; i++) {
        await SecureStore.deleteItemAsync(`${key}_${i}`);
      }
    }
  }
  await SecureStore.deleteItemAsync(`${key}_size`);
}

const secureStorageAdapter = {
  getItem: (key: string) => secureGetChunked(key),
  setItem: (key: string, value: string) => secureSetChunked(key, value),
  removeItem: (key: string) => secureRemoveChunked(key),
};

const webStorageAdapter = {
  getItem: async (key: string) =>
    typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage.getItem(key) : null,
  setItem: async (key: string, value: string) => {
    if (typeof globalThis.localStorage !== 'undefined') globalThis.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof globalThis.localStorage !== 'undefined') globalThis.localStorage.removeItem(key);
  },
};

const storageAdapter = Platform.OS === 'web' ? webStorageAdapter : secureStorageAdapter;

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storageAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    // RN 에선 deep link 로 들어온 토큰을 AuthContext 가 직접 setSession 으로 처리.
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});
