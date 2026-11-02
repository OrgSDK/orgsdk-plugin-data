import type { SafeFunction } from "@orgsdk/plugins";
import { fetchJson } from "./http-client";

export const moduleDescription = "Fetch JSON data from HTTP/HTTPS URLs";

export const safeFunctions: SafeFunction[] = [
	{
		name: "fetchData",
		handler: async ({ url }: { url: string }) => {
			if (!url.startsWith("https://") && !url.startsWith("http://")) {
				throw new Error("Only HTTP/HTTPS URLs are allowed");
			}
			return fetchJson(url);
		},
		description: "Fetch JSON data from a URL",
		returnType: "Promise<any>",
		parameters: [{ name: "url", type: "string" }],
		metadata: {
			category: "data",
			tags: ["readonly", "network", "discovery"],
			readonly: true,
			discovery: true,
			version: "1.0.0",
		},
	},
];
