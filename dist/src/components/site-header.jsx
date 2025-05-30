"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteHeader = SiteHeader;
const link_1 = __importDefault(require("next/link"));
const button_1 = require("./ui/button");
const nextjs_1 = require("@clerk/nextjs");
function SiteHeader() {
    return (<header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <link_1.default href="/" className="mr-6 flex items-center space-x-2">
            {/* Placeholder for Logo */}
            {/* <Image src="/logo.svg" width={24} height={24} alt="Storywink Logo" /> */}
            <span className="hidden font-bold sm:inline-block">
              Storywink
            </span>
          </link_1.default>
          {/* <nav className="flex items-center space-x-6 text-sm font-medium">
           <Link href="/gallery" className="text-foreground/60 transition-colors hover:text-foreground/80">Gallery</Link>
           <Link href="/pricing" className="text-foreground/60 transition-colors hover:text-foreground/80">Pricing</Link>
           {/* Add other links as needed */}
          {/* </nav> */}
        </div>
        {/* Mobile Nav Placeholder */}
        {/* <Button variant="ghost" className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden">...</Button> */}
        
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
             {/* Use Clerk components for conditional rendering */}
             <nextjs_1.SignedOut>
                <button_1.Button asChild variant="ghost">
                  <link_1.default href="/sign-in">Sign In</link_1.default>
                </button_1.Button>
                <button_1.Button asChild>
                  <link_1.default href="/sign-up">Sign Up</link_1.default>
                </button_1.Button>
             </nextjs_1.SignedOut>
             <nextjs_1.SignedIn>
                 <button_1.Button asChild variant="secondary">
                    <link_1.default href="/library">My Library</link_1.default>
                 </button_1.Button>
                 <nextjs_1.UserButton afterSignOutUrl="/"/>
             </nextjs_1.SignedIn>
          </nav>
        </div>
      </div>
    </header>);
}
