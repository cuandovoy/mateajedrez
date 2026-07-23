# Platform Detection

Detecting the underlying platform is optional — it speeds up navigation and explains quirks, but every heuristic in `ui-heuristics.md` must work without it. Never assume a platform's markup structure exists; verify before relying on it.

## Signatures to look for

- **VTEX**: URLs/assets containing `vtexassets.com`, `myvtex.com`, or `/api/catalog_system/` / `/_v2/` endpoints in network requests; `vtex.render-runtime` in page scripts. Facet-sidebar filters with per-option counts are common.
- **Shopify**: `cdn.shopify.com` assets, `window.Shopify` global, URLs like `/products/<handle>` and `/collections/<handle>`. A public `/products.json` endpoint often exists for bulk reads (plain GET, no auth) — useful when present, never assume it's enabled.
- **WooCommerce**: `wp-content/plugins/woocommerce` in asset paths, `add-to-cart=<id>` query params, WordPress REST endpoints (`/wp-json/wc/`).
- **Tiendanube (Nuvemshop)**: Tiendanube/Nuvemshop CDN domains, `LS` / `Tiendanube` globals in page scripts.
- **Fenicio**: common in Uruguay/regional retail — `fenicio` in asset paths or script sources, checkout subdomains like `*.fenicioshop.com`.
- **Unknown/custom**: default case. Rely entirely on the accessibility tree and visible text per `ui-heuristics.md`.

## How to detect

1. Read visible page structure first (accessibility tree / page text) — platform ID is a bonus, not a blocker.
2. If useful, inspect network requests or page source for the signatures above.
3. Don't spend more than one extra step chasing platform ID; if unclear, proceed generically.
