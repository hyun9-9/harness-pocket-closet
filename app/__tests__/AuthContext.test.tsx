import * as React from 'react';
// @ts-ignore — types declaration not installed; jest-expo provides runtime
import { act, create } from 'react-test-renderer';

// AuthContext 가 import 하는 services/* 를 격리. 이 mock 들은 import 시점에 평가된다.
jest.mock('../services/supabase', () => {
  const onChangeCallbacks: ((event: string, session: any) => void)[] = [];
  return {
    supabase: {
      auth: {
        getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
        onAuthStateChange: jest.fn((cb: any) => {
          onChangeCallbacks.push(cb);
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }),
        setSession: jest.fn(() => Promise.resolve({ data: {}, error: null })),
        signOut: jest.fn(() => Promise.resolve({ error: null })),
        signInWithOAuth: jest.fn(),
        signInWithPassword: jest.fn(),
      },
    },
    __triggerAuthChange: (event: string, session: any) => {
      onChangeCallbacks.forEach((cb) => cb(event, session));
    },
  };
});

jest.mock('../services/api', () => ({
  bootstrapUser: jest.fn(() => Promise.resolve({ user_id: 'u', created: true })),
  requestSignedUploadUrl: jest.fn(),
  requestSignedReadUrl: jest.fn(),
}));

jest.mock('../services/storage', () => ({
  clearAllLocal: jest.fn(() => Promise.resolve()),
}));

// imports after mocks
import { AuthProvider, useAuth } from '../contexts/AuthContext';
const supabaseModule = jest.requireMock('../services/supabase');
const storageModule = jest.requireMock('../services/storage');

let captured: ReturnType<typeof useAuth> | null = null;

function Probe() {
  captured = useAuth();
  return null;
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  captured = null;
  jest.clearAllMocks();
  // default: getSession null
  supabaseModule.supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
});

test('mount with no session leaves user null and loading false', async () => {
  let renderer: any;
  await act(async () => {
    renderer = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  await flushAsync();

  expect(captured!.user).toBeNull();
  expect(captured!.session).toBeNull();
  expect(captured!.loading).toBe(false);

  await act(async () => {
    renderer.unmount();
  });
});

test('mount with existing session exposes user', async () => {
  const fakeSession = {
    access_token: 'tok',
    refresh_token: 'rt',
    user: { id: 'user-42', email: 'me@x.com' },
  } as any;
  supabaseModule.supabase.auth.getSession.mockResolvedValueOnce({
    data: { session: fakeSession },
  });

  let renderer: any;
  await act(async () => {
    renderer = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  await flushAsync();

  expect(captured!.user?.id).toBe('user-42');
  expect(captured!.user?.email).toBe('me@x.com');
  expect(captured!.loading).toBe(false);

  await act(async () => {
    renderer.unmount();
  });
});

test('onAuthStateChange callback updates state', async () => {
  let renderer: any;
  await act(async () => {
    renderer = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  await flushAsync();

  expect(captured!.user).toBeNull();

  await act(async () => {
    supabaseModule.__triggerAuthChange('SIGNED_IN', {
      access_token: 'tok',
      refresh_token: 'rt',
      user: { id: 'user-7', email: 'a@b.com' },
    });
  });
  await flushAsync();

  expect(captured!.user?.id).toBe('user-7');

  await act(async () => {
    renderer.unmount();
  });
});

test('signOut clears local cache and supabase session', async () => {
  let renderer: any;
  await act(async () => {
    renderer = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  await flushAsync();

  await act(async () => {
    await captured!.signOut();
  });

  expect(supabaseModule.supabase.auth.signOut).toHaveBeenCalled();
  expect(storageModule.clearAllLocal).toHaveBeenCalled();
  expect(captured!.user).toBeNull();
  expect(captured!.session).toBeNull();

  await act(async () => {
    renderer.unmount();
  });
});
