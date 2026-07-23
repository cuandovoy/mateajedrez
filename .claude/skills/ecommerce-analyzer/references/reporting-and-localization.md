# Reporting & Localization

## Default format

- **2+ products** (comparison, category listing): a markdown table — columns: name, final price, discount %, stock, URL. Add more schema columns only when the user asks for detail or a field is central to the request (e.g. variants when comparing sizes).
- **Single product lookup**: a short structured summary (not a table) covering the same fields.
- Offer to expand to the full schema (`assets/product-schema.json`) when the user wants raw/complete data instead of a curated summary.

## Detail level

Default to the summary above. If the user asks for "everything", "raw data", or similar, return the full schema per product instead of the curated subset.

## Localization

- Report prices in the currency/locale actually found on the site — do not convert or reformat into the user's own locale unless asked.
- Match the language of the report to the user's chat language, regardless of the site's language (e.g. a French site analyzed for a Spanish-speaking user gets a Spanish-language report, with product names left as-is).
- Note the store's region/country when it affects interpretation (e.g. price meaning, tax inclusion) if that's visible on the site (footer, legal notice, currency itself).
