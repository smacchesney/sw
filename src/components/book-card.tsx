"use client"; // Add this directive

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { MoreVertical } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation'; // Import useRouter
// Import BookStatus from the new generated client location (Task 16.3)
import { BookStatus } from "@/generated/prisma/client"; 

// Define the props based on the Book model and potential needs
// Extend with other fields from the Book model as needed
interface BookCardProps {
  id: string;
  title: string;
  status: BookStatus; // Use imported enum
  createdAt: Date;
  thumbnailUrl?: string | null; // Assuming a field for the cover/thumbnail
  childName: string | null; // Allow null based on actions.ts type definition
  onDeleteClick: (bookId: string) => void; // Add this prop
  onDuplicateClick: (bookId: string) => void; // Add this prop
}

// Utility function to format dates (can be moved to a dedicated utils file later)
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

// Define status badge variants based on imported BookStatus enum
const statusStyles: Record<BookStatus, string> = {
  [BookStatus.DRAFT]: "bg-yellow-100 text-yellow-800 border-yellow-300",
  [BookStatus.GENERATING]: "bg-blue-100 text-blue-800 border-blue-300 animate-pulse",
  [BookStatus.COMPLETED]: "bg-green-100 text-green-800 border-green-300",
  [BookStatus.FAILED]: "bg-red-100 text-red-800 border-red-300", // Add style for FAILED status
};

export function BookCard({
  id,
  title,
  status,
  createdAt,
  thumbnailUrl,
  childName,
  onDeleteClick, // Destructure the new prop
  onDuplicateClick, // Destructure the new prop
}: BookCardProps) {
  const router = useRouter(); // Initialize router
  const placeholderImage = "/placeholder-cover.png"; // Add a real placeholder image to public/

  const handleEdit = () => {
    // Navigate to the editor page (adjust path if needed)
    router.push(`/edit/${id}`); 
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden group transition-shadow hover:shadow-md">
      <CardHeader className="p-0 relative">
        {/* Thumbnail Area */}
        <AspectRatio ratio={3 / 4}>
          <Link href={`/book/${id}`} passHref> {/* Link to book details/editor */}
            <Image
              src={thumbnailUrl || placeholderImage}
              alt={`Cover for ${title}`}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </Link>
        </AspectRatio>
        {/* Actions Menu */}
        <div className="absolute top-2 right-2 z-10">
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-white/80 hover:bg-white">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Book Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleEdit}>Edit</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDuplicateClick(id)}>Duplicate</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive focus:bg-destructive/10" 
                onSelect={() => onDeleteClick(id)} // Call the passed function
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        {/* Title and Child Name */}
        <Link href={`/book/${id}`} passHref>
            <CardTitle className="text-lg font-semibold mb-1 line-clamp-2 hover:text-primary">
                {title}
            </CardTitle>
        </Link>
         <p className="text-sm text-muted-foreground mb-2">{childName}</p>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex justify-between items-center text-xs text-muted-foreground">
        {/* Status Badge */}
         <Badge variant="outline" className={`text-xs ${statusStyles[status]}`}>
          {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
        </Badge>
        {/* Creation Date */}
        <span>{formatDate(createdAt)}</span>
      </CardFooter>
    </Card>
  );
} 