#!/usr/bin/env node
// data/discounts.json → Shopify discount codes (percentage, fixed amount, fixed per item, free
// shipping), with minimum subtotal, dates, usage limits, customer and product restrictions.
// Matches by code, so it can be re-run. Expired and used-up codes are skipped by default.
//
//   --include-expired   also create codes whose end date has passed
import { start, readData } from './lib/run.mjs';
import { customerByEmail, productByHandle } from './lib/shopify.mjs';
import { money, toIso } from './lib/text.mjs';

const ctx = await start('import-discounts', { 'include-expired': { type: 'boolean', default: false } });
const { shopify, plan, log, warn, dryRun, args } = ctx;
const rows = readData(ctx, 'discounts.json');
const now = Date.now();

for (const d of rows) {
	const code = String(d.code || '').trim();
	if (!code) {
		plan.fail('discount', '(no code)', 'no code');
		continue;
	}
	const type = String(d.type || 'fixed_amount').toLowerCase();
	const endsAt = toIso(d.endsAt);
	if (endsAt && Date.parse(endsAt) < now && !args['include-expired']) {
		plan.skip('discount', code, `expired ${endsAt.slice(0, 10)}`);
		continue;
	}
	const remaining = d.usageLimit ? Number(d.usageLimit) - Number(d.usedCount || 0) : null;
	if (remaining !== null && remaining <= 0) {
		plan.skip('discount', code, 'fully used');
		continue;
	}
	if (shopify) {
		const hit = await shopify.query(`query($c: String!) { codeDiscountNodeByCode(code: $c) { id } }`, { c: code });
		if (hit.codeDiscountNodeByCode) {
			plan.skip('discount', code, 'exists');
			continue;
		}
	}

	// Restrictions must resolve fully, or the code would silently apply to everyone/everything.
	let customerIds = [];
	if (d.customerEmails?.length && shopify) {
		const found = [];
		for (const e of d.customerEmails) {
			const c = await customerByEmail(shopify, e);
			if (c) found.push(c.id);
		}
		if (!found.length) {
			plan.fail('discount', code, `restricted to ${d.customerEmails.join(', ')} but none are Shopify customers yet; import customers first`);
			continue;
		}
		if (found.length < d.customerEmails.length) warn(`${code}: ${d.customerEmails.length - found.length} of its customers are not in Shopify; restricted to the ${found.length} found`);
		customerIds = found;
	}
	let productIds = [];
	if (d.productHandles?.length && shopify) {
		for (const h of d.productHandles) {
			const p = await productByHandle(shopify, h);
			if (p) productIds.push(p.id);
		}
		if (productIds.length < d.productHandles.length) {
			plan.fail('discount', code, `products ${d.productHandles.join(', ')} not all in Shopify; import products first`);
			continue;
		}
	}

	const value = type === 'percentage' ? `${Number(d.value)}%` : type === 'free_shipping' ? 'free shipping' : `${money(d.value)}${type === 'fixed_per_item' ? ' per item' : ''}`;
	plan.create('discount', code, {
		value,
		minimum: d.minimumSubtotal ? money(d.minimumSubtotal) : null,
		ends: endsAt?.slice(0, 10) ?? null,
		uses: remaining,
		'once per customer': d.oncePerCustomer ? 'yes' : null,
		customers: d.customerEmails?.length ? d.customerEmails.length : null,
		products: d.productHandles?.length ? d.productHandles.join(', ') : null,
	});
	if (dryRun) continue;

	const base = {
		title: d.title || code,
		code,
		startsAt: toIso(d.startsAt) || new Date().toISOString(),
		endsAt,
		context: customerIds.length ? { customers: { add: customerIds } } : { all: 'ALL' },
		usageLimit: remaining,
		appliesOncePerCustomer: !!d.oncePerCustomer,
		...(Number(d.minimumSubtotal) ? { minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: money(d.minimumSubtotal) } } } : {}),
		...(d.combinesWith ? { combinesWith: d.combinesWith } : {}),
	};
	try {
		if (type === 'free_shipping') {
			await shopify.mutate(
				`mutation($d: DiscountCodeFreeShippingInput!) { discountCodeFreeShippingCreate(freeShippingCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message code } } }`,
				{ d: { ...base, destination: { all: true } } },
				'discountCodeFreeShippingCreate',
			);
		} else {
			const items = productIds.length ? { products: { productsToAdd: productIds } } : { all: true };
			const v = type === 'percentage' ? { percentage: Math.min(1, Number(d.value) / 100) } : { discountAmount: { amount: money(d.value), appliesOnEachItem: type === 'fixed_per_item' } };
			await shopify.mutate(
				`mutation($d: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message code } } }`,
				{ d: { ...base, customerGets: { value: v, items } } },
				'discountCodeBasicCreate',
			);
		}
		log(`  ✓ ${code}`);
	} catch (e) {
		plan.fail('discount', code, e.message);
	}
}

ctx.finish();
