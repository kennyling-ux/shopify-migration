#!/usr/bin/env node
// Old site URLs → data/redirects.csv (path,target) for import-redirects.mjs. Read-only.
//
// Old URLs come from the old sitemap (--sitemap, followed recursively) and/or a text file with
// one URL per line (--urls). Each one is matched to the new Shopify URL:
//   1. exact sourceUrl recorded in data/products.json, articles.json, pages.json, collections.json
//   2. the last path segment equals a product / article / page / collection handle
//   3. known platform patterns (/product/x, /product-category/x, /shop, /cart, /my-account …)
// Anything left is written to data/redirects-unmatched.txt for a human (or the AI) to map.
//
//   --sitemap <url>     e.g. https://old.example.com/sitemap.xml (or sitemap_index.xml)
//   --urls <file>       one old URL or path per line
//   --locales <list>    language prefixes that mirror the same paths, e.g. "zh,ms"
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { start, ROOT } from './lib/run.mjs';
import { writeCsv } from './lib/csv.mjs';
import { handleize, pathOf } from './lib/text.mjs';

const ctx = await start('build-redirects', { sitemap: { type: 'string' }, urls: { type: 'string' }, locales: { type: 'string', default: '' } }, { store: false });
const { plan, log, warn, args } = ctx;
const locales = args.locales.split(',').map((s) => s.trim().replace(/^\/|\/$/g, '')).filter(Boolean);

// ---- Collect old URLs ---------------------------------------------------------------
const old = new Set();
async function sitemap(url, depth = 0) {
	if (depth > 3) return;
	let xml;
	try {
		const res = await fetch(url, { headers: { 'User-Agent': 'shopify-migration-skill' } });
		if (!res.ok) return warn(`sitemap ${url} → HTTP ${res.status}`);
		xml = await res.text();
	} catch (e) {
		return warn(`sitemap ${url} → ${e.cause?.code || e.message}`);
	}
	const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/g)].map((m) => m[1].trim());
	if (/<sitemapindex/i.test(xml)) for (const l of locs) await sitemap(l, depth + 1);
	else for (const l of locs) old.add(l);
}
if (args.sitemap) {
	await sitemap(args.sitemap);
	log(`# sitemap: ${old.size} URLs`);
}
if (args.urls) {
	const p = resolve(process.cwd(), args.urls);
	for (const l of readFileSync(p, 'utf8').split(/\r?\n/)) if (l.trim() && !l.startsWith('#')) old.add(l.trim());
}
if (!old.size) {
	log('\nNo old URLs: pass --sitemap <url> and/or --urls <file>.');
	process.exit(1);
}

// ---- What exists on the new store -----------------------------------------------------
const read = (n) => (existsSync(join(ROOT, 'data', n)) ? JSON.parse(readFileSync(join(ROOT, 'data', n), 'utf8')) : []);
const exact = new Map(); // old path → new path
const byHandle = new Map(); // last segment → new path
const add = (rows, base, blogOf) => {
	for (const r of rows) {
		const handle = r.handle || handleize(r.title || '');
		if (!handle) continue;
		const target = typeof base === 'function' ? base(r, handle) : `${base}/${handle}`;
		for (const u of [].concat(r.sourceUrl || [], r.sourceUrls || [])) exact.set(pathOf(u).toLowerCase(), target);
		if (!byHandle.has(handle)) byHandle.set(handle, target);
		if (r.sourceSlug && !byHandle.has(r.sourceSlug)) byHandle.set(r.sourceSlug, target);
	}
};
add(read('products.json'), '/products');
add(read('collections.json'), '/collections');
add(read('pages.json'), '/pages');
add(read('articles.json'), (a, h) => `/blogs/${handleize(a.blog || process.env.DEFAULT_BLOG || 'News')}/${h}`);
for (const p of read('products.json')) for (const c of p.collections || []) if (!byHandle.has(handleize(c))) byHandle.set(handleize(c), `/collections/${handleize(c)}`);

// Common platform paths (WooCommerce, Wix, Squarespace, BigCommerce, Magento …).
const PATTERNS = [
	[/^\/(shop|store|products?|catalog|all-products|shop-all)$/i, '/collections/all'],
	[/^\/(cart|basket|checkout)(\/.*)?$/i, '/cart'],
	[/^\/(my-account|account|customer\/account|login|signin|register)(\/.*)?$/i, '/account'],
	[/^\/(blog|news|journal)$/i, '/blogs/' + handleize(process.env.DEFAULT_BLOG || 'News')],
	[/^\/(contact|contact-us)$/i, '/pages/contact'],
	[/^\/(search)$/i, '/search'],
];

const rows = [];
const unmatched = [];
const seen = new Set();
const push = (path, target) => {
	if (seen.has(path) || path === target) return;
	seen.add(path);
	rows.push({ path, target });
};
for (const u of old) {
	const path = pathOf(u);
	if (path === '/' || /\.(xml|txt|css|js|png|jpe?g|gif|webp|svg|pdf)$/i.test(path)) continue;
	const bare = path.split('?')[0];
	const lc = bare.toLowerCase();
	let target = exact.get(lc);
	if (!target) {
		const seg = decodeURIComponent(lc.split('/').filter(Boolean).pop() || '').replace(/\.(html?|php|aspx?)$/, '');
		target = byHandle.get(seg) || byHandle.get(handleize(seg));
	}
	if (!target) target = PATTERNS.find(([re]) => re.test(bare))?.[1];
	if (!target) {
		unmatched.push(u);
		continue;
	}
	push(bare, target);
	for (const l of locales) if (!bare.startsWith(`/${l}/`)) push(`/${l}${bare}`, target.startsWith('/account') || target.startsWith('/cart') ? target : `/${l}${target}`);
}
for (const r of rows) plan.create('redirect', `${r.path} → ${r.target}`);
for (const u of unmatched) plan.fail('redirect', pathOf(u), 'no match: map it by hand in data/redirects.csv');

if (!ctx.dryRun) {
	const out = join(ROOT, 'data', 'redirects.csv');
	if (existsSync(out)) {
		// Keep hand-made rows: they win over generated ones.
		const manual = readFileSync(out, 'utf8').split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split(','));
		for (const [path, target] of manual) if (path && target && !rows.some((r) => r.path === path)) rows.push({ path, target });
	}
	writeCsv(out, rows);
	writeFileSync(join(ROOT, 'data', 'redirects-unmatched.txt'), unmatched.join('\n') + (unmatched.length ? '\n' : ''));
	log(`\nWrote ${rows.length} redirects to data/redirects.csv; ${unmatched.length} unmatched in data/redirects-unmatched.txt`);
}
ctx.finish();
