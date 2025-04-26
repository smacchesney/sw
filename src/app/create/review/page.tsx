"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useBookCreation, BookData } from '@/app/create/layout';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { BookStatus, Page } from '@prisma/client'; // Use direct prisma client types
import { cn } from '@/lib/utils';
import RoughButton from "@/components/ui/rough-button";
import RoughBorder from "@/components/ui/rough-border";

// Define PageData with necessary fields from BookData context or fetched data
type PageData = {
  id: string | undefined; // Allow ID to be undefined initially
  text: string | null;
  originalImageUrl: string | null; // Original image URL from Page model
  assetId: string | null; // Original Asset ID from Page model
  pageNumber: number; // Added pageNumber field
  generatedImageUrl?: string | null; // Populated after illustration
  isTitlePage?: boolean; // Add a flag for easy identification
};

const POLLING_INTERVAL = 5000; // Check every 5 seconds

export default function ReviewPage() {
  const router = useRouter();
  const { bookData, setBookData } = useBookCreation(); 

  // State hooks
  const [pages, setPages] = useState<PageData[]>([]);
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [confirmed, setConfirmed] = useState<boolean[]>([]);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [isSavingPage, setIsSavingPage] = useState(false);
  const [currentBookStatus, setCurrentBookStatus] = useState<BookStatus | null>(null);
  const [isStartingIllustration, setIsStartingIllustration] = useState(false);
  // Restore previous polling states
  const [needsTextPolling, setNeedsTextPolling] = useState(false);
  const textPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Polling states for final illustration status
  const [isAwaitingFinalStatus, setIsAwaitingFinalStatus] = useState(false);
  const finalStatusPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (textPollingIntervalRef.current) {
         clearInterval(textPollingIntervalRef.current);
      }
      if (finalStatusPollingIntervalRef.current) {
        clearInterval(finalStatusPollingIntervalRef.current);
      }
    };
  }, []);

  // --- Initial Setup Logic (Refined Polling Trigger) ---
  useEffect(() => {
    const fetchBookData = async () => {
      if (!bookData?.bookId) {
        toast.error("Book ID not found. Cannot load review data.");
        setIsFetchingInitialData(false);
        return;
      }

      console.log(`Review Page: Fetching initial data for bookId: ${bookData.bookId}`);
      setIsFetchingInitialData(true);
      try {
        const response = await fetch(`/api/book/${bookData.bookId}`);
        if (!isMountedRef.current) return;

        if (!response.ok) {
          const errorText = await response.text().catch(() => `HTTP Error ${response.status}`);
          throw new Error(`Failed to fetch book data: ${errorText}`);
        }

        const fetchedBook = await response.json();
        if (!isMountedRef.current) return;

        if (!fetchedBook || !fetchedBook.pages) {
          throw new Error("Fetched data is invalid or missing pages.");
        }

        console.log("Review Page: Fetched Book Data:", fetchedBook);
        setCurrentBookStatus(fetchedBook.status);

        // Handle based on fetched status and pages presence
        const currentStatus = fetchedBook.status as BookStatus;

        if (currentStatus === BookStatus.GENERATING && (!fetchedBook.pages || fetchedBook.pages.length === 0)) {
          // Status is GENERATING, but pages haven't been saved yet by the worker.
          // Start polling for text/status change.
          console.log("Review Page: Status is GENERATING, but no pages found yet. Starting text polling.");
          setIsLoadingText(true);
          setNeedsTextPolling(true);
          setIsAwaitingFinalStatus(false); // Not awaiting final illustration status yet
          setPages([]); // Ensure pages state is empty
        } else if (fetchedBook.pages && fetchedBook.pages.length > 0) {
          // Pages exist, map them and determine next steps
          console.log("Review Page: Fetched book content:", JSON.stringify(fetchedBook, null, 2));
          const mappedPages: PageData[] = fetchedBook.pages.map((p: Page) => ({
            id: p.id,
            text: p.text,
            originalImageUrl: p.originalImageUrl, // Use field from Page model
            assetId: p.assetId,
            generatedImageUrl: p.generatedImageUrl,
            isTitlePage: p.isTitlePage || false,
            pageNumber: p.pageNumber,
          }));

          console.log("Review Page: Updating pages state with fetched text:", mappedPages);
          setPages(mappedPages);
          setConfirmed(fetchedBook.pages.map((p: Page) => p.textConfirmed || p.isTitlePage));
          setCurrentIndex(0);

          const hasMissingText = mappedPages.some(p => !p.isTitlePage && p.text === null);

          if (hasMissingText && currentStatus === BookStatus.GENERATING) {
            // This case should be less common now, but handle if pages exist but text is null
            console.log(`Review Page: Text missing and status is ${currentStatus}. Starting text polling.`);
            setIsLoadingText(true);
            setNeedsTextPolling(true);
          } else if (currentStatus === BookStatus.ILLUSTRATING) {
            console.log("Review Page: Status is ILLUSTRATING, setting up final status polling.");
            setIsLoadingText(false);
            setNeedsTextPolling(false);
            setIsAwaitingFinalStatus(true);
          } else {
            // Includes COMPLETED, FAILED, DRAFT (if pages somehow exist)
            console.log(`Review Page: Initial status ${currentStatus}. No text polling needed.`);
            setIsLoadingText(false);
            setNeedsTextPolling(false);
            setIsAwaitingFinalStatus(false);
          }
        } else {
           // Status is not GENERATING, but no pages found - this is an error state.
           console.error(`Review Page: Status is ${currentStatus}, but no pages found.`);
           throw new Error(`Book status is ${currentStatus}, but no pages were loaded.`);
        }
      } catch (error) {
        console.error("Error fetching initial review data:", error);
        if (isMountedRef.current) {
          toast.error(`Error loading review data: ${error instanceof Error ? error.message : String(error)}`);
          // Optionally redirect or show a persistent error state
        }
      } finally {
        if (isMountedRef.current) {
          setIsFetchingInitialData(false);
        }
      }
    }

    fetchBookData();

  }, [bookData?.bookId]); // Depend only on bookId from context

  // --- Text Polling Function (Fetch status first, then content) ---
  const checkTextStatus = useCallback(async () => {
    if (!isMountedRef.current || !bookData?.bookId || !needsTextPolling) return;
    console.log("Polling for text generation status...");
    try {
      const statusRes = await fetch(`/api/book-status?bookId=${bookData.bookId}`); 
      if (!isMountedRef.current) return;
      if (!statusRes.ok) {
        const errorText = await statusRes.text().catch(() => `HTTP error ${statusRes.status}`);
        throw new Error(`Failed to fetch book status: ${errorText}`);
      }
      const statusData = await statusRes.json();
      if (!isMountedRef.current) return;
      const newStatus = statusData.status as BookStatus;
      setCurrentBookStatus(newStatus);
      console.log("Poll Status (Text Check):", newStatus);
      if (newStatus === BookStatus.COMPLETED || newStatus === BookStatus.ILLUSTRATING) {
          if (isLoadingText) { 
              console.log("Text generation complete (status changed). Stopping poll and fetching full content...");
              if (textPollingIntervalRef.current) clearInterval(textPollingIntervalRef.current);
              setNeedsTextPolling(false);
              try {
                  const contentRes = await fetch(`/api/book/${bookData.bookId}`); 
                  if (!isMountedRef.current) return;
                  if (!contentRes.ok) throw new Error(`Failed to fetch book content (${contentRes.status})`);
                  const fetchedBook = await contentRes.json();
                  if (!isMountedRef.current) return;
                  if (fetchedBook.pages) {
                      const updatedPageData: PageData[] = fetchedBook.pages.map((p: Page) => ({ 
                          id: p.id || undefined,
                          text: p.text || '',
                          originalImageUrl: p.originalImageUrl,
                          assetId: p.assetId,
                          pageNumber: p.pageNumber,
                          generatedImageUrl: p.generatedImageUrl || null,
                          isTitlePage: p.isTitlePage || false,
                      }));
                      console.log("Review Page: Updating pages state with fetched text:", updatedPageData);
                      setPages(updatedPageData);
                      setConfirmed(fetchedBook.pages.map((p: Page) => p.textConfirmed || p.isTitlePage)); 
                      setIsLoadingText(false);
                      toast.success("Story text generated successfully!");
                  } else {
                      throw new Error("Fetched book content missing pages data.");
                  }
              } catch (contentError) {
                  console.error("Error fetching or processing book content:", contentError);
                  if (isMountedRef.current) {
                      setIsLoadingText(false);
                      toast.error(`Error loading book content: ${contentError instanceof Error ? contentError.message : String(contentError)}`);
                  }
              }
          } else {
              if (textPollingIntervalRef.current) clearInterval(textPollingIntervalRef.current);
              setNeedsTextPolling(false); 
              console.log("Book status changed to COMPLETED/ILLUSTRATING, but wasn't loading text. Stopping poll.");
          }
      } else if (newStatus === BookStatus.FAILED) {
          if (textPollingIntervalRef.current) clearInterval(textPollingIntervalRef.current);
          setNeedsTextPolling(false);
          setIsLoadingText(false);
          console.error("Story generation failed.");
          toast.error("Story generation failed. Please check the book status or try again.");
      } else {
          console.log("Still generating text, continuing poll...");
      }
    } catch (error) {
      console.error("Text polling error:", error);
      if (textPollingIntervalRef.current) clearInterval(textPollingIntervalRef.current);
      if (isMountedRef.current) { 
          setNeedsTextPolling(false); 
          setIsLoadingText(false);
          toast.error(`Error checking text status: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }, [bookData?.bookId, bookData?.assets, needsTextPolling, isLoadingText]); 

  // --- Effect to Manage Text Polling Interval (Reverted to previous pattern) ---
  useEffect(() => {
    // Start polling only if needed AND initial fetch is complete
    if (isFetchingInitialData || !needsTextPolling || !bookData?.bookId) {
      if (textPollingIntervalRef.current) {
        clearInterval(textPollingIntervalRef.current);
        textPollingIntervalRef.current = null;
      }
      return;
    }

    if (!textPollingIntervalRef.current) {
      console.log(`Starting text polling interval for bookId: ${bookData.bookId}`);
      checkTextStatus(); // Initial check immediately
      textPollingIntervalRef.current = setInterval(checkTextStatus, POLLING_INTERVAL);
    }

    // Cleanup
    return () => {
      if (textPollingIntervalRef.current) {
        clearInterval(textPollingIntervalRef.current);
        textPollingIntervalRef.current = null;
      }
    };
  }, [isFetchingInitialData, needsTextPolling, bookData?.bookId, checkTextStatus]);

  // --- Final Status Polling Function --- 
  const checkFinalBookStatus = useCallback(async () => {
    if (!isMountedRef.current || !bookData?.bookId || !isAwaitingFinalStatus) return;

    console.log("Polling for final book status...");
    try {
      const statusRes = await fetch(`/api/book-status?bookId=${bookData.bookId}`);
      if (!isMountedRef.current) return;

      if (!statusRes.ok) {
        const errorText = await statusRes.text().catch(() => `HTTP error ${statusRes.status}`);
        throw new Error(`Failed to fetch final book status: ${errorText}`);
      }
      const statusData = await statusRes.json();
      if (!isMountedRef.current) return;

      const finalStatus = statusData.status as BookStatus;
      setCurrentBookStatus(finalStatus); // Keep track of current status
      console.log("Poll Status (Final Check):", finalStatus);

      // Check if processing has finished (successfully or otherwise)
      if (finalStatus === BookStatus.COMPLETED || finalStatus === BookStatus.PARTIAL || finalStatus === BookStatus.FAILED) {
        console.log(`Final status reached: ${finalStatus}. Stopping poll and redirecting.`);
        if (finalStatusPollingIntervalRef.current) clearInterval(finalStatusPollingIntervalRef.current);
        setIsAwaitingFinalStatus(false);
        setIsStartingIllustration(false); // Reset button state

        // Perform redirect based on final status
        if (finalStatus === BookStatus.COMPLETED) {
          toast.success("Book illustrations complete! Opening preview...");
          router.push(`/book/${bookData.bookId}/preview`);
        } else { // PARTIAL or FAILED
          toast.error("Some illustrations failed or were flagged. Please review and fix.");
          router.push(`/create?bookId=${bookData.bookId}&fix=1`); // Redirect to editor in fix mode
        }
      } else {
        // Still ILLUSTRATING, continue polling
        console.log("Still illustrating, continuing poll...");
      }

    } catch (error) {
      console.error("Final status polling error:", error);
      if (finalStatusPollingIntervalRef.current) clearInterval(finalStatusPollingIntervalRef.current);
      if (isMountedRef.current) {
        setIsAwaitingFinalStatus(false);
        setIsStartingIllustration(false); // Reset button state
        toast.error(`Error checking final book status: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }, [bookData?.bookId, isAwaitingFinalStatus, router]);

  // --- Effect to Manage Final Status Polling Interval --- 
  useEffect(() => {
    // Start polling only if needed AND initial fetch is complete
    if (isFetchingInitialData || !isAwaitingFinalStatus || !bookData?.bookId) {
      if (finalStatusPollingIntervalRef.current) {
        clearInterval(finalStatusPollingIntervalRef.current);
        finalStatusPollingIntervalRef.current = null;
      }
      return;
    }

    if (!finalStatusPollingIntervalRef.current) {
      console.log(`Starting FINAL status polling interval for bookId: ${bookData.bookId}`);
      checkFinalBookStatus(); // Initial check
      finalStatusPollingIntervalRef.current = setInterval(checkFinalBookStatus, POLLING_INTERVAL);
    }

    // Cleanup
    return () => {
      if (finalStatusPollingIntervalRef.current) {
        clearInterval(finalStatusPollingIntervalRef.current);
        finalStatusPollingIntervalRef.current = null;
      }
    };
  }, [isFetchingInitialData, isAwaitingFinalStatus, bookData?.bookId, checkFinalBookStatus]);

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
    
    // Add guard for missing page ID
    if (!currentPage.id) {
        toast.error("Page ID is missing. Cannot save confirmation. Please wait for generation to complete.");
        return;
    }
    
    const currentlyConfirmed = confirmed[currentIndex];

    if (currentlyConfirmed) {
      setConfirmed(arr => {
        const copy = [...arr];
        copy[currentIndex] = false;
        return copy;
      });
      toast.info(`Page ${currentIndex + 1} marked as unconfirmed.`);
      // Optionally PATCH textConfirmed: false here too
      return;
    }

    setIsSavingPage(true);
    try {
      // Use the validated currentPage.id
      const response = await fetch(`/api/book/${bookData.bookId}/page/${currentPage.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              text: currentPage.text || '',
              textConfirmed: true
            }), 
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to save page ${currentIndex + 1} (Status: ${response.status})`);
      }
      setConfirmed(arr => {
        const copy = [...arr];
        copy[currentIndex] = true; 
        return copy;
      });
      toast.success(`Page ${currentIndex + 1} saved and confirmed!`);
    } catch (error) {
      console.error("Error saving page:", error);
      toast.error(`${error instanceof Error ? error.message : String(error)}`);
    } finally {
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
      setIsLoadingText(true); // Show loading state
      setNeedsTextPolling(true); // Start polling again
      setPages(pages.map(p => ({ ...p, text: null }))); 
      setConfirmed(pages.map(() => false));
      setCurrentBookStatus(BookStatus.GENERATING);
      toast.info("Requesting story regeneration...");
    }
  };

  // --- Illustrate Book Handler (MODIFIED FOR POLLING) ---
  const handleIllustrate = async () => {
     if (!bookData?.bookId || !allConfirmed || isLoadingText) {
       toast.warning("Cannot start illustration. Ensure all pages are confirmed and story text is loaded.");
       return;
     }
     if (isStartingIllustration || isAwaitingFinalStatus) return; // Prevent if already starting or polling final status
     
     console.log("Attempting to start illustration process...");
     setIsStartingIllustration(true);
     toast.info("Sending request to start illustration generation..."); 

     try {
        const response = await fetch('/api/generate/illustrations', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ bookId: bookData.bookId }),
        });
        if (!response.ok && response.status !== 202) {
            const errorData = await response.json().catch(() => ({ message: "Unknown error occurred" }));
            throw new Error(errorData.error || errorData.message || `Failed to start illustration generation (Status: ${response.status})`);
        }
        const result = await response.json().catch(() => ({}));
        console.log("Illustration Job Request Result:", result);
        
        // Instead of redirecting, start polling for the final status
        toast.success("Illustration process started! You can monitor progress in your library."); 
        setCurrentBookStatus(BookStatus.ILLUSTRATING); // Assume status update
        setIsAwaitingFinalStatus(true); // Trigger final status polling
        // Keep button loading state until polling completes/redirects
        // setIsStartingIllustration(false); 

     } catch (error) {
        console.error("Error initiating illustration generation:", error);
        if (isMountedRef.current) {
           toast.error(`Error starting illustration: ${error instanceof Error ? error.message : String(error)}`);
           setIsStartingIllustration(false); // Reset button loading on error
        }
     } 
     // No finally block needed here for resetting state if polling takes over
  };

  // Keyboard arrow navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    // Need dependencies here for goPrev/goNext if they aren't stable
    return () => window.removeEventListener('keydown', handleKey);
  }, [/* Add goPrev, goNext if needed */]); 

  const allConfirmed = pages.length > 0 && confirmed.every(c => c);
  const isWorking = isLoadingText || isSavingPage || isStartingIllustration || isAwaitingFinalStatus || isFetchingInitialData;

  // Handle loading/redirect state before rendering main UI
  if (isFetchingInitialData) {
      return <div className="p-6 flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading review data...</div>;
  }
  if (pages.length === 0 && !isFetchingInitialData) {
      return <div className="p-6 text-red-600">Error: Could not load pages for review. Please go back and try again.</div>;
  }

  // Add rendering for Awaiting Final Status
  if (isAwaitingFinalStatus) {
       return (
         <div className="p-6 flex flex-col justify-center items-center h-full text-center">
              <Loader2 className="h-8 w-8 animate-spin mr-2 mb-4 text-primary" />
              <h2 className="text-xl font-semibold mb-2">Illustrations In Progress...</h2>
              <p className="text-muted-foreground mb-4">Your book is being illustrated. We'll redirect you when it's ready.</p>
              <p className="text-sm text-muted-foreground">(You can safely navigate away or check status in "My Library")</p>
         </div>
       );
  }

  const currentPageData = pages[currentIndex];
  const isTitlePageSelected = currentPageData?.isTitlePage === true;

  // Main Render
  return (
    <div className="flex h-[calc(100vh-var(--site-header-height)-var(--site-footer-height))] w-full">
      {/* Left Panel - Keep the image sizing fixes */}
      <div className="flex-2 p-6 bg-white flex flex-col items-center">
        {/* Page Image/Title Container */}
        <div className="flex-grow flex items-center justify-center w-full mb-4">
          <div className="relative w-full max-w-[500px] max-h-[500px] overflow-hidden rounded-lg shadow bg-muted aspect-square">
            {/* Show Original Image URL from Page data */}
            {isTitlePageSelected ? (
              // Show Title page image if available, otherwise placeholder text
              currentPageData?.originalImageUrl ? (
                <Image
                  src={currentPageData.originalImageUrl}
                  alt={`Title Page Original Photo`}
                  fill
                  className="object-contain"
                  priority={true}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-2xl font-semibold text-muted-foreground">Title Page</span>
                </div>
              )
            ) : currentPageData?.originalImageUrl ? (
              <Image
                src={currentPageData.originalImageUrl}
                alt={`Page ${currentIndex + 1} Original Photo`}
                fill
                className="object-contain"
                priority={true}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                   <span className="text-xs text-muted-foreground">No Image</span>
              </div>
            )}
          </div>
        </div>
        {/* Text Area - Conditionally Rendered (Hide for Title Page) */}
        {!isTitlePageSelected && (
          isLoadingText && currentIndex > 0 ? ( // Check currentIndex > 0 to ensure it's not title page placeholder
            <div className="w-full h-40 mb-4 rounded-md border border-input bg-background px-3 py-2 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground">Generating story text...</span>
            </div>
          ) : (
            <Textarea
              className="w-full h-40 mb-4 text-2xl text-center p-6 resize-none"
              value={currentPageData?.text ?? ''}
              onChange={(e) => {
                // Only allow editing for non-title pages
                if (isTitlePageSelected) return;
                const newText = e.target.value;
                setPages(prev => {
                  const copy = [...prev];
                  if (copy[currentIndex]) {
                    copy[currentIndex] = { ...copy[currentIndex], text: newText };
                  }
                  return copy;
                });
                setConfirmed(prev => {
                  const copy = [...prev];
                  if (copy[currentIndex] !== undefined) {
                     copy[currentIndex] = false;
                  }
                  return copy;
                });
              }}
              readOnly={isWorking || isStartingIllustration || isTitlePageSelected} // Make title read-only
            />
          )
        )}
        {/* Navigation and Confirm Row */}
        <div className="flex justify-between items-center w-full mb-4">
          <div className="flex space-x-2">
            <Button onClick={goPrev} disabled={currentIndex === 0 || isWorking || isStartingIllustration}>Previous</Button>
            <Button onClick={goNext} disabled={currentIndex === pages.length - 1 || isWorking || isStartingIllustration}>Next</Button>
          </div>
          <div>
            <Button
              variant={confirmed[currentIndex] ? 'default' : 'outline'}
              onClick={toggleConfirm}
              // Disable confirm for Title page
              disabled={isWorking || isStartingIllustration || !currentPageData || isTitlePageSelected} 
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
        </div>
         {/* Bottom Buttons Row */}
         <div className="flex justify-between items-center w-full mt-auto pt-4 border-t">
            <Button variant="ghost" onClick={handleRegenerate} disabled={isWorking}>
              Regenerate Story
            </Button>
            <Button
              onClick={handleIllustrate}
              disabled={!allConfirmed || isWorking}
              size="lg"
            >
              {isStartingIllustration ? (
                 <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...</>
              ) : (
                 'Illustrate My Book'
              )}
            </Button>
         </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 p-6 bg-gray-100 overflow-auto">
        <h2 className="text-xl font-semibold mb-4">
          Review Pages ({pages.length} total)
        </h2>
        <div className="space-y-2 mb-6">
          {pages.map((page: PageData & { isTitlePage?: boolean }, idx: number) => {
            // Display "Title" or "Pg X"
            const pageLabel = page.isTitlePage ? "Title Page" : `Page ${page.pageNumber}`;
            const snippet = isLoadingText && !page.isTitlePage // Don't show generating for title
              ? '(Generating...)'
              : page.text ?? '(No text yet)';
            
            const isCurrent = idx === currentIndex;
            const isPageConfirmed = confirmed[idx];

            return (
              // Use standard Button for list items again
              <Button
                key={page.assetId || idx}
                variant={isCurrent ? 'default' : 'outline'}
                size="sm"
                className={
                  cn(
                    // Base styles
                    `w-full flex items-start text-left p-3 rounded-lg h-auto min-h-[5rem] whitespace-normal`,
                    // Conditional hover based on selection
                    !isCurrent && 'hover:bg-accent',
                    // Apply green style if confirmed (including title page)
                    isPageConfirmed ? 'bg-green-50 border-2 border-green-500 text-green-700 hover:bg-green-100' : '' 
                  )
                }
                onClick={() => setCurrentIndex(idx)}
                disabled={isWorking || isStartingIllustration}
              >
                {/* Flex container for two columns */}
                <div className="flex w-full items-start space-x-3"> 
                  {/* Column 1: Page Label (Minimal Width) */}
                  <div className="flex-shrink-0 font-medium w-20"> {/* Adjust width as needed */} 
                    {pageLabel}:
                  </div>
                  {/* Column 2: Text Snippet (Takes remaining space) */}
                  <div className="flex-grow min-w-0"> {/* min-w-0 allows line-clamp to work */} 
                    <span className="text-muted-foreground line-clamp-2">{snippet}</span>
                  </div>
                </div>
                {/* Confirmation Checkmark (Positioned separately if needed, or keep at end) */}
                {isPageConfirmed && <span className="text-green-600 flex-shrink-0 ml-2">✓</span>} 
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
