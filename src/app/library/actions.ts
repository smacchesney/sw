"use server"; // Mark this file as containing Server Actions

import { auth } from "@clerk/nextjs/server";
import { db as prisma } from "@/lib/db"; // Use named import
import { Prisma, Book, BookStatus, Page } from "@prisma/client"; // Use @prisma/client directly
import { revalidatePath } from 'next/cache'; // Import for revalidation

// Define the structure of the book data needed by the card
// Use imported Book type
type BookForCard = Pick<Book, 'id' | 'title' | 'status' | 'createdAt' | 'childName' | 'updatedAt'> & {
  thumbnailUrl?: string | null;
  // Explicitly include optional pages for thumbnail lookup
  pages?: Pick<Page, 'generatedImageUrl'>[]; 
};

export interface LibraryBook extends BookForCard {}

export interface UserBooksResult {
  inProgressBooks: LibraryBook[];
  completedBooks: LibraryBook[];
}

export async function getUserBooks(): Promise<UserBooksResult> {
  const logger = (await import('@/lib/logger')).default;
  const { userId } = await auth();

  if (!userId) {
    logger.error("Attempted to fetch books without authentication.");
     return { inProgressBooks: [], completedBooks: [] };
  }

  logger.info({ userId }, "Fetching books for user library.");

  try {
    // Select necessary fields, including the first page's image URL for thumbnail
    const books = await prisma.book.findMany({
      where: { userId: userId },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        childName: true,
        // Remove coverImageUrl if it doesn't exist in schema
        pages: { // Select only the first page's image URL
          select: {
            generatedImageUrl: true
          },
          orderBy: {
            pageNumber: Prisma.SortOrder.asc // Use Prisma.SortOrder
          },
          take: 1 
        }
      },
      orderBy: { updatedAt: Prisma.SortOrder.desc }, // Use Prisma.SortOrder
    });

    // Map to LibraryBook type, deriving thumbnailUrl
    const libraryBooks: LibraryBook[] = books.map(book => ({
      id: book.id,
      title: book.title,
      status: book.status,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      childName: book.childName,
      pages: book.pages as Pick<Page, 'generatedImageUrl'>[] | undefined, // Cast pages type
      thumbnailUrl: book.pages?.[0]?.generatedImageUrl || null // Use first page image
    }));

    const inProgressBooks = libraryBooks.filter(book => book.status !== BookStatus.COMPLETED);
    const completedBooks = libraryBooks.filter(book => book.status === BookStatus.COMPLETED);

    logger.info({ userId, inProgressCount: inProgressBooks.length, completedCount: completedBooks.length }, "Successfully fetched user books.");
    return { inProgressBooks, completedBooks };

  } catch (error) {
    logger.error({ userId, error }, "Failed to fetch user books.");
    return { inProgressBooks: [], completedBooks: [] };
  }
}

export async function deleteBook(bookId: string): Promise<{ success: boolean; message?: string }> {
  const logger = (await import('@/lib/logger')).default;
  const { userId } = await auth();

  if (!userId) {
    logger.error({ bookId }, "Attempted to delete book without authentication.");
    return { success: false, message: "Authentication required." };
  }

  logger.info({ userId, bookId }, "Attempting to delete book.");

  try {
    const book = await prisma.book.findUnique({
      where: {
        id: bookId,
        userId: userId,
      },
      select: { id: true }, 
    });

    if (!book) {
      logger.warn({ userId, bookId }, "Attempted to delete non-existent or unauthorized book.");
      return { success: false, message: "Book not found or access denied." };
    }

    await prisma.book.delete({
      where: {
        id: bookId,
      },
    });

    logger.info({ userId, bookId }, "Successfully deleted book.");
    revalidatePath('/library');
    return { success: true };

  } catch (error) {
    logger.error({ userId, bookId, error }, "Failed to delete book.");
    return { success: false, message: "Failed to delete book. Please try again." };
  }
}

export async function duplicateBook(bookId: string): Promise<{ success: boolean; message?: string, newBookId?: string }>
{
  const logger = (await import('@/lib/logger')).default;
  const { userId } = await auth();

  if (!userId) {
    logger.error({ bookId }, "Attempted to duplicate book without authentication.");
    return { success: false, message: "Authentication required." };
  }

  logger.info({ userId, bookId }, "Attempting to duplicate book.");

  try {
    const originalBook = await prisma.book.findUnique({
      where: {
        id: bookId,
        userId: userId,
      },
      // Select only fields needed for duplication
      select: {
        title: true,
        childName: true,
        pageLength: true,
        artStyle: true,
        tone: true,
        typography: true,
        theme: true,
        keyCharacters: true,
        specialObjects: true,
        excitementElement: true,
        userId: true,
        // Remove fields not needed for duplication
        // createdAt: true,
        // updatedAt: true,
        // coverImageUrl: true, 
        // pages: { ... } 
      }
    });

    if (!originalBook) {
      logger.warn({ userId, bookId }, "Attempted to duplicate non-existent or unauthorized book.");
      return { success: false, message: "Book not found or access denied." };
    }

    const newBookRecord = await prisma.book.create({
      data: {
        title: `${originalBook.title} (Copy)`,
        childName: originalBook.childName,
        pageLength: originalBook.pageLength,
        artStyle: originalBook.artStyle,
        tone: originalBook.tone,
        typography: originalBook.typography,
        theme: originalBook.theme,
        keyCharacters: originalBook.keyCharacters,
        specialObjects: originalBook.specialObjects,
        excitementElement: originalBook.excitementElement,
        userId: originalBook.userId,
        status: BookStatus.DRAFT, 
      },
      select: { id: true } // Only need the new ID
    });

    logger.info({ userId, originalBookId: bookId, newBookId: newBookRecord.id }, "Successfully duplicated book.");
    revalidatePath('/library');

    // Return only the ID, not the full object
    return { success: true, newBookId: newBookRecord.id };

  } catch (error) {
    logger.error({ userId, bookId, error }, "Failed to duplicate book.");
    return { success: false, message: "Failed to duplicate book. Please try again." };
  }
} 