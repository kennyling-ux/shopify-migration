#!/usr/bin/env node
// data/customers.json → Shopify customers. No passwords: customers sign in with an emailed code
// (new customer accounts), so nobody has to "reset" anything. Email marketing consent is set
// only where the source recorded it. Every customer gets the MIGRATION_TAG (default "migrated")
// so apps and flows can tell imported people from new sign-ups. Matches by email; safe to re-run.
//
//   --sync-consent   on re-runs, also subscribe existing customers whose source says yes
import { start, readData, changes, env } from './lib/run.mjs';
import { customerByEmail, rememberCustomer } from './lib/shopify.mjs';
import { isEmail, phoneE164, toIso } from './lib/text.mjs';

const ctx = await start('import-customers', { 'sync-consent': { type: 'boolean', default: false } });
const { shopify, plan, log, warn, dryRun, args } = ctx;
const rows = readData(ctx, 'customers.json');
const TAG = env('MIGRATION_TAG', 'migrated');

if (!rows.some((c) => c.acceptsMarketing !== undefined && c.acceptsMarketing !== null)) {
	warn('no record has acceptsMarketing: everyone is imported as NOT subscribed (correct when the source has no consent data)');
}

const seen = new Map();
for (const c of rows) {
	const email = String(c.email || '').trim().toLowerCase();
	if (!isEmail(email)) {
		plan.fail('customer', email || `(no email: ${[c.firstName, c.lastName].filter(Boolean).join(' ') || c.sourceId || '?'})`, 'no valid email');
		continue;
	}
	if (seen.has(email)) {
		warn(`${email} appears more than once; the first record is used`);
		continue;
	}
	const phone = phoneE164(c.phone);
	if (c.phone && !phone) warn(`${email}: phone "${c.phone}" is not a valid number (set DEFAULT_COUNTRY in .env for local numbers); left out`);
	const addresses = (c.addresses || [])
		.map((a) => ({ ...a, phone: phoneE164(a.phone) || undefined, countryCode: (a.countryCode || env('DEFAULT_COUNTRY')).toUpperCase().slice(0, 2) || undefined }))
		.filter((a) => a.address1 && a.city)
		.map((a) => Object.fromEntries(Object.entries(a).filter(([, x]) => x !== undefined && x !== '')));
	seen.set(email, {
		email,
		firstName: c.firstName || '',
		lastName: c.lastName || '',
		phone,
		consent: c.acceptsMarketing === true || c.acceptsMarketing === 'true',
		consentAt: toIso(c.marketingConsentAt || c.createdAt),
		locale: c.locale || '',
		tags: [...new Set([TAG, ...(c.tags || [])])],
		note: c.note || `Imported${c.sourceId ? ` (source id ${c.sourceId})` : ''}${c.createdAt ? `, customer since ${String(toIso(c.createdAt) || '').slice(0, 10)}` : ''}.`,
		addresses,
		metafields: c.metafields || [],
	});
}

for (const c of seen.values()) {
	const have = shopify ? await customerByEmail(shopify, c.email) : null;
	const consentInput = c.consent ? { marketingState: 'SUBSCRIBED', marketingOptInLevel: 'SINGLE_OPT_IN', ...(c.consentAt ? { consentUpdatedAt: c.consentAt } : {}) } : null;

	if (!have) {
		plan.create('customer', c.email, {
			name: `${c.firstName} ${c.lastName}`.trim() || null,
			phone: c.phone || null,
			marketing: c.consent ? 'SUBSCRIBED' : 'NOT_SUBSCRIBED',
			address: c.addresses[0] ? [c.addresses[0].address1, c.addresses[0].city, c.addresses[0].countryCode].filter(Boolean).join(', ') : null,
			tags: c.tags.join(', '),
		});
		if (dryRun) continue;
		const created = await create({
			email: c.email,
			firstName: c.firstName || null,
			lastName: c.lastName || null,
			phone: c.phone || null,
			tags: c.tags,
			note: c.note,
			...(c.locale ? { locale: c.locale } : {}),
			...(c.addresses.length ? { addresses: c.addresses } : {}),
			...(c.metafields.length ? { metafields: c.metafields } : {}),
			...(consentInput ? { emailMarketingConsent: consentInput } : {}),
		});
		if (created) rememberCustomer(c.email, created);
		continue;
	}

	// Existing: fill in what changed, never blank out what Shopify already has.
	const next = { ...(c.firstName ? { firstName: c.firstName } : {}), ...(c.lastName ? { lastName: c.lastName } : {}), ...(c.phone ? { phone: c.phone } : {}) };
	const diff = changes({ firstName: have.firstName, lastName: have.lastName, phone: have.phone }, next);
	const missingTags = c.tags.filter((t) => !have.tags.includes(t));
	if (missingTags.length) diff.tags = [have.tags.join(', '), [...have.tags, ...missingTags].join(', ')];
	const consentDiffers = c.consent && have.emailMarketingConsent?.marketingState !== 'SUBSCRIBED';
	if (consentDiffers && args['sync-consent']) diff.marketing = [have.emailMarketingConsent?.marketingState, 'SUBSCRIBED'];
	else if (consentDiffers) warn(`${c.email}: source says subscribed, Shopify says ${have.emailMarketingConsent?.marketingState}; left as is (use --sync-consent)`);

	if (!Object.keys(diff).length) {
		plan.skip('customer', c.email);
		continue;
	}
	plan.update('customer', c.email, diff);
	if (dryRun) continue;
	const input = { id: have.id };
	for (const k of ['firstName', 'lastName', 'phone']) if (diff[k]) input[k] = diff[k][1];
	if (diff.tags) input.tags = [...have.tags, ...missingTags];
	if (Object.keys(input).length > 1) await update(input);
	if (diff.marketing) {
		await shopify
			.mutate(
				`mutation($input: CustomerEmailMarketingConsentUpdateInput!) { customerEmailMarketingConsentUpdate(input: $input) { customer { id } userErrors { field message } } }`,
				{ input: { customerId: have.id, emailMarketingConsent: consentInput } },
				'customerEmailMarketingConsentUpdate',
			)
			.catch((e) => plan.fail('customer', c.email, e.message));
	}
}

async function create(input) {
	try {
		const { customer } = await shopify.mutate(
			`mutation($input: CustomerInput!) { customerCreate(input: $input) { customer { id email firstName lastName phone tags emailMarketingConsent { marketingState } } userErrors { field message } } }`,
			{ input },
			'customerCreate',
		);
		log(`  ✓ ${input.email} ${customer.id}`);
		return customer;
	} catch (e) {
		// A phone number can belong to one customer only: keep the customer, drop the phone.
		if (input.phone && /phone/i.test(e.message)) {
			warn(`${input.email}: ${e.message}; created without phone`);
			const { phone, ...rest } = input;
			if (rest.addresses) rest.addresses = rest.addresses.map(({ phone: _, ...a }) => a);
			return create(rest);
		}
		plan.fail('customer', input.email, e.message);
		return null;
	}
}

async function update(input) {
	try {
		await shopify.mutate(`mutation($input: CustomerInput!) { customerUpdate(input: $input) { customer { id } userErrors { field message } } }`, { input }, 'customerUpdate');
	} catch (e) {
		if (input.phone && /phone/i.test(e.message)) {
			warn(`${input.id}: ${e.message}; phone not changed`);
			const { phone, ...rest } = input;
			if (Object.keys(rest).length > 1) return update(rest);
			return;
		}
		plan.fail('customer', input.id, e.message);
	}
}

ctx.finish();
