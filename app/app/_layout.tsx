import 'react-native-get-random-values';

import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '../components/ToastContext';
import { theme } from '../constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="clothing-register" options={{ title: '옷 등록' }} />
          <Stack.Screen name="clothing-detect-review" options={{ title: '옷 인식 결과' }} />
          <Stack.Screen name="clothing/[id]" options={{ title: '옷 상세' }} />
          <Stack.Screen name="fitting-result-new" options={{ title: '피팅 결과' }} />
          <Stack.Screen name="fitting-result/[id]" options={{ title: '피팅 기록' }} />
          <Stack.Screen name="person-camera" options={{ title: '전신 사진' }} />
        </Stack>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
