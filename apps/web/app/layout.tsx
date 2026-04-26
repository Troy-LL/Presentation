import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope"
});

export const metadata: Metadata = {
  title: "LocalHost — Live Audience Interaction",
  description: "Live prompts for audience-driven sessions."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} font-[family-name:var(--font-manrope)]`}>
        {children}
      </body>
    </html>
  );
}

