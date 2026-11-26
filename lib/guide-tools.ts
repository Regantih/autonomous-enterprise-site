import { KNOWLEDGE } from './knowledge.generated';
import { routeQuestion, subgraphText, traverseKg, traverseSkills, type Subgraph } from './graph';

/**
 * The guide's tools. All of them are code that runs on the server; none calls a model.
 *   search_book   keyword search over the knowledge pack (chapters, glossary), returns passages with chapter tags
 *   ask_graph     routes a question and traverses the site's knowledge graph and skill graph (the graph agent's code)
 *   suggest_page  recommends one page of this site, with a reason
 *   start_intake  hands the visitor to the intake agent; nothing is stored until they consent and press Send there
 */

// ---------- knowledge pack as searchable passages ----------

export interface Passage {
  id: number;
  section: string;
  text: string;
  cites: string[];
}

const pad = (n: string) => n.padStart(2, '0');

/** Reads chapter tags such as "Ch 24, 22, 25, 01", "Ch 1–11" or "(Ch 26)" into labels like "Ch 24" or "Ch 01–11". */
export function chapterTags(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\bCh\s+(\d{1,2}(?:\s*[–-]\s*\d{1,2})?(?:\s*,\s*(?:Ch\s+)?\d{1,2}(?:\s*[–-]\s*\d{1,2})?)*)/g)) {
    for (const part of m[1].split(/\s*,\s*/)) {
      const p = part.replace(/^Ch\s+/, '');
      const r = p.match(/^(\d{1,2})\s*[–-]\s*(\d{1,2})$/);
      const label = r ? `Ch ${pad(r[1])}–${pad(r[2])}` : `Ch ${pad(p)}`;
      if (!out.includes(label)) out.push(label);
    }
  }
  return out;
}

function buildPassages(md: string): Passage[] {
  const out: Passage[] = [];
  const parts = md.split(/\n## /).slice(1);
  for (const part of parts) {
    const [heading, ...lines] = part.split('\n');
    const sectionTags = chapterTags(heading);
    const section = heading.replace(/\s*\((?:Book, )?[^)]*Ch [^)]*\)\s*$/, '').trim();
    for (const line of lines) {
      const text = line.replace(/^(?:-|\d+\.)\s+/, '').trim();
      if (!text) continue;
      const own = chapterTags(text);
      out.push({ id: out.length, section, text, cites: own.length ? own : sectionTags });
    }
  }
  return out;
}

export const PASSAGES = buildPassages(KNOWLEDGE);
/** Every chapter label the pack carries; a citation outside this set is dropped. */
export const KNOWN_CITES = new Set(PASSAGES.flatMap((p) => p.cites));

const STOP = new Set('a an and are as at be by can do does for from has have how i in is it its me my of on or our should so that the their them then there these they this to us we what when where which who why will with you your about into than not no'.split(' '));
const stem = (w: string) => w.replace(/(ies|es|s|ing|ed)$/, '') || w;
export function terms(q: string): string[] {
  return [...new Set(q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem))];
}

const DOC_TERMS = PASSAGES.map((p) => terms(`${p.section} ${p.text}`));
const DF = new Map<string, number>();
for (const ts of DOC_TERMS) for (const t of new Set(ts)) DF.set(t, (DF.get(t) ?? 0) + 1);

/** Deterministic keyword search: inverse-document-frequency weights, a bonus for matches in the section heading. */
export function searchBook(query: string, k = 4): Passage[] {
  const qs = terms(query);
  if (!qs.length) return [];
  const n = PASSAGES.length;
  const scored = PASSAGES.map((p, i) => {
    const doc = DOC_TERMS[i];
    const head = terms(p.section);
    let s = 0;
    for (const q of qs) {
      const hit = doc.some((d) => d === q || (q.length > 4 && d.startsWith(q)));
      if (!hit) continue;
      s += Math.log(1 + n / (DF.get(q) ?? 1));
      if (head.includes(q)) s += 0.5;
    }
    return { p, s };
  }).filter((x) => x.s > 0);
  scored.sort((a, b) => b.s - a.s || a.p.id - b.p.id);
  return scored.slice(0, k).map((x) => x.p);
}

// ---------- pages ----------

export interface SitePage { id: string; href: string; title: string; about: string }
export const SITE_PAGES: SitePage[] = [
  { id: 'blueprints', href: '/blueprints/', title: 'Blueprints', about: 'The hub: architecture, workflows, controls, designer and the tools.' },
  { id: 'organization', href: '/blueprints/organization/', title: 'Organization', about: 'Roles, pods, decision rights, autonomy levels, internal versus external agents and trust.' },
  { id: 'trust', href: '/blueprints/organization/#trust', title: 'Internal vs external agents', about: 'How agents differentiate and how trust is earned, verified and withdrawn.' },
  { id: 'operations', href: '/blueprints/operations/', title: 'Operations', about: 'Tracing, dashboards, registry, audits, kill switch, reliability and pipelines.' },
  { id: 'models', href: '/blueprints/models/', title: 'Models', about: 'Every model family the book uses and where it fits.' },
  { id: 'design', href: '/blueprints/design/', title: 'Design choices', about: 'Tabular models, retrieval, evals, agent security, inference budgets, models versus rules.' },
  { id: 'controls', href: '/controls/', title: 'Controls', about: 'A filterable library of controls for agents, mapped to public frameworks.' },
  { id: 'loops', href: '/blueprints/loops/', title: 'Loops', about: 'Self-improving loops with a live operations room you can steer.' },
  { id: 'graphs', href: '/blueprints/graphs/', title: 'Graphs', about: 'A knowledge graph of sample payables data, a skill graph and the graph agent.' },
  { id: 'frameworks', href: '/frameworks/', title: 'Frameworks', about: 'The autonomy scale, the harness, the weakest link and the 30-month plan.' },
  { id: 'architecture', href: '/architecture/', title: 'Architecture', about: 'The layered reference architecture for agent-operated work.' },
  { id: 'workflows', href: '/workflows/', title: 'Workflows', about: 'Nine workflows redrawn for agents, with levels and controls.' },
  { id: 'designer', href: '/designer/', title: 'Designer', about: 'Design a workflow and get its autonomy ceiling and controls.' },
  { id: 'leaders', href: '/leaders/', title: 'Questions leaders ask', about: 'Funding, governance, hiring and trust, with tools.' },
  { id: 'book', href: '/book/', title: 'The book', about: 'What is inside, who it is for and where to buy.' },
];
export const PAGE_BY_ID = new Map(SITE_PAGES.map((p) => [p.id, p]));

