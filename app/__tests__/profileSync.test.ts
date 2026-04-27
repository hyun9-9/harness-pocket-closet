import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../services/api', () => ({
  getRemoteProfile: jest.fn(),
  upsertRemoteProfile: jest.fn(),
  requestSignedUploadUrl: jest.fn(),
  requestSignedReadUrl: jest.fn(),
}));
jest.mock('../services/sync/imageUpload', () => ({
  uploadPersonImage: jest.fn(),
}));

import { getUserProfile, setPersonImage } from '../services/storage';
import {
  pullProfile,
  pushProfile,
} from '../services/sync/profileSync';

const apiModule = jest.requireMock('../services/api');
const uploadModule = jest.requireMock('../services/sync/imageUpload');

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  apiModule.getRemoteProfile.mockResolvedValue(null);
  apiModule.upsertRemoteProfile.mockResolvedValue({});
});

describe('pushProfile', () => {
  it('로컬에 personImage 가 있으면 업로드 + upsertRemoteProfile 호출', async () => {
    uploadModule.uploadPersonImage.mockResolvedValue({
      remotePath: 'user-A/me.jpg',
    });
    await setPersonImage('file:///me.jpg');

    const res = await pushProfile();
    expect(res.pushed).toBe(true);
    expect(uploadModule.uploadPersonImage).toHaveBeenCalledWith('file:///me.jpg');
    const sent = apiModule.upsertRemoteProfile.mock.calls[0][0];
    expect(sent.person_image_url).toBe('user-A/me.jpg');
  });

  it('이미 sync 된 상태면 push 대상 아님', async () => {
    uploadModule.uploadPersonImage.mockResolvedValue({ remotePath: 'user-A/me.jpg' });
    await setPersonImage('file:///me.jpg');
    await pushProfile();
    jest.clearAllMocks();

    const res = await pushProfile();
    expect(res.pushed).toBe(false);
    expect(apiModule.upsertRemoteProfile).not.toHaveBeenCalled();
  });
});

describe('pullProfile', () => {
  it('서버 profile 을 로컬에 적용', async () => {
    apiModule.getRemoteProfile.mockResolvedValueOnce({
      user_id: 'user-A',
      person_image_url: 'user-A/me.jpg',
      updated_at: '2026-04-27T00:00:00Z',
      deleted_at: null,
    });

    const res = await pullProfile();
    expect(res.pulled).toBe(true);
    const local = await getUserProfile();
    expect(local.personImageUri).toBe('user-A/me.jpg');
  });

  it('서버에 row 가 없으면 pull 안 함', async () => {
    apiModule.getRemoteProfile.mockResolvedValueOnce(null);
    const res = await pullProfile();
    expect(res.pulled).toBe(false);
  });

  it('로컬이 더 최신이면 LWW 로 서버 값 무시', async () => {
    await setPersonImage('file:///local.jpg'); // updated_at = now
    apiModule.getRemoteProfile.mockResolvedValueOnce({
      person_image_url: 'old/remote.jpg',
      updated_at: '2020-01-01T00:00:00Z',
    });
    await pullProfile();
    const local = await getUserProfile();
    expect(local.personImageUri).toBe('file:///local.jpg');
  });
});
