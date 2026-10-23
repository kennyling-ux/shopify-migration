#!/usr/bin/env node
// data/orders.json → historical Shopify orders (orderCreate). No receipts or shipping emails,
// stock untouched. Orders are named #<ORDER_PREFIX><number> (default "#M1001"), tagged with
// MIGRATION_TAG and carry sourceIdentifier <prefix>-<number>, which is how re-runs skip them.
// Lines match products by SKU; unknown SKUs become custom line items.
//
//   --per-minute <n>   orderCreate calls per minute (default 30; trial/dev stores allow ~5)
//   --statuses <list>  financial statuses to import (default PAID,PARTIALLY_REFUNDED,REFUNDED,PENDING)
//   --no-customers     do not create or link customers (guest orders)
import { start, readData, sleep, state, env } from './lib/run.mjs';
import { customerByEmail, rememberCustomer, variantBySku } from './lib/shopify.mjs';
import { isEmail, money, phoneE164, toIso } from './lib/text.mjs';

const ctx = await start('import-orders', {
	'per-minute': { type: 'string', default: '30' },
	statuses: { type: 'string', default: 'PAID,PARTIALLY_REFUNDED,REFUNDED,PENDING' },
	'no-customers': { type: 'boolean', default: false },
});
const { shopify, plan, log, warn, dryRun, args } = ctx;
const orders = readData(ctx, 'orders.json');
const TAG = env('MIGRATION_TAG', 'migrated');
const PREFIX = env('ORDER_PREFIX', 'M');
const CURRENCY = env('CURRENCY', 'USD').toUpperCase();
const perMinute = Math.max(1, Number(args['per-minute']));
const statuses = new Set(args.statuses.toUpperCase().split(',').map((s) => s.trim()));

// Remembered locally too: the Admin API lists orders older than 60 days only with read_all_orders.
const done = state('orders-imported');
if (shopify) {
	const existing = await shopify.all(
		`query($after: String, $q: String) { orders(first: 250, after: $after, query: $q) { nodes { id sourceIdentifier } pageInfo { hasNextPage endCursor } } }`,
		{ q: `tag:${JSON.stringify(TAG)}` },
		(d) => d.orders,
	);
	for (const o of existing) if (o.sourceIdentifier?.startsWith(`${PREFIX}-`)) done.data[o.sourceIdentifier.slice(PREFIX.length + 1)] = o.id;
}

