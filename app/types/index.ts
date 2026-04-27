import type { CATEGORIES } from '../constants/categories';
import type { OCCASIONS } from '../constants/occasions';

export type Category = (typeof CATEGORIES)[number];
export type Occasion = (typeof OCCASIONS)[number];

export type ClothingStatus = 'analyzing' | 'ready' | 'failed';

export interface SyncMeta {
  updated_at?: string;
  deleted_at?: string | null;
  remote_synced_at?: string | null;
}

export interface Clothing extends SyncMeta {
  id: string;
  imageUri: string;
  category: Category;
  colors: string[];
  material: string;
  tags: string[];
  createdAt: number;
  status?: ClothingStatus;
}

export interface FittingResult extends SyncMeta {
  id: string;
  resultImageUri: string;
  clothingIds: string[];
  createdAt: number;
}

export interface UserProfile extends SyncMeta {
  personImageUri: string | null;
}
