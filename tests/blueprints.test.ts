import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error plain JS build script
import { PAGES, build } from '../scripts/build.mjs';
// @ts-expect-error plain JS build script
import { loadBlueprintData } from '../scripts/blueprints-static.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AE: any = loadBlueprintData(join(ROOT, 'src', 'assets'));
type Page = { out: string; path: string; bp?: string };
const bpPages = (PAGES as Page[]).filter((p) => p.bp);
const html = (out: string) => readFileSync(join(DIST, out), 'utf8');
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
const LAYER_IDS = ['fin', 'reg', 'ops', 'app', 'fe', 'be', 'data'];

beforeAll(() => {
  build();
});

describe('controls library data', () => {
  it('has at least 40 controls with unique IDs', () => {
    expect(AE.controls.length).toBeGreaterThanOrEqual(40);
    const ids = AE.controls.map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every control a known category, type, harness part, level, use and layer', () => {
    const cats = new Set(AE.categories.map((c: { id: string }) => c.id));
    const parts = new Set(AE.harness.map((h: { id: string }) => h.id));
    const applies = new Set(AE.appliesTo.map((a: { id: string }) => a.id));
    expect(cats.size).toBe(15);
    expect(parts.size).toBe(10);
    for (const c of AE.controls) {
      expect(cats.has(c.cat), c.id).toBe(true);
      expect(['preventive', 'detective', 'corrective']).toContain(c.type);
      expect(parts.has(c.part), c.id).toBe(true);
      expect(c.minLevel >= 0 && c.minLevel <= 5, c.id).toBe(true);
      expect(c.applies.length, c.id).toBeGreaterThan(0);
      for (const a of c.applies) expect(applies.has(a), c.id).toBe(true);
      expect(c.layers.length, c.id).toBeGreaterThan(0);
      for (const l of c.layers) expect(LAYER_IDS, c.id).toContain(l);
      for (const k of ['name', 'purpose', 'how', 'evidence']) expect(c[k].length, `${c.id} ${k}`).toBeGreaterThan(5);
      for (const k of ['purpose', 'how', 'evidence']) expect(words(c[k]), `${c.id} ${k}`).toBeLessThanOrEqual(25);
    }
    for (const cat of cats) expect(AE.controls.some((c: { cat: string }) => c.cat === cat), String(cat)).toBe(true);
  });

  it('maps only to known public framework items', () => {
    for (const c of AE.controls) {
      for (const n of c.map.nist) expect(['Govern', 'Map', 'Measure', 'Manage']).toContain(n);
      for (const a of c.map.eu) expect([9, 10, 12, 13, 14, 15]).toContain(a);
      for (const o of c.map.owasp) expect(Object.keys(AE.owaspNames)).toContain(o);
      for (const s of c.map.sox) expect(['Access', 'Change management', 'SoD']).toContain(s);
    }
    expect(AE.controls.some((c: { map: { iec62443: boolean } }) => c.map.iec62443)).toBe(true);
    expect(AE.controls.some((c: { map: { iso10218: boolean } }) => c.map.iso10218)).toBe(true);
    expect(AE.controls.some((c: { map: { iso42001: boolean } }) => c.map.iso42001)).toBe(true);
  });
});

