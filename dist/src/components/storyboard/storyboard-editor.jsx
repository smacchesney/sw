"use strict";
"use client"; // Mark this as a Client Component
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const label_1 = require("@/components/ui/label");
const input_1 = require("@/components/ui/input");
const button_1 = require("@/components/ui/button");
const textarea_1 = require("@/components/ui/textarea");
const tooltip_1 = require("@/components/ui/tooltip");
const asset_library_1 = __importDefault(require("./asset-library"));
const core_1 = require("@dnd-kit/core");
const image_1 = __importDefault(require("next/image"));
const lucide_react_1 = require("lucide-react"); // Removed unused icons
const utilities_1 = require("@dnd-kit/utilities");
const react_resizable_panels_1 = require("react-resizable-panels");
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
const DroppableCell = ({ index, droppedAssetId, assets, onRemove }) => {
    const droppedAsset = droppedAssetId ? assets.find(a => a.id === droppedAssetId) : null;
    const { setNodeRef: setDroppableNodeRef, isOver } = (0, core_1.useDroppable)({ id: index });
    const draggableId = droppedAsset ? `grid-${index}-${droppedAsset.id}` : `placeholder-${index}`;
    const { attributes: draggableAttributes, listeners: draggableListeners, setNodeRef: setDraggableNodeRef, transform, isDragging } = (0, core_1.useDraggable)({
        id: draggableId,
        data: { origin: 'grid', asset: droppedAsset, sourceIndex: index },
        disabled: !droppedAsset,
    });
    const combinedStyle = Object.assign(Object.assign({}, (transform ? { transform: utilities_1.CSS.Translate.toString(transform) } : {})), { zIndex: isDragging ? 100 : 'auto', cursor: isDragging ? 'grabbing' : (droppedAsset ? 'grab' : 'default') });
    // Original click handler (might not fire)
    const handleRemoveClick = (event) => {
        console.log("handleRemoveClick triggered for index:", index);
        // Logic moved to handleRemoveMouseDown
    };
    // MouseDown handler to stop propagation before drag starts
    const handleRemoveMouseDown = (event) => {
        console.log("handleRemoveMouseDown triggered for index:", index); // <-- Log for debugging
        event.stopPropagation(); // Stop event before dnd-kit listeners capture it
        onRemove(index); // Call the remove logic directly
    };
    const combinedRef = (node) => {
        setDroppableNodeRef(node);
        if (droppedAsset) {
            setDraggableNodeRef(node);
        }
    };
    return (<div ref={combinedRef} key={index} style={combinedStyle} className={`group border rounded-md w-[150px] aspect-square flex items-center justify-center p-1 relative overflow-hidden flex-shrink-0
        ${isOver ? 'border-primary border-2' : 'border-dashed bg-background'}
        ${isDragging ? 'opacity-30' : ''}
      `} {...(droppedAsset ? draggableListeners : {})} {...(droppedAsset ? draggableAttributes : {})}>
      {droppedAsset ? (<>
          <image_1.default src={droppedAsset.thumbnailUrl} alt={`Dropped asset ${droppedAsset.id}`} fill style={{ objectFit: 'cover' }} draggable={false}/>
          <button_1.Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 transition-opacity z-50" // Keep visible, high z-index
         onMouseDown={handleRemoveMouseDown} // Use onMouseDown
         aria-label="Remove image">
            <lucide_react_1.X className="h-4 w-4"/>
          </button_1.Button>
        </>) : (<span className="text-sm text-muted-foreground">
          Page {index + 1}
        </span>)}
    </div>);
};
// --- End Props Interface --- 
const StoryboardEditor = ({ initialAssets = [], onTriggerUpload, droppedAssets, onDroppedAssetsChange, editorSettings, onEditorSettingsChange, pageCount, onPageCountChange }) => {
    // --- Internal State (Only for component-specific UI state) --- 
    const [assets, setAssets] = (0, react_1.useState)(initialAssets);
    const [activeId, setActiveId] = (0, react_1.useState)(null);
    const [activeDragData, setActiveDragData] = (0, react_1.useState)(null);
    // Removed internal state for: pageCount, droppedAssets, title, childName, artStyle, etc.
    // --- Derived State (Uses props) --- 
    const gridItemsCount = pageCount; // Use prop
    const gridItems = Array.from({ length: gridItemsCount }, (_, i) => i);
    const usedAssetIds = (0, react_1.useMemo)(() => Object.values(droppedAssets).filter(id => id !== null), [droppedAssets]); // Use prop
    const activeAsset = (0, react_1.useMemo)(() => {
        if (!activeId)
            return null;
        if ((activeDragData === null || activeDragData === void 0 ? void 0 : activeDragData.origin) === 'grid')
            return activeDragData.asset;
        return assets.find(a => a.id === activeId);
    }, [assets, activeId, activeDragData]);
    (0, react_1.useEffect)(() => {
        setAssets(initialAssets);
    }, [initialAssets]);
    // --- Event Handlers (Use callback props) --- 
    const handleDragStart = (event) => {
        setActiveId(event.active.id);
        setActiveDragData(event.active.data.current);
    };
    const handleDragEnd = (event) => {
        const { over, active } = event;
        const activeData = active.data.current;
        setActiveId(null);
        setActiveDragData(null);
        if (!over || !active)
            return;
        const targetGridIndex = over.id;
        const sourceIndex = activeData === null || activeData === void 0 ? void 0 : activeData.sourceIndex;
        if (sourceIndex === targetGridIndex)
            return;
        // Grid to Grid (Swap)
        if ((activeData === null || activeData === void 0 ? void 0 : activeData.origin) === 'grid' && activeData.asset && sourceIndex !== null) {
            const draggedAssetId = activeData.asset.id;
            const assetIdInTarget = droppedAssets[targetGridIndex] || null;
            onDroppedAssetsChange(Object.assign(Object.assign({}, droppedAssets), { [targetGridIndex]: draggedAssetId, [sourceIndex]: assetIdInTarget }));
        }
        // Library to Grid (Place/Replace)
        else {
            let assetIdToDrop = null;
            if (typeof active.id === 'string' && assets.some(a => a.id === active.id)) {
                assetIdToDrop = active.id;
            }
            if (assetIdToDrop && typeof targetGridIndex === 'number') {
                onDroppedAssetsChange(Object.assign(Object.assign({}, droppedAssets), { [targetGridIndex]: assetIdToDrop }));
            }
        }
    };
    const handleDragCancel = () => {
        setActiveId(null);
        setActiveDragData(null);
    };
    const handleRemoveAsset = (indexToRemove) => {
        onDroppedAssetsChange(Object.assign(Object.assign({}, droppedAssets), { [indexToRemove]: null }));
    };
    // Helper for settings changes
    const handleSettingChange = (key, value) => {
        onEditorSettingsChange(Object.assign(Object.assign({}, editorSettings), { [key]: value }));
    };
    // --- Render Logic (Use props for values and callbacks for changes) --- 
    return (<div className="flex flex-col h-[calc(100vh-var(--site-header-height)-var(--site-footer-height)-100px)] w-full">
      <core_1.DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <react_resizable_panels_1.PanelGroup direction="horizontal" className="flex-grow w-full bg-muted/20" autoSaveId="storyboardEditorLayout-v2">
          {/* Center Area Panel */}
          <react_resizable_panels_1.Panel id="center-area" defaultSize={75} minSize={50}> 
            <react_resizable_panels_1.PanelGroup direction="vertical"> 
              {/* Main Canvas Panel */}
              <react_resizable_panels_1.Panel id="main-canvas" defaultSize={80} minSize={20} className="flex items-center justify-center p-4 overflow-auto bg-background">
                <div className={`flex flex-wrap justify-center gap-4 w-full p-4`}>
                  {gridItems.map((_, index) => (<DroppableCell key={index} index={index} droppedAssetId={droppedAssets[index] || null} // Use prop
         assets={assets} onRemove={handleRemoveAsset}/>))}
                </div>
              </react_resizable_panels_1.Panel>
              {/* Bottom Tray Panel (Asset Library) */}
              <react_resizable_panels_1.Panel id="bottom-tray" defaultSize={15} minSize={10} maxSize={20} className="flex-shrink-0 border-t bg-muted/40 overflow-hidden p-2">
                <asset_library_1.default assets={assets} usedAssetIds={usedAssetIds} onTriggerUpload={onTriggerUpload}/>
              </react_resizable_panels_1.Panel>
            </react_resizable_panels_1.PanelGroup>
          </react_resizable_panels_1.Panel>

          {/* Right Panel */}
          <react_resizable_panels_1.Panel id="right-controls" defaultSize={18} minSize={12} maxSize={25} className="!overflow-y-auto p-4 bg-muted/40 border-l hidden md:block">
            <div className="space-y-6">
               <h3 className="text-lg font-semibold">Configuration</h3>
               <div className="space-y-2">
                 <label_1.Label htmlFor="bookTitle">Book Title</label_1.Label>
                 <input_1.Input id="bookTitle" placeholder="e.g., The Magical Adventure" value={editorSettings.bookTitle || ''} onChange={(e) => handleSettingChange('bookTitle', e.target.value)}/>
               </div>
               <div className="space-y-2">
                 <label_1.Label htmlFor="childName">Child's Name</label_1.Label>
                 <input_1.Input id="childName" placeholder="e.g., Alex" value={editorSettings.childName || ''} onChange={(e) => handleSettingChange('childName', e.target.value)}/>
               </div>
               {/* Page Count Buttons */}
               <div className="space-y-2">
                 <tooltip_1.TooltipProvider><tooltip_1.Tooltip><tooltip_1.TooltipTrigger asChild><label_1.Label>Page Count</label_1.Label></tooltip_1.TooltipTrigger><tooltip_1.TooltipContent><p>Total pages (8, 12, or 16).</p></tooltip_1.TooltipContent></tooltip_1.Tooltip></tooltip_1.TooltipProvider>
                 <div className="grid grid-cols-3 gap-2">
                   {[8, 12, 16].map(count => (<button_1.Button key={count} variant={pageCount === count ? "default" : "outline"} // Use prop
         size="sm" onClick={() => onPageCountChange(count)} // Use callback prop
         type="button">
                        {count}
                      </button_1.Button>))}
                 </div>
               </div>
               <h3 className="text-lg font-semibold pt-4 border-t mt-4">AI Generation Settings</h3>
               {/* Art Style Buttons */}
               <div className="space-y-2">
                 <tooltip_1.TooltipProvider><tooltip_1.Tooltip><tooltip_1.TooltipTrigger asChild><label_1.Label>Art Style</label_1.Label></tooltip_1.TooltipTrigger><tooltip_1.TooltipContent><p>Visual style for illustrations.</p></tooltip_1.TooltipContent></tooltip_1.Tooltip></tooltip_1.TooltipProvider>
                 <div className="grid grid-cols-3 gap-2">
                    {artStyleOptions.map(style => (<button_1.Button key={style.id} variant={editorSettings.artStyle === style.id ? "default" : "outline"} size="sm" onClick={() => handleSettingChange('artStyle', style.id)} type="button">{style.label}</button_1.Button>))}
                 </div>
               </div>
               {/* Story Tone Buttons */}
               <div className="space-y-2">
                 <label_1.Label>Story Tone</label_1.Label>
                 <div className="grid grid-cols-3 gap-2">
                    {storyToneOptions.map(tone => (<button_1.Button key={tone.id} variant={editorSettings.storyTone === tone.id ? "default" : "outline"} size="sm" onClick={() => handleSettingChange('storyTone', tone.id)} type="button">{tone.label}</button_1.Button>))}
                 </div>
               </div>
               {/* Optional Inputs */}
               <div className="space-y-2">
                 <label_1.Label htmlFor="theme">Theme / Core Subject</label_1.Label>
                 <input_1.Input id="theme" placeholder="e.g., Bedtime, Friendship" value={editorSettings.theme || ''} onChange={(e) => handleSettingChange('theme', e.target.value)}/>
               </div>
               <div className="space-y-2">
                 <label_1.Label htmlFor="people">Key People</label_1.Label>
                 <input_1.Input id="people" placeholder="e.g., Mom, Dad, Leo" value={editorSettings.people || ''} onChange={(e) => handleSettingChange('people', e.target.value)}/>
               </div>
               <div className="space-y-2">
                 <label_1.Label htmlFor="objects">Important Objects</label_1.Label>
                 <input_1.Input id="objects" placeholder="e.g., teddy bear, red ball" value={editorSettings.objects || ''} onChange={(e) => handleSettingChange('objects', e.target.value)}/>
               </div>
               <div className="space-y-2">
                  <label_1.Label htmlFor="excitementElement">Excitement Element</label_1.Label>
                  <textarea_1.Textarea id="excitementElement" placeholder="e.g., plot twist, discovery" value={editorSettings.excitementElement || ''} onChange={(e) => handleSettingChange('excitementElement', e.target.value)}/>
               </div>
             </div>
          </react_resizable_panels_1.Panel>
        </react_resizable_panels_1.PanelGroup>

        {/* Drag Overlay */}
        <core_1.DragOverlay>
          {activeAsset ? (<div style={{ width: 100, height: 100 }}><image_1.default src={activeAsset.thumbnailUrl} alt="Dragging asset" fill style={{ objectFit: 'cover' }} className="rounded border"/></div>) : null}
        </core_1.DragOverlay>
      </core_1.DndContext>
    </div>);
};
exports.default = StoryboardEditor;
