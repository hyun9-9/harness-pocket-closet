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

const secureStorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
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
    flowType: 'implicit',
  },
});
