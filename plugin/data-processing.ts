import type { SafeFunction } from "@orgsdk/plugins";

export const moduleDescription =
	"Filter, sort, reverse, and transform data arrays";

export const safeFunctions: SafeFunction[] = [
	{
		name: "processData",
		handler: ({ data, processor }: { data: any[]; processor: string }) => {
			switch (processor) {
				case "filter":
					return data.filter(
						(item: any) => item !== null && item !== undefined,
					);
				case "sort":
					return [...data].sort((a: any, b: any) =>
						a > b ? 1 : a < b ? -1 : 0,
					);
				case "reverse":
					return [...data].reverse();
				default:
					return data;
			}
		},
		description: "Process data array",
		returnType: "any[]",
		parameters: [
			{ name: "data", type: "any[]" },
			{ name: "processor", type: "string" },
		],
		metadata: {
			category: "data",
			tags: ["readonly", "data"],
			readonly: true,
			version: "1.0.0",
			relatedTo: ["transformData"],
		},
	},
	{
		name: "transformData",
		handler: ({
			data,
			transformer,
			key,
		}: {
			data: any[];
			transformer: string;
			key: string;
		}) => {
			if (!Array.isArray(data)) return data;

			switch (transformer) {
				case "pluck":
					return data.map((item: any) => item?.[key]);
				case "sum":
					return data.reduce(
						(sum: number, item: any) => sum + (Number(item) || 0),
						0,
					);
				case "avg": {
					const valid = data.filter((item: any) => !isNaN(Number(item)));
					return valid.length
						? valid.reduce((s: number, i: any) => s + Number(i), 0) /
								valid.length
						: 0;
				}
				case "count":
					return data.length;
				default:
					return data;
			}
		},
		description: "Transform data array with various operations",
		returnType: "any",
		parameters: [
			{ name: "data", type: "any[]" },
			{ name: "transformer", type: "string" },
			{ name: "key", type: "string" },
		],
		metadata: {
			category: "data",
			tags: ["readonly", "data"],
			readonly: true,
			version: "1.0.0",
			relatedTo: ["processData"],
		},
	},
];
