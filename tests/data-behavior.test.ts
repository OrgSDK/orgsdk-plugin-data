/**
 * Pure data-function behavior tests.
 *
 * These exercise the pure (non-network, non-PDF) safe functions directly,
 * pinning the observable behavior of the monorepo v1.0.1 source. No daemon,
 * no DB, no network. Each function's handler is invoked with the same shaped
 * argument the sandbox would pass.
 *
 * The handlers are frozen verbatim from the extraction — these tests guard
 * against accidental drift if a function module is later touched.
 */
import { describe, expect, it } from "bun:test";
import type { SafeFunction } from "@orgsdk/plugins";

async function loadFns(): Promise<Map<string, SafeFunction>> {
	const mod = await import("../plugin/index");
	return new Map(mod.safeFunctions.map((f) => [f.name, f]));
}

// Helper: call a handler the way the sandbox does — with a single destructured
// args object. Safe-function handlers are called as fn.handler(args). The
// generic defaults to unknown so expect().toBe(literal) doesn't conflict with
// bun:test overloads; callers pass an explicit type when they need it.
function call<T = unknown>(fn: SafeFunction | undefined, args: unknown): T {
	if (!fn) throw new Error("function missing");
	const handler = fn.handler as (args: unknown) => T;
	return handler(args);
}

describe("sumArray", () => {
	it("sums a non-empty number array", async () => {
		const fns = await loadFns();
		const result: unknown = call(fns.get("sumArray"), {
			numbers: [1, 2, 3, 4],
		});
		expect(result).toBe(10);
	});

	it("returns 0 for an empty array", async () => {
		const fns = await loadFns();
		const result: unknown = call(fns.get("sumArray"), { numbers: [] });
		expect(result).toBe(0);
	});

	it("handles negative numbers", async () => {
		const fns = await loadFns();
		const result: unknown = call(fns.get("sumArray"), {
			numbers: [-5, 5, -10, 10],
		});
		expect(result).toBe(0);
	});
});

describe("chunkArray", () => {
	it("splits an array into chunks of the given size", async () => {
		const fns = await loadFns();
		const out = call<number[][]>(fns.get("chunkArray"), {
			array: [1, 2, 3, 4, 5],
			size: 2,
		});
		expect(out).toEqual([[1, 2], [3, 4], [5]]);
	});

	it("returns a single chunk when size >= length", async () => {
		const fns = await loadFns();
		const out = call<number[][]>(fns.get("chunkArray"), {
			array: [1, 2, 3],
			size: 10,
		});
		expect(out).toEqual([[1, 2, 3]]);
	});
});

describe("uniqueBy", () => {
	it("removes duplicates by the given key", async () => {
		const fns = await loadFns();
		const input = [
			{ id: 1, v: "a" },
			{ id: 2, v: "b" },
			{ id: 1, v: "c" },
		];
		const out = call<typeof input>(fns.get("uniqueBy"), {
			array: input,
			key: "id" as const,
		});
		expect(out).toEqual([
			{ id: 1, v: "a" },
			{ id: 2, v: "b" },
		]);
	});
});

describe("groupBy", () => {
	it("groups items by a stringified key", async () => {
		const fns = await loadFns();
		const input = [
			{ region: "us", n: 1 },
			{ region: "eu", n: 2 },
			{ region: "us", n: 3 },
		];
		const out = call<Record<string, typeof input>>(fns.get("groupBy"), {
			array: input,
			key: "region" as const,
		});
		expect(out).toEqual({
			us: [
				{ region: "us", n: 1 },
				{ region: "us", n: 3 },
			],
			eu: [{ region: "eu", n: 2 }],
		});
	});
});

describe("saveResult", () => {
	it("writes into the provided storage object and returns the receipt", async () => {
		const fns = await loadFns();
		const storage: Record<string, unknown> = {};
		const out = call<{ key: string; value: unknown; saved: boolean }>(
			fns.get("saveResult"),
			{ key: "x", value: 42, storage },
		);
		expect(out).toEqual({ key: "x", value: 42, saved: true });
		expect(storage.x).toBe(42);
	});

	it("returns saved:true even with no storage (no write target)", async () => {
		const fns = await loadFns();
		const out = call<{ key: string; value: unknown; saved: boolean }>(
			fns.get("saveResult"),
			{ key: "y", value: "hi" },
		);
		expect(out.saved).toBe(true);
		expect(out.key).toBe("y");
	});
});

