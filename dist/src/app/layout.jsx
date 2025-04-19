"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = RootLayout;
const google_1 = require("next/font/google");
const nextjs_1 = require("@clerk/nextjs");
require("./globals.css");
const site_header_1 = require("@/components/site-header");
const site_footer_1 = require("@/components/site-footer");
const sonner_1 = require("@/components/ui/sonner");
const geistSans = (0, google_1.Geist)({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});
const geistMono = (0, google_1.Geist_Mono)({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});
exports.metadata = {
    title: "Storywink - AI Storybooks from Your Photos",
    description: "Turn your photos into personalized, illustrated storybooks with AI.",
};
function RootLayout({ children, }) {
    return (<nextjs_1.ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}>
          <site_header_1.SiteHeader />
          <main className="flex-grow">{children}</main>
          <site_footer_1.SiteFooter />
          <sonner_1.Toaster />
        </body>
      </html>
    </nextjs_1.ClerkProvider>);
}
