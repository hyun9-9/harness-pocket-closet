jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// uuid v14 는 ESM 으로 publish — jest transform 미지원이라 글로벌 mock.
// 개별 테스트가 별도 jest.mock('uuid', ...) 로 override 가능.
jest.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

// expo-secure-store: in-memory mock (테스트에서 SecureStore 직접 검증할 일은
// 없고, services/supabase.ts 가 import 시 native bridge 를 깨우는 걸 방지).
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    setItemAsync: jest.fn((k: string, v: string) => {
      store.set(k, v);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((k: string) => {
      store.delete(k);
      return Promise.resolve();
    }),
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => () => {
      /* unsubscribe noop */
    }),
    fetch: jest.fn(() =>
      Promise.resolve({ isConnected: true, isInternetReachable: true })
    ),
  },
}));

// @supabase/supabase-js: createClient 가 사용 가능한 더미 client 를 반환하도록.
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      setSession: jest.fn(() =>
        Promise.resolve({ data: { session: null, user: null }, error: null })
      ),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      signInWithOAuth: jest.fn(() =>
        Promise.resolve({ data: { url: 'https://example.com/oauth', provider: 'google' }, error: null })
      ),
      signInWithPassword: jest.fn(() =>
        Promise.resolve({ data: { session: null, user: null }, error: null })
      ),
    },
  }),
}));
