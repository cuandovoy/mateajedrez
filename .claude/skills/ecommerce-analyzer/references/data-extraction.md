# Data Extraction & Normalization

## Standard product schema

See `assets/product-schema.json` for the canonical shape. Core fields:

| Field | Type | Notes |
|---|---|---|
| `name` | string | As shown on the page |
| `sku` | string \| null | Only if the site exposes it |
| `url` | string | Canonical product URL |
| `currency` | string | ISO code when inferable (`UYU`, `ARS`, `USD`...), else the symbol as shown |
| `price_original` | number \| null | Pre-discount price, normalized (see below) |
| `price_final` | number | Price actually charged |
| `discount_percentage` | number \| null | Explicit badge value, or computed per `ui-heuristics.md` |
| `in_stock` | boolean | Derived from stock badges/button state |
| `stock_label` | string \| null | Raw text found (e.g. "Últimas 2 unidades") |
| `variants` | array | `{ attribute, value, available }` per option |
| `source_platform` | string \| null | From `platform-detection.md`, or `"unknown"` |
| `extracted_at` | string | ISO 8601 timestamp of extraction |

## Normalization rules

- Strip currency symbols and thousands separators before parsing numbers; detect the decimal separator by locale (`,` in most of Latin America/Europe vs. `.` in the US) rather than assuming one.
- Never invent a currency. If it can't be determined from the page, report the raw symbol/text as-is and flag it as unresolved.
- Round monetary values to 2 decimals only when the site itself uses decimals — some regional sites show whole-currency prices with `,` as a thousands separator, not a decimal mark. Check before rounding.
- This skill does not convert between currencies. Report the currency found; conversion is out of scope.
