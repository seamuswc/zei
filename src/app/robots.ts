import type { MetadataRoute } from "next";

const siteUrl =
  process.env.APP_BASE_URL?.replace(/\/$/, "") || "https://cryptozei.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
