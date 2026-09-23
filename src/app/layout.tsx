import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Panel Club",
  description: "Discover Indian panel shows, roasts, and comedy podcasts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="frame">{children}</div>
      </body>
    </html>
  );
}
