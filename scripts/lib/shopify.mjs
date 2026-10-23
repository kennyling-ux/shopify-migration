// Minimal Shopify Admin GraphQL client over fetch, with cost-based throttling and retries.
// In a dry run it refuses mutations, so a dry run can read the store but never write to it.

const MAX_ATTEMPTS = 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createClient({ shop, token, version, dryRun, debug = () => {}, log = console.log }) {
	const host = shop.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
	const endpoint = `https://${host}/admin/api/${version}/graphql.json`;
	let available = 2000; // last known bucket level
	let restoreRate = 100;

	async function request(query, variables = {}) {
		if (dryRun && /^\s*mutation\b/.test(query)) {
			throw new Error('Refusing to send a mutation during --dry-run');
		}
		for (let attempt = 1; ; attempt++) {
			if (available < 100) await sleep(Math.ceil(((100 - available) / restoreRate) * 1000));
			let res;
			try {
				res = await fetch(endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
					body: JSON.stringify({ query, variables }),
				});
			} catch (err) {
				if (attempt >= MAX_ATTEMPTS) throw err;
				await sleep(1000 * 2 ** attempt);
				continue;
			}
			if (res.status === 429 || res.status >= 500) {
				if (attempt >= MAX_ATTEMPTS) throw new Error(`HTTP ${res.status} after ${attempt} attempts`);
				const wait = Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt;
				debug(`  … HTTP ${res.status}, retrying in ${wait} ms`);
				await sleep(wait);
				continue;
			}
			if (res.status === 401 || res.status === 403) {
				throw new Error(`HTTP ${res.status}: the token was refused. Check the credentials in .env and the app's access scopes (run check.mjs)`);
			}
			const body = await res.json();
			const t = body.extensions?.cost?.throttleStatus;
			if (t) {
				available = t.currentlyAvailable;
				restoreRate = t.restoreRate || restoreRate;
			}
			const throttled = body.errors?.some((e) => e.extensions?.code === 'THROTTLED');
			if (throttled) {
				if (attempt >= MAX_ATTEMPTS) throw new Error('Throttled too many times');
				const need = body.extensions?.cost?.requestedQueryCost ?? 200;
				const wait = Math.max(1000, Math.ceil(((need - available) / restoreRate) * 1000));
				debug(`  … throttled, waiting ${wait} ms`);
				await sleep(wait);
				continue;
			}
			if (body.errors?.length) {
				const msg = body.errors.map((e) => e.message).join('; ');
				throw new Error(`GraphQL: ${msg}`);
			}
			return body.data;
		}
	}

	return {
		endpoint,
		query: request,
		/** Run a mutation and throw on userErrors. `field` is the payload field name. */
		async mutate(query, variables, field) {
			const data = await request(query, variables);
			const payload = field ? data[field] : Object.values(data)[0];
			const errs = payload?.userErrors ?? [];
			if (errs.length) {
				const e = new Error(errs.map((u) => `${(u.field || []).join('.')}: ${u.message}${u.code ? ` [${u.code}]` : ''}`).join('; '));
				e.userErrors = errs;
				throw e;
			}
			return payload;
		},
		/** Collect every node of a connection. `pick(data)` returns the connection. */
		async all(query, variables, pick) {
			const out = [];
			let after = null;
			do {
				const data = await request(query, { ...variables, after });
				const conn = pick(data);
				out.push(...(conn.nodes ?? conn.edges.map((e) => e.node)));
				after = conn.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
			} while (after);
			return out;
		},
	};
}

/** Common lookups shared by several scripts. */
export async function onlineStorePublicationId(shopify) {
	const d = await shopify.query(`{ publications(first: 25) { nodes { id name } } }`);
	return d.publications.nodes.find((p) => p.name === 'Online Store')?.id ?? null;
}

export async function primaryLocationId(shopify) {
	const d = await shopify.query(`{ locations(first: 5, includeInactive: false) { nodes { id name isActive } } }`);
	return d.locations.nodes[0]?.id ?? null;
}

const customerCache = new Map();
/** Customer by email, cached. Returns { id, email, firstName, lastName, phone, tags, emailMarketingConsent } or null. */
export async function customerByEmail(shopify, email) {
	const key = email.toLowerCase();
	if (customerCache.has(key)) return customerCache.get(key);
	const d = await shopify.query(
		`query($q: String!) { customers(first: 1, query: $q) { nodes { id email firstName lastName phone tags
			emailMarketingConsent { marketingState marketingOptInLevel } } } }`,
		{ q: `email:"${key.replace(/"/g, '')}"` },
	);
	const c = d.customers.nodes.find((n) => n.email?.toLowerCase() === key) ?? null;
	customerCache.set(key, c);
	return c;
}
export function rememberCustomer(email, c) {
	customerCache.set(email.toLowerCase(), c);
}

/** Product by handle → { id, handle, title, variants: [{ id, sku }] } or null. */
export async function productByHandle(shopify, handle) {
	const d = await shopify.query(
		`query($h: String!) { productByIdentifier(identifier: { handle: $h }) { id handle title
			variants(first: 100) { nodes { id sku selectedOptions { name value } } } } }`,
		{ h: handle },
	);
	return d.productByIdentifier;
}

const skuCache = new Map();
/** Variant by exact SKU (case-insensitive) → { id, sku, product: { id, handle } } or null. */
export async function variantBySku(shopify, sku) {
	const key = String(sku).toUpperCase();
	if (skuCache.has(key)) return skuCache.get(key);
	const d = await shopify.query(
		`query($q: String!) { productVariants(first: 5, query: $q) { nodes { id sku product { id handle } } } }`,
		{ q: `sku:"${String(sku).replace(/"/g, '')}"` },
	);
	const hit = d.productVariants.nodes.find((n) => n.sku?.toUpperCase() === key) ?? null;
	skuCache.set(key, hit);
	return hit;
}

const collectionCache = new Map();
/** Manual collection by title: found, or created (unless dry run). Returns its id or null. */
export async function ensureCollection(shopify, title, { dryRun, handle } = {}) {
	if (collectionCache.has(title)) return collectionCache.get(title);
	const d = await shopify.query(`query($q: String!) { collections(first: 10, query: $q) { nodes { id title handle } } }`, {
		q: `title:"${title.replace(/"/g, '')}"`,
	});
	let id = d.collections.nodes.find((c) => c.title.toLowerCase() === title.toLowerCase())?.id ?? null;
	if (!id && !dryRun) {
		const { collection } = await shopify.mutate(
			`mutation($input: CollectionInput!) { collectionCreate(input: $input) { collection { id } userErrors { field message } } }`,
			{ input: { title, ...(handle ? { handle } : {}) } },
			'collectionCreate',
		);
		id = collection.id;
		const pub = await onlineStorePublicationId(shopify);
		if (pub) {
			await shopify.mutate(
				`mutation($id: ID!, $p: [PublicationInput!]!) { publishablePublish(id: $id, input: $p) { userErrors { field message } } }`,
				{ id, p: [{ publicationId: pub }] },
				'publishablePublish',
			);
		}
	}
	collectionCache.set(title, id);
	return id;
}
