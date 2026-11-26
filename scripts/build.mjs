// Builds the static site from src/ into dist/. No dependencies; deterministic output.
// SITE_URL sets canonical/Open Graph/sitemap URLs (default: the Cloudflare Pages domain).
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
export const SITE_URL = (process.env.SITE_URL || 'https://autonomous-enterprise-site.pages.dev').replace(/\/+$/, '');

const AMAZON_PAPERBACK = 'https://www.amazon.com/dp/B0HS8HG6DP';
const AMAZON_KINDLE = 'https://www.amazon.com/dp/B0HS8C4WLL';
const LINKEDIN = 'https://www.linkedin.com/in/hemanth-reganti-147153178/';

const BASE_DESCRIPTION =
  'The Autonomous Enterprise by Hemanth Reganti: how leaders build, govern, and scale the agent-run company. Human-led, agent-operated.';

export const PAGES = [
  {
    src: 'index.html', out: 'index.html', path: '/',
    title: 'The Autonomous Enterprise | How Leaders Build, Govern, and Scale the Agent-Run Company',
    ogTitle: 'The Autonomous Enterprise by Hemanth Reganti',
    description:
      'Frameworks solve the engineering problem of AI agents. This book solves the management problem: autonomy levels, guardrails, governance and a roadmap for the agent-run company.',
    ogType: 'book', jsonld: true, sitemap: true, priority: '1.0',
  },
  {
    src: 'speaking.html', out: 'speaking/index.html', path: '/speaking/', nav: 'SPEAKING',
    title: 'Speaking | Hemanth Reganti, The Autonomous Enterprise',
    description:
      'Book Hemanth Reganti for a keynote, panel, fireside chat or workshop on managing and governing the agent-run company. In person (Dallas–Fort Worth) or virtual.',
    sitemap: true, priority: '0.8',
  },
  {
    src: 'consulting.html', out: 'consulting/index.html', path: '/consulting/', nav: 'CONSULTING',
    title: 'Consulting | Hemanth Reganti, The Autonomous Enterprise',
    description:
      'Advisory for leadership teams starting or scaling AI agents: autonomy readiness assessment, governance and guardrail design, operating-model changes, business case and 30-month roadmap.',
    sitemap: true, priority: '0.8',
  },
  {
    src: 'contact.html', out: 'contact/index.html', path: '/contact/', nav: 'CONTACT',
    title: 'Contact | Hemanth Reganti, The Autonomous Enterprise',
    description: 'Request a talk or a consultation with Hemanth Reganti, author of The Autonomous Enterprise.',
    sitemap: true, priority: '0.6',
  },
  {
    src: 'thanks.html', out: 'thanks/index.html', path: '/thanks/',
    title: 'Thank you | The Autonomous Enterprise', description: BASE_DESCRIPTION, robots: 'noindex, follow',
  },
  {
    src: '404.html', out: '404.html', path: '/404.html',
    title: 'Page not found | The Autonomous Enterprise', description: BASE_DESCRIPTION, robots: 'noindex, follow',
  },
];

const read = (p) => readFileSync(p, 'utf8');
const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);

function assetUrl(rel) {
  return `/assets/${rel}?v=${hash(readFileSync(join(SRC, 'assets', rel)))}`;
}

function coverPicture({ priority }) {
  const loading = priority ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"';
  return `<picture>
        <source type="image/webp" srcset="${assetUrl('images/cover-400.webp')} 400w, ${assetUrl('images/cover-800.webp')} 800w" sizes="(min-width: 56rem) 22rem, 70vw">
        <img class="cover-img" src="${assetUrl('images/cover-800.jpg')}" srcset="${assetUrl('images/cover-400.jpg')} 400w, ${assetUrl('images/cover-800.jpg')} 800w" sizes="(min-width: 56rem) 22rem, 70vw" width="800" height="1200" alt="Cover of The Autonomous Enterprise: How Leaders Build, Govern, and Scale the Agent-Run Company, by Hemanth Reganti" ${loading}>
      </picture>`;
}

