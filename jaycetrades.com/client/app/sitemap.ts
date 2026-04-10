import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: "https://jaycetrades.com",
			changeFrequency: "weekly",
			priority: 1.0,
		},
		{
			url: "https://jaycetrades.com/dashboard",
			changeFrequency: "daily",
			priority: 0.9,
		},
		{
			url: "https://jaycetrades.com/history",
			changeFrequency: "daily",
			priority: 0.8,
		},
	];
}
