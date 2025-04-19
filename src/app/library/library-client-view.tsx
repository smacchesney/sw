"use client"; // Mark as Client Component

import { useState, useMemo, startTransition } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { BookCard } from "@/components/book-card";
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
// Consider adding a toast library for user feedback (e.g., Sonner)

interface LibraryClientViewProps {
  initialData: UserBooksResult;
}

type SortOption = 'updatedAt' | 'title'; // Add 'createdAt' later if needed

export function LibraryClientView({ initialData }: LibraryClientViewProps) {
  const [sortBy, setSortBy] = useState<SortOption>('updatedAt'); // Default sort
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<LibraryBook | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null); // Track which book is duplicating

  // Use useMemo to sort data based on the selected option
  const sortedInProgress = useMemo(() => {
    return [...initialData.inProgressBooks].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      // Default to updatedAt (most recent first) - assuming fetched data is already sorted this way
      // If fetching doesn't sort, add date comparison here:
      // return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); 
      return 0; // Keep initial server sort order for now
    });
  }, [initialData.inProgressBooks, sortBy]);

  const sortedCompleted = useMemo(() => {
    return [...initialData.completedBooks].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      // Default to updatedAt
      return 0; // Keep initial server sort order for now
    });
  }, [initialData.completedBooks, sortBy]);

  const openDeleteDialog = (book: LibraryBook) => {
    setBookToDelete(book);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!bookToDelete) return;

    setIsDeleting(true);
    try {
      // Using startTransition can help manage pending states for Server Actions
      startTransition(async () => {
        const result = await deleteBook(bookToDelete.id);
        if (result.success) {
          logger.info(`Book deleted: ${bookToDelete.id}`);
          // Revalidation should happen via revalidatePath in the action
          // Optionally show success toast
        } else {
          logger.error(`Failed to delete book: ${result.message}`);
          // Optionally show error toast
        }
        setIsDeleteDialogOpen(false);
        setBookToDelete(null);
      });
    } catch (error) {
        logger.error("Error during delete transition", error);
         // Optionally show error toast
        setIsDeleteDialogOpen(false);
        setBookToDelete(null);
    } finally {
       // It might be better to set isDeleting false *after* the transition completes,
       // but for simplicity, we do it here. A more complex state might be needed.
       setIsDeleting(false);
    }
  };

  const handleDuplicate = async (bookId: string) => {
    setIsDuplicating(bookId); // Set which book is being duplicated
     try {
        // Using startTransition for UI updates during server action
        startTransition(async () => {
            const result = await duplicateBook(bookId);
            if (result.success) {
                logger.info(`Book duplicated: ${bookId} -> ${result.newBookId}`);
                // Revalidation should happen via revalidatePath in the action
                // Optionally show success toast
            } else {
                logger.error(`Failed to duplicate book ${bookId}: ${result.message}`);
                // Optionally show error toast
            }
             setIsDuplicating(null); // Clear duplicating state regardless of outcome
        });
     } catch (error) {
        logger.error(`Error during duplicate transition for book ${bookId}`, error);
         // Optionally show error toast
        setIsDuplicating(null); // Clear duplicating state
     }
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
         <h2 className="text-2xl font-semibold mb-4">In Progress ({sortedInProgress.length})</h2>
         {/* Render sortedInProgress */}
         {sortedInProgress.length === 0 ? (
             <Card><CardContent className="pt-6"><p className="text-muted-foreground">You have no books currently in progress. Start creating one!</p></CardContent></Card>
         ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                 {sortedInProgress.map((book: LibraryBook) => (
                     <BookCard 
                        key={book.id} 
                        {...book} 
                        onDeleteClick={() => openDeleteDialog(book)}
                        onDuplicateClick={() => handleDuplicate(book.id)}
                    />
                 ))}
             </div>
         )}
      </section>

      {/* Completed Section */}
      <section>
         <h2 className="text-2xl font-semibold mb-4">Completed ({sortedCompleted.length})</h2>
         {/* Render sortedCompleted */}
         {sortedCompleted.length === 0 ? (
             <Card><CardContent className="pt-6"><p className="text-muted-foreground">You haven't completed any books yet.</p></CardContent></Card>
         ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {sortedCompleted.map((book: LibraryBook) => (
                      <BookCard 
                        key={book.id} 
                        {...book} 
                        onDeleteClick={() => openDeleteDialog(book)}
                        onDuplicateClick={() => handleDuplicate(book.id)}
                    />
                  ))}
              </div>
         )}
      </section>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the book titled 
              <span className="font-semibold">"{bookToDelete?.title}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90" // Style delete button
            >
              {isDeleting ? "Deleting..." : "Yes, delete book"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 