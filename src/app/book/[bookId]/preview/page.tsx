'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Book, Page, BookStatus } from '@prisma/client'; // Assuming prisma client types are available
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight, Library, Download } from 'lucide-react'; // Removed CheckCircle as it wasn't used
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import BookPageGallery from '@/components/book/BookPageGallery'; // Import the new component
import FlipbookViewer, { FlipbookActions } from '@/components/book/FlipbookViewer'; // Import FlipbookViewer and FlipbookActions type
import { toast } from 'sonner'; // Import toast for feedback

// Define a type for the book data we expect, including pages
type BookWithPages = Book & { pages: Page[] };

// Placeholder for a server action or API route call
async function fetchBookData(bookId: string): Promise<BookWithPages | null> {
  // In a real app, this would fetch from your backend
  // Replace with your actual data fetching logic (e.g., call a server action)
  // console.log(`Fetching data for bookId: ${bookId}`); // Keep console.log for debugging if needed
  try {
    // Use the actual API endpoint we just created
    const response = await fetch(`/api/book/${bookId}`); 
    if (!response.ok) {
      // Handle specific errors based on status code if needed
      if (response.status === 404) {
        throw new Error('Book not found or you do not have permission.');
      } else if (response.status === 401) {
         throw new Error('Unauthorized. Please log in.');
      }
      throw new Error(`Failed to fetch book data: ${response.statusText} (Status: ${response.status})`);
    }
    const data = await response.json();
    return data as BookWithPages;
  } catch (error) {
    console.error('Error in fetchBookData:', error);
    // Re-throw the error so the component's catch block can handle it
    throw error; 
  }
}

