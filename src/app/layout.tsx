import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Instrument_Serif, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  variable: "--font-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LipiPulse — Pratilipi Author Studio",
  description:
    "Offline-first personal analytics studio for Pratilipi authors: daily snapshot deltas across channels, stories and episodes, with Gemini screenshot auto-detection.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon.png",
    apple: "/icons/icon.png",
  },
  appleWebApp: { capable: true, title: "LipiPulse", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FAFAF9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${instrument.variable} ${devanagari.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
