'use client';

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { Page } from '@prisma/client';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Loader2, AlertTriangle } from 'lucide-react';

interface FlipbookViewerProps {
  pages: Page[];
  initialPageNumber?: number;
  onPageChange?: (pageNumber: number) => void;
  className?: string;
  // Add width and height props for flexibility, or calculate based on parent
  width?: number;
  height?: number;
}

// Define the type for the imperative handle
export interface FlipbookActions {
  pageFlip: () => any; // Expose the pageFlip API instance
}

// Use forwardRef to allow passing ref from parent
const FlipbookViewer = forwardRef<FlipbookActions, FlipbookViewerProps>((
  {
    pages,
    initialPageNumber = 1,
    onPageChange,
    className,
    width = 600,
    height = 800,
  },
  ref // Receive the forwarded ref
) => {
  const flipBookInternalRef = useRef<any>(null); // Internal ref for HTMLFlipBook
  const [containerWidth, setContainerWidth] = useState<number>(width);
  const [containerHeight, setContainerHeight] = useState<number>(height);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the container div

  // Expose the pageFlip instance via the forwarded ref
  useImperativeHandle(ref, () => ({
    pageFlip: () => flipBookInternalRef.current?.pageFlip(),
  }));

  // Adjust size based on container for responsiveness
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        // Simple logic: scale based on width, maintain aspect ratio
        const newWidth = entry.contentRect.width;
        const aspectRatio = width / height;
        const newHeight = newWidth / aspectRatio;
        setContainerWidth(newWidth);
        setContainerHeight(newHeight);
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, [width, height]); // Rerun if default width/height props change

  // Handler for page flip event from the library
  const handleFlip = useCallback((e: any) => {
    // The event `e` usually contains the current page number (data)
    const currentPage = e.data; 
    console.log('Flipped to page:', currentPage);
    if (onPageChange) {
      onPageChange(currentPage + 1); // Library might be 0-indexed, adjust as needed
    }
  }, [onPageChange]);

  // Add onInit handler to turn to initial page once ready
  const handleInit = useCallback(() => {
     if (flipBookInternalRef.current && initialPageNumber) {
        // Ensure page number is within valid range (0 to pageCount - 1)
        const pageIndex = Math.max(0, Math.min(initialPageNumber - 1, pages.length - 1));
        console.log(`Flipbook initialized. Turning to initial page index: ${pageIndex}`);
        // Use a slight delay if needed, though onInit should be reliable
        // setTimeout(() => {
            try {
               flipBookInternalRef.current?.pageFlip()?.turnToPage(pageIndex);
            } catch (e) {
               console.error("Error turning page on init:", e);
            }
        // }, 0);
     }
  }, [initialPageNumber, pages.length]);

  return (
    <div ref={containerRef} className={cn("w-full flex justify-center items-center", className)} style={{ height: containerHeight }}> 
      <HTMLFlipBook
        ref={flipBookInternalRef} // Use the internal ref here
        width={containerWidth / 2} // Each page takes half the width in spread view
        height={containerHeight}
        size="stretch" // Stretch pages to fit container
        minWidth={300} // Example min width
        maxWidth={1000} // Example max width
        minHeight={400} // Example min height
        maxHeight={1200} // Example max height
        maxShadowOpacity={0.5}
        showCover={true} // Assuming the first page is a cover
        mobileScrollSupport={true}
        onFlip={handleFlip} // Call handleFlip when page turns
        onInit={handleInit} // Call handleInit when flipbook is ready
        className="shadow-lg" // Add some styling
      >
        {pages.map((page, index) => (
          <div key={page.id || index} className="bg-white border border-gray-200 flex justify-center items-center overflow-hidden">
            {/* Page content - Render Image or loading/error state */}
            {page.generatedImageUrl ? (
              <div className="relative w-full h-full">
                 <Image
                   src={page.generatedImageUrl}
                   alt={`Page ${page.pageNumber}`}
                   fill
                   sizes={`(max-width: 768px) 90vw, ${containerWidth/2}px`} // Optimize sizes
                   style={{ objectFit: 'contain' }} // Use contain to see the whole image
                   priority={index < 2} // Prioritize loading first few images
                 />
              </div>
            ) : (
              // Placeholder for loading or failed state based on book status (needs logic)
              <div className="text-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Loading page {page.pageNumber}...</p>
              </div>
            )}
            {/* You can add page numbers here if desired */}
            {/* <span className="absolute bottom-2 right-2 text-xs text-gray-500">{page.pageNumber}</span> */}
          </div>
        ))}
      </HTMLFlipBook>
    </div>
  );
});

FlipbookViewer.displayName = "FlipbookViewer"; // Add display name for DevTools

export default FlipbookViewer; 