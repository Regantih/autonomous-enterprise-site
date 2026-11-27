import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error plain JS build script
import { PAGES, SITE_URL, build } from '../scripts/build.mjs';
// @ts-expect-error plain JS build script
import { agentLevels, deptCountLabel, loadTeam, teamCounts } from '../scripts/team-static.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const ASSETS = join(ROOT, 'src', 'assets');
const html = () => readFileSync(join(DIST, 'blueprints/team/index.html'), 'utf8');
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
type Task = { t: string; l: number | [number, number] | null; c: string };
type Agent = {
  id: string; dept: string; kind?: string; name: string; does: string; inputs: string[]; outputs: string[];
  owner: string; approver: string; up: string; down: string; cannot: string[]; limits: string[]; kill: string;
  kpis: string[]; exception: string; cite: string; refs: string[]; tasks: Task[];
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: { levels: { l: number; name: string }[]; depts: { id: string; name: string; cite: string }[]; agents: Agent[] } = loadTeam(ASSETS) as any;
const CITE = /^Ch \d{2}(\.\d+){0,3}$/;
const DOMAIN_CHAPTERS: Record<string, string> = { r2r: '12', cash: '13', proc: '14', scm: '15', front: '16', people: '16', it: '17', tax: '18', ehs: '19', legal: '20' };
const VENDORS = /\b(SAP|S\/4HANA|Oracle|Fusion|Microsoft|Business Central|Dynamics|Salesforce|Agentforce|Service Cloud|ServiceNow|Workday|Coupa|Ariba|Zip|Kyriba|HighRadius|BlackLine|NetSuite|Shopify|Maximo|IBM|Google|AWS|Azure|OpenAI|Anthropic|Claude|Gemini|Copilot|Joule|Teams|Slack|Avalara|Vertex|Siemens|NVIDIA|Holcim|McKinsey|Gartner|PYMNTS|Gravitee|Avant-Garde|Avant Garde)\b/;

beforeAll(() => {
  build();
});

describe('agent operations team data', () => {
  it('defines the six levels L0 to L5 and eleven departments: ten domain chapters plus the cross-cutting harness', () => {
    expect(T.levels.map((l) => l.l)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(T.depts.map((d) => d.id)).toEqual([...Object.keys(DOMAIN_CHAPTERS), 'harness']);
    for (const d of T.depts) {
      if (DOMAIN_CHAPTERS[d.id]) expect(d.cite, d.id).toBe(`Ch ${DOMAIN_CHAPTERS[d.id]}`);
      expect(T.agents.some((a) => a.dept === d.id), d.id).toBe(true);
    }
  });

  it('gives every agent and role a unique id, a known department and kind, and every schema field', () => {
    const ids = T.agents.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const depts = new Set(T.depts.map((d) => d.id));
    for (const a of T.agents) {
      expect(a.id, a.id).toMatch(/^[a-z0-9-]+$/);
      expect(depts.has(a.dept), a.id).toBe(true);
      expect(['agent', 'role']).toContain(a.kind ?? 'agent');
      for (const k of ['name', 'does', 'owner', 'approver', 'up', 'down', 'kill', 'exception', 'cite'] as const) expect(typeof a[k], `${a.id} ${k}`).toBe('string');
      for (const k of ['inputs', 'outputs', 'cannot', 'limits', 'kpis', 'refs', 'tasks'] as const) expect(Array.isArray(a[k]), `${a.id} ${k}`).toBe(true);
      expect(a.name.length, a.id).toBeGreaterThan(3);
      expect(words(a.does), `${a.id} does`).toBeLessThanOrEqual(25);
      expect(words(a.does), `${a.id} does`).toBeGreaterThan(5);
    }
  });

  it('cites a chapter and section for every agent, role and task, and keeps domain agents in their own chapter', () => {
    for (const a of T.agents) {
      expect(a.cite, a.id).toMatch(CITE);
      for (const r of a.refs) expect(r, a.id).toMatch(CITE);
      for (const t of a.tasks) expect(t.c, `${a.id}: ${t.t}`).toMatch(CITE);
      if (DOMAIN_CHAPTERS[a.dept]) expect(a.cite.slice(3, 5), a.id).toBe(DOMAIN_CHAPTERS[a.dept]);
    }
  });

  it('names a human owner and approver for every agent, and what it cannot do', () => {
    for (const a of T.agents.filter((x) => (x.kind ?? 'agent') === 'agent')) {
      expect(a.owner.length, a.id).toBeGreaterThan(3);
      expect(a.approver.length, a.id).toBeGreaterThan(3);
      expect(a.cannot.length, a.id).toBeGreaterThan(0);
      expect(a.exception.length, a.id).toBeGreaterThan(5);
      expect(a.tasks.length, a.id).toBeGreaterThan(0);
    }
  });

  it('tags every task with a level from L0 to L5, a valid range, or null when the book states none', () => {
    let stated = 0;
    for (const a of T.agents) for (const t of a.tasks) {
      expect(t.t.length, a.id).toBeGreaterThan(5);
      if (t.l === null) continue;
      stated++;
      if (Array.isArray(t.l)) {
        expect(t.l, `${a.id}: ${t.t}`).toHaveLength(2);
        expect(t.l[0] < t.l[1] && t.l[0] >= 0 && t.l[1] <= 5, `${a.id}: ${t.t}`).toBe(true);
      } else expect(Number.isInteger(t.l) && t.l >= 0 && t.l <= 5, `${a.id}: ${t.t}`).toBe(true);
    }
    // Most tasks carry a level the book states.
    expect(stated / T.agents.reduce((n, a) => n + a.tasks.length, 0)).toBeGreaterThan(0.7);
    // No task is L5: the book calls it a boundary marker, not a target.
    for (const a of T.agents) expect(agentLevels(a), a.id).not.toContain(5);
  });

  it('names no vendor, product or employer anywhere in the data or the page', () => {
    const data = readFileSync(join(ASSETS, 'data/team.js'), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//, '');
    expect(data.match(VENDORS)?.[0]).toBeUndefined();
    const h = html();
    expect(h.match(VENDORS)?.[0]).toBeUndefined();
    expect(h.match(/\bGPT(?!-class)/)?.[0]).toBeUndefined();
  });
});

describe('/blueprints/team/ page', () => {
  it('is in PAGES and the sitemap, under Blueprints, and linked from the Blueprints hub', () => {
    const p = (PAGES as { path: string; out: string; sitemap?: boolean; nav?: string }[]).find((x) => x.path === '/blueprints/team/');
    expect(p).toMatchObject({ out: 'blueprints/team/index.html', sitemap: true, nav: 'BLUEPRINTS' });
    expect(readFileSync(join(DIST, 'sitemap.xml'), 'utf8')).toContain(`<loc>${SITE_URL}/blueprints/team/</loc>`);
    expect(readFileSync(join(DIST, 'blueprints/index.html'), 'utf8')).toContain('href="/blueprints/team/"');
  });

  it('has one h1, no inline style, script or handler, no form, and loads its own CSS and JS only here', () => {
    const h = html();
    expect(h.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(h).toContain('<h1 id="page-title">Agent operations team</h1>');
    expect(h).not.toMatch(/\sstyle="/);
    expect(h).not.toMatch(/<style[\s>]/);
    expect(h).not.toMatch(/\son[a-z]+="/);
    expect(h).not.toMatch(/<script(?![^>]*(src="\/|type="application\/ld\+json"))/);
    expect(h).not.toMatch(/<form[\s>]/);
    expect(h).toMatch(/<script src="\/assets\/data\/team\.js\?v=[0-9a-f]{10}" defer><\/script>/);
    expect(h).toMatch(/<script src="\/assets\/team-ui\.js\?v=[0-9a-f]{10}" defer><\/script>/);
    expect(h).toMatch(/<link rel="stylesheet" href="\/assets\/team\.css\?v=[0-9a-f]{10}">/);
    const css = readFileSync(join(DIST, 'assets/team.css'), 'utf8');
    expect(css).toContain('prefers-reduced-motion');
    for (const out of ['index.html', 'blueprints/organization/index.html', 'workflows/index.html']) {
      expect(readFileSync(join(DIST, out), 'utf8'), out).not.toContain('team-ui.js');
    }
  });

  it('shows department counts computed from the data, and one card and one entry per agent', () => {
    const h = html();
    const C = teamCounts(T);
    expect(C.agents + C.roles).toBe(T.agents.length);
    expect(h).toContain(`<b data-tm-n="agents">${C.agents}</b> agents`);
    expect(h).toContain(`<b data-tm-n="roles">${C.roles}</b> human roles`);
    expect(h).toContain(`<b data-tm-n="depts">${T.depts.length}</b> departments`);
    expect(h).toContain(`<b data-tm-n="tasks">${C.tasks}</b> tasks and skills`);
    for (const d of T.depts) {
      const band = h.match(new RegExp(`<section class="tm-band tm-c-${d.id}"[\\s\\S]*?</section>`))![0];
      const n = T.agents.filter((a) => a.dept === d.id).length;
      expect((band.match(/data-tm-card /g) ?? []).length, d.id).toBe(n);
      expect(band, d.id).toContain(`data-total="${n}">${deptCountLabel(C.per[d.id])}</p>`);
      expect(h, d.id).toMatch(new RegExp(`<option value="${d.id}">[^<]+ · ${deptCountLabel(C.per[d.id])}</option>`));
    }
    for (const a of T.agents) {
      expect(h, a.id).toContain(`href="#a-${a.id}" data-tm-open="${a.id}"`);
      expect(h, a.id).toContain(`<details class="tm-entry" id="a-${a.id}" data-tm-entry="${a.id}">`);
    }
  });

  it('lists each task with its level and citation in the entry, and offers search, department and level filters', () => {
    const h = html();
    const n = T.agents.reduce((s, a) => s + a.tasks.length, 0);
    expect((h.match(/<li data-tm-task /g) ?? []).length).toBe(n);
    expect(h).toContain('Level not stated');
    expect(h).toContain('<input id="tm-q" type="search"');
    expect(h).toContain('<select id="tm-dept" data-tm-dept>');
    expect(h).toContain('<select id="tm-level" data-tm-level>');
    for (const l of [0, 1, 2, 3, 4, 5]) expect(h).toContain(`<option value="${l}">L${l} `);
    expect(h).toContain('role="status" aria-live="polite"');
    expect(h).toContain('<dialog class="tm-dialog" aria-labelledby="tm-dialog-title" data-tm-dialog>');
    for (const label of ['Inputs', 'Outputs', 'Owner', 'Approver', 'What moves it up', 'What moves it down', 'Cannot', 'Kill switch', 'KPIs and evidence', 'Exception path to a person', 'From the book']) {
      expect(h, label).toContain(`<dt>${label}</dt>`);
    }
  });

  it('keeps the CSP header unchanged', () => {
    expect(readFileSync(join(ROOT, 'src/static/_headers'), 'utf8')).toContain("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests\n");
  });
});
