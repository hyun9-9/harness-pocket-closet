import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { bootstrapUser } from '../services/api';
import { clearAllLocal } from '../services/storage';
import { supabase } from '../services/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMockDev: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastBootstrappedUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
      setUser(newSession?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // 로그인 성공 직후 1회 user_profiles bootstrap.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    if (lastBootstrappedUserId.current === uid) return;
    lastBootstrappedUserId.current = uid;
    bootstrapUser().catch((e) => {
      // bootstrap 실패는 치명적이지 않음 — 다음 호출에서 재시도되도록 reset.
      lastBootstrappedUserId.current = null;
      // eslint-disable-next-line no-console
      console.warn('bootstrap failed', e);
    });
  }, [user?.id]);

  const signInWithGoogle = async () => {
    const redirectUrl = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('OAuth URL 을 받지 못했습니다');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (result.type !== 'success' || !result.url) {
      throw new Error('로그인이 취소되었습니다');
    }

    const fragment = result.url.split('#')[1] ?? result.url.split('?')[1] ?? '';
    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) {
      throw new Error('redirect URL 에서 토큰을 찾지 못했습니다');
    }

    const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (setErr) throw setErr;
  };

  const signInWithMockDev = async () => {
    const enabled = __DEV__ && process.env.EXPO_PUBLIC_DEV_MOCK_AUTH === 'true';
    if (!enabled) {
      throw new Error('mock 로그인이 비활성화돼 있습니다 (DEV + EXPO_PUBLIC_DEV_MOCK_AUTH=true 필요)');
    }
    const email = process.env.EXPO_PUBLIC_DEV_MOCK_EMAIL ?? '';
    const password = process.env.EXPO_PUBLIC_DEV_MOCK_PASSWORD ?? '';
    if (!email || !password) {
      throw new Error('app/.env 에 EXPO_PUBLIC_DEV_MOCK_EMAIL / EXPO_PUBLIC_DEV_MOCK_PASSWORD 가 비어있습니다');
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    await clearAllLocal();
    lastBootstrappedUserId.current = null;
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signInWithGoogle, signInWithMockDev, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
