# @orgsdk/plugin-data

Official OrgSDK plugin for data utilities — HTTP fetching, array processing,
transformation, currency conversion, and PDF text extraction. No credentials
required; every function is immediately callable once the plugin is enabled on
an agent. Eleven safe functions covering the common fetch → transform →
validate → store pipeline plus niche helpers (mock currency rates, base64 PDF
parsing via `unpdf`).

[![CI](https://github.com/OrgSDK/orgsdk-plugin-data/actions/workflows/ci.yml/badge.svg)](https://github.com/OrgSDK/orgsdk-plugin-data/actions/workflows/ci.yml)

## Repository layout

```
orgsdk-plugin-data/
├── .github/workflows/
│   ├── ci.yml                 # calls the shared reusable CI workflow (OrgSDK/plugins)
│   └── publish-catalog.yml    # calls the shared reusable publish workflow (opt-in; manual dry-run)
├── plugin/                    # the publishable plugin folder
│   ├── .plugin.json           # manifest (slug, version, marketplace; no auth block)
│   ├── index.ts               # entry — static PluginModule (named safeFunctions export)
│   ├── currency-functions.ts  # convertCurrency
│   ├── data-fetch.ts          # fetchData
│   ├── data-operations.ts     # sumArray / chunkArray / uniqueBy / groupBy
│   ├── data-processing.ts     # processData / transformData
│   ├── data-utils.ts          # saveResult / validateData
│   ├── document-functions.ts  # parsePdf (uses unpdf)
│   └── docs/overview.md       # plugin-local docs
├── tests/                     # bun:test — manifest, purity, shape, behavior, packaging, unpdf-bundle smoke
├── docs/                      # contract migration, release/promotion contract
├── package.json
├── tsconfig.json
├── biome.json
└── README.md
```

The `plugin/` folder is the canonical source for the `data` plugin; it is
published to the OrgSDK catalog on merge to `main` when opted in via the
`ORGSDK_ENABLE_CATALOG_PUBLISH` repo variable (see [docs/release.md](docs/release.md)).

## Local development

Requires [Bun](https://bun.sh) ≥ 1.3.x.

```bash
# Install (frozen lockfile in CI; dev: generates one)
bun install

# Lint + format check
bun run check

# Typecheck (no emit)
bun run typecheck

# Run tests
bun run test

# Validate manifest + source purity (orgsdk-plugin validate)
bun run validate

# Stage distributable artifact into dist/ (orgsdk-plugin package)
bun run package

# Full build pipeline (typecheck → validate → package)
bun run build
```

The `validate`, `package`, `version-guard`, and `publish` npm scripts delegate to
the [`orgsdk-plugin`](https://www.npmjs.com/package/@orgsdk/plugins) CLI shipped
by the `@orgsdk/plugins` dev dependency. There are no local management scripts.

## Functions

| Function | Purpose | Mode |
|---|---|---|
| `fetchData` | Fetch JSON data from a URL (outbound HTTP). | readonly / discovery |
| `convertCurrency` | Convert an amount between currencies (frozen mock rate table). | readonly |
| `parsePdf` | Extract text + metadata from a base64-encoded PDF (via `unpdf`). | readonly |
| `processData` | Process a data array (filter / sort / reverse). | readonly |
| `transformData` | Transform a data array (pluck / sum / avg / count). | readonly |
| `chunkArray` | Split an array into chunks of a given size. | readonly |
| `uniqueBy` | Remove duplicates from an array by key. | readonly |
| `groupBy` | Group array items by key. | readonly |
| `sumArray` | Sum all numbers in an array. | readonly |
| `validateData` | Validate data against a rules object. | (no metadata) |
| `saveResult` | Save a result into a storage object (in-workflow). | (no metadata) |

No function declares `requiredCredentials` — this is a no-auth plugin.

## Credentials

**None.** This plugin has no `auth` block and no `requiredCredentials`. Every
function is immediately callable once the plugin is enabled on an agent. Note
that `fetchData` makes outbound HTTP — the target URL is your responsibility.

## Manifest & version rules

- The manifest lives at `plugin/.plugin.json`.
- `version` is the **source of truth** for the catalog — bump it on every
  publishable content change (the CI version guard enforces this).
- `package.json` → `version` is kept in sync with the manifest (enforced by the
  version guard).
- Versions are **write-once** in the catalog: re-publishing the same
  `(slug, version)` with identical content is idempotent; differing content is
  rejected (HTTP 409). Treat every publish as forward-only.
- See [docs/release.md](docs/release.md) for the automatic publish model and
  required repository settings.

## CI/CD

CI and catalog publishing delegate to centrally maintained **reusable
workflows** in [OrgSDK/plugins](https://github.com/OrgSDK/plugins), pinned to an
immutable commit. The caller workflows (`.github/workflows/`) only wire up
triggers, the opt-in gate, artifact names, and secrets — no plugin mechanics are
duplicated. See the
[reusable-workflows docs](https://github.com/OrgSDK/plugins/blob/main/docs/reusable-workflows.md)
for the full contract.

## Runtime dependency: unpdf

`document-functions.ts` imports `extractText` and `getMeta` from
[`unpdf`](https://www.npmjs.com/package/unpdf) (v1.6.2) at runtime. At publish
time, the platform's `resolvePluginDeps` bundles the plugin entry plus `unpdf`
(and its full transitive closure) into a single `__bundle.js` ESM file via
`Bun.build`. The daemon imports that bundle directly — there is **no runtime
node_modules resolution** in the tenant container.

`unpdf` declares `@napi-rs/canvas` as an **optional peer** dependency. It is
only needed for canvas-based rendering; **text extraction does not require it**.
Accordingly, `@napi-rs/canvas` is deliberately absent from the published
artifact — `tests/unpdf-bundle.test.ts` proves the bundle loads and extracts
text without the native binary, and `tests/purity.test.ts` guards against its
re-introduction.

See [docs/contract-migration.md](docs/contract-migration.md) for the full
dependency-closure analysis.

## Security constraints

- No stored credentials, no OAuth flow, no auth provider — this plugin's
  contract surface is `safeFunctions` only.
- Source purity is enforced: no imports from private `@orgsdk/*` packages, no
  cross-plugin imports, no runtime value imports from the authoring SDK. The
  `validate` script and `tests/purity.test.ts` guard this.
- Publish credentials (`ORGSDK_PUBLISH_TOKEN`) live as a GitHub secret
  (repository-level or `catalog-publish` environment); they are never committed
  to the repo. See [docs/release.md](docs/release.md).

> **Pre-existing SSRF/resource concerns (frozen, not refactored in this
> extraction).** `fetchData` performs an arbitrary `fetch()` with only a scheme
> check (`http://`/`https://`) — there is no private-IP blocklist, no redirect
> cap, and no timeout. `convertCurrency` uses a hardcoded mock rate table with
> an artificial 50 ms delay. These behaviors are frozen verbatim per the
> migration discipline (learning #6 — never combine a behavioral/security
> refactor with an extraction). See
> [docs/contract-migration.md](docs/contract-migration.md#known-pre-existing-issues-recorded-not-fixed-in-this-release).

## Authoring contract & runtime dependency

The plugin authoring types come from the public
[`@orgsdk/plugins`](https://www.npmjs.com/package/@orgsdk/plugins) npm package,
imported type-only (`import type { … } from "@orgsdk/plugins"`). The SDK is a
dev-only dependency. The runtime artifact carries **one** runtime dependency —
`unpdf` (`^1.6.2`).

See [docs/contract-migration.md](docs/contract-migration.md).

## Source attribution

Extracted from the OrgSDK monorepo at:

- **Source path:** `packages/plugins/src/data/`
- **First monorepo commit touching the source:** `a3cbecf123be62e99b1a9c3b2eef06a5a137977b`
- **Last monorepo commit touching the source:** `ca6be564d5041c5fc097d2b4a4ef164e87190deb`
- **Monorepo HEAD at extraction:** `d1fdba5ea30b4b7eb9221de8141619f174df071c`

No plugin behavior changed in this extraction — only the type-only import
specifiers (`orgsdk/plugins` → `@orgsdk/plugins`), the manifest `$schema`,
`entry`, `version`, and `marketplace.links.sourceRepo` were added.

## License

Proprietary — All rights reserved. This source is the confidential property
of OrgSDK. No part of this repository may be reproduced, distributed, or
transmitted in any form without the prior written permission of OrgSDK.
Unauthorized use, modification, or redistribution is strictly prohibited.