// ---------- intake handoff ----------

export type HandoffIntent = 'talk' | 'advisory' | 'media';
export const HANDOFFS: Record<HandoffIntent, { href: string; label: string }> = {
  talk: { href: '/speaking/#speaking', label: 'Request a talk' },
  advisory: { href: '/speaking/#advisory', label: 'Request advisory' },
  media: { href: '/contact/#media', label: 'Request an interview' },
};

// ---------- tool calls ----------

export const INFO_TOOLS = ['search_book', 'ask_graph'] as const;
export const ACTION_TOOLS = ['suggest_page', 'start_intake'] as const;
export type ToolName = (typeof INFO_TOOLS)[number] | (typeof ACTION_TOOLS)[number];
export const isToolName = (v: unknown): v is ToolName => typeof v === 'string' && ([...INFO_TOOLS, ...ACTION_TOOLS] as string[]).includes(v);

export interface ToolCall { name: ToolName; args: Record<string, unknown> }

/** One line of the visible tool trace. */
export interface TraceItem { tool: ToolName; label: string; detail?: string; href?: string }
export interface PageCard { id: string; href: string; title: string; reason: string }
export interface Handoff { intent: HandoffIntent; href: string; label: string }

export interface ToolResult {
  trace: TraceItem;
  /** Text the model reads on its next step (info tools only). */
  forModel?: string;
  cites?: string[];
  page?: PageCard;
  handoff?: Handoff;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const words = (t: string, n: number) => t.split(/\s+/).filter(Boolean).slice(0, n).join(' ');

function graphSummary(subs: Subgraph[]): string {
  return subs.map((s) => `${s.graph === 'kg' ? 'knowledge graph' : 'skill graph'} ${s.nodes.length} nodes`).join(', ');
}

/** Runs one tool. Bad arguments come back as a trace line that says so; nothing throws. */
export function runTool(call: ToolCall, visitorText = ''): ToolResult {
  if (call.name === 'search_book') {
    const query = str(call.args.query, 200) || visitorText.slice(0, 200);
    const hits = searchBook(query);
    const cites = [...new Set(hits.flatMap((h) => h.cites))];
    if (!hits.length) {
      return { trace: { tool: 'search_book', label: 'Searched the book: no passage matched', detail: query }, forModel: `search_book("${query}"): no passage matched. The book may not cover this.`, cites: [] };
    }
    const body = hits.map((h) => `[${h.cites.join(', ') || 'no chapter tag'}] ${h.section}: ${h.text}`).join('\n');
    return {
      trace: { tool: 'search_book', label: `Searched the book: ${cites.join(', ') || 'overview'}`, detail: query },
      forModel: `search_book("${query}") returned ${hits.length} passages:\n${body}`,
      cites,
    };
  }
  if (call.name === 'ask_graph') {
    const q = str(call.args.question, 300) || visitorText.slice(0, 300);
    const route = routeQuestion(q);
    const subs: Subgraph[] = [];
    if (route.graphs.kg) subs.push(traverseKg(q, 14));
    if (route.graphs.skills) subs.push(traverseSkills(q, 14));
    const text = subgraphText(subs).slice(0, 3500);
    return {
      trace: { tool: 'ask_graph', label: `Checked the graphs: ${graphSummary(subs)}`, detail: q, href: '/blueprints/graphs/' },
      forModel: `ask_graph("${q}") selected this subgraph in code. The knowledge graph is synthetic sample accounts-payable data, not a real company:\n${text}`,
      cites: [],
    };
  }
  if (call.name === 'suggest_page') {
    const id = str(call.args.page, 40).toLowerCase().replace(/^\/|\/$/g, '');
    const page = PAGE_BY_ID.get(id) ?? SITE_PAGES.find((p) => p.href === `/${id}/` || p.href.replace(/^\/blueprints/, '') === `/${id}/`);
    if (!page) return { trace: { tool: 'suggest_page', label: 'Suggested a page that does not exist; dropped' } };
    const reason = words(str(call.args.reason, 200), 25) || page.about;
    return { trace: { tool: 'suggest_page', label: `Suggested: ${page.title} page`, href: page.href }, page: { id: page.id, href: page.href, title: page.title, reason } };
  }
  const intent = str(call.args.intent, 20).toLowerCase() as HandoffIntent;
  const h = HANDOFFS[intent] ?? HANDOFFS.advisory;
  const which = HANDOFFS[intent] ? intent : 'advisory';
  return {
    trace: { tool: 'start_intake', label: `Handed off: intake agent (${which === 'talk' ? 'a talk' : which === 'media' ? 'an interview' : 'advisory'})`, href: h.href },
    handoff: { intent: which, href: h.href, label: h.label },
  };
}
