import * as Clipboard from 'expo-clipboard';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ToastContextValue {
  show: (message: string, durationMs?: number) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 2200;

type ToastState =
  | { kind: 'info'; message: string }
  | { kind: 'error'; message: string }
  | null;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const [copied, setCopied] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setToast(null);
      setCopied(false);
    });
  }, [opacity]);

  const show = useCallback(
    (msg: string, durationMs = DEFAULT_DURATION_MS) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ kind: 'info', message: msg });
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      timerRef.current = setTimeout(hide, durationMs);
    },
    [hide, opacity],
  );

  const showError = useCallback(
    (msg: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setToast({ kind: 'error', message: msg });
      setCopied(false);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    },
    [opacity],
  );

  const handleCopy = useCallback(async () => {
    if (toast?.kind !== 'error') return;
    await Clipboard.setStringAsync(toast.message);
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show, showError }), [show, showError]);

  const isError = toast?.kind === 'error';

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast !== null && (
        <Animated.View
          pointerEvents={isError ? 'box-none' : 'none'}
          style={[styles.wrap, isError ? styles.wrapError : null, { opacity }]}
        >
          <View style={[styles.box, isError ? styles.boxError : null]}>
            <ScrollView style={isError ? styles.errorScroll : undefined}>
              <Text selectable={isError} style={styles.text}>
                {toast.message}
              </Text>
            </ScrollView>
            {isError && (
              <View style={styles.actions}>
                <Pressable
                  onPress={handleCopy}
                  style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.btnText}>{copied ? '복사됨' : '복사'}</Text>
                </Pressable>
                <Pressable
                  onPress={hide}
                  style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.btnText}>닫기</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 48,
    alignItems: 'center',
    zIndex: 2000,
  },
  wrapError: {
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  box: {
    maxWidth: '86%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(17,17,17,0.9)',
  },
  boxError: {
    maxWidth: '100%',
    width: '100%',
    paddingVertical: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#b33',
  },
  errorScroll: {
    maxHeight: 320,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'left',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  btnPressed: {
    backgroundColor: '#555',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
