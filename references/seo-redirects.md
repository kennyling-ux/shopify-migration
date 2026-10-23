# SEO and redirects

Goal: every old URL that had traffic or links lands on the right new page (301), and search
engines see the new site quickly.

## Redirects
1. **Collect old URLs**: the old sitemap (`/sitemap.xml`, `/sitemap_index.xml`,
   `/wp-sitemap.xml`, `/sitemap-products.xml`), plus top landing pages from Google Search Console
   / Analytics (export → `exports/top-urls.txt`), plus URLs printed on packaging, QR codes, ads,
   social bios.
2. **Build**: `build-redirects.mjs --sitemap <url> --urls exports/top-urls.txt [--locales zh]`.
   Matches by recorded source URL, then by slug = new handle, then common platform paths.
3. **Fix the leftovers** in `data/redirects-unmatched.txt`: add rows to `data/redirects.csv`
   (hand-made rows are kept on rebuild). Send dead products to their collection or a close
   alternative, not the home page.
4. **Import**: `import-redirects.mjs --dry-run -q`, then live.
5. **Verify after DNS**: `verify.mjs --site https://domain -q` and `--old-urls exports/top-urls.txt`.

Shopify redirect rules: no wildcards or regex (list every path), query strings are passed
through, redirects only fire when no live page exists at that path, and `/zh/…`-style language
paths need their own rows (`--locales`).

## SEO fields
- Product, collection, page and article SEO titles/descriptions import from the source when
  present (Yoast/Rank Math/AIOSEO in WordPress). Home page title, description and social sharing
  image: Online Store → Preferences.
- Write a home page title under ~60 characters (brand + what you sell + where) and a description
  of 150–160 characters; translate both for every published language.
- Alt text: imported product images get the product title as alt text.

## After go-live
- Google Search Console: add the domain property (if not there), submit `https://domain/sitemap.xml`,
  watch Pages → "Not found (404)" for two weeks and add redirects for anything that shows up.
- Keep the same Google Analytics property; install the Google & YouTube app or add GA4 via the
  Shopify Customer events.
- Update links you control: social bios, Google Business Profile, marketplace shop pages,
  email signatures, QR codes (or redirect their URLs).
- Facebook/WhatsApp cache link previews: refresh with the Facebook Sharing Debugger.
