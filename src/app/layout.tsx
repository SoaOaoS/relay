import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Relay — AI Assistant That Does Things",
  description: "Relay is your personal AI assistant that searches the web, browses GitHub, edits files, makes phone calls, and gets real work done.",
  keywords: ["AI assistant", "AI agent", "task automation", "AI phone calls", "web search AI", "GitHub AI"],
  openGraph: {
    title: "Relay — AI Assistant That Does Things",
    description: "Not just chat. Relay researches, calls, writes, and executes tasks for you.",
    type: "website",
    siteName: "Relay",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0a0a0b] text-white">{children}</body>
    </html>
  );
}