import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error plain JS build script
import { BIO_LONG, BIO_SHORT, LINKEDIN_SHARE, PAGES, QUOTES, SITE_URL, build, wordCount } from '../scripts/build.mjs';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
type Page = { out: string; path: string; robots?: string; sitemap?: boolean };
const pages = PAGES as Page[];
const html = (p: Page) => readFileSync(join(DIST, p.out), 'utf8');
const byOut = (out: string) => pages.find((p) => p.out === out)!;

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
    for (const f of ['index.html', 'speaking/index.html', 'advisory/index.html', 'ideas/index.html', 'contact/index.html', '404.html',
      'blueprints/index.html', 'architecture/index.html', 'workflows/index.html', 'controls/index.html', 'designer/index.html',
      'sitemap.xml', 'robots.txt', '_headers', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png',
      'site.webmanifest', 'assets/images/og-image.jpg', '_redirects', 'press/the-autonomous-enterprise-cover.jpg']) {
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
    const vendors = /\b(NVIDIA|Nvidia|Meta|Siemens|Rockwell|Alexa|Siri|Kafka|Kubernetes|Neo4j|Pinecone|Palantir|Tesla|Boston Dynamics|Mistral|Cohere|SAP|Oracle|Microsoft|Salesforce|Workday|ServiceNow|IBM|Google|Amazon Web Services|AWS|Azure|OpenAI|Anthropic|Coupa|Ariba|NetSuite|Infor|Epicor|UiPath|Snowflake|Databricks|MuleSoft|Boomi|Kyriba|BlackLine|Dynamics|Copilot|ChatGPT|Gemini|Claude|Llama|CrewAI|AutoGen)\b/;
    for (const f of walk(DIST).filter((f) => /\.(html|xml|txt|js|webmanifest)$/.test(f))) {
      const t = readFileSync(f, 'utf8');
      expect(t.match(vendors)?.[0], f).toBeUndefined();
      expect(t).not.toContain('mailto:');
      expect(t.match(/\bGPT(?!-class)/)?.[0], f).toBeUndefined();
    }
    expect(html(pages[0]).match(/LangChain/g)?.length).toBeGreaterThan(0);
  });

  it('puts all three request forms on /contact behind tabs, each posting to /api/request with a honeypot', () => {
    const contact = html(byOut('contact/index.html'));
    for (const type of ['speaking', 'consultation', 'media']) {
      expect(contact).toContain(`<input type="hidden" name="type" value="${type}">`);
    }
    expect(contact.match(/<form class="request-form" action="\/api\/request" method="post"/g)).toHaveLength(3);
    expect(contact.match(/name="website" tabindex="-1"/g)).toHaveLength(3);
    for (const [id, label] of [['speaking', 'Speaking'], ['advisory', 'Advisory'], ['media', 'Media &amp; podcasts']]) {
      expect(contact).toContain(`<a class="tab" id="tab-${id}" href="#${id}" aria-controls="${id}">${label}</a>`);
      expect(contact).toContain(`<div class="tabpanel" id="${id}" aria-labelledby="tab-${id}">`);
    }
    for (const f of ['name', 'email', 'outlet', 'topic', 'deadline', 'message']) expect(contact).toContain(`id="me-${f}" name="${f}"`);
  });

  it('uses the Human-Led Enterprise brand on humanledenterprise.com', () => {
    expect(SITE_URL).toBe('https://humanledenterprise.com');
    for (const p of pages) {
      const h = html(p);
      expect(h).toContain('<meta property="og:site_name" content="Human-Led Enterprise">');
      expect(h).toContain(`<meta property="og:url" content="https://humanledenterprise.com${p.path}">`);
      expect(h).not.toContain('pages.dev');
    }
    const graph = JSON.parse(html(pages[0]).match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1])['@graph'];
    expect(graph.find((n: { '@type': string }) => n['@type'] === 'WebSite')).toMatchObject({ name: 'Human-Led Enterprise', url: 'https://humanledenterprise.com/' });
    for (const n of graph) expect(n['@id'].startsWith('https://humanledenterprise.com/')).toBe(true);
    expect(readFileSync(join(DIST, 'robots.txt'), 'utf8')).toContain('Sitemap: https://humanledenterprise.com/sitemap.xml');
  });

  it('has Book, Frameworks, Blueprints, Ideas, Speaking, Advisory, About, Contact in the header and footer of every page', () => {
    for (const p of pages) {
      const h = html(p);
      for (const part of [h.match(/<header[\s\S]*?<\/header>/)![0], h.match(/<footer[\s\S]*?<\/footer>/)![0]]) {
        const labels = [...part.matchAll(/<li><a href="(\/[^"]*)"[^>]*>([^<]+)<\/a><\/li>/g)].map((m) => m[2]);
        expect(labels.slice(0, 8), p.out).toEqual(['Book', 'Frameworks', 'Blueprints', 'Ideas', 'Speaking', 'Advisory', 'About', 'Contact']);
      }
    }
  });

  it('lists every quote verbatim on /ideas with attribution and a plain LinkedIn share link', () => {
    const h = html(byOut('ideas/index.html'));
    expect(QUOTES).toHaveLength(13);
    for (const q of QUOTES as string[]) expect(h).toContain(`<p>${q.replace(/'/g, '&rsquo;')}</p>`);
    expect(h.match(/&mdash; <cite>The Autonomous Enterprise<\/cite>/g)).toHaveLength(13);
    expect(LINKEDIN_SHARE).toBe('https://www.linkedin.com/sharing/share-offsite/?url=https://humanledenterprise.com/ideas');
    expect(h.match(new RegExp(`<a class="share" href="${LINKEDIN_SHARE.replace(/[?.]/g, '\\$&')}" rel="noopener" target="_blank">`, 'g'))).toHaveLength(13);
    expect(h).not.toMatch(/platform\.linkedin\.com|<script[^>]+linkedin/i);
  });

  it('features the thesis and a scrollable strip of five quotes on the home page', () => {
    const h = html(pages[0]);
    const thesis = h.match(/<section class="section section-paper-2 thesis"[\s\S]*?<\/section>/)![0];
    expect(thesis).toContain('Autonomy is earned when value compounds faster than risk.');
    const strip = h.match(/<ul class="quote-strip" tabindex="0"[\s\S]*?<\/ul>/)![0];
    expect(strip.match(/class="quote-card"/g)).toHaveLength(5);
    expect(h).toContain('href="/ideas/"');
  });

  it('adds Why book Hemanth and a speaker kit with 50- and 120-word bios on /speaking', () => {
    const h = html(byOut('speaking/index.html'));
    expect(h).toContain('Why book Hemanth');
    expect(h).toContain('Speaker kit');
    expect(h).toContain(BIO_SHORT);
    expect(h).toContain(BIO_LONG);
    expect(Math.abs(wordCount(BIO_SHORT) - 50)).toBeLessThanOrEqual(5);
    expect(Math.abs(wordCount(BIO_LONG) - 120)).toBeLessThanOrEqual(5);
    expect(h).toContain('<input type="hidden" name="type" value="speaking">');
  });

  it('serves advisory at /advisory with the engagement steps, no prices, and redirects /consulting', () => {
    const h = html(byOut('advisory/index.html'));
    for (const s of ['Intro call', 'Readiness assessment', 'Roadmap and guardrails', 'How an engagement works']) expect(h).toContain(s);
    const main = h.match(/<main[\s\S]*?<\/main>/)![0].replace(/<section class="section section-orange[\s\S]*?<\/section>/, '');
    expect(main).not.toMatch(/\$\s?\d/);
    expect(h).toContain('<input type="hidden" name="type" value="consultation">');
    expect(existsSync(join(DIST, 'consulting'))).toBe(false);
    const redirects = readFileSync(join(DIST, '_redirects'), 'utf8');
    expect(redirects).toContain('/consulting /advisory/ 301');
    expect(redirects).toContain('/consulting/ /advisory/ 301');
  });

  it('has a press kit with a cover download and both bios', () => {
    const h = html(byOut('contact/index.html'));
    expect(h).toContain('id="press"');
    expect(h).toContain('href="/press/the-autonomous-enterprise-cover.jpg" download');
    expect(h).toContain(BIO_SHORT);
    expect(h).toContain(BIO_LONG);
  });
});

