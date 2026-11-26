import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
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
  it('builds the hub and its tools with sub-nav, scripts and illustrative labels', () => {
    expect(bpPages.map((p) => p.path)).toEqual(['/blueprints/', '/architecture/', '/workflows/', '/controls/', '/designer/', '/blueprints/trace/', '/blueprints/loops/', '/blueprints/graphs/', '/blueprints/models/', '/blueprints/design/', '/blueprints/organization/', '/blueprints/operations/']);
    for (const p of bpPages) {
      const h = html(p.out);
      expect(h, p.out).toContain('<nav class="bp-subnav" aria-label="Blueprints">');
      for (const href of ['/architecture/', '/workflows/', '/controls/', '/designer/', '/blueprints/trace/', '/blueprints/loops/', '/blueprints/graphs/', '/blueprints/models/', '/blueprints/design/', '/blueprints/organization/', '/blueprints/operations/']) expect(h).toContain(`href="${href}"`);
      expect(h, p.out).toContain('<li><a href="/blueprints/graphs/"' + (p.bp === 'graphs' ? ' aria-current="page"' : '') + '>Graphs</a></li>');
      expect(h, p.out).toContain('<li><a href="/blueprints/loops/"' + (p.bp === 'loops' ? ' aria-current="page"' : '') + '>Improvement loops</a></li>');
      expect(h, p.out).toMatch(/<a href="\/blueprints\/" aria-current="page">Blueprints<\/a>/);
      for (const f of ['data/controls.js', 'data/layers.js', 'data/workflows.js', 'data/architecture.js', 'blueprints.js']) expect(h, p.out).toMatch(new RegExp(`<script src="/assets/${f}\\?v=[0-9a-f]{10}" defer></script>`));
      // Every tool is labelled: illustrative everywhere except the loops room, which runs real agents on sample data.
      if (p.bp === 'loops') expect(h, p.out).toContain('Real AI agents. Real computation on sample AP data.');
      else if (p.bp === 'graphs') expect(h, p.out).toContain('Real data. Real computation. Real AI calls.');
      else expect(h, p.out).toMatch(/[Ii]llustrative/);
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

describe('decision trace viewer', () => {
  const ctx: { window: Record<string, unknown>; fetch?: unknown; XMLHttpRequest?: unknown } = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'src/assets/trace-core.js'), 'utf8'), ctx);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const T: any = (ctx.window.AE as { trace: unknown }).trace;

  it('round-trips the illustrative sample through the JSONL parser without errors', () => {
    const text = T.toJSONL(T.sample(false)) + T.toJSONL(T.sample(true));
    const p = T.parse(text);
    expect(p.errors).toEqual([]);
    expect(p.events.length).toBeGreaterThan(300);
    expect(T.runs(p.events)).toEqual(['baseline', 'fault-injected']);
  });

  it('computes headline metrics and finds the injected anomalies', () => {
    const a = T.metrics(T.sample(false)), b = T.metrics(T.sample(true));
    expect(a).toMatchObject({ agents: 7, cases: 24, actions: 24, blocked: 0, dropped: 0 });
    expect(b.blocked).toBeGreaterThan(a.blocked);
    expect(b.dropped).toBeGreaterThan(0);
    expect(b.routed).toBeGreaterThan(a.routed);
    expect(b.reversals).toBeGreaterThan(a.reversals);
    const titles = T.compare(T.sample(false), T.sample(true)).notes.map((n: { title: string }) => n.title);
    for (const t of ['More cases went to people', 'Controls blocked actions', 'Handoffs were dropped', 'Reversals rose', 'An agent was demoted']) expect(titles).toContain(t);
    const credit = T.agentTable(T.sample(true)).find((r: { agent: string }) => r.agent === 'credit');
    expect(credit.level).toBe(2);
  });

  it('reports bad lines instead of failing, and requires t, agent and type', () => {
    const p = T.parse('{"t":"2026-11-02T08:00:00Z","agent":"a","type":"propose"}\nnot json\n{"agent":"a","type":"propose"}\n{"t":"2026-11-02T08:00:01Z","agent":"a","type":"dance"}\n');
    expect(p.events).toHaveLength(1);
    expect(p.errors.map((e: { line: number }) => e.line)).toEqual([2, 3, 4]);
  });

  it('uses only sample control IDs that exist in the library', () => {
    const ids = new Set(AE.controls.map((c: { id: string }) => c.id));
    for (const e of [...T.sample(false), ...T.sample(true)]) if (e.control) expect(ids.has(e.control), e.control).toBe(true);
  });

  it('makes no network calls and keeps no storage', () => {
    for (const f of ['trace-core.js', 'trace.js']) {
      const js = readFileSync(join(ROOT, 'src/assets', f), 'utf8');
      expect(js, f).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|document\.cookie|https?:\/\//);
    }
  });

  it('builds /blueprints/trace/ with its scripts and links it from the hub, the architecture data and the leaders page', () => {
    const h = html('blueprints/trace/index.html');
    expect(h).toMatch(/<script src="\/assets\/trace-core\.js\?v=[0-9a-f]+" defer><\/script>/);
    expect(h).toMatch(/<script src="\/assets\/trace\.js\?v=[0-9a-f]+" defer><\/script>/);
    expect(h).toContain('data-tv');
    expect(h.toLowerCase()).toContain('illustrative');
    expect(html('blueprints/index.html')).toContain('href="/blueprints/trace/"');
    expect(html('blueprints/index.html')).toContain('href="/leaders/"');
    expect(html('leaders/index.html')).toContain('href="/blueprints/trace/"');
    expect(AE.componentById.H9.link.href).toBe('/blueprints/trace/');
  });
});

