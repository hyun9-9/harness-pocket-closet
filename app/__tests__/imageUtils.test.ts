jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  copyAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

import { manipulateAsync } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { v4 as uuidv4 } from 'uuid';

import {
  resizeAndSaveClothingImage,
  resizeAndSavePersonImage,
  saveFittingResultFromBase64,
  deleteImage,
} from '../services/imageUtils';

const mockManipulate = manipulateAsync as jest.MockedFunction<typeof manipulateAsync>;
const mockCopy = FileSystem.copyAsync as jest.MockedFunction<typeof FileSystem.copyAsync>;
const mockWrite = FileSystem.writeAsStringAsync as jest.MockedFunction<
  typeof FileSystem.writeAsStringAsync
>;
const mockDelete = FileSystem.deleteAsync as jest.MockedFunction<typeof FileSystem.deleteAsync>;
const mockMkdir = FileSystem.makeDirectoryAsync as jest.MockedFunction<
  typeof FileSystem.makeDirectoryAsync
>;
const mockGetInfo = FileSystem.getInfoAsync as jest.MockedFunction<
  typeof FileSystem.getInfoAsync
>;
const mockUuid = uuidv4 as unknown as jest.Mock<string, []>;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetInfo.mockResolvedValue({ exists: false } as any);
  mockUuid.mockReturnValue('uuid-123');
});

describe('resizeAndSaveClothingImage', () => {
  it('manipulateAsync 를 width:1024 로 호출하고 clothes/<uuid>.jpg 로 저장', async () => {
    mockManipulate.mockResolvedValue({ uri: 'file:///tmp/resized.jpg' } as any);

    const result = await resizeAndSaveClothingImage('file:///src.jpg');

    expect(mockManipulate).toHaveBeenCalledWith(
      'file:///src.jpg',
      [{ resize: { width: 1024 } }],
      expect.objectContaining({ format: 'jpeg' })
    );
    expect(mockCopy).toHaveBeenCalledWith({
      from: 'file:///tmp/resized.jpg',
      to: 'file:///doc/clothes/uuid-123.jpg',
    });
    expect(result).toBe('file:///doc/clothes/uuid-123.jpg');
  });

  it('디렉토리가 없으면 makeDirectoryAsync 를 호출', async () => {
    mockManipulate.mockResolvedValue({ uri: 'file:///tmp/r.jpg' } as any);

    await resizeAndSaveClothingImage('file:///src.jpg');

    expect(mockMkdir).toHaveBeenCalledWith(
      'file:///doc/clothes',
      expect.objectContaining({ intermediates: true })
    );
  });
});

describe('resizeAndSavePersonImage', () => {
  it('person.jpg 고정 파일명으로 저장', async () => {
    mockManipulate.mockResolvedValue({ uri: 'file:///tmp/p.jpg' } as any);

    const result = await resizeAndSavePersonImage('file:///person-src.jpg');

    expect(mockManipulate).toHaveBeenCalledWith(
      'file:///person-src.jpg',
      [{ resize: { width: 1024 } }],
      expect.objectContaining({ format: 'jpeg' })
    );
    expect(mockCopy).toHaveBeenCalledWith({
      from: 'file:///tmp/p.jpg',
      to: 'file:///doc/person.jpg',
    });
    expect(result).toBe('file:///doc/person.jpg');
  });
});

describe('saveFittingResultFromBase64', () => {
  it('fittings/<uuid>.jpg 에 base64 로 저장', async () => {
    const result = await saveFittingResultFromBase64('BASE64DATA');

    expect(mockWrite).toHaveBeenCalledWith(
      'file:///doc/fittings/uuid-123.jpg',
      'BASE64DATA',
      expect.objectContaining({ encoding: 'base64' })
    );
    expect(result).toBe('file:///doc/fittings/uuid-123.jpg');
  });

  it('fittings 디렉토리가 없으면 생성', async () => {
    await saveFittingResultFromBase64('B64');

    expect(mockMkdir).toHaveBeenCalledWith(
      'file:///doc/fittings',
      expect.objectContaining({ intermediates: true })
    );
  });
});

describe('deleteImage', () => {
  it('FileSystem.deleteAsync 를 idempotent 옵션으로 호출', async () => {
    await deleteImage('file:///doc/clothes/x.jpg');

    expect(mockDelete).toHaveBeenCalledWith(
      'file:///doc/clothes/x.jpg',
      expect.objectContaining({ idempotent: true })
    );
  });
});
