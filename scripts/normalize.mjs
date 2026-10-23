#!/usr/bin/env node
// Source export → data/<entity>.json in the standard format (references/data-format.md) that
// every import script reads. Works offline; never touches the store.
//
//   --platform <p>   woocommerce | shopee | lazada | tiktok | wix | squarespace | bigcommerce |
//                    magento | shopify | csv | wordpress (WXR .xml: also Squarespace's export)
//   --entity <e>     products | customers | orders | discounts | articles | pages
//   --input <file>   the export (CSV; .xml for wordpress)
//   --map <file>     mapping.json overrides (default ./mapping.json when present)
//   --append         add to an existing data/<entity>.json instead of replacing it
//
// Run inspect.mjs first: it shows which columns map and which do not.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { start, ROOT, env, die } from './lib/run.mjs';
import { readCsv } from './lib/csv.mjs';
import { readWxr, meta1, phpList } from './lib/wxr.mjs';
import { GENERIC, PLATFORMS } from './lib/presets.mjs';
import { handleize, list, money, paragraphs, plain, toIso, truthy } from './lib/text.mjs';

const ctx = await start(
	'normalize',
	{ platform: { type: 'string', default: 'csv' }, entity: { type: 'string' }, input: { type: 'string' }, map: { type: 'string' }, append: { type: 'boolean', default: false } },
	{ store: false },
);
const { plan, log, warn, args } = ctx;
const platform = args.platform.toLowerCase();
const entity = args.entity?.toLowerCase();
if (!entity || !args.input) die(ctx, 'usage: normalize.mjs --platform <p> --entity <e> --input <file> [--map mapping.json]');
const input = resolve(process.cwd(), args.input);
if (!existsSync(input)) die(ctx, `input not found: ${input}`);
const mapPath = args.map ? resolve(process.cwd(), args.map) : join(ROOT, 'mapping.json');
const mapping = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, 'utf8')) : {};
if (existsSync(mapPath)) log(`# mapping: ${mapPath}`);
const preset = PLATFORMS[platform] ?? die(ctx, `unknown platform "${platform}" (${Object.keys(PLATFORMS).join(', ')}, wordpress)`);

// ---- Column access ----------------------------------------------------------------------
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9*{}]/g, '');
function aliasesFor(field, ent = entity) {
	const m = mapping[ent]?.[field];
	return [...(m ? [].concat(m) : []), ...(preset[ent]?.[field] ?? []), ...(GENERIC[ent]?.[field] ?? [])];
}
/** Getter over one row: get(field) → first non-empty alias; all(field) → every value (wildcards). */
function getter(row, ent = entity) {
	const keys = Object.keys(row);
	const byNorm = new Map(keys.map((k) => [norm(k), k]));
	const val = (k) => String(row[k] ?? '').trim();
	const match = (alias) => {
		const n = norm(alias);
		if (!n.includes('*')) return byNorm.has(n) ? [byNorm.get(n)] : [];
		const re = new RegExp('^' + n.replace(/\*/g, '\\d+') + '$');
		return keys.filter((k) => re.test(norm(k))).sort((a, b) => Number(a.match(/\d+/g)?.pop()) - Number(b.match(/\d+/g)?.pop()));
	};
	const get = (field, sub = (a) => a) => {
		for (const a of aliasesFor(field, ent)) for (const k of match(sub(a))) if (val(k)) return val(k);
		return '';
	};
	const all = (field) => {
		const out = [];
		for (const a of aliasesFor(field, ent)) for (const k of match(a)) if (val(k)) out.push(val(k));
		return out;
	};
	return { get, all, raw: row };
}

const rows = /\.xml$/i.test(input) ? null : readCsv(input);
if (rows) log(`# input: ${input} (${rows.length} rows, platform ${platform}, entity ${entity})`);
if (preset.noCustomers && entity === 'customers') warn(preset.noCustomers);

const out = { products, customers, orders, discounts, articles: wxrContent, pages: wxrContent }[entity];
if (!out) die(ctx, `unknown entity "${entity}"`);
if (['articles', 'pages'].includes(entity) && !/\.xml$/i.test(input)) die(ctx, `${entity} come from a WordPress-format XML export (WordPress, WooCommerce, Squarespace). For other platforms see references/content.md.`);
let records = await out();

