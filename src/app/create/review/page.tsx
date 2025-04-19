"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useBookCreation, BookData } from '@/app/create/layout';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Define PageData locally or import from layout if type is exported there
// For now, derive from BookData to avoid duplication
type PageData = {
  id: string;
  text: string | null;
  imageUrl: string;
  assetId: string;
};

const POLLING_INTERVAL = 5000; // Check every 5 seconds

export default function ReviewPage() {
  const router = useRouter();
  const { bookData } = useBookCreation();

  // State hooks
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [confirmed, setConfirmed] = useState<boolean[]>([]);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [needsPolling, setNeedsPolling] = useState(false); // Track if polling is needed
  const [isReadyForPolling, setIsReadyForPolling] = useState(false); // Control when polling starts
  const [isSavingPage, setIsSavingPage] = useState(false); // State for save loading
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true); // Ref to track mounted state

  // Effect to track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // --- Initial Setup Logic ---
  useEffect(() => {
    // Only run setup once when bookData is available
    if (!bookData || isReadyForPolling) return; // Prevent re-running after setup

    console.log("Review Page: Initial Setup - BookData received:", bookData);

    const initialPageData = bookData.assets.map((asset: {id: string, thumbnailUrl: string}, index: number) => ({
      id: bookData.pages?.[index]?.id || '',
      text: bookData.pages?.[index]?.generatedText || null,
      imageUrl: asset.thumbnailUrl,
      assetId: asset.id,
    }));
    setPages(initialPageData);
    setConfirmed(initialPageData.map(() => false));
    setCurrentIndex(0);

    // Determine if polling is needed based on context
    if (bookData.pages) {
      console.log("Review Page: Using existing generated pages from context.");
      setNeedsPolling(false);
    } else if (bookData.bookId) {
      console.log(`Review Page: Pages not found in context, polling required for bookId: ${bookData.bookId}`);
      setNeedsPolling(true);
      setIsLoadingText(true); // Show loading state immediately if polling needed
    } else {
      console.error("Review Page: bookId missing, cannot poll.");
      toast.error("Error: Missing book identifier for review.");
      setNeedsPolling(false);
      // Optionally redirect or show error state
    }

    setIsReadyForPolling(true); // Signal that setup is complete and polling can start if needed

  }, [bookData, isReadyForPolling]); // Run only when bookData changes or setup completes

  // --- Polling Logic ---
  useEffect(() => {
    // Only start polling if setup is complete, polling is needed, and we have a bookId
    if (!isReadyForPolling || !needsPolling || !bookData?.bookId) return;

    console.log(`Review Page: Starting polling for bookId: ${bookData.bookId}`);

    const checkStatus = async () => {
      // Prevent updates if component unmounted during async ops
      if (!isMountedRef.current || !bookData.bookId) return;

      try {
        const res = await fetch(`/api/book-status?bookId=${bookData.bookId}`);
        // Prevent updates if component unmounted during fetch
        if (!isMountedRef.current) return;

        if (!res.ok) {
          throw new Error(`Failed to fetch book status (${res.status})`);
        }
        const data = await res.json();

        console.log("Poll Status:", data.status);

        if (data.status === 'COMPLETED') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          console.log("Book complete, fetching content...");

          try {
            const contentRes = await fetch(`/api/book-content?bookId=${bookData.bookId}`);
            // Prevent updates if component unmounted during fetch
            if (!isMountedRef.current) return;

            if (!contentRes.ok) throw new Error(`Failed to fetch book content (${contentRes.status})`);
            const contentData = await contentRes.json();

            if (contentData.pages && bookData?.assets) { // Ensure bookData.assets is still available
               const updatedPageData = bookData.assets.map((asset: {id: string, thumbnailUrl: string}, index: number) => ({
                   id: contentData.pages[index]?.id || '',
                   text: contentData.pages[index]?.text || '',
                   imageUrl: asset.thumbnailUrl,
                   assetId: asset.id,
               }));

               // Check if still mounted before setting state
               if (isMountedRef.current) {
                 setPages(updatedPageData);
                 console.log("Review Page: Pages state updated with fetched content:", updatedPageData);
                 toast.success("Story generation complete!");
                 setIsLoadingText(false); // Update loading state HERE after setting pages
               }
            } else {
               console.error("Fetched content missing pages data or assets unavailable:", contentData, bookData?.assets);
               throw new Error("Fetched content missing pages data or assets unavailable.");
            }
          } catch (contentError) {
            console.error("Error fetching or processing book content:", contentError);
            // Check if still mounted before setting state
            if (isMountedRef.current) {
              toast.error(`Error loading story content: ${contentError instanceof Error ? contentError.message : String(contentError)}`);
              setIsLoadingText(false);
            }
          }

        } else if (data.status === 'FAILED') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          console.error("Story generation failed.");
           // Check if still mounted before setting state
          if (isMountedRef.current) {
            toast.error("Story generation failed. Please try again.");
            setIsLoadingText(false);
          }
        } else {
           // Still GENERATING or other status, continue polling
           console.log("Review Page: Still generating, continuing poll...");
        }
      } catch (error) {
        console.error("Polling error:", error);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
         // Check if still mounted before setting state
        if (isMountedRef.current) {
          toast.error(`Error checking story status: ${error instanceof Error ? error.message : String(error)}`);
          setIsLoadingText(false);
        }
      }
    };

    // Initial check immediately after polling starts
    checkStatus();
    // Set up interval
    pollingIntervalRef.current = setInterval(checkStatus, POLLING_INTERVAL);

    // Cleanup interval on unmount or if polling is no longer needed
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        console.log("Review Page: Polling stopped.");
      }
    };
    // Dependencies: Only run when polling should start/restart
    // Added bookData?.assets as a dependency to ensure map function has data
  }, [isReadyForPolling, needsPolling, bookData?.bookId, bookData?.assets]);

  // Navigation handlers
  const goPrev = () => setCurrentIndex(i => Math.max(i - 1, 0));
  const goNext = () => setCurrentIndex(i => Math.min(i + 1, pages.length - 1));

  // Toggle confirmation per page
  const toggleConfirm = async () => {
    if (!bookData?.bookId || !pages[currentIndex]) {
      toast.error("Cannot confirm page: Missing book or page data.");
      return;
    }

    const currentPage = pages[currentIndex];
    const currentlyConfirmed = confirmed[currentIndex];

    // If currently confirmed, just un-confirm locally
    if (currentlyConfirmed) {
      setConfirmed(arr => {
        const copy = [...arr];
        copy[currentIndex] = false;
        return copy;
      });
      toast.info(`Page ${currentIndex + 1} unconfirmed.`);
      return;
    }

    // --- If currently unconfirmed, try to save and then confirm ---
    setIsSavingPage(true);
    try {
      const response = await fetch(`/api/book/${bookData.bookId}/page/${currentPage.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: currentPage.text || '' }), // Send current text
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Try to parse error
        throw new Error(errorData.error || `Failed to save page ${currentIndex + 1} (Status: ${response.status})`);
      }

      // --- Save successful, now update local confirmed state ---
      setConfirmed(arr => {
        const copy = [...arr];
        copy[currentIndex] = true; // Set to confirmed
        return copy;
      });
      toast.success(`Page ${currentIndex + 1} saved and confirmed!`);

    } catch (error) {
      console.error("Error saving page:", error);
      toast.error(`${error instanceof Error ? error.message : String(error)}`);
      // Do not change confirmed state if save failed
    } finally {
       // Ensure loading state is turned off even if component unmounted during save
       if (isMountedRef.current) { 
           setIsSavingPage(false);
       }
    }
  };

  // Regenerate Story handler
  const handleRegenerate = () => {
    if (window.confirm('Are you sure you want to regenerate the entire story? All edits will be lost.')) {
      console.log('Regenerating story...');
      // TODO: Implement actual API call for regeneration
      // For now, reset state to mimic starting polling again
      setPages(pages.map(p => ({ ...p, text: null }))); // Clear text
      setConfirmed(pages.map(() => false));
      setNeedsPolling(true); // Trigger polling start
      setIsLoadingText(true);
      setIsReadyForPolling(false); // Force re-initialization (will become true in next effect cycle)
      // Note: This simple reset might need a proper API call and state management
    }
  };

  // Keyboard arrow navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goPrev, goNext]); // Added dependencies for goPrev/goNext

  const allConfirmed = pages.length > 0 && confirmed.every(c => c);

  // Handle loading/redirect state before rendering main UI
  if (!bookData) {
      return <div className="p-6 flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading review data...</div>;
  }
  if (!isReadyForPolling) {
      return <div className="p-6 flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Initializing review page...</div>;
  }
  // Handle case where pages array might be empty if setup failed or bookData was invalid
  if (pages.length === 0 && !isLoadingText) {
      return <div className="p-6 text-red-600">Error: Could not load pages for review. Please go back and try again.</div>;
  }

  // Main Render
  return (
    <div className="flex h-[calc(100vh-var(--site-header-height)-var(--site-footer-height))] w-full">
      {/* Left Panel - Keep the image sizing fixes */}
      <div className="flex-2 p-6 bg-white flex flex-col items-center">
        {/* Page Image Container */}
        <div className="flex-grow flex items-center justify-center w-full mb-4">
          <div className="relative w-full max-w-[500px] max-h-[500px] overflow-hidden rounded-lg shadow bg-muted aspect-square">
            <Image
              src={pages[currentIndex]?.imageUrl || '/placeholder.png'} // Use optional chaining and fallback
              alt={`Page ${currentIndex + 1}`}
              fill
              className="object-contain"
              priority={true}
            />
          </div>
        </div>
        {/* Editable Text Area or Loading State */}
        {isLoadingText ? (
            <div className="w-full h-40 mb-4 rounded-md border border-input bg-background px-3 py-2 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground">Generating story text...</span>
            </div>
        ) : (
            <Textarea
              className="w-full h-40 mb-4"
              value={pages[currentIndex]?.text ?? ''} // Use optional chaining and nullish coalescing
              onChange={(e) => {
                const newText = e.target.value;
                setPages(prev => {
                  const copy = [...prev];
                  // Ensure index is valid before updating
                  if (copy[currentIndex]) {
                    copy[currentIndex] = { ...copy[currentIndex], text: newText };
                  }
                  return copy;
                });
                // Reset confirmation when text changes
                setConfirmed(prev => {
                  const copy = [...prev];
                  if (copy[currentIndex] !== undefined) {
                     copy[currentIndex] = false;
                  }
                  return copy;
                });
              }}
              readOnly={isLoadingText}
            />
        )}
        {/* Navigation and Confirm Row */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-2">
            <Button onClick={goPrev} disabled={currentIndex === 0 || isLoadingText}>Previous</Button>
            <Button onClick={goNext} disabled={currentIndex === pages.length - 1 || isLoadingText}>Next</Button>
          </div>
          <div>
            <Button 
              variant={confirmed[currentIndex] ? 'default' : 'outline'} 
              onClick={toggleConfirm} 
              disabled={isLoadingText || isSavingPage || !pages[currentIndex]} // Disable if loading text OR saving page OR page invalid
            >
              {isSavingPage ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : confirmed[currentIndex] ? (
                 'Page Confirmed' 
              ) : (
                'Confirm Page'
              )}
            </Button>
          </div>
          {/* Regenerate Story */}
          <div className="mt-4">
            <Button variant="ghost" onClick={handleRegenerate} disabled={isLoadingText}> {/* Disable regenerate if loading */}
              Regenerate Story
            </Button>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 p-6 bg-gray-100 overflow-auto">
        <h2 className="text-xl font-semibold mb-4">Review Pages ({currentIndex + 1}/{pages.length})</h2>
        <div className="space-y-2 mb-6">
          {pages.map((page: PageData, idx: number) => {
            const snippet = isLoadingText // Show generating if still loading text
              ? '(Generating...)'
              : page.text
                ? (page.text.length > 50 ? page.text.slice(0, 50) + '...' : page.text)
                : '(No text generated)'; // Indicate if text is missing after loading
            return (
              <Button
                key={page.assetId || idx} // Use assetId as key
                variant={idx === currentIndex ? 'default' : 'outline'}
                size="sm"
                className={
                  `w-full text-left p-2 rounded-lg justify-start h-auto whitespace-normal ${
                    confirmed[idx] ? 'bg-green-50 border-2 border-green-500 text-green-700 hover:bg-green-100' : 'hover:bg-accent'
                  }`
                }
                onClick={() => setCurrentIndex(idx)}
                disabled={isLoadingText} // Disable selecting other pages while loading
              >
                <span className="font-medium mr-2">{idx + 1}.</span>{snippet}
              </Button>
            );
          })}
        </div>
        {/* Illustrate button: always visible but disabled until all pages are confirmed */}
        <Button
          className="w-full"
          size="lg"
          disabled={!allConfirmed || isLoadingText} // Also disable if loading
          variant={allConfirmed ? 'default' : 'outline'}
        >
          Illustrate My Book
        </Button>
      </div>
    </div>
  );
}
