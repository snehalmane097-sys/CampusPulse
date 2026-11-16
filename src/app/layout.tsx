import type { Metadata } from "next";
import "./globals.css";
import { THEME_INIT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "CampusPulse — Campus Issue Intelligence",
  description:
    "Intelligent network-based student grievance and campus issue management system.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }}/>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-ink text-ivory antialiased">{children}</body>
    </html>
  );
}
