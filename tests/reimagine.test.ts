import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error plain JS build script
import { build } from '../scripts/build.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const html = (out: string) => readFileSync(join(DIST, out), 'utf8');
const ctx: { window: Record<string, unknown> } = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(join(ROOT, 'src/assets/reimagine-core.js'), 'utf8'), ctx);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R: any = (ctx.window.AE as { reimagine: unknown }).reimagine;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const ALL = { data: ['authority', 'lineage', 'freshness', 'access', 'ownership'], platform: ['load', 'latency', 'availability', 'observability', 'cost', 'recovery'], gov: ['may', 'humans', 'trace', 'owner'] };
const NORTHWIND = { industry: 'retail', revenue: 'lt500m', cores: { legacyErp: 0, mainframe: 0, cloud: 2, homegrown: 1 }, interfaces: 'lt100', streams: ['i2c', 'supply', 'front'], ot: false, ready: { data: ['access'], platform: [], gov: [] }, outcomes: ['wc', 'inventory'], appetite: 'cautious', hgQ: { q1: false } };

beforeAll(() => {
  build();
});

describe('reimagine rule engine: archetypes (Table 26.2)', () => {
  it('picks Meridian for the book example, with the reasons it matched', () => {
    const r = R.compute(R.MERIDIAN);
    expect(r.archetype.id).toBe('meridian');
    expect(r.archetype.why).toContain('several legacy ERPs');
    expect(r.archetype.otOverlay).toBe(false);
  });
  it('picks Northwind for a small retailer with a homegrown core', () => {
    expect(R.compute(NORTHWIND).archetype.id).toBe('northwind');
  });
  it('picks Harbor Health when there is no legacy core, and says there is no core clock', () => {
    const r = R.compute({ industry: 'services', revenue: '500m-2b', cores: { cloud: 3 }, streams: ['r2r'] });
    expect(r.archetype.id).toBe('harbor');
    expect(r.clocks.core).toBe(false);
    expect(r.clocks.cores).toHaveLength(0);
  });
  it('picks Atlas when a regulator or OT boundary is on the critical path, and keeps plant agents at L1', () => {
    const r = R.compute({ industry: 'utilities', cores: { legacyErp: 1, cloud: 1 }, ot: true, streams: ['supply'] });
    expect(r.archetype.id).toBe('atlas');
    expect(r.timeline.months).toBe(false);
    for (const p of r.pilots) expect(p.d.plant).toBeFalsy();
  });
  it('keeps Meridian for a multi-ERP estate with an OT boundary, and adds the Atlas overlay', () => {
    const r = R.compute({ ...R.MERIDIAN, ot: true });
    expect(r.archetype.id).toBe('meridian');
    expect(r.archetype.otOverlay).toBe(true);
    expect(R.renderResults(r)).toContain('OT overlay from Atlas Utilities');
  });
});

describe('reimagine rule engine: two clocks and strategies (Ch 11.5.1, 11.12.2)', () => {
  it('keeps and wraps a core whose support does not end before the safe finish', () => {
    const r = R.compute({ cores: { legacyErp: 1 }, erpQ: { q1: false, q2: true, q3: true } });
    expect(r.clocks.cores[0].st.list).toEqual(['Keep-and-wrap']);
  });
  it('maps the five answers to strategies and always wraps a mainframe first', () => {
    const r = R.compute(R.MERIDIAN);
    expect(r.clocks.cores.map((c: Any) => c.st.list)).toEqual([
      ['Greenfield implementation', 'Two-tier', 'Composable / clean core'],
      ['Wrap first, always', 'Refactor or rebuild behind the same API'],
    ]);
    const risky = R.compute({ cores: { mainframe: 1 }, mfQ: { risk: true } });
    expect(risky.clocks.cores[0].st.list).toEqual(['Wrap first, always', 'Rehost to buy time, then refactor']);
  });
});

