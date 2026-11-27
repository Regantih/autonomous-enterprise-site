import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error plain JS build script
import { build, PAGES } from '../scripts/build.mjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const src = (p: string) => readFileSync(join(ROOT, 'src', p), 'utf8');
const html = (out: string) => readFileSync(join(DIST, out), 'utf8');
const ctx: { window: Record<string, unknown> } = { window: {} };
vm.createContext(ctx);
vm.runInContext(src('assets/vz-core.js'), ctx);
const V: Any = (ctx.window.AE as Any).vz;
const run = (id: string, over: Record<string, unknown> = {}, counts?: Any) => {
  const s = V.specs[id];
  return s.compute({ ...V.defaults(s), ...over }, counts);
};
const row = (r: Any, label: string) => r.rows.find((x: Any) => x.label === label);

beforeAll(() => {
  build();
});

describe('exception cost (Ch 21.13.3)', () => {
  it('reproduces the book: USD 2.2M today; levers 94k and 21.5k; ratio about 4.4', () => {
    const r = run('exc');
    expect(row(r, 'Exception cost a year').today).toBeCloseTo(2_200_000, -3);
    expect(r.levers.exceptionPoint).toBeCloseTo(94_000, -3);
    expect(r.levers.autonomyPoint).toBeCloseTo(-21_500, -3);
    expect(r.levers.ratio).toBeCloseTo(4.4, 1);
    expect(r.levers.hoursPerExceptionPoint).toBeCloseTo(1500, 0);
  });
  it('uses the book cost per minute: USD 110,000 over 1,800 hours is about 1.02', () => {
    expect(run('exc').perMinute).toBeCloseTo(1.02, 2);
  });
  it('at zero agent share, transformed equals today', () => {
    const r = run('exc', { a: 0 });
    r.rows.forEach((x: Any) => expect(x.re).toBeCloseTo(x.today, 6));
  });
  it('responds to the visitor inputs', () => {
    const r = run('exc', { n: 100000, e: 10, t: 30, fte: 90000, hrs: 1800, a: 40, ca: 1 });
    const w = 90000 / 1800 / 60;
    expect(row(r, 'Exception cost a year').re).toBeCloseTo(10000 * (0.6 * 30 * w + 0.4 * 1), 6);
    expect(row(r, 'Person hours a year').re).toBeCloseTo(10000 * 0.6 * 30 / 60, 6);
  });
  it('marks the agent share as the visitor’s parameter and cites every other default', () => {
    V.specs.exc.inputs.forEach((i: Any) => expect(i.k === 'a' ? i.src === V.YOU : /^Ch \d|Hours bases/.test(i.src)).toBe(true));
  });
});

describe('inputs and share links', () => {
  it('clamps out-of-range and junk inputs to the allowed range or the default', () => {
    const s = V.specs.exc;
    const v = V.values(s, { n: -5, e: 999, t: 'abc', cur: 'ZZZ' });
    expect(v.n).toBe(1000); expect(v.e).toBe(60); expect(v.t).toBe(20); expect(v.cur).toBe('USD');
  });
  it('round-trips a view through the URL hash and ignores foreign hashes', () => {
    for (const id of Object.keys(V.specs)) {
      const s = V.specs[id], v = { ...V.defaults(s), cur: 'EUR' };
      v[s.inputs[0].k] = s.inputs[0].min;
      const back = V.decode(s, '#' + V.encode(s, v));
      expect(back).toEqual(v);
    }
    expect(V.decode(V.specs.exc, '#cost')).toBeNull();
    expect(V.decode(V.specs.exc, '#vz-exc=<script>')).toBeNull();
  });
  it('formats money compactly and never shows NaN', () => {
    expect(V.money(2_203_000)).toBe('$2.20M');
    expect(V.money(94_000)).toBe('$94k');
    expect(V.money(0)).toBe('$0');
    expect(V.money(10.44, 'EUR')).toBe('\u20ac10.44');
    expect(V.fmt(NaN, 'num')).toBe('\u2013');
  });
});

