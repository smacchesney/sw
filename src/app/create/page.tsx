"use client";

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import StoryboardEditor from '@/components/storyboard/storyboard-editor';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBookCreation } from './layout';

// --- Type Definitions --- 
type Asset = {
  id: string;
  thumbnailUrl: string;
};
type PageCount = 8 | 12 | 16;
type DroppedAssets = Record<number, string | null>;
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
interface BookData {
    bookId: string;
    assets: Asset[];
    pages: null | { generatedText: string }[];
    settings: EditorSettings & { pageLength: PageCount };
}

// Main Page Component
export default function CreateBookPage() {
  const router = useRouter();
  const { setBookData } = useBookCreation();

  const [uploadedAssets, setUploadedAssets] = useState<Asset[]>([]);
  const [droppedAssets, setDroppedAssets] = useState<DroppedAssets>({});
  const [editorSettings, setEditorSettings] = useState<Partial<EditorSettings>>({ isDoubleSpread: false, theme: '', people: '', objects: '', excitementElement: '' });
  const [pageCount, setPageCount] = useState<PageCount>(8);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const orderedAssetIds = Object.values(droppedAssets).filter((id): id is string => id !== null);
    const requiredFields: (keyof EditorSettings)[] = ['artStyle', 'storyTone', 'isDoubleSpread'];
    const missingRequiredFields = requiredFields.filter(key => editorSettings[key] === undefined);
    const missingOrEmptyBookTitle = !editorSettings.bookTitle?.trim();
    const missingOrEmptyChildName = !editorSettings.childName?.trim();

    let errorMessages: string[] = [];
    if (orderedAssetIds.length === 0) errorMessages.push("Please add at least one photo.");
    if (missingOrEmptyBookTitle) errorMessages.push("Book Title is required.");
    if (missingOrEmptyChildName) errorMessages.push("Child's Name is required.");
    if (missingRequiredFields.length > 0) errorMessages.push(`Missing settings: ${missingRequiredFields.join(', ')}`);

    if (errorMessages.length > 0) {
        toast.error(errorMessages.join("\n"));
        setIsGenerating(false);
        return;
    }

    // Construct flat payload matching API schema
    const requestPayload = {
        bookTitle: editorSettings.bookTitle!,
        childName: editorSettings.childName!,
        pageCount: pageCount,
        artStyle: editorSettings.artStyle!,
        storyTone: editorSettings.storyTone!,
        isDoubleSpread: editorSettings.isDoubleSpread!,
        theme: editorSettings.theme || '',
        people: editorSettings.people || '',
        objects: editorSettings.objects || '',
        excitementElement: editorSettings.excitementElement || '',
        droppedAssets: droppedAssets,
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

          if (!result.bookId) {
             throw new Error("API did not return a bookId after accepting the job.");
          }

          const finalAssets = orderedAssetIds
            .map(id => uploadedAssets.find(asset => asset.id === id))
            .filter((asset): asset is Asset => asset !== undefined);

          const finalSettingsForContext: EditorSettings & { pageLength: PageCount } = {
             bookTitle: requestPayload.bookTitle,
             childName: requestPayload.childName,
             artStyle: requestPayload.artStyle,
             storyTone: requestPayload.storyTone,
             theme: requestPayload.theme,
             people: requestPayload.people,
             objects: requestPayload.objects,
             excitementElement: requestPayload.excitementElement,
             isDoubleSpread: requestPayload.isDoubleSpread,
             pageLength: requestPayload.pageCount,
          };

          setBookData({
            bookId: result.bookId,
            assets: finalAssets,
            pages: null,
            settings: finalSettingsForContext,
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

  return (
    <div className="py-8 px-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" className="mr-2" onClick={() => window.history.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">Create Your Story</h1>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileInputChange} className="hidden" multiple accept="image/jpeg,image/png,image/heic,image/heif" />

      {/* TEMP: Using type assertion until StoryboardEditor props are updated */}
      {(StoryboardEditor as any)({
          initialAssets: uploadedAssets,
          onTriggerUpload: isUploading ? undefined : triggerUpload,
          droppedAssets: droppedAssets,
          onDroppedAssetsChange: setDroppedAssets,
          editorSettings: editorSettings,
          onEditorSettingsChange: setEditorSettings,
          pageCount: pageCount,
          onPageCountChange: setPageCount,
      })}

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