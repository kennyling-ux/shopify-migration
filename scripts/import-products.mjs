#!/usr/bin/env node
// data/products.json → Shopify products (productSet), with options, variants, images, stock,
// manual collections and SEO. Matches by handle, so it can be re-run: existing products are
// skipped unless --update.
//
//   --update         overwrite existing products (title, description, prices, variants …)
//   --images         with --update, replace images too (otherwise existing media is kept)
//   --stock          with --update, also set stock (always set on create)
//   --status <s>     force ACTIVE | DRAFT for every product (e.g. DRAFT for a first pass)
//   --no-publish     do not publish new products to the Online Store
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { start, readData, changes, ROOT } from './lib/run.mjs';
import { productByHandle, ensureCollection, onlineStorePublicationId, primaryLocationId } from './lib/shopify.mjs';
import { stageLocalFile } from './lib/upload.mjs';
import { handleize, money } from './lib/text.mjs';

const ctx = await start('import-products', {
	update: { type: 'boolean', default: false },
	images: { type: 'boolean', default: false },
	stock: { type: 'boolean', default: false },
	status: { type: 'string' },
	'no-publish': { type: 'boolean', default: false },
});
const { shopify, plan, log, warn, dryRun, args } = ctx;
const products = readData(ctx, 'products.json');

const locationId = shopify ? await primaryLocationId(shopify) : null;
const publicationId = shopify && !args['no-publish'] ? await onlineStorePublicationId(shopify) : null;
if (shopify && !locationId) warn('no active location: stock levels are not set');

