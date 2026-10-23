// Shared harness for every script: flags, .env, log file, Shopify client and the dry-run plan.
// Scripts run from a migration workspace (the folder made by init.mjs): .env, data/, exports/ and
// logs/ live there, never inside the skill, so one install serves many stores.
import { existsSync, mkdirSync, appendFileSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createClient } from './shopify.mjs';
import { adminToken } from './auth.mjs';

export const SKILL_SCRIPTS = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const API_VERSION_DEFAULT = '2026-10';
/** The migration workspace: --workspace, else MIGRATION_WORKSPACE, else the current folder. */
export let ROOT = process.cwd();

/**
 * Start a script. `options` are extra util.parseArgs options.
 * `store: false` for scripts that only read files (normalize, build-redirects): no credentials needed.
 * Returns ctx: { name, dryRun, args, log, warn, shopify (null when offline), plan, finish() }.
 */
export async function start(name, options = {}, { store = true } = {}) {
	const spec = {
		'dry-run': { type: 'boolean', default: false },
		file: { type: 'string' },
		workspace: { type: 'string' },
		limit: { type: 'string' },
		verbose: { type: 'boolean', short: 'v', default: false },
		quiet: { type: 'boolean', short: 'q', default: false },
		help: { type: 'boolean', short: 'h', default: false },
		...options,
	};
	let args;
	try {
		({ values: args } = parseArgs({ options: spec, allowPositionals: false }));
	} catch (e) {
		console.error(`${name}: ${e.message}`);
		args = { help: true, bad: true };
	}
	if (args.help) {
		console.log(`usage: node ${name}.mjs [--dry-run] ${Object.entries(spec).filter(([k]) => !['dry-run', 'help'].includes(k)).map(([k, o]) => `[--${k}${o.type === 'string' ? ' <value>' : ''}]`).join(' ')}\nRun from the migration workspace (see the skill's references/scripts.md).`);
		process.exit(args.bad ? 1 : 0);
	}
	const dryRun = args['dry-run'];
	ROOT = resolve(args.workspace || process.env.MIGRATION_WORKSPACE || process.cwd());

	if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));
	const env = (k) => (process.env[k] || '').trim();
	const SHOP = env('SHOP');
	const API_VERSION = env('API_VERSION') || API_VERSION_DEFAULT;
	const haveCredentials = !!(env('ADMIN_TOKEN') || (env('CLIENT_ID') && env('CLIENT_SECRET')));

	mkdirSync(join(ROOT, 'logs'), { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const logFile = join(ROOT, 'logs', `${name}${dryRun ? '.dry-run' : ''}-${stamp}.log`);
	writeFileSync(logFile, '');

	const write = (line) => appendFileSync(logFile, line + '\n');
	const log = (...parts) => {
		const line = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
		console.log(line);
		write(line);
	};
	const debug = (...parts) => {
		const line = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
		if (args.verbose) console.log(line);
		write(line);
	};
	const warnings = [];
	const warn = (msg) => {
		warnings.push(msg);
		log(`  ! ${msg}`);
	};

	let shopify = null;
	let auth = null;
	if (SHOP && haveCredentials) {
		try {
			auth = await adminToken({ shop: SHOP, adminToken: env('ADMIN_TOKEN'), clientId: env('CLIENT_ID'), clientSecret: env('CLIENT_SECRET') });
		} catch (e) {
			console.error(`${name}: ${e.message}`);
			process.exit(1);
		}
		shopify = createClient({ shop: SHOP, token: auth.token, version: API_VERSION, dryRun, debug, log });
	} else if (!dryRun && store) {
		console.error(`${name}: set SHOP plus either CLIENT_ID and CLIENT_SECRET (preferred) or ADMIN_TOKEN in ${join(ROOT, '.env')} (see .env.example). Use --dry-run to preview without them.`);
		process.exit(1);
	}

	log(`# ${name} ${dryRun ? '(DRY RUN: nothing is written)' : store ? '(LIVE)' : '(local files only)'}  ${new Date().toISOString()}`);
	log(`# store: ${shopify ? `${SHOP} (API ${API_VERSION}, token from ${auth.source})${dryRun ? ', read-only' : ''}` : 'offline: no credentials in .env, so the store is treated as empty'}`);
	if (auth?.scope) debug(`# granted scopes: ${auth.scope}`);
	log(`# log: ${logFile}`);

	// --quiet: per-record lines go to the log file only; the console shows ✗ lines, warnings and totals.
	const plan = createPlan(log, args.quiet ? (line) => (/^✗/.test(line) ? log(line) : write(line)) : log);

	return {
		name,
		dryRun,
		args,
		limit: args.limit ? Number(args.limit) : Infinity,
		online: !!shopify,
		shopify,
		log,
		debug,
		warn,
		plan,
		logFile,
		finish() {
			plan.summary();
			if (warnings.length) log(`\n${warnings.length} warning(s); see above or the log.`);
			log(`\nDone${dryRun ? ' (dry run)' : ''}. Log: ${logFile}`);
		},
	};
}

/** Collects create/update/skip decisions and prints them as a diff with counts. */
function createPlan(log, item = log) {
	const rows = [];
	const fmt = (v) => {
		if (v === undefined || v === null || v === '') return '∅';
		const s = typeof v === 'string' ? v : JSON.stringify(v);
		return s.length > 90 ? s.slice(0, 87) + '…' : s;
	};
	return {
		/** + new record */
		create(kind, key, fields = {}) {
			rows.push({ kind, action: 'create' });
			item(`+ ${kind} ${key}`);
			for (const [k, v] of Object.entries(fields)) item(`    ${k}: ${fmt(v)}`);
		},
		/** ~ changed record; changes = { field: [before, after] } */
		update(kind, key, changes = {}) {
			rows.push({ kind, action: 'update' });
			item(`~ ${kind} ${key}`);
			for (const [k, [a, b]] of Object.entries(changes)) item(`    ${k}: ${fmt(a)} → ${fmt(b)}`);
		},
		/** = nothing to do, or deliberately left out */
		skip(kind, key, reason = 'unchanged') {
			rows.push({ kind, action: 'skip' });
			item(`= ${kind} ${key} (${reason})`);
		},
		/** ✗ could not be migrated: needs a human */
		fail(kind, key, reason) {
			rows.push({ kind, action: 'fail' });
			item(`✗ ${kind} ${key}: ${reason}`);
		},
		/** Count n decisions without printing a line each (they were shown elsewhere). */
		tally(kind, action, n = 1) {
			for (let i = 0; i < n; i++) rows.push({ kind, action });
		},
		summary() {
			const by = {};
			for (const r of rows) {
				by[r.kind] ??= { create: 0, update: 0, skip: 0, fail: 0 };
				by[r.kind][r.action]++;
			}
			log('\n## Summary');
			if (!rows.length) log('  nothing to do');
			for (const [kind, c] of Object.entries(by)) {
				log(`  ${kind.padEnd(22)} create ${String(c.create).padStart(4)}   update ${String(c.update).padStart(4)}   skip ${String(c.skip).padStart(4)}   fail ${String(c.fail).padStart(4)}`);
			}
		},
		counts: () => rows,
	};
}

/** Compare two flat objects; returns { field: [before, after] } for differing keys of `next`. */
export function changes(before, next) {
	const out = {};
	for (const [k, v] of Object.entries(next)) {
		const a = before?.[k];
		if (JSON.stringify(a ?? null) !== JSON.stringify(v ?? null)) out[k] = [a, v];
	}
	return out;
}

/** Path of a normalized data file: --file, else data/<name>. Exits with a hint when missing. */
export function dataFile(ctx, name) {
	const p = ctx.args.file ? resolve(process.cwd(), ctx.args.file) : join(ROOT, 'data', name);
	if (!existsSync(p)) die(ctx, `missing ${p}\n  Create it with normalize.mjs (or write it by hand in the format of references/data-format.md).`);
	return p;
}

/** Read a normalized JSON array (data/*.json). */
export function readData(ctx, name) {
	const p = dataFile(ctx, name);
	const rows = JSON.parse(readFileSync(p, 'utf8'));
	if (!Array.isArray(rows)) die(ctx, `${p} must hold a JSON array`);
	ctx.log(`# source: ${p} (${rows.length} records)`);
	return rows.slice(0, ctx.limit);
}

/** Small JSON state file in logs/, used to remember what a live run already created. */
export function state(name) {
	const p = join(ROOT, 'logs', `${name}.state.json`);
	const data = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
	return { data, save: () => writeFileSync(p, JSON.stringify(data, null, 1)) };
}

/** Env value, trimmed. */
export const env = (k, fallback = '') => (process.env[k] || '').trim() || fallback;

export function die(ctx, msg) {
	(ctx?.log ?? console.error)(`\nERROR: ${msg}`);
	process.exit(1);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
