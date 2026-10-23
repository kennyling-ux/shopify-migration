#!/usr/bin/env node
// data/redirects.csv (path,target) → Shopify URL redirects. Shopify redirects have no
// wildcards and keep query strings, so every old path is listed. Matches by path; safe to re-run.
import { start, dataFile } from './lib/run.mjs';
import { readCsv, picker } from './lib/csv.mjs';
import { pathOf } from './lib/text.mjs';

const ctx = await start('import-redirects');
const { shopify, plan, log, warn, dryRun } = ctx;
const file = dataFile(ctx, 'redirects.csv');
const rows = readCsv(file);
log(`# source: ${file} (${rows.length} rows)\n`);

const wanted = new Map();
for (const row of rows.slice(0, ctx.limit)) {
	const v = picker(row);
	const path = pathOf(v('path', 'Redirect from', 'from', 'old', 'source'));
	let target = v('target', 'Redirect to', 'to', 'new', 'destination');
	if (!target) continue;
	if (!/^https?:\/\//i.test(target)) target = pathOf(target);
	if (path === '/' || path === target) continue;
	if (wanted.has(path) && wanted.get(path) !== target) warn(`${path} maps to both ${wanted.get(path)} and ${target}; keeping the first`);
	if (!wanted.has(path)) wanted.set(path, target);
}

const existing = new Map();
if (shopify) {
	const all = await shopify.all(`query($after: String) { urlRedirects(first: 250, after: $after) { nodes { id path target } pageInfo { hasNextPage endCursor } } }`, {}, (d) => d.urlRedirects);
	for (const r of all) existing.set(pathOf(r.path), r);
}

for (const [path, target] of wanted) {
	const have = existing.get(path);
	if (have?.target === target) {
		plan.skip('redirect', path, `→ ${target}`);
		continue;
	}
	if (have) plan.update('redirect', path, { target: [have.target, target] });
	else plan.create('redirect', `${path} → ${target}`);
	if (dryRun) continue;
	try {
		if (have) {
			await shopify.mutate(`mutation($id: ID!, $r: UrlRedirectInput!) { urlRedirectUpdate(id: $id, urlRedirect: $r) { urlRedirect { id } userErrors { field message code } } }`, { id: have.id, r: { path, target } }, 'urlRedirectUpdate');
		} else {
			await shopify.mutate(`mutation($r: UrlRedirectInput!) { urlRedirectCreate(urlRedirect: $r) { urlRedirect { id } userErrors { field message code } } }`, { r: { path, target } }, 'urlRedirectCreate');
		}
	} catch (e) {
		plan.fail('redirect', path, e.message);
	}
}

ctx.finish();
