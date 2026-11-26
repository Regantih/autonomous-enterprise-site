import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error plain JS build script
import { PAGES, SITE_URL, build } from '../scripts/build.mjs';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
type Page = { out: string; path: string; robots?: string; sitemap?: boolean };
const pages = PAGES as Page[];
const html = (p: Page) => readFileSync(join(DIST, p.out), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

beforeAll(() => {
  build();
});

describe('built site', () => {
  it('produces every page plus sitemap, robots, 404, headers and favicons', () => {
    for (const f of ['index.html', 'speaking/index.html', 'consulting/index.html', 'contact/index.html', '404.html',
      'sitemap.xml', 'robots.txt', '_headers', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png',
      'site.webmanifest', 'assets/images/og-image.jpg']) {
      expect(existsSync(join(DIST, f)), f).toBe(true);
    }
  });

  it('gives each page a title, description, canonical URL, Open Graph and Twitter card', () => {
    for (const p of pages) {
      const h = html(p);
      expect(h).toMatch(/<html lang="en">/);
      expect(h).toMatch(/<title>[^<]{10,}<\/title>/);
      expect(h).toMatch(/<meta name="description" content="[^"]{50,}">/);
      expect(h).toContain(`<link rel="canonical" href="${SITE_URL}${p.path}">`);
      expect(h).toContain(`<meta property="og:image" content="${SITE_URL}/assets/images/og-image.jpg">`);
      expect(h).toContain('<meta name="twitter:card" content="summary_large_image">');
      expect(h).toContain('<main id="main"');
      expect((h.match(/<h1[\s>]/g) ?? []).length, p.out).toBe(1);
      expect(h).not.toMatch(/\{\{/);
    }
  });

  it('embeds valid Book and Person JSON-LD on the home page', () => {
    const h = html(pages[0]);
    const m = h.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    expect(m).toBeTruthy();
    const graph = JSON.parse(m![1])['@graph'];
    const book = graph.find((n: { '@type': string }) => n['@type'] === 'Book');
    const person = graph.find((n: { '@type': string }) => n['@type'] === 'Person');
    expect(book.name).toBe('The Autonomous Enterprise');
    expect(book.workExample[0]).toMatchObject({ isbn: '9798142205612', numberOfPages: 742 });
    expect(person).toMatchObject({ name: 'Hemanth Reganti', sameAs: ['https://www.linkedin.com/in/hemanth-reganti-147153178/'] });
  });

  it('keeps noindex pages out of the sitemap', () => {
    const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
    for (const p of pages) {
      expect(sitemap.includes(`<loc>${SITE_URL}${p.path}</loc>`), p.path).toBe(Boolean(p.sitemap));
      if (!p.sitemap) expect(html(p)).toContain('noindex');
    }
    expect(readFileSync(join(DIST, 'robots.txt'), 'utf8')).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });

  it('resolves every internal link and asset', () => {
    for (const p of pages) {
      const h = html(p);
      const ids = new Set([...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
      for (const [, ref] of h.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (/^(https?:|mailto:)/.test(ref)) continue;
        if (ref.startsWith('#')) { expect(ids.has(ref.slice(1)), `${p.out} ${ref}`).toBe(true); continue; }
        const [path, hash] = ref.split('?')[0].split('#');
        const file = path.endsWith('/') ? join(DIST, path, 'index.html') : join(DIST, path);
        expect(existsSync(file), `${p.out} -> ${ref}`).toBe(true);
        if (hash && path === '/') expect(html(pages[0])).toContain(`id="${hash}"`);
      }
    }
  });

  it('opens external links safely and uses the right Amazon links', () => {
    for (const p of pages) {
      for (const [tag] of html(p).matchAll(/<a [^>]*href="https?:[^"]+"[^>]*>/g)) {
        if (tag.includes('target="_blank"')) expect(tag).toContain('rel="noopener"');
      }
    }
    const home = html(pages[0]);
    expect(home).toContain('https://www.amazon.com/dp/B0HS8HG6DP');
    expect(home).toContain('https://www.amazon.com/dp/B0HS8C4WLL');
  });

  it('has no inline scripts/styles (CSP), analytics, trackers or third-party requests', () => {
    for (const p of pages) {
      const h = html(p);
      expect(h).not.toMatch(/\sstyle="/);
      expect(h).not.toMatch(/<script(?![^>]*(src="\/|type="application\/ld\+json"))/);
      expect(h).not.toMatch(/googletagmanager|google-analytics|gtag\(|plausible|segment\.|hotjar|fonts\.googleapis|document\.cookie/i);
      for (const [, src] of h.matchAll(/<(?:script|link|img|source)[^>]+(?:src|href)="(https?:[^"]+)"/g)) {
        expect(src.startsWith(SITE_URL), src).toBe(true);
      }
    }
    expect(readFileSync(join(DIST, 'assets/site.js'), 'utf8')).not.toMatch(/cookie|localStorage/i);
  });

  it('never names a software vendor other than LangChain, and never uses mailto', () => {
    const vendors = /\b(SAP|Oracle|Microsoft|Salesforce|Workday|ServiceNow|IBM|Google|Amazon Web Services|AWS|Azure|OpenAI|Anthropic|Coupa|Ariba|NetSuite|Infor|Epicor|UiPath|Snowflake|Databricks|MuleSoft|Boomi|Kyriba|BlackLine|Dynamics|Copilot|ChatGPT|Gemini|Claude|Llama|CrewAI|AutoGen)\b/;
    for (const f of walk(DIST).filter((f) => /\.(html|xml|txt|js|webmanifest)$/.test(f))) {
      const t = readFileSync(f, 'utf8');
      expect(t.match(vendors)?.[0], f).toBeUndefined();
      expect(t).not.toContain('mailto:');
    }
    expect(html(pages[0]).match(/LangChain/g)?.length).toBeGreaterThan(0);
  });

  it('keeps both request forms posting to /api/request with a honeypot', () => {
    const contact = html(pages.find((p) => p.out === 'contact/index.html')!);
    for (const type of ['speaking', 'consultation']) {
      expect(contact).toContain(`<input type="hidden" name="type" value="${type}">`);
    }
    expect(contact.match(/<form class="request-form" action="\/api\/request" method="post"/g)).toHaveLength(2);
    expect(contact.match(/name="website" tabindex="-1"/g)).toHaveLength(2);
  });
});
