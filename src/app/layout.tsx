import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CREDITNEXUS AI — Understand Risk. Explore Intelligence.",
  description:
    "An immersive credit risk intelligence workstation: real-time loan default predictions from a calibrated XGBoost model, explained by NEXUS, your 3D AI analyst.",
  keywords: [
    "credit risk", "machine learning", "XGBoost", "explainable AI",
    "risk analysis", "default prediction", "React Three Fiber",
  ],
  authors: [{ name: "CREDITNEXUS AI" }],
};

export const viewport: Viewport = {
  themeColor: "#04070E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${inter.variable} ${mono.variable} antialiased bg-nexus-void text-nexus-text`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
