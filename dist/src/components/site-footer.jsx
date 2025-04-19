"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteFooter = SiteFooter;
const link_1 = __importDefault(require("next/link"));
function SiteFooter() {
    return (<footer className="py-6 md:py-8 border-t border-border/40">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
        <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
          Built by Your Name/Company. © {new Date().getFullYear()} All rights reserved.
          {/* Or: &copy; {new Date().getFullYear()} Storywink. All rights reserved. */}
        </p>
        <nav className="flex gap-4 sm:gap-6 text-sm text-muted-foreground">
           <link_1.default href="/terms" className="hover:underline hover:text-primary">Terms</link_1.default>
           <link_1.default href="/privacy" className="hover:underline hover:text-primary">Privacy</link_1.default>
           {/* Add other footer links */}
        </nav>
      </div>
    </footer>);
}
