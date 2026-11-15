import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenForge Edge — Bench",
  description: "Offline-first repair copilot for hardware technicians.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07090b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="h-dvh overflow-hidden bg-bench-bg font-sans text-bench-text antialiased">
        {children}
      </body>
    </html>
  );
}
