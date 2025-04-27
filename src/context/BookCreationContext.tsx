"use client";

import React, { useState, createContext, useContext, ReactNode } from 'react';
// Import types needed by BookData - adjust path if necessary
import { BookStatus } from '@prisma/client';

// --- Type Definitions ---
// Keep type definitions needed by the context together
type Asset = {
  id: string;
  thumbnailUrl: string; // Assuming this is the only field needed from Asset
};
type PageCount = 8 | 12 | 16;
type EditorSettings = {
  bookTitle: string;
  childName: string;
  artStyle: string;
  storyTone: string;
  theme?: string;
  people?: string;
  objects?: string;
  excitementElement?: string;
  isDoubleSpread: boolean;
};

export interface BookData {
    bookId: string;
    assets: Asset[]; // Array of simplified Asset objects
    // Consider if pages should store more data from the Page model if needed later
    pages: null | { id: string; text: string | null; generatedImageUrl?: string | null }[];
    settings: EditorSettings & { pageLength: PageCount };
    status?: BookStatus | null;
}

interface BookCreationContextType {
  bookData: BookData | null;
  setBookData: (data: BookData | null) => void;
}
// --- End Type Definitions ---

// --- Context Definition & Provider ---
const BookCreationContext = createContext<BookCreationContextType | undefined>(undefined);

// Provider Component - Export this
export const BookCreationProvider = ({ children }: { children: ReactNode }) => {
  const [bookData, setBookData] = useState<BookData | null>(null);
  return (
    <BookCreationContext.Provider value={{ bookData, setBookData }}>
      {children}
    </BookCreationContext.Provider>
  );
};

// Custom Hook - Export this
export const useBookCreation = () => {
  const context = useContext(BookCreationContext);
  if (!context) {
    // Update error message to reflect new location
    throw new Error('useBookCreation must be used within a BookCreationProvider');
  }
  return context;
}; 