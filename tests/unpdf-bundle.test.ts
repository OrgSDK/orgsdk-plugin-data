/**
 * Isolated materialize/load smoke — the dependency-bundling gate.
 *
 * This simulates the daemon-side bundling flow (packages/platform/src/plugins/
 * resolve-deps.ts) that runs at publish time:
 *
 *   stage source + declared deps → bun install → Bun.build → __bundle.js
 *
 * The daemon imports __bundle.js directly at runtime — there is no node_modules
 * resolution in the tenant container. So this test proves the FULL closure of
 * the `data` plugin (unpdf + its transitive deps) bundles into a single ESM
 * file, loads, and actually extracts text from a PDF.
 *
 * The optional peer `@napi-rs/canvas` (declared by unpdf) is deliberately NOT
 * installed — text extraction does not need the native canvas binary. This test
 * asserts it remains absent and unresolvable.
 *
 * If unpdf ever fails to bundle or load here (e.g. a future unpdf version
 * hard-requires a native binary), this test BLOCKS rather than hiding the
 * issue, per the migration discipline.
 */
import { describe, expect, it } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { $ } from "bun";

const ROOT = resolve(import.meta.dir, "..");
const PLUGIN_DIR = join(ROOT, "plugin");

/** A minimal valid one-page PDF with the text "Hello OrgSDK". */
const MINIMAL_PDF_BASE64 = Buffer.from(
	`%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /MediaBox [0 0 612 792] >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 44 >> stream
BT /F1 12 Tf 100 700 Td (Hello OrgSDK) Tj ET
endstream endobj
xref
0 6
trailer << /Root 1 0 R /Size 6 >>
startxref
0
%%EOF`,
	"utf-8",
).toString("base64");

async function stagePluginBundle(): Promise<{
	bundlePath: string;
	stagingDir: string;
}> {
	const stagingDir = await mkdtemp(join(tmpdir(), "orgsdk-data-smoke-"));
	// Copy plugin source (everything under plugin/ except manifest/package.json
	// — those are regenerated for the staging dir, mirroring resolvePluginDeps).
	const entries = await readdir(PLUGIN_DIR, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.name === ".plugin.json") continue;
		const src = join(PLUGIN_DIR, entry.name);
		const dest = join(stagingDir, entry.name);
		if (entry.isDirectory()) {
			await $`cp -r ${src} ${dest}`.quiet();
		} else {
			await $`cp ${src} ${dest}`.quiet();
		}
	}
	// Declare ONLY unpdf — @napi-rs/canvas (optional peer) is intentionally
	// absent. This mirrors the published artifact package.json exactly.
	await writeFile(
		join(stagingDir, "package.json"),
		JSON.stringify(
			{ private: true, dependencies: { unpdf: "^1.6.2" } },
			null,
			2,
		),
	);
	// Resolve unpdf into the staging dir's own node_modules.
	await $`bun install`.cwd(stagingDir).quiet();
	// Bundle with the same config as resolvePluginDeps (target bun, esm,
	// zod external — zod is present in the daemon image).
	const result = await Bun.build({
		entrypoints: [join(stagingDir, "index.ts")],
		outdir: stagingDir,
		target: "bun",
		format: "esm",
		external: ["zod"],
	});
	if (!result.success || result.outputs.length === 0) {
		throw new Error(`Bun.build failed: ${result.logs.map(String).join("; ")}`);
	}
	return { bundlePath: result.outputs[0].path, stagingDir };
}

describe("isolated materialize/load smoke (resolvePluginDeps simulation)", () => {
	let bundlePath: string;
	let stagingDir: string;

	it("bundles the full dependency closure into a single ESM file", async () => {
		const out = await stagePluginBundle();
		bundlePath = out.bundlePath;
		stagingDir = out.stagingDir;
		const stat = await readFile(bundlePath, "utf-8");
		// The bundle must inline unpdf (not leave it as an external import).
		expect(stat.length).toBeGreaterThan(100_000);
		// No bare `from "unpdf"` should remain — it must be inlined.
		expect(stat).not.toMatch(/^\s*import.*from\s+["']unpdf["']/m);
	});

	it("the bundle loads and exposes safeFunctions with all eleven names", async () => {
		const mod = await import(bundlePath);
		const fns = mod.safeFunctions;
		expect(Array.isArray(fns)).toBe(true);
		expect(fns.length).toBe(11);
		expect(fns.map((f: { name: string }) => f.name).sort()).toEqual(
			[
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
			].sort(),
		);
	});

	it("parsePdf extracts text from a real PDF without @napi-rs/canvas", async () => {
		const mod = await import(bundlePath);
		const parsePdf = mod.safeFunctions.find(
			(f: { name: string }) => f.name === "parsePdf",
		).handler as (args: { base64Data: string }) => Promise<{
			text: string;
			totalPages: number;
			metadata?: Record<string, string>;
		}>;
		const out = await parsePdf({ base64Data: MINIMAL_PDF_BASE64 });
		expect(out.totalPages).toBeGreaterThanOrEqual(1);
		expect(out.text).toContain("Hello OrgSDK");
	});

	it("@napi-rs/canvas is not installed and not resolvable in the staging dir", async () => {
		// The optional peer must remain absent — importing it must fail.
		let resolved: unknown;
		try {
			resolved = await import(
				join(stagingDir, "node_modules", "@napi-rs", "canvas")
			);
		} catch {
			resolved = undefined;
		}
		expect(resolved).toBeUndefined();
		// Confirm the namespace directory does not exist.
		await expect(
			readFile(
				join(stagingDir, "node_modules", "@napi-rs", "canvas", "package.json"),
			),
		).rejects.toThrow();
	});

	it("re-bundling is byte-deterministic (same source → same output modulo path)", async () => {
		const first = await readFile(bundlePath, "utf-8");
		// Stage a second bundle from the same source.
		const second = await stagePluginBundle();
		const secondBytes = await readFile(second.bundlePath, "utf-8");
		await rm(second.stagingDir, { recursive: true, force: true });
		// Normalize the staging path (resolvePluginDeps does the same) then
		// compare — the only allowed difference is the embedded temp path.
		const norm = (s: string, dir: string) =>
			s.replaceAll(dir, "/plugin-bundle-root");
		expect(norm(secondBytes, second.stagingDir)).toBe(
			norm(first, stagingDir).replaceAll(stagingDir, "/plugin-bundle-root"),
		);
	});

	// Cleanup after the whole describe block (bun:test runs these sequentially).
	it("cleans up the staging dir", async () => {
		await rm(stagingDir, { recursive: true, force: true });
		expect(stagingDir).toBeDefined();
	});
});
