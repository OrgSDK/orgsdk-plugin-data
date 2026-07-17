import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const MANIFEST_PATH = resolve(import.meta.dir, "..", "plugin", ".plugin.json");

async function readManifest() {
	const raw = await readFile(MANIFEST_PATH, "utf-8");
	return JSON.parse(raw) as Record<string, unknown>;
}

describe("manifest", () => {
	it("has the expected slug (name)", async () => {
		const m = await readManifest();
		expect(m.name).toBe("data");
	});

	it("has the bumped version 1.0.2", async () => {
		const m = await readManifest();
		expect(m.version).toBe("1.0.2");
	});

	it("declares the canonical $schema", async () => {
		const m = await readManifest();
		expect(m.$schema).toBe("https://orgsdk.ai/schemas/plugin-manifest.v1.json");
	});

	it("has a non-empty description", async () => {
		const m = await readManifest();
		expect(typeof m.description).toBe("string");
		expect((m.description as string).length).toBeGreaterThan(0);
	});

	it("declares entry as index.ts", async () => {
		const m = await readManifest();
		expect(m.entry).toBe("index.ts");
	});

	// data is a no-auth plugin — it must NOT declare an auth block. This is the
	// contract that distinguishes it from token/OAuth plugins. Every function is
	// immediately callable once the plugin is enabled on an agent.
	it("declares no auth block (no credentials, no OAuth flow)", async () => {
		const m = await readManifest();
		expect(m.auth).toBeUndefined();
	});

	it("declares no tables (no per-agent provisioned tables)", async () => {
		const m = await readManifest();
		expect(m.tables).toBeUndefined();
	});

	it("declares marketplace metadata with the source-repo provenance link", async () => {
		const m = await readManifest();
		const mp = m.marketplace as Record<string, unknown>;
		expect(mp.displayName).toBe("Data Tools");
		expect(mp.category).toBe("Data & AI");
		expect(Array.isArray(mp.tags)).toBe(true);
		const links = mp.links as Record<string, string>;
		expect(links.sourceRepo).toBe(
			"https://github.com/OrgSDK/orgsdk-plugin-data",
		);
	});
});
