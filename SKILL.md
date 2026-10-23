---
name: shopify-migration
description: Migrate an online store to Shopify from WooCommerce/WordPress, Shopee, Lazada, TikTok Shop, Wix, Squarespace, BigCommerce, Magento or any CSV. Covers products with variants and images, customers, order history, discount codes, blog posts, pages, URL redirects, theme, domain/DNS, payments and go-live. Use when someone wants to move, migrate, switch or replatform a store to Shopify, import products/customers/orders into Shopify, plan a Shopify launch, or fix SEO and redirects after a move. Ships zero-dependency Node scripts with dry runs, so the bulk work is done by code, not by the AI reading data.
license: MIT
metadata:
  author: Kenny Ling
  version: 1.0.0
---

# Shopify migration

Move a store to Shopify quickly, safely and cheaply. The scripts in `scripts/` do the heavy lifting
(reading exports, mapping columns, creating records through the Admin GraphQL API, redirects,
checks). Your job is to run the process: ask the right questions, map the data, read summaries,
make decisions with the user, and keep the go-live safe.

`<skill>` below means the folder this file is in. Scripts run with Node 22+ and need no `npm install`.

## Ground rules (speed, cost, safety)

1. **Never read a whole export into context.** Run `inspect.mjs` on it and read that summary.
   Use `--quiet` (`-q`) on every script: per-record lines go to the log file, the console shows
   failures, warnings and totals. Read a log only for the lines you need (`grep '^✗'`).
2. **Dry run first, then a small live batch, then the rest.** `--dry-run` never writes.
   `--limit 5` live, check it in admin with the user, then run without the limit.
3. **Every import is re-runnable.** Records are matched (handle, email, code, path, order number),
   so a re-run skips what exists. Fix the data and run again; never delete and redo.
4. **The user owns irreversible steps:** DNS changes, removing the storefront password, switching
   payments to live, sending emails to customers, deleting the old site. Prepare them, give exact
   click paths, and let the user do or approve them.
5. **Credentials stay in the workspace `.env`.** Never print tokens or secrets, never ask the user
   to paste passwords into chat, never type them into a page for them.
6. **Personal data:** keep customer/order rows out of the conversation. `inspect.mjs` hides sample
   rows for customers and orders by default.
7. Explain in plain words for store owners; give commands and file names for developers. Ask at
   the start which the user is (references/intake.md).

## Workflow

Track progress in the workspace's `MIGRATION-PLAN.md` (made by `init.mjs`). Phases:

### 1. Intake (5 minutes)
Ask the questions in **references/intake.md**: source platform, store size, what to move, design
approach, deadline, budget, technical level, markets and languages, payment provider.
Then say what will and will not move (references/limits.md) before any work starts.

### 2. Set up
- Workspace: `node <skill>/scripts/init.mjs <folder>`, then `cd <folder>`.
- Shopify store, staff access and API access: **references/setup.md**.
- `node <skill>/scripts/check.mjs`: token, scopes, currency, timezone, locations, languages.

### 3. Export from the source
Follow the platform guide: **references/platforms/** `woocommerce.md`, `marketplaces.md`
(Shopee, Lazada, TikTok Shop), `wix.md`, `squarespace.md`, `bigcommerce.md`, `other.md`
(Magento, another Shopify store, any CSV, scraping a site with no export).
Put the files in `exports/`. Excel files must be saved as CSV (UTF-8) first.

### 4. Map and normalize
```
node <skill>/scripts/inspect.mjs exports/products.csv
node <skill>/scripts/normalize.mjs --platform <p> --entity products --input exports/products.csv -q
```
If inspect shows a field as `—` that the export has under another name, add it to `mapping.json`
(**references/mapping.md**). The result is `data/<entity>.json` in the standard format
(**references/data-format.md**). Spot-check 2–3 records with the user (a simple product, one with
variants, one on sale). For unusual sources you may write `data/*.json` directly in that format.

### 5. Import (in this order)
```
node <skill>/scripts/import-products.mjs   --dry-run -q   # then --limit 5, then all
node <skill>/scripts/import-customers.mjs  --dry-run -q
node <skill>/scripts/import-discounts.mjs  --dry-run -q   # after customers and products
node <skill>/scripts/import-orders.mjs     --dry-run -q   # after products and customers
node <skill>/scripts/import-content.mjs    --dry-run -q --rehost-images
```
Command details: **references/scripts.md**. Orders are optional: history is nice for customers
and reports, but costs time (rate-limited). Ask the user. Marketplace orders are usually skipped.

### 6. Theme and design
**references/theme.md**: choose between a free Shopify theme (fastest, cheapest), a paid theme, or
porting a custom design; Liquid pitfalls that cost hours if you don't know them.

### 7. SEO and redirects
**references/seo-redirects.md**. Build redirects from the old sitemap, import them, verify:
```
node <skill>/scripts/build-redirects.mjs --sitemap https://old-site.com/sitemap.xml -q
node <skill>/scripts/import-redirects.mjs --dry-run -q
```

### 8. Apps, loyalty, payments, shipping, tax, emails
Loyalty, vouchers, store credit, memberships: **references/loyalty.md**. Region specifics
(Malaysia / Southeast Asia: MYR format, FPX, couriers, SST, Chinese/Malay storefronts):
**references/region-sea.md**. Everything else is on the go-live checklist.

### 9. Test, go live, hand over
**references/go-live.md**: test orders, domain and DNS (keep email records), removing the
password, post-launch checks with `verify.mjs --site https://domain`, the old site's retirement
plan, and the client hand-off (`templates/client-handoff.md`).

## When something fails
Read the ✗ lines and warnings, fix the data or mapping, re-run. Common causes and fixes from real
migrations: **references/pitfalls.md**. Cost and speed tactics: **references/cost-control.md**.

## Files
- `scripts/`: `init`, `check`, `inspect`, `normalize`, `import-products`, `import-customers`,
  `import-orders`, `import-discounts`, `import-content`, `build-redirects`, `import-redirects`,
  `verify`; `scripts/fixtures/` has sample exports for each platform to try things on.
- `references/`: the guides named above, plus `content.md` (blogs/pages from platforms without
  an XML export).
- `templates/`: `env.example`, `migration-plan.md`, `mapping.example.json`, `client-handoff.md`.
