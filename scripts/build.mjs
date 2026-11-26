// Builds the static site from src/ into dist/. No dependencies; deterministic output.
// SITE_URL sets canonical/Open Graph/sitemap URLs (default: https://humanledenterprise.com).
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
export const SITE_URL = (process.env.SITE_URL || 'https://humanledenterprise.com').replace(/\/+$/, '');

const AMAZON_PAPERBACK = 'https://www.amazon.com/dp/B0HS8HG6DP';
const AMAZON_KINDLE = 'https://www.amazon.com/dp/B0HS8C4WLL';
const LINKEDIN = 'https://www.linkedin.com/in/hemanth-reganti-147153178/';
export const SITE_NAME = 'Human-Led Enterprise';
export const LINKEDIN_SHARE = 'https://www.linkedin.com/sharing/share-offsite/?url=https://humanledenterprise.com/ideas';

// Verbatim from the book. QUOTES[0] is the thesis; STRIP picks the home-page strip.
export const QUOTES = [
  'Autonomy is earned when value compounds faster than risk.',
  'The harness, not the model, sets the autonomy ceiling.',
  'Agents decide; deterministic rules post.',
  'Human-led, agent-operated: people set intent, own outcomes and decide where not to automate.',
  'A board that funds agents first and data second pays twice.',
  'A modest model inside a strong harness can run a narrow step at L3 safely.',
  'The model is the most flexible part and the least trusted; the safety controller is the least flexible and the most trusted.',
  'An agent optimizes its target harder and more literally than a person.',
  'An agent can act thousands of times before a monthly review.',
  'The unit that moves to an agent is a decision inside a task.',
  'The agent removes the investigation, not the person.',
  'The weakest maturity dimension caps the autonomy allowed.',
  "The person who approves an agent's actions may not change the agent's limits, instructions or tools.",
];
const STRIP = [3, 4, 8, 10, 11];

// Book-focused bios (owner, Nov 25, 2026: keep focus on the book).
export const BIO_SHORT =
  'Hemanth Reganti is the author of The Autonomous Enterprise: How Leaders Build, Govern, and Scale the Agent-Run Company, a field guide for leaders deciding where AI agents can act, who owns decisions and how autonomy is earned. He writes, speaks and advises on the human-led, agent-operated enterprise. He is an alumnus of Harvard Business School.';
export const BIO_LONG =
  'Hemanth Reganti is the author of The Autonomous Enterprise: How Leaders Build, Govern, and Scale the Agent-Run Company (first edition, November 2026). The book is a vendor-neutral field guide for leaders who must decide where AI agents can act, how far they are trusted and who is accountable when they get it wrong. Its central idea is human-led, agent-operated: people set intent and own outcomes, agents do the work inside limits people control, and autonomy is earned when value compounds faster than risk. Hemanth speaks to boards and leadership teams and advises companies starting or scaling AI agents on governance, guardrails and the operating model they need. He is an alumnus of Harvard Business School.';
export const wordCount = (t) => t.split(/\s+/).filter(Boolean).length;

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&rsquo;');

