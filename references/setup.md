# Setup: store, access, workspace

## The Shopify store
- The store should belong to the merchant (their own Shopify account and billing), with the
  freelancer/agency as a staff or collaborator account. Development stores made from a partner
  account can be transferred to the merchant later; ask which they prefer.
- Set before importing: **store currency**, **timezone**, **weight unit**, **default location**
  (address), and the languages you will publish. Currency cannot be changed easily once there are
  orders, and imported prices are in this currency.
- Keep the storefront password on until go-live.

## Get API access (for the scripts)
The scripts need an Admin API token with these scopes (check.mjs lists what is missing):
`write_products, write_inventory, write_files, write_publications, write_customers,
write_orders, write_discounts, write_content, write_online_store_navigation`
(optional: `read_all_orders` to see orders older than 60 days).

**Option A (recommended): a Dev Dashboard app with client credentials.**
1. In the Shopify Dev Dashboard (dev.shopify.com), create an app in the same organization as
   the store. Give it the scopes above (in its configuration / `shopify.app.toml` access scopes).
2. Release a version and install the app on the store.
3. Copy the app's **Client ID** and **Client secret** into the workspace `.env` as `CLIENT_ID`
   and `CLIENT_SECRET`, and the store's myshopify domain as `SHOP`.
4. The scripts exchange these for a short-lived token themselves (client credentials grant).
   Error `shop_not_permitted` means the app and store are in different organizations.

**Option B: an Admin API access token** from an existing custom app, if the store has one:
put it in `.env` as `ADMIN_TOKEN` (leave CLIENT_ID/SECRET empty).

The user should paste secrets into `.env` themselves. Never ask for them in chat.

## Workspace
```
node <skill>/scripts/init.mjs ~/migrations/<store-name>
cd ~/migrations/<store-name>
```
Creates `.env`, `exports/`, `data/`, `logs/`, `MIGRATION-PLAN.md` and a `.gitignore` that keeps
credentials and customer data out of git. Fill in `.env` (currency, `SOURCE_TZ` such as `+08:00`,
`DEFAULT_COUNTRY` such as `MY` for local phone numbers). Then:
```
node <skill>/scripts/check.mjs
```
Run scripts from the workspace folder (or pass `--workspace <folder>`).

## Tools for theme work (optional)
Shopify CLI (`npm i -g @shopify/cli`) for theme development: `shopify theme dev`, `push`, `pull`.
**Paths with brackets or unusual characters** (e.g. `[03] Projects`) break the CLI: work from
a symlink with a plain path (`ln -s "<real path>" ~/store-theme`).
