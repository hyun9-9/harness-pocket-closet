import type { Session, User } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
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

// OAuth 진행 후 in-app browser 가 자동으로 닫히고 앱으로 돌아오도록.
// 모듈 import 시 1회 호출되어야 한다 — 누락 시 redirect 됐어도 브라우저가
// 멈춘 것처럼 보임.
WebBrowser.maybeCompleteAuthSession();

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
    const redirectUrl = makeRedirectUri({
      scheme: 'pocketcloset',
      path: 'auth/callback',
      preferLocalhost: true,
    });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('OAuth URL 을 받지 못했습니다');

    // 일부 안드로이드 환경에서 Custom Tabs 가 exp:// deep link 도착 시 자동
    // close 되지 않는다. WebBrowser 의 결과와 Linking 'url' 이벤트 둘 다
    // 기다려서 먼저 도착하는 쪽으로 진행한다.
    let resolveDeepLink: (url: string) => void = () => {};
    const deepLinkPromise = new Promise<string>((resolve) => {
      resolveDeepLink = resolve;
    });
    const linkingSub = Linking.addEventListener('url', (event) => {
      if (event?.url) resolveDeepLink(event.url);
    });
    const wbPromise = WebBrowser.openAuthSessionAsync(data.url, redirectUrl).then(
      (r) => {
        if (r.type === 'success' && r.url) return r.url;
        throw new Error('로그인이 취소되었습니다');
      }
    );

    let resultUrl: string;
    try {
      resultUrl = await Promise.race([wbPromise, deepLinkPromise]);
    } finally {
      linkingSub.remove();
      try {
        await WebBrowser.dismissAuthSession();
      } catch {
        // noop — 이미 닫혔거나 지원 안 하는 플랫폼
      }
    }

    // PKCE flow: redirect URL 에 ?code=<authorization_code> 가 옴.
    const queryStr = resultUrl.split('?')[1]?.split('#')[0] ?? '';
    const params = new URLSearchParams(queryStr);
    const code = params.get('code');
    if (!code) {
      throw new Error('redirect URL 에서 code 를 찾지 못했습니다');
    }

    const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exchErr) throw exchErr;
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
