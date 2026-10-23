#!/usr/bin/env node
// Read-only checks after an import or after go-live.
//   counts       data/*.json vs what the store holds (products by handle, customers by tag,
//                orders by tag, discounts by code)
//   --site <url> every data/redirects.csv path on the live domain must 301 to its target, and
//                every product URL must load (200)
//   --old-urls <file>  also check a list of old URLs (one per line) does not end in a 404
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { start, ROOT, env } from './lib/run.mjs';
import { readCsv } from './lib/csv.mjs';
import { pathOf } from './lib/text.mjs';

const ctx = await start('verify', { site: { type: 'string' }, 'old-urls': { type: 'string' } }, { store: false });
const { shopify, plan, log, warn, args } = ctx;
const read = (n) => (existsSync(join(ROOT, 'data', n)) ? JSON.parse(readFileSync(join(ROOT, 'data', n), 'utf8')) : null);
const TAG = env('MIGRATION_TAG', 'migrated');

if (shopify) {
	const count = async (q) => (await shopify.query(q)).c.count;
	const products = read('products.json');
	if (products) {
		const n = await count(`{ c: productsCount(limit: null) { count } }`);
		log(`products   source ${products.length}   store ${n}`);
		if (n < products.length) warn(`${products.length - n} products from products.json are not in the store (re-run import-products and read its ✗ lines)`);
	}
	const customers = read('customers.json');
	if (customers) {
		const n = await count(`{ c: customersCount(query: "tag:${TAG}", limit: null) { count } }`);
		const withEmail = customers.filter((c) => /@/.test(c.email || '')).length;
		log(`customers  source ${withEmail} with email   store ${n} tagged ${TAG}`);
	}
	const orders = read('orders.json');
	if (orders) {
		const n = await count(`{ c: ordersCount(query: "tag:${TAG}", limit: null) { count } }`);
		log(`orders     source ${orders.length}   store ${n} tagged ${TAG} (filtered statuses are not imported)`);
	}
	const discounts = read('discounts.json');
	if (discounts) {
		let found = 0;
		for (const d of discounts) if ((await shopify.query(`query($c: String!) { codeDiscountNodeByCode(code: $c) { id } }`, { c: d.code })).codeDiscountNodeByCode) found++;
		log(`discounts  source ${discounts.length}   store ${found} (expired / used-up codes are skipped on import)`);
	}
}

async function probe(url) {
	try {
		const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'shopify-migration-skill' } });
		return { status: res.status, location: res.headers.get('location') };
	} catch (e) {
		return { status: e.cause?.code || 'error', location: null };
	}
}

if (args.site) {
	const site = args.site.replace(/\/$/, '');
	const redirects = existsSync(join(ROOT, 'data', 'redirects.csv')) ? readCsv(join(ROOT, 'data', 'redirects.csv')) : [];
	log(`\n# checking ${redirects.length} redirects on ${site}`);
	for (const r of redirects) {
		const { status, location } = await probe(site + r.path);
		const lands = location ? pathOf(new URL(location, site).href) : null;
		if ([301, 302].includes(status) && lands === pathOf(r.target)) plan.skip('redirect', r.path, `→ ${lands}`);
		else plan.fail('redirect', r.path, `HTTP ${status}${location ? ' → ' + location : ''} (expected → ${r.target})`);
	}
	const products = read('products.json') || [];
	for (const p of products.slice(0, ctx.limit)) {
		if (!p.handle || p.status === 'DRAFT') continue;
		const { status } = await probe(`${site}/products/${p.handle}`);
		if (status === 200) plan.skip('product page', p.handle, '200');
		else plan.fail('product page', p.handle, `HTTP ${status}`);
	}
}

if (args['old-urls']) {
	const site = args.site?.replace(/\/$/, '');
	const urls = readFileSync(resolve(process.cwd(), args['old-urls']), 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
	for (const u of urls) {
		const url = site ? site + pathOf(u) : u;
		const { status, location } = await probe(url);
		if (status === 404) plan.fail('old url', pathOf(u), '404: add a redirect');
		else plan.skip('old url', pathOf(u), `HTTP ${status}${location ? ' → ' + location : ''}`);
	}
}
ctx.finish();
