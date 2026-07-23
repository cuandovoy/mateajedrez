# UI Pattern Heuristics

Prioritize the accessibility tree and visible text over CSS selectors or class names — visual design varies too much between stores for selectors to generalize, and class names are frequently obfuscated by build tooling.

## Prices

- A strikethrough-styled price next to a second, non-struck price almost always means: struck = original, other = final/discounted. Confirm via computed style (`line-through`) when available, not just visual proximity.
- If only one price is shown but a "before" price appears elsewhere (badge, tooltip, product detail vs. listing), treat the listing price as the one currently charged.
- Compute `discount_percentage` as `(original - final) / original * 100` when the site shows both prices but no explicit percentage badge.

## Badges (offer / stock)

- Match by visible text first, in any language: `SALE`, `OFERTA`, `OUTLET`, `DESCUENTO`, `SIN STOCK`, `AGOTADO`, `ÚLTIMAS UNIDADES`, `NUEVO`, `-XX%`. Color/position is a secondary signal only (e.g. a red top-left badge commonly marks discounts, but the text is authoritative).
- A disabled/greyed "add to cart" control combined with stock-related text is a stronger out-of-stock signal than a badge alone.

## Filters and sorting

- Look for `role="combobox"`, `<select>`, checkbox/radio groups, or chip/button groups labeled by category, price range, brand, size, color.
- Sort controls are usually a single dropdown near the results count ("ordenar por", "sort by").

## Pagination

- **Numbered**: explicit page links/buttons with numbers.
- **"Load more" button**: a single button ("Ver más", "Cargar más", "Show more") that appends results without a full navigation.
- **Infinite scroll**: no button; new products appear while scrolling. Detect by scrolling and checking whether the product count grows without a click.

## Variant selectors (size/color)

- Grouped controls labeled by attribute name ("Talle", "Color", "Size"), rendered as swatches, buttons, or a `<select>`. An unavailable variant is usually visually distinct (greyed out, struck through, or has a "sin stock" tooltip) rather than removed from the list.
