import { KNOWLEDGE } from './knowledge.generated';
import { routeQuestion, subgraphText, traverseKg, traverseSkills, type Subgraph } from './graph';
import { factSheet } from './fact-check';

/**
 * The guide's tools. All of them are code that runs on the server; none calls a model.
 *   search_book   keyword search over the knowledge pack (chapters, glossary, agent team), returns passages with chapter tags
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
/** The passage's subject: the words before its first colon or bracket ("Journal agent", "Trust tier"). */
const LEAD_TERMS = PASSAGES.map((p) => terms(p.text.split(/[:(]/)[0].split(/\s+/).slice(0, 8).join(' ')));
const DF = new Map<string, number>();
for (const ts of DOC_TERMS) for (const t of new Set(ts)) DF.set(t, (DF.get(t) ?? 0) + 1);

/** Deterministic keyword search: inverse-document-frequency weights, a bonus for matches in the section heading and in the passage's subject. */
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
      // A passage about the very thing asked for (an agent or a term by name) beats one that only mentions it.
      if (LEAD_TERMS[i].includes(q)) s += 0.25;
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
  { id: 'team', href: '/blueprints/team/', title: 'Agent operations team', about: 'Every agent the book names, by department, with its level, owner, limits, KPIs and chapter.' },
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
/** What the visitor actually asked for; it names the trace line and the button. */
export type RequestKind = 'workshop' | 'keynote' | 'talk' | 'board session' | 'advisory' | 'interview' | 'podcast';
const KIND_INTENT: Record<RequestKind, HandoffIntent> = { workshop: 'talk', keynote: 'talk', talk: 'talk', 'board session': 'talk', advisory: 'advisory', interview: 'media', podcast: 'media' };
const DEFAULT_KIND: Record<HandoffIntent, RequestKind> = { talk: 'talk', advisory: 'advisory', media: 'interview' };
const article = (k: RequestKind) => (k === 'advisory' ? 'advisory' : k === 'interview' ? 'an interview' : `a ${k}`);

/** The kind of request the visitor named, read in code from their words (null when none is named). */
export function requestKind(text: string): RequestKind | null {
  const t = text.toLowerCase();
  if (/\bpodcast/.test(t)) return 'podcast';
  if (/\binterview/.test(t)) return 'interview';
  if (/\bworkshop|masterclass/.test(t)) return 'workshop';
  if (/\bkeynote/.test(t)) return 'keynote';
  if (/\bboard (session|briefing|meeting)/.test(t)) return 'board session';
  if (/\b(advisory|advisor|adviser|advise|consult|consulting)/.test(t)) return 'advisory';
  if (/\b(talk|speak|speaker|speaking|presentation|offsite|off-site|session|briefing|panel)\b/.test(t)) return 'talk';
  return null;
}
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
export interface Handoff { intent: HandoffIntent; kind: RequestKind; href: string; label: string }

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
    const hits = teamIntent(query) || teamIntent(visitorText) ? searchTeam(teamIntent(query) ? query : `${visitorText} ${query}`) : searchBook(query);
    const cites = [...new Set(hits.flatMap((h) => h.cites))];
    if (!hits.length) {
      return { trace: { tool: 'search_book', label: 'Searched the book: no passage matched', detail: query }, forModel: `search_book("${query}"): no passage matched. The book may not cover this.`, cites: [] };
    }
    const body = hits.map((h) => `[${h.cites.join(', ') || 'no chapter tag'}] ${h.section}: ${h.text}`).join('\n');
    return {
      trace: { tool: 'search_book', label: `Searched the book: ${cites.slice(0, 4).join(', ') || 'overview'}${cites.length > 4 ? ` and ${cites.length - 4} more` : ''}`, detail: query },
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
    const sheet = factSheet(subs);
    const text = `${sheet ? `${sheet}\n\n` : ''}${subgraphText(subs)}`.slice(0, 3800);
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
  const asked = str(call.args.intent, 20).toLowerCase() as HandoffIntent;
  const named = requestKind(visitorText);
  // The visitor's own words win over the model's guess; the button and the trace name what they asked for.
  const which: HandoffIntent = named ? KIND_INTENT[named] : HANDOFFS[asked] ? asked : 'advisory';
  const kind: RequestKind = named && KIND_INTENT[named] === which ? named : DEFAULT_KIND[which];
  const h = HANDOFFS[which];
  const label = `Request ${article(kind)}`;
  return {
    trace: { tool: 'start_intake', label: `Handed off: intake agent (${article(kind)})`, href: h.href },
    handoff: { intent: which, kind, href: h.href, label },
  };
}

// ---------- routing hints (code, deterministic) ----------

/**
 * A stated wish to book Hemanth for a talk, workshop, advisory or interview. Returns the intake intent, or null.
 * "Talk to the book" and questions about how to run a workshop are not wishes to book him.
 */
export function intakeIntent(text: string): HandoffIntent | null {
  const t = text.toLowerCase();
  const wish = /\b(want|wants|wanted|need|needs|would like|i'?d like|we'?d like|looking for|interested in|book|booking|hire|hiring|invite|inviting|arrange|organi[sz]e|schedule|request|get)\b/;
  const asksHim = /\b(can|could|would|will|does|is) (hemanth|the author|he)\b.{0,40}\b(speak|talk|present|run|lead|facilitate|advise|consult|keynote|join|do)\b/;
  const media = /\b(interview|podcast|panel|article|journalist|press|media|quote)\b/;
  const advisory = /\b(advisory|advisor|adviser|advise|consult|consulting|engagement|work with (hemanth|him|the author))\b/;
  const talk = /\b(workshop|keynote|talk|speaker|speaking|session|offsite|off-site|masterclass|briefing|presentation)\b/;
  if (!wish.test(t) && !asksHim.test(t)) return null;
  if (/talk to (the|this) (book|guide)/.test(t) && !/\b(workshop|keynote|speaker|advis|interview|podcast)/.test(t)) return null;
  if (media.test(t) && /\b(hemanth|author|him|you|interview|podcast)\b/.test(t)) return 'media';
  if (advisory.test(t)) return 'advisory';
  if (talk.test(t) || asksHim.test(t)) return 'talk';
  return null;
}

// ---------- the agent operations team (book data, not the sample graph) ----------

const TEAM_SECTION = 'Agent operations team';
const TEAM_PASSAGES = PASSAGES.filter((p) => p.section === TEAM_SECTION);
const DEPT_RE = /^(.+?) department \(([^;]+);/;
/** Department lines: the words that name each department ("procurement", "record-to-report", "supply chain"). */
const TEAM_DEPTS = TEAM_PASSAGES.flatMap((p) => {
  const m = p.text.match(DEPT_RE);
  if (!m || /\((?:agent|human role),/.test(p.text.split(':')[0])) return [];
  const names = [m[1], ...m[2].split(/[:,()]|\band\b/)].map((x) => x.toLowerCase().replace(/^finance\s*$/, '').trim()).filter((x) => x.length > 2);
  return [{ passage: p, names: [...new Set(names)] }];
});
/** Agent and human-role names the book's team data carries, longest first ("Journal verification agent" before "Journal agent"). */
export const TEAM_AGENT_NAMES = TEAM_PASSAGES
  .map((p) => p.text.match(/^(.+?) \((?:agent|human role),/)?.[1])
  .filter((x): x is string => !!x)
  .sort((a, b) => b.length - a.length);
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = (t: string, name: string) => new RegExp(`(^|[^a-z])${esc(name.toLowerCase())}s?([^a-z]|$)`).test(t);

/** The department lines a question names, by any of the department's names. */
export function teamDepartments(text: string): Passage[] {
  const t = text.toLowerCase().replace(/\u2019/g, "'");
  return TEAM_DEPTS.filter((d) => d.names.some((n) => mentions(t, n))).map((d) => d.passage);
}
/** The agent names a question names, longest match first, without counting a shorter name inside a longer one. */
export function teamAgents(text: string): string[] {
  let t = text.toLowerCase().replace(/\u2019/g, "'");
  const out: string[] = [];
  for (const n of TEAM_AGENT_NAMES) {
    if (mentions(t, n)) { out.push(n); t = t.replace(new RegExp(esc(n.toLowerCase()), 'g'), ' '); }
  }
  return out;
}

/**
 * A question about the book's agent operations team: it names a team agent, or asks which agents work in a book
 * department, their autonomy or who owns them. These are answered from the team data (search_book), never from the
 * synthetic sample graph. A question that says it is about the sample data or the graphs is not a team question.
 */
export function teamIntent(text: string): boolean {
  const t = text.toLowerCase().replace(/\u2019/g, "'");
  if (/\b(sample|synthetic|demo|knowledge graph|skill graph|the graphs?|graphs page)\b/.test(t)) return false;
  if (teamAgents(t).length) return true;
  if (/\b(agent (operations )?team|agent roster|every agent|which agents|what agents|how many agents)\b/.test(t)) return true;
  return /\bagents?\b/.test(t) && (teamDepartments(t).length > 0 || /\b(highest|most|lowest|autonomy|who owns|owner|department)\b/.test(t));
}

/** The chapter a team line gives its agent or department ("Ch 12.5.2", "Ch 14"), read from the line itself. */
export function teamCite(name: string): string | null {
  const p = TEAM_PASSAGES.find((x) => x.text.startsWith(`${name} (`)) ?? TEAM_DEPTS.find((d) => d.passage.text.startsWith(`${name} department (`))?.passage;
  return p?.text.split(':')[0].match(/;\s*(Ch [\d.]+(?:,\s*[\d.]+)*)\)$/)?.[1] ?? null;
}
/** Department short names as the team lines give them ("Procurement", "Record-to-report"). */
export const TEAM_DEPT_NAMES = TEAM_DEPTS.map((d) => d.passage.text.match(DEPT_RE)![1]);

/** Search for a team question: the named departments' lines first, then the named agents' lines, then keyword hits. */
export function searchTeam(query: string, k = 4): Passage[] {
  const out: Passage[] = [];
  const add = (p?: Passage) => { if (p && !out.includes(p) && out.length < k) out.push(p); };
  const depts = teamDepartments(query);
  const byName = (n: string) => TEAM_PASSAGES.find((p) => p.text.startsWith(`${n} (`));
  for (const d of depts) add(d);
  for (const n of teamAgents(query)) add(byName(n));
  // A department question: next, the agents that reach the department's highest autonomy (named on its line).
  for (const d of depts) for (const n of (d.text.match(/reached by ([^.]+)\./)?.[1] ?? '').split(/,\s*/)) add(byName(n.trim()));
  const teamHits = searchBook(query, 12).filter((p) => p.section === TEAM_SECTION);
  for (const p of teamHits) add(p);
  for (const p of searchBook(query, k)) add(p);
  return out;
}

/** A question about the site's synthetic sample data (suppliers, invoices, exceptions, controls, risk) or its agents' skills. */
export function graphIntent(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(sample|synthetic|demo|knowledge graph|skill graph|the graph|graphs)\b/.test(t)) return true;
  // A question that names a book department or agent is about the book's team, not the sample graph.
  if (teamIntent(t)) return false;
  if (/\b(riskiest|highest[- ]risk|most risky|which (supplier|vendor|invoice|control|exception|polic|agent))/.test(t)) return true;
  return /\b(suppliers?|vendors?|invoices?|exceptions?|controls?)\b.{0,40}\b(most|highest|riskiest|open|overdue|flagged|top|worst|list)\b/.test(t);
}

/**
 * Pages picked in code by the visitor's role or topic, so a CFO lands on cost and operations rather than the model
 * catalogue. Returns two page ids, or null when nothing matches (then the agent's own picks stand). Order matters:
 * the first rule that matches wins; a chip role beats words in the question.
 */
const PAGE_RULES: { role?: string; re?: RegExp; pages: [string, string] }[] = [
  { re: /\b(sample data|synthetic|riskiest|knowledge graph|skill graph)\b/, pages: ['graphs', 'controls'] },
  { re: /\b(supplier'?s? agent|outside agent|external agent|partner'?s? agent|customer'?s? agent|b2a)\b/, pages: ['trust', 'controls'] },
  { re: /\b(agent (operations )?team|which agents|what agents|agents? (does|do|in|for) (the )?(finance|procurement|supply chain|hr|it|tax|legal|front office|sales|service|close)|agent roster|every agent)\b/, pages: ['team', 'organization'] },
  { role: 'cfo-finance', re: /\b(cfo|roi|return on investment|cost per|business case|budget|fund(ing)?|finance|payback)\b/, pages: ['design', 'operations'] },
  { role: 'ceo-board', re: /\b(ceo|board|chief executive|founder|where do i start)\b/, pages: ['blueprints', 'organization'] },
  { role: 'risk-audit', re: /\b(risk|audit|auditor|compliance|accountab|who answers|liabilit|regulat)/, pages: ['controls', 'organization'] },
  { role: 'operations', re: /\b(operations|ops|supply chain|manufactur|logistics|procurement|plant)\b/, pages: ['workflows', 'operations'] },
  { role: 'investor', re: /\b(investor|invest|due diligence|portfolio|agent-ready|valuation)\b/, pages: ['book', 'frameworks'] },
  { role: 'cio-technology', re: /\b(cio|cto|architecture|tech stack|platform team)\b/, pages: ['architecture', 'models'] },
];

export function pagePlan(role: string, text: string): [string, string] | null {
  const t = text.toLowerCase().replace(/\u2019/g, "'");
  const topic = PAGE_RULES.slice(0, 3).find((r) => r.re!.test(t));
  if (topic) return topic.pages;
  const byRole = PAGE_RULES.find((r) => r.role && r.role === role);
  if (byRole) return byRole.pages;
  const byText = PAGE_RULES.slice(3).find((r) => r.re && r.re.test(t));
  return byText ? byText.pages : null;
}
