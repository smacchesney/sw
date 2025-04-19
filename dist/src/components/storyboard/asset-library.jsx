"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraggableAsset = void 0;
const react_1 = __importDefault(require("react"));
const image_1 = __importDefault(require("next/image"));
const core_1 = require("@dnd-kit/core");
const utilities_1 = require("@dnd-kit/utilities");
const lucide_react_1 = require("lucide-react");
const button_1 = require("@/components/ui/button");
// Export the component
const DraggableAsset = ({ asset, isUsed }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = (0, core_1.useDraggable)({
        id: asset.id,
        data: { asset },
        disabled: isUsed, // Disable dragging if the asset is used
    });
    const style = transform ? {
        transform: utilities_1.CSS.Translate.toString(transform),
        zIndex: isDragging ? 100 : 'auto',
        cursor: isDragging ? 'grabbing' : (isUsed ? 'not-allowed' : 'grab'), // Adjust cursor
    } : {
        cursor: isUsed ? 'not-allowed' : 'grab', // Default cursor
    };
    return (<div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`h-20 w-20 border rounded overflow-hidden bg-background relative flex-shrink-0 
        ${isDragging ? 'opacity-50 shadow-lg' : ''} 
        ${isUsed ? 'opacity-40' : ''}
      `}>
      <image_1.default src={asset.thumbnailUrl} alt={`User uploaded asset ${asset.id}`} fill style={{ objectFit: 'cover' }} sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw" draggable={false}/>
      {isUsed && (<div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          {/* Optional: Add a checkmark icon here */}
          {/* <Check className="h-6 w-6 text-white" /> */}
        </div>)}
    </div>);
};
exports.DraggableAsset = DraggableAsset;
const AssetLibrary = ({ assets, usedAssetIds, onTriggerUpload }) => {
    return (<div className="flex flex-wrap gap-2 h-full items-center overflow-x-auto">
      <button_1.Button variant="outline" className="h-20 w-20 border-dashed flex-col flex-shrink-0" onClick={onTriggerUpload} aria-label="Add photos">
        <lucide_react_1.PlusSquare className="h-8 w-8 text-muted-foreground mb-1"/>
        <span className="text-xs text-muted-foreground">Add</span>
      </button_1.Button>

      {assets && assets.length > 0 ? (assets.map((asset) => (<exports.DraggableAsset key={asset.id} asset={asset} isUsed={usedAssetIds.includes(asset.id)}/>))) : (<div className="text-center text-muted-foreground text-sm p-4">
          <p>Click "Add" to upload photos.</p>
        </div>)}
    </div>);
};
exports.default = AssetLibrary;
