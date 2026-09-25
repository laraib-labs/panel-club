import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";

import "./globals.css";

export const metadata: Metadata = {
  title: "Panel Club",
  description: "Discover Indian panel shows, roasts, and comedy podcasts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="bg-bg-deep pt-[var(--bar-height)] font-sans text-base leading-[1.45] text-text">
        {children}
      </body>
    </html>
  );
}
