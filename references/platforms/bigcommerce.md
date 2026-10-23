# BigCommerce

## Exports
| Data | Where |
|---|---|
| Products | Products → **Export** (default template, CSV; includes SKU rows) |
| Customers | Customers → **Export** |
| Orders | Orders → **Export** (choose a template with one line per product if offered) |
| Coupons | Marketing → Coupon Codes (copy into `discounts.csv`) |
| Blog | Storefront → Blog (no export; copy or crawl) |

## Normalize
```
node <skill>/scripts/normalize.mjs --platform bigcommerce --entity products  --input exports/products.csv -q
node <skill>/scripts/normalize.mjs --platform bigcommerce --entity customers --input exports/customers.csv -q
```

## Specifics
- `Item Type` Product rows start a product; `SKU` rows are its variants; `Rule` rows (price
  rules) are skipped. In the classic export the variant options are written into the name cell
  as `[S]Size=Small,[RT]Color=Red`: they are parsed into option names and values.
- The newer "bulk edit" template uses `Item` = Product/Variant and an `Options` cell such as
  `Type=Rectangle|Name=Color|Value=Red`. If options come out wrong, map `variation` to that column
  and check a few products; or convert with a short script.
- Category paths like `Shop All/Hats/Caps` become the collection "Caps" (leaf).
- Order exports often pack all products into one cell ("Product Details"). Split that cell into
  line rows with a short script before normalizing, or skip order history.
- Customer group names map to tags (`Customer Group` → tags), useful for B2B/wholesale pricing.
