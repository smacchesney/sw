"use strict";
"use client"; // Mark as Client Component
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibraryClientView = LibraryClientView;
const react_1 = require("react");
const button_1 = require("@/components/ui/button");
const card_1 = require("@/components/ui/card");
const link_1 = __importDefault(require("next/link"));
const book_card_1 = require("@/components/book-card");
const actions_1 = require("./actions"); // Import deleteBook and duplicateBook
const select_1 = require("@/components/ui/select");
const alert_dialog_1 = require("@/components/ui/alert-dialog");
const logger_1 = __importDefault(require("@/lib/logger")); // Import logger for client-side logs if needed
function LibraryClientView({ initialData }) {
    const [sortBy, setSortBy] = (0, react_1.useState)('updatedAt'); // Default sort
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = (0, react_1.useState)(false);
    const [bookToDelete, setBookToDelete] = (0, react_1.useState)(null);
    const [isDeleting, setIsDeleting] = (0, react_1.useState)(false);
    const [isDuplicating, setIsDuplicating] = (0, react_1.useState)(null); // Track which book is duplicating
    // Use useMemo to sort data based on the selected option
    const sortedInProgress = (0, react_1.useMemo)(() => {
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
    const sortedCompleted = (0, react_1.useMemo)(() => {
        return [...initialData.completedBooks].sort((a, b) => {
            if (sortBy === 'title') {
                return a.title.localeCompare(b.title);
            }
            // Default to updatedAt
            return 0; // Keep initial server sort order for now
        });
    }, [initialData.completedBooks, sortBy]);
    const openDeleteDialog = (book) => {
        setBookToDelete(book);
        setIsDeleteDialogOpen(true);
    };
    const handleDeleteConfirm = async () => {
        if (!bookToDelete)
            return;
        setIsDeleting(true);
        try {
            // Using startTransition can help manage pending states for Server Actions
            (0, react_1.startTransition)(async () => {
                const result = await (0, actions_1.deleteBook)(bookToDelete.id);
                if (result.success) {
                    logger_1.default.info(`Book deleted: ${bookToDelete.id}`);
                    // Revalidation should happen via revalidatePath in the action
                    // Optionally show success toast
                }
                else {
                    logger_1.default.error(`Failed to delete book: ${result.message}`);
                    // Optionally show error toast
                }
                setIsDeleteDialogOpen(false);
                setBookToDelete(null);
            });
        }
        catch (error) {
            logger_1.default.error("Error during delete transition", error);
            // Optionally show error toast
            setIsDeleteDialogOpen(false);
            setBookToDelete(null);
        }
        finally {
            // It might be better to set isDeleting false *after* the transition completes,
            // but for simplicity, we do it here. A more complex state might be needed.
            setIsDeleting(false);
        }
    };
    const handleDuplicate = async (bookId) => {
        setIsDuplicating(bookId); // Set which book is being duplicated
        try {
            // Using startTransition for UI updates during server action
            (0, react_1.startTransition)(async () => {
                const result = await (0, actions_1.duplicateBook)(bookId);
                if (result.success) {
                    logger_1.default.info(`Book duplicated: ${bookId} -> ${result.newBookId}`);
                    // Revalidation should happen via revalidatePath in the action
                    // Optionally show success toast
                }
                else {
                    logger_1.default.error(`Failed to duplicate book ${bookId}: ${result.message}`);
                    // Optionally show error toast
                }
                setIsDuplicating(null); // Clear duplicating state regardless of outcome
            });
        }
        catch (error) {
            logger_1.default.error(`Error during duplicate transition for book ${bookId}`, error);
            // Optionally show error toast
            setIsDuplicating(null); // Clear duplicating state
        }
    };
    return (<div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">My Library</h1>
        <div className="flex items-center gap-2">
          {/* Sorting Control */}
          <select_1.Select value={sortBy} onValueChange={(value) => setSortBy(value)}>
            <select_1.SelectTrigger className="w-[180px]">
              <select_1.SelectValue placeholder="Sort by..."/>
            </select_1.SelectTrigger>
            <select_1.SelectContent>
              <select_1.SelectItem value="updatedAt">Last Modified</select_1.SelectItem>
              <select_1.SelectItem value="title">Title</select_1.SelectItem>
              {/* <SelectItem value="createdAt">Date Created</SelectItem> */}
            </select_1.SelectContent>
          </select_1.Select>
          {/* Create Button */}
          <link_1.default href="/create" passHref>
            <button_1.Button>Create New Book</button_1.Button>
          </link_1.default>
        </div>
      </div>

      {/* In Progress Section */}
      <section className="mb-8">
         <h2 className="text-2xl font-semibold mb-4">In Progress ({sortedInProgress.length})</h2>
         {/* Render sortedInProgress */}
         {sortedInProgress.length === 0 ? (<card_1.Card><card_1.CardContent className="pt-6"><p className="text-muted-foreground">You have no books currently in progress. Start creating one!</p></card_1.CardContent></card_1.Card>) : (<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                 {sortedInProgress.map((book) => (<book_card_1.BookCard key={book.id} {...book} onDeleteClick={() => openDeleteDialog(book)} onDuplicateClick={() => handleDuplicate(book.id)}/>))}
             </div>)}
      </section>

      {/* Completed Section */}
      <section>
         <h2 className="text-2xl font-semibold mb-4">Completed ({sortedCompleted.length})</h2>
         {/* Render sortedCompleted */}
         {sortedCompleted.length === 0 ? (<card_1.Card><card_1.CardContent className="pt-6"><p className="text-muted-foreground">You haven't completed any books yet.</p></card_1.CardContent></card_1.Card>) : (<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {sortedCompleted.map((book) => (<book_card_1.BookCard key={book.id} {...book} onDeleteClick={() => openDeleteDialog(book)} onDuplicateClick={() => handleDuplicate(book.id)}/>))}
              </div>)}
      </section>

      {/* Delete Confirmation Dialog */}
      <alert_dialog_1.AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <alert_dialog_1.AlertDialogContent>
          <alert_dialog_1.AlertDialogHeader>
            <alert_dialog_1.AlertDialogTitle>Are you absolutely sure?</alert_dialog_1.AlertDialogTitle>
            <alert_dialog_1.AlertDialogDescription>
              This action cannot be undone. This will permanently delete the book titled 
              <span className="font-semibold">"{bookToDelete === null || bookToDelete === void 0 ? void 0 : bookToDelete.title}"</span>.
            </alert_dialog_1.AlertDialogDescription>
          </alert_dialog_1.AlertDialogHeader>
          <alert_dialog_1.AlertDialogFooter>
            <alert_dialog_1.AlertDialogCancel disabled={isDeleting}>Cancel</alert_dialog_1.AlertDialogCancel>
            <alert_dialog_1.AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" // Style delete button
    >
              {isDeleting ? "Deleting..." : "Yes, delete book"}
            </alert_dialog_1.AlertDialogAction>
          </alert_dialog_1.AlertDialogFooter>
        </alert_dialog_1.AlertDialogContent>
      </alert_dialog_1.AlertDialog>
    </div>);
}
