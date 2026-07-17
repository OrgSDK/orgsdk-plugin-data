# Contract migration — completed

## Status: consuming `@orgsdk/plugins` from npm

This plugin imports its authoring types from the public
[`@orgsdk/plugins`](https://www.npmjs.com/package/@orgsdk/plugins) npm package.
The migration from the monorepo workspace specifier is complete.

## What changed (from the monorepo source)

1. **Import specifiers updated** — `from "orgsdk/plugins"` →
   `from "@orgsdk/plugins"`. All imports are **type-only**
   (`import type { … }`), erased at compile time.
2. **devDependency** is the published npm package, pinned to an exact version
   (`@orgsdk/plugins@0.2.1`) for reproducibility.
3. **Purity guards** — type-only imports from `@orgsdk/plugins` are
   allowed; value imports and all other `@orgsdk/*` packages are blocked
   (enforced by `tests/purity.test.ts` and `orgsdk-plugin validate`).
4. **Artifact runtime dependency — `unpdf`.** `document-functions.ts` imports
   `extractText` and `getMeta` from `unpdf` at runtime. It is declared as a
   runtime `dependencies` entry in `package.json`, so the generated artifact
   `package.json` carries `"dependencies": { "unpdf": "^1.6.2" }` and the
   platform's `resolvePluginDeps` bundles the full closure into `__bundle.js`
   at publish time. The authoring SDK (`@orgsdk/plugins`) is **not** a runtime
   dependency (type-only imports are erased at compile time).
5. **No `@napi-rs/canvas` runtime dependency.** `unpdf` declares it as an
   **optional peer** — needed only for canvas-based rendering, not text
   extraction. It is deliberately absent from the artifact. `tests/purity.test.ts`
   guards against its re-introduction; `tests/unpdf-bundle.test.ts` proves the
   bundle loads and extracts text without it.
6. **Manifest `$schema`** — `plugin/.plugin.json` declares
   `$schema: https://orgsdk.ai/schemas/plugin-manifest.v1.json` for editor
   completion and schema validation.
7. **Manifest `entry`** — declared as `index.ts` (explicit, not defaulted).
8. **Provenance** — `marketplace.links.sourceRepo` points at this repository
   (canonical key supported by `plugin-manifest.v1`).
9. **No local management scripts** — `validate`, `package`, `version-guard`,
   and `publish` are npm scripts that delegate to the `orgsdk-plugin` CLI
   shipped by `@orgsdk/plugins`.
10. **Reusable CI/CD workflows** — `.github/workflows/ci.yml` and
    `publish-catalog.yml` call the centrally maintained reusable workflows in
    `OrgSDK/plugins` (pinned to an immutable commit) instead of duplicating
    CI/publish mechanics.

## What did NOT change (frozen behavior)

- The eleven safe functions — `fetchData`, `convertCurrency`, `parsePdf`,
  `processData`, `transformData`, `chunkArray`, `uniqueBy`, `groupBy`,
  `sumArray`, `validateData`, `saveResult` — names, parameters, return types,
  metadata, tags, and the `parsePdf` docs block.
- The no-auth contract: no `authProvider`, no `config`, no `httpEndpoints`, no
  `tables`.
- The static `PluginModule` entry shape (named `safeFunctions` export — not a
  `PluginFactory`).
- The `unpdf` usage in `document-functions.ts` — `extractText` + `getMeta`,
  byte-identical.
- `docs/overview.md` — verbatim.

## Complete dependency-closure determination

The `data` plugin's runtime dependency closure (required for server-side
bundling via `resolvePluginDeps`):

| Package | Role | Bundled? |
|---|---|---|
| `unpdf@^1.6.2` | direct runtime import (`extractText`, `getMeta`) | yes — inlined into `__bundle.js` |
| unpdf transitive deps | resolved by `bun install`, inlined by `Bun.build` | yes |
| `@napi-rs/canvas` | optional peer of unpdf (canvas rendering only) | **no** — not required for text extraction; deliberately absent |
| `zod` | present in the daemon image | external (resolved at runtime, not bundled) |
| `@orgsdk/plugins` | authoring SDK, type-only imports | erased (not in runtime closure) |

