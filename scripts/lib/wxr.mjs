// Reader for WordPress eXtended RSS (Tools → Export). Enough for posts, attachments,
// products and shop_coupon items; no XML dependency needed.
import { readFileSync } from 'node:fs';
import { decodeEntities } from './text.mjs';

const unwrap = (s) => {
	const cdata = [...s.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)];
	return cdata.length ? cdata.map((m) => m[1]).join('') : decodeEntities(s);
};

function tag(xml, name) {
	const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`);
	const m = xml.match(re);
	return m ? unwrap(m[1]).trim() : '';
}

/** Parse a WXR file into items: { id, type, status, title, slug, link, date, dateGmt, author, content, excerpt, parent, attachmentUrl, meta, terms } */
export function readWxr(path) {
	const xml = readFileSync(path, 'utf8');
	const items = [];
	for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
		const x = m[1];
		const meta = {};
		for (const pm of x.matchAll(/<wp:postmeta>([\s\S]*?)<\/wp:postmeta>/g)) {
			const k = tag(pm[1], 'wp:meta_key');
			const v = tag(pm[1], 'wp:meta_value');
			if (k in meta) meta[k] = [].concat(meta[k], v);
			else meta[k] = v;
		}
		const terms = [];
		for (const c of x.matchAll(/<category\s+domain="([^"]+)"\s+nicename="([^"]*)"\s*>([\s\S]*?)<\/category>/g)) {
			terms.push({ domain: c[1], slug: decodeURIComponent(c[2]), name: unwrap(c[3]).trim() });
		}
		items.push({
			id: Number(tag(x, 'wp:post_id')),
			type: tag(x, 'wp:post_type'),
			status: tag(x, 'wp:status'),
			title: tag(x, 'title'),
			slug: decodeURIComponent(tag(x, 'wp:post_name')),
			link: tag(x, 'link'),
			date: tag(x, 'wp:post_date'),
			dateGmt: tag(x, 'wp:post_date_gmt'),
			author: tag(x, 'dc:creator'),
			content: tag(x, 'content:encoded'),
			excerpt: tag(x, 'excerpt:encoded'),
			parent: Number(tag(x, 'wp:post_parent') || 0),
			attachmentUrl: tag(x, 'wp:attachment_url'),
			meta,
			terms,
		});
	}
	return items;
}

/** First value of a (possibly repeated) meta key. */
export const meta1 = (item, key) => {
	const v = item.meta[key];
	return Array.isArray(v) ? v[0] : (v ?? '');
};
/** All values of a meta key as an array. */
export const metaAll = (item, key) => [].concat(item.meta[key] ?? []).filter((v) => v !== '');

/**
 * Just enough PHP unserialize for WooCommerce meta: arrays of strings/ints, e.g.
 * a:2:{i:0;s:13:"a@example.com";i:1;s:13:"b@example.com";} → ['a@example.com', 'b@example.com'].
 * Plain (non-serialized) values come back as a one-item array; comma lists are split.
 */
export function phpList(v) {
	const s = String(v ?? '').trim();
	if (!s) return [];
	if (/^a:\d+:\{/.test(s)) {
		// Walk the scalar tokens in order; inside a flat array they alternate key, value.
		const buf = Buffer.from(s, 'utf8'); // s:N counts bytes, not characters
		const tokens = [];
		let i = 0;
		while (i < buf.length) {
			const c = String.fromCharCode(buf[i]);
			if (c === 's' && buf[i + 1] === 0x3a) {
				const colon = buf.indexOf(0x3a, i + 2);
				const len = Number(buf.subarray(i + 2, colon).toString());
				tokens.push(buf.subarray(colon + 2, colon + 2 + len).toString('utf8'));
				i = colon + 2 + len + 2; // closing quote and semicolon
			} else if ((c === 'i' || c === 'd' || c === 'b') && buf[i + 1] === 0x3a) {
				const end = buf.indexOf(0x3b, i);
				tokens.push(buf.subarray(i + 2, end).toString());
				i = end + 1;
			} else i++;
		}
		return tokens.filter((_, n) => n % 2 === 1);
	}
	return s.split(',').map((x) => x.trim()).filter(Boolean);
}