export default function BookPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.bookId as string; // Get bookId from URL

  const [book, setBook] = useState<BookWithPages | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // Example progress state
  const [currentPageNumber, setCurrentPageNumber] = useState<number>(1); // State for selected page
  const flipbookRef = useRef<FlipbookActions>(null); // Use FlipbookActions type for ref
  // Add state for PDF export loading
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const loadBook = useCallback(async () => {
    if (!bookId) return;
    setError(null);
    try {
      const data = await fetchBookData(bookId);
      if (data) {
        setBook(data);
        // Set initial page to 1 or the first available page number
        const firstPageNum = data.pages[0]?.pageNumber ?? 1;
        // Only set initial page if the book is loaded for the first time or page number is default
        if (isLoading || currentPageNumber === 1) {
             setCurrentPageNumber(firstPageNum);
        }

        const illustratedPages = data.pages.filter(p => p.generatedImageUrl).length;
        const totalPages = data.pages.length;
        setProgress(totalPages > 0 ? (illustratedPages / totalPages) * 100 : 0);

      } else {
         setError('Book not found or failed to load.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
       if (isLoading) {
           setIsLoading(false);
       }
    }
  // Update dependencies for useCallback
  }, [bookId, isLoading, currentPageNumber]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (book?.status === BookStatus.ILLUSTRATING) {
      intervalId = setInterval(() => {
        console.log('Polling for book status...');
        loadBook();
      }, 5000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [book?.status, loadBook]);

  // Handler for selecting a page from the gallery
  const handlePageSelect = (pageNumber: number) => {
    setCurrentPageNumber(pageNumber);
    // Tell Flipbook instance to turn to the selected page
    // Need to access the pageFlip API via the ref passed to FlipbookViewer
    // This assumes FlipbookViewer exposes its internal ref or a method to control it.
    // We will need to forward the ref in FlipbookViewer.
    // For now, we assume flipbookRef.current points to the pageFlip instance.
    if (flipbookRef.current?.pageFlip) { 
       // Adjust index if library is 0-based
       const pageIndex = Math.max(0, Math.min(pageNumber - 1, (book?.pages?.length ?? 1) - 1));
       flipbookRef.current.pageFlip().turnToPage(pageIndex); 
    }
  };

  // Handler for when the page changes within the Flipbook component
  const handleFlipbookPageChange = (pageNumber: number) => {
     // Update the state to keep gallery and other potential components in sync
     setCurrentPageNumber(pageNumber); 
  };

  // --- Flipbook Control Handlers --- 

  const handlePrevPage = () => {
    if (flipbookRef.current?.pageFlip) {
      flipbookRef.current.pageFlip().flipPrev();
      // onFlip event in FlipbookViewer will update currentPageNumber state
    }
  };

  const handleNextPage = () => {
    if (flipbookRef.current?.pageFlip) {
      flipbookRef.current.pageFlip().flipNext();
      // onFlip event in FlipbookViewer will update currentPageNumber state
    }
  };

  // --- PDF Export Handler ---
  const handleExportPdf = async () => {
    if (!bookId) return;
    setIsExportingPdf(true);
    toast.info("Preparing your PDF download...");

    try {
      // Trigger download by navigating to the API endpoint
      // The browser will handle the download based on Content-Disposition header
      window.location.href = `/api/book/${bookId}/export/pdf`;
      
      // It's hard to know exactly when the download starts/finishes from here.
      // We'll reset the loading state after a short delay.
      setTimeout(() => {
         if (isMountedRef.current) { // Check if component is still mounted
            setIsExportingPdf(false);
         }
      }, 3000); // Reset after 3 seconds (adjust as needed)

    } catch (error) {
      console.error("Error triggering PDF export:", error);
      toast.error("Failed to start PDF export.");
      if (isMountedRef.current) {
          setIsExportingPdf(false);
      }
    }
  };
  
  // Add isMountedRef for cleanup safety
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // --- Render Logic --- //

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading your amazing book...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen text-destructive">
        <AlertTriangle className="h-10 w-10 mb-2" />
        <p className="font-semibold">Error loading book</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!book) {
    return <div className="flex justify-center items-center min-h-screen">Book not found.</div>;
  }

  // --- Status-Based Rendering --- //

  if (book.status === BookStatus.ILLUSTRATING) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4">
         <Card className="w-full max-w-md text-center">
           <CardHeader>
             <CardTitle>Generating Illustrations...</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="mb-4 text-muted-foreground">
               Our digital artists are hard at work illustrating your story! This might take a few minutes.
             </p>
             <Progress value={progress} className="w-full mb-4" />
             <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
             <p className="text-sm text-muted-foreground mt-2">Checking for updates...</p>
           </CardContent>
         </Card>
      </div>
    );
  }

  if (book.status === BookStatus.FAILED) {
     return (
      <div className="flex flex-col justify-center items-center min-h-screen text-destructive p-4">
        <Card className="w-full max-w-md text-center border-destructive">
          <CardHeader>
             <CardTitle className="text-destructive">Illustration Failed</CardTitle>
           </CardHeader>
           <CardContent>
              <AlertTriangle className="h-8 w-8 mb-2 mx-auto" />
              <p className="mb-4">
                Something went wrong during illustration generation. Please try again later or contact support.
              </p>
           </CardContent>
         </Card>
      </div>
    );
  }

  if (book.status === BookStatus.COMPLETED) {
    const totalPages = book.pages.length;
    // Disable prev/next based on current page (adjust if library is 0-indexed)
    const canFlipPrev = currentPageNumber > 1;
    const canFlipNext = currentPageNumber < totalPages;

    return (
      <div className="container mx-auto p-4 flex flex-col h-[calc(100vh-4rem)]"> {/* Example: Adjust height */}
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h1 className="text-2xl font-bold">Preview: {book.title}</h1>
          <Link href="/library" passHref>
            <Button variant="outline">
               <Library className="mr-2 h-4 w-4" /> 
               Return to Library
            </Button>
          </Link>
        </div>
        
        {/* Gallery View */}
        <div className="mb-4 flex-shrink-0">
          <BookPageGallery
            pages={book.pages}
            bookStatus={book.status}
            currentPageNumber={currentPageNumber}
            onPageSelect={handlePageSelect}
          />
        </div>

        {/* Flipbook View - Replace placeholder */}
        <div className="flex-grow flex justify-center items-center overflow-hidden relative"> {/* Container for flipbook */}
           <FlipbookViewer
               ref={flipbookRef} // Pass ref down
               pages={book.pages}
               initialPageNumber={currentPageNumber} // Sync initial page
               onPageChange={handleFlipbookPageChange} // Sync page changes
               className="w-full h-full max-w-4xl max-h-[80vh]" // Constrain size 
           />

           {/* Floating Navigation Buttons (Optional placement) */}
           <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
             <Button 
               variant="outline" 
               size="icon" 
               onClick={handlePrevPage} 
               disabled={!canFlipPrev}
               aria-label="Previous Page"
             >
               <ChevronLeft className="h-6 w-6" />
             </Button>
           </div>
           <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
             <Button 
               variant="outline" 
               size="icon" 
               onClick={handleNextPage} 
               disabled={!canFlipNext}
               aria-label="Next Page"
             >
               <ChevronRight className="h-6 w-6" />
             </Button>
           </div>
        </div>

        {/* Footer Area with Page Number and Export */}
        <div className="mt-4 pt-2 border-t flex justify-between items-center flex-shrink-0">
          {/* Page Number Display */}
          <span className="text-sm text-muted-foreground">
            Page {currentPageNumber} of {totalPages}
          </span>
          {/* Export Button Placeholder */}
          <Button 
            variant="outline" 
            onClick={handleExportPdf} 
            disabled={isExportingPdf}
          >
            {isExportingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export PDF
          </Button> 
        </div>
      </div>
    );
  }

  // Fallback for any other status
  return (
     <div className="flex justify-center items-center min-h-screen">
       Book status is {book.status}. Preview is not available yet.
     </div>
   );
} 