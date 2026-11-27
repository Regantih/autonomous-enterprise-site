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
