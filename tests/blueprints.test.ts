import { readFileSync } from 'node:fs';
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
    expect(bpPages.map((p) => p.path)).toEqual(['/blueprints/', '/architecture/', '/workflows/', '/controls/', '/designer/', '/blueprints/trace/', '/blueprints/loops/']);
    for (const p of bpPages) {
      const h = html(p.out);
      expect(h, p.out).toContain('<nav class="bp-subnav" aria-label="Blueprints">');
      for (const href of ['/architecture/', '/workflows/', '/controls/', '/designer/', '/blueprints/trace/', '/blueprints/loops/']) expect(h).toContain(`href="${href}"`);
      expect(h, p.out).toContain('<li><a href="/blueprints/loops/"' + (p.bp === 'loops' ? ' aria-current="page"' : '') + '>Improvement loops</a></li>');
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
  vm.runInContext(readFileSync(join(ROOT, 'src/assets/loops-core.js'), 'utf8'), ctx);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Lp: any = (ctx.window.AE as { loops: unknown }).loops;
  type D = { kind: string };
  const policy = (m: Record<string, string>) => (d: D) => m[d.kind] || 'reject';
  const strip = (r: { log: unknown[] }) => JSON.stringify(r.log);

  it('builds /blueprints/loops/ with its own CSS and scripts, sub-nav, label and static fallback', () => {
    const h = html('blueprints/loops/index.html');
    expect(h).toMatch(/<link rel="stylesheet" href="\/assets\/loops\.css\?v=[0-9a-f]{10}">/);
    expect(h).toMatch(/<script src="\/assets\/loops-core\.js\?v=[0-9a-f]{10}" defer><\/script>/);
    expect(h).toMatch(/<script src="\/assets\/loops\.js\?v=[0-9a-f]{10}" defer><\/script>/);
    expect(h).toContain('<h1 id="page-title">Self-improving loops</h1>');
    expect(h).toContain('<a href="/blueprints/loops/" aria-current="page">Improvement loops</a>');
    expect(h).toContain('data-lp="room"');
    expect(h).toContain('Simulated agents, illustrative numbers.');
    expect(h).toContain('<noscript>');
    expect(h.match(/<ol class="lp-steps-static">([\s\S]*?)<\/ol>/)![1].match(/<li>/g)).toHaveLength(6);
    expect(h).toContain('href="/frameworks/#ceiling"');
    for (const href of ['/leaders/', '/controls/#MR-10', '/blueprints/trace/']) expect(h).toContain(`href="${href}"`);
    expect(h).not.toMatch(/<(select|input|textarea)\b/);
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
    for (const s of Lp.STEPS) for (const id of s.controls) expect(AE.controlById[id], `${s.id} ${id}`).toBeTruthy();
    expect(Lp.STEPS.map((s: { name: string }) => s.name)).toEqual(['Expand', 'Guard', 'Decide', 'Measure', 'Contract', 'Reframe']);
    for (const s of Lp.STEPS) for (const sentence of `${s.what} ${s.evidence}`.split(/(?<=\.)\s/)) expect(words(sentence), sentence).toBeLessThanOrEqual(25);
  });

  it('is deterministic: same seed and same choices give the same event stream', () => {
    const a = Lp.play(7, policy({ door: 'approve' })), b = Lp.play(7, policy({ door: 'approve' }));
    expect(strip(a)).toBe(strip(b));
    expect(a.done).toBe(true);
    expect(a.gen).toBe(Lp.MAX_GEN);
    expect(strip(Lp.play(8, policy({ door: 'approve' })))).not.toBe(strip(a));
    const types = new Set(a.log.map((e: { t: string }) => e.t));
    for (const t of ['msg', 'tool', 'checks', 'phase', 'variant', 'metric', 'decision', 'end']) expect(types.has(t), t).toBe(true);
    const agents = new Set(a.log.filter((e: { t: string }) => e.t === 'msg').map((e: { a: string }) => e.a));
    for (const ag of ['proposer', 'harness', 'supervisor', 'evaluator', 'archivist', 'you']) expect(agents.has(ag), ag).toBe(true);
  });

  it('brings one-way doors to the visitor as decision cards, and the answer changes what happens', () => {
    for (const seed of [7, 42, 2026]) {
      const yes = Lp.play(seed, policy({ door: 'approve' })), no = Lp.play(seed, policy({}));
      const card = yes.log.find((e: { t: string; kind: string; title: string }) => e.t === 'decision' && e.kind === 'door' && /auto-approve/.test(e.title));
      expect(card.door).toBe('one-way');
      expect(card.title).toMatch(/^Approve: raise the auto-approve limit to \$5,000\?$/);
      expect(card.options.map((o: { id: string }) => o.id)).toEqual(['approve', 'reject', 'why']);
      expect(yes.byId[card.variant].status).not.toBe('rejected');
      expect(no.byId[card.variant].status).toBe('rejected');
      expect(strip(yes)).not.toBe(strip(no));
    }
  });

  it('streams reasoning and evidence when the visitor asks why, then asks again', () => {
    const r = Lp.create(7);
    let d = null; let guard = 0;
    while (!d && guard++ < 500) { Lp.next(r); d = r.waiting; }
    const before = r.log.length;
    Lp.answer(r, 'why');
    const after: { t: string; a?: string; text?: string; again?: boolean; options?: { id: string }[] }[] = [];
    let e; while ((e = Lp.next(r))) after.push(e);
    expect(r.log.length).toBeGreaterThan(before);
    expect(after.filter((x) => x.t === 'msg').some((x) => /Reasoning/.test(x.text!))).toBe(true);
    expect(after.filter((x) => x.t === 'msg').some((x) => /Evidence/.test(x.text!))).toBe(true);
    const again = after[after.length - 1];
    expect(again.t).toBe('decision'); expect(again.again).toBe(true);
    expect(again.options!.map((o) => o.id)).toEqual(['approve', 'reject']);
  });

  it('blocks the evaluator edit by default; overriding it lifts the score, sinks the real outcome, and lineage review reverts it', () => {
    for (const seed of [7, 42, 2026]) {
      const locked = Lp.play(seed, policy({ door: 'approve' }));
      const card = locked.log.find((e: { t: string; kind: string }) => e.t === 'decision' && e.kind === 'scorer');
      expect(card, String(seed)).toBeTruthy();
      expect(locked.byId[card.variant].status).toBe('blocked');
      expect(locked.caught).toBe(false);
      expect(locked.log.some((e: { t: string; items?: { id: string; pass: boolean }[] }) => e.t === 'checks' && e.items!.some((i) => i.id === 'scorer' && !i.pass))).toBe(true);

      const hacked = Lp.play(seed, policy({ door: 'approve', scorer: 'approve' }));
      expect(hacked.caught).toBe(true);
      const h = hacked.history.filter((x: { goal: string }) => x.goal === 'cost');
      const at = h.findIndex((x: { gen: number }) => x.gen === hacked.hackAt);
      const rev = h.findIndex((x: { note: string }) => x.note === 'Reverted');
      expect(rev, String(seed)).toBeGreaterThan(at);
      const pre = h[at - 1], peak = h[rev - 1];
      expect(peak.score, `score improves (cost falls) ${seed}`).toBeLessThan(pre.score);
      expect(peak.real, `real outcome worsens (cost rises) ${seed}`).toBeGreaterThan(pre.real);
      expect(Math.abs(h[rev].score - h[rev].real)).toBeLessThan(0.3);
      expect(hacked.log.some((e: { t: string; name: string }) => e.t === 'tool' && e.name === 'lineage_review')).toBe(true);
    }
  });

  it('lets the visitor reframe the goal in the monthly meeting and by instruction', () => {
    const keep = Lp.play(7, policy({})), sw = Lp.play(7, policy({ reframe: 'switch' }));
    expect(keep.log.some((e: { t: string; step: string }) => e.t === 'phase' && e.step === 'reframe')).toBe(true);
    expect(keep.goal).toBe('cost');
    expect(sw.goal).toBe('fpr');
    const r = Lp.create(7);
    for (let i = 0; i < 20; i++) Lp.next(r);
    expect(Lp.instruct(r, 'Reframe the goal to first-pass resolution')).toBe('goal');
    expect(r.goal).toBe('fpr');
    const ev = Lp.next(r);
    expect(ev.t).toBe('msg'); expect(ev.a).toBe('you');
  });

  it('answers the instruction chips in real time and changes later behaviour', () => {
    expect(Lp.CHIPS.map((c: { id: string }) => c.id)).toEqual(['cheaper', 'fairness', 'goal', 'lineage']);
    expect(Lp.match('try something cheaper')).toBe('cheaper');
    expect(Lp.match('tighten fairness please')).toBe('fairness');
    expect(Lp.match('show lineage')).toBe('lineage');
    expect(Lp.match('make coffee')).toBeNull();
    const r = Lp.create(7);
    for (let i = 0; i < 6; i++) Lp.next(r);
    Lp.instruct(r, 'cheaper');
    const reply = [Lp.next(r), Lp.next(r)];
    expect(reply[0].a).toBe('you'); expect(reply[1].a).toBe('proposer');
    let g = 0; while (r.gen < 1 && g++ < 200) { if (!Lp.next(r) && r.waiting) Lp.answer(r, 'reject'); }
    while (Lp.next(r)) { /* drain */ }
    expect(r.variants.some((v: { mutation: string }) => v.mutation === 'small')).toBe(true);
    const f = Lp.create(7); Lp.next(f);
    Lp.instruct(f, 'fairness');
    expect(f.settings.fairMax).toBeLessThan(3);
    const u = Lp.create(7); Lp.next(u);
    Lp.instruct(u, 'make coffee');
    const msgs = [Lp.next(u), Lp.next(u)];
    expect(msgs[1].a).toBe('supervisor');
  });

  it('makes no network calls, model calls or storage, and writes no inline styles', () => {
    for (const f of ['loops-core.js', 'loops.js']) {
      const js = readFileSync(join(ROOT, 'src/assets', f), 'utf8');
      expect(js, f).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|document\.cookie|import\(|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
      expect(js, f).not.toMatch(/style="/);
    }
  });
});
