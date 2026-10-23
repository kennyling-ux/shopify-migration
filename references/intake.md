# Intake: questions to ask first

Ask these in one go (a form or a short list), not one by one. Write the answers into
`MIGRATION-PLAN.md`. Skip what the user already told you.

## The essentials
1. **Who are you?** Store owner doing it yourself, or a freelancer/agency doing it for a client?
   (Sets how much detail you give: click paths and plain words, or commands and file names.)
2. **Where is the store now?** Platform and URL. Any second channel (Shopee, Lazada, TikTok Shop,
   Amazon, a POS)?
3. **Size:** roughly how many products (and variants), customers, orders, blog posts, pages?
4. **What should move?** Products · customers · order history · discount codes and vouchers ·
   gift cards or store credit · loyalty points · blog posts · pages · reviews · URLs/SEO.
5. **Shopify store:** already created? Which plan? Is it the client's own store (it should be)?
6. **Design:** keep the current look, use a Shopify theme as is, or a new design? Any Figma or
   reference site?
7. **Deadline and budget**, including app budget (monthly apps add up).
8. **Domain:** who controls DNS (registrar / hosting login)? Is email on the same domain (then
   the MX records must be kept)? Anything else on subdomains (booking app, referral app …)?
9. **Payments:** which provider now, which on Shopify (Shopify Payments where available,
   otherwise Stripe, PayPal, local gateways)?
10. **Markets and languages:** which countries and currencies, which storefront languages?

## Good to know
- Marketing consent: does the old platform record who opted in to emails? (Only those can be
  imported as subscribed.)
- Taxes (inclusive or exclusive prices, registration), shipping zones and couriers.
- Apps and integrations in use: email marketing, reviews, loyalty, subscriptions, ERP, POS.
- Custom features that must keep working (memberships, B2B pricing, bundles, pre-orders).
- Who signs off on go-live, and when traffic is lowest (best time to switch DNS).

## Then tell them, before starting
- What will move automatically, what needs manual work, what cannot move (references/limits.md).
- The order of work and where they are needed (exports, logins, approvals, DNS).
- That nothing changes on the live site until the go-live step, and the old site stays as a
  fallback until the switch is confirmed.