`Bun.build` (target: `bun`, format: `esm`, `external: ["zod"]`) produces a ~2.2 MB
deterministic single-file bundle. The daemon imports it directly — no
`node_modules`, no native binary. Verified by `tests/unpdf-bundle.test.ts`.

### Server-process assumptions

- **Publish time:** `resolvePluginDeps` needs network access to resolve `unpdf`
  from npm into a temp staging dir, then `Bun.build`. No native compilation
  step (canvas is absent).
- **Daemon runtime:** the standard daemon container image suffices. No system
  packages, no native addons, no `PKG_CONFIG_PATH` or similar. `unpdf`'s text
  extraction is pure JS/Wasm.

> **Stop condition satisfied.** The user asked to "stop if unpdf cannot
> bundle/load cleanly rather than hiding issue." It bundles cleanly (2.2 MB),
> loads as ESM, and extracts text from a real PDF — all with `@napi-rs/canvas`
> absent. The gate passes; no issue is hidden.

## Known pre-existing issues (recorded, not fixed in this release)

These predate the extraction and are frozen byte-for-byte per the migration
discipline (skill learning #6 — never combine a behavioral refactor with an
extraction):

### SSRF / resource concerns (frozen)

- **`fetchData` — arbitrary outbound fetch.** The handler performs `fetch(url)`
  with only a scheme check (`http://`/`https://`). There is **no SSRF
  protection**: no private-IP / loopback / link-local blocklist, no redirect
  cap, no request timeout, no response-size limit. An agent can fetch any
  HTTP(S) URL the daemon's network can reach. Any hardening (allow/deny list,
  timeout, redirect policy) is a separate, deliberate security change.
- **`convertCurrency` — hardcoded mock rates + artificial delay.** The rate
  table is a fixed in-source map (`USD_TO_AUD: 1.53`, etc.), not a live feed.
  The handler also injects a `setTimeout(resolve, 50)` delay for no functional
  reason. Both are frozen; a real FX integration or delay removal is a separate
  change.
- **`parsePdf` — no size guard.** `base64Data` is decoded and passed to unpdf
  without a byte ceiling; a very large PDF could exhaust memory. No timeout on
  extraction either.

### Code-quality concerns (frozen)

- **`saveResult` and `validateData` carry no `metadata` block** — unlike the
  other nine functions. This is a pre-existing inconsistency; the shape test
  documents it so a future metadata addition is deliberate.
- **Pre-existing `any` types** in `data-utils.ts` (`value: any`, `data: any`),
  `data-processing.ts` (`data: any[]`, `item: any`), `data-fetch.ts`
  (`returnType: "Promise<any>"`), and `saveResult`'s return type. These were
  not introduced by the migration and are frozen.
- **Cross-plugin reference in metadata.** `parsePdf.metadata.relatedTo` lists
  `getMessageAttachment` (a `gmail` function). This is a documentation hint, not
  a code dependency — frozen.

## Why `@orgsdk/plugins`?

The package provides the stable, minimal, structural TypeScript contract
between plugin authors and the OrgSDK daemon — with no private daemon,
platform, storage, or database internals. See
[OrgSDK/plugins](https://github.com/OrgSDK/plugins) for the full API surface.

## Type-only contract

All imports from `@orgsdk/plugins` are `import type { … }` — erased at compile
time. The runtime plugin artifact carries **only** `unpdf` as a dependency.
This means:

- Minimal runtime weight (one framework dependency: unpdf).
- Plugin source typechecks against the same contract the daemon enforces.

## Upgrading the contract version

The dependency is pinned exactly (`0.2.1`). When a new contract version is
released, update the version in `package.json`, regenerate the lockfile with
`bun install`, and confirm tests still pass. Prefer deliberate, reviewed
upgrades over floating ranges while the contract is still pre-1.0.
