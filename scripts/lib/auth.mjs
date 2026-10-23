// Admin API token: ADMIN_TOKEN as-is, or one obtained through Shopify's client credentials grant
// from the Dev Dashboard app's CLIENT_ID and CLIENT_SECRET. The token is kept in memory only
// (it lasts ~24 h, far longer than any run) and is never logged.

let cached = null;

export async function adminToken({ shop, adminToken, clientId, clientSecret }) {
	if (adminToken) return { token: adminToken, source: 'ADMIN_TOKEN' };
	if (!clientId || !clientSecret) return null;
	if (cached && cached.expiresAt > Date.now() + 60_000) return { token: cached.token, source: 'client credentials' };

	const host = shop.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
	let res;
	try {
		res = await fetch(`https://${host}/admin/oauth/access_token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
			body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
		});
	} catch (e) {
		throw new Error(`could not reach ${host} for a token (${e.cause?.code || e.message}). Check SHOP in .env.`);
	}
	const text = await res.text();
	let body = {};
	try {
		body = JSON.parse(text);
	} catch {
		// HTML error page or empty body
	}
	if (!res.ok || !body.access_token) {
		const detail = [body.error, body.error_description].filter(Boolean).join(': ') || `HTTP ${res.status}`;
		throw new Error(`token request to ${host} failed (${detail}).\n${explain(res.status, detail)}`);
	}
	cached = { token: body.access_token, expiresAt: Date.now() + (Number(body.expires_in) || 86399) * 1000 };
	return { token: cached.token, source: 'client credentials', scope: body.scope ?? '' };
}

function explain(status, detail) {
	const d = detail.toLowerCase();
	if (d.includes('shop_not_permitted')) {
		return '  The app and the store are not in the same Shopify organization, so the client credentials grant is refused.\n  Check the store appears under the app\'s organization in the Dev Dashboard, and that SHOP is its exact myshopify domain.';
	}
	if (status === 401 || d.includes('invalid_client') || d.includes('secret')) {
		return '  CLIENT_ID or CLIENT_SECRET is wrong. Copy both again from Dev Dashboard → your app → Settings (re-copy the secret if it was rotated).';
	}
	if (status === 404 || d.includes('not installed') || d.includes('installation')) {
		return '  The app is not installed on this store. Install the app on the store from the Dev Dashboard, then run again.';
	}
	return [
		'  Usual causes:',
		'  - wrong CLIENT_SECRET (or CLIENT_ID): copy them again from Dev Dashboard → your app → Settings;',
		'  - the app is not installed on this store;',
		'  - the app and the store are not in the same Shopify organization (error shop_not_permitted).',
	].join('\n');
}
