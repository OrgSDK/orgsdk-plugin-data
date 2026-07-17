import type { SafeFunction } from "@orgsdk/plugins";

export const moduleDescription = "Save results and general data utilities";

export const safeFunctions: SafeFunction[] = [
	{
		name: "saveResult",
		handler: ({
			key,
			value,
			storage,
		}: {
			key: string;
			value: any;
			storage?: Record<string, any>;
		}) => {
			if (storage) {
				storage[key] = value;
			}
			return { key, value, saved: true };
		},
		description: "Save a result to storage",
		returnType: "{ key: string; value: any; saved: boolean }",
		parameters: [
			{ name: "key", type: "string" },
			{ name: "value", type: "any" },
			{ name: "storage", type: "Record<string, any>" },
		],
	},
	{
		name: "validateData",
		handler: ({ data, rules }: { data: any; rules: Record<string, any> }) => {
			const errors: string[] = [];

			for (const [field, rule] of Object.entries(rules)) {
				if (rule.required && !data[field]) {
					errors.push(`${field} is required`);
				}
				if (rule.type && typeof data[field] !== rule.type) {
					errors.push(`${field} must be ${rule.type}`);
				}
			}

			return { valid: errors.length === 0, errors };
		},
		description: "Validate data against rules",
		returnType: "{ valid: boolean; errors: string[] }",
		parameters: [
			{ name: "data", type: "any" },
			{ name: "rules", type: "Record<string, any>" },
		],
	},
];
