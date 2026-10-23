#!/usr/bin/env node
// data/articles.json → blog posts, data/pages.json → pages. Body images can be re-hosted on
// Shopify Files so nothing keeps loading from the old server after it is switched off.
// Matches by handle, so it can be re-run; existing items are skipped unless --update.
//
//   --update           overwrite existing articles and pages
//   --rehost-images    copy <img> sources and featured images into Shopify Files (recommended
//                      before the old site goes offline)
//   --only <kind>      articles | pages
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { start, ROOT, env } from './lib/run.mjs';
import { ensureFile, resolveUrl } from './lib/upload.mjs';
import { handleize, paragraphs, toIso } from './lib/text.mjs';

const ctx = await start('import-content', {
	update: { type: 'boolean', default: false },
	'rehost-images': { type: 'boolean', default: false },
	only: { type: 'string' },
});
const { shopify, plan, log, warn, dryRun, args } = ctx;
const load = (name) => {
	const p = join(ROOT, 'data', name);
	if (!existsSync(p)) return null;
	const rows = JSON.parse(readFileSync(p, 'utf8'));
	log(`# source: ${p} (${rows.length} records)`);
	return rows.slice(0, ctx.limit);
};
const articles = args.only === 'pages' ? null : load('articles.json');
const pages = args.only === 'articles' ? null : load('pages.json');
if (!articles && !pages) {
	log('\nNothing to do: no data/articles.json or data/pages.json.');
	process.exit(0);
}

const seo = (s) => [
	...(s?.title ? [{ namespace: 'global', key: 'title_tag', type: 'single_line_text_field', value: s.title }] : []),
	...(s?.description ? [{ namespace: 'global', key: 'description_tag', type: 'single_line_text_field', value: s.description }] : []),
];

async function rehost(html, label) {
	if (!args['rehost-images'] || !html) return html;
	const srcs = [...new Set([...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]).filter((u) => /^https?:/i.test(u) && !/cdn\.shopify\.com|\/cdn\/shop\//.test(u)))];
	for (const src of srcs) {
		const live = await resolveUrl(src);
		if (!live.ok) {
			warn(`${label}: image ${src} → ${live.status}; left pointing at the old URL`);
			continue;
		}
		try {
			const f = await ensureFile(shopify, { url: live.url, wait: true });
			html = html.split(src).join(f.url);
		} catch (e) {
			warn(`${label}: image ${src} not copied (${e.message})`);
		}
	}
	return html;
}

// ---- Articles ------------------------------------------------------------------------
if (articles) {
	const blogs = new Map();
	const blogId = async (title) => {
		if (blogs.has(title)) return blogs.get(title);
		const d = await shopify.query(`{ blogs(first: 50) { nodes { id title handle } } }`);
		let b = d.blogs.nodes.find((x) => x.title.toLowerCase() === title.toLowerCase() || x.handle === handleize(title));
		if (!b && !dryRun) {
			({ blog: b } = await shopify.mutate(`mutation($b: BlogCreateInput!) { blogCreate(blog: $b) { blog { id handle } userErrors { field message code } } }`, { b: { title } }, 'blogCreate'));
		}
		blogs.set(title, b?.id ?? null);
		return b?.id ?? null;
	};
	const existing = new Map();
	if (shopify) {
		const all = await shopify.all(`query($after: String) { articles(first: 250, after: $after) { nodes { id handle blog { title } } pageInfo { hasNextPage endCursor } } }`, {}, (d) => d.articles);
		for (const a of all) existing.set(`${a.blog.title.toLowerCase()}/${a.handle}`, a);
	}
	for (const a of articles) {
		const blog = a.blog || env('DEFAULT_BLOG', 'News');
		const handle = a.handle || handleize(a.title);
		const key = `${blog}/${handle}`;
		if (!a.title) {
			plan.fail('article', key, 'no title');
			continue;
		}
		const have = existing.get(`${blog.toLowerCase()}/${handle}`);
		if (have && !args.update) {
			plan.skip('article', key, 'exists (use --update)');
			continue;
		}
		const view = { published: toIso(a.publishedAt)?.slice(0, 10) ?? 'now', tags: (a.tags || []).join(', ') || null, image: a.image ? String(a.image).split('/').pop() : null };
		if (have) plan.update('article', key, Object.fromEntries(Object.entries(view).map(([k, v]) => [k, [null, v]])));
		else plan.create('article', key, view);
		if (dryRun) continue;
		try {
			let image = null;
			if (a.image) {
				const live = await resolveUrl(a.image);
				if (live.ok) image = { url: live.url, altText: a.imageAlt || a.title };
				else warn(`${key}: featured image ${a.image} → ${live.status}; article has no image`);
			}
			const article = {
				title: a.title,
				handle,
				body: await rehost(paragraphs(a.bodyHtml || ''), key),
				summary: a.summary || null,
				author: { name: a.author || env('DEFAULT_AUTHOR', 'Editor') },
				isPublished: a.published !== false,
				...(a.publishedAt ? { publishDate: toIso(a.publishedAt) } : {}),
				tags: a.tags || [],
				...(image ? { image } : {}),
				metafields: seo(a.seo),
			};
			if (have) {
				await shopify.mutate(`mutation($id: ID!, $a: ArticleUpdateInput!) { articleUpdate(id: $id, article: $a) { article { id } userErrors { field message code } } }`, { id: have.id, a: article }, 'articleUpdate');
			} else {
				const id = await blogId(blog);
				await shopify.mutate(`mutation($a: ArticleCreateInput!) { articleCreate(article: $a) { article { id } userErrors { field message code } } }`, { a: { ...article, blogId: id } }, 'articleCreate');
			}
			log(`  ✓ ${key}`);
		} catch (e) {
			plan.fail('article', key, e.message);
		}
	}
}

// ---- Pages ---------------------------------------------------------------------------
if (pages) {
	const existing = new Map();
	if (shopify) {
		const all = await shopify.all(`query($after: String) { pages(first: 250, after: $after) { nodes { id handle } pageInfo { hasNextPage endCursor } } }`, {}, (d) => d.pages);
		for (const p of all) existing.set(p.handle, p);
	}
	for (const p of pages) {
		const handle = p.handle || handleize(p.title);
		if (!p.title) {
			plan.fail('page', handle, 'no title');
			continue;
		}
		const have = existing.get(handle);
		if (have && !args.update) {
			plan.skip('page', handle, 'exists (use --update)');
			continue;
		}
		if (have) plan.update('page', handle, { body: [null, 'replaced'] });
		else plan.create('page', handle, { title: p.title });
		if (dryRun) continue;
		try {
			const page = { title: p.title, handle, body: await rehost(paragraphs(p.bodyHtml || ''), handle), isPublished: p.published !== false, metafields: seo(p.seo) };
			if (have) await shopify.mutate(`mutation($id: ID!, $p: PageUpdateInput!) { pageUpdate(id: $id, page: $p) { page { id } userErrors { field message code } } }`, { id: have.id, p: page }, 'pageUpdate');
			else await shopify.mutate(`mutation($p: PageCreateInput!) { pageCreate(page: $p) { page { id } userErrors { field message code } } }`, { p: page }, 'pageCreate');
			log(`  ✓ ${handle}`);
		} catch (e) {
			plan.fail('page', handle, e.message);
		}
	}
}

ctx.finish();
