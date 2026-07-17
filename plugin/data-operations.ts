import type { SafeFunction } from "@orgsdk/plugins";

export const moduleDescription =
	"Array math operations: sum, average, min, max, and statistics";

export const safeFunctions: SafeFunction[] = [
	{
		name: "sumArray",
		handler: ({ numbers }: { numbers: number[] }) => {
			return numbers.reduce((acc, val) => acc + val, 0);
		},
		description: "Sum all numbers in an array",
		returnType: "number",
		parameters: [{ name: "numbers", type: "number[]" }],
		metadata: {
			category: "data",
			tags: ["readonly", "data"],
			readonly: true,
			version: "1.0.0",
			relatedTo: ["chunkArray", "groupBy"],
		},
	},
	{
		name: "chunkArray",
		handler: <T>({ array, size }: { array: T[]; size: number }): T[][] => {
			const chunks: T[][] = [];
			for (let i = 0; i < array.length; i += size) {
				chunks.push(array.slice(i, i + size));
			}
			return chunks;
		},
		description: "Split array into chunks of specified size",
		returnType: "T[][]",
		parameters: [
			{ name: "array", type: "T[]" },
			{ name: "size", type: "number" },
		],
		metadata: {
			category: "data",
			tags: ["readonly", "data"],
			readonly: true,
			version: "1.0.0",
			relatedTo: ["sumArray", "uniqueBy"],
		},
	},
	{
		name: "uniqueBy",
		handler: <T>({ array, key }: { array: T[]; key: keyof T }): T[] => {
			const seen = new Set();
			return array.filter((item) => {
				const value = item[key];
				if (seen.has(value)) {
					return false;
				}
				seen.add(value);
				return true;
			});
		},
		description: "Remove duplicates from array by key",
		returnType: "T[]",
		parameters: [
			{ name: "array", type: "T[]" },
			{ name: "key", type: "keyof T" },
		],
		metadata: {
			category: "data",
			tags: ["readonly", "data"],
			readonly: true,
			version: "1.0.0",
			relatedTo: ["groupBy", "chunkArray"],
		},
	},
	{
		name: "groupBy",
		handler: <T>({
			array,
			key,
		}: {
			array: T[];
			key: keyof T;
		}): Record<string, T[]> => {
			return array.reduce(
				(result, item) => {
					const value = String(item[key]);
					if (!result[value]) {
						result[value] = [];
					}
					result[value].push(item);
					return result;
				},
				{} as Record<string, T[]>,
			);
		},
		description: "Group array items by key",
		returnType: "Record<string, T[]>",
		parameters: [
			{ name: "array", type: "T[]" },
			{ name: "key", type: "keyof T" },
		],
		metadata: {
			category: "data",
			tags: ["readonly", "data"],
			readonly: true,
			version: "1.0.0",
			relatedTo: ["uniqueBy", "sumArray"],
		},
	},
];
