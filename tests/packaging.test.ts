/**
 * Packaging tests — determinism, stale-output removal, and generated
 * package.json in the staged artifact.
 *
 * data imports `unpdf` at runtime (document-functions.ts calls `extractText`
 * and `getMeta`). It is NOT a no-dependency plugin: unpdf is declared as a
 * runtime dependency in package.json so the catalog's resolvePluginDeps step
 * can bundle it into __bundle.js at publish time (the daemon imports the
 * bundle directly — no runtime node_modules resolution).
 *
 * unpdf's optional peer @napi-rs/canvas is NOT a dependency — it is only
 * needed for canvas-based rendering, not text extraction, so it is correctly
 * absent from the artifact.
 */
import { describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { $ } from "bun";

const ROOT = resolve(import.meta.dir, "..");
const DIST_DIR = join(ROOT, "dist");

interface ManifestInfo {
	name: string;
	version: string;
}

async function readManifestInfo(): Promise<ManifestInfo> {
	const raw = await readFile(join(ROOT, "plugin", ".plugin.json"), "utf-8");
	return JSON.parse(raw) as ManifestInfo;
}

async function manifestPath(): Promise<string> {
	const { name, version } = await readManifestInfo();
	return join(DIST_DIR, `${name}-${version}.manifest.json`);
}

describe("packaging", () => {
	it("removes stale files from dist/ before staging", async () => {
		await rm(DIST_DIR, { recursive: true, force: true });
		await mkdir(DIST_DIR, { recursive: true });
		const sentinel = join(DIST_DIR, "STALE_SENTINEL.txt");
		await writeFile(sentinel, "this should not survive packaging");

		await $`bun run package`.cwd(ROOT).quiet();

		await expect(stat(sentinel)).rejects.toThrow();
	});

	it("produces deterministic output across runs", async () => {
		await $`bun run package`.cwd(ROOT).quiet();
		const first = await readFile(await manifestPath(), "utf-8");

		await $`bun run package`.cwd(ROOT).quiet();
		const second = await readFile(await manifestPath(), "utf-8");

		expect(second).toBe(first);
	});

	it("manifest entries are sorted by path", async () => {
		await $`bun run package`.cwd(ROOT).quiet();
		const raw = await readFile(await manifestPath(), "utf-8");
		const parsed = JSON.parse(raw) as {
			files: Array<{ path: string }>;
		};
		const paths = parsed.files.map((f) => f.path);
		const sorted = [...paths].sort((a, b) => a.localeCompare(b));
		expect(paths).toEqual(sorted);
	});

	it("generated package.json in artifact carries unpdf as the only runtime dep (no @orgsdk/plugins, no @napi-rs/canvas)", async () => {
		const { name, version } = await readManifestInfo();
		await $`bun run package`.cwd(ROOT).quiet();
		const pkgPath = join(DIST_DIR, name, "package.json");
		const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as Record<
			string,
			unknown
		>;

		expect(pkg.name).toBe("@orgsdk/plugin-data");
		expect(pkg.version).toBe(version);
		expect(pkg.type).toBe("module");
		// unpdf IS a runtime dependency (parsePdf uses extractText/getMeta).
		const deps = pkg.dependencies as Record<string, string> | undefined;
		expect(deps).toBeDefined();
		expect(deps?.unpdf).toBe("^1.6.2");
		// The authoring SDK must NOT be a runtime dependency (type-only).
		expect(deps?.["@orgsdk/plugins"]).toBeUndefined();
		// The optional canvas peer must NOT be a dependency (text extraction
		// does not need it; it would pull a native binary into the bundle).
		expect(deps?.["@napi-rs/canvas"]).toBeUndefined();
		expect(Object.keys(deps ?? {}).sort()).toEqual(["unpdf"]);
		expect(pkg.devDependencies).toBeUndefined();
		expect(pkg.scripts).toBeUndefined();
		expect(pkg.private).toBeUndefined();
	});

	it("manifest includes the generated package.json entry", async () => {
		await $`bun run package`.cwd(ROOT).quiet();
		const raw = await readFile(await manifestPath(), "utf-8");
		const parsed = JSON.parse(raw) as {
			files: Array<{ path: string }>;
		};
		const paths = parsed.files.map((f) => f.path);
		expect(paths).toContain("package.json");
	});

	it("artifact contains only expected files (source + docs + generated)", async () => {
		await $`bun run package`.cwd(ROOT).quiet();
		const raw = await readFile(await manifestPath(), "utf-8");
		const parsed = JSON.parse(raw) as {
			files: Array<{ path: string }>;
		};
		const paths = parsed.files.map((f) => f.path);
		// Every shipped source file must be present.
		const expectedSources = [
			".plugin.json",
			"package.json",
			"index.ts",
			"currency-functions.ts",
			"data-fetch.ts",
			"data-operations.ts",
			"data-processing.ts",
			"data-utils.ts",
			"document-functions.ts",
			"docs/overview.md",
		];
		for (const p of expectedSources) {
			expect(paths).toContain(p);
		}
		// No tests, no workflows, no node_modules leaked into the artifact.
		for (const p of paths) {
			expect(p.startsWith("tests/")).toBe(false);
			expect(p.startsWith(".github/")).toBe(false);
			expect(p.startsWith("node_modules/")).toBe(false);
		}
	});
});
