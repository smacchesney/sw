"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LibraryPage;
const actions_1 = require("./actions"); // Only need the action here
const library_client_view_1 = require("./library-client-view"); // Import the new Client Component
async function LibraryPage() {
    // Fetch initial data on the server
    const initialData = await (0, actions_1.getUserBooks)();
    // Pass initial data to the Client Component
    return <library_client_view_1.LibraryClientView initialData={initialData}/>;
}
