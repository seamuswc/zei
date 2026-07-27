import type { Metadata } from "next";
import { Syne, IBM_Plex_Sans_JP } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const gaId = process.env.NEXT_PUBLIC_GA_ID || "G-3WKMYEN081";

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

const siteUrl =
  process.env.APP_BASE_URL?.replace(/\/$/, "") || "https://www.cryptozei.com";

const titleJa = "ZEI — 日本居住者向け暗号資産の税務";
const titleEn = "ZEI — Crypto tax for Japan residents";
const descJa =
  "暗号資産のみの雑所得を移動平均法で計算。CSV・ウォレット・取引所連携、税理士向けZIP出力。確定申告の代わりではありません。";
const descEn =
  "Crypto-only Japan 雑所得 with 移動平均法. CSV, wallet & exchange sync, accountant ZIP export. Not a full tax return.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: titleJa,
    template: "%s · ZEI",
  },
  description: descJa,
  applicationName: "ZEI",
  keywords: [
    "暗号資産",
    "仮想通貨",
    "税金",
    "確定申告",
    "雑所得",
    "移動平均法",
    "暗号資産 税務",
    "bitcoin 税金 日本",
    "crypto tax Japan",
    "Japan crypto tax",
    "ZEI",
  ],
  authors: [{ name: "ZEI" }],
  creator: "ZEI",
  publisher: "ZEI",
  category: "finance",
  alternates: {
    canonical: "/",
    languages: {
      ja: "/",
      "ja-JP": "/",
      en: "/",
      "en-US": "/",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "ZEI",
    locale: "ja_JP",
    alternateLocale: ["en_US"],
    title: titleJa,
    description: descJa,
  },
  twitter: {
    card: "summary_large_image",
    title: titleJa,
    description: descJa,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  other: {
    "google": "notranslate",
    // English mirror for crawlers that read extra meta
    "description:en": descEn,
    "og:title:en": titleEn,
    "og:description:en": descEn,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "ZEI",
  alternateName: titleEn,
  url: siteUrl,
  inLanguage: ["ja", "en"],
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: descJa,
  offers: {
    "@type": "Offer",
    price: "20",
    priceCurrency: "USD",
    description: "ZEI Pro（USDC）",
  },
  audience: {
    "@type": "Audience",
    geographicArea: {
      "@type": "Country",
      name: "Japan",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${syne.variable} ${plex.variable} h-full`}>
      <body className="min-h-full antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}');
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
