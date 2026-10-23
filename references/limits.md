# What moves, what doesn't

Tell the user this up front. Surprises at go-live are what make migrations go badly.

| Data | Moves? | Notes |
|---|---|---|
| Products, variants, prices, sale prices, stock, SKUs, barcodes, weights | Yes | Max 3 options per product (Shopify limit); more must be split or turned into separate products. |
| Product images | Yes | Must be reachable by URL (or local files). Wix/Magento may need a base URL. |
| Categories | As manual collections | Smart (rule-based) collections can be set up afterwards by hand. |
| Customers, addresses, phone, tags, notes | Yes | Phone must be valid E.164 and unique per customer (duplicates are dropped with a warning). |
| Customer passwords | **No** | No platform exports usable passwords. Shopify customer accounts sign in with an emailed one-time code, so customers need nothing to "reset". Tell them in the launch email. |
| Email marketing consent | Only where recorded | Customers without recorded opt-in are imported as not subscribed. Don't guess. |
| Order history | Yes, as historical orders | Read-only history with totals, lines, addresses, status. No payments are charged, no emails sent, stock untouched. Rate-limited, so large histories take hours. |
| Discount codes / coupons | Yes | Percentage, fixed amount, per-item, free shipping, minimum spend, dates, usage limits, customer and product restrictions. Exotic rules (BOGO, tiered) need manual setup or an app. |
| Gift card balances | Depends | If gift cards can't be created by API on the plan, convert balances to store credit (references/loyalty.md). |
| Store credit, loyalty points, memberships | Yes, with a plan | references/loyalty.md. |
| Blog posts, pages | Yes from WordPress-format XML (WordPress, WooCommerce, Squarespace); otherwise CSV, copy or scraping | Page-builder layouts (Elementor, Divi, Wix editor) do not carry over: content moves, layout is rebuilt in the theme. |
| Reviews | Via a reviews app | Export reviews from the old platform/app and import into the chosen Shopify reviews app (most accept CSV). |
| URLs and SEO | Via redirects + SEO fields | Shopify URL structure is fixed (/products/, /collections/, /blogs/, /pages/). Redirects keep old links and rankings. |
| Design | Rebuilt | Themes do not transfer between platforms. |
| Subscriptions | Via the subscription app's migration tool | Payment tokens need the payment provider's help; plan this separately. |
| Marketplace customers (Shopee, Lazada, TikTok Shop) | **No** | Marketplaces don't share buyer emails. Products move; buyers must be invited to the new store. |
| Analytics history | No | Keep the old reports; Shopify analytics starts at launch. Keep Google Analytics / Search Console properties. |
