"use strict";
"use client"; // Layouts using context/state need to be client components
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
exports.useBookCreation = exports.BookCreationContext = void 0;
exports.default = CreateLayout;
const react_1 = __importStar(require("react"));
// --- End Type Definitions ---
// --- Context Definition & Provider (Moved Here) ---
// Export the context itself
exports.BookCreationContext = (0, react_1.createContext)(undefined);
// Export the custom hook for easy consumption
const useBookCreation = () => {
    const context = (0, react_1.useContext)(exports.BookCreationContext);
    if (!context) {
        throw new Error('useBookCreation must be used within a BookCreationProvider defined in CreateLayout');
    }
    return context;
};
exports.useBookCreation = useBookCreation;
// Provider component (doesn't need export if only used here)
const BookCreationProvider = ({ children }) => {
    const [bookData, setBookData] = (0, react_1.useState)(null);
    return (<exports.BookCreationContext.Provider value={{ bookData, setBookData }}>
      {children}
    </exports.BookCreationContext.Provider>);
};
// --- End Context --- 
// Layout Component
function CreateLayout({ children }) {
    // Wrap all child pages (like /create and /create/review) with the provider
    return (<BookCreationProvider>
      {children}
    </BookCreationProvider>);
}
