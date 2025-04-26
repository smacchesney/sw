"use client"; // Mark this as a Client Component

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import RoughButton from "@/components/ui/rough-button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import AssetLibrary, { DraggableAsset } from './asset-library';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
  useDraggable,
  UniqueIdentifier
} from '@dnd-kit/core';
import Image from 'next/image';
import { X, ArrowLeft } from 'lucide-react'; // Removed unused icons
import { CSS } from '@dnd-kit/utilities';
import {
  Panel,
  PanelGroup,
  // PanelResizeHandle removed
} from "react-resizable-panels";
import { cn } from "@/lib/utils"; // Assuming cn utility exists
import { useRouter } from 'next/navigation';
import RoughBorder from '@/components/ui/rough-border'; // Re-import RoughBorder
import RoughInputWrapper from "@/components/ui/rough-input-wrapper"; // Import the wrapper

// --- Style Library Type (Mirroring structure from styleLibrary.ts) ---
// Define locally as importing types from CJS can be tricky
type StyleOption = {
  label: string;
  descriptor: string;
};
type StyleLibrary = Record<string, StyleOption>;
// ---

// --- Type Definitions (Align with CreateBookPage and Zod Schema) ---
type Asset = {
  id: string;
  thumbnailUrl: string;
};
type DroppedAssets = Record<number | string, string | null>;
type PageCount = 8 | 12 | 16;
type EditorSettings = {
  bookTitle: string;
  childName: string;
  // pageLength removed as it's handled by pageCount prop
  artStyle: string;
  storyTone: string;
  // typography: string; // Removed/Commented out if not needed
  theme?: string;
  people?: string; // Use key matching Zod schema
  objects?: string; // Use key matching Zod schema
  excitementElement?: string; // Use key matching Zod schema
  isDoubleSpread: boolean;
};
// --- End Type Definitions ---

// Remove local artStyleOptions
// const artStyleOptions = [...];

// Story Tone options can remain local if not defined elsewhere
const storyToneOptions = [
  { id: 'tone1', label: 'Playful & Fun' },
  { id: 'tone2', label: 'Gentle & Cozy' },
  { id: 'tone3', label: 'Adventurous' },
];

// --- Constants --- 
const TITLE_PAGE_ID = 'title-page'; // Unique ID for the title slot

// Droppable Grid Cell Component
interface DroppableCellProps {
  id: number | string; // Changed from index to id
  droppedAssetId: string | null;
  assets: Asset[];
  onRemove: (id: number | string) => void; // Changed from index to id
  isTitle?: boolean; // Optional flag for styling/text
}

const DroppableCell: React.FC<DroppableCellProps> = ({ id, droppedAssetId, assets, onRemove, isTitle = false }) => {
  const cellRef = useRef<HTMLDivElement>(null); 
  const [dimensions, setDimensions] = useState({ width: 150, height: 150 }); 

  useEffect(() => {
    if (cellRef.current) {
      const { offsetWidth, offsetHeight } = cellRef.current;
      setDimensions({ width: offsetWidth, height: offsetHeight });
    }
  }, []); 

  const droppedAsset = droppedAssetId ? assets.find(a => a.id === droppedAssetId) : null;
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({ id: id });
  const draggableId = droppedAsset ? `cell-${id}-${droppedAsset.id}` : `placeholder-${id}`;
  const { 
    attributes: draggableAttributes,
    listeners: draggableListeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: draggableId,
    data: { origin: 'grid', asset: droppedAsset, sourceId: id },
    disabled: !droppedAsset,
  });

  const combinedStyle = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    zIndex: isDragging ? 100 : 'auto',
    cursor: isDragging ? 'grabbing' : (droppedAsset ? 'grab' : 'default'),
  };

  const handleRemoveMouseDown = (event: React.MouseEvent) => {
    event.stopPropagation();
    onRemove(id);
  };

  const combinedRef = (node: HTMLElement | null) => {
    setDroppableNodeRef(node);
    if (droppedAsset) {
      setDraggableNodeRef(node);
    }
    cellRef.current = node as HTMLDivElement;
  };

  return (
    <div
      ref={combinedRef}
      key={id}
      style={combinedStyle} 
      className={cn(
        `rounded-md w-[150px] aspect-square flex items-center justify-center p-1 relative overflow-hidden flex-shrink-0`,
        isOver ? 'bg-primary/10' : 'bg-background',
        isDragging ? 'opacity-30' : ''
      )}
      {...(droppedAsset ? draggableListeners : {})} 
      {...(droppedAsset ? draggableAttributes : {})} 
    >
      <RoughBorder 
        width={dimensions.width} 
        height={dimensions.height} 
        options={{ 
          stroke: isOver ? 'hsl(var(--primary))' : '#333333',
          strokeWidth: isOver ? 3 : 2.5,
        }}
      />
      
      {droppedAsset ? (
        <>
          <Image 
            src={droppedAsset.thumbnailUrl}
            alt={`Dropped asset ${droppedAsset.id}`}
            fill
            style={{ objectFit: 'cover' }}
            draggable={false}
            className="rounded-sm p-1"
          />
          <Button 
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 transition-opacity z-50"
            onMouseDown={handleRemoveMouseDown}
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <span className="text-sm text-muted-foreground z-10"> 
          {isTitle ? 'Title Page' : `Page ${Number(id) + 1}`}
        </span>
      )}
    </div>
  );
}

