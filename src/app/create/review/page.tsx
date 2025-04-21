"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useBookCreation, BookData } from '@/app/create/layout';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
// Import BookStatus enum
import { BookStatus } from '@/generated/prisma/client'; 

// Define PageData locally or import from layout if type is exported there
// For now, derive from BookData to avoid duplication
type PageData = {
  id: string;
  text: string | null;
  imageUrl: string; // Original image URL (thumbnail)
  assetId: string;
  generatedImageUrl?: string | null; // Add field for generated illustration
};

const POLLING_INTERVAL = 5000; // Check every 5 seconds

export default function ReviewPage() {
  const router = useRouter();
  const { bookData, setBookData } = useBookCreation(); // Add setBookData if needed later

  // State hooks
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [confirmed, setConfirmed] = useState<boolean[]>([]);
  const [isLoadingText, setIsLoadingText] = useState(false); // For initial story text loading
  const [needsPolling, setNeedsPolling] = useState(false); // Track if polling is needed (for text or illustrations)
  const [isReadyForPolling, setIsReadyForPolling] = useState(false); // Control when polling starts
  const [isSavingPage, setIsSavingPage] = useState(false); // State for save loading
  const [isIllustrating, setIsIllustrating] = useState(false); // State for illustration loading
  const [currentBookStatus, setCurrentBookStatus] = useState<BookStatus | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true); // Ref to track mounted state

  // Effect to track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clear interval on unmount regardless of state
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        console.log("Review Page: Polling stopped on unmount.");
      }
    };
  }, []);

  // --- Initial Setup Logic ---
  useEffect(() => {
    // Only run setup once when bookData is available
    if (!bookData || isReadyForPolling) return; 

    console.log("Review Page: Initial Setup - BookData received:", bookData);
    setCurrentBookStatus(bookData.status || null); // Initialize status

    const initialPageData = bookData.assets.map((asset: {id: string, thumbnailUrl: string}, index: number) => ({
      id: bookData.pages?.[index]?.id || '',
      text: bookData.pages?.[index]?.generatedText || null,
      imageUrl: asset.thumbnailUrl,
      assetId: asset.id,
      generatedImageUrl: bookData.pages?.[index]?.generatedImageUrl || null, // Load existing generated image if available
    }));
    setPages(initialPageData);
    setConfirmed(initialPageData.map(() => false)); // Start unconfirmed
    setCurrentIndex(0);

    // Determine if polling is needed based on book status in context
    if (bookData.status === BookStatus.GENERATING) {
      console.log(`Review Page: Status is GENERATING, polling for story text needed for bookId: ${bookData.bookId}`);
      setNeedsPolling(true);
      setIsLoadingText(true); // Show loading state immediately
    } else if (bookData.status === BookStatus.ILLUSTRATING) {
       console.log(`Review Page: Status is ILLUSTRATING, polling for illustrations needed for bookId: ${bookData.bookId}`);
       setNeedsPolling(true);
       setIsIllustrating(true); // Show illustrating state
    } else if (bookData.status === BookStatus.COMPLETED && bookData.pages?.every(p => p.generatedText)) {
      console.log("Review Page: Book is COMPLETED with text, no initial polling needed.");
      setNeedsPolling(false);
      // If COMPLETED, assume text is loaded and pages are ready for confirmation
      setIsLoadingText(false); 
      setConfirmed(initialPageData.map(() => false)); // Start confirmation process
    } else if (!bookData.bookId) {
      console.error("Review Page: bookId missing, cannot poll.");
      toast.error("Error: Missing book identifier for review.");
      setNeedsPolling(false);
    } else {
      // Default case (e.g., DRAFT or unknown state, or COMPLETED but text missing)
      // Attempt to poll if bookId exists, might fetch existing COMPLETED state
      console.log(`Review Page: Defaulting to polling for bookId: ${bookData.bookId}, Status: ${bookData.status}`);
      setNeedsPolling(true);
      setIsLoadingText(true); // Assume loading might be needed
    }

    setIsReadyForPolling(true); // Signal that setup is complete

  }, [bookData, isReadyForPolling]); // Rerun if bookData changes


  // --- Polling Function ---
  const checkStatus = useCallback(async () => {
    // Prevent updates if component unmounted or no bookId
    if (!isMountedRef.current || !bookData?.bookId) return;

    try {
      const res = await fetch(`/api/book-status?bookId=${bookData.bookId}`);
      if (!isMountedRef.current) return; // Check again after await

      if (!res.ok) {
        throw new Error(`Failed to fetch book status (${res.status})`);
      }
      const data = await res.json();
      
      if (!isMountedRef.current) return; // Check again after await
      setCurrentBookStatus(data.status);
      console.log("Poll Status:", data.status);

      if (data.status === BookStatus.COMPLETED) {
          // If we were loading text OR illustrating, stop polling and fetch content.
          if (isLoadingText || isIllustrating) {
              console.log("Book complete, stopping poll and fetching content...");
              if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
              setNeedsPolling(false); // Stop polling
              
              try {
                const contentRes = await fetch(`/api/book-content?bookId=${bookData.bookId}`);
                if (!isMountedRef.current) return; // Check after await
                if (!contentRes.ok) throw new Error(`Failed to fetch book content (${contentRes.status})`);
                const contentData = await contentRes.json();
                if (!isMountedRef.current) return; // Check after await

                if (contentData.pages && bookData?.assets) {
                   const updatedPageData = bookData.assets.map((asset: {id: string, thumbnailUrl: string}, index: number) => ({
                       id: contentData.pages[index]?.id || '',
                       text: contentData.pages[index]?.text || '',
                       imageUrl: asset.thumbnailUrl,
                       assetId: asset.id,
                       generatedImageUrl: contentData.pages[index]?.generatedImageUrl || null, // Get generated image URL
                   }));

                   setPages(updatedPageData);
                   console.log("Review Page: Pages state updated with fetched content:", updatedPageData);
                   toast.success(isLoadingText ? "Story generation complete!" : "Illustration generation complete!");
                   
                   // Reset loading states and confirmation
                   setIsLoadingText(false);
                   setIsIllustrating(false);
                   setConfirmed(updatedPageData.map(() => false)); // Reset confirmation for review/illustration

                   // If illustrations just finished, navigate to preview
                   if (currentBookStatus === BookStatus.ILLUSTRATING) {
                      console.log("Illustrations complete, navigating to preview...")
                      // TODO: Define preview route
                      // router.push(`/create/preview/${bookData.bookId}`); 
                      toast.info("Navigating to preview page..."); // Placeholder
                   }
                   
                } else {
                   console.error("Fetched content missing pages data or assets unavailable:", contentData, bookData?.assets);
                   throw new Error("Fetched content missing pages data or assets unavailable.");
                }
              } catch (contentError) {
                console.error("Error fetching or processing book content:", contentError);
                if (isMountedRef.current) {
                  toast.error(`Error loading book content: ${contentError instanceof Error ? contentError.message : String(contentError)}`);
                  setIsLoadingText(false);
                  setIsIllustrating(false);
                }
              }
          } else {
            // Status is COMPLETED, but we weren't actively loading text/illustrations
            // This means the book was likely already completed when the page loaded.
            // We can stop polling if it was somehow still active.
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            setNeedsPolling(false); 
            console.log("Book already completed. Stopping any active polling.");
          }

      } else if (data.status === BookStatus.FAILED) {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setNeedsPolling(false); // Stop polling
        console.error("Generation failed.");
        if (isMountedRef.current) {
          toast.error(isLoadingText ? "Story generation failed. Please try again." : "Illustration generation failed. Please try again.");
          setIsLoadingText(false);
          setIsIllustrating(false);
        }
      } else {
         // Still GENERATING or ILLUSTRATING, continue polling
         console.log(`Review Page: Status is ${data.status}, continuing poll...`);
      }
    } catch (error) {
      console.error("Polling error:", error);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      setNeedsPolling(false); // Stop polling on error
      if (isMountedRef.current) {
        toast.error(`Error checking book status: ${error instanceof Error ? error.message : String(error)}`);
        setIsLoadingText(false);
        setIsIllustrating(false);
      }
    }
  }, [bookData?.bookId, bookData?.assets, isLoadingText, isIllustrating, currentBookStatus, router]); // Dependencies for the callback

  // --- Effect to Manage Polling Interval ---
  useEffect(() => {
    // Only manage interval if setup is complete and polling is needed
    if (!isReadyForPolling || !needsPolling) {
      // Ensure interval is cleared if polling is no longer needed
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log("Polling stopped because needsPolling is false or setup not ready.");
      }
      return;
    }

    // If polling is needed and interval isn't running, start it
    if (!pollingIntervalRef.current) {
        console.log(`Starting polling interval for bookId: ${bookData?.bookId}`);
        checkStatus(); // Initial check
        pollingIntervalRef.current = setInterval(checkStatus, POLLING_INTERVAL);
    }

    // Cleanup function clears interval if dependencies change triggering a restart or stop
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log("Polling interval cleanup executed.");
      }
    };
  }, [isReadyForPolling, needsPolling, bookData?.bookId, checkStatus]); // Dependencies that control the interval lifecycle


  // Navigation handlers
  const goPrev = () => setCurrentIndex(i => Math.max(i - 1, 0));
  const goNext = () => setCurrentIndex(i => Math.min(i + 1, pages.length - 1));

  // Toggle confirmation per page
  const toggleConfirm = async () => {
    if (!bookData?.bookId || !pages[currentIndex]) {
      toast.error("Cannot confirm page: Missing book or page data.");
      return;
    }
    if (isIllustrating) return; // Don't allow edits during illustration

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
    if (isIllustrating) return; // Don't allow during illustration
    if (window.confirm('Are you sure you want to regenerate the entire story? All edits will be lost.')) {
      console.log('Regenerating story...');
      // TODO: Implement actual API call for regeneration
      // For now, reset state to mimic starting polling again
      setPages(pages.map(p => ({ ...p, text: null }))); // Clear text
      setConfirmed(pages.map(() => false));
      setCurrentBookStatus(BookStatus.GENERATING); // Assume it goes back to generating
      setNeedsPolling(true); // Trigger polling start
      setIsLoadingText(true);
      setIsReadyForPolling(true); // Ready to start polling immediately
      toast.info("Requesting story regeneration...");
    }
  };

  // --- Illustrate Book Handler ---
  const handleIllustrate = async () => {
     if (!bookData?.bookId || !allConfirmed || isIllustrating || isLoadingText) {
       toast.warning("Cannot start illustration. Ensure all pages are confirmed and no other process is running.");
       return;
     }

     console.log("Starting illustration process...");
     setIsIllustrating(true);
     setNeedsPolling(true); // Start polling for illustration status
     setIsReadyForPolling(true); // Ensure polling starts if not already active
     toast.info("Starting illustration generation... This may take a few minutes.");

     try {
        const response = await fetch('/api/generate/illustrations', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ bookId: bookData.bookId }),
        });

        if (!response.ok && response.status !== 202) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to start illustration generation (Status: ${response.status})`);
        }

        if (response.status === 202) {
            const result = await response.json();
            console.log("Illustration Job Accepted:", result);
            // Polling will handle status updates from here
        } else {
            // Handle unexpected success status code if needed
             console.warn("Unexpected success status code:", response.status);
        }

     } catch (error) {
        console.error("Error initiating illustration generation:", error);
        if (isMountedRef.current) {
           toast.error(`Error starting illustration: ${error instanceof Error ? error.message : String(error)}`);
           setIsIllustrating(false);
           setNeedsPolling(false); // Stop polling if initiation failed
        }
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
  }, [goPrev, goNext]); 

  const allConfirmed = pages.length > 0 && confirmed.every(c => c);
  const isWorking = isLoadingText || isIllustrating;

  // Handle loading/redirect state before rendering main UI
  if (!bookData) {
      return <div className="p-6 flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading review data...</div>;
  }
  // Keep a general loading state if polling isn't ready yet
  if (!isReadyForPolling) {
      return <div className="p-6 flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Initializing...</div>;
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
              src={pages[currentIndex]?.imageUrl || '/placeholder.png'} 
              alt={`Page ${currentIndex + 1} Original Photo`}
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
        ) : isIllustrating ? (
            <div className="w-full h-40 mb-4 rounded-md border border-input bg-background px-3 py-2 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground">Generating illustrations...</span>
            </div>
        ) : (
            <Textarea
              className="w-full h-40 mb-4"
              value={pages[currentIndex]?.text ?? ''} 
              onChange={(e) => {
                const newText = e.target.value;
                setPages(prev => {
                  const copy = [...prev];
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
              readOnly={isWorking} // Readonly if loading text OR illustrating
            />
        )}
        {/* Navigation and Confirm Row */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-2">
            <Button onClick={goPrev} disabled={currentIndex === 0 || isWorking}>Previous</Button>
            <Button onClick={goNext} disabled={currentIndex === pages.length - 1 || isWorking}>Next</Button>
          </div>
          <div>
            <Button 
              variant={confirmed[currentIndex] ? 'default' : 'outline'} 
              onClick={toggleConfirm} 
              disabled={isWorking || isSavingPage || !pages[currentIndex]} // Disable if loading text/illustrating OR saving page OR page invalid
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
            <Button variant="ghost" onClick={handleRegenerate} disabled={isWorking}> {/* Disable regenerate if working */}
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
            const snippet = isLoadingText 
              ? '(Generating...)'
              : isIllustrating
                ? '(Illustrating...)'
                : page.text
                  ? (page.text.length > 50 ? page.text.slice(0, 50) + '...' : page.text)
                  : '(No text generated)'; 
            return (
              <Button
                key={page.assetId || idx} 
                variant={idx === currentIndex ? 'default' : 'outline'}
                size="sm"
                className={
                  `w-full text-left p-2 rounded-lg justify-start h-auto whitespace-normal ${
                    confirmed[idx] && !isIllustrating ? 'bg-green-50 border-2 border-green-500 text-green-700 hover:bg-green-100' : 'hover:bg-accent'
                  }`
                }
                onClick={() => setCurrentIndex(idx)}
                disabled={isWorking} // Disable selecting other pages while working
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
          disabled={!allConfirmed || isWorking} // Also disable if loading text or illustrating
          variant={allConfirmed && !isWorking ? 'default' : 'outline'}
          onClick={handleIllustrate} // Add onClick handler
        >
           {isIllustrating ? (
             <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Illustrating...</>
           ) : (
             'Illustrate My Book'
           )}
        </Button>
      </div>
    </div>
  );
}
