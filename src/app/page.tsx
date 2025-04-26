"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import React, { useRef, useEffect, useState } from 'react';
import { cn } from "@/lib/utils";
import RoughBorder from "@/components/ui/rough-border";
import RoughUnderline from "@/components/ui/rough-underline";
import RoughButton from "@/components/ui/rough-button";

// Helper component for bordered sections
const BorderedSection: React.FC<{ children: React.ReactNode; className?: string; roughOptions?: any }> = ({ children, className, roughOptions }) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (sectionRef.current) {
      const updateDimensions = () => {
        if (sectionRef.current) {
           setDimensions({ 
             width: sectionRef.current.offsetWidth, 
             height: sectionRef.current.offsetHeight 
           });
        }
      };
      updateDimensions();
      const resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(sectionRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  // Define combined options for a thick black border, no fill
  const combinedRoughOptions = {
    stroke: '#000000', // Black stroke
    strokeWidth: 3.5, // Make border thicker
    roughness: 2.5, // Keep it rough
    // Remove fill options
    // fill: '...', 
    // fillStyle: '...', 
    // fillWeight: ..., 
    // hachureGap: ..., 
    ...roughOptions 
  };

  return (
    <div ref={sectionRef} className={cn("relative p-4", className)}> 
      {dimensions.width > 0 && dimensions.height > 0 && (
        <RoughBorder 
          width={dimensions.width} 
          height={dimensions.height} 
          options={combinedRoughOptions} 
          // className="text-border/60" // Remove class setting color
        />
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default function Home() {
  const headingRef = useRef<HTMLDivElement>(null);
  const [headingWidth, setHeadingWidth] = useState(0);

  // Measure heading width
  useEffect(() => {
    if (headingRef.current) {
      const updateWidth = () => {
        if (headingRef.current) {
          setHeadingWidth(headingRef.current.offsetWidth);
        }
      };
      updateWidth();
      const resizeObserver = new ResizeObserver(updateWidth);
      resizeObserver.observe(headingRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Optional Header/Nav - Placeholder */}
      {/* <header className="container mx-auto py-4 px-4">
        <nav>
          {/* Navigation items here */}
      {/*   </nav>
      </header> */}

      <main className="flex-grow container mx-auto px-4 py-8 md:py-12 space-y-12 md:space-y-20">
        {/* Hero Section */}
        <section className="text-center">
          <BorderedSection className="bg-white dark:bg-slate-900 py-12 md:py-20 rounded-lg overflow-hidden">
            <div ref={headingRef} className="relative inline-block mb-4">
              <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white">
                Turn Your Photos into Magical Stories
              </h1>
              {/* Render underline if width is measured */}
              {headingWidth > 0 && (
                <RoughUnderline
                  width={headingWidth}
                  className="absolute bottom-0 left-0 -mb-1 md:-mb-2" // Position below text
                  roughness={3} // Extra rough
                  strokeWidth={4} // Thicker
                />
              )}
            </div>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto">
              Storywink uses AI to transform your cherished photos into personalized, beautifully illustrated storybooks your kids will adore.
            </p>
            <div className="flex justify-center gap-4 mt-8">
              <Link href="/create" passHref>
                <RoughButton 
                  size="lg"
                  variant="default"
                  className="px-8 py-4 text-lg"
                >
                  Create Your Storybook
                </RoughButton>
              </Link>
            </div>
             {/* Optional: Placeholder for Hero Image/Illustration */}
             {/* <div className="mt-12">
               <Image src="/hero-image.png" alt="Example Storybook" width={600} height={400} className="mx-auto rounded-lg shadow-xl"/>
             </div> */}
          </BorderedSection>
        </section>

        {/* How it Works Section - Placeholder */}
        <section id="how-it-works">
          <BorderedSection className="bg-white dark:bg-slate-800 py-10 rounded-lg">
             <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-slate-900 dark:text-white">How It Works</h2>
             <p className="text-center text-slate-500 dark:text-slate-400">
               (Placeholder: Add steps/graphics explaining the process here...)
             </p>
          </BorderedSection>
        </section>
        
        {/* Features Section - Placeholder */}
        <section id="features">
           <BorderedSection className="py-10 rounded-lg">
             <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-slate-900 dark:text-white">Features</h2>
             <p className="text-center text-slate-500 dark:text-slate-400">
               (Placeholder: Add feature highlights, icons, or short descriptions here...)
             </p>
           </BorderedSection>
        </section>

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
