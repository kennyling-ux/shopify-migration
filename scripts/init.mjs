#!/usr/bin/env node
// Create a migration workspace for one store: .env, exports/, data/, logs/ and a plan file.
//   node <skill>/scripts/init.mjs [folder]     (default: current folder)
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(process.argv[2] || '.');
for (const d of ['exports', 'data', 'logs']) mkdirSync(join(dir, d), { recursive: true });

const copy = (from, to) => {
	if (existsSync(join(dir, to))) return console.log(`= ${to} (kept)`);
	copyFileSync(join(skill, 'templates', from), join(dir, to));
	console.log(`+ ${to}`);
};
copy('env.example', '.env');
copy('env.example', '.env.example');
copy('migration-plan.md', 'MIGRATION-PLAN.md');
if (!existsSync(join(dir, '.gitignore'))) {
	writeFileSync(join(dir, '.gitignore'), '.env\nexports/\nlogs/\ndata/customers.json\ndata/orders.json\n');
	console.log('+ .gitignore (keeps credentials and customer data out of git)');
}
console.log(`\nWorkspace ready: ${dir}
Next:
  1. Put the source exports in exports/ (see references/platforms/<platform>.md).
  2. Fill in .env (SHOP, CLIENT_ID, CLIENT_SECRET, CURRENCY, SOURCE_TZ, DEFAULT_COUNTRY).
  3. node ${join(skill, 'scripts', 'check.mjs')}`);
