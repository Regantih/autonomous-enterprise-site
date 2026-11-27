import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error plain JS build script
import { BIO_LONG, BIO_SHORT, LINKEDIN_SHARE, PAGES, QUOTES, SITE_URL, build, wordCount } from '../scripts/build.mjs';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const OPENING_THESIS = 'Human-led, agent-operated: autonomy is earned when value compounds faster than risk.';
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

// The only place an organisation name may appear is the citation block on /blueprints/loops/.
const CITATION_PAGE = join(DIST, 'blueprints/loops/index.html');
const CITATION_BLOCK = /<section [^>]*data-citations[^>]*>[\s\S]*?<\/section>/;
function withoutCitations(file: string, text: string) {
  return file === CITATION_PAGE ? text.replace(CITATION_BLOCK, '') : text;
}

describe('built site', () => {
  it('produces every page plus sitemap, robots, 404, headers and favicons', () => {
    for (const f of ['index.html', 'speaking/index.html', 'blueprints/models/index.html', 'ideas/index.html', 'contact/index.html', '404.html',
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
      const t = withoutCitations(f, readFileSync(f, 'utf8'));
      expect(t.match(vendors)?.[0], f).toBeUndefined();
      expect(t).not.toContain('mailto:');
      expect(t.match(/\bGPT(?!-class)/)?.[0], f).toBeUndefined();
    }
    expect(html(pages[0]).match(/LangChain/g)?.length).toBeGreaterThan(0);
  });

  it('has no static forms anywhere: /contact and /speaking use the intake agent with a plain link fallback', () => {
    for (const p of pages) expect(html(p), p.out).not.toMatch(/<form[\s>]/);
    for (const out of ['contact/index.html', 'speaking/index.html']) {
      const h = html(byOut(out));
      expect(h, out).toContain('<div class="ik" data-intake hidden></div>');
      expect(h, out).toMatch(/<script src="\/assets\/intake\.js\?v=[0-9a-f]{10}" defer><\/script>/);
      expect(h, out).toContain('href="https://www.linkedin.com/in/hemanth-reganti-147153178/" rel="noopener" target="_blank">Message Hemanth on LinkedIn');
    }
    const contact = html(byOut('contact/index.html'));
    for (const id of ['speaking', 'advisory', 'media']) expect(contact).toContain(`<li id="${id}">`);
    for (const f of ['speaking-form', 'advisory-form', 'media-form']) expect(existsSync(join(DIST, '..', 'src', 'partials', `${f}.html`)), f).toBe(false);
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

  it('leads the header wordmark with the book: The Autonomous Enterprise, human-led and agent-operated, linking home', () => {
    for (const p of pages) {
      const header = html(p).match(/<header class="site-header">(.*?)<\/header>/s)![1];
      expect(header).toContain('<a class="brand" href="/" aria-label="The Autonomous Enterprise: human-led, agent-operated, home">');
      expect(header).toContain('<span class="brand-name">The Autonomous Enterprise</span> <span class="brand-sub">Human-led, agent-operated</span>');
      expect(header).not.toContain('Human-Led Enterprise');
    }
  });

  it('has Book, Blueprints, Ideas, Speaking & Advisory, About in the header, and Frameworks and Contact in the footer, on every page', () => {
    const labelsOf = (part: string) => [...part.matchAll(/<li><a href="(\/[^"]*)"[^>]*>([^<]+)<\/a><\/li>/g)].map((m) => [m[1], m[2]]);
    for (const p of pages) {
      const h = html(p);
      const nav = h.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)![0];
      expect(labelsOf(nav), p.out).toEqual([['/book/', 'Book'], ['/blueprints/', 'Blueprints'], ['/ideas/', 'Ideas'], ['/speaking/', 'Speaking &amp; Advisory'], ['/about/', 'About']]);
      expect(nav, p.out).not.toMatch(/Frameworks|Contact|\/advisory\//);
      const footer = labelsOf(h.match(/<footer[\s\S]*?<\/footer>/)![0]).slice(0, 7).map((l) => l[1]);
      expect(footer, p.out).toEqual(['Book', 'Frameworks', 'Blueprints', 'Ideas', 'Speaking &amp; Advisory', 'About', 'Contact']);
      expect(h, p.out).not.toContain('href="/advisory/"');
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

  it('features the thesis inside the book section on the home page, with the full set on /ideas', () => {
    const h = html(pages[0]);
    const book = h.match(/<section class="section" id="book"[\s\S]*?<\/section>/)![0];
    expect(book).toContain('Autonomy is earned when value compounds faster than risk.');
    expect(book).toContain('What&rsquo;s inside the book');
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
    expect(h).toContain('<div class="ik" data-intake hidden></div>');
  });

  it('merges advisory into /speaking/#advisory with the engagement steps and no prices, and redirects /advisory and /consulting', () => {
    const h = html(byOut('speaking/index.html'));
    expect(h).toContain('<h1 id="page-title">Speaking &amp; Advisory</h1>');
    expect(h).toContain('<section class="section" id="speaking" aria-labelledby="speaking-title">');
    expect(h).toContain('<section class="section section-paper-2" id="advisory" aria-labelledby="advisory-title">');
    expect(h).toContain('data-intake-preset="talk"');
    expect(h).toContain('data-intake-preset="advisory"');
    expect(h.match(/data-intake hidden/g)).toHaveLength(1);
    expect(h.match(/Alumnus of Harvard Business School/g)).toHaveLength(1);
    expect(existsSync(join(DIST, 'advisory'))).toBe(false);
    for (const s of ['Intro call', 'Readiness assessment', 'Roadmap and guardrails', 'How an engagement works']) expect(h).toContain(s);
    const main = h.match(/<main[\s\S]*?<\/main>/)![0].replace(/<section class="section section-orange[\s\S]*?<\/section>/, '');
    expect(main).not.toMatch(/\$\s?\d/);
    expect(h).toContain('<div class="ik" data-intake hidden></div>');
    expect(existsSync(join(DIST, 'consulting'))).toBe(false);
    const redirects = readFileSync(join(DIST, '_redirects'), 'utf8');
    for (const from of ['/consulting', '/consulting/', '/advisory', '/advisory/']) expect(redirects).toContain(`${from} /speaking/#advisory 301`);
    const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
    expect(sitemap).not.toContain('/advisory/');
    expect(sitemap).toContain('https://humanledenterprise.com/blueprints/models/');
  });

  it('has a press kit with a cover download and both bios', () => {
    const h = html(byOut('contact/index.html'));
    expect(h).toContain('id="press"');
    expect(h).toContain('href="/press/the-autonomous-enterprise-cover.jpg" download');
    expect(h).toContain(BIO_SHORT);
    expect(h).toContain(BIO_LONG);
  });
});

describe('site fitness functions', () => {
  const builtHtml = () => walk(DIST).filter((f) => f.endsWith('.html'));

  it('names no software vendor outside the one citation block, which exists only on /blueprints/loops/', () => {
    const vendors = /\b(SAP|Salesforce|OpenAI|Anthropic|Microsoft|Google|NVIDIA|Oracle|Workday|ServiceNow)\b/;
    for (const f of builtHtml()) {
      const t = readFileSync(f, 'utf8');
      if (f !== CITATION_PAGE) expect(t, f).not.toMatch(/data-citations/);
      expect(withoutCitations(f, t).match(vendors)?.[0], f).toBeUndefined();
    }
    const block = readFileSync(CITATION_PAGE, 'utf8').match(CITATION_BLOCK)![0];
    expect((block.match(/\bGoogle\b/g) ?? []).length).toBe(1);
    expect(block).not.toMatch(/\b(SAP|Salesforce|OpenAI|Anthropic|Microsoft|NVIDIA|Oracle|Workday|ServiceNow)\b/);
  });

  it('keeps the header nav to eight items or fewer', () => {
    for (const f of builtHtml()) {
      const header = readFileSync(f, 'utf8').match(/<nav class="site-nav"[\s\S]*?<\/nav>/);
      if (!header) continue;
      expect((header[0].match(/<li>/g) ?? []).length, f).toBeLessThanOrEqual(8);
    }
  });

  it('has no inline script, style attribute, style tag or inline event handler in any built HTML', () => {
    for (const f of builtHtml()) {
      const t = readFileSync(f, 'utf8');
      expect(t, f).not.toMatch(/\sstyle="/);
      expect(t, f).not.toMatch(/<style[\s>]/);
      expect(t, f).not.toMatch(/\son[a-z]+="/);
      for (const [tag] of t.matchAll(/<script\b[^>]*>/g)) expect(tag, f).toMatch(/src="\/|type="application\/ld\+json"/);
    }
  });

  it('gives every built page exactly one h1', () => {
    for (const f of builtHtml()) expect((readFileSync(f, 'utf8').match(/<h1[\s>]/g) ?? []).length, f).toBe(1);
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

  it('lays home out as one journey: pitch, the management problem answered, reimagine your operations, start from your role, the book, blueprints, speaking and advisory, the author', () => {
    const h = home();
    const order = ['hero-title', 'id="management"', 'id="reimagine"', 'id="start"', 'id="book"', 'id="blueprints"', 'id="speaking"', 'id="author"'].map((k) => h.indexOf(k));
    for (const i of order) expect(i).toBeGreaterThan(0);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const band = h.slice(order[7], h.indexOf('</section>', order[7]));
    expect(band).toContain('Author, speaker and advisor on human-led, agent-operated enterprises.');
    expect(band).toContain('href="/about/"');
  });

  it('gives each role on home a card with three numbered steps that open existing pages', () => {
    const h = home();
    const start = h.match(/<section class="section section-paper-2" id="start"[\s\S]*?<\/section>/)![0];
    const cards = [...start.matchAll(/<li class="role-card">\s*<h3>([^<]+)<\/h3>\s*<ol class="role-steps">([\s\S]*?)<\/ol>/g)];
    expect(cards.map((c) => c[1])).toEqual(['CEO or board', 'CFO or finance', 'CIO or technology', 'Risk or audit', 'Operations', 'Investor', 'New to agents']);
    const built = new Set(pages.map((p) => p.path));
    for (const [, role, steps] of cards) {
      const hrefs = [...steps.matchAll(/<li><a href="([^"]+)">/g)].map((m) => m[1]);
      expect(hrefs, role).toHaveLength(3);
      for (const href of hrefs) {
        const [path, hash] = href.split('#');
        expect(built.has(path), `${role}: ${href}`).toBe(true);
        if (hash) expect(html(pages.find((p) => p.path === path)!), `${role}: ${href}`).toContain(`id="${hash}"`);
      }
    }
  });

  it('keeps one primary action in each page body, and Buy on Amazon as the one on home', () => {
    for (const p of pages) {
      const main = html(p).split('<main')[1].split('</main>')[0];
      expect((main.match(/class="btn btn-primary/g) ?? []).length, p.out).toBeLessThanOrEqual(1);
    }
    const main = home().split('<main')[1].split('</main>')[0];
    expect(main.match(/class="btn btn-primary[^"]*"[^>]*>([^<]+)/)![1]).toBe('Buy on Amazon');
    expect((main.match(/>Talk to the book</g) ?? []).length).toBe(1);
  });

  it('answers the management problem under the pitch: five decisions, each with a question, a book answer, a chapter cite and a link to an existing blueprint section; the same five on /book', () => {
    const h = home();
    const sec = h.match(/<section class="section section-paper-2 mgmt" id="management"[\s\S]*?<\/section>/)![0];
    expect(sec).toContain('<h2 id="management-title">The management problem, answered</h2>');
    const cards = [...sec.matchAll(/<li class="mgmt-card">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    expect(cards).toHaveLength(5);
    const titles = cards.map((c) => c.match(/<\/span> ([^<]+)<\/h3>/)![1]);
    expect(titles).toEqual(['Where agents act', 'How far they&rsquo;re trusted', 'Who answers', 'How you stop them', 'Whether it pays']);
    const words = (s: string) => s.replace(/<[^>]+>/g, '').trim().split(/\s+/).length;
    const built = new Set(pages.map((p) => p.path));
    const book = html(byOut('book/index.html'));
    for (const c of cards) {
      expect(words(c.match(/<p class="mgmt-q">([^<]+)<\/p>/)![1])).toBeLessThanOrEqual(20);
      expect(words(c.match(/<p class="mgmt-a">([^<]+)<\/p>/)![1])).toBeLessThanOrEqual(25);
      expect(c).toMatch(/<span class="md-cite">Book, Ch \d{2}\.\d+<\/span>/);
      const href = c.match(/<a class="more" href="([^"]+)"/)![1];
      const [path, hash] = href.split('#');
      expect(built.has(path), href).toBe(true);
      expect(html(pages.find((p) => p.path === path)!), href).toContain(`id="${hash}"`);
      expect(book).toContain(`href="${href}"`);
    }
    expect(book).toContain('id="answer"');
    expect([...book.matchAll(/<ol class="mgmt-list">([\s\S]*?)<\/ol>/g)][0][1].match(/<li>/g)).toHaveLength(5);
  });

  it('keeps home to eight sections (the management answer, then Reimagine your operations, after the pitch) and moves the detail to /book', () => {
    const main = home().split('<main')[1].split('</main>')[0];
    expect(main.match(/<section /g)).toHaveLength(8);
    for (const id of ['problem', 'inside', 'audience']) {
      expect(main).not.toContain(`id="${id}"`);
      expect(html(byOut('book/index.html'))).toContain(`id="${id}"`);
    }
    expect(home()).toMatch(/<a class="btn btn-ghost" href="\/talk\/" data-guide-open>Talk to the book<\/a>/);
  });

  it('has one primary header CTA, Talk to the book, going to /talk/, on every page', () => {
    for (const p of pages) {
      const header = html(p).split('<header')[1].split('</header>')[0];
      expect(header.match(/btn-primary/g), p.out).toHaveLength(1);
      expect(header, p.out).toContain(`<a class="btn btn-primary header-cta" href="/talk/" data-guide-open${p.path === '/talk/' ? ' aria-current="page"' : ''}>Talk to the book</a>`);
    }
  });

  it('shows the floating Talk to the book button only where none is already in view: not on home, /talk, /contact or /reimagine (Discuss this with the book)', () => {
    for (const p of pages) {
      const h = html(p);
      expect(h, p.out).toContain('<script src="/assets/guide.js?v=');
      if (['/', '/talk/', '/contact/', '/reimagine/'].includes(p.path)) {
        expect(h, p.out).not.toContain('class="guide-fab"');
        expect(h, p.out).toContain('<body>');
      } else {
        expect(h, p.out).toContain('<a class="guide-fab" href="/talk/" data-guide-open');
        expect(h, p.out).toContain('<body class="has-fab">');
      }
    }
    expect(html(byOut('talk/index.html'))).toContain('data-guide-embed');
    const css = readFileSync(join(DIST, 'assets/styles.css'), 'utf8');
    expect(css).toMatch(/\.has-fab main \{ padding-bottom: [\d.]+rem; \}/);
  });

  it('has a compact, accessible menu button for small screens that needs no inline script', () => {
    for (const p of pages) {
      const header = html(p).split('<header')[1].split('</header>')[0];
      expect(header, p.out).toContain('<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" hidden>');
      expect(header, p.out).toContain('<nav class="site-nav" id="site-nav" aria-label="Main">');
    }
    const js = readFileSync(join(DIST, 'assets/site.js'), 'utf8');
    expect(js).toContain("btn.setAttribute('aria-expanded', open ? 'true' : 'false')");
    expect(js).toContain("e.key === 'Escape'");
    const css = readFileSync(join(DIST, 'assets/styles.css'), 'utf8');
    expect(css).toContain('.nav-ready .site-nav { display: none; }');
    expect(css).toContain('.nav-ready .site-nav.is-open { display: block;');
  });

  it('moves the workflow token along the drawn connectors and honours reduced motion live', () => {
    const js = readFileSync(join(DIST, 'assets/blueprints.js'), 'utf8');
    expect(js).toContain('function laneVia(A, B)');
    expect(js).toContain('moveToken(tok, prev, [p.cx, p.cy], via ? 700 : 550, live, via)');
    expect(js).toContain("host.scrollTo({ left: left, behavior: 'smooth' })");
    expect(js).toContain("reduceMq.addEventListener('change'");
  });

  it('renders the phone header collapsed before the deferred scripts run (no layout shift)', () => {
    for (const p of pages) {
      const head = html(p).split('</head>')[0];
      const early = head.indexOf('<script src="/assets/early.js?v=');
      expect(early, p.out).toBeGreaterThan(-1);
      expect(head.slice(early).split('>')[0], p.out).not.toContain('defer');
      expect(early, p.out).toBeLessThan(head.indexOf('/assets/styles.css'));
    }
    expect(readFileSync(join(DIST, 'assets/early.js'), 'utf8')).toContain("document.documentElement.classList.add('js')");
    const css = readFileSync(join(DIST, 'assets/styles.css'), 'utf8');
    expect(css).toContain('.js .site-header:not(.nav-ready) .site-nav { display: none; }');
    expect(css).toContain('.js .site-header:not(.nav-ready) .nav-toggle[hidden] { display: inline-flex; visibility: hidden; }');
  });

  it('keeps focused fields and anchors clear of the sticky header (scroll padding equals the header height)', () => {
    const css = readFileSync(join(DIST, 'assets/styles.css'), 'utf8');
    expect(css).toMatch(/html \{ scroll-padding-top: calc\(var\(--header-h\) \+ [\d.]+rem\); \}/);
    expect(css).toMatch(/:root \{ --header-h: [\d.]+rem; \}/);
  });

  it('greets once on /talk/: the thesis and the intro in a single bubble', () => {
    const js = readFileSync(join(DIST, 'assets/guide.js'), 'utf8');
    expect(js).toContain("this.bubble('guide', OPENING + '\\n\\n' + INTRO);");
    expect(js.match(/this\.bubble\('guide', (OPENING|INTRO)\)/g)).toBeNull();
  });

  it('keeps guide state in sessionStorage only and calls only the same-origin API', () => {
    const js = readFileSync(join(DIST, 'assets/guide.js'), 'utf8');
    expect(js).toContain('sessionStorage');
    expect(js).not.toMatch(/localStorage|document\.cookie|indexedDB/);
    expect(js).toContain("var API = '/api/guide'");
    expect(js.match(/https?:\/\/[^'" )]+/g)).toEqual(['https://www.amazon.com/dp/B0HS8HG6DP', 'https://www.linkedin.com/in/hemanth-reganti-147153178/']);
    // The old consent lead form is gone: the guide hands off to the intake agent, which asks for consent itself.
    expect(js).not.toContain('Share a summary of this chat with Hemanth');
    expect(js).not.toMatch(/createElement\('form'\)[\s\S]*type: 'email'|'guide-lead'/);
    expect(js).toContain('Nothing is sent until you tick consent and press Send.');
  });

  it('lets visitors type from the first turn: no disabled-input gate, role chips are optional and labelled', () => {
    const js = readFileSync(join(DIST, 'assets/guide.js'), 'utf8');
    expect(js).not.toContain('Choose an option above');
    expect(js).not.toMatch(/Where are your agents today/);
    expect(js).toContain('Optional: start from your role');
    expect(js).toMatch(/role: 'group', 'aria-labelledby': gid/);
    expect(js).toMatch(/'aria-label': item\[1\] \+ ': ask where to start'/);
    expect(js).toContain("el('label', { class: 'visually-hidden', for: inputId }, 'Ask the guide a question')");
    expect(js).toContain(OPENING_THESIS);
  });

  it('renders the tool trace as a labelled list with sources, pages, handoff and the cost meter', () => {
    const js = readFileSync(join(DIST, 'assets/guide.js'), 'utf8');
    expect(js).toContain('What the guide did');
    expect(js).toMatch(/el\('ol', \{ 'aria-labelledby': tid \}\)/);
    expect(js).toContain("'Tool step: '");
    expect(js).toContain("'From the book: '");
    expect(js).toContain("'Not in the book: '");
    expect(js).toContain("'aria-label': 'Suggested pages'");
    expect(js).toContain('with the intake agent');
    expect(js).toMatch(/AI call/);
  });

  it('publishes no email address on any built page or script', () => {
    for (const f of walk(DIST).filter((f) => /\.(html|js|xml|txt|json|webmanifest)$/.test(f))) {
      const t = readFileSync(f, 'utf8');
      expect(t, f).not.toContain('regantih@gmail.com');
      expect(t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/)?.[0], f).toBeUndefined();
    }
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
