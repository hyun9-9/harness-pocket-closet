import * as ImagePicker from 'expo-image-picker';

export async function pickImagesFromGallery(max = 5): Promise<string[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('갤러리 권한이 필요합니다');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: max,
    quality: 1,
  });

  if (result.canceled || !result.assets) return [];
  return result.assets.slice(0, max).map((a) => a.uri);
}

export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new Error('카메라 권한이 필요합니다');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  return result.assets[0].uri;
}