describe('self-improving loops: live operations room', () => {
  const ctx: { window: Record<string, unknown> } = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'src/assets/loops-live.js'), 'utf8'), ctx);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Lv: any = (ctx.window.AE as { loopsLive: unknown }).loopsLive;

  it('builds /blueprints/loops/ with its own CSS and scripts, sub-nav, label and static fallback', () => {
    const h = html('blueprints/loops/index.html');
    expect(h).toMatch(/<link rel="stylesheet" href="\/assets\/loops\.css\?v=[0-9a-f]{10}">/);
    expect(h).toMatch(/<script src="\/assets\/loops-live\.js\?v=[0-9a-f]{10}" defer><\/script>/);
    expect(h).toMatch(/<script src="\/assets\/loops-recorded\.js\?v=[0-9a-f]{10}" defer><\/script>/);
    expect(h).toMatch(/<script src="\/assets\/loops\.js\?v=[0-9a-f]{10}" defer><\/script>/);
    expect(h).not.toContain('loops-core.js');
    expect(h.indexOf('loops-live.js')).toBeLessThan(h.indexOf('loops-recorded.js'));
    expect(h.indexOf('loops-recorded.js')).toBeLessThan(h.indexOf('/assets/loops.js'));
    expect(h).toContain('<h1 id="page-title">Self-improving loops</h1>');
    expect(h).toContain('<a href="/blueprints/loops/" aria-current="page">Improvement loops</a>');
    expect(h).toContain('data-lp="room"');
    expect(h).toContain('Real AI agents. Real computation on sample AP data.');
    expect(h).not.toMatch(/[Ss]imulated|[Ii]llustrative/);
    expect(h).toMatch(/href="\/assets\/data\/ap-sample\.json\?v=[0-9a-f]{10}"/);
    expect(h).toContain('<noscript>');
    expect(h.match(/<ol class="lp-steps-static">([\s\S]*?)<\/ol>/)![1].match(/<li>/g)).toHaveLength(6);
    expect(h).toContain('href="/frameworks/#ceiling"');
    for (const href of ['/leaders/', '/controls/#MR-10', '/blueprints/trace/']) expect(h).toContain(`href="${href}"`);
    expect(h).not.toMatch(/<(select|input|textarea)\b/);
  });

  it('ships the recorded real run (when present) as a script and as no-JS text, labelled with its date', () => {
    const js = readFileSync(join(ROOT, 'dist/assets/loops-recorded.js'), 'utf8');
    expect(js).toMatch(/AE\.loopsRecorded = /);
    expect(js).not.toMatch(/fetch\(|https?:\/\//);
    const recPath = join(ROOT, 'content/loops-recorded-run.json');
    if (!existsSync(recPath)) return;
    const rec = JSON.parse(readFileSync(recPath, 'utf8'));
    expect(rec.label).toMatch(/^Recorded real run, [A-Z][a-z]{2} \d{1,2}, \d{4}/);
    expect(rec.transcript.some((x: { k: string; ev?: { t: string; agent: string } }) => x.k === 'ev' && x.ev!.t === 'usage')).toBe(true);
    const h = html('blueprints/loops/index.html');
    expect(h).toContain(rec.label);
    expect(h.match(/<ol class="lp-transcript">([\s\S]*?)<\/ol>/)![1].match(/<li>/g)!.length).toBeGreaterThan(4);
  });

  it('links out only to the allowed citation sources, in a new tab with noopener', () => {
    const h = html('blueprints/loops/index.html').split('<main')[1].split('</main>')[0];
    const ext = [...h.matchAll(/<a [^>]*href="(https?:[^"]+)"[^>]*>/g)].filter((m) => !m[1].startsWith('https://humanledenterprise.com') && !m[1].includes('linkedin.com'));
    const allowed = ['https://sakana.ai/dgm/', 'https://arxiv.org/abs/2609.31186', 'https://s2.q4cdn.com/299287126/files/doc_financials/annual/2015-Letter-to-Shareholders.PDF',
      'https://evolutionaryarchitecture.com/precis.html', 'https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms'];
    expect(ext.map((m) => m[1]).sort()).toEqual([...allowed].sort());
    for (const m of ext) { expect(m[0]).toContain('rel="noopener"'); expect(m[0]).toContain('target="_blank"'); }
  });

  it('is linked from the hub, the sub-nav and the leaders page; its controls exist in the library', () => {
    expect(html('blueprints/index.html')).toContain('href="/blueprints/loops/"');
    expect(html('leaders/index.html')).toContain('href="/blueprints/loops/"');
    for (const id of ['MR-10', 'TRC-05', 'HO-06']) expect(AE.controlById[id], id).toBeTruthy();
    for (const s of Lv.STEPS) for (const id of s.controls) expect(AE.controlById[id], `${s.id} ${id}`).toBeTruthy();
    expect(Lv.STEPS.map((s: { name: string }) => s.name)).toEqual(['Expand', 'Guard', 'Decide', 'Measure', 'Contract', 'Reframe']);
    for (const s of Lv.STEPS) for (const sentence of `${s.what} ${s.evidence}`.split(/(?<=\.)\s/)) expect(words(sentence), sentence).toBeLessThanOrEqual(25);
    expect(Lv.CHIPS.map((c: { id: string }) => c.id)).toEqual(['cheaper', 'fairness', 'goal', 'scorer']);
    expect(Lv.AGENTS.map((a: { role: string }) => a.role.split(':')[0])).toEqual(['AI agent', 'Code', 'AI agent', 'Code', 'Code', 'AP process owner']);
  });
});

