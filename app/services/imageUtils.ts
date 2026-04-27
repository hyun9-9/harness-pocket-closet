import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { v4 as uuidv4 } from 'uuid';

const CLOTHES_DIR = 'clothes';
const FITTINGS_DIR = 'fittings';
const PERSON_FILE = 'person.jpg';
const CROP_DIR = 'crops';

export type Box2D = [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000

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

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err)
    );
  });
}

export async function cropAndSaveClothingImage(
  srcUri: string,
  box: Box2D,
  imageSize?: { width: number; height: number }
): Promise<string> {
  const { width, height } = imageSize ?? (await getImageSize(srcUri));
  const [ymin, xmin, ymax, xmax] = box;
  const originX = Math.max(0, Math.floor((xmin / 1000) * width));
  const originY = Math.max(0, Math.floor((ymin / 1000) * height));
  const cropW = Math.max(1, Math.min(width - originX, Math.ceil(((xmax - xmin) / 1000) * width)));
  const cropH = Math.max(1, Math.min(height - originY, Math.ceil(((ymax - ymin) / 1000) * height)));

  const cropped = await manipulateAsync(
    srcUri,
    [{ crop: { originX, originY, width: cropW, height: cropH } }, { resize: { width: 1024 } }],
    { format: SaveFormat.JPEG, compress: 0.85 }
  );
  const dir = await ensureDir(CROP_DIR);
  const destUri = `${dir}/${uuidv4()}.jpg`;
  await FileSystem.copyAsync({ from: cropped.uri, to: destUri });
  return destUri;
}
