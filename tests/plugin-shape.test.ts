/**
 * Plugin shape / contract tests.
 *
 * data is a no-auth plugin that exports a STATIC PluginModule (a named
 * `safeFunctions` export), NOT a factory `default export`. This is the
 * simplest contract shape — no ctx, no auth, no config, no endpoints.
 *
 * Imports the real entry through Bun's module system (no daemon, no DB). These
 * are the implementation-equivalence tests: they pin the exact eleven function
 * names/count, the `data` category metadata on the nine functions that carry
 * it, the readonly/discovery tags, and the absence of authProvider/config/
 * httpEndpoints (no-auth plugin contract).
 *
 * Behavioral parity with monorepo `packages/plugins/src/data` v1.0.1:
 *  - fetchData, convertCurrency, parsePdf, processData, transformData,
 *    chunkArray, uniqueBy, groupBy, sumArray, validateData, saveResult
 *    (exactly eleven)
 *  - no requiredCredentials on any function (no-auth plugin)
 *  - nine functions carry readonly metadata; saveResult + validateData carry
 *    none (pre-existing inconsistency — frozen, not refactored in extraction)
 *  - static PluginModule (no authProvider, no config, no httpEndpoints)
 */
import { describe, expect, it } from "bun:test";
import type { PluginModule } from "@orgsdk/plugins";

const EXPECTED_FUNCTIONS = [
	"chunkArray",
	"convertCurrency",
	"fetchData",
	"groupBy",
	"parsePdf",
	"processData",
	"saveResult",
	"sumArray",
	"transformData",
	"uniqueBy",
	"validateData",
] as const;

// Functions that carry metadata.category === "data". saveResult and
// validateData do NOT carry metadata in the monorepo source — this is a
// pre-existing inconsistency preserved verbatim (migration discipline: do not
// combine a behavioral change with extraction).
const FUNCTIONS_WITH_CATEGORY = [
	"chunkArray",
	"convertCurrency",
	"fetchData",
	"groupBy",
	"parsePdf",
	"processData",
	"sumArray",
	"transformData",
	"uniqueBy",
] as const;

async function loadSafeFunctions() {
	const mod = await import("../plugin/index");
	const fns = mod.safeFunctions;
	if (!Array.isArray(fns)) throw new Error("safeFunctions is not an array");
	return fns;
}

describe("plugin shape", () => {
	it("exports a static safeFunctions array (not a factory)", async () => {
		const fns = await loadSafeFunctions();
		expect(Array.isArray(fns)).toBe(true);
		expect(fns.length).toBeGreaterThan(0);
	});

	it("exposes exactly the eleven expected safe functions (no more, no less)", async () => {
		const fns = await loadSafeFunctions();
		const names = fns.map((f) => f.name).sort();
		expect(names).toEqual([...EXPECTED_FUNCTIONS].sort());
		expect(fns.length).toBe(11);
	});

	it("every function declares no requiredCredentials (no-auth plugin)", async () => {
		const fns = await loadSafeFunctions();
		for (const fn of fns) {
			expect(fn.requiredCredentials ?? []).toEqual([]);
		}
	});

	it("the nine categorized functions carry category data", async () => {
		const fns = await loadSafeFunctions();
		const byName = new Map(fns.map((f) => [f.name, f]));
		for (const name of FUNCTIONS_WITH_CATEGORY) {
			expect(byName.get(name)?.metadata?.category).toBe("data");
		}
	});

	it("every function name is unique within the plugin", async () => {
		const fns = await loadSafeFunctions();
		const names = fns.map((f) => f.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("readonly functions are tagged readonly (both flag and tag)", async () => {
		const fns = await loadSafeFunctions();
		const byName = new Map(fns.map((f) => [f.name, f]));
		const readonlyFns = [
			"chunkArray",
			"convertCurrency",
			"fetchData",
			"groupBy",
			"parsePdf",
			"processData",
			"sumArray",
			"transformData",
			"uniqueBy",
		];
		for (const name of readonlyFns) {
			const fn = byName.get(name);
			expect(fn?.metadata?.readonly).toBe(true);
			expect(fn?.metadata?.tags).toContain("readonly");
		}
	});

	it("fetchData is tagged discovery", async () => {
		const fns = await loadSafeFunctions();
		const byName = new Map(fns.map((f) => [f.name, f]));
		expect(byName.get("fetchData")?.metadata?.tags).toContain("discovery");
		expect(byName.get("fetchData")?.metadata?.discovery).toBe(true);
	});

	it("saveResult and validateData carry no metadata (frozen pre-existing gap)", async () => {
		// These two predate the extraction and have no metadata block in the
		// monorepo source. The migration freezes behavior verbatim — this
		// assertion documents the inconsistency so a future metadata addition
		// is a deliberate, versioned change, not an accidental drift.
		const fns = await loadSafeFunctions();
		const byName = new Map(fns.map((f) => [f.name, f]));
		expect(byName.get("saveResult")?.metadata).toBeUndefined();
		expect(byName.get("validateData")?.metadata).toBeUndefined();
	});

	it("has no authProvider (no-auth plugin)", async () => {
		const mod = (await import("../plugin/index")) as PluginModule;
		expect(mod.authProvider).toBeUndefined();
	});

	it("has no config (no Zod schema, no tenant_config)", async () => {
		const mod = (await import("../plugin/index")) as PluginModule;
		expect(mod.config).toBeUndefined();
	});

	it("has no httpEndpoints (no webhook/callback receivers)", async () => {
		const mod = (await import("../plugin/index")) as PluginModule;
		expect(mod.httpEndpoints).toBeUndefined();
	});

	it("parsePdf declares the cross-plugin getMessageAttachment relatedTo reference", async () => {
		const fns = await loadSafeFunctions();
		const byName = new Map(fns.map((f) => [f.name, f]));
		expect(byName.get("parsePdf")?.metadata?.relatedTo).toContain(
			"getMessageAttachment",
		);
	});

	it("parsePdf carries a docs block with examples", async () => {
		const fns = await loadSafeFunctions();
		const byName = new Map(fns.map((f) => [f.name, f]));
		const docs = byName.get("parsePdf")?.docs;
		expect(docs).toBeDefined();
		expect(Array.isArray(docs?.examples)).toBe(true);
		expect((docs?.examples ?? []).length).toBeGreaterThan(0);
	});
});
