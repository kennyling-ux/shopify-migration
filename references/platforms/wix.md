# Wix

## Exports
| Data | Where |
|---|---|
| Products | Dashboard → Store Products → Products → More Actions → **Export** (CSV) |
| Customers | Dashboard → Contacts → **Export** (CSV) |
| Orders | Dashboard → Store Orders → **Export** (CSV) |
| Coupons | No export: list them from Marketing → Coupons into `discounts.csv` |
| Blog | No export: copy posts, or crawl the published blog (references/platforms/other.md → Scraping) |

## Normalize
```
node <skill>/scripts/normalize.mjs --platform wix --entity products  --input exports/catalog_products.csv -q
node <skill>/scripts/normalize.mjs --platform wix --entity customers --input exports/contacts.csv -q
node <skill>/scripts/normalize.mjs --platform wix --entity orders    --input exports/orders.csv -q
```

## Specifics
- `handleId` groups a `Product` row and its `Variant` rows. Option names come from
  `productOptionName1..6` on the Product row; values from `productOptionDescription*` on variant
  rows. Shopify allows 3 options: products with more need splitting.
- `productImageUrl` holds Wix media file names separated by `;`. They are turned into
  `https://static.wixstatic.com/media/<name>` URLs automatically.
- `discountMode` PERCENT/AMOUNT + `discountValue` become a sale price with compare-at price.
- `inventory` may be `InStock` / `OutOfStock` instead of a number: those variants are imported
  untracked; set stock in Shopify afterwards if needed.
- Contacts include everyone who ever filled a form, not only buyers. Ask whether to import all
  contacts or only customers with orders (filter by label or by order emails).
- `Email subscriber status` "Subscribed" → subscribed; anything else → not subscribed.
- Wix URLs: `/product-page/<slug>`, `/category/<slug>`, `/post/<slug>`. build-redirects matches
  the slug to the new handle; check `redirects-unmatched.txt`.