describe("validateData", () => {
	it("passes when all required fields are present and typed", async () => {
		const fns = await loadFns();
		const out = call<{ valid: boolean; errors: string[] }>(
			fns.get("validateData"),
			{
				data: { name: "Ada", age: 30 },
				rules: { name: { required: true, type: "string" } },
			},
		);
		expect(out.valid).toBe(true);
		expect(out.errors).toEqual([]);
	});

	it("collects errors for missing required fields", async () => {
		const fns = await loadFns();
		const out = call<{ valid: boolean; errors: string[] }>(
			fns.get("validateData"),
			{
				data: { age: 30 },
				rules: { name: { required: true, type: "string" } },
			},
		);
		expect(out.valid).toBe(false);
		expect(out.errors).toContain("name is required");
	});
});

describe("processData", () => {
	it("filter removes null and undefined entries", async () => {
		const fns = await loadFns();
		const out = call<unknown[]>(fns.get("processData"), {
			data: [1, null, 2, undefined, 3],
			processor: "filter",
		});
		expect(out).toEqual([1, 2, 3]);
	});

	it("sort returns ascending order", async () => {
		const fns = await loadFns();
		const out = call<number[]>(fns.get("processData"), {
			data: [3, 1, 2],
			processor: "sort",
		});
		expect(out).toEqual([1, 2, 3]);
	});

	it("reverse returns the reversed array", async () => {
		const fns = await loadFns();
		const out = call<number[]>(fns.get("processData"), {
			data: [1, 2, 3],
			processor: "reverse",
		});
		expect(out).toEqual([3, 2, 1]);
	});

	it("unknown processor returns the array unchanged", async () => {
		const fns = await loadFns();
		const out = call<number[]>(fns.get("processData"), {
			data: [1, 2, 3],
			processor: "nope",
		});
		expect(out).toEqual([1, 2, 3]);
	});
});

describe("transformData", () => {
	it("pluck extracts a key from each item", async () => {
		const fns = await loadFns();
		const out = call<unknown[]>(fns.get("transformData"), {
			data: [{ a: 1 }, { a: 2 }],
			transformer: "pluck",
			key: "a",
		});
		expect(out).toEqual([1, 2]);
	});

	it("sum adds numeric values", async () => {
		const fns = await loadFns();
		const out = call<number>(fns.get("transformData"), {
			data: [1, 2, 3],
			transformer: "sum",
			key: "",
		});
		expect(out).toBe(6);
	});

	it("count returns the length", async () => {
		const fns = await loadFns();
		const out = call<number>(fns.get("transformData"), {
			data: [1, 2, 3, 4],
			transformer: "count",
			key: "",
		});
		expect(out).toBe(4);
	});

	it("avg averages numeric values ignoring non-numbers", async () => {
		const fns = await loadFns();
		const out = call<number>(fns.get("transformData"), {
			data: [2, 4, "x", 6],
			transformer: "avg",
			key: "",
		});
		expect(out).toBe(4);
	});

	it("returns data unchanged for non-array input", async () => {
		const fns = await loadFns();
		const out = call(fns.get("transformData"), {
			data: "not-an-array",
			transformer: "sum",
			key: "",
		});
		expect(out).toBe("not-an-array");
	});
});

describe("convertCurrency", () => {
	it("converts USD to AUD using the frozen mock rate", async () => {
		const fns = await loadFns();
		const handler = fns.get("convertCurrency")?.handler as (a: {
			amount: number;
			fromCurrency: string;
			toCurrency: string;
		}) => Promise<{
			convertedAmount: number;
			rate: number;
			fromCurrency: string;
			toCurrency: string;
		}>;
		const out = await handler({
			amount: 100,
			fromCurrency: "usd",
			toCurrency: "aud",
		});
		expect(out.rate).toBe(1.53);
		expect(out.convertedAmount).toBe(153);
		expect(out.fromCurrency).toBe("USD");
		expect(out.toCurrency).toBe("AUD");
	});

	it("throws for an unsupported rate pair", async () => {
		const fns = await loadFns();
		const handler = fns.get("convertCurrency")?.handler as (a: {
			amount: number;
			fromCurrency: string;
			toCurrency: string;
		}) => Promise<unknown>;
		await expect(
			handler({ amount: 10, fromCurrency: "JPY", toCurrency: "USD" }),
		).rejects.toThrow(/Exchange rate not available/);
	});
});
