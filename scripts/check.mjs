#!/usr/bin/env node
// Read-only pre-flight: token works, scopes cover the import scripts, and the store settings
// that change how data lands (currency, timezone, locations, languages, plan).
import { start } from './lib/run.mjs';

const ctx = await start('check');
const { shopify, log, warn } = ctx;
if (!shopify) {
	log('\nNo credentials in .env yet. See references/setup.md → "Get API access".');
	process.exit(1);
}

const d = await shopify.query(`{
	shop { name myshopifyDomain currencyCode ianaTimezone primaryDomain { host } plan { partnerDevelopment shopifyPlus publicDisplayName }
		currencyFormats { moneyFormat moneyWithCurrencyFormat } }
	locations(first: 10) { nodes { name isActive } }
	shopLocales { locale primary published }
	appInstallation { accessScopes { handle } }
}`);
const s = d.shop;
log(`\nStore      ${s.name} (${s.myshopifyDomain}) → ${s.primaryDomain.host}`);
log(`Plan       ${s.plan.publicDisplayName}${s.plan.partnerDevelopment ? ' (development store: ~5 orders/minute via API)' : ''}`);
log(`Currency   ${s.currencyCode}  format ${s.currencyFormats.moneyFormat} / ${s.currencyFormats.moneyWithCurrencyFormat}`);
log(`Timezone   ${s.ianaTimezone}`);
log(`Locations  ${d.locations.nodes.map((l) => l.name + (l.isActive ? '' : ' (inactive)')).join(', ') || 'none'}`);
log(`Languages  ${d.shopLocales.map((l) => `${l.locale}${l.primary ? ' (primary)' : ''}${l.published ? '' : ' (unpublished)'}`).join(', ')}`);

const have = new Set(d.appInstallation.accessScopes.map((x) => x.handle));
const NEED = {
	'import-products': ['write_products', 'write_inventory', 'write_files', 'write_publications'],
	'import-customers': ['write_customers'],
	'import-orders': ['write_orders', 'write_customers'],
	'import-discounts': ['write_discounts'],
	'import-content': ['write_content', 'write_files'],
	'import-redirects': ['write_online_store_navigation'],
};
// A write scope implies its read scope.
const ok = (scope) => have.has(scope) || (scope.startsWith('read_') && have.has(scope.replace('read_', 'write_')));
log('\nScopes');
for (const [script, scopes] of Object.entries(NEED)) {
	const missing = scopes.filter((x) => !ok(x));
	log(`  ${missing.length ? '✗' : '✓'} ${script.padEnd(18)} ${missing.length ? 'missing ' + missing.join(', ') : 'ok'}`);
	if (missing.length) warn(`${script} needs ${missing.join(', ')}: add them to the app's access scopes and reinstall/release it`);
}
if (!ok('read_all_orders')) log('  · read_all_orders not granted: fine, re-runs remember imported orders in logs/ (add it to also see orders older than 60 days)');
if (process.env.CURRENCY && process.env.CURRENCY.toUpperCase() !== s.currencyCode) warn(`CURRENCY in .env is ${process.env.CURRENCY} but the store uses ${s.currencyCode}`);
ctx.finish();
