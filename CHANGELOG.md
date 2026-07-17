# Changelog

All notable releases of `@orgsdk/plugin-data` are documented here.

The catalog treats versions as **write-once**: a given `(slug, version)` may be
re-published only with identical artifact content; differing content is
rejected with HTTP 409. Every entry below is therefore forward-only.

## [1.0.2] — standalone repository extraction

A forward-only patch release that migrates the `data` plugin from the OrgSDK
monorepo (`packages/plugins/src/data/`) into this standalone repository. **No
plugin source behavior changed** — the eleven safe functions, the no-auth
contract (no `authProvider`, no `config`, no `httpEndpoints`), the static
`PluginModule` entry shape, and the `unpdf` runtime dependency are byte-identical
to the monorepo `1.0.1`.

### Why 1.0.2 (not 1.0.1)

The repository/package/schema additions alter the immutable publishable content
of the staged artifact:

- manifest `$schema` (`https://orgsdk.ai/schemas/plugin-manifest.v1.json`)
- manifest `entry` (`index.ts`)
- `marketplace.links.sourceRepo` provenance link
- type-only import specifiers (`orgsdk/plugins` → `@orgsdk/plugins`)
- the generated artifact `package.json` carrying the `unpdf` runtime dependency

Because catalog versions are write-once, the existing `1.0.1` artifact cannot be
re-published with this changed content — it would differ and be rejected with
HTTP 409. Rather than mutate the published history of `1.0.1`, the new artifact
lands as a fresh `1.0.2` entry.

### Changed

- Bump `plugin/.plugin.json` version `1.0.1` → `1.0.2` (catalog source of
  truth).
- Bump `package.json` version `1.0.1` → `1.0.2` (kept in sync; enforced by the
  CI version guard).
- Add manifest `$schema`, `entry`, and `marketplace.links.sourceRepo`.
- Update type-only import specifiers `orgsdk/plugins` → `@orgsdk/plugins`.

### Frozen (unchanged from monorepo 1.0.1)

- All eleven safe functions — `fetchData`, `convertCurrency`, `parsePdf`,
  `processData`, `transformData`, `chunkArray`, `uniqueBy`, `groupBy`,
  `sumArray`, `validateData`, `saveResult` — names, parameters, return types,
  metadata, tags, and the `parsePdf` docs block.
- The no-auth contract: no `authProvider`, no `config`, no `httpEndpoints`, no
  `tables`, no `guides/`.
- The static `PluginModule` entry (named `safeFunctions` export — not a
  factory).
- The `unpdf` runtime dependency (`^1.6.2`) and its usage in
  `document-functions.ts`.
- `plugin/docs/overview.md` — verbatim.
- Pre-existing inconsistencies: `saveResult` and `validateData` carry no
  `metadata` block (frozen, not refactored).

### Dependency-closure determination

`unpdf@1.6.2` declares `@napi-rs/canvas@^0.1.69` as an **optional peer**
dependency. The complete runtime closure required by the `data` plugin is:

- `unpdf` (direct runtime import: `extractText`, `getMeta`)
- unpdf's own transitive deps (bundled by `Bun.build` at publish time)

`@napi-rs/canvas` is **not** in the closure — it is only needed for canvas-based
rendering, not text extraction. The platform's `resolvePluginDeps` bundles the
full closure (minus `zod`, which is external and present in the daemon image)
into a single `__bundle.js`. `tests/unpdf-bundle.test.ts` verifies this end to
end: the bundle loads, `parsePdf` imports, and text extraction succeeds, all
with `@napi-rs/canvas` absent.

### Server-process assumptions

- **Publish time:** `resolvePluginDeps` runs `bun install` + `Bun.build` in a
  temp staging dir. Requires network access to resolve `unpdf` from npm. Produces
  a ~2.2 MB deterministic `__bundle.js`.
- **Daemon runtime:** imports `__bundle.js` directly. No `node_modules`, no
  native binary, no canvas. Works in the standard daemon container image.