function jsonLd() {
  const person = {
    '@type': 'Person',
    '@id': `${SITE_URL}/#author`,
    name: 'Hemanth Reganti',
    jobTitle: 'Enterprise finance and solution architect',
    description:
      'Enterprise finance and solution architect and author. Co-author of "AI Powered Decision Making" (Apress, 2026).',
    url: `${SITE_URL}/#about`,
    sameAs: [LINKEDIN],
    alumniOf: [
      { '@type': 'EducationalOrganization', name: 'MIT Sloan School of Management' },
      { '@type': 'EducationalOrganization', name: 'Harvard Business School' },
    ],
    memberOf: { '@type': 'Organization', name: 'GoingVC' },
  };
  const book = {
    '@type': 'Book',
    '@id': `${SITE_URL}/#book`,
    name: 'The Autonomous Enterprise',
    alternativeHeadline: 'How Leaders Build, Govern, and Scale the Agent-Run Company',
    description:
      'Frameworks like LangChain solve the engineering problem of AI agents. This book solves the management problem.',
    author: { '@id': `${SITE_URL}/#author` },
    inLanguage: 'en',
    bookEdition: 'First edition',
    datePublished: '2026-11',
    image: `${SITE_URL}/assets/images/cover-800.jpg`,
    url: `${SITE_URL}/`,
    workExample: [
      {
        '@type': 'Book',
        bookFormat: 'https://schema.org/Paperback',
        isbn: '9798142205612',
        numberOfPages: 742,
        offers: { '@type': 'Offer', price: '59.99', priceCurrency: 'USD', url: AMAZON_PAPERBACK, availability: 'https://schema.org/InStock' },
      },
      {
        '@type': 'Book',
        bookFormat: 'https://schema.org/EBook',
        offers: { '@type': 'Offer', price: '12.99', priceCurrency: 'USD', url: AMAZON_KINDLE, availability: 'https://schema.org/InStock' },
      },
    ],
  };
  const site = { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'The Autonomous Enterprise', url: `${SITE_URL}/` };
  const graph = { '@context': 'https://schema.org', '@graph': [book, person, site] };
  return `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>\n`;
}

function expandPartials(html, depth = 0) {
  if (depth > 10) throw new Error('Partial nesting too deep');
  return html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    const p = join(SRC, 'partials', `${name}.html`);
    if (!existsSync(p)) throw new Error(`Missing partial: ${name}`);
    return expandPartials(read(p).trimEnd(), depth + 1);
  });
}

function fill(html, vars) {
  const out = html.replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => (key in vars ? vars[key] : m));
  const left = out.match(/\{\{[^}]*\}\}/);
  if (left) throw new Error(`Unfilled placeholder ${left[0]}`);
  return out;
}

export function build() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  cpSync(join(SRC, 'assets'), join(DIST, 'assets'), { recursive: true });
  for (const f of readdirSync(join(SRC, 'static'))) cpSync(join(SRC, 'static', f), join(DIST, f));

  const layout = read(join(SRC, 'partials', 'layout.html'));
  const assetVersion = hash(read(join(SRC, 'assets', 'styles.css')) + read(join(SRC, 'assets', 'site.js')));

  for (const page of PAGES) {
    const body = expandPartials(read(join(SRC, 'pages', page.src)).trim());
    const vars = {
      TITLE: page.title,
      OG_TITLE: page.ogTitle || page.title,
      DESCRIPTION: page.description,
      ROBOTS: page.robots || 'index, follow',
      CANONICAL: `${SITE_URL}${page.path}`,
      OG_TYPE: page.ogType || 'website',
      SITE_URL,
      ASSET_VERSION: assetVersion,
      JSONLD: page.jsonld ? jsonLd() : '',
      HEAD_EXTRA: page.src === 'index.html'
        ? `<link rel="preload" as="image" type="image/webp" imagesrcset="${assetUrl('images/cover-400.webp')} 400w, ${assetUrl('images/cover-800.webp')} 800w" imagesizes="(min-width: 56rem) 22rem, 70vw" fetchpriority="high">\n`
        : '',
      NAV_SPEAKING: page.nav === 'SPEAKING' ? ' aria-current="page"' : '',
      NAV_CONSULTING: page.nav === 'CONSULTING' ? ' aria-current="page"' : '',
      NAV_CONTACT: page.nav === 'CONTACT' ? ' aria-current="page"' : '',
      COVER_HERO: coverPicture({ priority: true }),
      COVER_BOOK: coverPicture({ priority: false }),
    };
    const html = fill(expandPartials(layout).replace('{{BODY}}', body), vars);
    const outPath = join(DIST, page.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html);
  }

  const urls = PAGES.filter((p) => p.sitemap)
    .map((p) => `  <url>\n    <loc>${SITE_URL}${p.path}</loc>\n    <priority>${p.priority}</priority>\n  </url>`)
    .join('\n');
  writeFileSync(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
  writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /thanks/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  return relative(ROOT, DIST);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(`Built ${build()} for ${SITE_URL}`);
}
