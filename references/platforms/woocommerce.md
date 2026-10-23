# WooCommerce / WordPress

Proven on a real migration (products, customers, orders, coupons, blog, redirects, bilingual site).

## Exports
| Data | Where | File |
|---|---|---|
| Products | wp-admin → Products → **Export** (all columns, all products, include custom meta if needed) | `products.csv` |
| Posts, pages, coupons, media list | wp-admin → Tools → **Export** → All content | `wordpress.xml` |
| Customers | No built-in full export. Options: (a) WooCommerce → Customers → Download (basic fields); (b) an export plugin (WP All Export, "Customer/Order/Coupon Export"); (c) the REST API `/wp-json/wc/v3/customers` | `customers.csv` |
| Orders | No built-in CSV. An export plugin (one row per line item), or REST `/wp-json/wc/v3/orders` | `orders.csv` |

**No plugin allowed?** While the user is signed in to wp-admin in the browser, the REST API works
with the cookie + nonce: get a nonce from `/wp-admin/admin-ajax.php?action=rest-nonce`, then page
through `/wp-json/wc/v3/orders?per_page=100&page=N` with header `X-WP-Nonce` and convert to CSV
in the page, saving it as a download (one file per download: browsers block several at once).
Nonces expire after ~12–24 h: fetch a new one if you get 403.

## Normalize
```
node <skill>/scripts/normalize.mjs --platform woocommerce --entity products  --input exports/products.csv -q
node <skill>/scripts/normalize.mjs --platform woocommerce --entity customers --input exports/customers.csv -q
node <skill>/scripts/normalize.mjs --platform woocommerce --entity orders    --input exports/orders.csv -q
node <skill>/scripts/normalize.mjs --platform wordpress   --entity discounts --input exports/wordpress.xml -q
node <skill>/scripts/normalize.mjs --platform wordpress   --entity articles  --input exports/wordpress.xml -q
node <skill>/scripts/normalize.mjs --platform wordpress   --entity pages     --input exports/wordpress.xml -q
```

## Specifics
- Variable products: parent row (`Type` variable) + `variation` rows linked by `Parent` (`id:123`).
  Variation rows with an attribute value "Any …" are dropped (Shopify needs concrete values).
- `Published` 1 → ACTIVE, 0/-1 → DRAFT. `Sale price` + `Regular price` → price + compare-at.
- Categories "Body > Lotion" become the collection "Lotion" (leaf). Want parents too? Add them to
  `collections` in data/products.json, or create smart collections later.
- The default product CSV has no slug column. Product URLs come from the sitemap at redirect
  time (`/product/<slug>/` matched by handle); if slugs differ from titles, add `sourceSlug`.
- Order CSVs from plugins often have the discount already taken off the line price. If totals
  don't add up (warning on dry run), use the line subtotal ÷ quantity as the price.
- Statuses: completed → paid + fulfilled; processing → paid; on-hold/pending → pending;
  refunded; cancelled/failed → voided (skipped by default).
- Coupons with an email restriction become customer-specific codes (import customers first).
- Yoast / Rank Math / AIOSEO titles and descriptions in the XML become SEO fields.
- Shortcodes and page-builder content (Elementor, Divi, WPBakery) are stripped with a warning:
  rebuild those pages in the theme.
- Polylang/WPML second language: export each language, import the main one, add the other
  through Shopify's Translate & Adapt app (or the translations API); mirror redirects with
  `build-redirects.mjs --locales zh`.
- Images load from `/wp-content/uploads/…`: keep the old server reachable until imports and
  `--rehost-images` are done.

## Retiring WordPress
Keep it running (password-protected or on a temporary subdomain) for 30 days after go-live.
Back up the database and `wp-content` first. If other apps run on the same server (referral
apps, booking systems), remove only WordPress, not the server.