describe('reimagine rule engine: foundations before agents (Ch 26.2.1)', () => {
  it('gates on the lowest layer without full evidence, in order data, platform, governance', () => {
    expect(R.compute({ ready: {} }).foundations.gate.id).toBe('data');
    expect(R.compute({ ready: { data: ALL.data } }).foundations.gate.id).toBe('platform');
    expect(R.compute({ ready: { data: ALL.data, platform: ALL.platform } }).foundations.gate.id).toBe('gov');
    // Governance evidence alone does not skip the data layer.
    expect(R.compute({ ready: { gov: ALL.gov, platform: ALL.platform } }).foundations.gate.id).toBe('data');
    const all = R.compute({ ready: ALL });
    expect(all.foundations.gate).toBeNull();
    expect(all.foundations.stage).toBe(2);
  });
  it('caps a pilot at L2 while its data has not passed the gate (Ch 01.5.4)', () => {
    const r = R.compute(R.MERIDIAN);
    const ap = r.pilots.find((p: Any) => p.d.id === 'ap-exception');
    expect(ap.notes.join(' ')).toContain('L2 until its data passes the quality gate');
    const ready = R.compute({ ...R.MERIDIAN, ready: ALL }).pilots.find((p: Any) => p.d.id === 'ap-exception');
    expect(ready.notes.join(' ')).not.toContain('quality gate');
  });
});

describe('reimagine rule engine: risks (Ch 26.9, 26.10)', () => {
  const ids = (input: Any) => R.compute(input).risks.map((x: Any) => x.id);
  it('triggers risks from the inputs, from the eight categories only', () => {
    expect(ids({ cores: { mainframe: 1 } })).toContain('INT-04');
    expect(ids({ cores: { cloud: 1 } })).not.toContain('INT-04');
    expect(ids({ cores: { legacyErp: 2 } })).toContain('INT-02');
    expect(ids({ appetite: 'ambitious' })).toContain('AGT-02');
    expect(ids({ appetite: 'cautious' })).not.toContain('AGT-02');
    expect(ids({ ot: true })).toContain('CTL-05');
    expect(ids({ outcomes: ['capacity'] })).toContain('STR-02');
    expect(ids({ ready: ALL })).not.toContain('DAT-01');
    for (const id of ids({ ...R.MERIDIAN, ot: true, appetite: 'ambitious', streams: ['supply', 'front'] })) expect(id).toMatch(/^(STR|COR|INT|DAT|AGT|CTL|PPL|VND)-0[1-6]$/);
  });
});

describe('reimagine rule engine: the Meridian example is stable', () => {
  it('reproduces the book\'s Meridian outputs', () => {
    const r = R.compute(R.MERIDIAN);
    expect(r.isMeridian).toBe(true);
    expect(r.foundations.gate.id).toBe('data');
    expect(r.foundations.stage).toBe(1);
    // The book's first three pilots (Section 26.6.3): AP exceptions, the cross-platform dispute agent, the IT service desk.
    expect(r.pilots.map((p: Any) => p.d.id)).toEqual(['ap-exception', 'dispute', 'service-desk']);
    expect(r.pilots.map((p: Any) => p.learning)).toEqual([true, false, false]);
    expect(r.pilots.some((p: Any) => p.d.cross)).toBe(true);
    expect(r.timeline.phases.map((p: Any) => [p.gate, p.to])).toEqual([['G0', 3], ['G1', 13], ['G2', 19], ['G3', 30], ['G4', 33]]);
    expect(r.risks.slice(0, 8).map((x: Any) => x.id)).toEqual(['COR-01', 'INT-02', 'DAT-01', 'CTL-01', 'STR-02', 'PPL-01', 'VND-03', 'INT-04']);
    expect(R.summary(r).length).toBeLessThan(600);
  });
  it('ships the computed Meridian result as the page\'s static content, labelled illustrative', () => {
    const h = html('reimagine/index.html');
    expect(h).toContain(R.renderResults(R.compute(R.MERIDIAN)));
    expect(h).toContain('Illustrative example from the book: Meridian Industries');
    expect(h).toContain(`href="/talk/?q=${encodeURIComponent(R.summary(R.compute(R.MERIDIAN)))}"`);
    expect(R.compute(NORTHWIND).isMeridian).toBe(false);
    // Inputs read back from the page arrive in page order; the example must still be recognised.
    const shuffled = { ...R.MERIDIAN, streams: [...R.MERIDIAN.streams].reverse(), outcomes: [...R.MERIDIAN.outcomes].reverse(), ready: { data: ['freshness', 'access'], platform: ['recovery', 'availability'], gov: [] }, cores: { legacyErp: '2', mainframe: '1', cloud: '5', homegrown: '0' } };
    expect(R.compute(shuffled).isMeridian).toBe(true);
    expect(R.renderResults(R.compute(NORTHWIND))).not.toContain('Illustrative example from the book');
  });
});

