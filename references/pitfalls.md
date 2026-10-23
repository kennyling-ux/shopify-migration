# Pitfalls (from real migrations) and fixes

| Symptom | Cause | Fix |
|---|---|---|
| Token request fails `shop_not_permitted` | App and store in different Shopify organizations | Create/install the app from the organization that owns the store. |
| `HTTP 401/403` on every call | Wrong secret, app not installed, or scopes missing | `check.mjs`; re-copy the secret; release a version with the scopes and reinstall. |
| Metafield definition rejected | Namespace shorter than 3 characters | Use a 3+ character namespace (`so2`, `brand`). |
| Order import stalls with "too many" errors | Dev/trial stores allow ~5 orders a minute via API | `--per-minute 5`, run in the background; it resumes safely. |
| Order totals warning on dry run | Export's line price already has the discount taken off, or fees/taxes missing | Use line subtotal ÷ quantity, or map `tax`; check 2 orders against the old admin. |
| Imported customers got a "welcome" email/code | Automation triggered on customer create | Tag imports (`MIGRATION_TAG`) and exclude the tag in Flow/apps before importing. |
| Customer created without phone | Phone already used by another customer, or invalid | Expected: Shopify allows one customer per phone. Set `DEFAULT_COUNTRY` for local formats. |
| Variant error "options" | Two variants with the same option values, or an "Any …" value | Fix data/products.json; WooCommerce "Any" variations are dropped by normalize. |
| More than 3 options | Shopify limit | Split into separate products or merge options (e.g. "Size / Fit"). |
| Images missing after import | Source URL unreachable, hotlink protection, or relative path | Check one URL in a browser; set base URL (Wix/Magento); download images and use local paths. |
| Old images still load from the old server | Body images in blog posts | `import-content.mjs --update --rehost-images` before the old site goes down. |
| Redirect does nothing | A live page exists at that path, or the path has a trailing slash/locale prefix difference | Shopify only redirects missing paths; add the `/zh/…` variants; test with `verify.mjs --site`. |
| Theme CLI errors on a valid folder | Brackets/special characters in the path | Work from a symlink with a plain path. |
| Theme looks "broken" after a push | Pushed partial files or JSON templates referencing removed sections | Push the whole theme to an unpublished theme first; diff before `--live`. |
| Translations disappear | Translations were made on another theme | Translate the published theme; re-apply after switching. |
| Customer account page stuck loading in the editor | Extension waits for a token the editor never gives | Show sample data in editor/preview with a timeout fallback. |
| Checkout looks flat/off-brand | Default branding | Set logo, colours, fonts and corner radius in the checkout and accounts editor. |
| Subdomain shows another site's SSL certificate | Subdomain points to a shared server with no certificate for it | The server owner adds the site config and a certificate (e.g. certbot) for that subdomain. |
| Customers say they "can't log in" | Expecting old passwords | Customer accounts use email codes: say so in the launch email and on the login page. |
| Browser blocks the second download when exporting via REST | Multiple automatic downloads blocked | One file per download, or allow multiple downloads for the site. |
| Price shows in the wrong format | Currency formatting not set | Settings → General → Change formatting; check theme money filters. |
