"use strict";
"use client"; // Add this directive
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookCard = BookCard;
const card_1 = require("@/components/ui/card");
const badge_1 = require("@/components/ui/badge");
const button_1 = require("@/components/ui/button");
const dropdown_menu_1 = require("@/components/ui/dropdown-menu");
const aspect_ratio_1 = require("@/components/ui/aspect-ratio");
const lucide_react_1 = require("lucide-react");
const image_1 = __importDefault(require("next/image"));
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation"); // Import useRouter
// Import BookStatus from the new generated client location (Task 16.3)
const client_1 = require("@/generated/prisma/client");
// Utility function to format dates (can be moved to a dedicated utils file later)
const formatDate = (date) => {
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(date);
};
// Define status badge variants based on imported BookStatus enum
const statusStyles = {
    [client_1.BookStatus.DRAFT]: "bg-yellow-100 text-yellow-800 border-yellow-300",
    [client_1.BookStatus.GENERATING]: "bg-blue-100 text-blue-800 border-blue-300 animate-pulse",
    [client_1.BookStatus.COMPLETED]: "bg-green-100 text-green-800 border-green-300",
    [client_1.BookStatus.FAILED]: "bg-red-100 text-red-800 border-red-300", // Add style for FAILED status
};
function BookCard({ id, title, status, createdAt, thumbnailUrl, childName, onDeleteClick, // Destructure the new prop
onDuplicateClick, // Destructure the new prop
 }) {
    const router = (0, navigation_1.useRouter)(); // Initialize router
    const placeholderImage = "/placeholder-cover.png"; // Add a real placeholder image to public/
    const handleEdit = () => {
        // Navigate to the editor page (adjust path if needed)
        router.push(`/edit/${id}`);
    };
    return (<card_1.Card className="flex flex-col h-full overflow-hidden group transition-shadow hover:shadow-md">
      <card_1.CardHeader className="p-0 relative">
        {/* Thumbnail Area */}
        <aspect_ratio_1.AspectRatio ratio={3 / 4}>
          <link_1.default href={`/book/${id}`} passHref> {/* Link to book details/editor */}
            <image_1.default src={thumbnailUrl || placeholderImage} alt={`Cover for ${title}`} fill className="object-cover transition-transform group-hover:scale-105" sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"/>
          </link_1.default>
        </aspect_ratio_1.AspectRatio>
        {/* Actions Menu */}
        <div className="absolute top-2 right-2 z-10">
           <dropdown_menu_1.DropdownMenu>
            <dropdown_menu_1.DropdownMenuTrigger asChild>
              <button_1.Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-white/80 hover:bg-white">
                <lucide_react_1.MoreVertical className="h-4 w-4"/>
                <span className="sr-only">Book Actions</span>
              </button_1.Button>
            </dropdown_menu_1.DropdownMenuTrigger>
            <dropdown_menu_1.DropdownMenuContent align="end">
              <dropdown_menu_1.DropdownMenuItem onSelect={handleEdit}>Edit</dropdown_menu_1.DropdownMenuItem>
              <dropdown_menu_1.DropdownMenuItem onSelect={() => onDuplicateClick(id)}>Duplicate</dropdown_menu_1.DropdownMenuItem>
              <dropdown_menu_1.DropdownMenuSeparator />
              <dropdown_menu_1.DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onSelect={() => onDeleteClick(id)} // Call the passed function
    >
                Delete
              </dropdown_menu_1.DropdownMenuItem>
            </dropdown_menu_1.DropdownMenuContent>
          </dropdown_menu_1.DropdownMenu>
        </div>
      </card_1.CardHeader>
      <card_1.CardContent className="p-4 flex-grow">
        {/* Title and Child Name */}
        <link_1.default href={`/book/${id}`} passHref>
            <card_1.CardTitle className="text-lg font-semibold mb-1 line-clamp-2 hover:text-primary">
                {title}
            </card_1.CardTitle>
        </link_1.default>
         <p className="text-sm text-muted-foreground mb-2">{childName}</p>
      </card_1.CardContent>
      <card_1.CardFooter className="p-4 pt-0 flex justify-between items-center text-xs text-muted-foreground">
        {/* Status Badge */}
         <badge_1.Badge variant="outline" className={`text-xs ${statusStyles[status]}`}>
          {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
        </badge_1.Badge>
        {/* Creation Date */}
        <span>{formatDate(createdAt)}</span>
      </card_1.CardFooter>
    </card_1.Card>);
}
