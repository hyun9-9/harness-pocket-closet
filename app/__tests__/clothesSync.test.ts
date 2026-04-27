import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../services/api', () => ({
  listClothesSince: jest.fn(),
  upsertClothesRemote: jest.fn(),
  requestSignedUploadUrl: jest.fn(),
  requestSignedReadUrl: jest.fn(),
}));
jest.mock('../services/sync/imageUpload', () => ({
  uploadClothingImage: jest.fn(),
}));

import {
  addClothes,
  deleteClothing,
  getAllClothesIncludingDeleted,
  getClothes,
} from '../services/storage';
import {
  pullRemoteClothes,
  pushPendingClothes,
  syncClothes,
} from '../services/sync/clothesSync';
import type { Clothing } from '../types';

const apiModule = jest.requireMock('../services/api');
const uploadModule = jest.requireMock('../services/sync/imageUpload');

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  apiModule.listClothesSince.mockResolvedValue([]);
  apiModule.upsertClothesRemote.mockResolvedValue({ upserted: 0 });
});

const makeClothing = (o: Partial<Clothing> = {}): Clothing => ({
  id: 'c1',
  imageUri: 'file:///c1.jpg',
  category: '상의',
  colors: ['white'],
  material: 'cotton',
  tags: ['basic'],
  createdAt: 1000,
  ...o,
});

describe('pushPendingClothes', () => {
  it('로컬에만 있는 신규 row 를 업로드 + upsert + markSynced', async () => {
    uploadModule.uploadClothingImage.mockResolvedValue({
      remotePath: 'user-A/uploaded.jpg',
    });
    await addClothes([makeClothing({ id: 'a' })]);

    const res = await pushPendingClothes();

    expect(res.pushed).toBe(1);
    expect(uploadModule.uploadClothingImage).toHaveBeenCalledWith('file:///c1.jpg');
    expect(apiModule.upsertClothesRemote).toHaveBeenCalledTimes(1);
    const sentItems = apiModule.upsertClothesRemote.mock.calls[0][0];
    expect(sentItems[0].id).toBe('a');
    expect(sentItems[0].image_url).toBe('user-A/uploaded.jpg');

    // markSynced 후 더 이상 pending 아님
    const all = await getAllClothesIncludingDeleted();
    expect(all[0].remote_synced_at).toEqual(expect.any(String));
  });

  it('이미 sync 된 row 는 pending 아님 (push 대상에 포함 안 됨)', async () => {
    await addClothes([makeClothing({ id: 'a' })]);
    // 사전 sync — 한번 push
    uploadModule.uploadClothingImage.mockResolvedValue({ remotePath: 'user-A/x.jpg' });
    await pushPendingClothes();
    jest.clearAllMocks();

    const res = await pushPendingClothes();
    expect(res.pushed).toBe(0);
    expect(apiModule.upsertClothesRemote).not.toHaveBeenCalled();
  });

  it('soft-delete 된 row 는 이미지 업로드 없이 deleted_at 만 보내 push', async () => {
    await addClothes([makeClothing({ id: 'a', imageUri: 'remote-only/x.jpg' })]);
    // markSynced 흉내: 직접 storage 갱신은 어렵, 그냥 push 후 다시 delete
    uploadModule.uploadClothingImage.mockResolvedValue({ remotePath: 'remote-only/x.jpg' });
    await pushPendingClothes();
    jest.clearAllMocks();

    await deleteClothing('a');

    apiModule.upsertClothesRemote.mockResolvedValue({ upserted: 1 });
    const res = await pushPendingClothes();
    expect(res.pushed).toBe(1);
    expect(uploadModule.uploadClothingImage).not.toHaveBeenCalled();
    const sent = apiModule.upsertClothesRemote.mock.calls[0][0][0];
    expect(sent.id).toBe('a');
    expect(sent.deleted_at).toEqual(expect.any(String));
  });
});

describe('pullRemoteClothes', () => {
  it('서버 row 를 로컬에 반영', async () => {
    apiModule.listClothesSince.mockResolvedValueOnce([
      {
        id: 'r1',
        image_url: 'user-A/r1.jpg',
        category: '하의',
        colors: ['blue'],
        material: 'denim',
        tags: ['basic'],
        created_at: '2026-04-27T00:00:00Z',
        updated_at: '2026-04-27T00:00:00Z',
        deleted_at: null,
      },
    ]);

    const res = await pullRemoteClothes();
    expect(res.pulled).toBe(1);

    const local = await getClothes();
    expect(local).toHaveLength(1);
    expect(local[0]).toMatchObject({
      id: 'r1',
      imageUri: 'user-A/r1.jpg',
      category: '하의',
    });
    expect(local[0].remote_synced_at).toBe('2026-04-27T00:00:00Z');
  });

  it('서버 row 가 동일 id 의 로컬보다 최신이면 덮어쓴다 (LWW)', async () => {
    await addClothes([makeClothing({ id: 'a', material: 'cotton' })]);
    const future = new Date(Date.now() + 60_000).toISOString();
    apiModule.listClothesSince.mockResolvedValueOnce([
      {
        id: 'a',
        image_url: 'user-A/a.jpg',
        category: '상의',
        colors: ['white'],
        material: 'wool',
        tags: ['basic'],
        updated_at: future,
        deleted_at: null,
      },
    ]);

    await pullRemoteClothes();
    const local = (await getClothes())[0];
    expect(local.material).toBe('wool');
  });
});

describe('syncClothes', () => {
  it('push → pull 순서로 동작', async () => {
    apiModule.listClothesSince.mockResolvedValue([]);
    apiModule.upsertClothesRemote.mockResolvedValue({ upserted: 0 });

    const res = await syncClothes();
    expect(res).toEqual({ pushed: 0, pulled: 0 });
  });
});
