import type { CATEGORIES } from '../constants/categories';
import type { OCCASIONS } from '../constants/occasions';

export type Category = (typeof CATEGORIES)[number];
export type Occasion = (typeof OCCASIONS)[number];

export type ClothingStatus = 'analyzing' | 'ready' | 'failed';

export interface Clothing {
  id: string;
  imageUri: string;
  category: Category;
  colors: string[];
  material: string;
  tags: string[];
  createdAt: number;
  status?: ClothingStatus;
}

export interface FittingResult {
  id: string;
  resultImageUri: string;
  clothingIds: string[];
  createdAt: number;
}

export interface UserProfile {
  personImageUri: string | null;
}
