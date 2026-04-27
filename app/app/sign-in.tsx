import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { useToast } from '../components/ToastContext';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

const isMockEnabled =
  __DEV__ && process.env.EXPO_PUBLIC_DEV_MOCK_AUTH === 'true';

export default function SignInScreen() {
  const { signInWithGoogle, signInWithMockDev } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<'none' | 'google' | 'mock'>('none');

  const handleGoogle = async () => {
    if (busy !== 'none') return;
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (e: any) {
      toast.showError(e?.message ?? '로그인에 실패했습니다');
    } finally {
      setBusy('none');
    }
  };

  const handleMock = async () => {
    if (busy !== 'none') return;
    setBusy('mock');
    try {
      await signInWithMockDev();
    } catch (e: any) {
      toast.showError(e?.message ?? 'mock 로그인에 실패했습니다');
    } finally {
      setBusy('none');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.title}>주머니 속 옷장</Text>
        <Text style={styles.subtitle}>입어보고, 추천받고, 클라우드에 동기화</Text>
      </View>

      <View style={styles.buttons}>
        <Button
          label={busy === 'google' ? '로그인 중...' : 'Google 로 계속하기'}
          onPress={handleGoogle}
          variant="primary"
          fullWidth
          disabled={busy !== 'none'}
        />
        {busy === 'google' && (
          <ActivityIndicator style={styles.spinner} color={theme.point} />
        )}

        {isMockEnabled && (
          <Pressable
            onPress={handleMock}
            disabled={busy !== 'none'}
            style={({ pressed }) => [
              styles.mockBtn,
              pressed && { opacity: 0.7 },
              busy !== 'none' && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.mockLabel}>
              {busy === 'mock' ? '[DEV] mock 로그인 중...' : '[DEV] mock 계정으로 로그인'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 64,
  },
  hero: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: theme.muted,
  },
  buttons: {
    gap: 16,
  },
  spinner: {
    marginTop: -8,
  },
  mockBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
  },
  mockLabel: {
    color: theme.muted,
    fontSize: 13,
  },
});