const seen = new Set();
for (const p of products) {
	const handle = p.handle || handleize(p.title);
	if (!p.title) {
		plan.fail('product', handle || '(no title)', 'no title');
		continue;
	}
	if (seen.has(handle)) {
		plan.fail('product', handle, 'duplicate handle in products.json; give one a different handle');
		continue;
	}
	seen.add(handle);

	const variants = (p.variants?.length ? p.variants : [{}]).map((v) => ({ ...v, price: money(v.price ?? p.price) || '0.00', compareAtPrice: money(v.compareAtPrice ?? p.compareAtPrice) || null }));
	let optionNames = (p.options || []).filter(Boolean).slice(0, 3);
	if ((p.options || []).length > 3) warn(`${handle}: Shopify allows 3 options; only ${optionNames.join(', ')} kept`);
	if (!optionNames.length || variants.length === 1 && !variants[0].options?.length) optionNames = [];
	if (variants.length > 1 && !optionNames.length) {
		plan.fail('product', handle, `${variants.length} variants but no option names; set "options" and each variant's "options"`);
		continue;
	}
	const combos = new Set();
	let bad = false;
	for (const v of variants) {
		const key = (v.options || []).slice(0, optionNames.length).join(' / ');
		if (optionNames.length && (v.options || []).length < optionNames.length) bad = `variant ${v.sku || key || '?'} is missing option values`;
		if (combos.has(key)) bad = `two variants share the options "${key || 'Default'}"`;
		combos.add(key);
	}
	if (bad) {
		plan.fail('product', handle, bad);
		continue;
	}

	const have = shopify ? await productByHandle(shopify, handle) : null;
	const status = (args.status || p.status || 'ACTIVE').toUpperCase();
	const view = {
		title: p.title,
		status,
		variants: variants.length,
		price: [...new Set(variants.map((v) => v.price))].join(' / '),
		options: optionNames.join(', ') || null,
		images: (p.images || []).length,
		collections: (p.collections || []).join(', ') || null,
	};
	if (have && !args.update) {
		plan.skip('product', handle, 'exists (use --update to overwrite)');
		continue;
	}
	if (have) plan.update('product', handle, changes({ title: have.title, variants: have.variants.nodes.length }, { title: p.title, variants: variants.length }));
	else plan.create('product', handle, view);
	if (dryRun) continue;

	try {
		const collectionIds = [];
		for (const title of p.collections || []) {
			const id = await ensureCollection(shopify, title, { dryRun });
			if (id) collectionIds.push(id);
		}
		const existingBySku = new Map((have?.variants.nodes || []).filter((x) => x.sku).map((x) => [x.sku.toUpperCase(), x.id]));
		const existingByCombo = new Map((have?.variants.nodes || []).map((x) => [x.selectedOptions.map((o) => o.value).join(' / '), x.id]));
		const setStock = locationId && (!have || args.stock);

		const optionValues = optionNames.map((name, i) => ({ name, values: [...new Set(variants.map((v) => v.options[i]))].map((value) => ({ name: value })) }));
		const input = {
			title: p.title,
			handle,
			descriptionHtml: p.descriptionHtml || '',
			status,
			vendor: p.vendor || null,
			productType: p.productType || null,
			tags: p.tags || [],
			...(p.seo?.title || p.seo?.description ? { seo: { title: p.seo.title || null, description: p.seo.description || null } } : {}),
			collections: collectionIds,
			...(p.metafields?.length ? { metafields: p.metafields } : {}),
			productOptions: optionNames.length ? optionValues : [{ name: 'Title', values: [{ name: 'Default Title' }] }],
			variants: variants.map((v) => {
				const combo = optionNames.length ? v.options.slice(0, optionNames.length) : ['Default Title'];
				const id = (v.sku && existingBySku.get(v.sku.toUpperCase())) || existingByCombo.get(combo.join(' / '));
				const stock = Number.isFinite(Number(v.inventory)) && v.inventory !== null && v.inventory !== '' ? Math.trunc(Number(v.inventory)) : null;
				return {
					...(id ? { id } : {}),
					optionValues: optionNames.length ? optionNames.map((name, i) => ({ optionName: name, name: v.options[i] })) : [{ optionName: 'Title', name: 'Default Title' }],
					...(v.sku ? { sku: v.sku } : {}),
					...(v.barcode ? { barcode: v.barcode } : {}),
					price: v.price,
					compareAtPrice: v.compareAtPrice && Number(v.compareAtPrice) > Number(v.price) ? v.compareAtPrice : null,
					taxable: v.taxable ?? true,
					inventoryPolicy: v.continueSelling ? 'CONTINUE' : 'DENY',
					inventoryItem: {
						tracked: v.tracked ?? stock !== null,
						requiresShipping: v.requiresShipping ?? true,
						...(Number(v.weight) ? { measurement: { weight: { value: Number(v.weight), unit: (v.weightUnit || 'KILOGRAMS').toUpperCase() } } } : {}),
					},
					...(setStock && stock !== null ? { inventoryQuantities: [{ locationId, name: 'available', quantity: stock }] } : {}),
				};
			}),
		};
		if (!have || args.images) {
			const files = [];
			for (const img of p.images || []) {
				const src = typeof img === 'string' ? img : img.src;
				const alt = (typeof img === 'object' && img.alt) || p.title;
				if (!src) continue;
				if (/^https?:\/\//i.test(src)) files.push({ originalSource: src, alt, contentType: 'IMAGE' });
				else {
					const path = resolve(ROOT, src);
					if (!existsSync(path)) {
						warn(`${handle}: image ${src} not found; skipped`);
						continue;
					}
					files.push({ originalSource: await stageLocalFile(shopify, path), alt, contentType: 'IMAGE' });
				}
			}
			if (files.length) input.files = files;
		}

		const { product } = await shopify.mutate(
			`mutation($input: ProductSetInput!, $id: ProductSetIdentifiers) { productSet(input: $input, identifier: $id, synchronous: true) {
				product { id handle } userErrors { field message code } } }`,
			{ input, id: { handle } },
			'productSet',
		);
		if (!have && publicationId && status === 'ACTIVE') {
			await shopify.mutate(
				`mutation($id: ID!, $p: [PublicationInput!]!) { publishablePublish(id: $id, input: $p) { userErrors { field message } } }`,
				{ id: product.id, p: [{ publicationId }] },
				'publishablePublish',
			);
		}
		log(`  ✓ ${handle} ${product.id}`);
	} catch (e) {
		plan.fail('product', handle, e.message);
	}
}

ctx.finish();