const dest = join(ROOT, 'data', `${entity}.json`);
mkdirSync(join(ROOT, 'data'), { recursive: true });
if (args.append && existsSync(dest)) records = [...JSON.parse(readFileSync(dest, 'utf8')), ...records];
if (!ctx.dryRun) writeFileSync(dest, JSON.stringify(records, null, 1));
log(`\n${ctx.dryRun ? 'Would write' : 'Wrote'} ${records.length} ${entity} to ${dest}`);
ctx.finish();

// ---- Products -------------------------------------------------------------------------
function statusOf(v) {
	if (!v) return 'ACTIVE';
	if (/^(0|-1|false|no|n|hidden|draft|private|disabled|inactive|offline|2)$/i.test(v)) return 'DRAFT';
	return 'ACTIVE';
}
function imagesOf(g) {
	const urls = [];
	for (const v of g.all('images')) {
		for (let u of v.split(/\s*[,;|]\s*|\s+(?=https?:\/\/)/)) {
			u = u.trim();
			if (!u) continue;
			if (platform === 'wix' && !/^https?:/i.test(u)) u = `https://static.wixstatic.com/media/${u}`;
			if (platform === 'magento' && !/^https?:/i.test(u) && env('MAGENTO_MEDIA_URL')) u = `${env('MAGENTO_MEDIA_URL').replace(/\/$/, '')}/${u.replace(/^\//, '')}`;
			if (/^https?:\/\//i.test(u) || /\.(jpe?g|png|webp|gif)$/i.test(u)) urls.push(u);
		}
	}
	return urls;
}
function rowKind(g) {
	const t = g.get('rowType').toLowerCase();
	const types = preset.rowTypes;
	if (types?.skip?.includes(t)) return 'skip';
	if (types?.variant?.includes(t) || /^(variation|variant|sku)$/.test(t)) return 'variant';
	if (types?.product?.includes(t) || /^(product|simple|variable)$/.test(t)) return 'product';
	return '';
}
/** Option pairs from a combined cell: "Color: Red, Size: M", "[S]Size=M,[RT]Color=Red", "Red / M". */
function parseVariation(text, names) {
	const pairs = [...text.matchAll(/(?:\[[A-Z]+\])?\s*([^=:,|[\]]+?)\s*[=:]\s*([^,|[\]]+)/g)].map((m) => [m[1].trim(), m[2].trim()]);
	if (pairs.length) return pairs;
	const values = text.split(/\s*[,/|]\s*|\s+-\s+/).filter(Boolean);
	return values.map((v, i) => [names[i] || (values.length === 1 ? 'Variant' : `Option ${i + 1}`), v]);
}
function variantOf(g, product, head = g) {
	let price = money(g.get('price')) || money(g.get('regularPrice')) || product.price;
	let compare = money(g.get('compareAtPrice'));
	const sale = money(g.get('salePrice'));
	const onSale = g.raw['On Sale'] === undefined || truthy(g.raw['On Sale']);
	if (sale && onSale && Number(sale) < Number(price || Infinity)) {
		compare = price;
		price = sale;
	}
	if (platform === 'wix') {
		const mode = String(g.raw.discountMode || head.raw.discountMode || '').toUpperCase();
		const d = Number(g.raw.discountValue || head.raw.discountValue || 0);
		if (d && price) {
			compare = price;
			price = (mode === 'PERCENT' ? Number(price) * (1 - d / 100) : Number(price) - d).toFixed(2);
		}
	}
	const invRaw = g.get('inventory');
	const inventory = /^-?\d+(\.\d+)?$/.test(invRaw) ? Math.trunc(Number(invRaw)) : null;
	const weightHeader = Object.keys(g.raw).find((k) => /weight|grams/i.test(k) && g.raw[k] !== '') || '';
	const unit = /\(g\)|grams/i.test(weightHeader) ? 'GRAMS' : /lb/i.test(weightHeader) ? 'POUNDS' : /oz/i.test(weightHeader) ? 'OUNCES' : env('WEIGHT_UNIT', 'KILOGRAMS').toUpperCase();
	const options = [];
	for (let i = 1; i <= 3; i++) {
		const name = g.get(`optionName${i}`) || product.optionNames[i - 1];
		const value = g.get(`optionValue${i}`);
		if (name && value) options.push([name, value]);
	}
	const variation = g.get('variation') || (platform === 'bigcommerce' && rowKind(g) === 'variant' ? g.get('title') : '');
	if (!options.length && variation) options.push(...parseVariation(variation, product.optionNames));
	return {
		sku: g.get('sku'),
		barcode: g.get('barcode') || undefined,
		price: price || product.price || '0.00',
		compareAtPrice: compare || null,
		inventory,
		tracked: inventory !== null,
		weight: Number(g.get('weight')) || undefined,
		weightUnit: Number(g.get('weight')) ? unit : undefined,
		_options: options,
	};
}
async function products() {
	const groups = new Map();
	const byKey = new Map();
	let last = null;
	for (const row of rows) {
		const g = getter(row);
		const kind = rowKind(g);
		if (kind === 'skip') continue;
		let parent = g.get('parent');
		const bare = parent.replace(/^id:/, '');
		const parentGroup = parent ? byKey.get(parent) || byKey.get(bare) || byKey.get(`id:${bare}`) : null;
		// Marketplaces repeat the parent SKU on every row: that is the group, not a parent link.
		if (parent && (!parentGroup || parent === g.get('group'))) parent = '';
		const own = g.get('group') || g.get('id') || g.get('handle') || g.get('title');
		let group = null;
		if (parent) group = parentGroup;
		else if (kind === 'variant' && last) group = last;
		else if (own && groups.has(own) && kind !== 'product') group = groups.get(own);
		else if (!own && last) group = last; // continuation row (Squarespace, BigCommerce)
		if (!group) {
			const key = own || `row-${groups.size + 1}`;
			if (groups.has(key)) {
				group = groups.get(key);
				group.rows.push(g);
			} else {
				group = { key, head: g, rows: [], variantRows: [] };
				groups.set(key, group);
			}
			for (const k of [g.get('id'), g.get('id') && `id:${g.get('id')}`, g.get('sku'), g.get('handle'), g.get('group')]) if (k) byKey.set(k, group);
			last = group;
			continue;
		}
		// Explicit variant rows (row type or parent column) replace the head row as variants;
		// continuation rows (no title: Shopify, Squarespace) add to it.
		if (kind === 'variant' || parent) {
			group.variantRows.push(g);
			group.explicit = true;
		} else group.rows.push(g);
		last = group;
	}

	const result = [];
	for (const grp of groups.values()) {
		const h = grp.head;
		const title = plain(h.get('title'));
		if (!title) {
			plan.fail('product', grp.key, 'no title');
			continue;
		}
		const urlish = h.get('handle') || h.get('url');
		const slug = urlish ? decodeURIComponent(urlish.split('?')[0].replace(/\/$/, '').split('/').pop()) : '';
		const handle = handleize(mapping.products?.useTitleForHandle ? title : slug || title);
		const optionNames = [...(mapping.products?.optionNames ?? [])];
		for (let i = 1; i <= 3; i++) if (h.get(`optionName${i}`) && !optionNames.includes(h.get(`optionName${i}`))) optionNames[i - 1] ??= h.get(`optionName${i}`);
		const product = { price: money(h.get('price')) || money(h.get('regularPrice')), optionNames };
		const variantSources = grp.explicit ? grp.variantRows : [h, ...grp.rows];
		const variants = variantSources.map((g) => variantOf(g, product, h)).filter((v) => !(grp.variantRows.length && v._options.some(([, x]) => /^any\b/i.test(x))));
		// Option names: first seen order across variants (max 3)
		for (const v of variants) for (const [n] of v._options) if (!optionNames.includes(n)) optionNames.push(n);
		const names = optionNames.slice(0, 3);
		for (const v of variants) {
			const m = new Map(v._options);
			v.options = names.map((n) => m.get(n) || '');
			delete v._options;
			if (!v.sku) delete v.sku;
		}
		if (names.length && variants.some((v) => v.options.some((x) => !x))) warn(`${handle}: some variants lack a value for ${names.join(' / ')}; fix in data/products.json or mapping.json`);
		const cats = [...new Set(h.all('categories').flatMap((c) => list(c, /\s*[,;|]\s*/)).map((c) => c.split(platform === 'bigcommerce' ? /[>/]/ : '>').pop().trim()).filter(Boolean))];
		const description = h.get('description') || h.get('shortDescription');
		const p = {
			handle,
			title,
			descriptionHtml: paragraphs(description),
			vendor: h.get('vendor') || env('DEFAULT_VENDOR') || undefined,
			productType: h.get('productType') || undefined,
			tags: [...new Set(h.all('tags').flatMap((t) => list(t)))],
			status: statusOf(h.get('status')),
			collections: cats,
			options: names,
			images: [...new Set([h, ...grp.rows, ...grp.variantRows].flatMap(imagesOf))],
			variants,
			seo: h.get('seoTitle') || h.get('seoDescription') ? { title: h.get('seoTitle') || undefined, description: h.get('seoDescription') || undefined } : undefined,
			sourceId: h.get('id') || undefined,
			sourceUrl: h.get('url') || undefined,
			sourceSlug: slug && slug !== handle ? slug : undefined,
		};
		plan.create('product', handle, { variants: variants.length, options: names.join(', ') || null, images: p.images.length, price: [...new Set(variants.map((v) => v.price))].join(' / ') });
		result.push(JSON.parse(JSON.stringify(p)));
	}
	return result;
}

// ---- Customers ------------------------------------------------------------------------
async function customers() {
	const result = [];
	const consentCol = aliasesFor('acceptsMarketing').some((a) => rows[0] && Object.keys(rows[0]).some((k) => norm(k) === norm(a)));
	for (const row of rows) {
		const g = getter(row);
		let firstName = g.get('firstName');
		let lastName = g.get('lastName');
		if (!firstName && !lastName && g.get('name')) [firstName, ...lastName] = g.get('name').split(/\s+/), (lastName = lastName.join(' '));
		const email = g.get('email').toLowerCase();
		const c = {
			email,
			firstName,
			lastName,
			phone: g.get('phone') || undefined,
			acceptsMarketing: consentCol ? truthy(g.get('acceptsMarketing')) : undefined,
			createdAt: toIso(g.get('createdAt')) || undefined,
			tags: list(g.get('tags')),
			note: g.get('note') || undefined,
			locale: g.get('locale') || undefined,
			addresses: g.get('address1')
				? [{ firstName, lastName, company: g.get('company') || undefined, address1: g.get('address1'), address2: g.get('address2') || undefined, city: g.get('city'), provinceCode: g.get('province') || undefined, zip: g.get('zip') || undefined, countryCode: (g.get('country') || env('DEFAULT_COUNTRY')).slice(0, 2).toUpperCase() || undefined, phone: g.get('phone') || undefined }]
				: [],
			sourceId: g.get('id') || undefined,
		};
		if (!email) plan.fail('customer', `${firstName} ${lastName}`.trim() || c.sourceId || '?', 'no email');
		else plan.tally('customer', 'create');
		result.push(JSON.parse(JSON.stringify(c)));
	}
	log(`# ${result.filter((c) => /@/.test(c.email)).length} customers with an email${consentCol ? '' : ' (no marketing-consent column found: nobody will be subscribed)'}`);
	return result;
}

// ---- Orders ---------------------------------------------------------------------------
function financial(status, payment) {
	const s = `${payment} ${status}`.toLowerCase();
	if (/partial.*refund/.test(s)) return 'PARTIALLY_REFUNDED';
	if (/refund|return/.test(s)) return 'REFUNDED';
	if (/cancel|fail|void|declin|expired/.test(s)) return 'VOIDED';
	if (/pending|on-hold|unpaid|await|to pay|authori/.test(s) && !/paid\b/.test(String(payment).toLowerCase())) return 'PENDING';
	return 'PAID';
}
async function orders() {
	const byNumber = new Map();
	for (const row of rows) {
		const g = getter(row);
		const number = g.get('number').replace(/^#/, '');
		if (!number) continue;
		if (!byNumber.has(number)) {
			const addr = (P) => {
				const s = (f) => g.get(f, (a) => a.replace('{P}', P));
				let first = s('addrFirst');
				let last = s('addrLast');
				if (!first && !last && s('addrName')) [first, ...last] = s('addrName').split(/\s+/), (last = last.join(' '));
				return s('addr1') ? { firstName: first, lastName: last, company: s('addrCompany') || undefined, address1: s('addr1'), address2: s('addr2') || undefined, city: s('addrCity'), provinceCode: s('addrProvince') || undefined, zip: s('addrZip') || undefined, countryCode: (s('addrCountry') || env('DEFAULT_COUNTRY')).slice(0, 2).toUpperCase(), phone: s('addrPhone') || undefined } : undefined;
			};
			const status = g.get('status');
			const ful = `${g.get('fulfillmentStatus')} ${status}`.toLowerCase();
			let firstName = g.get('firstName');
			let lastName = g.get('lastName');
			if (!firstName && g.get('billingName')) [firstName, ...lastName] = g.get('billingName').split(/\s+/), (lastName = lastName.join(' '));
			byNumber.set(number, {
				number,
				date: toIso(g.get('date')),
				paidAt: toIso(g.get('paidAt')) || undefined,
				closedAt: toIso(g.get('closedAt')) || undefined,
				currency: (g.get('currency') || env('CURRENCY')).toUpperCase() || undefined,
				financialStatus: financial(status, g.get('paymentStatus')),
				fulfillmentStatus: /fulfilled|complete|delivered|shipped|received/.test(ful) && !/unfulfilled|not shipped/.test(ful) ? 'FULFILLED' : undefined,
				sourceStatus: [status, g.get('paymentStatus'), g.get('fulfillmentStatus')].filter(Boolean).join(' / ') || undefined,
				email: g.get('email').toLowerCase() || undefined,
				firstName: firstName || undefined,
				lastName: (Array.isArray(lastName) ? lastName.join(' ') : lastName) || undefined,
				phone: g.get('phone') || undefined,
				billingAddress: addr('Billing'),
				shippingAddress: addr('Shipping') || addr('Delivery'),
				shipping: { title: g.get('shippingTitle') || 'Shipping', amount: money(g.get('shipping')) || '0.00' },
				discount: Number(money(g.get('discount'))) ? { code: list(g.get('discountCode'))[0], amount: money(g.get('discount')) } : undefined,
				tax: money(g.get('tax')) || undefined,
				total: money(g.get('total')) || undefined,
				refunded: money(g.get('refunded')) || undefined,
				gateway: g.get('gateway') || undefined,
				note: g.get('note') || undefined,
				sourceLabel: `${PLATFORMS[platform].label.split(' (')[0]} order ${number}`,
				lines: [],
			});
		}
		const o = byNumber.get(number);
		const qty = Number(g.get('lineQty') || 0);
		const title = [g.get('lineTitle'), g.get('lineVariant')].filter(Boolean).join(' - ');
		if (!qty || !title) continue;
		let price = money(g.get('linePrice'));
		if (!price && money(g.get('lineTotal'))) price = (Number(money(g.get('lineTotal'))) / qty).toFixed(2);
		o.lines.push({ sku: g.get('lineSku') || undefined, title, quantity: qty, price: price || '0.00' });
	}
	const result = [...byNumber.values()].map((o) => JSON.parse(JSON.stringify(o)));
	for (const o of result) {
		if (!o.lines.length) plan.fail('order', o.number, 'no line items found (map lineTitle / lineQty in mapping.json)');
		else plan.tally('order', 'create');
	}
	const statuses = {};
	for (const o of result) statuses[`${o.sourceStatus} → ${o.financialStatus}${o.fulfillmentStatus ? '+' + o.fulfillmentStatus : ''}`] = (statuses[`${o.sourceStatus} → ${o.financialStatus}${o.fulfillmentStatus ? '+' + o.fulfillmentStatus : ''}`] || 0) + 1;
	log(`# ${result.length} orders; status mapping (check it):`);
	for (const [k, n] of Object.entries(statuses)) log(`    ${String(n).padStart(5)}  ${k}`);
	if (result.length && !result.some((o) => o.email)) warn('no order has an email: they import as guest orders (normal for marketplaces)');
	return result;
}

// ---- Discounts --------------------------------------------------------------------------
/** An end date without a time means the end of that day. */
function endOfDay(v) {
	return /^\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s*$/.test(String(v ?? '')) ? toIso(`${String(v).trim()} 23:59:59`) : toIso(v);
}
function discountType(t, value) {
	const s = String(t).toLowerCase();
	if (/ship/.test(s)) return 'free_shipping';
	if (/percent|%/.test(s) || /%/.test(value)) return 'percentage';
	if (/product|item/.test(s)) return 'fixed_per_item';
	return 'fixed_amount';
}
async function discounts() {
	if (/\.xml$/i.test(input)) return wxrCoupons();
	return rows.map((row) => {
		const g = getter(row);
		const d = {
			code: g.get('code'),
			type: discountType(g.get('type'), g.get('value')),
			value: String(g.get('value')).replace(/[^0-9.]/g, '') || '0',
			minimumSubtotal: money(g.get('minimumSubtotal')) || undefined,
			startsAt: toIso(g.get('startsAt')) || undefined,
			endsAt: endOfDay(g.get('endsAt')) || undefined,
			usageLimit: Number(g.get('usageLimit')) || undefined,
			usedCount: Number(g.get('usedCount')) || undefined,
			oncePerCustomer: g.get('oncePerCustomer') === '1' || truthy(g.get('oncePerCustomer')) || undefined,
			customerEmails: list(g.get('customerEmails')).filter((e) => e.includes('@')),
		};
		if (!d.code) plan.fail('discount', '(no code)', 'no code');
		else plan.create('discount', d.code, { type: d.type, value: d.value });
		return JSON.parse(JSON.stringify(d));
	});
}

// ---- WordPress XML (WordPress, WooCommerce, Squarespace) --------------------------------
function wxrItems() {
	const items = readWxr(input);
	log(`# input: ${input} (${items.length} items)`);
	return items;
}
async function wxrCoupons() {
	const items = wxrItems().filter((i) => i.type === 'shop_coupon' && i.status === 'publish');
	return items.map((c) => {
		const t = meta1(c, 'discount_type');
		const d = {
			code: c.title,
			title: c.title,
			type: meta1(c, 'free_shipping') === 'yes' && !Number(meta1(c, 'coupon_amount')) ? 'free_shipping' : t === 'percent' ? 'percentage' : t === 'fixed_product' ? 'fixed_per_item' : 'fixed_amount',
			value: meta1(c, 'coupon_amount') || '0',
			minimumSubtotal: money(meta1(c, 'minimum_amount')) || undefined,
			startsAt: toIso(c.dateGmt, { gmt: true }) || undefined,
			endsAt: /^\d{9,11}$/.test(meta1(c, 'date_expires')) ? toIso(meta1(c, 'date_expires')) : endOfDay(meta1(c, 'date_expires') || meta1(c, 'expiry_date')) || undefined,
			usageLimit: Number(meta1(c, 'usage_limit')) || undefined,
			usedCount: Number(meta1(c, 'usage_count')) || undefined,
			oncePerCustomer: Number(meta1(c, 'usage_limit_per_user')) === 1 || undefined,
			customerEmails: phpList(meta1(c, 'customer_email')),
		};
		plan.create('discount', d.code, { type: d.type, value: d.value });
		return JSON.parse(JSON.stringify(d));
	});
}
async function wxrContent() {
	const items = wxrItems();
	const byId = new Map(items.map((i) => [i.id, i]));
	const SYSTEM = new Set(['cart', 'checkout', 'my-account', 'shop', 'wishlist', 'sample-page', 'privacy-policy', 'refund_returns']);
	const type = entity === 'articles' ? 'post' : 'page';
	const result = [];
	for (const p of items.filter((i) => i.type === type && i.status === 'publish')) {
		if (type === 'page' && SYSTEM.has(p.slug)) {
			plan.skip('page', p.slug, 'store system page: Shopify has its own');
			continue;
		}
		const thumb = byId.get(Number(meta1(p, '_thumbnail_id')));
		const body = p.content.replace(/<!--\s*\/?wp:[\s\S]*?-->\n?/g, '').replace(/\[\/?[a-z_]+[^\]]*\]/g, '');
		const seoTitle = meta1(p, '_yoast_wpseo_title') || meta1(p, 'rank_math_title') || meta1(p, '_aioseo_title');
		const seoDesc = meta1(p, '_yoast_wpseo_metadesc') || meta1(p, 'rank_math_description') || meta1(p, '_aioseo_description');
		const r = {
			...(type === 'post' ? { blog: env('DEFAULT_BLOG', 'News') } : {}),
			handle: handleize(p.slug || p.title),
			title: plain(p.title),
			bodyHtml: body.trim(),
			...(type === 'post'
				? {
						summary: p.excerpt || undefined,
						author: p.author || undefined,
						publishedAt: toIso(p.dateGmt, { gmt: true }) || toIso(p.date) || undefined,
						tags: p.terms.filter((t) => ['post_tag', 'category'].includes(t.domain) && t.slug !== 'uncategorized').map((t) => t.name),
						image: thumb?.attachmentUrl || undefined,
					}
				: {}),
			seo: seoTitle || seoDesc ? { title: seoTitle || undefined, description: seoDesc || undefined } : undefined,
			sourceUrl: p.link || undefined,
			sourceSlug: p.slug && handleize(p.slug) !== p.slug ? p.slug : undefined,
		};
		if (/\[[a-z_]+/.test(p.content)) warn(`${r.handle}: had shortcodes (page-builder or plugin content); they were stripped, check the page`);
		plan.create(type === 'post' ? 'article' : 'page', r.handle, { title: r.title });
		result.push(JSON.parse(JSON.stringify(r)));
	}
	return result;
}
