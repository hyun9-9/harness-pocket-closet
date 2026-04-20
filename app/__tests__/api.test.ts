process.env.EXPO_PUBLIC_API_URL = 'http://api.test';

import { analyzeClothes, tryOn, recommend } from '../services/api';

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

function jsonResponse(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('analyzeClothes', () => {
  it('POST /analyze 에 multipart 로 업로드하고 응답 JSON 을 그대로 반환', async () => {
    const respBody = [
      { category: '상의', colors: ['white'], material: 'cotton', tags: ['basic'] },
    ];
    mockFetch.mockResolvedValue(jsonResponse(respBody));

    const result = await analyzeClothes(['file:///a.jpg', 'file:///b.jpg']);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://api.test/analyze');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(result).toEqual(respBody);
  });

  it('서버 에러 시 Error 를 throw', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ detail: 'bad' }, 400));
    await expect(analyzeClothes(['file:///a.jpg'])).rejects.toThrow();
  });

  it('타임아웃 시 throw', async () => {
    mockFetch.mockImplementation((_url: string, init: any) => {
      return new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err: any = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    jest.useFakeTimers();
    const p = analyzeClothes(['file:///a.jpg']);
    jest.advanceTimersByTime(16_000);
    await expect(p).rejects.toThrow();
    jest.useRealTimers();
  });
});

describe('tryOn', () => {
  it('POST /try-on 에 multipart 로 업로드하고 { image_base64, mime } 반환', async () => {
    const respBody = { image_base64: 'BASE64', mime: 'image/jpeg' };
    mockFetch.mockResolvedValue(jsonResponse(respBody));

    const result = await tryOn('file:///p.jpg', ['file:///c.jpg'], 'hint');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://api.test/try-on');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(result).toEqual(respBody);
  });
});

describe('recommend', () => {
  it('POST /recommend 에 JSON body 로 호출하고 { combinations } 반환', async () => {
    const respBody = {
      combinations: [{ clothing_ids: ['c1'], comment: '좋습니다' }],
    };
    mockFetch.mockResolvedValue(jsonResponse(respBody));

    const clothes = [
      { id: 'c1', category: '상의', colors: ['white'], material: '', tags: [] },
    ];
    const result = await recommend('출근', clothes);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://api.test/recommend');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ occasion: '출근', clothes });
    expect(result).toEqual(respBody);
  });
});
