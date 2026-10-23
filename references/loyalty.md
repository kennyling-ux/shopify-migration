# Vouchers, store credit, loyalty and memberships

Customers notice when their balance or member perks disappear. Decide early how each one moves.

## What exists in Shopify
- **Discount codes**: imported by `import-discounts.mjs` (single-use, per-customer, min spend …).
- **Store credit**: native, all plans. A balance per customer, offered automatically at checkout.
  Create with the Admin API `storeCreditAccountCredit` (customer ID, amount, optional expiry),
  remove with `storeCreditAccountDebit`. Good home for old wallet balances, refunds-as-credit and
  "points converted to money".
- **Gift cards**: check whether the plan allows creating them by API; if not, convert old gift
  card balances to store credit or issue them in admin.
- **Customer tags and segments**: member tiers, sources, imported vs new (`MIGRATION_TAG`).
- **Customer account extensions**: custom pages/blocks in the customer account (rewards, member card).

## Moving balances
1. Export balances from the old system (points, wallet, gift cards) with customer emails.
2. Decide the conversion with the merchant (e.g. 100 points = 1.00 store credit) and a cut-off date.
3. Import customers first, then credit each balance (a small script: find customer by email →
   `storeCreditAccountCredit`), logging every amount. Dry-run the totals and get sign-off.
4. Tell customers in the launch email.

## Welcome offers and existing members
- Imported customers should **not** receive "new member" welcome codes again. Tag them
  (`MIGRATION_TAG`) and make any welcome automation or app skip that tag.
- Keep the same code format if customers already hold codes (e.g. `WELCOME-XXXXXX`), and import
  their unused personal codes with the customer restriction.

## App vs custom app
- **App Store loyalty app** (points, tiers, referrals): fastest, monthly fee, most offer CSV
  import of balances. Best for most stores.
- **Flow** (Shopify's automation app): tag customers, send codes, simple "spend X get Y" rules.
- **Custom app** (when rules are unusual or fees matter at scale): webhooks (`orders/paid`,
  `refunds/create`, `customers/create`) + store credit API + a customer account page. It can run
  on a free serverless tier (e.g. Cloudflare Workers + D1). Plan for idempotency (webhooks retry),
  refunds clawing back credit, and a test plan with a test gateway order and refund.

## Attribution ("where did this member come from?")
Capture UTM tags, referrer and referral/partner codes on the landing page (store them in the
browser for ~90 days), send them with the sign-up form, and save them as customer tags
(`src:instagram`, `outlet:<name>`) and metafields. Merchants can then filter customers by tag.
Give them tagged links for every bio and campaign (`?utm_source=instagram&utm_medium=bio`):
in-app browsers often hide the referrer.
