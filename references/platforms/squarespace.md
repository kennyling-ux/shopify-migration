# Squarespace

## Exports
| Data | Where |
|---|---|
| Products | Commerce → Inventory (or Products) → **Export all** (CSV) |
| Customers | Contacts / Profiles → Export (CSV) |
| Orders | Commerce → Orders → **Download CSV** |
| Blog posts, pages | Settings → Website → Import & Export → **Export** → WordPress (XML) |
| Discounts | No export: list them from Commerce → Discounts into `discounts.csv` |

## Normalize
```
node <skill>/scripts/normalize.mjs --platform squarespace --entity products --input exports/products.csv -q
node <skill>/scripts/normalize.mjs --platform squarespace --entity orders   --input exports/orders.csv -q
node <skill>/scripts/normalize.mjs --platform wordpress   --entity articles --input exports/squarespace.xml -q
node <skill>/scripts/normalize.mjs --platform wordpress   --entity pages    --input exports/squarespace.xml -q
```

## Specifics
- The first row of a product carries product fields + its first variant; the following rows
  with an empty title are more variants (continuation rows).
- `Hosted Image URLs` are space-separated. `Sale Price` applies only when `On Sale` is Yes.
- The product slug comes from `Product URL` (`/shop/p/mug` → `mug`).
- Orders use one row per line item (`Lineitem name`, `Lineitem quantity` …), close to
  Shopify's own format, so they map without extra work.
- The XML export does not include commerce products, events or galleries, and image files stay
  on Squarespace's CDN: run `import-content.mjs --rehost-images` before the site is closed.
- Old URLs: `/shop/p/<slug>`, `/blog/<slug>` (depends on the collection URL).
