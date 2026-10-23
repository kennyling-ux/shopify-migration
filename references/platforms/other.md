# Other sources: Magento, another Shopify store, any CSV, sites with no export

## Any CSV or spreadsheet
1. Save as CSV UTF-8. `node <skill>/scripts/inspect.mjs exports/file.csv --platform csv`.
2. Map the missing fields in `mapping.json` (references/mapping.md).
3. `normalize.mjs --platform csv --entity <entity> --input …`, spot-check data/<entity>.json.
For tiny catalogues (under ~30 products) it can be faster to fill Shopify's own product CSV
template and import it in admin (Products → Import); use the scripts when there are variants,
customers, orders or redirects too.

## Magento / Adobe Commerce
- System → Data Transfer → Export: entity Products (CSV), Customers Main File, Customer Addresses.
- `--platform magento`. Configurable products: the configurable row is the product, the
  `simple` children are variants. If children come out as separate products, set `parent` in
  `mapping.json` to the column linking them (often in `configurable_variations`) or pre-process.
- Image paths are relative (`/a/b/abc.jpg`): set `MAGENTO_MEDIA_URL=https://old.com/media/catalog/product`
  in `.env`.
- Orders: use an extension or the REST API; Magento has no order CSV export by default.

## Another Shopify store
Use `--platform shopify` with the Products export (Handle groups rows), the Customers export and
an order export app, or Shopify's own Store Importer / an app like Matrixify for full copies.

## No export at all (custom site, closed platform)
1. Product feed first: many sites expose a Google Shopping / Facebook catalogue feed (XML/CSV):
   ask the merchant or check their Merchant Center. That is the cleanest source.
2. Platform API if the merchant can create API keys.
3. Scraping as a last resort, only the merchant's own site, gently (1 request/second): collect
   product URLs from the sitemap, read each page's JSON-LD (`<script type="application/ld+json">`
   with `@type: Product`: name, description, image, offers/price, sku). Write a small script
   that outputs data/products.json in the standard format. Variants are often missing from JSON-LD
   and need manual work.
4. Customers and orders without an export: ask the merchant for their payment provider or email
   marketing tool export (Stripe, Mailchimp, Klaviyo). These hold the customer list and consent.
