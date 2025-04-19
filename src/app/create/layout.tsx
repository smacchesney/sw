"use client"; // Layouts using context/state need to be client components

import React, { useState, createContext, useContext, ReactNode } from 'react';

// --- Type Definitions (Copied from page.tsx) ---
type Asset = {
  id: string;
  thumbnailUrl: string;
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

// Export the BookData interface
export interface BookData {
    bookId: string;
    assets: Asset[];
    pages: null | { id: string; generatedText: string }[];
    settings: EditorSettings & { pageLength: PageCount };
}

interface BookCreationContextType {
  bookData: BookData | null;
  setBookData: (data: BookData | null) => void;
}
// --- End Type Definitions ---

// --- Context Definition & Provider (Moved Here) ---
// Export the context itself
export const BookCreationContext = createContext<BookCreationContextType | undefined>(undefined);

// Export the custom hook for easy consumption
export const useBookCreation = () => {
  const context = useContext(BookCreationContext);
  if (!context) {
    throw new Error('useBookCreation must be used within a BookCreationProvider defined in CreateLayout');
  }
  return context;
};

// Provider component (doesn't need export if only used here)
const BookCreationProvider = ({ children }: { children: ReactNode }) => {
  const [bookData, setBookData] = useState<BookData | null>(null);
  return (
    <BookCreationContext.Provider value={{ bookData, setBookData }}>
      {children}
    </BookCreationContext.Provider>
  );
};
// --- End Context --- 

// Layout Component
export default function CreateLayout({ children }: { children: React.ReactNode }) {
  // Wrap all child pages (like /create and /create/review) with the provider
  return (
    <BookCreationProvider>
      {children}
    </BookCreationProvider>
  );
} 