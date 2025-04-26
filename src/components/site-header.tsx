import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center px-6 md:px-8">
        <div className="hidden md:flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            {/* Update logo text and styling */}
            <span className="hidden font-bold text-3xl sm:inline-block text-slate-900 dark:text-white"> {/* Increased size */} 
              Storywin<span /* style={{ color: '#4ECDC4' }} REMOVED */ >k.ai</span> {/* Split text, add color */} 
            </span>
          </Link>
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
             <SignedOut>
                <Button asChild variant="ghost">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Sign Up</Link>
                </Button>
             </SignedOut>
             <SignedIn>
                 <Button asChild variant="secondary" size="sm">
                    <Link 
                      href="/library" 
                      className="text-slate-900 dark:text-white transition-colors hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      My Library
                    </Link>
                 </Button>
                 <UserButton afterSignOutUrl="/" />
             </SignedIn>
          </nav>
        </div>
      </div>
    </header>
  );
} 