# Malaysia and Southeast Asia notes

Optional: read when the store sells in Malaysia, Singapore, Indonesia, Thailand, the Philippines or Vietnam.

## Store settings
- `.env`: `CURRENCY=MYR` (SGD, IDR, THB, PHP, VND), `SOURCE_TZ=+08:00` (+07:00 for Thailand,
  Vietnam and western Indonesia), `DEFAULT_COUNTRY=MY` so local numbers like `012-345 6789` become `+60123456789`.
- Currency display: Settings → General → Store currency → Change formatting. A common Malaysian
  choice is `RM{{amount}}` with currency `RM{{amount}} MYR`. Keep the theme consistent with it.
- Addresses: Malaysian states use codes in Shopify (e.g. `KUL`, `SGR`, `PNG`, `JHR`). Map full
  state names to codes if checkout or shipping rates depend on them.

## Payments
- Shopify Payments is not available in every SEA country. Common options: Stripe (cards,
  Apple/Google Pay; FPX availability depends on the account), and local gateways from the App
  Store for **FPX online banking** and e-wallets (e.g. Billplz, iPay88, Razer/Molpay, 2C2P,
  Xendit for Indonesia/Philippines). Many Malaysian buyers expect FPX and e-wallets: ask early.
- When switching gateways later, re-test store credit and discount codes at checkout.

## Shipping and tax
- Couriers: J&T, Pos Laju, DHL eCommerce, Ninja Van, City-Link, Lalamove (same day) through
  apps such as EasyParcel, Delyva or the courier's own app. Set zones: Peninsular vs East Malaysia
  usually have different rates.
- SST: decide tax-inclusive pricing (common for consumer brands) and configure taxes accordingly;
  confirm registration status with the merchant's accountant.

## Languages
- English plus Chinese (zh-CN at `/zh`) and/or Malay (ms at `/ms`) via Settings → Languages and
  the Translate & Adapt app. Section texts translate on the published theme. Mirror redirects for
  old language paths with `build-redirects.mjs --locales zh,ms`.

## Customers and consent
- PDPA (Malaysia/Singapore): import as email-subscribed only those with recorded consent; keep
  the privacy policy updated with the new processor (Shopify) and any apps.
- Marketplace buyers (Shopee/Lazada/TikTok) can't be imported: use parcel inserts with a QR code
  to the store's join page plus a welcome voucher, and tag those sign-ups by source.

## DNS hosts
Many local sites use Exabytes, Shinjiru, Hostinger or cPanel hosting. Their DNS editors differ but
the Shopify records are the same (references/go-live.md). Email is often hosted at the same
company or Zoho/Google: keep those MX records.