describe('workflow blueprints data', () => {
  const ids = new Set(AE.controls.map((c: { id: string }) => c.id));
  const lanes = new Set(AE.lanes.map((l: { id: string }) => l.id));
  const handoffs = new Set(AE.handoffs.map((h: { id: string }) => h.id));
  const types = new Set(AE.failureTypes.map((f: { id: string }) => f.id));

  it('has at least eight workflows, each with a today and a reimagined view', () => {
    expect(AE.workflows.length).toBeGreaterThanOrEqual(8);
    for (const w of AE.workflows) {
      expect(w.today.length, w.id).toBeGreaterThan(2);
      expect(w.steps.length, w.id).toBeGreaterThan(4);
      expect(w.failures.length, w.id).toBeGreaterThanOrEqual(3);
      for (const k of ['cycle', 'touches', 'cost']) expect(w.metrics.today[k] && w.metrics.re[k], w.id).toBeTruthy();
    }
  });

  it('references only existing control IDs, lanes, handoffs, models and failure types', () => {
    for (const w of AE.workflows) {
      for (const s of [...w.steps, ...w.today]) {
        for (const c of s.controls) expect(ids.has(c), `${w.id} ${s.id} ${c}`).toBe(true);
        expect(lanes.has(s.lane), `${w.id} ${s.id}`).toBe(true);
        if (s.ho) expect(handoffs.has(s.ho), `${w.id} ${s.id}`).toBe(true);
        expect(Object.keys(AE.modelNames), `${w.id} ${s.id}`).toContain(s.model);
        if (s.lvl != null) expect(s.lvl >= 0 && s.lvl <= 5).toBe(true);
      }
      for (const f of w.failures) {
        expect(ids.has(f.control), `${w.id} ${f.type}`).toBe(true);
        expect(types.has(f.type)).toBe(true);
        expect(lanes.has(f.lane)).toBe(true);
        expect(w.steps.some((s: { id: string }) => s.id === f.step), `${w.id} ${f.step}`).toBe(true);
      }
    }
  });

  it('tags every reimagined step that embeds controls with the layers it aligns', () => {
    for (const w of AE.workflows) {
      for (const s of w.steps) {
        if (s.controls.length) expect(s.layers.length, `${w.id} ${s.id}`).toBeGreaterThan(0);
        for (const l of s.layers) expect(s.controls.some((c: string) => AE.controlById[c].layers.includes(l))).toBe(true);
      }
    }
  });

  it('keeps the supplier bank-detail change with people (chain level L0)', () => {
    const w = AE.workflows.find((x: { id: string }) => x.id === 'supplier');
    const main = w.steps.filter((s: { ex: boolean }) => !s.ex);
    const ceil = Object.fromEntries(AE.handoffs.map((h: { id: string; ceil: number }) => [h.id, h.ceil]));
    const level = Math.min(...main.map((s: { lvl: number | null; ho: string | null }) => Math.min(s.lvl ?? 5, s.ho ? ceil[s.ho] : 5)));
    expect(level).toBe(0);
    expect(w.steps.some((s: { controls: string[] }) => s.controls.includes('TAL-05'))).toBe(true);
  });
});

describe('alignment layers and architecture data', () => {
  it('has the seven alignment layers in order, each with 4 to 6 items tied to tagged controls', () => {
    expect(AE.layers.map((l: { name: string }) => l.name)).toEqual(['Financial', 'Regulatory and statutory', 'Operational', 'Application', 'Technical: Frontend', 'Technical: Backend', 'Technical: Data']);
    for (const l of AE.layers) {
      expect(l.items.length >= 4 && l.items.length <= 6, l.id).toBe(true);
      for (const it of l.items) {
        expect(it.agent && it.check && it.evidence).toBeTruthy();
        for (const c of it.controls) {
          expect(AE.controlById[c], `${l.id} ${c}`).toBeTruthy();
          expect(AE.controlById[c].layers, `${l.id} ${c}`).toContain(l.id);
        }
      }
    }
  });

  it('has nine layers, the ten harness parts, the model portfolio and eight valid variations', () => {
    expect(AE.archLayers).toHaveLength(9);
    for (const h of AE.harness) expect(AE.componentById[h.id]?.layer).toBe('har');
    for (const id of ['llm', 'slm', 'reason', 'mm', 'speech', 'rag', 'kg', 'ml', 'opt', 'rl', 'rules', 'twin', 'phys']) {
      expect(AE.componentById[id]?.layer, id).toBe('int');
      expect(AE.models.some((m: { id: string }) => m.id === id), id).toBe(true);
    }
    for (const c of AE.components) {
      for (const x of c.controls) expect(AE.controlById[x], `${c.id} ${x}`).toBeTruthy();
      for (const l of c.layers) expect(LAYER_IDS, c.id).toContain(l);
      expect(AE.frameworkNames[c.fw], c.id).toBeTruthy();
    }
    expect(AE.variations).toHaveLength(8);
    for (const v of AE.variations) for (const [id] of v.path) expect(AE.componentById[id], `${v.id} ${id}`).toBeTruthy();
    for (const m of AE.models) for (const x of m.mand.split(' ')) expect(AE.controlById[x], `${m.id} ${x}`).toBeTruthy();
    for (const q of AE.chooser) for (const x of q.ctl.split(' ')) expect(AE.controlById[x], `${q.id} ${x}`).toBeTruthy();
  });
});

