import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Hellenomap — Greek-owned businesses near you", template: "%s · Hellenomap" },
  description: "Find Greek-owned restaurants, shops, lawyers and more on an interactive map.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0d5eaf" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
