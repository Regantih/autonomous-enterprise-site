# Human-Led Enterprise — humanledenterprise.com

Personal-brand site for Hemanth Reganti, author, speaker and advisor on human-led, agent-operated enterprises, built around his book *The Autonomous Enterprise: How Leaders Build, Govern, and Scale the Agent-Run Company*.

Pages: `/` (book-led home with the thesis quote and an ideas strip), `/ideas/` (quote cards with LinkedIn share links), `/speaking/` (topics, why book Hemanth, speaker kit with bios), `/advisory/` (services, how an engagement works), `/contact/` (Speaking, Advisory, Media & podcasts tabs, plus the press kit with cover download and bios). `/consulting` redirects to `/advisory/` (301, `src/static/_redirects`).

- Static HTML/CSS/JS in `dist/` (committed, so it deploys as-is), built from `src/` by a dependency-free script.
- One Cloudflare Pages Function, `functions/api/request.ts`, receives the speaking, advisory (`consultation`) and media forms, validates them server-side, drops honeypot submissions, rate-limits by hashed IP (5 per hour) and stores each request in Cloudflare D1 (binding `DB`).
- No analytics, trackers, cookies or third-party requests. Strict CSP and security headers in `src/static/_headers`.

## Deploy to Cloudflare Pages

The Pages project `humanledenterprise` (https://humanledenterprise.pages.dev) deploys automatically on every push to `main`. It serves the committed `dist/`, bundles `functions/` and reads its bindings from `wrangler.toml`:

| Binding | Type | Used by |
| --- | --- | --- |
| `DB` | D1 database `autonomous-enterprise` | `/api/request`, `/api/guide` (leads + rate limits) |
| `AI` | Workers AI | `/api/guide` ("Talk to the book") |

Because `wrangler.toml` contains `pages_build_output_dir`, Cloudflare treats it as the source of truth for the project's bindings; nothing needs adding in the dashboard. If the dashboard shows the bindings as editable and `/api/guide` returns the fallback message, add them there too (Settings → Bindings: D1 `DB`, Workers AI `AI`).

Database changes ship as migrations. Apply them to the remote database after pulling a change that adds one:

```sh
npm ci
npx wrangler login
npm run db:migrate:remote   # applies migrations/ in order; 0001 is a no-op on a database created from schema.sql
```

`0002_conversation.sql` adds the `conversation` request type used by the guide. Until it is applied, guide chat works but "Talk with Hemanth" submissions from the chat fail.

Optional: set a secret salt for the rate-limit IP hash.

```sh
npx wrangler pages secret put RATE_LIMIT_SALT --project-name humanledenterprise
```

To set up a fresh project instead: `npx wrangler d1 create autonomous-enterprise`, put the printed `database_id` in `wrangler.toml`, run `npm run db:migrate:remote`, then connect the repo in Workers & Pages (build command empty, output directory `dist`).

## Talk to the book

`functions/api/guide.ts` runs `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (falling back to `@cf/meta/llama-3.1-8b-instruct`) on Workers AI. The system prompt (`lib/guide.ts`) embeds `content/agent-knowledge.md`, which `npm run build` copies into `lib/knowledge.generated.ts`; edit the Markdown and rebuild to change what the guide knows.

Limits: 30 guide calls per IP hash per hour, 12 visitor turns per conversation, the last 8 messages sent to the model, 350 output tokens, replies trimmed to 90 words. Chat state lives in the visitor's `sessionStorage`; nothing is stored unless they submit the in-chat form with the consent box ticked, which saves a `conversation` request with a model-written summary.

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
| `conversation` (from the guide) | `role`, `maturity`, `goal`, `summary` (≤120-word model summary of the chat) |

The `rate_limits` table only holds salted SHA-256 hashes of IPs for one hour.

## Local development

```sh
npm ci
npm run db:migrate:local   # apply migrations/ to the local D1
npm run build         # src/ -> dist/
npm run dev           # wrangler pages dev on http://localhost:8788 (site, /api/request, /api/guide, local D1; Workers AI calls need `wrangler login`)
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
| Styles, form script, guide UI | `src/assets/styles.css`, `src/assets/site.js`, `src/assets/guide.js` |
| Guide knowledge, prompt | `content/agent-knowledge.md`, `lib/guide.ts` |
| Titles, descriptions, JSON-LD, sitemap | `scripts/build.mjs` |
| Ideas quotes, home strip, speaker/press bios | `QUOTES`, `STRIP`, `BIO_SHORT`, `BIO_LONG` in `scripts/build.mjs` |
| Redirects | `src/static/_redirects` |
| Validation rules | `lib/validate.ts` |

Run `npm run build` after any change and commit `dist/` with it.

### Images

Source images live in `src/assets/images/source/` (`cover-real-1600x2560.jpg`, `hemanth-portrait.jpg`). After replacing either:

```sh
python3 tools/make-images.py   # needs Pillow (and Chrome for the Open Graph image)
npm run build
```

This regenerates `cover-400/800` and `portrait-480/960` (WebP + JPEG), the press downloads in `src/static/press/`, the 1200×630 Open Graph image and the icons.

## Licences

Oswald font: SIL Open Font License (`src/assets/fonts/OFL-Oswald.txt`).