describe('built Blueprints pages', () => {
  it('builds the hub and four tools with sub-nav, scripts and illustrative labels', () => {
    expect(bpPages.map((p) => p.path)).toEqual(['/blueprints/', '/architecture/', '/workflows/', '/controls/', '/designer/']);
    for (const p of bpPages) {
      const h = html(p.out);
      expect(h, p.out).toContain('<nav class="bp-subnav" aria-label="Blueprints">');
      for (const href of ['/architecture/', '/workflows/', '/controls/', '/designer/']) expect(h).toContain(`href="${href}"`);
      expect(h, p.out).toMatch(/<a href="\/blueprints\/" aria-current="page">Blueprints<\/a>/);
      for (const f of ['data/controls.js', 'data/layers.js', 'data/workflows.js', 'data/architecture.js', 'blueprints.js']) expect(h, p.out).toMatch(new RegExp(`<script src="/assets/${f}\\?v=[0-9a-f]{10}" defer></script>`));
      expect(h, p.out).toMatch(/[Ii]llustrative/);
      expect(h, p.out).not.toMatch(/\sstyle="/);
    }
  });

  it('renders meaningful static content that works without JavaScript', () => {
    const controls = html('controls/index.html');
    for (const c of AE.controls) expect(controls).toContain(`<article class="ctl" id="${c.id}"`);
    const wf = html('workflows/index.html');
    for (const w of AE.workflows) expect(wf).toContain(`id="wf-${w.id}"`);
    const matrix = wf.match(/<table class="fw-table bp-matrix">[\s\S]*?<\/table>/)![0];
    expect(matrix.match(/<tr><th scope="row">/g)).toHaveLength(AE.workflows.length);
    expect(matrix.match(/<td data-layer=/g)).toHaveLength(AE.workflows.length * 7);
    const hub = html('blueprints/index.html');
    for (const l of AE.layers) expect(hub).toContain(`id="layer-${l.id}"`);
    expect(hub).toContain('Alignment across every layer');
    const arch = html('architecture/index.html');
    for (const c of AE.components) expect(arch).toContain(`id="c-${c.id}"`);
    expect(arch).toContain('Model family</th><th scope="col">Good at</th><th scope="col">Weak at</th><th scope="col">Evals you need</th><th scope="col">Typical ceiling');
    for (const out of ['architecture/index.html', 'workflows/index.html', 'designer/index.html']) expect(html(out)).toContain('<noscript>');
  });

  it('links the frameworks, book and home to the blueprints and back', () => {
    const fw = html('frameworks/index.html');
    for (const href of ['/architecture/', '/workflows/', '/controls/', '/designer/', '/blueprints/']) expect(fw).toContain(`href="${href}`);
    expect(html('book/index.html')).toContain('href="/blueprints/">Explore the blueprints</a>');
    expect(html('index.html')).toContain('href="/blueprints/">Explore the blueprints</a>');
    expect(html('blueprints/index.html')).toContain('href="/frameworks/#weakest-link"');
  });

  it('keeps the designer and tools free of storage, cookies and network calls', () => {
    const js = readFileSync(join(DIST, 'assets/blueprints.js'), 'utf8');
    expect(js).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB|fetch\(|XMLHttpRequest/);
    expect(js.match(/https?:\/\/[^'" ]+/g)).toEqual(['http://www.w3.org/2000/svg']);
    expect(js).not.toMatch(/style="/);
  });
});
