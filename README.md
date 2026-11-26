# Human-Led Enterprise — humanledenterprise.com

Personal-brand site for Hemanth Reganti, author, speaker and advisor on human-led, agent-operated enterprises, built around his book *The Autonomous Enterprise: How Leaders Build, Govern, and Scale the Agent-Run Company*.

Pages: `/` (book-led home with the thesis quote and an ideas strip), `/ideas/` (quote cards with LinkedIn share links), `/speaking/` (topics, why book Hemanth, speaker kit with bios), `/advisory/` (services, how an engagement works), `/contact/` (Speaking, Advisory, Media & podcasts tabs, plus the press kit with cover download and bios). `/consulting` redirects to `/advisory/` (301, `src/static/_redirects`).

- Static HTML/CSS/JS in `dist/` (committed, so it deploys as-is), built from `src/` by a dependency-free script.
- One Cloudflare Pages Function, `functions/api/request.ts`, receives the speaking, advisory (`consultation`) and media forms, validates them server-side, drops honeypot submissions, rate-limits by hashed IP (5 per hour) and stores each request in Cloudflare D1 (binding `DB`).
- No analytics, trackers, cookies or third-party requests. Strict CSP and security headers in `src/static/_headers`.

## Deploy to Cloudflare Pages

Requires Node 20+ and a Cloudflare account. All commands run from the repo root.

```sh
npm ci
npx wrangler login

# 1. Create the D1 database, then copy the printed database_id into wrangler.toml
#    (replace REPLACE_ME under [[d1_databases]]).
npx wrangler d1 create autonomous-enterprise

# 2. Apply the schema to the remote database.
npx wrangler d1 execute autonomous-enterprise --remote --file=./schema.sql

# 3. Create the Pages project (first time only) and deploy.
npx wrangler pages project create autonomous-enterprise-site --production-branch main
npx wrangler pages deploy
```

`wrangler pages deploy` reads `wrangler.toml`: it uploads `dist/`, bundles `functions/` and attaches the D1 binding. The site is then live at `https://autonomous-enterprise-site.pages.dev`; attach `humanledenterprise.com` as below.

Optional: set a secret salt for the rate-limit IP hash.

```sh
npx wrangler pages secret put RATE_LIMIT_SALT --project-name autonomous-enterprise-site
```

### Custom domain

Canonical, Open Graph, sitemap, robots and JSON-LD URLs already point at `https://humanledenterprise.com` (the default `SITE_URL` in `scripts/build.mjs`). Add `humanledenterprise.com` (and optionally `www.humanledenterprise.com`) in the Cloudflare dashboard: Workers & Pages → the project → Custom domains.

To build for a different domain: `SITE_URL=https://www.example.com npm run build`, then commit `dist/` so CI's freshness check passes.

## Reading requests

```sh
npx wrangler d1 execute autonomous-enterprise --remote \
  --command "SELECT created_at, type, name, email, organization, role, details, status FROM requests ORDER BY created_at DESC LIMIT 50"

# Mark one handled
npx wrangler d1 execute autonomous-enterprise --remote \
  --command "UPDATE requests SET status = 'replied' WHERE id = '<id>'"
```

`details` is JSON with the form-specific fields:

| type | details keys |
| --- | --- |
| `speaking` | `event_name`, `event_date`, `delivery` (`in-person`/`virtual`), `location`, `audience_size`, `format`, `message` |
| `consultation` (advisory form) | `company_size`, `goals` (array), `timeline`, `message` |
| `media` | `topic`, `deadline`, `message` (the outlet is stored in the `organization` column; `role` is null) |

The `rate_limits` table only holds salted SHA-256 hashes of IPs for one hour.

## Local development

```sh
npm ci
npm run db:local      # apply schema.sql to the local D1
npm run build         # src/ -> dist/
npm run dev           # wrangler pages dev on http://localhost:8788 (site + /api/request + local D1)
```

Checks (also run in CI):

```sh
npm run typecheck
npm test              # validation, function handler, built-site checks (SEO, links, CSP, no vendor names)
npm run check:dist    # fails if dist/ is stale
```

## Editing

| What | Where |
| --- | --- |
| Page copy | `src/pages/*.html` |
| Header, footer, forms, shared sections | `src/partials/*.html` |
| Styles, form script | `src/assets/styles.css`, `src/assets/site.js` |
| Titles, descriptions, JSON-LD, sitemap | `scripts/build.mjs` |
| Ideas quotes, home strip, speaker/press bios | `QUOTES`, `STRIP`, `BIO_SHORT`, `BIO_LONG` in `scripts/build.mjs` |
| Redirects | `src/static/_redirects` |
| Validation rules | `lib/validate.ts` |

Run `npm run build` after any change and commit `dist/` with it.

### Replacing the cover

The cover is currently a typographic mock (`tools/cover-mock.html`). To use the real cover (any 2:3 image, at least 800×1200):

```sh
python3 tools/make-images.py path/to/cover.jpg   # needs Pillow and Google Chrome
npm run build
```

This regenerates `cover-400/800` (WebP + JPEG), the press download `src/static/press/the-autonomous-enterprise-cover.jpg` (1600×2400 when the source is that large), the 1200×630 Open Graph image and the icons.

## Licences

Oswald font: SIL Open Font License (`src/assets/fonts/OFL-Oswald.txt`).
