# Current execution contract

`fetchData` supports deliberate HTTP/HTTPS access, including private/loopback destinations. Run it only with the network authority appropriate to the project; the plugin is not an egress filter. Responses are limited to 2 MB with a 15-second I/O deadline; HTTP errors fail. PDF input is limited to 10 MB, output to 2 MB and 100 pages. `convertCurrency` uses frozen demonstration rates, not live financial data.

Native OAuth providers receive only `{source: "byo", secret_accessToken}`. The host owns refresh. The first-party relay is retired.

## Historical source reference

The following describes the former author-source host; current npm and native credential behaviour above takes precedence.

# Data Tools

Data utilities: HTTP fetching, array processing, transformation, currency
conversion, and PDF text extraction. No credentials required.

## What it does

The `data` plugin is the Swiss-army knife for shaping data inside workflows. It
covers the common pipeline stages — fetch → transform → validate → store — plus
niche helpers (currency conversion, PDF parsing) that would otherwise each need
their own integration. Everything runs in-process; nothing leaves the sandbox
except the explicit `fetchData` HTTP call.

Typical uses:

- **Fetch + transform** — pull JSON from an API, group it, and dedupe before
  writing it to a sheet (compose with `google-sheets`).
- **Invoice parsing** — extract text from a PDF attachment (compose with
  `gmail` + `llm`) and structure it.
- **Currency normalisation** — convert amounts to a reporting currency.
- **Bulk validation** — validate an array of records against rules before
  persisting.

## Functions

| Function | Purpose |
|---|---|
| `fetchData` | Fetch JSON data from a URL. |
| `convertCurrency` | Convert an amount between currencies. Returns `{ convertedAmount, rate, ... }`. |
| `parsePdf` | Extract text + metadata from a base64-encoded PDF. |
| `processData` | Process a data array (selectable processor). |
| `transformData` | Transform a data array (selectable transformer + key). |
| `chunkArray` | Split an array into chunks of a given size. |
| `uniqueBy` | Remove duplicates from an array by key. |
| `groupBy` | Group array items by key. |
| `sumArray` | Sum all numbers in an array. |
| `validateData` | Validate data against a rules object. |
| `saveResult` | Save a result into a storage object (in-workflow). |

The full function signatures (parameters, return types) are available via the
`plugins:info` command in the dashboard.

## Credentials

**None.** This plugin has no auth block and no `requiredCredentials`. Every
function is immediately callable once the plugin is enabled on an agent. Note
that `fetchData` makes outbound HTTP — the target URL is your responsibility.

## Using it in a workflow

```typescript
// Fetch, dedupe, and group
const raw = await fetchData("https://api.example.com/orders");
const deduped = uniqueBy(raw, "orderId");
const byRegion = groupBy(deduped, "region");

// Convert a single amount
const aud = await convertCurrency(100, "USD", "AUD");
console.log(aud.convertedAmount, aud.rate);

// Extract text from a Gmail PDF attachment (compose with gmail + llm)
// const att = await getMessageAttachment({ ... });
// const pdf = await parsePdf(att.dataBase64);
```

## Notes

- `convertCurrency` uses a fixed rate table, not a live feed — verify the rate
  freshness for financial use cases.
- `parsePdf` accepts **standard base64** — pass the `dataBase64` field from
  `getMessageAttachment()` directly.
- No `guides/` reference yet; agent usage patterns can be added later.