describe('Models page', () => {
  const FAMILIES = ['llm', 'slm', 'rpt', 'ml', 'opt', 'rag', 'kg', 'mm', 'video', 'speech', 'multimodal', 'phys'];
  it('covers every model family with the five fields, an 8-panel storyboard and a matrix row per family', () => {
    const h = html('blueprints/models/index.html');
    expect(h.match(/<h1[\s>]/g)).toHaveLength(1);
    for (const id of FAMILIES) expect(h, id).toContain(`<article class="md-fam" id="${id}"`);
    for (const dt of ['Good at', 'Example', 'Autonomy and risk', 'How it is tested', 'Where it sits']) expect(h.match(new RegExp(`<dt>${dt}</dt>`, 'g'))).toHaveLength(FAMILIES.length);
    expect(h.match(/<li class="md-panel[ "]/g)).toHaveLength(8);
    const rows = [...h.matchAll(/<tr data-layer="[^"]+"><th scope="row"><a href="#([a-z]+)">/g)].map((m) => m[1]);
    expect(rows.sort()).toEqual([...FAMILIES].sort());
    expect(h).toContain('GPT-class');
    expect(h).toMatch(/Book, Ch 0[3-9]/);
    expect(h).toMatch(/<script src="\/assets\/models\.js\?v=[0-9a-f]{10}" defer><\/script>/);
    expect(h).not.toMatch(/\b(SAP|RPT-1|TabPFN|Prior Labs|AWS|Databricks|Mitra|Kumo|Gemini|Claude|Llama)\b/);
  });
  it('is linked from the hub, the architecture page and the graphs page', () => {
    expect(html('blueprints/index.html')).toContain('<span class="bp-card-n">08</span><h3><a href="/blueprints/models/">Models</a></h3>');
    expect(html('architecture/index.html')).toContain('href="/blueprints/models/"');
    expect(html('architecture/index.html')).toContain('href="/blueprints/models/#llm"');
    const g = html('blueprints/graphs/index.html');
    expect(g).toContain('href="/blueprints/models/"');
    expect(g).toContain('href="/blueprints/models/#kg"');
  });
});

