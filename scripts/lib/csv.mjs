// RFC 4180 CSV reader (quoted fields, embedded newlines, BOM, , ; or tab delimiters) and a tiny writer.
// Marketplace exports in .xlsx must be saved as CSV (UTF-8) first.
import { readFileSync, writeFileSync } from 'node:fs';

export function parseCsv(text, delimiter) {
	text = text.replace(/^﻿/, '');
	delimiter ??= sniffDelimiter(text);
	const rows = [];
	let row = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else quoted = false;
			} else field += c;
		} else if (c === '"') quoted = true;
		else if (c === delimiter) {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += c;
	}
	if (field !== '' || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

/** Most common of , ; and tab in the header line (Excel in some locales writes ;). */
function sniffDelimiter(text) {
	const head = text.slice(0, text.search(/\r?\n/) >>> 0 || 2000);
	const counts = [',', ';', '\t'].map((d) => [d, head.split(d).length]);
	return counts.sort((a, b) => b[1] - a[1])[0][0];
}

/** Read a CSV file into objects keyed by the header row. */
export function readCsv(path) {
	const [header, ...rows] = parseCsv(readFileSync(path, 'utf8'));
	const keys = header.map((h) => h.trim());
	return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}

/**
 * Column lookup by alias, case- and punctuation-insensitive, so the scripts accept the
 * slightly different headers that each platform, its versions and export plugins write.
 */
export function picker(row) {
	const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
	const map = new Map(Object.keys(row).map((k) => [norm(k), k]));
	return (...aliases) => {
		for (const a of aliases) {
			const k = map.get(norm(a));
			if (k !== undefined && String(row[k]).trim() !== '') return String(row[k]).trim();
		}
		return '';
	};
}

export function writeCsv(path, rows) {
	if (!rows.length) return writeFileSync(path, '');
	const keys = Object.keys(rows[0]);
	const esc = (v) => {
		const s = String(v ?? '');
		return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	writeFileSync(path, [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n') + '\n');
}
