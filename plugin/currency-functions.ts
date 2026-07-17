import type { SafeFunction } from "@orgsdk/plugins";

export const moduleDescription = "Convert amounts between currencies";

export const safeFunctions: SafeFunction[] = [
	{
		name: "convertCurrency",
		handler: async ({
			amount,
			fromCurrency,
			toCurrency,
		}: {
			amount: number;
			fromCurrency: string;
			toCurrency: string;
		}) => {
			await new Promise((resolve) => setTimeout(resolve, 50));

			const mockRates: Record<string, number> = {
				USD_TO_AUD: 1.53,
				EUR_TO_AUD: 1.67,
				GBP_TO_AUD: 1.92,
			};

			const rateKey = `${fromCurrency.toUpperCase()}_TO_${toCurrency.toUpperCase()}`;
			const rate = mockRates[rateKey];

			if (!rate) {
				throw new Error(`Exchange rate not available for ${rateKey}`);
			}

			return {
				originalAmount: amount,
				fromCurrency: fromCurrency.toUpperCase(),
				convertedAmount: amount * rate,
				toCurrency: toCurrency.toUpperCase(),
				rate,
			};
		},
		description:
			"Convert currency amount from one currency to another. IMPORTANT: Returns OBJECT with {convertedAmount: number, originalAmount: number, rate: number}. Use result.convertedAmount to get the numeric converted value. Example: const result = await convertCurrency(100, 'USD', 'AUD'); const converted = result.convertedAmount; Available rates: USD_TO_AUD=1.53, EUR_TO_AUD=1.67, GBP_TO_AUD=1.92",
		returnType:
			"Promise<{ originalAmount: number; fromCurrency: string; convertedAmount: number; toCurrency: string; rate: number }>",
		parameters: [
			{ name: "amount", type: "number" },
			{ name: "fromCurrency", type: "string" },
			{ name: "toCurrency", type: "string" },
		],
		metadata: {
			category: "data",
			tags: ["readonly", "data"],
			readonly: true,
			version: "1.0.0",
		},
	},
];
