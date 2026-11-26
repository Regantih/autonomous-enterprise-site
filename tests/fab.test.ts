import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

// "Talk to the book" must never sit on a diagram, table or matrix: at any width, on first load before any
// scroll, and after a resize. Runs the real site.js against a tiny fake page.
const SRC = readFileSync(fileURLToPath(new URL('../src/assets/site.js', import.meta.url)), 'utf8');
type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
const rect = (l: number, t: number, w: number, h: number): Rect => ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h });

function page(vw: number, vh: number, diagram: Rect | null) {
  const classes = new Set<string>(['guide-fab']);
  const attrs: Record<string, string> = {};
  const fab = {
    offsetWidth: 194, offsetHeight: 52,
    classList: {
      contains: (c: string) => classes.has(c),
      toggle: (c: string, on?: boolean) => { const v = on ?? !classes.has(c); if (v) classes.add(c); else classes.delete(c); return v; },
      add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c),
    },
    contains: () => false,
    setAttribute: (k: string, v: string) => { attrs[k] = v; }, removeAttribute: (k: string) => { delete attrs[k]; },
    getAttribute: (k: string) => attrs[k] ?? null, addEventListener: () => {},
  };
  const state = { diagram };
  const el = { getBoundingClientRect: () => state.diagram ?? rect(0, 0, 0, 0), closest: () => null };
  const listeners: Record<string, (() => void)[]> = {};
  const win: Record<string, unknown> = {
    innerHeight: vh, pageYOffset: 0,
    matchMedia: (q: string) => ({ matches: /max-width: 59\.99rem/.test(q) ? vw < 960 : false }),
    getComputedStyle: () => ({ right: '20px', bottom: '20px' }),
    addEventListener: (t: string, f: () => void) => { (listeners[t] ||= []).push(f); },
    requestAnimationFrame: (f: () => void) => f(),
  };
  const doc = {
    documentElement: { classList: { add: () => {} }, clientWidth: vw },
    body: {}, activeElement: null,
    querySelector: (s: string) => (s === '.guide-fab' ? fab : null),
    querySelectorAll: (s: string) => (/\.sl-wrap/.test(s) && /table/.test(s) && /matrix/.test(s) ? [el] : []),
    addEventListener: () => {}, getElementById: () => null,
  };
  win.document = doc; win.window = win;
  vm.runInNewContext(SRC, { window: win, document: doc, navigator: {}, setTimeout: () => 0, WeakSet, URL, ...win });
  return {
    away: () => classes.has('fab-away'),
    resize: (w: number, h: number, d: Rect | null) => { doc.documentElement.clientWidth = w; win.innerHeight = h; state.diagram = d; listeners.resize.forEach((f) => f()); },
  };
}

describe('Talk to the book button', () => {
  for (const [vw, vh] of [[390, 844], [1024, 768], [1440, 900], [1920, 1080]]) {
    it(`steps away on first load when a diagram is under its corner at ${vw}px`, () => {
      // Swimlane's last step in the bottom-right corner, no scroll yet.
      expect(page(vw, vh, rect(vw - 300, vh - 200, 280, 400)).away()).toBe(true);
    });
    it(`stays reachable when its corner is clear at ${vw}px`, () => {
      expect(page(vw, vh, rect(20, 100, 300, 200)).away()).toBe(false);
    });
  }
  it('re-checks on resize', () => {
    const p = page(1920, 1080, rect(20, 100, 600, 300));
    expect(p.away()).toBe(false);
    p.resize(1024, 768, rect(20, 400, 1000, 600));
    expect(p.away()).toBe(true);
    p.resize(1920, 1080, rect(20, 100, 600, 300));
    expect(p.away()).toBe(false);
  });
  it('avoids every kind of diagram the Blueprints pages draw', () => {
    for (const s of ['svg', 'table', 'canvas', '.sl-wrap', '.fw-table-wrap', '.ar-svg-wrap', '.hf-svg-wrap', '.gr-canvas', '.wf-grid', '.ar-grid', '.lr-console', '.ctl-map', '[class*="matrix"]']) {
      expect(SRC).toContain(s);
    }
  });
});