const gap = Math.ceil(60000 / perMinute);
let sent = 0;
for (const o of orders) {
	const number = String(o.number ?? o.sourceId ?? '').replace(/^#/, '');
	const key = `#${PREFIX}${number}`;
	const fin = String(o.financialStatus || 'PAID').toUpperCase();
	if (!number) {
		plan.fail('order', '(no number)', 'order has no number');
		continue;
	}
	if (done.data[number]) {
		plan.skip('order', key, 'already imported');
		continue;
	}
	if (!statuses.has(fin)) {
		plan.skip('order', key, `status ${fin} not imported (see --statuses)`);
		continue;
	}
	const lines = (o.lines || []).filter((l) => Number(l.quantity) > 0 && (l.title || l.sku));
	if (!lines.length) {
		plan.fail('order', key, 'no line items');
		continue;
	}
	const currency = (o.currency || CURRENCY).toUpperCase();
	const subtotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(money(l.price) || 0), 0);
	const ship = Number(money(o.shipping?.amount) || 0);
	const disc = Number(money(o.discount?.amount) || 0);
	const tax = Number(money(o.tax) || 0);
	const expected = subtotal + ship - disc + (o.taxesIncluded ? 0 : tax);
	const total = money(o.total) || expected.toFixed(2);
	if (Math.abs(expected - Number(total)) > 0.05) warn(`${key}: lines + shipping − discount + tax = ${expected.toFixed(2)} but total is ${total} (fees or rounding in the source?)`);
	if (o.email && !isEmail(o.email)) warn(`${key}: "${o.email}" is not an email; imported without a customer`);

	const resolved = [];
	for (const l of lines) {
		const variant = shopify && l.sku ? await variantBySku(shopify, l.sku) : null;
		if (shopify && !variant) warn(`${key}: SKU "${l.sku || '(none)'}" (${l.title}) is not in Shopify; imported as a custom line item`);
		resolved.push({ ...l, variant });
	}

	plan.create('order', key, {
		date: toIso(o.date),
		status: `${fin}${o.fulfillmentStatus ? ' + ' + o.fulfillmentStatus : ''}`,
		email: o.email || null,
		items: lines.map((l) => `${l.quantity}× ${l.sku || l.title} @ ${money(l.price)}`).join(', '),
		shipping: ship ? ship.toFixed(2) : null,
		discount: disc ? `${disc.toFixed(2)}${o.discount?.code ? ` (${o.discount.code})` : ''}` : null,
		tax: tax ? tax.toFixed(2) : null,
		total: `${total} ${currency}`,
	});
	if (dryRun) continue;

	const bag = (amount) => ({ shopMoney: { amount: String(amount), currencyCode: currency } });
	const when = toIso(o.paidAt) || toIso(o.date);
	const transactions = [];
	if (['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(fin)) transactions.push({ kind: 'SALE', status: 'SUCCESS', gateway: o.gateway || 'manual', amountSet: bag(total), processedAt: when });
	if (['PARTIALLY_REFUNDED', 'REFUNDED'].includes(fin)) {
		transactions.push({ kind: 'REFUND', status: 'SUCCESS', gateway: o.gateway || 'manual', amountSet: bag(money(o.refunded) || total), processedAt: toIso(o.closedAt) || when });
	}
	const clean = (a) => (a?.address1 ? Object.fromEntries(Object.entries({ ...a, phone: phoneE164(a.phone) || undefined }).filter(([, x]) => x)) : null);
	const taxRate = tax && subtotal - disc > 0 ? Number((tax / (subtotal - disc)).toFixed(4)) : 0;

	const order = {
		name: key,
		sourceIdentifier: `${PREFIX}-${number}`,
		sourceName: 'migration',
		tags: [...new Set([TAG, ...(o.tags || [])])],
		processedAt: toIso(o.date),
		...(o.closedAt && o.fulfillmentStatus === 'FULFILLED' ? { closedAt: toIso(o.closedAt) } : {}),
		currency,
		financialStatus: fin,
		...(o.fulfillmentStatus === 'FULFILLED' ? { fulfillmentStatus: 'FULFILLED' } : {}),
		note: [o.sourceLabel || `Imported order ${number}`, o.note].filter(Boolean).join('\n'),
		lineItems: resolved.map((l) => ({
			...(l.variant ? { variantId: l.variant.id } : { title: l.title || l.sku, ...(l.sku ? { sku: l.sku } : {}), requiresShipping: true }),
			quantity: Number(l.quantity),
			priceSet: bag(money(l.price) || '0.00'),
			taxable: !!tax,
		})),
		...(ship || o.shipping?.title ? { shippingLines: [{ title: o.shipping?.title || 'Shipping', priceSet: bag(ship.toFixed(2)) }] } : {}),
		...(disc ? { discountCode: { itemFixedDiscountCode: { code: o.discount?.code || 'DISCOUNT', amountSet: bag(disc.toFixed(2)) } } } : {}),
		...(tax ? { taxesIncluded: !!o.taxesIncluded, taxLines: [{ title: o.taxTitle || 'Tax', rate: taxRate, priceSet: bag(tax.toFixed(2)) }] } : {}),
		...(clean(o.billingAddress) ? { billingAddress: clean(o.billingAddress) } : {}),
		...(clean(o.shippingAddress) ? { shippingAddress: clean(o.shippingAddress) } : {}),
		...(transactions.length ? { transactions } : {}),
	};
	if (isEmail(o.email)) {
		order.email = o.email.toLowerCase();
		if (!args['no-customers']) {
			let customer = await customerByEmail(shopify, o.email);
			if (!customer) customer = await createGuest(o);
			if (customer) order.customer = { toAssociate: { id: customer.id } };
		}
	}

	if (sent++) await sleep(gap);
	const created = await createOrder(order, key);
	if (created) {
		done.data[number] = created.id;
		done.save();
		log(`  ✓ ${key} ${created.id}`);
	}
}

async function createOrder(order, key, attempt = 1) {
	try {
		const { order: created } = await shopify.mutate(
			`mutation($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) { orderCreate(order: $order, options: $options) {
				order { id name } userErrors { field message code } } }`,
			{ order, options: { sendReceipt: false, sendFulfillmentReceipt: false, inventoryBehaviour: 'BYPASS' } },
			'orderCreate',
		);
		return created;
	} catch (e) {
		if (/too many|rate|throttl|limit/i.test(e.message) && attempt < 6) {
			warn(`${key}: ${e.message}; waiting 60 s (trial and development stores allow about 5 orders a minute)`);
			await sleep(60000);
			return createOrder(order, key, attempt + 1);
		}
		plan.fail('order', key, e.message);
		return null;
	}
}

async function createGuest(o) {
	try {
		const { customer } = await shopify.mutate(
			`mutation($input: CustomerInput!) { customerCreate(input: $input) { customer { id email } userErrors { field message } } }`,
			{ input: { email: o.email.toLowerCase(), firstName: o.firstName || null, lastName: o.lastName || null, tags: [TAG, `${TAG}-guest`], note: `Created from imported order ${o.number}.` } },
			'customerCreate',
		);
		rememberCustomer(o.email, customer);
		return customer;
	} catch (e) {
		warn(`${o.email}: could not create customer (${e.message}); order imported without one`);
		return null;
	}
}

ctx.finish();
