import type { MetadataRoute } from "next";

const siteUrl =
  process.env.APP_BASE_URL?.replace(/\/$/, "") || "https://www.cryptozei.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: {
        languages: {
          ja: siteUrl,
          en: siteUrl,
        },
      },
    },
  ];
}
