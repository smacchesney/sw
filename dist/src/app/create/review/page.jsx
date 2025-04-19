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
exports.default = ReviewPage;
const react_1 = __importStar(require("react"));
const image_1 = __importDefault(require("next/image"));
const button_1 = require("@/components/ui/button");
const textarea_1 = require("@/components/ui/textarea");
const navigation_1 = require("next/navigation");
const layout_1 = require("@/app/create/layout");
const sonner_1 = require("sonner");
const lucide_react_1 = require("lucide-react");
const POLLING_INTERVAL = 5000; // Check every 5 seconds
function ReviewPage() {
    var _a;
    const router = (0, navigation_1.useRouter)();
    const { bookData } = (0, layout_1.useBookCreation)();
    // State hooks
    const [pages, setPages] = (0, react_1.useState)([]);
    const [currentIndex, setCurrentIndex] = (0, react_1.useState)(0);
    const [confirmed, setConfirmed] = (0, react_1.useState)([]);
    const [isLoadingText, setIsLoadingText] = (0, react_1.useState)(false);
    const [initialLoadComplete, setInitialLoadComplete] = (0, react_1.useState)(false);
    const pollingIntervalRef = (0, react_1.useRef)(null);
    // --- Polling Logic --- 
    (0, react_1.useEffect)(() => {
        // Only run setup once after initial bookData is available
        if (!bookData || initialLoadComplete)
            return;
        setInitialLoadComplete(true); // Mark initial setup as done
        const initialPageData = bookData.assets.map((asset, index) => {
            var _a, _b;
            return ({
                text: ((_b = (_a = bookData.pages) === null || _a === void 0 ? void 0 : _a[index]) === null || _b === void 0 ? void 0 : _b.generatedText) || null,
                imageUrl: asset.thumbnailUrl,
                assetId: asset.id,
            });
        });
        setPages(initialPageData);
        setConfirmed(initialPageData.map(() => false));
        setCurrentIndex(0);
        if (bookData.pages) {
            // Add explicit types for map parameters
            const loadedPageData = bookData.assets.map((asset, index) => {
                var _a, _b;
                return ({
                    text: ((_b = (_a = bookData.pages) === null || _a === void 0 ? void 0 : _a[index]) === null || _b === void 0 ? void 0 : _b.generatedText) || '',
                    imageUrl: asset.thumbnailUrl,
                    assetId: asset.id,
                });
            });
            setPages(loadedPageData);
            console.log("Using existing generated pages from context.");
            return;
        }
        // Start polling if pages are null in context
        if (!bookData.pages && bookData.bookId) {
            setIsLoadingText(true);
            console.log(`Starting polling for bookId: ${bookData.bookId}`);
            const checkStatus = async () => {
                if (!bookData.bookId)
                    return; // Should not happen, but safety check
                try {
                    const res = await fetch(`/api/book-status?bookId=${bookData.bookId}`);
                    if (!res.ok) {
                        throw new Error('Failed to fetch book status');
                    }
                    const data = await res.json();
                    console.log("Poll Status:", data.status);
                    if (data.status === 'COMPLETED') {
                        if (pollingIntervalRef.current)
                            clearInterval(pollingIntervalRef.current);
                        console.log("Book complete, fetching content...");
                        // Fetch actual content
                        const contentRes = await fetch(`/api/book-content?bookId=${bookData.bookId}`);
                        if (!contentRes.ok)
                            throw new Error('Failed to fetch book content');
                        const contentData = await contentRes.json();
                        if (contentData.pages) {
                            // Add explicit types for map parameters
                            const updatedPageData = bookData.assets.map((asset, index) => {
                                var _a;
                                return ({
                                    text: ((_a = contentData.pages[index]) === null || _a === void 0 ? void 0 : _a.text) || '',
                                    imageUrl: asset.thumbnailUrl,
                                    assetId: asset.id,
                                });
                            });
                            setPages(updatedPageData);
                            sonner_1.toast.success("Story generation complete!");
                        }
                        else {
                            throw new Error("Fetched content missing pages data.");
                        }
                        setIsLoadingText(false);
                    }
                    else if (data.status === 'FAILED') {
                        if (pollingIntervalRef.current)
                            clearInterval(pollingIntervalRef.current);
                        sonner_1.toast.error("Story generation failed. Please try again.");
                        setIsLoadingText(false);
                        // Optionally redirect or provide retry option
                    }
                    else {
                        // Still GENERATING or other status, continue polling
                    }
                }
                catch (error) {
                    console.error("Polling error:", error);
                    if (pollingIntervalRef.current)
                        clearInterval(pollingIntervalRef.current);
                    sonner_1.toast.error("Error checking story status.");
                    setIsLoadingText(false);
                }
            };
            // Initial check
            checkStatus();
            // Set up interval
            pollingIntervalRef.current = setInterval(checkStatus, POLLING_INTERVAL);
        }
        // Cleanup interval on unmount
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                console.log("Polling stopped.");
            }
        };
    }, [bookData, router, initialLoadComplete]); // Added initialLoadComplete dependency
    // Navigation handlers
    const goPrev = () => setCurrentIndex(i => Math.max(i - 1, 0));
    const goNext = () => setCurrentIndex(i => Math.min(i + 1, pages.length - 1));
    // Toggle confirmation per page
    const toggleConfirm = () => {
        setConfirmed(arr => {
            const copy = [...arr];
            copy[currentIndex] = !copy[currentIndex];
            return copy;
        });
    };
    // Regenerate Story handler
    const handleRegenerate = () => {
        if (window.confirm('Are you sure you want to regenerate the entire story? All edits will be lost.')) {
            console.log('Regenerating story...');
            // TODO: replace with real API call
            setPages([]);
            setConfirmed([]);
            setCurrentIndex(0);
        }
    };
    // Keyboard arrow navigation
    (0, react_1.useEffect)(() => {
        const handleKey = (e) => {
            if (e.key === 'ArrowLeft')
                goPrev();
            if (e.key === 'ArrowRight')
                goNext();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);
    const allConfirmed = pages.length > 0 && confirmed.every(c => c);
    // Handle loading/redirect state before rendering main UI
    if (!bookData) {
        return <div className="p-6">Loading review data...</div>;
    }
    // Don't render the full UI until initial load/setup is complete
    if (!initialLoadComplete || pages.length === 0) {
        return <div className="p-6">Initializing review page...</div>;
    }
    // Main Render
    return (<div className="flex h-[calc(100vh-var(--site-header-height)-var(--site-footer-height))] w-full">
      {/* Left Panel */}
      <div className="flex-2 p-6 bg-white flex flex-col">
        {/* Page Image */}
        <div className="flex-1 overflow-hidden rounded-lg shadow mb-4 bg-muted">
          <image_1.default src={pages[currentIndex].imageUrl} alt={`Page ${currentIndex + 1}`} width={400} height={400} className="object-cover w-full h-full"/>
        </div>
        {/* Editable Text Area or Loading State */}
        {isLoadingText ? (<div className="w-full h-40 mb-4 rounded-md border border-input bg-background px-3 py-2 flex items-center justify-center">
              <lucide_react_1.Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2"/>
              <span className="text-muted-foreground">Generating story text...</span>
            </div>) : (<textarea_1.Textarea className="w-full h-40 mb-4" value={((_a = pages[currentIndex]) === null || _a === void 0 ? void 0 : _a.text) || ''} onChange={(e) => {
                const newText = e.target.value;
                setPages(prev => {
                    const copy = [...prev];
                    copy[currentIndex] = Object.assign(Object.assign({}, copy[currentIndex]), { text: newText });
                    return copy;
                });
                // Reset confirmation when text changes
                setConfirmed(prev => {
                    const copy = [...prev];
                    copy[currentIndex] = false;
                    return copy;
                });
            }} readOnly={isLoadingText}/>)}
        {/* Navigation and Confirm Row */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-2">
            <button_1.Button onClick={goPrev} disabled={currentIndex === 0}>Previous</button_1.Button>
            <button_1.Button onClick={goNext} disabled={currentIndex === pages.length - 1}>Next</button_1.Button>
          </div>
          <div>
            <button_1.Button variant={confirmed[currentIndex] ? 'default' : 'outline'} onClick={toggleConfirm}>
              {confirmed[currentIndex] ? 'Page Confirmed' : 'Confirm Page'}
            </button_1.Button>
          </div>
          {/* Regenerate Story */}
          <div className="mt-4">
            <button_1.Button variant="ghost" onClick={handleRegenerate}>
              Regenerate Story
            </button_1.Button>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 p-6 bg-gray-100 overflow-auto">
        <h2 className="text-xl font-semibold mb-4">Review Pages ({currentIndex + 1}/{pages.length})</h2>
        <div className="space-y-2 mb-6">
          {pages.map((page, idx) => {
            const snippet = page.text
                ? (page.text.length > 50 ? page.text.slice(0, 50) + '...' : page.text)
                : '(Generating...)';
            return (<button_1.Button key={page.assetId || idx} variant={idx === currentIndex ? 'default' : 'outline'} size="sm" className={`w-full text-left p-2 rounded-lg justify-start h-auto whitespace-normal ${confirmed[idx] ? 'bg-green-50 border-2 border-green-500 text-green-700 hover:bg-green-100' : 'hover:bg-accent'}`} onClick={() => setCurrentIndex(idx)}>
                <span className="font-medium mr-2">{idx + 1}.</span>{snippet}
              </button_1.Button>);
        })}
        </div>
        {/* Illustrate button: always visible but disabled until all pages are confirmed */}
        <button_1.Button className="w-full" size="lg" disabled={!allConfirmed} variant={allConfirmed ? 'default' : 'outline'}>
          Illustrate My Book
        </button_1.Button>
      </div>
    </div>);
}