describe('schema.sql', () => {
  it('allows speaking, consultation, media and conversation request types', () => {
    expect(readFileSync(fileURLToPath(new URL('../schema.sql', import.meta.url)), 'utf8'))
      .toContain("CHECK (type IN ('speaking', 'consultation', 'media', 'conversation'))");
  });

  it('has a migration that rebuilds requests to allow conversation', () => {
    const sql = readFileSync(fileURLToPath(new URL('../migrations/0002_conversation.sql', import.meta.url)), 'utf8');
    expect(sql).toContain("CHECK (type IN ('speaking', 'consultation', 'media', 'conversation'))");
    expect(sql).toMatch(/INSERT INTO requests_new[\s\S]*FROM requests;/);
    expect(sql).toContain('ALTER TABLE requests_new RENAME TO requests;');
  });
});

describe('wrangler.toml', () => {
  const toml = readFileSync(fileURLToPath(new URL('../wrangler.toml', import.meta.url)), 'utf8');
  it('binds D1 as DB and Workers AI as AI', () => {
    expect(toml).toMatch(/binding = "DB"/);
    expect(toml).toMatch(/\[ai\]\s*\nbinding = "AI"/);
    expect(toml).toContain('pages_build_output_dir = "dist"');
  });
});

describe('portrait, real cover and guide', () => {
  const home = () => html(byOut('index.html'));

  it('uses the real cover in responsive sizes and for Open Graph', () => {
    for (const f of ['cover-400.webp', 'cover-800.webp', 'cover-400.jpg', 'cover-800.jpg', 'portrait-480.webp', 'portrait-960.webp', 'portrait-480.jpg', 'portrait-960.jpg']) {
      expect(existsSync(join(DIST, 'assets/images', f)), f).toBe(true);
    }
    expect(existsSync(join(DIST, 'assets/images/source')), 'sources are not published').toBe(false);
    expect(home()).toMatch(/cover-800\.jpg[^"]*" srcset=[^>]+width="800" height="1280"/);
    expect(home()).toContain(`<meta property="og:image" content="${SITE_URL}/assets/images/og-image.jpg">`);
  });

  it('shows the portrait in colour, rectangular, with alt text on home, speaking and about', () => {
    for (const out of ['index.html', 'speaking/index.html', 'about/index.html']) {
      const h = html(byOut(out));
      expect(h, out).toMatch(/<img class="portrait-img" src="\/assets\/images\/portrait-960\.jpg[^"]*"[^>]+alt="Hemanth Reganti, author of The Autonomous Enterprise[^"]+"/);
    }
    const css = readFileSync(join(DIST, 'assets/styles.css'), 'utf8');
    expect(css).not.toMatch(/grayscale|greyscale|saturate\(0/);
    expect(css).not.toMatch(/\.portrait-img[^}]*border-radius:\s*50%/);
  });

  it('puts an author band with both CTAs right after the thesis on home', () => {
    const h = home();
    const thesis = h.indexOf('id="thesis"');
    const author = h.indexOf('id="author"');
    expect(thesis).toBeGreaterThan(0);
    expect(author).toBeGreaterThan(thesis);
    expect(h.slice(thesis, author).match(/<section /g)).toHaveLength(1);
    const band = h.slice(author, h.indexOf('</section>', author));
    expect(band).toContain('Author, speaker and advisor on human-led, agent-operated enterprises.');
    expect(band).toContain('>Request a talk</a>');
    expect(band).toContain('>Book an advisory call</a>');
  });

  it('keeps home to six sections and moves the detail to /book', () => {
    const main = home().split('<main')[1].split('</main>')[0];
    expect(main.match(/<section /g)).toHaveLength(6);
    for (const id of ['problem', 'inside', 'audience']) {
      expect(main).not.toContain(`id="${id}"`);
      expect(html(byOut('book/index.html'))).toContain(`id="${id}"`);
    }
    expect(home()).toMatch(/<a class="btn btn-ghost" href="\/talk\/" data-guide-open>Talk to the book<\/a>/);
  });

  it('has one primary header CTA, Talk to the author, on every page', () => {
    for (const p of pages) {
      const header = html(p).split('<header')[1].split('</header>')[0];
      expect(header.match(/btn-primary/g), p.out).toHaveLength(1);
      expect(header, p.out).toContain('>Talk to the author</a>');
    }
  });

  it('adds the floating Talk to the book button to every page except /talk, which embeds the chat', () => {
    for (const p of pages) {
      const h = html(p);
      expect(h, p.out).toContain('<script src="/assets/guide.js?v=');
      if (p.out === 'talk/index.html') {
        expect(h).not.toContain('class="guide-fab"');
        expect(h).toContain('data-guide-embed');
      } else expect(h, p.out).toContain('<a class="guide-fab" href="/talk/" data-guide-open');
    }
  });

  it('keeps guide state in sessionStorage only and calls only the same-origin API', () => {
    const js = readFileSync(join(DIST, 'assets/guide.js'), 'utf8');
    expect(js).toContain('sessionStorage');
    expect(js).not.toMatch(/localStorage|document\.cookie|indexedDB/);
    expect(js).toContain("var API = '/api/guide'");
    expect(js.match(/https?:\/\/[^'" )]+/g)).toEqual(['https://www.amazon.com/dp/B0HS8HG6DP']);
    expect(js).toContain('Share a summary of this chat with Hemanth');
  });

  it('adds the headshot and real cover downloads to the press kit and the Person image to JSON-LD', () => {
    expect(existsSync(join(DIST, 'press/hemanth-reganti-headshot.jpg'))).toBe(true);
    const contact = html(byOut('contact/index.html'));
    expect(contact).toContain('href="/press/hemanth-reganti-headshot.jpg" download');
    expect(contact).toContain('href="/press/the-autonomous-enterprise-cover.jpg" download');
    const ld = JSON.parse(home().match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);
    const person = ld['@graph'].find((n: { '@type': string }) => n['@type'] === 'Person');
    expect(person.image.url).toBe(`${SITE_URL}/assets/images/portrait-960.jpg`);
  });
});

describe('/leaders: Questions leaders ask', () => {
  const lead = () => html(byOut('leaders/index.html'));

  it('is a sitemap page that loads its own CSS and JS only on /leaders', () => {
    expect(byOut('leaders/index.html')).toMatchObject({ path: '/leaders/', sitemap: true });
    expect(lead()).toMatch(/<link rel="stylesheet" href="\/assets\/leaders\.css\?v=[0-9a-f]{10}">/);
    expect(lead()).toMatch(/<script src="\/assets\/leaders\.js\?v=[0-9a-f]{10}" defer><\/script>/);
    for (const p of pages.filter((x) => x.out !== 'leaders/index.html')) {
      expect(html(p), p.out).not.toContain('leaders.js');
      expect(html(p), p.out).not.toContain('leaders.css');
    }
  });

  it('groups at least 12 numbered questions under the seven theme tabs', () => {
    const h = lead();
    const tabs = [...h.matchAll(/<a class="lq-tab" href="#t-([a-z]+)" data-theme="\1">([^<]+)</g)].map((m) => m[2]);
    expect(tabs).toEqual(['Fund', 'Prioritize', 'Govern', 'People', 'Trust', 'Control', 'Scale']);
    for (const t of ['fund', 'prioritize', 'govern', 'people', 'trust', 'control', 'scale']) expect(h).toContain(`<div class="lq-panel" id="t-${t}"`);
    const rows = [...h.matchAll(/<details id="q-(\d\d)"/g)].map((m) => +m[1]);
    expect(rows.length).toBeGreaterThanOrEqual(12);
    expect(rows).toEqual(rows.map((_, i) => i + 1));
    for (const q of ['How much should we fund?', 'What should we fund first?', 'How do we govern the change?', 'What is our hire and upskill plan?',
      'How far can we trust an agent?', 'How do we stay in control?', 'Build, buy or partner?', 'How do we scale from pilot to portfolio?']) {
      expect(h).toContain(`<span class="lq-q">${q}</span>`);
    }
  });

  it('gives every question an answer, a Decide this checklist, a metric and framework links', () => {
    const blocks = lead().split('<details id="q-').slice(1).map((b) => b.split('</details>')[0]);
    for (const b of blocks) {
      expect(b).toContain('<div class="lq-answer">');
      expect(b).toContain('<h4>Decide this</h4>');
      expect((b.match(/<ul class="lq-check">([\s\S]*?)<\/ul>/)![1].match(/<li>/g) ?? []).length).toBeGreaterThanOrEqual(3);
      expect(b).toMatch(/<h4>Metric to watch<\/h4>\s*<p class="lq-metric">[^<]{10,}<\/p>/);
      expect(b).toMatch(/href="\/frameworks\/#[a-z-]+"/);
    }
  });

  it('mounts the seven tools, each labelled illustrative, with noscript fallbacks', () => {
    const h = lead();
    for (const t of ['funding', 'prioritizer', 'raci', 'planner', 'trust', 'threshold', 'control-room']) {
      expect(h).toContain(`<div data-lx="${t}"></div>`);
    }
    expect(h.match(/&middot; illustrative numbers<\/p>/g)).toHaveLength(7);
    expect(h.match(/<noscript>/g)?.length).toBeGreaterThanOrEqual(7);
    expect(h).toContain('Every number, threshold and ratio on this page is illustrative.');
  });

  it('links to the blueprints, architecture and controls pages and is linked from home and /book', () => {
    const h = lead();
    for (const href of ['/blueprints/', '/architecture/', '/controls/']) expect(h).toContain(`href="${href}"`);
    expect(html(byOut('index.html'))).toContain('href="/leaders/">Questions leaders ask</a>');
    expect(html(byOut('book/index.html'))).toContain('href="/leaders/">Questions leaders ask</a>');
  });

  it('keeps tool code local: no storage, cookies or network calls', () => {
    const js = readFileSync(join(DIST, 'assets/leaders.js'), 'utf8');
    expect(js).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB|fetch\(|XMLHttpRequest/);
    expect(js).not.toMatch(/https?:\/\//);
  });
});
