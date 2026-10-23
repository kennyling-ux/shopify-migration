# Test, go live, hand over

## Before launch (on the password-protected store)
- [ ] `verify.mjs -q`: counts match; no ✗ left that matter.
- [ ] Spot-check in admin with the user: 3 products (simple, variants, on sale), 3 customers, 3 orders.
- [ ] Settings: store details and legal name, currency format (e.g. `RM{{amount}} MYR`), taxes,
      shipping zones and rates, checkout (accounts, required fields, marketing opt-in), notification
      emails with the logo, **sender email domain authenticated** (Settings → Notifications → sender
      email: add the DNS records Shopify shows, or emails go to spam).
- [ ] Policies: refund, privacy, terms, shipping, contact (Settings → Policies).
- [ ] Payments: provider connected in test mode. Test order with the test gateway / test card,
      then a refund. If store credit, gift cards or discount codes are used, test them at checkout.
- [ ] Customer accounts: sign in with a code, see order history (imported orders show there).
- [ ] Apps installed and configured: reviews, email marketing (sync list), loyalty, chat, analytics.
- [ ] Theme: every template on mobile and desktop, favicon, social sharing image, 404 page,
      search, cart, forms (contact, newsletter) deliver email.
- [ ] Redirects imported. Translations done for every published language.
- [ ] Final delta import: products/customers/orders created on the old site since the first
      export (re-export, normalize, import: existing records are skipped).

## Domain switch (the user does this, you give exact values)
In Shopify: Settings → Domains → Connect existing domain. At the DNS provider:
- `A` record `@` → `23.227.38.65` (remove other A/AAAA records on `@`)
- `CNAME` `www` → `shops.myshopify.com`
- **Keep MX, SPF/TXT, DKIM and any other records** (email keeps working).
- Subdomains used by other services (e.g. a referral app on `earn.domain`) stay pointed at their
  own servers; those servers need their own SSL certificate for that subdomain.
Lower the TTL a day before if possible. SSL is issued automatically after DNS resolves (minutes
to a few hours). Set the primary domain and redirect all other domains to it.

## Launch
- [ ] Switch payments to live; place one real low-value order and refund it.
- [ ] Remove the storefront password (Online Store → Preferences).
- [ ] `verify.mjs --site https://domain -q` (redirects 301, product pages 200).
- [ ] Search Console sitemap, analytics events visible.
- [ ] Announcement email: new store, sign in with email code, welcome offer, what's new.

## After launch
- Keep the old site offline but intact for ~30 days (password or temporary subdomain), with a
  database/files backup. Export anything still needed (email list, reviews, reports).
- Watch 404s, payment errors and abandoned checkouts daily for the first week.
- Then cancel the old platform/hosting plan and plugins. On shared servers, remove only the
  old shop, not other apps living there.

## Hand-over
Fill `templates/client-handoff.md`: logins and who owns them, where settings live, how to add
products and discounts, apps and their monthly cost, what was not migrated and why, support
contact. Rotate any password that was shared during the project.