// --- Updated Props Interface --- 
interface StoryboardEditorProps {
  initialAssets?: Asset[];
  onTriggerUpload?: () => void;
  droppedAssets: DroppedAssets;
  onDroppedAssetsChange: (newDroppedAssets: DroppedAssets) => void;
  editorSettings: Partial<EditorSettings>;
  onEditorSettingsChange: (newSettings: Partial<EditorSettings>) => void;
  pageCount: PageCount; // Added prop
  onPageCountChange: (count: PageCount) => void; // Added prop
  styleLibrary: StyleLibrary; // Add styleLibrary prop
}
// --- End Props Interface --- 

const StoryboardEditor: React.FC<StoryboardEditorProps> = ({
  initialAssets = [],
  onTriggerUpload,
  droppedAssets,
  onDroppedAssetsChange,
  editorSettings,
  onEditorSettingsChange,
  pageCount,
  onPageCountChange,
  styleLibrary // Destructure the new prop
}) => {
  const panelGroupRef = useRef<HTMLDivElement>(null); // Add ref back
  const [panelGroupDimensions, setPanelGroupDimensions] = useState({ width: 0, height: 0 }); // Add state back

  // --- Internal State (Only for component-specific UI state) --- 
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeDragData, setActiveDragData] = useState<any>(null);
  // Removed internal state for: pageCount, droppedAssets, title, childName, artStyle, etc.

  // --- Derived State (Uses props) --- 
  const gridItemsCount = pageCount; // Use prop
  const gridItems = Array.from({ length: gridItemsCount }, (_, i) => i);
  const usedAssetIds = useMemo(() => 
    Object.values(droppedAssets).filter(id => id !== null) as string[]
  , [droppedAssets]); // Use prop
  const activeAsset = useMemo(() => {
      if (!activeId) return null;
      if (activeDragData?.origin === 'grid') return activeDragData.asset as Asset | null;
      return assets.find(a => a.id === activeId);
  }, [assets, activeId, activeDragData]);

  useEffect(() => {
    setAssets(initialAssets);
  }, [initialAssets]);

  // Add effect back for PanelGroup dimensions
  useEffect(() => {
    if (panelGroupRef.current) {
      const { offsetWidth, offsetHeight } = panelGroupRef.current;
      setPanelGroupDimensions({ width: offsetWidth, height: offsetHeight });

      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          setPanelGroupDimensions({ 
            width: entry.contentRect.width, 
            height: entry.contentRect.height 
          });
        }
      });
      resizeObserver.observe(panelGroupRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  // --- Event Handlers (Use callback props) --- 
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
    setActiveDragData(event.active.data.current); 
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    const activeData = active.data.current;
    setActiveId(null); 
    setActiveDragData(null);

    if (!over || !active || !activeData) return; 

    const targetId = over.id as (number | string); // Can be number or 'title-page'
    const sourceId = activeData?.sourceId as (number | string | null); // Can be number, 'title-page', or null (from library)
    const origin = activeData?.origin as (string | null);

    if (sourceId === targetId) return; // No change if dropped on itself

    const newDroppedAssets = { ...droppedAssets };

    // Case 1: Drag from Library to a Cell (Title or Story)
    if (origin !== 'grid') {
      const assetIdToDrop = typeof active.id === 'string' ? active.id : null;
      if (assetIdToDrop) {
          // If target already has an item, store it temporarily
          const displacedAssetId = newDroppedAssets[targetId] || null;
          // Place the new asset
          newDroppedAssets[targetId] = assetIdToDrop;
          // If sourceId was a grid cell (which it isn't here, but for completeness)
          // if (sourceId !== null && sourceId !== TITLE_PAGE_ID) {
          //    newDroppedAssets[sourceId] = displacedAssetId; // Put displaced item back
          // } else if (sourceId === TITLE_PAGE_ID) { ... }
      }
    } 
    // Case 2: Drag from Grid Cell to Grid Cell (Title or Story)
    else if (origin === 'grid' && sourceId !== null) {
        const draggedAssetId = activeData.asset?.id || null;
        const assetIdInTarget = newDroppedAssets[targetId] || null;

        if (draggedAssetId) {
            newDroppedAssets[targetId] = draggedAssetId; // Move dragged to target
            newDroppedAssets[sourceId] = assetIdInTarget; // Move target's content (or null) to source
        }
    }

    onDroppedAssetsChange(newDroppedAssets);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveDragData(null);
  };

  const handleRemoveAssetLocal = (idToRemove: number | string) => {
     onDroppedAssetsChange({ 
         ...droppedAssets, 
         [idToRemove]: null 
     });
  };
  const finalRemoveHandler = handleRemoveAssetLocal;

  // Helper for settings changes
  const handleSettingChange = (key: keyof EditorSettings, value: any) => {
    onEditorSettingsChange({
      ...editorSettings,
      [key]: value,
    });
  };

  // --- Render Logic (Use props for values and callbacks for changes) --- 
  return (
    <div className="flex flex-col h-[calc(100vh-var(--site-header-height)-var(--site-footer-height)-100px)] w-full">
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        {/* Re-add wrapper div and ref for PanelGroup border */}
        <div ref={panelGroupRef} className="relative flex-grow w-full">
          <PanelGroup 
            direction="horizontal" 
            className="flex-grow w-full h-full bg-muted/20" // Ensure it fills the wrapper
            autoSaveId="storyboardEditorLayout-v2" 
          >
            {/* Center Area Panel */}
            <Panel id="center-area" defaultSize={75} minSize={50}> 
              <PanelGroup direction="vertical"> 
                {/* Main Canvas Panel */}
                <Panel 
                  id="main-canvas" 
                  defaultSize={80} 
                  minSize={20} 
                  className="flex items-center justify-center p-4 overflow-auto bg-background"
                >
                  <div className="flex flex-wrap justify-center items-start gap-4 w-full p-4">
                    {/* --- Title Cell (Now Droppable/Draggable) --- */}
                    <DroppableCell
                      id={TITLE_PAGE_ID}
                      droppedAssetId={droppedAssets[TITLE_PAGE_ID] || null}
                      assets={assets}
                      onRemove={finalRemoveHandler}
                      isTitle={true}
                    />

                    {/* --- Droppable Story Page Cells --- */}
                    {gridItems.map((_, index) => (
                      <DroppableCell
                        key={index} 
                        id={index} // Pass numeric index as id
                        droppedAssetId={droppedAssets[index] || null}
                        assets={assets}
                        onRemove={finalRemoveHandler}
                      />
                    ))}
                  </div>
                </Panel>
                {/* Bottom Tray Panel (Asset Library) */}
                <Panel id="bottom-tray" defaultSize={15} minSize={10} maxSize={20} className="flex-shrink-0 border-t bg-muted/40 overflow-hidden p-2">
                  <AssetLibrary assets={assets} usedAssetIds={usedAssetIds} onTriggerUpload={onTriggerUpload}/>
                </Panel>
              </PanelGroup>
            </Panel>

            {/* Right Panel - Let it resize, but constrain content */}
            <Panel 
              id="right-controls" 
              className="!overflow-y-auto p-4 bg-muted/40 border-l hidden md:block" 
            >
              <div className="space-y-6"> 
                 <div className="space-y-2">
                   <h4 className="text-sm font-semibold text-foreground mb-1">Book Title</h4>
                   <RoughInputWrapper>
                     <Input 
                       id="bookTitle" 
                       placeholder="e.g., The Magical Adventure" 
                       value={editorSettings.bookTitle || ''} 
                       onChange={(e) => handleSettingChange('bookTitle', e.target.value)} 
                       className="border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                     />
                   </RoughInputWrapper>
                 </div>
                 <div className="space-y-2">
                   <h4 className="text-sm font-semibold text-foreground mb-1">Child's Name</h4>
                   <RoughInputWrapper>
                     <Input 
                       id="childName" 
                       placeholder="e.g., Alex" 
                       value={editorSettings.childName || ''} 
                       onChange={(e) => handleSettingChange('childName', e.target.value)} 
                       className="border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                     />
                   </RoughInputWrapper>
                 </div>
                 <div className="space-y-2">
                   <TooltipProvider><Tooltip><TooltipTrigger asChild>
                      <h4 className="text-sm font-semibold text-foreground mb-1">Page Count</h4>
                   </TooltipTrigger><TooltipContent><p>Total pages (8, 12, or 16).</p></TooltipContent></Tooltip></TooltipProvider>
                   <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))' }}>
                     {[8, 12, 16].map(count => (
                        <RoughButton 
                          key={count} 
                          variant={pageCount === count ? "default" : "outline"} 
                          size="sm"
                          onClick={() => onPageCountChange(count as PageCount)} 
                          type="button"
                          isSelected={pageCount === count}
                        >
                          {count}
                        </RoughButton>
                      ))}
                   </div>
                 </div>
                 <div className="space-y-2 pt-4 border-t mt-4">
                   <TooltipProvider><Tooltip><TooltipTrigger asChild>
                      <h4 className="text-sm font-semibold text-foreground mb-1">Art Style</h4>
                   </TooltipTrigger><TooltipContent><p>Visual style for illustrations.</p></TooltipContent></Tooltip></TooltipProvider>
                   <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}>
                      {Object.entries(styleLibrary).map(([styleKey, styleOption]) => (
                        <RoughButton 
                          key={styleKey} 
                          variant={editorSettings.artStyle === styleKey ? "default" : "outline"} 
                          size="sm" 
                          onClick={() => handleSettingChange('artStyle', styleKey)} 
                          type="button"
                          isSelected={editorSettings.artStyle === styleKey}
                        >
                          {styleOption.label}
                        </RoughButton>
                      ))}
                   </div>
                 </div>
                 <div className="space-y-2">
                   <h4 className="text-sm font-semibold text-foreground mb-1">Story Tone</h4>
                   <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}>
                      {storyToneOptions.map(tone => (
                        <RoughButton 
                          key={tone.id} 
                          variant={editorSettings.storyTone === tone.id ? "default" : "outline"} 
                          size="sm" 
                          onClick={() => handleSettingChange('storyTone', tone.id)} 
                          type="button"
                          isSelected={editorSettings.storyTone === tone.id}
                        >
                          {tone.label}
                        </RoughButton>
                      ))}
                   </div>
                 </div>
                 <div className="space-y-2">
                   <h4 className="text-sm font-semibold text-foreground mb-1">Theme / Core Subject</h4>
                   <RoughInputWrapper>
                     <Input 
                       id="theme" 
                       placeholder="e.g., Bedtime, Friendship" 
                       value={editorSettings.theme || ''} 
                       onChange={(e) => handleSettingChange('theme', e.target.value)} 
                       className="border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                     />
                   </RoughInputWrapper>
                 </div>
                 <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground mb-1">Excitement Element</h4>
                    <RoughInputWrapper>
                      <Textarea 
                        id="excitementElement" 
                        placeholder="e.g., plot twist, discovery" 
                        value={editorSettings.excitementElement || ''} 
                        onChange={(e) => handleSettingChange('excitementElement', e.target.value)} 
                        className="border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </RoughInputWrapper>
                 </div>
               </div>
            </Panel>
          </PanelGroup>
          {/* Adjust PanelGroup RoughBorder style */}
          {panelGroupDimensions.width > 0 && panelGroupDimensions.height > 0 && (
              <RoughBorder
                  width={panelGroupDimensions.width}
                  height={panelGroupDimensions.height}
                  options={{ 
                      stroke: '#000000', // Black color
                      strokeWidth: 1.5, // Thinner
                      roughness: 1, // Less rough
                  }}
              />
          )}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeAsset ? (
            <div style={{ width: 100, height: 100 }}><Image src={activeAsset.thumbnailUrl} alt="Dragging asset" fill style={{ objectFit: 'cover' }} className="rounded border" /></div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default StoryboardEditor; 