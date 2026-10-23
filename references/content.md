# Blog posts and pages from platforms without an XML export

`normalize.mjs --entity articles|pages` reads WordPress-format XML (WordPress, WooCommerce,
Squarespace). For others:

- **Few pages (< 15)**: copy them by hand into Shopify pages, rebuilding layout in theme sections.
  Usually faster than automating.
- **Many blog posts**: collect post URLs from the old sitemap, fetch each page (gently, the
  merchant's own site only) and extract title, date, main content HTML, featured image and meta
  description. Write them to `data/articles.json` in the standard format
  (references/data-format.md), then `import-content.mjs --rehost-images`.
- Keep `sourceUrl` on each record so `build-redirects.mjs` maps old post URLs automatically.
- Wix: posts are at `/post/<slug>`; Shopify posts live at `/blogs/<blog>/<slug>`.
- Strip site chrome (menus, footers, share buttons) and inline styles from scraped HTML; keep
  headings, paragraphs, lists, images and links.