describe('reimagine rule engine: citations', () => {
  it('cites the book in every output section, with valid section numbers', () => {
    for (const input of [R.MERIDIAN, NORTHWIND, { ot: true, cores: { legacyErp: 1 }, streams: ['tax', 'ehs', 'legal'] }]) {
      const out = R.renderResults(R.compute(input));
      const sections = out.split('<section class="rm-out"').slice(1);
      expect(sections.length).toBeGreaterThanOrEqual(7);
      for (const s of sections) expect(s, s.slice(0, 60)).toMatch(/Book, Ch \d{2}\.\d/);
      for (const [, c] of out.matchAll(/Book, Ch ([^<]+)</g)) expect(c).toMatch(/^\d{2}(\.\d{1,2}){0,2}$/);
    }
    for (const d of R.DECISIONS) expect(d.cite, d.id).toMatch(/^\d{2}\.\d{1,2}(\.\d{1,2})?$/);
  });
  it('routes every value stream to decisions with an engine from the filter vocabulary', () => {
    for (const [id] of R.STREAMS) {
      const ds = R.DECISIONS.filter((d: Any) => d.s === id);
      expect(ds.length, id).toBeGreaterThanOrEqual(4);
      for (const d of ds) expect(d.eng, d.id).toMatch(/Rule|rule|Workflow|Model|model|Solver|solver|Agent|agent|Person/);
    }
  });
});

describe('reimagine page', () => {
  it('builds /reimagine/ with its own scripts and styles, accessible inputs and no form or network code', () => {
    const h = html('reimagine/index.html');
    expect((h.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    for (const f of ['reimagine.css', 'reimagine-core.js', 'reimagine.js']) expect(h).toMatch(new RegExp(`/assets/${f.replace('.', '\\.')}\\?v=[0-9a-f]{10}`));
    expect(h).not.toMatch(/<form[\s>]/);
    expect(h).toContain('role="status" aria-live="polite"');
    expect(h).toContain('<a class="bp-subnav-start" href="/reimagine/" aria-current="page">Start here</a>');
    for (const [id] of R.CORES) expect(h).toContain(`<label class="rm-field rm-num" for="rm-${id}">`);
    expect((h.match(/<fieldset/g) ?? []).length).toBeGreaterThan(8);
    for (const f of ['reimagine-core.js', 'reimagine.js']) {
      const js = readFileSync(join(DIST, 'assets', f), 'utf8');
      expect(js, f).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|document\.cookie|style="|\.style\./);
    }
  });
  it('is the front door: on home right after the pitch, first on the Blueprints hub, and in the sub-nav', () => {
    const home = html('index.html');
    expect(home.indexOf('id="reimagine"')).toBeGreaterThan(home.indexOf('hero-title'));
    expect(home.indexOf('id="reimagine"')).toBeLessThan(home.indexOf('id="start"'));
    expect(home).toContain('<a class="btn btn-dark" href="/reimagine/">Reimagine your operations</a>');
    expect(home).toContain('Illustrative example from the book: Meridian Industries');
    const hub = html('blueprints/index.html');
    expect(hub.indexOf('id="start-here"')).toBeLessThan(hub.indexOf('id="tracks"'));
    expect(html('architecture/index.html')).toContain('<a class="bp-subnav-start" href="/reimagine/">Start here</a>');
  });
  it('lets the guide prefill (not send) a summary passed in ?q=', () => {
    const js = readFileSync(join(DIST, 'assets/guide.js'), 'utf8');
    expect(js).toContain("new URLSearchParams(window.location.search).get('q')");
    expect(js).toMatch(/g0\.input\.value = q;/);
  });
});
