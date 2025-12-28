import type { Metadata } from "next";
import "./globals.css";

import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "./provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Codrel",
  description: "codrel context engine for your agent",
  icons: {
    icon: "/logocodrel.png",
    shortcut: "/logocodrel.png",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistSans.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
