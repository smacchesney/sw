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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CreateBookPage;
const react_1 = __importStar(require("react"));
const navigation_1 = require("next/navigation");
const storyboard_editor_1 = __importDefault(require("@/components/storyboard/storyboard-editor"));
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
const sonner_1 = require("sonner");
const layout_1 = require("./layout");
// Main Page Component
function CreateBookPage() {
    const router = (0, navigation_1.useRouter)();
    const { setBookData } = (0, layout_1.useBookCreation)();
    const [uploadedAssets, setUploadedAssets] = (0, react_1.useState)([]);
    const [droppedAssets, setDroppedAssets] = (0, react_1.useState)({});
    const [editorSettings, setEditorSettings] = (0, react_1.useState)({ isDoubleSpread: false, theme: '', people: '', objects: '', excitementElement: '' });
    const [pageCount, setPageCount] = (0, react_1.useState)(8);
    const [isGenerating, setIsGenerating] = (0, react_1.useState)(false);
    const [isUploading, setIsUploading] = (0, react_1.useState)(false);
    const fileInputRef = (0, react_1.useRef)(null);
    const handleUploadComplete = (newAssets) => {
        setUploadedAssets(prevAssets => [...prevAssets, ...newAssets]);
    };
    // Upload logic (calls API)
    const handleFileInputChange = async (event) => {
        if (event.target.files && event.target.files.length > 0) {
            const files = Array.from(event.target.files);
            setIsUploading(true);
            sonner_1.toast.info(`Uploading ${files.length} file(s)...`);
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
                    sonner_1.toast.success(`${result.assets.length} file(s) uploaded successfully!`);
                }
                else {
                    sonner_1.toast.warning("Upload completed, but no assets were returned.");
                }
            }
            catch (error) {
                console.error("File Upload Error:", error);
                sonner_1.toast.error(`Error uploading files: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            finally {
                setIsUploading(false);
                if (fileInputRef.current)
                    fileInputRef.current.value = '';
            }
        }
    };
    const triggerUpload = () => { var _a; return (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); };
    // Story Generation Logic
    const handleGenerateStory = async () => {
        var _a, _b, _c, _d;
        setIsGenerating(true);
        const orderedAssetIds = Object.values(droppedAssets).filter((id) => id !== null);
        const requiredFields = ['artStyle', 'storyTone', 'isDoubleSpread'];
        const missingRequiredFields = requiredFields.filter(key => editorSettings[key] === undefined);
        const missingOrEmptyBookTitle = !((_a = editorSettings.bookTitle) === null || _a === void 0 ? void 0 : _a.trim());
        const missingOrEmptyChildName = !((_b = editorSettings.childName) === null || _b === void 0 ? void 0 : _b.trim());
        let errorMessages = [];
        if (orderedAssetIds.length === 0)
            errorMessages.push("Please add at least one photo.");
        if (missingOrEmptyBookTitle)
            errorMessages.push("Book Title is required.");
        if (missingOrEmptyChildName)
            errorMessages.push("Child's Name is required.");
        if (missingRequiredFields.length > 0)
            errorMessages.push(`Missing settings: ${missingRequiredFields.join(', ')}`);
        if (errorMessages.length > 0) {
            sonner_1.toast.error(errorMessages.join("\n"));
            setIsGenerating(false);
            return;
        }
        // Construct flat payload matching API schema
        const requestPayload = {
            bookTitle: editorSettings.bookTitle,
            childName: editorSettings.childName,
            pageCount: pageCount,
            artStyle: editorSettings.artStyle,
            storyTone: editorSettings.storyTone,
            isDoubleSpread: editorSettings.isDoubleSpread,
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
                throw new Error(((_d = (_c = errorData.details) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.message) || errorData.error || `Story generation failed: ${response.statusText}`);
            }
            if (response.status === 202) {
                const result = await response.json();
                console.log("Generation Job Accepted:", result);
                if (!result.bookId) {
                    throw new Error("API did not return a bookId after accepting the job.");
                }
                const finalAssets = orderedAssetIds
                    .map(id => uploadedAssets.find(asset => asset.id === id))
                    .filter((asset) => asset !== undefined);
                const finalSettingsForContext = {
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
                sonner_1.toast.info("Story generation started! Moving to review page...");
                router.push('/create/review');
            }
            else {
                console.warn("Received unexpected success status:", response.status);
                sonner_1.toast.error("Received an unexpected response from the server.");
            }
        }
        catch (error) {
            console.error("Story Generation Error:", error);
            sonner_1.toast.error(`Error generating story: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            setIsGenerating(false);
        }
    };
    return (<div className="py-8 px-4">
      <div className="flex items-center mb-6">
        <button_1.Button variant="ghost" size="icon" className="mr-2" onClick={() => window.history.back()}>
          <lucide_react_1.ArrowLeft className="h-5 w-5"/>
        </button_1.Button>
        <h1 className="text-3xl font-bold">Create Your Story</h1>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileInputChange} className="hidden" multiple accept="image/jpeg,image/png,image/heic,image/heif"/>

      {/* TEMP: Using type assertion until StoryboardEditor props are updated */}
      {storyboard_editor_1.default({
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
         <button_1.Button onClick={handleGenerateStory} disabled={isGenerating || isUploading}>
            {isGenerating ? (<><lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/> Generating...</>) : ('Generate & Review Story')}
          </button_1.Button>
      </div>
    </div>);
}