describe('Design choices page', () => {
  it('has the six sections with chapter citations, links to controls and the trace viewer, and no downloads or forms', () => {
    const h = html('blueprints/design/index.html');
    expect(h.match(/<h1[\s>]/g)).toHaveLength(1);
    for (const id of ['tabular', 'rag', 'evals', 'security', 'inference', 'deterministic']) expect(h, id).toMatch(new RegExp(`<section class="section[^"]*" id="${id}"`));
    for (const ch of ['03', '04', '05', '06', '07', '08', '09', '21', '22', '23', '25']) expect(h, ch).toContain(`Ch ${ch}`);
    expect(h).toContain('href="/controls/"');
    expect(h).toContain('href="/blueprints/trace/"');
    expect(h).toContain('p* = L &divide; (G + L)');
    expect(h).not.toMatch(/<form[\s>]|download|data-intake/);
    expect(h).not.toMatch(/\b(SAP|TabPFN|Prior Labs|AWS|Databricks|Copilot|Agentforce|Now Assist|Claude|Gemini)\b/);
    expect(html('blueprints/index.html')).toContain('<span class="bp-card-n">09</span><h3><a href="/blueprints/design/">Design choices</a></h3>');
    expect(html('blueprints/models/index.html')).toContain('href="/blueprints/design/"');
  });
});

