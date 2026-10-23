# mapping.json: teach the normalizer new column names

Platforms rename export columns, use other languages, or come from plugins. When `inspect.mjs`
shows `—` for a field the export does have, add the column header to `mapping.json` in the
workspace. Mapped headers are tried first, then the platform preset, then generic names.

```json
{
  "products": {
    "title": ["Nama Produk"],
    "price": ["Harga"],
    "images": ["Gambar *"],
    "optionNames": ["Colour", "Size"],
    "useTitleForHandle": false
  },
  "customers": { "acceptsMarketing": ["Newsletter Opt-in"] },
  "orders": { "lineTitle": ["Produk"], "addr1": ["{P} Street Line 1"] }
}
```

- Matching ignores case, spaces and punctuation. `*` matches a number (`Image *` = Image 1,
  Image 2 …), and the values of every matching column are collected (images).
- `{P}` in order address fields stands for `Billing` / `Shipping` / `Delivery`.
- `optionNames` names options when the export only has a combined "variation" cell
  (marketplaces: `Red,XL` → Colour = Red, Size = XL).
- `useTitleForHandle: true` makes URLs from titles instead of the old slugs.

Field names per entity are the keys printed by `inspect.mjs` (and in `scripts/lib/presets.mjs`).
Main ones:
- products: `rowType id parent group handle url title description shortDescription vendor
  productType tags categories status price regularPrice salePrice compareAtPrice sku barcode
  inventory weight images optionName1..3 optionValue1..3 variation seoTitle seoDescription`
- customers: `id email firstName lastName name phone acceptsMarketing createdAt tags note company
  address1 address2 city province zip country locale`
- orders: `number date paidAt closedAt status paymentStatus fulfillmentStatus currency email
  firstName lastName billingName phone lineTitle lineSku lineVariant lineQty linePrice lineTotal
  shipping shippingTitle discount discountCode tax total refunded gateway note` + address parts
  `addrName addrFirst addrLast addrCompany addr1 addr2 addrCity addrProvince addrZip addrCountry addrPhone`
- discounts: `code type value minimumSubtotal startsAt endsAt usageLimit usedCount
  oncePerCustomer customerEmails`

How rows become products: rows are grouped by `group` / `id` / `handle` / title. Rows whose
`rowType` says variant (variation, Variant, SKU) or that point to a `parent` become variants
of that product; rows with no title continue the previous product (Shopify, Squarespace).
Sale price below the regular price becomes price + compare-at price.

If a source is too irregular for mapping, write a 20-line script that outputs the standard format
(references/data-format.md) instead of bending the normalizer.
