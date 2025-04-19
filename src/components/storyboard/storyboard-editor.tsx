"use client"; // Mark this as a Client Component

import React, { useState, useEffect, useMemo } from 'react';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

// --- Type Definitions (Align with CreateBookPage and Zod Schema) ---
type Asset = {
  id: string;
  thumbnailUrl: string;
};
type DroppedAssets = Record<number, string | null>;
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

// Placeholder options (remain internal)
const artStyleOptions = [
  { id: 'style1', label: 'Cartoonish' },
  { id: 'style2', label: 'Watercolor' },
  { id: 'style3', label: 'Pixel Art' },
];
const storyToneOptions = [
  { id: 'tone1', label: 'Playful & Fun' },
  { id: 'tone2', label: 'Gentle & Cozy' },
  { id: 'tone3', label: 'Adventurous' },
];

// Droppable Grid Cell Component
interface DroppableCellProps {
  index: number;
  droppedAssetId: string | null;
  assets: Asset[];
  onRemove: (index: number) => void;
}

const DroppableCell: React.FC<DroppableCellProps> = ({ index, droppedAssetId, assets, onRemove }) => {
  const droppedAsset = droppedAssetId ? assets.find(a => a.id === droppedAssetId) : null;
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({ id: index });
  const draggableId = droppedAsset ? `grid-${index}-${droppedAsset.id}` : `placeholder-${index}`;
  const { 
    attributes: draggableAttributes,
    listeners: draggableListeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: draggableId,
    data: { origin: 'grid', asset: droppedAsset, sourceIndex: index },
    disabled: !droppedAsset,
  });

  const combinedStyle = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    zIndex: isDragging ? 100 : 'auto',
    cursor: isDragging ? 'grabbing' : (droppedAsset ? 'grab' : 'default'),
  };

  // Original click handler (might not fire)
  const handleRemoveClick = (event: React.MouseEvent) => {
    console.log("handleRemoveClick triggered for index:", index); 
    // Logic moved to handleRemoveMouseDown
  };

  // MouseDown handler to stop propagation before drag starts
  const handleRemoveMouseDown = (event: React.MouseEvent) => {
    console.log("handleRemoveMouseDown triggered for index:", index); // <-- Log for debugging
    event.stopPropagation(); // Stop event before dnd-kit listeners capture it
    onRemove(index); // Call the remove logic directly
  };

  const combinedRef = (node: HTMLElement | null) => {
    setDroppableNodeRef(node);
    if (droppedAsset) {
      setDraggableNodeRef(node);
    }
  };

  return (
    <div
      ref={combinedRef}
      key={index}
      style={combinedStyle} 
      className={`group border rounded-md w-[150px] aspect-square flex items-center justify-center p-1 relative overflow-hidden flex-shrink-0
        ${isOver ? 'border-primary border-2' : 'border-dashed bg-background'}
        ${isDragging ? 'opacity-30' : ''}
      `}
      {...(droppedAsset ? draggableListeners : {})} 
      {...(droppedAsset ? draggableAttributes : {})} 
    >
      {droppedAsset ? (
        <>
          <Image 
            src={droppedAsset.thumbnailUrl}
            alt={`Dropped asset ${droppedAsset.id}`}
            fill
            style={{ objectFit: 'cover' }}
            draggable={false}
          />
          <Button 
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 transition-opacity z-50" // Keep visible, high z-index
            onMouseDown={handleRemoveMouseDown} // Use onMouseDown
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">
          Page {index + 1}
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
  onPageCountChange
}) => {
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
    if (!over || !active) return; 
    const targetGridIndex = over.id as number;
    const sourceIndex = activeData?.sourceIndex as number | null;
    if (sourceIndex === targetGridIndex) return; 

    // Grid to Grid (Swap)
    if (activeData?.origin === 'grid' && activeData.asset && sourceIndex !== null) {
      const draggedAssetId = activeData.asset.id;
      const assetIdInTarget = droppedAssets[targetGridIndex] || null;
      onDroppedAssetsChange({
        ...droppedAssets,
        [targetGridIndex]: draggedAssetId,
        [sourceIndex]: assetIdInTarget,
      });
    } 
    // Library to Grid (Place/Replace)
    else {
      let assetIdToDrop: string | null = null;
      if (typeof active.id === 'string' && assets.some(a => a.id === active.id)) {
         assetIdToDrop = active.id;
      }
      if (assetIdToDrop && typeof targetGridIndex === 'number') {
        onDroppedAssetsChange({
          ...droppedAssets,
          [targetGridIndex]: assetIdToDrop,
        });
      }
    } 
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveDragData(null);
  };

  const handleRemoveAsset = (indexToRemove: number) => {
    onDroppedAssetsChange({
      ...droppedAssets,
      [indexToRemove]: null,
    });
  };

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
        <PanelGroup 
          direction="horizontal" 
          className="flex-grow w-full bg-muted/20" 
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
                <div className={`flex flex-wrap justify-center gap-4 w-full p-4`}>
                  {gridItems.map((_, index) => (
                    <DroppableCell
                      key={index}
                      index={index}
                      droppedAssetId={droppedAssets[index] || null} // Use prop
                      assets={assets}
                      onRemove={handleRemoveAsset}
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

          {/* Right Panel */}
          <Panel id="right-controls" defaultSize={18} minSize={12} maxSize={25} className="!overflow-y-auto p-4 bg-muted/40 border-l hidden md:block">
            <div className="space-y-6">
               <h3 className="text-lg font-semibold">Configuration</h3>
               <div className="space-y-2">
                 <Label htmlFor="bookTitle">Book Title</Label>
                 <Input id="bookTitle" placeholder="e.g., The Magical Adventure" value={editorSettings.bookTitle || ''} onChange={(e) => handleSettingChange('bookTitle', e.target.value)} />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="childName">Child's Name</Label>
                 <Input id="childName" placeholder="e.g., Alex" value={editorSettings.childName || ''} onChange={(e) => handleSettingChange('childName', e.target.value)} />
               </div>
               {/* Page Count Buttons */}
               <div className="space-y-2">
                 <TooltipProvider><Tooltip><TooltipTrigger asChild><Label>Page Count</Label></TooltipTrigger><TooltipContent><p>Total pages (8, 12, or 16).</p></TooltipContent></Tooltip></TooltipProvider>
                 <div className="grid grid-cols-3 gap-2">
                   {[8, 12, 16].map(count => (
                      <Button 
                        key={count} 
                        variant={pageCount === count ? "default" : "outline"} // Use prop
                        size="sm"
                        onClick={() => onPageCountChange(count as PageCount)} // Use callback prop
                        type="button"
                      >
                        {count}
                      </Button>
                    ))}
                 </div>
               </div>
               <h3 className="text-lg font-semibold pt-4 border-t mt-4">AI Generation Settings</h3>
               {/* Art Style Buttons */}
               <div className="space-y-2">
                 <TooltipProvider><Tooltip><TooltipTrigger asChild><Label>Art Style</Label></TooltipTrigger><TooltipContent><p>Visual style for illustrations.</p></TooltipContent></Tooltip></TooltipProvider>
                 <div className="grid grid-cols-3 gap-2">
                    {artStyleOptions.map(style => (
                      <Button key={style.id} variant={editorSettings.artStyle === style.id ? "default" : "outline"} size="sm" onClick={() => handleSettingChange('artStyle', style.id)} type="button">{style.label}</Button>
                    ))}
                 </div>
               </div>
               {/* Story Tone Buttons */}
               <div className="space-y-2">
                 <Label>Story Tone</Label>
                 <div className="grid grid-cols-3 gap-2">
                    {storyToneOptions.map(tone => (
                      <Button key={tone.id} variant={editorSettings.storyTone === tone.id ? "default" : "outline"} size="sm" onClick={() => handleSettingChange('storyTone', tone.id)} type="button">{tone.label}</Button>
                    ))}
                 </div>
               </div>
               {/* Optional Inputs */}
               <div className="space-y-2">
                 <Label htmlFor="theme">Theme / Core Subject</Label>
                 <Input id="theme" placeholder="e.g., Bedtime, Friendship" value={editorSettings.theme || ''} onChange={(e) => handleSettingChange('theme', e.target.value)} />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="people">Key People</Label>
                 <Input id="people" placeholder="e.g., Mom, Dad, Leo" value={editorSettings.people || ''} onChange={(e) => handleSettingChange('people', e.target.value)} />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="objects">Important Objects</Label>
                 <Input id="objects" placeholder="e.g., teddy bear, red ball" value={editorSettings.objects || ''} onChange={(e) => handleSettingChange('objects', e.target.value)} />
               </div>
               <div className="space-y-2">
                  <Label htmlFor="excitementElement">Excitement Element</Label>
                  <Textarea id="excitementElement" placeholder="e.g., plot twist, discovery" value={editorSettings.excitementElement || ''} onChange={(e) => handleSettingChange('excitementElement', e.target.value)} />
               </div>
             </div>
          </Panel>
        </PanelGroup>

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