function quoteCard(i, { tag = 'li' } = {}) {
  return `<${tag} class="quote-card${i === 0 ? ' quote-thesis' : ''}">
        <figure>
          <blockquote><p>${esc(QUOTES[i])}</p></blockquote>
          <figcaption>&mdash; <cite>The Autonomous Enterprise</cite></figcaption>
        </figure>
        <a class="share" href="${LINKEDIN_SHARE}" rel="noopener" target="_blank">Share on LinkedIn<span class="visually-hidden">: &ldquo;${esc(QUOTES[i])}&rdquo; (opens in a new tab)</span></a>
      </${tag}>`;
}

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
    title: 'Speaking | Hemanth Reganti | Human-Led Enterprise',
    description:
      'Book Hemanth Reganti for a keynote, panel, fireside chat or workshop on managing and governing the agent-run company. In person (Dallas–Fort Worth) or virtual.',
    sitemap: true, priority: '0.8',
  },
  {
    src: 'frameworks.html', out: 'frameworks/index.html', path: '/frameworks/', nav: 'FRAMEWORKS',
    title: 'Frameworks from The Autonomous Enterprise | Human-Led Enterprise',
    description:
      'The core frameworks of The Autonomous Enterprise explained: the L0 to L5 autonomy scale, the harness, the weakest-link rule, cost per completed outcome, when not to automate and the 30-month plan.',
    sitemap: true, priority: '0.9',
  },
  {
    src: 'ideas.html', out: 'ideas/index.html', path: '/ideas/', nav: 'IDEAS',
    title: 'Ideas from The Autonomous Enterprise | Human-Led Enterprise',
    description:
      'Ideas from The Autonomous Enterprise by Hemanth Reganti: autonomy is earned when value compounds faster than risk. Human-led, agent-operated.',
    sitemap: true, priority: '0.8',
  },
  {
    src: 'advisory.html', out: 'advisory/index.html', path: '/advisory/', nav: 'ADVISORY',
    title: 'Advisory | Hemanth Reganti | Human-Led Enterprise',
    description:
      'Advisory for leadership teams starting or scaling AI agents: autonomy readiness assessment, governance and guardrail design, operating-model changes, business case and 30-month roadmap.',
    sitemap: true, priority: '0.8',
  },
  {
    src: 'contact.html', out: 'contact/index.html', path: '/contact/', nav: 'CONTACT',
    title: 'Contact | Hemanth Reganti | Human-Led Enterprise',
    description: 'Book a talk, request advisory, or arrange a media or podcast interview with Hemanth Reganti, author of The Autonomous Enterprise. Press kit and bios.',
    sitemap: true, priority: '0.6',
  },
  {
    src: 'book.html', out: 'book/index.html', path: '/book/', nav: 'BOOK',
    title: 'The Book | The Autonomous Enterprise by Hemanth Reganti',
    description:
      'Inside The Autonomous Enterprise: the L0 to L5 autonomy scale, guardrails, domain chapters, business case and a 30-month roadmap. Who it is for and where to buy.',
    sitemap: true, priority: '0.9',
  },
  {
    src: 'about.html', out: 'about/index.html', path: '/about/', nav: 'ABOUT',
    title: 'About Hemanth Reganti | Human-Led Enterprise',
    description:
      'Hemanth Reganti: author of The Autonomous Enterprise, speaker and advisor on human-led, agent-operated enterprises.',
    sitemap: true, priority: '0.7',
  },
  {
    src: 'talk.html', out: 'talk/index.html', path: '/talk/', nav: 'TALK',
    title: 'Talk to the Book | The Autonomous Enterprise',
    description:
      'A short guided conversation on the core idea of The Autonomous Enterprise: autonomy is earned when value compounds faster than risk. Tailored to your role.',
    sitemap: true, priority: '0.7',
  },
  {
    src: 'thanks.html', out: 'thanks/index.html', path: '/thanks/',
    title: 'Thank you | Human-Led Enterprise', description: BASE_DESCRIPTION, robots: 'noindex, follow',
  },
  {
    src: '404.html', out: '404.html', path: '/404.html',
    title: 'Page not found | Human-Led Enterprise', description: BASE_DESCRIPTION, robots: 'noindex, follow',
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
        <source type="image/webp" srcset="${assetUrl('images/cover-400.webp')} 400w, ${assetUrl('images/cover-800.webp')} 800w, ${assetUrl('images/cover-1200.webp')} 1200w" sizes="(min-width: 56rem) 30rem, 82vw">
        <img class="cover-img" src="${assetUrl('images/cover-800.jpg')}" srcset="${assetUrl('images/cover-400.jpg')} 400w, ${assetUrl('images/cover-800.jpg')} 800w, ${assetUrl('images/cover-1200.jpg')} 1200w" sizes="(min-width: 56rem) 30rem, 82vw" width="800" height="1280" alt="Cover of The Autonomous Enterprise: How Leaders Build, Govern, and Scale the Agent-Run Company, by Hemanth Reganti" ${loading}>
      </picture>`;
}

const PORTRAIT_ALT = 'Hemanth Reganti, author of The Autonomous Enterprise, in a blue suit, speaking at a podium';

function portraitPicture(sizes) {
  return `<picture>
        <source type="image/webp" srcset="${assetUrl('images/portrait-480.webp')} 480w, ${assetUrl('images/portrait-960.webp')} 960w" sizes="${sizes}">
        <img class="portrait-img" src="${assetUrl('images/portrait-960.jpg')}" srcset="${assetUrl('images/portrait-480.jpg')} 480w, ${assetUrl('images/portrait-960.jpg')} 960w" sizes="${sizes}" width="960" height="1200" alt="${PORTRAIT_ALT}" loading="lazy" decoding="async">
      </picture>`;
}

function jsonLd() {
  const person = {
    '@type': 'Person',
    '@id': `${SITE_URL}/#author`,
    name: 'Hemanth Reganti',
    jobTitle: 'Author, speaker and advisor',
    knowsAbout: ['Human-led, agent-operated enterprises', 'AI agent governance', 'Enterprise autonomy'],
    description:
      'Author of "The Autonomous Enterprise" and speaker and advisor on human-led, agent-operated enterprises.',
    url: `${SITE_URL}/about/`,
    image: { '@type': 'ImageObject', url: `${SITE_URL}/assets/images/portrait-960.jpg`, width: 960, height: 1200, caption: 'Hemanth Reganti' },
    sameAs: [LINKEDIN],
    alumniOf: [
      { '@type': 'EducationalOrganization', name: 'Harvard Business School' },
    ],
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
  const site = { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: SITE_NAME, url: `${SITE_URL}/`, publisher: { '@id': `${SITE_URL}/#author` } };
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

// Bundle the guide's knowledge pack into the Pages Function at build time.
export const KNOWLEDGE_SRC = join(ROOT, 'content', 'agent-knowledge.md');
export const KNOWLEDGE_OUT = join(ROOT, 'lib', 'knowledge.generated.ts');

function writeKnowledge() {
  const md = read(KNOWLEDGE_SRC).trim();
  writeFileSync(
    KNOWLEDGE_OUT,
    `// Generated by scripts/build.mjs from content/agent-knowledge.md. Do not edit.\nexport const KNOWLEDGE = ${JSON.stringify(md)};\n`,
  );
}

export function build() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  cpSync(join(SRC, 'assets'), join(DIST, 'assets'), { recursive: true, filter: (f) => !f.includes(`${join('images', 'source')}`) });
  writeKnowledge();
  for (const f of readdirSync(join(SRC, 'static'))) cpSync(join(SRC, 'static', f), join(DIST, f), { recursive: true });

  const layout = read(join(SRC, 'partials', 'layout.html'));
  const assetVersion = hash(['styles.css', 'site.js', 'guide.js'].map((f) => read(join(SRC, 'assets', f))).join(''));

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
        ? `<link rel="preload" as="image" type="image/webp" imagesrcset="${assetUrl('images/cover-400.webp')} 400w, ${assetUrl('images/cover-800.webp')} 800w, ${assetUrl('images/cover-1200.webp')} 1200w" imagesizes="(min-width: 56rem) 30rem, 82vw" fetchpriority="high">\n`
        : '',
      NAV_SPEAKING: page.nav === 'SPEAKING' ? ' aria-current="page"' : '',
      NAV_IDEAS: page.nav === 'IDEAS' ? ' aria-current="page"' : '',
      NAV_FRAMEWORKS: page.nav === 'FRAMEWORKS' ? ' aria-current="page"' : '',
      NAV_ADVISORY: page.nav === 'ADVISORY' ? ' aria-current="page"' : '',
      NAV_CONTACT: page.nav === 'CONTACT' ? ' aria-current="page"' : '',
      NAV_BOOK: page.nav === 'BOOK' ? ' aria-current="page"' : '',
      NAV_ABOUT: page.nav === 'ABOUT' ? ' aria-current="page"' : '',
      GUIDE_FAB: page.nav === 'TALK' ? '' : read(join(SRC, 'partials', 'guide-fab.html')).trimEnd(),
      PORTRAIT_BAND: portraitPicture('(min-width: 56rem) 34rem, 90vw'),
      PORTRAIT_SPEAKING: portraitPicture('(min-width: 56rem) 26rem, 90vw'),
      PORTRAIT_ABOUT: portraitPicture('(min-width: 56rem) 32rem, 90vw'),
      PORTRAIT_THUMB: assetUrl('images/portrait-480.jpg'),
      COVER_HERO: coverPicture({ priority: true }),
      COVER_BOOK: coverPicture({ priority: false }),
      COVER_THUMB: assetUrl('images/cover-400.jpg'),
      SITE_NAME,
      THESIS: quoteCard(0, { tag: 'div' }),
      QUOTES_ALL: QUOTES.map((_, i) => quoteCard(i)).join('\n      '),
      QUOTES_STRIP: STRIP.map((i) => quoteCard(i)).join('\n      '),
      BIO_SHORT, BIO_LONG,
      BIO_SHORT_WORDS: String(wordCount(BIO_SHORT)),
      BIO_LONG_WORDS: String(wordCount(BIO_LONG)),
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
