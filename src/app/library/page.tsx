import { getUserBooks } from "./actions"; // Only need the action here
import { LibraryClientView } from "./library-client-view"; // Import the new Client Component

export default async function LibraryPage() {
  // Fetch initial data on the server
  const initialData = await getUserBooks();

  // Pass initial data to the Client Component
  return <LibraryClientView initialData={initialData} />;
} 