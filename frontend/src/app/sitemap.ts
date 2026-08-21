import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
    return ["", "/privacy", "/terms", "/contact"].map((path) => ({
        url: `https://workhive.es${path}`,
        lastModified: new Date(),
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1 : 0.6,
    }));
}
