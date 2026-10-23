# Standard data format (data/*.json)

Every import script reads a JSON array in this shape. `normalize.mjs` produces it from platform
exports; for unusual sources, write it yourself (a short script, or by hand for small stores).
Only the fields marked * are required. Money is a string or number in store currency.

## products.json
```json
{
  "handle": "logo-tee",                 // URL: /products/logo-tee (default: from title)
  "title": "Logo Tee",                  // *
  "descriptionHtml": "<p>Soft cotton</p>",
  "vendor": "Acme", "productType": "Apparel", "tags": ["cotton"],
  "status": "ACTIVE",                   // ACTIVE | DRAFT | ARCHIVED
  "collections": ["Apparel"],           // manual collections, created by title if missing
  "options": ["Color", "Size"],         // up to 3; omit for single-variant products
  "images": ["https://…/tee.jpg", { "src": "images/back.jpg", "alt": "Back" }],
  "variants": [{
    "sku": "TEE-R-S", "barcode": "…",
    "options": ["Red", "S"],            // same order as "options"
    "price": "59.00", "compareAtPrice": "79.00",
    "inventory": 5, "tracked": true, "continueSelling": false,
    "weight": 0.2, "weightUnit": "KILOGRAMS",
    "requiresShipping": true, "taxable": true
  }],
  "seo": { "title": "…", "description": "…" },
  "metafields": [{ "namespace": "custom", "key": "material", "type": "single_line_text_field", "value": "Cotton" }],
  "sourceId": "20", "sourceUrl": "https://old.com/product/logo-tee/", "sourceSlug": "logo-tee-2"
}
```
`sourceUrl` / `sourceSlug` feed build-redirects. Local image paths are relative to the workspace.

## customers.json
```json
{
  "email": "amy@example.com",           // *
  "firstName": "Amy", "lastName": "Tan", "phone": "012-345 6789",
  "acceptsMarketing": true,             // only true when the source recorded opt-in
  "marketingConsentAt": "2024-02-01T02:00:00Z", "createdAt": "2024-02-01",
  "tags": ["vip"], "note": "…", "locale": "zh-CN",
  "addresses": [{ "firstName": "Amy", "lastName": "Tan", "company": "", "address1": "1 Jalan A", "address2": "",
                  "city": "Kuala Lumpur", "provinceCode": "KUL", "zip": "50000", "countryCode": "MY", "phone": "" }],
  "metafields": [], "sourceId": "1"
}
```

## orders.json
```json
{
  "number": "1001",                     // * becomes #M1001 (ORDER_PREFIX)
  "date": "2025-01-02T01:58:00Z",       // *
  "paidAt": "…", "closedAt": "…", "currency": "MYR",
  "financialStatus": "PAID",            // PAID | PENDING | REFUNDED | PARTIALLY_REFUNDED | VOIDED
  "fulfillmentStatus": "FULFILLED",     // or omit
  "email": "amy@example.com", "firstName": "Amy", "lastName": "Tan", "phone": "…",
  "billingAddress": { … }, "shippingAddress": { … },   // address shape as customers
  "lines": [{ "sku": "MUG-W", "title": "Mug - White", "quantity": 1, "price": "15.00" }],  // *
  "shipping": { "title": "Standard", "amount": "5.00" },
  "discount": { "code": "WELCOME10", "amount": "2.00" },
  "tax": "0.00", "taxesIncluded": false, "taxTitle": "SST",
  "total": "40.00", "refunded": "0.00", "gateway": "Stripe", "note": "…", "tags": []
}
```
Lines match Shopify variants by SKU; unknown SKUs become custom line items (history still correct).

## discounts.json
```json
{
  "code": "WELCOME10",                  // *
  "type": "percentage",                 // percentage | fixed_amount | fixed_per_item | free_shipping
  "value": "10",                        // percent or amount
  "minimumSubtotal": "100", "startsAt": "…", "endsAt": "…",
  "usageLimit": 100, "usedCount": 3, "oncePerCustomer": true,
  "customerEmails": ["amy@example.com"], "productHandles": ["logo-tee"],
  "combinesWith": { "orderDiscounts": false, "productDiscounts": false, "shippingDiscounts": true }
}
```

## articles.json / pages.json
```json
{ "blog": "News", "handle": "my-post", "title": "My post", "bodyHtml": "<p>…</p>", "summary": "…",
  "author": "Amy", "publishedAt": "2025-01-02", "tags": ["tips"], "image": "https://…/cover.jpg",
  "seo": { "title": "…", "description": "…" }, "sourceUrl": "https://old.com/my-post/" }
```
Pages use `handle`, `title`, `bodyHtml`, `seo`, `sourceUrl` (no blog, author, image).

## redirects.csv
```
path,target
/product/logo-tee,/products/logo-tee
/product-category/apparel,/collections/apparel
```

## collections.json (optional)
`[{ "handle": "apparel", "title": "Apparel", "sourceUrl": "https://old.com/category/apparel/" }]`:
only used by build-redirects to map old category URLs.
