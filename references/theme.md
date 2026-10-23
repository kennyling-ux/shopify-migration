# Theme and design

## Pick the approach (ask budget and deadline)
| Approach | Time | Cost | When |
|---|---|---|---|
| Free Shopify theme (Horizon family, Dawn …) + brand colours, fonts, logo, photos | 0.5–2 days | free | Most small stores. Fastest launch; upgrade later. |
| Paid theme from the Theme Store | 1–3 days | one-off fee | Needs a specific layout (big catalogues, editorial, mega menu). |
| Port an existing or custom design as a theme | 1–3 weeks | dev time | Brand-led stores where the design is the product. |

Recommend the cheapest that meets the brief. A migration is not the moment for a redesign unless
the user wants one; launch on a good theme, redesign after.

## Porting a design: how to keep it fast
- Online Store 2.0 structure: `layout/theme.liquid`, `sections/*.liquid` with `{% schema %}`,
  `snippets/`, `templates/*.json`, `config/settings_schema.json`, `locales/*.json`.
- Make every text and image a section setting so the merchant can edit in the theme editor.
- One CSS file with design tokens (colours, spacing, type scale) as CSS variables; one small JS
  file. No build step needed.
- Develop with `shopify theme dev` on an unpublished theme; `shopify theme push --unpublished`
  for previews; publish only at go-live.
- Check pages on mobile width (375 px) and in the theme editor before showing the client.

## Liquid pitfalls that cost hours
- Liquid has no array `push`. Build lists by joining strings and `split`, or loop over handles.
- Numbers from settings and metafields can arrive as strings: compare after `| plus: 0`.
- Query strings (`?ref=…`, UTM tags) are not readable in Liquid: handle them in JavaScript.
- Section settings referencing a blog/collection are objects already (`section.settings.blog`),
  not handles to look up again.
- Metafield namespaces must be at least 3 characters (`so` fails, `so2` works).
- Theme text translations (Translate & Adapt / translations API) attach to the **published**
  theme; translate after publishing, or re-run translations after switching themes.
- Images: use `image_url: width:` with `image_tag` and `srcset`. Never hotlink the old site.
- Hover effects that re-render content (tabs, carousels) feel jittery: switch the highlight
  instantly, update heavy content after a short delay (~150 ms), no fade on every change.
- Fixed sizes for thumbnails (`flex: 0 0 72px; width: 72px; height: 72px`), and `min-width: 0` on
  flex children, prevent overflow and stretched images on product pages.
- Set a favicon (theme settings) and a social sharing image (Online Store → Preferences);
  both are often forgotten until the client notices.

## Checkout and customer accounts
Checkout and customer account pages are styled in **Settings → Checkout → Customize** and the
accounts editor (logo, colours, fonts, corner radius), not in the theme code. Soft borders and
the brand accent look better than heavy outlines. Custom blocks on these pages need app
extensions (checkout UI / customer account UI extensions).
