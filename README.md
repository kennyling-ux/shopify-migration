# shopify-migration

An agent skill that moves an online store to **Shopify** from WooCommerce/WordPress, Shopee,
Lazada, TikTok Shop, Wix, Squarespace, BigCommerce, Magento or any CSV. Works with **Claude Code**,
**OpenAI Codex** and other tools that read the open Agent Skills format (`SKILL.md`).

It gives the AI a proven process (intake → exports → mapping → import → theme → redirects →
go-live → hand-over) and zero-dependency Node scripts that do the bulk work, so the AI spends its
tokens on decisions, not on reading spreadsheets.

**What it migrates:** products (variants, images, stock, sale prices, collections, SEO),
customers (addresses, consent, tags), order history, discount codes, blog posts and pages,
URL redirects. **Guides for:** theme choice and porting, DNS and go-live, payments, loyalty and
store credit, Malaysia/Southeast Asia specifics, and a client hand-over.

## Install

**Any agent (Claude Code, Codex, Cursor …), with the skills CLI:**
```bash
npx skills add kennyling-ux/shopify-migration
```

**Claude Code, by hand:**
```bash
git clone https://github.com/kennyling-ux/shopify-migration ~/.claude/skills/shopify-migration
```

**Codex, by hand:**
```bash
git clone https://github.com/kennyling-ux/shopify-migration ~/.codex/skills/shopify-migration
```

Requires **Node.js 22+** for the scripts (no `npm install`).

## Use
Ask your agent, for example:
> Migrate my WooCommerce store to Shopify. My Shopify store is my-shop.myshopify.com.

> I sell on Shopee and want my own Shopify store with the same products.

The skill asks a few intake questions, creates a workspace (`init.mjs`), and walks you through
exports, a dry run, a small live batch, the full import, redirects and go-live.

Try the scripts without a store on the bundled samples:
```bash
node scripts/init.mjs /tmp/try && cd /tmp/try
node <skill>/scripts/inspect.mjs <skill>/scripts/fixtures/shopee-products.csv
node <skill>/scripts/normalize.mjs --platform shopee --entity products --input <skill>/scripts/fixtures/shopee-products.csv
node <skill>/scripts/import-products.mjs --dry-run
```

## Safety
- Every import has `--dry-run` and is re-runnable (matches existing records instead of duplicating).
- Credentials live in the workspace `.env` (git-ignored); the AI is told never to print or ask for them.
- Customer data stays in local files; the AI reads summaries, not rows.
- DNS, payments, removing the password and emailing customers are left to the merchant.

## Contents
```
SKILL.md              the process the agent follows
references/           intake, limits, setup, data format, mapping, platform guides, theme,
                      SEO/redirects, go-live, loyalty, SEA notes, pitfalls, cost control
scripts/              init, check, inspect, normalize, import-*, build-redirects, verify
scripts/fixtures/     sample exports for every platform
templates/            .env, migration plan, mapping example, client hand-over
```

## Contributing
Platform exports change. If a column isn't recognised, add its header to `scripts/lib/presets.mjs`
(and a sample row to `scripts/fixtures/`) and open a pull request.

## Licence
MIT © Kenny Ling
