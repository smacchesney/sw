import React from 'react';
import Image from 'next/image';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Placeholder Asset type (replace with actual Prisma type later)
type Asset = {
  id: string;
  thumbnailUrl: string;
  // Add other relevant fields like original URL, alt text, etc.
};

interface AssetLibraryProps {
  assets: Asset[];
  usedAssetIds: string[]; // Accept the list of used IDs
  onTriggerUpload?: () => void; // Add prop to accept the trigger function
}

// Draggable Asset Item Component
interface DraggableAssetProps {
  asset: Asset;
  isUsed: boolean; // Accept the isUsed flag
}

// Export the component
export const DraggableAsset: React.FC<DraggableAssetProps> = ({ asset, isUsed }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: asset.id,
    data: { asset },
    disabled: isUsed, // Disable dragging if the asset is used
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : 'auto',
    cursor: isDragging ? 'grabbing' : (isUsed ? 'not-allowed' : 'grab'), // Adjust cursor
  } : {
    cursor: isUsed ? 'not-allowed' : 'grab', // Default cursor
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`h-20 w-20 border rounded overflow-hidden bg-background relative flex-shrink-0 
        ${isDragging ? 'opacity-50 shadow-lg' : ''} 
        ${isUsed ? 'opacity-40' : ''}
      `}
    >
      <Image
        src={asset.thumbnailUrl}
        alt={`User uploaded asset ${asset.id}`}
        fill
        style={{ objectFit: 'cover' }}
        sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
        draggable={false}
      />
      {isUsed && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          {/* Optional: Add a checkmark icon here */}
          {/* <Check className="h-6 w-6 text-white" /> */}
        </div>
      )}
    </div>
  );
}

const AssetLibrary: React.FC<AssetLibraryProps> = ({ assets, usedAssetIds, onTriggerUpload }) => {
  return (
    <div className="flex flex-wrap gap-2 h-full items-center overflow-x-auto">
      <Button 
        variant="outline" 
        className="h-20 w-20 border-dashed flex-col flex-shrink-0"
        onClick={onTriggerUpload}
        aria-label="Add photos"
      >
        <PlusSquare className="h-8 w-8 text-muted-foreground mb-1" />
        <span className="text-xs text-muted-foreground">Add</span>
      </Button>

      {assets && assets.length > 0 ? (
        assets.map((asset) => (
          <DraggableAsset 
            key={asset.id} 
            asset={asset} 
            isUsed={usedAssetIds.includes(asset.id)}
          /> 
        ))
      ) : (
        <div className="text-center text-muted-foreground text-sm p-4">
          <p>Click "Add" to upload photos.</p>
        </div>
      )}
    </div>
  );
};

export default AssetLibrary; 