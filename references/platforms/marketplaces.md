# Shopee, Lazada, TikTok Shop

Marketplace sellers usually move the **catalogue** to their own Shopify store and keep selling on
the marketplace too. What moves and what doesn't:

| | Moves? |
|---|---|
| Products, variations, prices, stock, images | Yes |
| Buyers / customers | **No**: marketplaces don't share buyer emails. Invite buyers instead (a card in every parcel with a QR to the store and a welcome code). |
| Orders | Usually skip. They have no emails and belong to the marketplace's records. Import only if the merchant wants history in one place (guest orders). |
| Vouchers | Recreate the ones that make sense as Shopify discount codes (`discounts.csv`). |
| Reviews | Not exportable from most marketplaces; collect fresh ones. |

## Exports
- **Shopee**: Seller Centre → My Products → Mass Function / Mass Update → download the product
  file (Basic info + Sales info). Comes as .xlsx: open and **save as CSV UTF-8**.
- **Lazada**: Seller Center → Products → Manage Products → Export (all fields) → save as CSV.
- **TikTok Shop**: Seller Center → Products → Manage Products → Batch tools / Export → save as CSV.

Templates change often and may be in Malay, Thai, Vietnamese, Indonesian or Chinese. Always run
`inspect.mjs` first and add missing headers to `mapping.json`.

## Normalize
```
node <skill>/scripts/inspect.mjs exports/shopee.csv
node <skill>/scripts/normalize.mjs --platform shopee --entity products --input exports/shopee.csv -q
```
Platforms: `shopee`, `lazada`, `tiktok`.

## Specifics
- Rows sharing a Product ID / Parent SKU become one product; each row is a variation.
- The variation name ("Red,XL", "100ml") is split into option values. Name the options in
  `mapping.json` → `"products": { "optionNames": ["Colour", "Size"] }`, otherwise they are called
  "Variant" / "Option 1, 2".
- Some exports put the description in a separate file ("Basic info" vs "Sales info"): join them
  by Product ID first (a small script), or normalize both and merge.
- Marketplace image URLs work for import but can expire: import images early.
- Marketplace titles are keyword-stuffed ("Sacha Inchi Oil 100ml Halal Original Ready Stock
  KL"). Offer to clean titles for the brand store, keeping the old ones as SEO titles if useful.
- Prices on marketplaces often include fees/promos. Confirm the web price list with the merchant.

## Keep selling on both
To keep marketplaces in sync with Shopify (stock, orders), use a marketplace connector app from the
Shopify App Store for that region. Set it up after the catalogue is final, and decide which side
is the master for stock.
