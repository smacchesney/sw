"use client"; // Mark as Client Component

import React, { useState, useMemo, useTransition } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import BookCard from "@/components/book-card";
import { LibraryBook, UserBooksResult, deleteBook, duplicateBook } from "./actions"; // Import deleteBook and duplicateBook
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import logger from '@/lib/logger'; // Import logger for client-side logs if needed
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Trash2, Copy, Pencil, Eye } from 'lucide-react'; // Added Eye icon
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Book, BookStatus } from '@prisma/client'; // Import BookStatus
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

interface LibraryClientViewProps {
  initialData: UserBooksResult;
}

type SortOption = 'updatedAt' | 'title'; // Add 'createdAt' later if needed

export function LibraryClientView({ initialData }: LibraryClientViewProps) {
  const [sortBy, setSortBy] = useState<SortOption>('updatedAt'); // Default sort
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<LibraryBook | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null); // Track which book is duplicating
  const router = useRouter();

  // Use useMemo to sort data based on the selected option
  const sortedBooks = useMemo(() => {
    return [...initialData.inProgressBooks, ...initialData.completedBooks].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      // Default to updatedAt (most recent first) - assuming fetched data is already sorted this way
      // If fetching doesn't sort, add date comparison here:
      // return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); 
      return 0; // Keep initial server sort order for now
    });
  }, [initialData.inProgressBooks, initialData.completedBooks, sortBy]);

  const inProgressBooks = sortedBooks.filter(book => book.status !== BookStatus.COMPLETED);
  const completedBooks = sortedBooks.filter(book => book.status === BookStatus.COMPLETED);

  const openDeleteDialog = (book: LibraryBook) => {
    setBookToDelete(book);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (!bookToDelete) return;

    startDeleteTransition(async () => {
      try {
        const result = await deleteBook(bookToDelete.id);
        if (result.success) {
          logger.info(`Book deleted: ${bookToDelete.id}`);
          // Revalidation should happen via revalidatePath in the action
          toast.success(`Book "${bookToDelete.title}" deleted successfully.`);
        } else {
          logger.error(`Failed to delete book: ${result.message}`);
          toast.error("Failed to delete book. Please try again.");
        }
        setIsDeleteDialogOpen(false);
        setBookToDelete(null);
      } catch (error) {
        logger.error("Error during delete transition", error);
        toast.error("Failed to delete book. Please try again.");
        setIsDeleteDialogOpen(false);
        setBookToDelete(null);
      }
    });
  };

  const handleDuplicate = (bookId: string) => {
    if (isDuplicating) return; // Prevent double clicks
    setIsDuplicating(bookId); // Set the ID of the book being duplicated
    
    startDeleteTransition(async () => {
      try {
        const result = await duplicateBook(bookId);
        if (result.success && result.newBookId) { 
            logger.info(`Book duplicated: ${bookId} -> ${result.newBookId}`);
            toast.success(`Book duplicated successfully.`);
        } else {
            logger.error(`Failed to duplicate book ${bookId}: ${result.message}`);
            toast.error("Failed to duplicate book. Please try again.");
        }
        setIsDuplicating(null); // Clear duplicating state regardless of outcome
      } catch (error) {
        logger.error(`Error during duplicate transition for book ${bookId}`, error);
        toast.error("Failed to duplicate book. Please try again.");
        setIsDuplicating(null); // Clear duplicating state
      }
    });
  };

  const handleEditClick = (bookId: string) => {
    // TODO: Implement navigation to the correct editor step based on book status
    router.push(`/create?bookId=${bookId}`); // Example: Navigate to a generic create/edit page
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">My Library</h1>
        <div className="flex items-center gap-2">
          {/* Sorting Control */}
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">Last Modified</SelectItem>
              <SelectItem value="title">Title</SelectItem>
              {/* <SelectItem value="createdAt">Date Created</SelectItem> */}
            </SelectContent>
          </Select>
          {/* Create Button */}
          <Link href="/create" passHref>
            <Button>Create New Book</Button>
          </Link>
        </div>
      </div>

      {/* In Progress Section */}
      <section className="mb-8">
         <h2 className="text-2xl font-semibold mb-4">In Progress ({inProgressBooks.length})</h2>
         {/* Render sortedInProgress */}
         {inProgressBooks.length === 0 ? (
             <Card><CardContent className="pt-6"><p className="text-muted-foreground">You have no books currently in progress. Start creating one!</p></CardContent></Card>
         ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                 {inProgressBooks.map((book: LibraryBook) => (
                     <BookCard
                         key={book.id}
                         {...book}
                         isDeleting={isDeleting && bookToDelete?.id === book.id}
                         isDuplicating={isDuplicating === book.id}
                         onDeleteClick={() => openDeleteDialog(book)}
                         onDuplicateClick={() => handleDuplicate(book.id)}
                     />
                 ))}
             </div>
         )}
      </section>

      {/* Completed Section */}
      <section>
         <h2 className="text-2xl font-semibold mb-4">Completed ({completedBooks.length})</h2>
         {/* Render sortedCompleted */}
         {completedBooks.length === 0 ? (
             <Card><CardContent className="pt-6"><p className="text-muted-foreground">You haven't completed any books yet.</p></CardContent></Card>
         ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {completedBooks.map((book: LibraryBook) => (
                      <BookCard
                          key={book.id}
                          {...book}
                          isDeleting={isDeleting && bookToDelete?.id === book.id}
                          isDuplicating={isDuplicating === book.id}
                          onDeleteClick={() => openDeleteDialog(book)}
                          onDuplicateClick={() => handleDuplicate(book.id)}
                      />
                  ))}
              </div>
         )}
      </section>

      {/* Empty State */}
      {sortedBooks.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg">
          <p className="text-muted-foreground mb-4">You haven't created any books yet.</p>
          <Link href="/create">
            <Button>Start Your First Story</Button>
          </Link>
        </div>
      )}

      {/* Loading Skeleton (Optional, if initial load is slow) */}
      {/* {isLoading && <LibrarySkeleton />} */}

      {/* Alert Dialog for Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the book
              <span className="font-semibold"> "{bookToDelete?.title || 'Untitled Book'}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(isDeleting ? "bg-destructive/80" : "bg-destructive hover:bg-destructive/90")}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Optional Skeleton Component
// const LibrarySkeleton = () => (
//   <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
//     {[...Array(8)].map((_, i) => (
//       <Card key={i}>
//         <CardHeader className="pb-2">
//           <Skeleton className="h-5 w-3/4" />
//           <Skeleton className="h-4 w-1/2" />
//         </CardHeader>
//         <CardContent>
//           <Skeleton className="aspect-video rounded-md mb-2" />
//           <Skeleton className="h-5 w-1/4" />
//         </CardContent>
//         <CardFooter className="flex justify-end">
//           <Skeleton className="h-8 w-8 rounded-full" />
//         </CardFooter>
//       </Card>
//     ))}
//   </div>
// ); 