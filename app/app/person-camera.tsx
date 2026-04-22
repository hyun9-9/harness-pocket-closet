import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { SilhouetteOverlay } from '../components/SilhouetteOverlay';
import { useToast } from '../components/ToastContext';
import { theme } from '../constants/theme';
import { resizeAndSavePersonImage } from '../services/imageUtils';
import { setPersonImage } from '../services/storage';

export default function PersonCameraScreen() {
  const router = useRouter();
  const toast = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [busy, setBusy] = useState(false);

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.mutedText}>권한 확인 중...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionText}>전신 사진 촬영을 위해 카메라 권한이 필요합니다.</Text>
        <Button label="권한 요청" onPress={requestPermission} />
      </View>
    );
  }

  const handleCapture = async () => {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (!photo?.uri) throw new Error('사진을 촬영하지 못했습니다');
      const localUri = await resizeAndSavePersonImage(photo.uri);
      await setPersonImage(localUri);
      router.back();
    } catch (e: any) {
      setBusy(false);
      toast.showError(e?.message ?? '촬영에 실패했습니다');
    }
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <SilhouetteOverlay />
      <View style={styles.guideTop}>
        <Text style={styles.guideText}>실루엣에 맞춰 전신이 담기도록 촬영하세요</Text>
      </View>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="촬영"
          onPress={handleCapture}
          disabled={busy}
          style={({ pressed }) => [
            styles.shutter,
            pressed && !busy && styles.shutterPressed,
            busy && styles.shutterDisabled,
          ]}
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg,
    padding: 24,
    gap: 16,
  },
  mutedText: { color: theme.muted },
  permissionText: { color: theme.text, textAlign: 'center', fontSize: 15 },
  guideTop: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  guideText: {
    color: '#FFFFFF',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  controls: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  shutterPressed: { opacity: 0.7 },
  shutterDisabled: { opacity: 0.5 },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
});
