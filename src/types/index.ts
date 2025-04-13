/**
 * User profile information
 */
export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Book project types
 */
export type BookStatus = "draft" | "generating" | "completed";

export interface Book {
  id: string;
  title: string;
  childName: string;
  status: BookStatus;
  userId: string;
  pages: Page[];
  artStyle?: string;
  tone?: string;
  typography?: string;
  theme?: string;
  keyCharacters?: string;
  specialObjects?: string;
  excitementElement?: string;
  pageLength: number; // 8, 12, or 16
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Page model
 */
export type PageType = "single" | "spread";

export interface Page {
  id: string;
  bookId: string;
  pageNumber: number;
  originalImageUrl?: string;
  generatedImageUrl?: string;
  text?: string;
  textConfirmed?: boolean;
  pageType: PageType;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Asset model
 */
export interface Asset {
  id: string;
  userId: string;
  url: string;
  publicId: string;
  fileType: string;
  size: number;
  createdAt: Date;
}

/**
 * API response type
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
