import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../services/api', () => ({
  listFittingsSince: jest.fn(),
  upsertFittingsRemote: jest.fn(),
  requestSignedUploadUrl: jest.fn(),
  requestSignedReadUrl: jest.fn(),
}));
jest.mock('../services/sync/imageUpload', () => ({
  uploadFittingImage: jest.fn(),
}));

import {
  addFitting,
  deleteFitting,
  getAllFittingsIncludingDeleted,
  getFittings,
} from '../services/storage';
import {
  pullRemoteFittings,
  pushPendingFittings,
} from '../services/sync/fittingsSync';
import type { FittingResult } from '../types';

const apiModule = jest.requireMock('../services/api');
const uploadModule = jest.requireMock('../services/sync/imageUpload');

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  apiModule.listFittingsSince.mockResolvedValue([]);
  apiModule.upsertFittingsRemote.mockResolvedValue({ upserted: 0 });
});

const makeFitting = (o: Partial<FittingResult> = {}): FittingResult => ({
  id: 'f1',
  resultImageUri: 'file:///f1.jpg',
  clothingIds: ['c1'],
  createdAt: 1000,
  ...o,
});

describe('pushPendingFittings', () => {
  it('로컬 신규 → 이미지 업로드 + upsert + markSynced', async () => {
    uploadModule.uploadFittingImage.mockResolvedValue({
      remotePath: 'user-A/uploaded.jpg',
    });
    await addFitting(makeFitting({ id: 'a' }));

    const res = await pushPendingFittings();
    expect(res.pushed).toBe(1);
    expect(uploadModule.uploadFittingImage).toHaveBeenCalledWith('file:///f1.jpg');
    const sent = apiModule.upsertFittingsRemote.mock.calls[0][0];
    expect(sent[0].id).toBe('a');
    expect(sent[0].result_image_url).toBe('user-A/uploaded.jpg');
    expect(sent[0].clothing_ids).toEqual(['c1']);
  });

  it('이미 sync 된 row 는 push 대상 아님', async () => {
    uploadModule.uploadFittingImage.mockResolvedValue({ remotePath: 'user-A/x.jpg' });
    await addFitting(makeFitting({ id: 'a' }));
    await pushPendingFittings();
    jest.clearAllMocks();

    const res = await pushPendingFittings();
    expect(res.pushed).toBe(0);
    expect(apiModule.upsertFittingsRemote).not.toHaveBeenCalled();
  });

  it('soft delete 된 fitting 은 이미지 업로드 없이 deleted_at 만 보내 push', async () => {
    uploadModule.uploadFittingImage.mockResolvedValue({ remotePath: 'remote/x.jpg' });
    await addFitting(makeFitting({ id: 'a', resultImageUri: 'remote/x.jpg' }));
    await pushPendingFittings();
    jest.clearAllMocks();

    await deleteFitting('a');
    apiModule.upsertFittingsRemote.mockResolvedValue({ upserted: 1 });

    const res = await pushPendingFittings();
    expect(res.pushed).toBe(1);
    expect(uploadModule.uploadFittingImage).not.toHaveBeenCalled();
    const sent = apiModule.upsertFittingsRemote.mock.calls[0][0][0];
    expect(sent.deleted_at).toEqual(expect.any(String));
  });
});

describe('pullRemoteFittings', () => {
  it('서버 row 를 로컬에 반영', async () => {
    apiModule.listFittingsSince.mockResolvedValueOnce([
      {
        id: 'r1',
        result_image_url: 'user-A/r1.jpg',
        clothing_ids: ['c1', 'c2'],
        created_at: '2026-04-27T00:00:00Z',
        updated_at: '2026-04-27T00:00:00Z',
        deleted_at: null,
      },
    ]);

    const res = await pullRemoteFittings();
    expect(res.pulled).toBe(1);
    const local = await getFittings();
    expect(local).toHaveLength(1);
    expect(local[0].clothingIds).toEqual(['c1', 'c2']);
  });

  it('서버가 더 최신이면 LWW 로 덮어쓴다', async () => {
    await addFitting(makeFitting({ id: 'a', clothingIds: ['x'] }));
    const future = new Date(Date.now() + 60_000).toISOString();
    apiModule.listFittingsSince.mockResolvedValueOnce([
      {
        id: 'a',
        result_image_url: 'user-A/a.jpg',
        clothing_ids: ['y', 'z'],
        updated_at: future,
        deleted_at: null,
      },
    ]);

    await pullRemoteFittings();
    const local = (await getFittings())[0];
    expect(local.clothingIds).toEqual(['y', 'z']);
  });

  it('서버 row 가 deleted_at set 이면 로컬에 soft-delete 로 반영', async () => {
    await addFitting(makeFitting({ id: 'a' }));
    const future = new Date(Date.now() + 60_000).toISOString();
    apiModule.listFittingsSince.mockResolvedValueOnce([
      {
        id: 'a',
        result_image_url: 'user-A/a.jpg',
        clothing_ids: ['x'],
        updated_at: future,
        deleted_at: future,
      },
    ]);

    await pullRemoteFittings();
    const visible = await getFittings();
    expect(visible).toHaveLength(0);
    const all = await getAllFittingsIncludingDeleted();
    expect(all.find((f) => f.id === 'a')?.deleted_at).toEqual(future);
  });
});
