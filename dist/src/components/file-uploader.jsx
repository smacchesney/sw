"use strict";
"use client";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUploader = FileUploader;
const react_1 = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
const utils_1 = require("@/lib/utils"); // Assuming cn utility exists from shadcn/ui setup
function FileUploader({ onFilesSelected, onError, className, acceptedFileTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'], // Default image types
maxFileSize = 10 * 1024 * 1024, // Default 10MB
multiple = true, }) {
    const [isDragging, setIsDragging] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null); // State for validation errors
    const fileInputRef = (0, react_1.useRef)(null);
    const validateFiles = (0, react_1.useCallback)((files) => {
        const validFiles = [];
        const errors = [];
        files.forEach(file => {
            // Type validation
            if (acceptedFileTypes && !acceptedFileTypes.includes(file.type)) {
                errors.push(`File type not supported: ${file.name} (${file.type})`);
                return; // Skip this file
            }
            // Size validation
            if (maxFileSize && file.size > maxFileSize) {
                errors.push(`File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB). Max size is ${(maxFileSize / 1024 / 1024).toFixed(0)}MB.`);
                return; // Skip this file
            }
            // If valid, add to the list
            validFiles.push(file);
        });
        if (errors.length > 0) {
            const errorMessage = errors.join('\n');
            setError(errorMessage);
            if (onError) {
                onError(errorMessage);
            }
            // Return only valid files, even if there were errors with others
            return validFiles;
        }
        else {
            setError(null); // Clear previous errors if all files are valid
            return validFiles;
        }
    }, [acceptedFileTypes, maxFileSize, onError]); // Added dependencies
    // Update handlers to use validateFiles
    const handleFileChange = (event) => {
        setError(null); // Clear error on new selection attempt
        if (event.target.files) {
            const filesArray = Array.from(event.target.files);
            const validFiles = validateFiles(filesArray);
            if (validFiles.length > 0) {
                onFilesSelected(validFiles);
            }
            event.target.value = '';
        }
    };
    const handleDrop = (0, react_1.useCallback)((event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        setError(null); // Clear error on new drop
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            const filesArray = Array.from(event.dataTransfer.files);
            const validFiles = validateFiles(filesArray);
            if (validFiles.length > 0) {
                onFilesSelected(validFiles);
            }
            event.dataTransfer.clearData();
        }
    }, [onFilesSelected, validateFiles]); // Added validateFiles dependency
    // Handler for clicking the drop zone to trigger file input
    const handleAreaClick = () => {
        var _a;
        (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click();
    };
    // Handlers for drag-and-drop events
    const handleDragEnter = (0, react_1.useCallback)((event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
    }, []);
    const handleDragLeave = (0, react_1.useCallback)((event) => {
        event.preventDefault();
        event.stopPropagation();
        // Check relatedTarget to prevent flickering when dragging over child elements
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsDragging(false);
        }
    }, []);
    const handleDragOver = (0, react_1.useCallback)((event) => {
        event.preventDefault(); // Necessary to allow drop
        event.stopPropagation();
        setIsDragging(true); // Keep highlighting
    }, []);
    return (<div className={(0, utils_1.cn)("border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200 ease-in-out", error ? "border-destructive bg-destructive/10" // Error state style
            : isDragging ? "border-primary bg-primary/10"
                : "border-muted-foreground/50 hover:border-primary hover:bg-primary/5 bg-background", className)} onClick={handleAreaClick} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} role="button" aria-label="File upload area" tabIndex={0} // Make it focusable
     onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ')
        handleAreaClick(); }} // Allow activation with keyboard
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" // Hide the default input
     multiple={multiple} // Allow multiple files by default, can be controlled via props later
     accept={acceptedFileTypes ? acceptedFileTypes.join(',') : undefined} // Set accept attribute
    />
      <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none"> {/* Prevent pointer events on children during drag */}
        {error ? (<>
            <lucide_react_1.AlertCircle className="h-12 w-12 text-destructive"/>
             {/* Displaying error message - might need refinement for multiple lines */}
            <p className="text-destructive text-sm whitespace-pre-line">{error}</p> 
            <p className="text-muted-foreground text-xs">Please try again.</p>
          </>) : (<>
            <lucide_react_1.UploadCloud className={(0, utils_1.cn)("h-12 w-12 text-muted-foreground", isDragging && "text-primary")}/>
            <p className="text-muted-foreground">
              Drag & drop photos here, or{" "}
              <span className="font-semibold text-primary">click to browse</span>
            </p>
            <p className="text-xs text-muted-foreground">
               Supports: {acceptedFileTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}. Max {(maxFileSize / 1024 / 1024).toFixed(0)}MB.
             </p>
          </>)}
      </div>
    </div>);
}
