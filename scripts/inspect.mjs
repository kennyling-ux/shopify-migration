#!/usr/bin/env node
// Look at an export without reading it all: detected platform and entity, which standard fields
// each column maps to, which columns are left over, and one sample row. Short output on purpose:
// an AI assistant should read this, not the raw CSV (saves tokens on big exports).
//
//   node inspect.mjs <file.csv> [--platform p] [--entity e] [--map mapping.json]
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readCsv } from './lib/csv.mjs';
import { GENERIC, PLATFORMS, detectEntity, detectPlatform } from './lib/presets.mjs';

const { values: a, positionals } = parseArgs({ allowPositionals: true, options: { platform: { type: 'string' }, entity: { type: 'string' }, map: { type: 'string' }, rows: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
const file = positionals[0] && resolve(process.cwd(), positionals[0]);
if (a.help || !file || !existsSync(file)) {
	console.error('usage: node inspect.mjs <export.csv> [--platform p] [--entity e] [--map mapping.json] [--rows n]');
	process.exit(a.help ? 0 : 1);
}
if (/\.xlsx?$/i.test(file)) {
	console.error('This is an Excel file. Open it in Excel / Google Sheets / Numbers and save as "CSV UTF-8", then inspect the .csv.');
	process.exit(1);
}
if (/\.xml$/i.test(file)) {
	const xml = readFileSync(file, 'utf8');
	const count = (t) => (xml.match(new RegExp(`<wp:post_type><!\\[CDATA\\[${t}\\]\\]></wp:post_type>`, 'g')) || []).length;
	console.log(`WordPress XML (WordPress / WooCommerce / Squarespace export)\n  posts ${count('post')}  pages ${count('page')}  products ${count('product')}  coupons ${count('shop_coupon')}  attachments ${count('attachment')}`);
	console.log(`\nnormalize: --platform wordpress --entity articles|pages|discounts --input ${positionals[0]}`);
	process.exit(0);
}

const rows = readCsv(file);
const headers = Object.keys(rows[0] ?? {});
const platform = a.platform || detectPlatform(headers);
const entity = a.entity || detectEntity(headers) || 'products';
const mapPath = a.map ? resolve(process.cwd(), a.map) : join(process.cwd(), 'mapping.json');
const mapping = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, 'utf8')) : {};
const preset = PLATFORMS[platform] || {};

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9*{}]/g, '');
const used = new Set();
const lines = [];
const fields = new Set([...Object.keys(GENERIC[entity] || {}), ...Object.keys(preset[entity] || {}), ...Object.keys(mapping[entity] || {})]);
for (const field of fields) {
	if (field === 'useTitleForHandle' || field === 'optionNames') continue;
	const aliases = [...[].concat(mapping[entity]?.[field] ?? []), ...(preset[entity]?.[field] ?? []), ...(GENERIC[entity]?.[field] ?? [])];
	const hits = [];
	for (const al of aliases) {
		for (const P of al.includes('{P}') ? ['Billing', 'Shipping'] : ['']) {
			const n = norm(al.replace('{P}', P));
			const re = new RegExp('^' + n.replace(/\*/g, '\\d+') + '$');
			for (const h of headers) if (re.test(norm(h)) && !hits.includes(h)) hits.push(h);
		}
	}
	hits.forEach((h) => used.add(h));
	lines.push(`  ${field.padEnd(18)} ${hits.length ? hits.slice(0, 4).join(' | ') + (hits.length > 4 ? ` (+${hits.length - 4})` : '') : '—'}`);
}
const unmapped = headers.filter((h) => !used.has(h));
const filled = (h) => rows.some((r) => String(r[h] ?? '').trim());

console.log(`${file}\n  ${rows.length} rows, ${headers.length} columns`);
console.log(`  platform: ${platform}${a.platform ? '' : ' (detected)'}  ${preset.label ? '· ' + preset.label : ''}`);
console.log(`  entity:   ${entity}${a.entity ? '' : ' (detected)'}`);
if (preset.noCustomers && entity === 'customers') console.log(`  ! ${preset.noCustomers}`);
console.log(`\nStandard field → column(s) found`);
console.log(lines.join('\n'));
console.log(`\nColumns not used (${unmapped.length}; empty ones hidden): ${unmapped.filter(filled).join(', ') || 'none'}`);
// No sample of people's data by default (keeps personal data out of AI context).
const sampleRows = a.rows !== undefined ? Number(a.rows) : ['customers', 'orders'].includes(entity) ? 0 : 1;
for (let i = 0; i < Math.min(sampleRows, rows.length); i++) {
	const sample = Object.fromEntries(Object.entries(rows[i]).filter(([, v]) => String(v).trim()).map(([k, v]) => [k, String(v).length > 60 ? String(v).slice(0, 57) + '…' : v]));
	console.log(`\nSample row ${i + 1}: ${JSON.stringify(sample)}`);
}
console.log(`\nNext: put missing mappings in mapping.json as { "${entity}": { "<field>": ["<Column header>"] } }, then\n  node normalize.mjs --platform ${platform} --entity ${entity} --input ${positionals[0]} --dry-run`);
