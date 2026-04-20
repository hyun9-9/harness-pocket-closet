import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { v4 as uuidv4 } from 'uuid';

const CLOTHES_DIR = 'clothes';
const FITTINGS_DIR = 'fittings';
const PERSON_FILE = 'person.jpg';

function documentDir(): string {
  const dir = FileSystem.documentDirectory;
  if (!dir) {
    throw new Error('documentDirectory 를 사용할 수 없습니다');
  }
  return dir;
}

async function ensureDir(subdir: string): Promise<string> {
  const path = `${documentDir()}${subdir}`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
  return path;
}

async function resizeToJpeg(srcUri: string): Promise<string> {
  const result = await manipulateAsync(
    srcUri,
    [{ resize: { width: 1024 } }],
    { format: SaveFormat.JPEG, compress: 0.85 }
  );
  return result.uri;
}

export async function resizeAndSaveClothingImage(srcUri: string): Promise<string> {
  const dir = await ensureDir(CLOTHES_DIR);
  const resizedUri = await resizeToJpeg(srcUri);
  const destUri = `${dir}/${uuidv4()}.jpg`;
  await FileSystem.copyAsync({ from: resizedUri, to: destUri });
  return destUri;
}

export async function resizeAndSavePersonImage(srcUri: string): Promise<string> {
  const resizedUri = await resizeToJpeg(srcUri);
  const destUri = `${documentDir()}${PERSON_FILE}`;
  await FileSystem.copyAsync({ from: resizedUri, to: destUri });
  return destUri;
}

export async function saveFittingResultFromBase64(base64: string): Promise<string> {
  const dir = await ensureDir(FITTINGS_DIR);
  const destUri = `${dir}/${uuidv4()}.jpg`;
  await FileSystem.writeAsStringAsync(destUri, base64, { encoding: 'base64' as any });
  return destUri;
}

export async function deleteImage(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