describe('Organization page', () => {
  const VENDORS = /\b(SAP|Salesforce|ServiceNow|Coupa|Workday|Microsoft|Gravitee|Gartner|NVIDIA|OpenAI|Anthropic|Oracle|Teams|Prosci|BCG|OpenTelemetry)\b/;
  const sentences = (t: string) => t.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  it('covers org structure, an 8-panel storyboard, delegation, incomplete information and the capability matrix', () => {
    const h = html('blueprints/organization/index.html');
    expect(h.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(h).toContain('<h1 id="page-title">Organization: humans and agents</h1>');
    for (const id of ['shifts', 'org', 'storyboard', 'delegation', 'incomplete', 'capability']) expect(h, id).toMatch(new RegExp(`<section class="section[^"]*" id="${id}"`));
    // Incomplete information sits right after delegation.
    expect(h.indexOf('id="incomplete"')).toBeGreaterThan(h.indexOf('id="delegation"'));
    expect(h.indexOf('id="incomplete"')).toBeLessThan(h.indexOf('id="capability"'));
    const panels = [...h.matchAll(/<li class="md-panel[^"]*">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    expect(panels).toHaveLength(8);
    for (const p of panels) for (const s of sentences(p.replace(/<span class="md-panel-n"[^>]*>\d<\/span>|<p class="md-tag">[^<]*<\/p>|<h3>[^<]*<\/h3>/g, ''))) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(25);
    for (const ch of ['01', '03', '05', '07', '21', '22', '24', '25', '26']) expect(h, ch).toContain(`Ch ${ch}`);
    expect(h).toContain('href="/blueprints/design/#deterministic"');
    expect(h).toContain('What the book does not cover');
    expect(h).toContain('does not use the one-way and two-way door framing');
    expect(h).toMatch(/<script src="\/assets\/org\.js\?v=[0-9a-f]{10}" defer><\/script>/);
    expect(h).not.toMatch(VENDORS);
  });
  it('builds the capability matrix from rows with a known who value and short reasons', () => {
    const h = html('blueprints/organization/index.html');
    const rows = [...h.matchAll(/<tr data-who="([^"]+)"><th scope="row">[^<]*(?:&rsquo;[^<]*)?<\/th><td>([^<]+)<\/td><td>[^<]+<\/td><td>([^<]+)<\/td><td>(Ch [^<]+)<\/td><\/tr>/g)];
    expect(rows.length).toBeGreaterThanOrEqual(20);
    const who = new Set(rows.map((r) => r[1]));
    expect([...who].sort()).toEqual(['Agent', 'Agent proposes, human approves', 'Human only', 'Human, agent assists']);
    for (const r of rows) {
      expect(r[2], 'who cell matches data-who').toBe(r[1]);
      expect(r[3].split(/\s+/).length, r[3]).toBeLessThanOrEqual(25);
    }
    const js = readFileSync(join(DIST, 'assets/org.js'), 'utf8');
    expect(js).toContain("getAttribute('data-who')");
    expect(js).not.toMatch(/localStorage|sessionStorage|document\.cookie|fetch\(|XMLHttpRequest|Math\.random/);
  });
  it('is linked from the hub, models, design, controls, trace, frameworks and book', () => {
    expect(html('blueprints/index.html')).toContain('<span class="bp-card-n">10</span><h3><a href="/blueprints/organization/">Organization</a></h3>');
    expect(html('blueprints/index.html')).toContain('Eleven tools');
    expect(html('blueprints/models/index.html')).toContain('href="/blueprints/organization/#delegation"');
    expect(html('controls/index.html')).toContain('href="/blueprints/organization/#delegation"');
    expect(html('frameworks/index.html')).toContain('href="/blueprints/organization/"');
    expect(html('book/index.html')).toContain('href="/blueprints/organization/"');
  });
});

describe('Operations page', () => {
  it('covers tracing, dashboards, registry, audits, guardians, kill switch and reliability with citations', () => {
    const h = html('blueprints/operations/index.html');
    expect(h.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(h).toContain('<h1 id="page-title">Operating agents: audits, observability, reliability</h1>');
    for (const id of ['observe', 'dashboards', 'registry', 'audits', 'guardians', 'killswitch', 'reliability']) expect(h, id).toMatch(new RegExp(`<section class="section[^"]*" id="${id}"`));
    for (const k of ['K1 Pause agent version', 'K2 Revoke tool scope', 'K3 Revoke identity', 'K4 Platform stop', 'K5 Fleet stop']) expect(h).toContain(k);
    for (const ch of ['05', '06', '22', '24', '25', '26']) expect(h, ch).toContain(`Ch ${ch}`);
    expect(h).toContain('href="/blueprints/design/#evals"');
    expect(h).toContain('does not define per-agent error budgets');
    expect(h).not.toMatch(/<form[\s>]|data-intake/);
    expect(h).not.toMatch(/\b(SAP|Salesforce|ServiceNow|Coupa|Workday|Microsoft|Gravitee|Gartner|NVIDIA|OpenAI|Anthropic|Oracle|OpenTelemetry)\b/);
  });
  it('is linked from the hub, design, trace and frameworks', () => {
    expect(html('blueprints/index.html')).toContain('<span class="bp-card-n">11</span><h3><a href="/blueprints/operations/">Operations</a></h3>');
    expect(html('blueprints/design/index.html')).toContain('href="/blueprints/operations/"');
    expect(html('blueprints/trace/index.html')).toContain('href="/blueprints/operations/#observe"');
    expect(html('frameworks/index.html')).toContain('href="/blueprints/operations/#reliability"');
  });
});
