// Text helpers for exported values: entities, lists, dates, money, phones, handles.
// Timezone and phone country come from .env (SOURCE_TZ, DEFAULT_COUNTRY) so the same code
// works for any store.

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', trade: '™', reg: '®', copy: '©', times: '×', middot: '·', bull: '•' };

export function decodeEntities(s = '') {
	return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
		if (e[0] === '#') {
			const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			return Number.isFinite(n) ? String.fromCodePoint(n) : m;
		}
		return NAMED[e.toLowerCase()] ?? m;
	});
}

/** Some exports (WooCommerce CSV) write newlines inside HTML as a literal backslash-n. */
export const unescapeNewlines = (s = '') => String(s).replace(/\\n/g, '\n');

/** Plain text field: entities decoded, literal \n turned into newlines, trimmed. */
export const plain = (s = '') => decodeEntities(unescapeNewlines(s)).replace(/\r\n?/g, '\n').trim();

/** Plain text with blank-line paragraphs → simple HTML; HTML passes through. */
export function paragraphs(text = '') {
	const t = unescapeNewlines(text).replace(/\r\n?/g, '\n').trim();
	if (!t) return '';
	if (/<(p|h\d|ul|ol|div|br|table)\b/i.test(t)) return t;
	return t
		.split(/\n\s*\n/)
		.map((p) => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
		.join('\n');
}

export const stripTags = (s = '') => decodeEntities(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Split a multi-value cell: "a, b", "a|b", "a;b", "a > b" (category paths keep the last part). */
export function list(v, sep = /\s*[,|;]\s*/) {
	return String(v ?? '')
		.split(sep)
		.map((x) => x.trim())
		.filter(Boolean);
}

/** Money string ("1,234.50", "RM 88", "$12") → "1234.50", or '' if empty. Handles "1.234,50". */
export function money(v) {
	let s = String(v ?? '').trim();
	if (/^-?[\d.]+,\d{1,2}$/.test(s.replace(/[^\d.,-]/g, ''))) s = s.replace(/\./g, '').replace(',', '.');
	s = s.replace(/[^0-9.\-]/g, '');
	if (s === '' || isNaN(Number(s))) return '';
	return Number(s).toFixed(2);
}

/** Source timezone offset, e.g. "+08:00" (SOURCE_TZ in .env), default UTC. */
export const sourceTz = () => (process.env.SOURCE_TZ || '+00:00').trim();

/**
 * Dates as exported: "2025-03-04 10:20:00", "2025-03-04", "04/03/2025 10:20", unix seconds, or ISO.
 * Values without a zone are read in SOURCE_TZ. Day-first unless DATE_ORDER=MDY.
 */
export function toIso(v, { gmt = false } = {}) {
	const s = String(v ?? '').trim();
	if (!s || s.startsWith('0000-00-00')) return null;
	const tz = gmt ? 'Z' : sourceTz();
	if (/^\d{9,11}$/.test(s)) return new Date(Number(s) * 1000).toISOString();
	if (/^\d{12,13}$/.test(s)) return new Date(Number(s)).toISOString();
	if (/T.*([zZ]|[+-]\d\d:?\d\d)$/.test(s) || /\s[+-]\d{4}$/.test(s)) {
		const d = new Date(s);
		return isNaN(d) ? null : d.toISOString();
	}
	let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}:\d{2}(?::\d{2})?))?/);
	if (!m) {
		const d = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ ,T]+(\d{1,2}:\d{2}(?::\d{2})?))?/);
		if (d) {
			const mdy = (process.env.DATE_ORDER || '').toUpperCase() === 'MDY';
			m = [null, d[3], mdy ? d[1] : d[2], mdy ? d[2] : d[1], d[4]];
		}
	}
	if (m) {
		const pad = (x) => String(x).padStart(2, '0');
		let time = m[4] || '00:00:00';
		if (time.split(':').length === 2) time += ':00';
		time = time.split(':').map(pad).join(':');
		const d = new Date(`${m[1]}-${pad(m[2])}-${pad(m[3])}T${time}${tz}`);
		return isNaN(d) ? null : d.toISOString();
	}
	const d = new Date(`${s} ${gmt ? 'GMT' : 'GMT' + sourceTz().replace(':', '')}`);
	return isNaN(d) ? null : d.toISOString();
}

export const truthy = (v) => /^(1|yes|true|y|on|subscribed|opted[- ]?in|opt[- ]?in)$/i.test(String(v ?? '').trim());

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());

// Calling codes for DEFAULT_COUNTRY; extend as needed.
const CALLING = { MY: '60', SG: '65', ID: '62', TH: '66', PH: '63', VN: '84', US: '1', CA: '1', GB: '44', AU: '61', NZ: '64', HK: '852', TW: '886', CN: '86', IN: '91', AE: '971', JP: '81', KR: '82', DE: '49', FR: '33' };

/** Phone → E.164 using DEFAULT_COUNTRY (ISO code) for local numbers, or '' if it can't be made valid. */
export function phoneE164(v, country = process.env.DEFAULT_COUNTRY || '') {
	let s = String(v || '').replace(/[^\d+]/g, '');
	if (!s) return '';
	if (s.startsWith('+')) return /^\+\d{8,15}$/.test(s) ? s : '';
	if (s.startsWith('00')) return /^\d{10,17}$/.test(s) ? '+' + s.slice(2) : '';
	const cc = CALLING[country.toUpperCase()];
	if (!cc) return '';
	if (s.startsWith(cc) && s.length > cc.length + 7) return '+' + s;
	if (s.startsWith('0')) s = s.slice(1);
	s = cc + s;
	return /^\d{8,15}$/.test(s) ? '+' + s : '';
}

/** URL handle like Shopify makes: lowercase, ascii, hyphens. Falls back to a hash for non-Latin titles. */
export function handleize(s = '') {
	const h = String(s)
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 200);
	if (h) return h;
	let x = 0;
	for (const c of String(s)) x = (x * 31 + c.codePointAt(0)) >>> 0;
	return `item-${x.toString(36)}`;
}

/** Path of a URL or path string, without trailing slash ("/" stays "/"). */
export function pathOf(u = '') {
	let p = String(u).trim();
	try {
		if (/^https?:\/\//i.test(p)) {
			const url = new URL(p);
			p = url.pathname + url.search;
		}
	} catch {
		// keep as is
	}
	if (!p.startsWith('/')) p = '/' + p;
	return p.replace(/\/+(?=\?|$)/, '') || '/';
}
