"use client"; // Add this directive

import React from 'react';
import Link from 'next/link'; // Import Link
import Image from 'next/image';
import { BookStatus, Page } from '@prisma/client'; // Import BookStatus and Page
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Trash2, Copy, Pencil, Eye, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LibraryBook } from '@/app/library/actions'; // Assuming this type includes pages or coverImageUrl

// Define the props for BookCard, ensuring all needed fields are present
// We might need to adjust this if LibraryBook from actions.ts has a different structure
export interface BookCardProps {
  id: string;
  title: string | null; // Allow null titles
  status: BookStatus;
  updatedAt?: Date | null; // Make updatedAt optional
  pages?: Page[]; // Make pages optional
  coverImageUrl?: string | null; // Allow null cover image
  onDeleteClick: () => void;
  onDuplicateClick: () => void;
  isDeleting?: boolean;
  isDuplicating?: boolean;
}

// Helper function to get status badge variant (can be moved to utils if used elsewhere)
const getStatusVariant = (status: BookStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case BookStatus.COMPLETED:
      return 'default';
    case BookStatus.ILLUSTRATING:
    case BookStatus.GENERATING:
      return 'secondary';
    case BookStatus.FAILED:
      return 'destructive';
    case BookStatus.DRAFT:
    default:
      return 'outline';
  }
};

const BookCard: React.FC<BookCardProps> = ({
  id,
  title,
  updatedAt,
  status,
  pages,
  coverImageUrl,
  onDeleteClick,
  onDuplicateClick,
  isDeleting = false,
  isDuplicating = false,
}) => {
  const router = useRouter();

  const handleEditClick = () => {
    // TODO: Implement navigation to the correct editor step based on book status
    router.push(`/create?bookId=${id}`); // Example: Navigate to a generic create/edit page
  };

  const cardContent = (
    <>
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-lg truncate">{title || 'Untitled Book'}</CardTitle>
        <CardDescription>Last updated: {updatedAt ? new Date(updatedAt).toLocaleDateString() : 'N/A'}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col pt-2"> {/* Ensure content grows and uses flex */}
        <div className="aspect-video bg-muted rounded-md mb-2 overflow-hidden relative flex-shrink-0">
          {/* Check if pages exists before accessing it */}
          {coverImageUrl || (pages && pages.length > 0 && pages[0].generatedImageUrl) ? (
            <Image
              // Add nullish coalescing for safety, though the condition above should prevent null/undefined
              src={coverImageUrl || pages?.[0]?.generatedImageUrl || ''} 
              alt={`${title || 'Book'} cover`}
              fill
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 25vw"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xs text-muted-foreground">No Preview</span>
            </div>
          )}
        </div>
        <div className="mt-auto"> {/* Push badge to bottom */}
            <Badge variant={getStatusVariant(status)}>{status}</Badge>
        </div>
      </CardContent>
    </>
  );

  const isLink = status === BookStatus.COMPLETED;

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow h-full"> {/* Ensure Card takes full height */}
      {isLink ? (
        <Link href={`/book/${id}/preview`} className="flex flex-col flex-grow focus:outline-none focus:ring-2 focus:ring-primary rounded-lg overflow-hidden">
          {cardContent}
        </Link>
      ) : (
        <div className="flex flex-col flex-grow overflow-hidden"> {/* Non-link wrapper needs similar layout */}
            {cardContent}
        </div>
      )}

      {/* Actions Footer - Always outside the Link/wrapper */}
      <CardFooter className="flex justify-end pt-2 flex-shrink-0"> {/* Prevent footer shrinking */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isDeleting || isDuplicating}>
              {isDeleting || isDuplicating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
              <span className="sr-only">Book Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isLink ? (
              <DropdownMenuItem onClick={() => router.push(`/book/${id}/preview`)}>
                <Eye className="mr-2 h-4 w-4" /> View Preview
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleEditClick} disabled={status === BookStatus.GENERATING || status === BookStatus.ILLUSTRATING}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDuplicateClick} disabled={isDuplicating}>
              <Copy className="mr-2 h-4 w-4" /> Duplicate
            </DropdownMenuItem>
            {/* Add other relevant actions like Share or Download PDF later */}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={onDeleteClick} disabled={isDeleting}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
};

export default BookCard; 