import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Optional Header/Nav - Placeholder */}
      {/* <header className="container mx-auto py-4 px-4">
        <nav>
          {/* Navigation items here */}
      {/*   </nav>
      </header> */}

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800 py-20 md:py-32">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-slate-900 dark:text-white">
              Turn Your Photos into Magical Stories
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto">
              Storywink uses AI to transform your cherished photos into personalized, beautifully illustrated storybooks your kids will adore.
            </p>
            <div className="flex justify-center gap-4">
              {/* Link to the actual creation flow start page */}
              <Link href="/create" passHref> 
                <Button size="lg">Create Your Storybook</Button>
              </Link>
               {/* Optional secondary action */}
              {/* <Link href="#how-it-works" passHref> 
                <Button size="lg" variant="outline">Learn More</Button>
              </Link> */}
            </div>
             {/* Optional: Placeholder for Hero Image/Illustration */}
             {/* <div className="mt-12">
               <Image src="/hero-image.png" alt="Example Storybook" width={600} height={400} className="mx-auto rounded-lg shadow-xl"/>
             </div> */}
          </div>
        </section>

        {/* How it Works Section - Placeholder */}
        {/* <section id="how-it-works" className="py-16 md:py-24 bg-white dark:bg-slate-800">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">How It Works</h2>
            {/* Add steps here */}
        {/*  </div>
        </section> */}

        {/* Features Section - Placeholder */}
        {/* <section className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900">
           <div className="container mx-auto px-4">
             <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Features</h2>
             {/* Add features here */}
        {/*   </div>
         </section> */}

      </main>

      {/* Optional Footer - Placeholder */}
      {/* <footer className="py-8 bg-slate-100 dark:bg-slate-900">
         <div className="container mx-auto px-4 text-center text-slate-500 dark:text-slate-400">
           {/* Footer content here */}
      {/*   </div>
      </footer> */}
    </div>
  );
}
