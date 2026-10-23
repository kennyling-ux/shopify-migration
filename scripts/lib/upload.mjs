// Files: staged uploads for local files, fileCreate for remote URLs, and lookup by filename
// so re-runs reuse the file already in Shopify instead of uploading a copy.
import { readFileSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { sleep } from './run.mjs';

const MIME = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
export const mimeOf = (name) => MIME[extname(name).toLowerCase()] ?? 'application/octet-stream';

/** Upload a local file to Shopify's staging bucket; returns the resourceUrl to use as originalSource. */
export async function stageLocalFile(shopify, path) {
	const filename = basename(path);
	const mimeType = mimeOf(filename);
	const { stagedTargets } = await shopify.mutate(
		`mutation($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) {
			stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } } }`,
		{ input: [{ filename, mimeType, resource: mimeType.startsWith('image/') ? 'IMAGE' : 'FILE', httpMethod: 'POST', fileSize: String(statSync(path).size) }] },
		'stagedUploadsCreate',
	);
	const t = stagedTargets[0];
	const form = new FormData();
	for (const p of t.parameters) form.append(p.name, p.value);
	form.append('file', new Blob([readFileSync(path)], { type: mimeType }), filename);
	const res = await fetch(t.url, { method: 'POST', body: form });
	if (!res.ok) throw new Error(`staged upload of ${filename} failed: HTTP ${res.status} ${await res.text()}`);
	return t.resourceUrl;
}

/** Existing MediaImage/GenericFile by exact filename, or null. Returns { id, url, status }. */
export async function findFile(shopify, filename) {
	const d = await shopify.query(
		`query($q: String!) { files(first: 10, query: $q) { nodes { id fileStatus alt
			... on MediaImage { image { url } originalSource { url } }
			... on GenericFile { url } } } }`,
		{ q: `filename:"${filename.replace(/"/g, '')}"` },
	);
	// The search is fuzzy; confirm the name from the CDN URL.
	const hit = d.files.nodes.find((n) => {
		const url = n.image?.url || n.originalSource?.url || n.url || '';
		const name = decodeURIComponent(url.split('?')[0].split('/').pop() || '');
		return name === filename || name.replace(/_[0-9a-f-]{36}(?=\.)/, '') === filename;
	});
	return hit ? { id: hit.id, url: hit.image?.url || hit.url || null, status: hit.fileStatus } : null;
}

/**
 * Make sure a file exists in Shopify Files: reuse by filename, else create from a local path
 * or a public URL. Waits until it is READY when `wait` is set (needed when the CDN URL is used).
 */
export async function ensureFile(shopify, { path, url, filename, alt = '', wait = false }) {
	filename ??= basename(path || new URL(url).pathname);
	let file = await findFile(shopify, filename);
	if (!file) {
		const originalSource = path ? await stageLocalFile(shopify, path) : url;
		const { files } = await shopify.mutate(
			`mutation($files: [FileCreateInput!]!) { fileCreate(files: $files) { files { id fileStatus } userErrors { field message code } } }`,
			{ files: [{ originalSource, filename, alt, contentType: mimeOf(filename).startsWith('image/') ? 'IMAGE' : 'FILE' }] },
			'fileCreate',
		);
		file = { id: files[0].id, url: null, status: files[0].fileStatus, created: true };
	}
	if (wait && file.status !== 'READY') file = await waitForFile(shopify, file.id);
	return file;
}

async function waitForFile(shopify, id) {
	for (let i = 0; i < 30; i++) {
		const d = await shopify.query(
			`query($id: ID!) { node(id: $id) { id ... on File { fileStatus fileErrors { message } }
				... on MediaImage { image { url } } ... on GenericFile { url } } }`,
			{ id },
		);
		const n = d.node;
		if (n.fileStatus === 'READY') return { id, url: n.image?.url || n.url, status: 'READY' };
		if (n.fileStatus === 'FAILED') throw new Error(`file ${id} failed: ${n.fileErrors?.map((e) => e.message).join('; ')}`);
		await sleep(2000);
	}
	throw new Error(`file ${id} still processing after 60 s`);
}

/** Follow redirects on a public URL (HEAD); returns { ok, url, status }. Read-only. */
export async function resolveUrl(url) {
	try {
		let res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
		if (res.status === 405) res = await fetch(url, { method: 'GET', redirect: 'follow' });
		return { ok: res.ok, url: res.url || url, status: res.status };
	} catch (e) {
		return { ok: false, url, status: e.code || 'network error' };
	}
}
