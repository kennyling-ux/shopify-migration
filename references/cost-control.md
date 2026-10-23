# Cost and speed: how to keep a migration cheap

For an AI assistant, cost = tokens read and written. For the merchant, cost = days and app fees.
A real migration (theme port + custom membership app + full data) took ~7 active hours and most
of the AI cost was re-reading long context. These rules cut that sharply.

## Tokens
- **Summaries, not data.** `inspect.mjs` instead of opening CSVs; `-q` on every script; `grep '^✗'`
  the log instead of reading it. Never paste exports, logs or JSON files into the conversation.
- **Batch tool calls.** Run normalize for all entities in one command; dry-run all importers in
  one command (`for s in …; do node … -q; done`).
- **Edit, don't rewrite.** Small targeted edits to theme files and data, not whole-file rewrites.
- **Decide once.** Record decisions in `MIGRATION-PLAN.md` so a new session (or a teammate) picks
  up without re-deriving them. Start a fresh session per big phase (data, theme, go-live) when
  the conversation gets long.
- **Screenshots are expensive.** Prefer reading page text / HTML for checks; take a screenshot
  only to show the user a visual result.
- **Don't build what an app does.** A $10/month app often beats days of custom code, unless the
  merchant has a clear reason (fees at scale, unique rules, resale).

## Time
- Start long jobs early in the background: image-heavy product imports, order history.
- Products and theme in parallel: the theme can be built against imported products while
  customers and orders import.
- Import order history only if the merchant needs it; for marketplaces, skip it.
- Delta import right before launch instead of freezing the old store for days.

## Merchant costs
- Free theme first; custom design after launch if sales justify it.
- Use native features before apps: store credit, discounts, Flow, customer accounts, Translate &
  Adapt, Search & Discovery.
- Free serverless tiers (Cloudflare Workers, etc.) are enough for small custom apps.
- List every app with its monthly fee in the hand-over so nothing surprises the merchant.
