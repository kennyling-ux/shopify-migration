# Script reference

All scripts: Node 22+, no dependencies. Run from the workspace folder (or `--workspace <dir>`).
Common flags: `--dry-run` (never writes), `--limit <n>` (first n records), `-q/--quiet`
(per-record lines to the log only), `-v` (debug), `--file <path>` (other input file), `-h`.
Every run writes `logs/<script>-<time>.log`. Lines: `+` create, `~` update, `=` skip, `✗` failed.

| Script | Reads | Does |
|---|---|---|
| `init.mjs [dir]` | – | Creates a workspace. |
| `check.mjs` | store | Token, scopes, currency, timezone, locations, languages. Read-only. |
| `inspect.mjs <file>` | an export | Detects platform/entity, shows field→column mapping, unused columns. Short output for AI use. `--rows n` to show sample rows (hidden for customers/orders by default). |
| `normalize.mjs` | an export | `--platform --entity --input [--map] [--append]` → `data/<entity>.json`. Offline. |
| `import-products.mjs` | data/products.json | Creates products (productSet) with options, variants, images, stock, collections, SEO; publishes to Online Store. Existing handles skipped unless `--update` (`--images`, `--stock` to also replace those). `--status DRAFT` for a hidden first pass. `--no-publish`. |
| `import-customers.mjs` | data/customers.json | Creates/updates by email. Tag `MIGRATION_TAG`. Consent only where recorded. `--sync-consent`. |
| `import-discounts.mjs` | data/discounts.json | Creates codes; skips existing, expired (unless `--include-expired`), used-up. Customer/product restrictions must resolve or the code is not created. |
| `import-orders.mjs` | data/orders.json | Historical orders: no emails, no stock change. Name `#<ORDER_PREFIX><number>`. Links/creates customers by email (`--no-customers`). `--per-minute` (default 30; dev/trial stores ≈5). `--statuses`. Progress kept in `logs/orders-imported.state.json`. |
| `import-content.mjs` | data/articles.json, data/pages.json | Blog posts (blogs created by title) and pages. `--rehost-images` copies body images to Shopify Files. `--update`. `--only articles|pages`. |
| `build-redirects.mjs` | old sitemap / URL list + data/*.json | `--sitemap <url>` / `--urls <file>` / `--locales zh,ms` → `data/redirects.csv` + `data/redirects-unmatched.txt`. Hand-edited rows in redirects.csv are kept. Offline (reads the old site's sitemap only). |
| `import-redirects.mjs` | data/redirects.csv | Creates/updates URL redirects by path. |
| `verify.mjs` | data/*.json, store, site | Counts source vs store; `--site https://domain` checks each redirect and product page; `--old-urls file` finds 404s. |

## Order of a typical run
```
check → inspect → normalize (each entity) → import-products → import-customers →
import-discounts → import-orders → import-content → build-redirects → import-redirects → verify
```

## Rate limits and time
GraphQL cost limits are handled automatically (the client waits when the bucket is low).
Rough speeds: products ~1–2 s each (images process in the background), customers ~0.3 s,
orders 2 s each at 30/min (12 s on dev/trial stores). 10,000 orders ≈ 6 hours: start them early,
run in the background, re-run safely if interrupted.
