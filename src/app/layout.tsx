import type { Metadata } from "next";
import { Syne, IBM_Plex_Sans_JP } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const plex = IBM_Plex_Sans_JP({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ZEI — Crypto tax for Japan (crypto only)",
  description:
    "Crypto-only Japan 雑所得 with 移動平均法. Live wallet & exchange sync, accountant export pack.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${syne.variable} ${plex.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
