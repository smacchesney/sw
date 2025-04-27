"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StoryboardEditor from '@/components/storyboard/storyboard-editor';
import { Button } from '@/components/ui/button';
import RoughUnderline from "@/components/ui/rough-underline";
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBookCreation, BookData } from '@/context/BookCreationContext';
import { BookStatus } from '@prisma/client';

// Import STYLE_LIBRARY using require due to CJS
const { STYLE_LIBRARY } = require('@/lib/ai/styleLibrary');

// --- Type Definitions --- 
type Asset = {
  id: string;
  thumbnailUrl: string;
};
type PageCount = 8 | 12 | 16;
type DroppedAssets = Record<number | string, string | null>;
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

// Main Page Component
export default function CreateBookPage() {
  const router = useRouter();
  const { setBookData } = useBookCreation();
  const headingRef = useRef<HTMLDivElement>(null);
  const [headingWidth, setHeadingWidth] = useState(0);

  const [uploadedAssets, setUploadedAssets] = useState<Asset[]>([]);
  const [droppedAssets, setDroppedAssets] = useState<DroppedAssets>({});
  const [editorSettings, setEditorSettings] = useState<Partial<EditorSettings>>({ isDoubleSpread: false, theme: '', people: '', objects: '', excitementElement: '' });
  const [pageCount, setPageCount] = useState<PageCount>(8);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (headingRef.current) {
      const updateWidth = () => {
        if (headingRef.current) {
          setHeadingWidth(headingRef.current.offsetWidth);
        }
      };
      updateWidth();
      const resizeObserver = new ResizeObserver(updateWidth);
      resizeObserver.observe(headingRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const handleUploadComplete = (newAssets: Asset[]) => {
    setUploadedAssets(prevAssets => [...prevAssets, ...newAssets]);
  };

  // Upload logic (calls API)
  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
     if (event.target.files && event.target.files.length > 0) {
       const files = Array.from(event.target.files);
       setIsUploading(true);
       toast.info(`Uploading ${files.length} file(s)...`);
       const formData = new FormData();
       files.forEach((file) => formData.append('files', file));
       try {
          const response = await fetch('/api/upload', { method: 'POST', body: formData });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
          }
          const result = await response.json();
          if (result.assets && result.assets.length > 0) {
              handleUploadComplete(result.assets);
              toast.success(`${result.assets.length} file(s) uploaded successfully!`);
          } else {
              toast.warning("Upload completed, but no assets were returned.");
          }
       } catch (error) {
          console.error("File Upload Error:", error);
          toast.error(`Error uploading files: ${error instanceof Error ? error.message : 'Unknown error'}`);
       } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
       }
     }
   };

  const triggerUpload = () => fileInputRef.current?.click();

  // Story Generation Logic
  const handleGenerateStory = async () => {
    setIsGenerating(true);
    const TITLE_PAGE_ID = 'title-page'; // Use consistent ID
    
    // Get asset IDs for STORY pages only (filter out title page asset)
    const orderedStoryAssetIds = Object.entries(droppedAssets)
        .filter(([key, value]) => key !== TITLE_PAGE_ID && value !== null)
        .sort(([keyA], [keyB]) => Number(keyA) - Number(keyB)) // Sort by numeric index
        .map(([, value]) => value as string);

    const titlePageAssetId = droppedAssets[TITLE_PAGE_ID] || null; // Get title page asset if exists
    const includeTitlePage = titlePageAssetId !== null; // Determine flag based on asset presence

    // Validation
    const requiredFields: (keyof Pick<EditorSettings, 'artStyle' | 'storyTone' | 'isDoubleSpread'>)[] = ['artStyle', 'storyTone', 'isDoubleSpread'];
    const missingRequiredFields = requiredFields.filter(key => editorSettings[key] === undefined || editorSettings[key] === '');
    const missingOrEmptyBookTitle = !editorSettings.bookTitle?.trim();
    const missingOrEmptyChildName = !editorSettings.childName?.trim();

    let errorMessages: string[] = [];
    // Modify asset check: require at least one image for the story pages
    if (orderedStoryAssetIds.length === 0) errorMessages.push("Please add at least one photo for the story pages."); 
    // Check if pageCount matches number of story assets
    if (pageCount !== orderedStoryAssetIds.length) {
         errorMessages.push(`Please ensure the number of photos (${orderedStoryAssetIds.length}) matches the selected Page Count (${pageCount}) for story pages.`);
    }    
    if (missingOrEmptyBookTitle) errorMessages.push("Book Title is required.");
    if (missingOrEmptyChildName) errorMessages.push("Child's Name is required.");
    if (missingRequiredFields.length > 0) errorMessages.push(`Missing required settings: ${missingRequiredFields.join(', ')}`);

    if (errorMessages.length > 0) {
        toast.error(errorMessages.join("\n"));
        setIsGenerating(false);
        return;
    }

    // Construct payload for the backend (adjust based on exact backend expectations)
    const requestPayload = {
        bookTitle: editorSettings.bookTitle!, 
        childName: editorSettings.childName!,
        pageCount: pageCount, // Number of STORY pages
        artStyle: editorSettings.artStyle!,
        storyTone: editorSettings.storyTone!,
        isDoubleSpread: editorSettings.isDoubleSpread!,
        theme: editorSettings.theme || '',
        // Send the droppedAssets state directly, which is Record<string, string | null>
        // Note: Ensure the backend expects string keys for the numeric indices.
        droppedAssets: droppedAssets, 
        // Optional fields that might be missing from the schema but were sent before:
        people: editorSettings.people || '',
        objects: editorSettings.objects || '',
        excitementElement: editorSettings.excitementElement || '',
    };
    console.log("Generating story with payload:", requestPayload);

    try {
      const response = await fetch('/api/generate/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

       if (!response.ok && response.status !== 202) {
         const errorData = await response.json().catch(() => ({}));
         console.error("API Error Response:", errorData);
         throw new Error(errorData.details?.[0]?.message || errorData.error || `Story generation failed: ${response.statusText}`);
       }

       if (response.status === 202) {
          const result = await response.json();
          console.log("Generation Job Accepted:", result);
          if (!result.bookId) throw new Error("API did not return a bookId");

          // Prepare data for context using the original droppedAssets structure
          const finalAssetsForContext = Object.values(droppedAssets)
             .filter((id): id is string => id !== null) // Filter out null/title
             .map(id => uploadedAssets.find(asset => asset.id === id))
             .filter((asset): asset is Asset => asset !== undefined);
          
          const finalSettingsForContext: EditorSettings & { pageLength: PageCount } = {
             bookTitle: requestPayload.bookTitle,
             childName: requestPayload.childName,
             artStyle: requestPayload.artStyle,
             storyTone: requestPayload.storyTone,
             theme: requestPayload.theme,
             isDoubleSpread: requestPayload.isDoubleSpread,
             pageLength: requestPayload.pageCount, // Keep as user-selected story page count
          };

          // Set bookData - We expect the review page to fetch the full data including Title page
          setBookData({
            bookId: result.bookId,
            assets: finalAssetsForContext, // Assets only for story pages
            pages: null, // Review page will fetch
            settings: finalSettingsForContext,
            // Add status if available in result
            status: result.status || BookStatus.GENERATING 
          });

          toast.info("Story generation started! Moving to review page...");
          router.push('/create/review');
       } else {
          console.warn("Received unexpected success status:", response.status);
          toast.error("Received an unexpected response from the server.");
       }       

    } catch (error) {
       console.error("Story Generation Error:", error);
       toast.error(`Error generating story: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Need to define handleRemoveAsset here for state update
  const handleRemoveAsset = (idToRemove: number | string) => {
     setDroppedAssets(prev => {
         const newState = { ...prev };
         newState[idToRemove] = null;
         return newState;
     });
  };

  return (
    <div className="py-8 px-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" className="mr-2" onClick={() => window.history.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div ref={headingRef} className="relative inline-block ml-1">
          <h1 className="text-4xl font-bold">Create Your Story</h1>
          {headingWidth > 0 && (
            <RoughUnderline 
              width={headingWidth} 
              className="absolute bottom-0 left-0 -mb-1.5"
              roughness={3} 
              strokeWidth={3} 
            />
          )}
        </div>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileInputChange} className="hidden" multiple accept="image/jpeg,image/png,image/heic,image/heif" />

      <StoryboardEditor
          initialAssets={uploadedAssets}
          onTriggerUpload={isUploading ? undefined : triggerUpload}
          droppedAssets={droppedAssets}
          onDroppedAssetsChange={setDroppedAssets}
          editorSettings={editorSettings}
          onEditorSettingsChange={setEditorSettings}
          pageCount={pageCount}
          onPageCountChange={setPageCount}
          styleLibrary={STYLE_LIBRARY}
      />

      <div className="mt-6 flex justify-end">
         <Button onClick={handleGenerateStory} disabled={isGenerating || isUploading}>
            {isGenerating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              'Generate & Review Story'
            )}
          </Button>
      </div>
    </div>
  );
}