describe('visual assets: CSP, motion and privacy', () => {
  const js = src('assets/vz.js') + src('assets/vz-core.js');
  it('sets no style attribute, no inline handlers, no network, no storage', () => {
    expect(js).not.toMatch(/setAttribute\(\s*'style'|\.style\.|cssText|\son[a-z]+="/);
    expect(js).not.toMatch(/fetch\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie|sendBeacon/);
  });
  it('honours prefers-reduced-motion in script and CSS (final state shown)', () => {
    expect(src('assets/vz.js')).toMatch(/prefers-reduced-motion: reduce/);
    expect(src('assets/vz.js')).toMatch(/if \(reduced\(\) \|\| !window\.requestAnimationFrame/);
    expect(src('assets/vz.js')).toMatch(/if \(reduced\(\) \|\| !\('IntersectionObserver' in window\)\) \{ fn\(\); return; \}/);
    const css = src('assets/vz.css');
    const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toMatch(/stroke-dashoffset: 0/);
    expect(rm).toMatch(/\.grow \{ transform: none; \}/);
  });
  it('keeps the Talk to the book button away from the new visuals', () => {
    const site = src('assets/site.js');
    ['.vz-calc', '.vz-clerk', '.vz-own', '.vz-rm', '.vz-pic', '.vz-ctl'].forEach((c) => expect(site).toContain(c));
  });
  it('names no employer or vendor in the visuals', () => {
    expect(js).not.toMatch(/Avant|SAP\b|Oracle|Salesforce|Coupa|Workday/);
  });
});

describe('pages carry the visuals', () => {
  it('loads the engine only on pages flagged vz, after the core', () => {
    for (const p of PAGES) {
      const h = html(p.out);
      if (p.vz) {
        expect(h.indexOf('/assets/vz-core.js'), p.out).toBeGreaterThan(0);
        expect(h.indexOf('/assets/vz.js')).toBeGreaterThan(h.indexOf('/assets/vz-core.js'));
      } else expect(h, p.out).not.toContain('/assets/vz.js');
    }
  });
  it('frameworks: exception calculator, ownership map and roadmap, each with a no-JS fallback', () => {
    const h = html('frameworks/index.html');
    ['calc:exc', 'owners', 'roadmap'].forEach((k) => expect(h).toContain(`data-vz="${k}"`));
    expect(h).toMatch(/<noscript><p class="fw-formula">C = N/);
    expect(h).toMatch(/<noscript><ul class="fw-list"><li><strong>CFO\.<\/strong>/);
  });
});

describe('one order, 2026 vs month 30 (Ch 30.5)', () => {
  it('uses the book per-order figures', () => {
    expect(V.ORDER_BOOK).toMatchObject({ touchesT: 31, touchesR: 3, hoursT: 15.5, minutesR: 35, cashT: 140, cashR: 73, disputeT: 38, disputeR: 1 });
  });
  it('scales person hours with the visitor volume and share', () => {
    const r = run('order', { n: 1000, rate: 50, s: 100 });
    expect(row(r, 'Person hours a year').today).toBe(15500);
    expect(row(r, 'Person hours a year').re).toBeCloseTo(1000 * 35 / 60, 6);
    expect(row(r, 'Cost of person time a year').re).toBeCloseTo(1000 * 35 / 60 * 50, 6);
    const none = run('order', { s: 0 });
    expect(row(none, 'Person hours a year').re).toBe(row(none, 'Person hours a year').today);
  });
  it('keeps day counts fixed to the book order, whatever the volume', () => {
    expect(row(run('order', { n: 50 }), 'Order to full cash (book order)')).toMatchObject({ today: 140, re: 73, fixed: true });
  });
});

describe('storyboards follow the approved standard', () => {
  const panels = (h: string, id: string) => {
    const sec = h.slice(h.indexOf(`id="${id}"`));
    const ol = sec.slice(sec.indexOf('<ol'), sec.indexOf('</ol>'));
    return ol.split('<li').slice(1);
  };
  it('book: one order end to end in 8 panels, each with number, title, picture and a short caption', () => {
    const ps = panels(html('book/index.html'), 'one-order');
    expect(ps.length).toBe(8);
    ps.forEach((p, i) => {
      expect(p).toMatch(/data-pic="(icon|bars|gauge|dots|level|chain)\|/);
      expect(p).toContain(`<span class="md-panel-n" aria-hidden="true">${i + 1}</span>`);
      expect(p).toMatch(/<h3>[^<]{5,40}<\/h3>/);
      const cap = (p.match(/<\/h3>\s*<p>([\s\S]*?)<\/p>/) as RegExpMatchArray)[1].replace(/&[a-z]+;/g, 'x');
      expect(cap.split(/\s+/).length, cap).toBeLessThanOrEqual(34);
      cap.split(/\.\s/).forEach((sent) => expect(sent.split(/\s+/).length, sent).toBeLessThanOrEqual(25));
    });
    expect(html('book/index.html')).toContain('data-vz="calc:order"');
  });
});

describe('exception queue (Ch 25.3.6) and one clerk (Table 24.8)', () => {
  it('reproduces the book: 432 a day, about 20 people today, about 3 supervisors with the agent', () => {
    const r = run('queue');
    expect(row(r, 'Exceptions a day').today).toBeCloseTo(432, 6);
    expect(row(r, 'Person hours a day').today).toBeCloseTo(144, 6);
    expect(row(r, 'Person hours a day').re).toBeCloseTo(21.6, 6);
    expect(Math.round(row(r, 'People needed on the queue').today)).toBe(21);
    expect(Math.round(row(r, 'People needed on the queue').re)).toBe(3);
  });
  it('marks the hand-off share as the visitor’s own setting', () => {
    expect(V.specs.queue.inputs.find((i: Any) => i.k === 'ho').src).toBe(V.YOU);
  });
  it('the clerk table sums to 95% today and 51% after, so 44% is released', () => {
    expect(V.clerkTotals()).toEqual({ today: 95, after: 51 });
    expect(V.clerkTeam(85, 1800).released).toBeCloseTo(0.44, 6);
    expect(V.clerkTeam(85, 1800).hours).toBeCloseTo(85 * 1800 * 0.44, 6);
  });
  it('organization page: storyboard upgraded with pictures, queue calculator, clerk week; copy says 44%', () => {
    const h = html('blueprints/organization/index.html');
    expect(h).toContain('<ol class="md-story" data-vz="story">');
    expect((h.match(/data-pic="/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(h).toContain('data-vz="calc:queue"');
    expect(h).toContain('data-vz="clerk"');
    expect(h).toContain('About 44% of the clerk');
    expect(h).not.toContain('About 49% of the clerk');
  });
});

describe('estate (Ch 01.9, Ch 21.13.2) and simulator hours', () => {
  it('reproduces Meridian sizing: 400 x 110,000 x 20% = 8.8M; half realized = 4.4M', () => {
    const r = run('estate');
    expect(row(r, 'Capacity released (value a year)').re).toBeCloseTo(8_800_000, 0);
    expect(row(r, 'People cost a year').today - row(r, 'People cost a year').re).toBeCloseTo(4_400_000, 0);
    expect(row(r, 'Capacity released (people)').re).toBeCloseTo(80, 6);
  });
  it('applies only the book ratios to cycle time, and 10% per system touched', () => {
    expect(row(run('estate', { cyc: 140, ratio: 'o2c' }), 'Cycle time, at the book\u2019s ratio').re).toBeCloseTo(73, 6);
    expect(row(run('estate', { cyc: 9, ratio: 'close' }), 'Cycle time, at the book\u2019s ratio').re).toBeCloseTo(5, 6);
    expect(row(run('estate', { sys: 5, sysT: 4 }), 'Cost index from systems touched (today = 100)').re).toBeCloseTo(100 / 1.1, 6);
    expect(row(run('estate', { sys: 5, sysT: 5 }), 'Cost index from systems touched (today = 100)').re).toBeCloseTo(100, 6);
  });
  it('turns step counts into hours with the visitor’s own minutes', () => {
    const c = { a: { touches: 6, exPeople: 1, handoffs: 5 }, b: { touches: 0, exPeople: 1, handoffs: 6 } };
    const r = run('touch', { n: 1000, m: 10, x: 20, rate: 60 }, c);
    expect(row(r, 'Person hours a year').today).toBeCloseTo(1000 * 6.2 * 10 / 60, 6);
    expect(row(r, 'Person hours a year').re).toBeCloseTo(1000 * 0.2 * 10 / 60, 6);
    expect(row(r, 'Cost of person time a year').re).toBeCloseTo(1000 * 0.2 * 10, 6);
    V.specs.touch.inputs.filter((i: Any) => i.k !== 'rate').forEach((i: Any) => expect(i.src).toBe(V.YOU));
  });
  it('the simulator shares its counts from the same step rule (AE.flowStats)', () => {
    const sim = src('assets/sim.js');
    expect(sim).toContain("AE.simCounts = { a: S.stats(st.flow), b: AE.flowStats(wf.steps)");
    expect(sim).toContain("new CustomEvent('ae:sim-counts')");
  });
  it('pages: workflows, reimagine and models carry their visuals', () => {
    expect(html('workflows/index.html')).toContain('data-vz="calc:touch"');
    expect(html('reimagine/index.html')).toContain('data-vz="calc:estate"');
    const m = html('blueprints/models/index.html');
    expect(m).toContain('<ol class="md-story" data-vz="story">');
    expect(m).toContain('data-pic="gauge|0.87|0.81"');
  });
});

describe('add your own details: overrides replace the book default as the formula says', () => {
  const ids = ['exc', 'queue', 'order', 'estate', 'touch'];
  it('every calculator offers own details, blank by default, each citing the book default it replaces', () => {
    ids.forEach((id) => {
      const s = V.specs[id];
      expect(s.own.length, id).toBeGreaterThanOrEqual(2);
      s.own.forEach((i: Any) => {
        expect(V.defaults(s)[i.k], id + i.k).toBeNull();
        expect(i.src).toMatch(/^Ch \d\d\.\d|^Hours bases$/);
        expect(i.book.length).toBeGreaterThan(2);
      });
    });
  });
  it('defaults are unchanged and their rows say "Book default (Ch ...)"', () => {
    const e = run('estate');
    expect(row(e, 'Cycle time, at the book\u2019s ratio').basis).toBe('Ch 01.9.2');
    expect(row(run('estate', { cyc: 140, ratio: 'o2c' }), 'Cycle time, at the book\u2019s ratio').basis).toBe('Ch 30.5.1');
    expect(row(run('order'), 'Order to full cash (book order)').basis).toBe('Ch 30.5.1');
    ids.filter((id) => id !== 'touch').forEach((id) => {
      run(id).rows.filter((r: Any) => r.basis).forEach((r: Any) => expect(r.basis, id).toMatch(/^Ch \d\d\.\d/));
    });
  });
  it('estate: target cycle time, overtime and contractors, cost per system', () => {
    const r = run('estate', { cyc: 9, tgt: 6, ot: 1_000_000, sp: 20, sys: 5, sysT: 4 });
    expect(row(r, 'Cycle time, your target')).toMatchObject({ today: 9, re: 6, basis: 'you' });
    expect(row(r, 'People cost a year').today).toBeCloseTo(400 * 110000 + 1_000_000, 6);
    expect(row(r, 'Capacity released (value a year)').re).toBeCloseTo((44_000_000 + 1_000_000) * 0.2, 6);
    expect(row(r, 'People cost a year').today - row(r, 'People cost a year').re).toBeCloseTo(45_000_000 * 0.2 * 0.5, 6);
    expect(row(r, 'Cost index from systems touched (today = 100)').re).toBeCloseTo(100 / 1.2, 6);
    expect(r.formula.filter((f: string) => /^Your figure/.test(f)).length).toBe(3);
  });
  it('order: own hours, own cut, own cash days and target', () => {
    const r = run('order', { n: 1000, rate: 50, s: 100, hT: 10 });
    expect(row(r, 'Person hours a year').today).toBeCloseTo(10000, 6);
    expect(row(r, 'Person hours a year').re).toBeCloseTo(1000 * 10 * (35 / 60) / 15.5, 6);
    const c = run('order', { n: 1000, hT: 10, cut: 80 });
    expect(row(c, 'Person hours a year').re).toBeCloseTo(1000 * 2, 6);
    expect(row(run('order', { cT: 60 }), 'Order to full cash (your order)')).toMatchObject({ today: 60, re: 60 * 73 / 140, basis: 'you' });
    expect(row(run('order', { cT: 60, cR: 30 }), 'Order to full cash (your order)').re).toBe(30);
  });
  it('exceptions: own fall in the exception rate and rework', () => {
    const r = run('exc', { drop: 25, rw: 10 });
    const base = run('exc');
    expect(row(r, 'Exceptions a year').re).toBeCloseTo(108000 * 0.75, 6);
    expect(row(r, 'Exception cost a year').today).toBeCloseTo(row(base, 'Exception cost a year').today * 1.1, 3);
    expect(row(r, 'Exception cost a year').re).toBeCloseTo(row(base, 'Exception cost a year').re * 0.75 * 1.1, 3);
    expect(row(r, 'Exception cost a year').basis).toBe('you');
  });
  it('queue: rework, separate queues rounding up, premium', () => {
    const r = run('queue', { rw: 10, q: 4, prem: 20 });
    expect(row(r, 'Person hours a day').today).toBeCloseTo(144 * 1.1, 6);
    expect(row(r, 'People needed on the queue').today).toBe(4 * Math.ceil(158.4 / 4 / 7));
    expect(row(r, 'People needed on the queue').re).toBe(4 * Math.ceil(21.6 * 1.1 / 4 / 7));
    expect(row(r, 'Cost of those people a year').re).toBeCloseTo(row(r, 'People needed on the queue').re * 110000 * 1.2, 6);
  });
  it('workflows hours: own agent-run minutes and rework', () => {
    const c = { a: { touches: 6, exPeople: 1, handoffs: 5 }, b: { touches: 1, exPeople: 1, handoffs: 6 } };
    const r = run('touch', { n: 1000, m: 10, x: 20, mB: 5, rw: 50 }, c);
    expect(row(r, 'Person hours a year').today).toBeCloseTo(1000 * 6.2 * 1.5 * 10 / 60, 6);
    expect(row(r, 'Person hours a year').re).toBeCloseTo(1000 * 1.2 * 1.5 * 5 / 60, 6);
  });
  it('own details round-trip through the URL hash only, and blank stays the book default', () => {
    ids.forEach((id) => {
      const s = V.specs[id], v = V.defaults(s);
      v[s.own[0].k] = s.own[0].min;
      expect(V.decode(s, '#' + V.encode(s, v))).toEqual(v);
      expect(V.encode(s, V.defaults(s))).toBe('vz-' + id + '=');
    });
  });
  it('the ask text names the visitor figures, stays under the guide limit and asks for Hemanth', () => {
    const s = V.specs.estate, v = { ...V.defaults(s), tgt: 6 };
    const t = V.askText(s, v, s.compute(v));
    expect(t).toContain('Your target cycle time, in days 6 days');
    expect(t).toMatch(/ask Hemanth\.$/);
    expect(t.length).toBeLessThanOrEqual(560);
  });
});

describe('ask Hemanth call to action', () => {
  const js = src('assets/vz.js');
  it('sits under every calculator with the guide link and LinkedIn, no email and no form', () => {
    expect(js).toContain('Have more details or a different situation? Ask Hemanth.');
    expect(js).toContain("'/talk/#ask=' + encodeURIComponent(V.askText(spec, v, r))");
    expect(V.LINKEDIN).toBe('https://www.linkedin.com/in/hemanth-reganti-147153178/');
    expect(js).toContain('Add your own details');
    expect(js + src('assets/vz-core.js')).not.toMatch(/@[a-z0-9-]+\.(com|org|edu)|mailto:|<form/i);
  });
  it('the guide prefills from #ask= without sending, and clears the hash', () => {
    const g = src('assets/guide.js');
    expect(g).toContain('/^#ask=([^#]*)$/');
    expect(g).toContain('history.replaceState(null, \'\', window.location.pathname + window.location.search)');
  });
  it('every calculator page carries a calculator the CTA renders into', () => {
    [['reimagine/index.html', 'estate'], ['frameworks/index.html', 'exc'], ['book/index.html', 'order'], ['blueprints/organization/index.html', 'queue'], ['workflows/index.html', 'touch']]
      .forEach(([p, id]) => expect(html(p)).toContain(`data-vz="calc:${id}"`));
  });
});

describe('visuals part 5: maps and flows', () => {
  const words = (t: string) => t.replace(/&[a-z]+;/g, 'x').split(/\.\s|\?\s/).forEach((s) => expect(s.split(/\s+/).filter(Boolean).length, s).toBeLessThanOrEqual(25));
  it('home: five-decision map, each node with question, answer, chapter and a link to its tool; cards stay as no-JS list', () => {
    expect(V.DECISIONS.length).toBe(5);
    V.DECISIONS.forEach((d: Any) => {
      expect(d.c).toMatch(/^Ch \d\d\.\d/);
      expect(d.href).toMatch(/^\/[a-z/-]*\/(#[a-z-]+)?$/);
      words(d.a); words(d.q);
    });
    const h = html('index.html');
    expect(h).toContain('data-vz="decisions"');
    expect(h).toMatch(/<ol class="mgmt-grid">/);
    expect(src('assets/vz.css')).toContain('.mgmt-grid[hidden] { display: none; }');
    expect(src('assets/vz.js')).toMatch(/list\.hidden = true;[\s\S]*Show all five as a list/);
  });
  it('flows: every node cites a chapter, captions are plain (<=25 words a sentence), every case walks real edges', () => {
    for (const [id, F] of Object.entries(V.FLOWS) as [string, Any][]) {
      for (const [k, n] of Object.entries(F.nodes) as [string, Any][]) {
        expect(n.c, `${id}.${k}`).toMatch(/^(Ch \d\d(\.\d+)*(, Table [\d.]+)?(, Ch \d\d(\.\d+)*)?|Practice)$/);
        words(n.d);
        expect((n.s as string).length, `${id}.${k}.s`).toBeLessThanOrEqual(23);
        expect((n.t as string).length, `${id}.${k}.t`).toBeLessThanOrEqual(22);
      }
      const has = (a: string, b: string) => F.edges.some((e: Any) => e[0] === a && e[1] === b);
      F.cases.forEach((c: Any) => {
        c.route.forEach((k: string, i: number) => { expect(F.nodes[k], `${id}:${k}`).toBeTruthy(); if (i) expect(has(c.route[i - 1], k), `${id} ${c.id} ${c.route[i - 1]}>${k}`).toBe(true); });
        words(c.end); Object.values(c.say || {}).forEach((t) => words(t as string));
        Object.values(c.sub || {}).forEach((t) => expect((t as string).length).toBeLessThanOrEqual(23));
      });
      // No two nodes share a grid cell, in either layout.
      for (const lay of ['w', 'n']) {
        if (lay === 'n' && F.narrow === 'route') continue;
        const cells = Object.values(F.nodes).map((n: Any) => String(n[lay]));
        expect(new Set(cells).size, `${id} ${lay}`).toBe(cells.length);
      }
    }
  });
  it('inference flow uses the book routing shares (Ch 21.14.3) and they sum to 100', () => {
    const to = V.FLOWS.inference.cases[0].swarm.to;
    expect(to).toEqual({ rules: 39, tab: 8, small: 4, front: 13, person: 36 });
  });
  it('design page carries the find-ground-cite and routing flows, with a no-JS list', () => {
    const h = html('blueprints/design/index.html');
    expect(h).toContain('data-vz="flow:rag"');
    expect(h).toContain('data-vz="flow:inference"');
    expect(h).toMatch(/<noscript><ol class="fw-list"><li><b>Resolve<\/b>/);
  });
  it('flows honour reduced motion: final state at once, no token travel', () => {
    const js = src('assets/vz.js');
    expect(js).toMatch(/if \(reduced\(\)\) \{ show\(C\(\)\.route\.length - 1\); if \(C\(\)\.swarm\) swarm\(true\); \}/);
    expect(js).toMatch(/if \(reduced\(\) \|\| !e \|\| !e\.getTotalLength/);
  });
  it('the floating Talk-to-the-book button avoids the new visual containers', () => {
    ['.vz-flow', '.vz-lad', '.vz-pair', '.vz-chap', '.vz-cases'].forEach((c) => expect(src('assets/site.js')).toContain(c));
  });
});
