jest.mock('../services/api', () => ({
  requestSignedUploadUrl: jest.fn(),
  requestSignedReadUrl: jest.fn(),
}));
jest.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));

import {
  clearReadUrlCache,
  getReadUrl,
  uploadClothingImage,
  uploadFittingImage,
} from '../services/sync/imageUpload';

const apiModule = jest.requireMock('../services/api');

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  clearReadUrlCache();
});

describe('uploadClothingImage', () => {
  it('signed URL 받아 PUT 으로 업로드 후 read_path 반환', async () => {
    apiModule.requestSignedUploadUrl.mockResolvedValueOnce({
      upload_url: 'https://example.com/signed-put',
      read_path: 'user-A/fixed-uuid.jpg',
      expires_in: 600,
    });
    // 첫 fetch (file blob)
    mockFetch.mockResolvedValueOnce({ blob: async () => 'BLOB' });
    // 두번째 fetch (PUT)
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const res = await uploadClothingImage('file:///local/c1.jpg');
    expect(res.remotePath).toBe('user-A/fixed-uuid.jpg');

    expect(apiModule.requestSignedUploadUrl).toHaveBeenCalledWith(
      'clothes',
      'fixed-uuid.jpg'
    );
    // 두 fetch call: 1) localUri blob, 2) PUT signed url
    expect(mockFetch).toHaveBeenNthCalledWith(1, 'file:///local/c1.jpg');
    const [putUrl, putInit] = mockFetch.mock.calls[1];
    expect(putUrl).toBe('https://example.com/signed-put');
    expect(putInit.method).toBe('PUT');
    expect(putInit.headers['Content-Type']).toBe('image/jpeg');
  });

  it('PUT 실패 시 throw', async () => {
    apiModule.requestSignedUploadUrl.mockResolvedValueOnce({
      upload_url: 'https://example.com/signed-put',
      read_path: 'user-A/fixed-uuid.jpg',
      expires_in: 600,
    });
    mockFetch.mockResolvedValueOnce({ blob: async () => 'BLOB' });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(uploadClothingImage('file:///x.jpg')).rejects.toThrow(/업로드 실패/);
  });
});

describe('uploadFittingImage', () => {
  it('bucket 이 fittings 로 호출된다', async () => {
    apiModule.requestSignedUploadUrl.mockResolvedValueOnce({
      upload_url: 'https://example.com/signed-put',
      read_path: 'user-A/fixed-uuid.jpg',
      expires_in: 600,
    });
    mockFetch.mockResolvedValueOnce({ blob: async () => 'BLOB' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await uploadFittingImage('file:///f1.jpg');
    expect(apiModule.requestSignedUploadUrl).toHaveBeenCalledWith(
      'fittings',
      'fixed-uuid.jpg'
    );
  });
});

describe('getReadUrl', () => {
  it('처음에는 signed read URL 을 받아오고, 두번째는 캐시 사용', async () => {
    apiModule.requestSignedReadUrl.mockResolvedValueOnce({
      url: 'https://example.com/signed-get',
      expires_in: 600,
    });

    const url1 = await getReadUrl('clothes', 'user-A/abc.jpg');
    const url2 = await getReadUrl('clothes', 'user-A/abc.jpg');

    expect(url1).toBe('https://example.com/signed-get');
    expect(url2).toBe(url1);
    expect(apiModule.requestSignedReadUrl).toHaveBeenCalledTimes(1);
    // filename 만 보냄 (user_id prefix 는 서버가 붙임)
    expect(apiModule.requestSignedReadUrl).toHaveBeenCalledWith('clothes', 'abc.jpg');
  });
});
