'use client';

import React from 'react';
import Image from 'next/image';
import { Page, BookStatus } from '@prisma/client';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming you have a utility for class names

interface BookPageGalleryProps {
  pages: Page[];
  bookStatus: BookStatus;
  currentPageNumber: number;
  onPageSelect: (pageNumber: number) => void;
}

const BookPageGallery: React.FC<BookPageGalleryProps> = ({
  pages,
  bookStatus,
  currentPageNumber,
  onPageSelect,
}) => {
  return (
    <div className="w-full overflow-x-auto bg-muted/50 p-2 rounded-md">
      <div className="flex justify-center space-x-2">
        {pages.map((page) => {
          const isActive = page.pageNumber === currentPageNumber;
          const hasImage = !!page.generatedImageUrl;

          const isPending = !hasImage && bookStatus === BookStatus.ILLUSTRATING;
          const isFailed = !hasImage && bookStatus === BookStatus.FAILED;

          return (
            <div
              key={page.id}
              className={cn(
                'flex-shrink-0 w-20 h-20 rounded-md overflow-hidden relative border-2',
                isActive ? 'border-primary' : 'border-transparent',
                'transition-all duration-200 ease-in-out',
                isFailed ? 'border-destructive/50' : ''
              )}
            >
              {hasImage && (
                <button
                  type="button"
                  onClick={() => onPageSelect(page.pageNumber)}
                  className="block w-full h-full relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md"
                  aria-label={`Select page ${page.pageNumber}`}
                >
                  <Image
                    src={page.generatedImageUrl!}
                    alt={`Page ${page.pageNumber} thumbnail`}
                    fill
                    sizes="(max-width: 768px) 10vw, 80px"
                    className={cn(
                      "object-cover hover:opacity-80 transition-opacity"
                    )}
                  />
                </button>
              )}

              {isPending && (
                 <div className="w-full h-full bg-muted flex items-center justify-center" title="Illustration pending">
                   <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                 </div>
              )}

              {isFailed && (
                 <div className="w-full h-full bg-destructive/10 flex items-center justify-center" title="Illustration failed">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                 </div>
              )}

              <div className="absolute bottom-0 left-0 bg-black/50 text-white text-xs px-1 rounded-tr-md pointer-events-none">
                 {page.pageNumber}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BookPageGallery; 