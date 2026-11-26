// Builds the knowledge graph, the skill graph and the enterprise brain map for /blueprints/graphs/.
// Deterministic: the same inputs always give the same JSON. Inputs are committed files only:
//   src/assets/data/ap-sample.json   150 synthetic AP exceptions (labelled sample data)
//   src/assets/data/controls.js      control IDs (no other IDs are used)
//   src/assets/data/architecture.js  the model portfolio (families, evals, mandatory controls)
//   lib/loop.ts, lib/agents.ts, lib/loop-caps.ts, functions/api/**  limits and whitelists, read from the source
// Output: src/assets/data/graphs.json (committed). scripts/build.mjs runs this on every build.
//   node tools/build-graphs.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const GRAPHS_OUT = join(ROOT, 'src', 'assets', 'data', 'graphs.json');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// ---------- inputs read from the real code ----------

function must(re, text, what) {
  const m = re.exec(text);
  if (!m) throw new Error(`build-graphs: could not read ${what} from the source`);
  return m;
}

export function readCodeFacts() {
  const loop = read('lib/loop.ts');
  const agents = read('lib/agents.ts');
  const caps = read('lib/loop-caps.ts');
  const step = read('functions/api/loop/step.ts');
  const base = must(/export const BASELINE: PolicyConfig = \{([\s\S]*?)\};/, loop, 'BASELINE')[1];
  const num = (k) => Number(must(new RegExp(`${k}:\\s*([0-9.]+)`), base, k)[1]);
  return {
    authority: Number(must(/POLICY_AUTHORITY_LIMIT = (\d+)/, loop, 'POLICY_AUTHORITY_LIMIT')[1]),
    oneWayLimit: Number(must(/ONE_WAY_LIMIT = (\d+)/, loop, 'ONE_WAY_LIMIT')[1]),
    doNotAutomate: [...must(/DO_NOT_AUTOMATE = \[([^\]]*)\]/, loop, 'DO_NOT_AUTOMATE')[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]),
    configKeys: [...must(/CONFIG_KEYS = \[([^\]]*)\]/, loop, 'CONFIG_KEYS')[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]),
    scorerRe: must(/SCORER_KEY_RE = \/(.*)\/i;/, loop, 'SCORER_KEY_RE')[1],
    baseline: {
      auto_approve_limit: num('auto_approve_limit'),
      match_tolerance_pct: num('match_tolerance_pct'),
      senior_review_above: num('senior_review_above'),
      small_supplier_protection: /small_supplier_protection:\s*true/.test(base),
      confidence_floor: num('confidence_floor'),
    },
    actionTypes: [...must(/ACTION_TYPES = \[([^\]]*)\]/, agents, 'ACTION_TYPES')[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]),
    callsPerRun: Number(must(/LOOP_CALLS_PER_RUN = (\d+)/, caps, 'LOOP_CALLS_PER_RUN')[1]),
    dailyCalls: Number(must(/GLOBAL_DAILY_CALLS = (\d+)/, caps, 'GLOBAL_DAILY_CALLS')[1]),
    agentsPerHour: Number(must(/AGENTS_VISITOR_LIMIT = (\d+)/, agents, 'AGENTS_VISITOR_LIMIT')[1]),
    loopActions: [...new Set([...step.matchAll(/action === '([a-z]+)'/g)].map((m) => m[1]))].sort(),
  };
}

export function loadAE() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of ['data/controls.js', 'data/layers.js', 'data/workflows.js', 'data/architecture.js']) {
    vm.runInContext(readFileSync(join(ROOT, 'src', 'assets', f), 'utf8'), ctx, { filename: f });
  }
  return ctx.window.AE;
}

export function loadSample() {
  return JSON.parse(read('src/assets/data/ap-sample.json'));
}

// ---------- helpers ----------

const r1 = (x) => Math.round(x * 10) / 10;
const money = (x) => `$${Math.round(x).toLocaleString('en-US')}`;
const TYPE_NAMES = {
  price_variance: 'Price variance', quantity_mismatch: 'Quantity mismatch', missing_po: 'Missing purchase order',
  duplicate_suspect: 'Suspected duplicate', tax_code: 'Tax code', bank_detail_change: 'Bank-detail change',
};
const VARIANCE = new Set(['price_variance', 'quantity_mismatch']);

/** The baseline routing of lib/loop.ts routeItem, for one exception. A test checks it matches the TypeScript. */
export function baselineRoute(it, B, facts) {
  if (it.amount > B.senior_review_above) return 'senior';
  if (facts.doNotAutomate.includes(it.exception_type) || it.amount > B.auto_approve_limit) return 'reviewer';
  if (it.agent_confidence < B.confidence_floor) return 'reviewer';
  let decision = VARIANCE.has(it.exception_type) ? ((it.variance_pct ?? Infinity) <= B.match_tolerance_pct ? 'approve' : null) : it.agent_suggestion;
  if (decision && B.small_supplier_protection && it.supplier_size === 'small' && (decision === 'hold' || decision === 'reject')) decision = null;
  return decision ? 'auto' : 'reviewer';
}

function components(nodes, edges) {
  const parent = new Map(nodes.map((n) => [n.id, n.id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const e of edges) { const a = find(e.s), b = find(e.t); if (a !== b) parent.set(a < b ? b : a, a < b ? a : b); }
  const size = new Map();
  for (const n of nodes) { const r = find(n.id); size.set(r, (size.get(r) || 0) + 1); }
  return [...size.values()].sort((a, b) => b - a);
}

function degrees(nodes, edges) {
  const d = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) { d.set(e.s, d.get(e.s) + 1); d.set(e.t, d.get(e.t) + 1); }
  return d;
}

function countBy(arr, key) {
  const o = {};
  for (const x of arr) o[x[key]] = (o[x[key]] || 0) + 1;
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
}

// ---------- 1. knowledge graph ----------

export function buildKnowledgeGraph(sample, AE, facts) {
  const items = sample.items;
  const B = facts.baseline;
  const ctl = (id) => { if (!AE.controlById[id]) throw new Error(`unknown control ${id}`); return id; };
  const nodes = [], edges = [];
  const add = (n) => { nodes.push(n); return n; };
  const link = (s, t, rel) => edges.push({ s, t, rel });

  // Suppliers, ordered by number so the layout is stable.
  const supIds = [...new Set(items.map((it) => it.supplier))].sort();
  const supKey = (name) => `SUP-${name.replace(/\D/g, '')}`;
  const bySup = new Map(supIds.map((s) => [s, items.filter((it) => it.supplier === s)]));
  const risk = new Map();
  for (const s of supIds) {
    const its = bySup.get(s);
    const needs = its.filter((i) => i.needs_human).length;
    const wrong = its.filter((i) => i.agent_suggestion !== i.correct_resolution).length;
    const total = its.reduce((n, i) => n + i.amount, 0);
    risk.set(s, { needs, wrong, total, score: needs + wrong, count: its.length, size: its[0].supplier_size });
  }
  const riskRank = [...supIds].sort((a, b) => risk.get(b).score - risk.get(a).score || risk.get(b).total - risk.get(a).total || (a < b ? -1 : 1));
  supIds.forEach((s) => {
    const r = risk.get(s);
    add({ id: supKey(s), type: 'supplier', label: s, facts: {
      size: r.size, exceptions: r.count, total_amount: money(r.total), needs_person: r.needs, wrong_agent_suggestions: r.wrong,
      risk_score: r.score, risk_rank: `${riskRank.indexOf(s) + 1} of ${supIds.length}`,
    } });
  });

  const types = Object.keys(TYPE_NAMES).filter((t) => items.some((i) => i.exception_type === t));
  for (const t of types) {
    const its = items.filter((i) => i.exception_type === t);
    add({ id: `TYPE-${t}`, type: 'extype', label: TYPE_NAMES[t], facts: { exceptions: its.length, total_amount: money(its.reduce((n, i) => n + i.amount, 0)), needs_person: its.filter((i) => i.needs_human).length } });
  }

  const POL = [
    { id: 'POL-authority', label: `Delegated authority ${money(facts.authority)}`, rule: `Invoices above ${money(facts.authority)} need a person with authority.`, controls: ['TAL-01', 'SOD-01'], role: 'ROLE-senior',
      applies: (i) => i.amount > facts.authority },
    { id: 'POL-senior', label: `Senior review above ${money(B.senior_review_above)}`, rule: `Baseline policy: exceptions above ${money(B.senior_review_above)} go to a senior approver.`, controls: ['HO-01'], role: 'ROLE-senior',
      applies: (i) => i.amount > B.senior_review_above },
    { id: 'POL-dna-bank', label: 'Do not automate: bank-detail changes', rule: 'Bank-detail changes always go to a person, with out-of-band verification.', controls: ['TAL-05', 'TAL-07'], role: 'ROLE-clerk',
      applies: (i) => facts.doNotAutomate.includes(i.exception_type) },
    { id: 'POL-match', label: `Match tolerance ${B.match_tolerance_pct}%`, rule: `Baseline policy: price and quantity variances within ${B.match_tolerance_pct}% may be approved by rule.`, controls: ['TAL-02'], role: null,
      applies: (i) => VARIANCE.has(i.exception_type) },
    { id: 'POL-small', label: 'Small-supplier protection', rule: 'Automated hold or reject decisions for small suppliers go to a person.', controls: ['MR-08'], role: 'ROLE-clerk',
      applies: (i) => i.supplier_size === 'small' },
    { id: 'POL-confidence', label: `Confidence floor ${B.confidence_floor.toFixed(2)}`, rule: `Baseline policy: the resolver agent acts alone only at confidence ${B.confidence_floor.toFixed(2)} or above.`, controls: ['MR-07'], role: null,
      applies: (i) => !facts.doNotAutomate.includes(i.exception_type) && i.amount <= B.auto_approve_limit },
  ];
  for (const p of POL) {
    const its = items.filter(p.applies);
    add({ id: p.id, type: 'policy', label: p.label, facts: { rule: p.rule, exceptions: its.length } });
  }
  const ROLES = [
    { id: 'ROLE-resolver', label: 'Resolver agent', route: 'auto', what: 'Resolves the exception alone, inside the policy.' },
    { id: 'ROLE-clerk', label: 'AP clerk (reviewer)', route: 'reviewer', what: 'Reviews the exception and decides.' },
    { id: 'ROLE-senior', label: 'Senior approver', route: 'senior', what: 'Decides large exceptions with delegated authority.' },
  ];
  const routes = new Map(items.map((i) => [i.id, baselineRoute(i, B, facts)]));
  for (const r of ROLES) add({ id: r.id, type: 'role', label: r.label, facts: { does: r.what, exceptions_under_baseline: items.filter((i) => routes.get(i.id) === r.route).length } });

  const ctlIds = [...new Set(POL.flatMap((p) => p.controls))].sort();
  for (const c of ctlIds) add({ id: ctl(c), type: 'control', label: `${c} ${AE.controlById[c].name}`, facts: { name: AE.controlById[c].name, purpose: AE.controlById[c].purpose, required_from: `L${AE.controlById[c].minLevel}` } });

  for (const it of items) {
    add({ id: it.id, type: 'exception', label: `${it.id} ${TYPE_NAMES[it.exception_type]}`, facts: {
      supplier: it.supplier, type: TYPE_NAMES[it.exception_type], amount: money(it.amount),
      ...(it.variance_pct != null ? { variance_pct: `${it.variance_pct}%` } : {}),
      agent_suggestion: it.agent_suggestion, agent_confidence: it.agent_confidence, correct_resolution: it.correct_resolution,
      needs_person: it.needs_human ? 'yes' : 'no', baseline_route: ROLES.find((r) => r.route === routes.get(it.id)).label,
    } });
    link(it.id, supKey(it.supplier), 'billed_by');
    link(it.id, `TYPE-${it.exception_type}`, 'is_a');
    link(it.id, ROLES.find((r) => r.route === routes.get(it.id)).id, 'routed_to');
    for (const p of POL) if (p.applies(it)) link(it.id, p.id, 'governed_by');
  }
  for (const p of POL) {
    for (const c of p.controls) link(p.id, c, 'enforced_by');
    if (p.role) link(p.id, p.role, 'routes_to');
  }

  // Layout: suppliers on the outer ring, each supplier's exceptions just inside it, hubs in the centre.
  const W = 1000, CX = 500, CY = 500;
  const pos = new Map();
  const sizeOrder = { small: 0, mid: 1, large: 2 };
  const supOrder = [...supIds].sort((a, b) => sizeOrder[risk.get(a).size] - sizeOrder[risk.get(b).size] || (a < b ? -1 : 1));
  supOrder.forEach((s, i) => {
    const a = (2 * Math.PI * i) / supOrder.length - Math.PI / 2;
    pos.set(supKey(s), [CX + 470 * Math.cos(a), CY + 470 * Math.sin(a)]);
    const its = bySup.get(s);
    its.forEach((it, j) => {
      const spread = (2 * Math.PI) / supOrder.length * 0.8;
      const aj = a + (its.length > 1 ? (j / (its.length - 1) - 0.5) * spread : 0);
      const rr = 395 - (j % 2) * 34;
      pos.set(it.id, [CX + rr * Math.cos(aj), CY + rr * Math.sin(aj)]);
    });
  });
  types.forEach((t, i) => { const a = (2 * Math.PI * i) / types.length - Math.PI / 2; pos.set(`TYPE-${t}`, [CX + 250 * Math.cos(a), CY + 250 * Math.sin(a)]); });
  POL.forEach((p, i) => { const a = (2 * Math.PI * i) / POL.length - Math.PI / 2 + Math.PI / POL.length; pos.set(p.id, [CX + 160 * Math.cos(a), CY + 160 * Math.sin(a)]); });
  ROLES.forEach((r, i) => { const a = (2 * Math.PI * i) / ROLES.length + Math.PI / 6; pos.set(r.id, [CX + 85 * Math.cos(a), CY + 85 * Math.sin(a)]); });
  ctlIds.forEach((c, i) => { const a = (2 * Math.PI * i) / ctlIds.length; pos.set(c, [CX + 205 * Math.cos(a + 0.35), CY + 205 * Math.sin(a + 0.35)]); });
  for (const n of nodes) { const [x, y] = pos.get(n.id); n.x = r1(x); n.y = r1(y); }

  // Stats, all computed from the nodes and edges above.
  const deg = degrees(nodes, edges);
  const comps = components(nodes, edges);
  const top = (arr, n, f) => arr.slice(0, n).map(f);
  const supByCount = [...supIds].sort((a, b) => risk.get(b).count - risk.get(a).count || risk.get(b).total - risk.get(a).total || (a < b ? -1 : 1));
  const supByAmount = [...supIds].sort((a, b) => risk.get(b).total - risk.get(a).total || (a < b ? -1 : 1));
  const stats = {
    nodes: nodes.length,
    edges: edges.length,
    nodes_by_type: countBy(nodes, 'type'),
    edges_by_relation: countBy(edges, 'rel'),
    components: comps.length,
    largest_component: comps[0],
    mean_degree: r1((2 * edges.length) / nodes.length),
    top_degree: [...nodes].sort((a, b) => deg.get(b.id) - deg.get(a.id) || (a.id < b.id ? -1 : 1)).slice(0, 5).map((n) => ({ id: n.id, label: n.label, degree: deg.get(n.id) })),
    suppliers_most_exceptions: top(supByCount, 5, (s) => ({ id: supKey(s), label: s, exceptions: risk.get(s).count })),
    suppliers_highest_amount: top(supByAmount, 5, (s) => ({ id: supKey(s), label: s, total_amount: money(risk.get(s).total) })),
    suppliers_highest_risk: top(riskRank, 5, (s) => ({ id: supKey(s), label: s, risk_score: risk.get(s).score, needs_person: risk.get(s).needs, wrong_agent_suggestions: risk.get(s).wrong })),
    risk_definition: 'Risk score = exceptions that need a person + exceptions where the resolver agent suggested the wrong resolution. Ties go to the larger total amount.',
    baseline_routes: { resolver: [...routes.values()].filter((r) => r === 'auto').length, clerk: [...routes.values()].filter((r) => r === 'reviewer').length, senior: [...routes.values()].filter((r) => r === 'senior').length },
  };
  return { label: sample.label, size: W, nodes, edges, stats, types: ['supplier', 'exception', 'extype', 'policy', 'role', 'control'],
    gaps: ['The sample has no purchase-order or goods-receipt numbers, so the graph has no PO or receipt nodes.'] };
}

// ---------- 2. skill graph ----------

export function buildSkillGraph(AE, facts) {
  const ctl = (id) => { if (!AE.controlById[id]) throw new Error(`unknown control ${id}`); return id; };
  const AGENTS = [
    { id: 'AG-proposer', label: 'Proposer (AI)', kind: 'AI agent', where: 'functions/api/loop/step.ts', does: 'Proposes two policy variants per generation.' },
    { id: 'AG-harness', label: 'Guardrail harness (code)', kind: 'Code', where: 'lib/loop.ts', does: 'Runs each variant over the sample and checks the fitness rules.' },
    { id: 'AG-supervisor', label: 'Supervisor (AI)', kind: 'AI agent', where: 'functions/api/loop/step.ts', does: 'Explains results and writes decision cards. Code decides the doors.' },
    { id: 'AG-evaluator', label: 'Evaluator (code)', kind: 'Code', where: 'lib/loop.ts', does: 'Computes the goal number with the locked scorer.' },
    { id: 'AG-archivist', label: 'Archivist (code)', kind: 'Code', where: 'lib/loop.ts', does: 'Keeps every variant, its parent and its scores.' },
    { id: 'AG-room', label: 'Room voices (AI)', kind: 'AI agent', where: 'functions/api/agents.ts', does: 'Answers visitor instructions in the operations room.' },
    { id: 'AG-guide', label: 'Book guide (AI)', kind: 'AI agent', where: 'functions/api/guide.ts', does: 'Answers questions from the book knowledge pack.' },
    { id: 'AG-graph', label: 'Graph agent (AI)', kind: 'AI agent', where: 'functions/api/graph/ask.ts', does: 'Answers from a subgraph that code selected.' },
    { id: 'AG-intake', label: 'Intake agent (AI)', kind: 'AI agent', where: 'functions/api/intake.ts', does: 'Asks short questions and fills a request card.' },
  ];
  const TOOLS = [
    { id: 'TOOL-model', label: 'Model gateway', what: 'One GPT-class model, with a smaller fallback model.' },
    { id: 'TOOL-loop', label: 'POST /api/loop/step', what: `Actions: ${facts.loopActions.join(', ')}.` },
    { id: 'TOOL-agents', label: 'POST /api/agents', what: `Whitelisted actions: ${facts.actionTypes.join(', ')}.` },
    { id: 'TOOL-guide', label: 'POST /api/guide', what: 'Chat and consented lead capture.' },
    { id: 'TOOL-graph', label: 'POST /api/graph/ask', what: 'Graph traversal in code, then one model call.' },
    { id: 'TOOL-intake', label: 'POST /api/intake', what: 'One model call per turn; submit only with consent.' },
    { id: 'TOOL-runner', label: 'Policy runner', what: 'Runs a policy over all sample exceptions. Deterministic.' },
    { id: 'TOOL-caps', label: 'Call budget', what: `${facts.callsPerRun} calls per loop run; ${facts.dailyCalls} model calls per day, site-wide.` },
  ];
  const DATA = [
    { id: 'DATA-sample', label: 'Sample AP exceptions', what: '150 synthetic exceptions. Read only.' },
    { id: 'DATA-metrics', label: 'Aggregate results', what: 'Goal number and guardrail readings per variant.' },
    { id: 'DATA-policy', label: 'Policy config', what: `Six settings: ${facts.configKeys.join(', ')}.` },
    { id: 'DATA-scorer', label: 'Locked scorer and goal', what: 'Outside the loop. No agent may edit it.' },
    { id: 'DATA-archive', label: 'Variant archive', what: 'Kept in the visitor\u2019s browser for the run.' },
    { id: 'DATA-knowledge', label: 'Book knowledge pack', what: 'The guide\u2019s source text.' },
    { id: 'DATA-requests', label: 'Requests table', what: 'Leads a visitor submits with consent.' },
    { id: 'DATA-graphs', label: 'Knowledge and skill graphs', what: 'Built from committed files at build time.' },
    { id: 'DATA-ratelimits', label: 'Rate-limit table', what: 'Counts calls for the caps. No content.' },
  ];
  // level: the autonomy level each skill runs at on this site, L0 to L4.
  const SKILLS = [
    { id: 'SK-propose', label: 'Propose policy variants', agent: 'AG-proposer', level: 1, tools: ['TOOL-model', 'TOOL-loop', 'TOOL-caps'], reads: ['DATA-metrics', 'DATA-policy'], writes: [], controls: ['MR-10', 'PCS-02', 'TRC-05', 'CST-03'],
      why: 'Suggests only. Code tests every variant and decides what ships.' },
    { id: 'SK-runpolicy', label: 'Run a policy over the sample', agent: 'AG-harness', level: 4, tools: ['TOOL-runner'], reads: ['DATA-sample', 'DATA-policy'], writes: ['DATA-metrics'], controls: ['MR-01', 'TAL-05'],
      why: 'Deterministic code. It runs and reports every time.' },
    { id: 'SK-guard', label: 'Check fitness rules and block', agent: 'AG-harness', level: 4, tools: ['TOOL-runner'], reads: ['DATA-metrics'], writes: [], controls: ['MR-10', 'SOD-02', 'SOD-01'],
      why: 'Blocks failing variants and any scorer change, in code.' },
    { id: 'SK-ship', label: 'Ship a two-way-door change', agent: 'AG-harness', level: 3, tools: ['TOOL-loop'], reads: ['DATA-metrics'], writes: ['DATA-policy'], controls: ['TAL-02', 'TAL-06', 'TRC-01'],
      why: 'Acts within limits, behind a one-click undo.' },
    { id: 'SK-explain', label: 'Explain results and draft decision cards', agent: 'AG-supervisor', level: 1, tools: ['TOOL-model', 'TOOL-loop', 'TOOL-caps'], reads: ['DATA-metrics'], writes: [], controls: ['HO-01', 'HO-06', 'PCS-02', 'CST-03'],
      why: 'Explains. A named person approves one-way doors.' },
    { id: 'SK-score', label: 'Score the goal number', agent: 'AG-evaluator', level: 4, tools: ['TOOL-runner'], reads: ['DATA-scorer', 'DATA-metrics'], writes: [], controls: ['MR-10', 'MR-09'],
      why: 'Locked code outside the loop.' },
    { id: 'SK-archive', label: 'Archive variants and lineage', agent: 'AG-archivist', level: 4, tools: ['TOOL-loop'], reads: ['DATA-metrics'], writes: ['DATA-archive'], controls: ['TRC-05', 'TRC-04'],
      why: 'Records every variant, parent and approver.' },
    { id: 'SK-room', label: 'Answer room instructions', agent: 'AG-room', level: 1, tools: ['TOOL-model', 'TOOL-agents', 'TOOL-caps'], reads: ['DATA-metrics'], writes: ['DATA-ratelimits'], controls: ['TAL-03', 'PCS-01', 'PCS-03', 'TAL-04', 'CST-03'],
      why: `Talks and picks at most one whitelisted action: ${facts.actionTypes.join(', ')}.` },
    { id: 'SK-guide', label: 'Answer from the book', agent: 'AG-guide', level: 1, tools: ['TOOL-model', 'TOOL-guide'], reads: ['DATA-knowledge'], writes: ['DATA-ratelimits'], controls: ['MR-04', 'PCS-01', 'PCS-05', 'TAL-04'],
      why: 'Answers only from the knowledge pack.' },
    { id: 'SK-lead', label: 'Pass a consented lead to Hemanth', agent: 'AG-guide', level: 1, tools: ['TOOL-guide'], reads: [], writes: ['DATA-requests'], controls: ['PRV-01', 'PRV-04', 'TAL-04'],
      why: 'Stores a lead only when the visitor submits it.' },
    { id: 'SK-graph', label: 'Answer from a code-selected subgraph', agent: 'AG-graph', level: 1, tools: ['TOOL-model', 'TOOL-graph', 'TOOL-caps'], reads: ['DATA-graphs'], writes: ['DATA-ratelimits'], controls: ['MR-04', 'PCS-01', 'PCS-02', 'CST-03', 'TAL-04'],
      why: 'Read only. Cited node IDs are checked in code.' },
    { id: 'SK-intake', label: 'Fill a request card by conversation', agent: 'AG-intake', level: 1, tools: ['TOOL-model', 'TOOL-intake', 'TOOL-caps'], reads: [], writes: ['DATA-ratelimits'], controls: ['PCS-01', 'PCS-02', 'PRV-01', 'PRV-04', 'CST-03', 'TAL-04'],
      why: 'Asks and extracts only. Code checks every field.' },
    { id: 'SK-submit', label: 'Store a request the visitor confirmed', agent: 'AG-intake', level: 1, tools: ['TOOL-intake'], reads: [], writes: ['DATA-requests'], controls: ['HO-01', 'PRV-01', 'TAL-04'],
      why: 'Code stores it only after the visitor ticks consent and presses Send.' },
  ];
  const DENY = [
    { id: 'DENY-scorer', label: 'Change the scorer, goal or test set', controls: ['MR-10'], agents: ['AG-proposer', 'AG-supervisor', 'AG-room', 'AG-graph'],
      how: `Any proposed key matching /${facts.scorerRe}/i is blocked before it runs.` },
    { id: 'DENY-oneway', label: 'Ship a one-way-door change', controls: ['HO-06', 'SOD-03'], agents: ['AG-proposer', 'AG-supervisor', 'AG-room'],
      how: `Code flags one-way doors (for example an auto-approve limit above ${money(facts.oneWayLimit)}) and sends them to a person.` },
    { id: 'DENY-bank', label: 'Automate a bank-detail change', controls: ['TAL-05', 'TAL-07'], agents: ['AG-proposer', 'AG-harness', 'AG-room'],
      how: `Hard-coded do-not-automate list: ${facts.doNotAutomate.join(', ')}. Not a setting.` },
    { id: 'DENY-loosen', label: 'Loosen a guardrail cap', controls: ['SOD-01'], agents: ['AG-proposer', 'AG-supervisor', 'AG-room'],
      how: 'Caps can only tighten. Looser values are clamped in code.' },
    { id: 'DENY-actions', label: 'Take an action outside the whitelist', controls: ['TAL-03', 'IAM-03'], agents: ['AG-room', 'AG-graph', 'AG-guide', 'AG-intake'],
      how: 'Unknown action types become none. Extra fields are dropped.' },
    { id: 'DENY-unconsented', label: 'Send a request without the visitor\u2019s consent', controls: ['HO-01', 'PRV-04'], agents: ['AG-intake', 'AG-guide'],
      how: 'The submit path refuses any request without explicit consent. The model cannot call it.' },
    { id: 'DENY-requests', label: 'Write to the requests table', controls: ['IAM-03'], agents: ['AG-proposer', 'AG-supervisor', 'AG-room', 'AG-graph'],
      how: 'Only the guide and intake submit paths write requests, after the visitor confirms.' },
    { id: 'DENY-budget', label: 'Exceed the model-call budget', controls: ['CST-03', 'TAL-04'], agents: ['AG-proposer', 'AG-supervisor', 'AG-room', 'AG-guide', 'AG-graph', 'AG-intake'],
      how: `Calls are counted in the rate-limit table: ${facts.dailyCalls} per day site-wide.` },
  ];
  const LEVELS = [0, 1, 2, 3, 4].map((n) => ({ id: `LVL-${n}`, label: `L${n}`, meaning: ['Manual', 'Assist', 'Approve', 'Act within limits', 'Run and report'][n] }));

  const nodes = [], edges = [];
  const link = (s, t, rel) => edges.push({ s, t, rel });
  for (const a of AGENTS) nodes.push({ id: a.id, type: 'agent', label: a.label, facts: { kind: a.kind, does: a.does, source: a.where } });
  for (const s of SKILLS) {
    const used = s.controls.map(ctl);
    nodes.push({ id: s.id, type: 'skill', label: s.label, facts: { autonomy: `L${s.level}`, why: s.why, controls: used.join(' ') } });
    link(s.agent, s.id, 'has_skill');
    for (const t of s.tools) link(s.id, t, 'uses');
    for (const d of s.reads) link(s.id, d, 'reads');
    for (const d of s.writes) link(s.id, d, 'writes');
    for (const c of used) link(s.id, c, 'gated_by');
    link(s.id, `LVL-${s.level}`, 'runs_at');
  }
  for (const t of TOOLS) nodes.push({ id: t.id, type: 'tool', label: t.label, facts: { what: t.what } });
  for (const d of DATA) nodes.push({ id: d.id, type: 'data', label: d.label, facts: { what: d.what } });
  for (const d of DENY) {
    nodes.push({ id: d.id, type: 'denied', label: `Cannot: ${d.label}`, facts: { how: d.how, controls: d.controls.map(ctl).join(' ') } });
    for (const a of d.agents) link(a, d.id, 'cannot');
    for (const c of d.controls) link(d.id, c, 'blocked_by');
  }
  const ctlIds = [...new Set([...SKILLS.flatMap((s) => s.controls), ...DENY.flatMap((d) => d.controls)])].sort();
  for (const c of ctlIds) nodes.push({ id: c, type: 'control', label: `${c} ${AE.controlById[c].name}`, facts: { name: AE.controlById[c].name, purpose: AE.controlById[c].purpose, required_from: `L${AE.controlById[c].minLevel}` } });
  for (const l of LEVELS) nodes.push({ id: l.id, type: 'level', label: l.label, facts: { meaning: l.meaning } });

  // Columns: agents, skills, tools and data, denied, controls, levels.
  const cols = [['agent'], ['skill', 'denied'], ['tool', 'data'], ['control'], ['level']];
  const X = [70, 300, 540, 770, 950];
  const H = 1000;
  cols.forEach((types, ci) => {
    const col = nodes.filter((n) => types.includes(n.type));
    col.forEach((n, i) => { n.x = X[ci]; n.y = r1(30 + ((H - 60) * (i + 0.5)) / col.length); });
  });
  const deg = degrees(nodes, edges);
  const stats = {
    nodes: nodes.length, edges: edges.length, nodes_by_type: countBy(nodes, 'type'), edges_by_relation: countBy(edges, 'rel'),
    controls_used: ctlIds,
    top_degree: [...nodes].sort((a, b) => deg.get(b.id) - deg.get(a.id) || (a.id < b.id ? -1 : 1)).slice(0, 5).map((n) => ({ id: n.id, label: n.label, degree: deg.get(n.id) })),
  };
  return { size: H, nodes, edges, stats, types: ['agent', 'skill', 'denied', 'tool', 'data', 'control', 'level'], source: facts };
}

// ---------- 3. enterprise brain ----------

/** Deterministic routing rules: keywords in the question pick model families. lib/brain.ts applies them. */
export const BRAIN_RULES = [
  { family: 'kg', pattern: '\\b(supplier|suppliers|invoice|invoices|exception|exceptions|ap-\\d{1,4}|risk|riskiest|risky|linked|related|connected|duplicate|bank|variance|quantity|tax|purchase order|missing po|clerk|approver|reviewer)\\b', why: 'Entities and links: the knowledge graph answers by traversal.' },
  { family: 'skills', pattern: '\\b(agent|agents|proposer|supervisor|evaluator|archivist|harness|guide|can|cannot|can\u2019t|can\'t|allowed|permission|permissions|scorer|control|controls|autonomy|level|[a-z]{2,3}-\\d{2})\\b', why: 'Who may do what: the skill graph answers by traversal.' },
  { family: 'ml', pattern: '\\b(forecast|predict|prediction|trend|next (month|quarter|week|year)|expect|will rise|will fall|anomal\\w*|sensor)\\b', why: 'Numbers over time: classical ML and forecasting fit.' },
  { family: 'opt', pattern: '\\b(optimi[sz]e|optimal|schedule|allocate|allocation|best plan|cheapest plan|minimi[sz]e|maximi[sz]e|constraint|constraints)\\b', why: 'Best plan under constraints: an optimization solver fits.' },
  { family: 'rl', pattern: '\\b(reward|reinforcement|learn (a |the )?policy|trial and error|sequential|self-improv\\w*)\\b', why: 'Sequential decisions with feedback: reinforcement learning fits, trained in a digital twin first.' },
  { family: 'speech', pattern: '\\b(voice|call|calls|phone|speak|spoken|audio|transcri\\w*)\\b', why: 'Voice in and out: speech models fit.' },
  { family: 'mm', pattern: '\\b(image|images|photo|photos|scan|scanned|pdf|picture|camera|vision|inspect\\w*)\\b', why: 'Documents and images: multimodal and vision models fit.' },
  { family: 'phys', pattern: '\\b(robot|robots|robotic|arm|forklift|machine|machines|warehouse|physical)\\b', why: 'Motion in the physical world: a physical AI policy fits, inside a safety envelope.' },
  { family: 'rag', pattern: '\\b(book|chapter|handbook|document|documents|what does .{1,40} say|policy text|cite the policy)\\b', why: 'Answers from documents: retrieval (RAG) fits.' },
  { family: 'slm', pattern: '\\b(classify|categori[sz]e|tag|extract|label|route this|triage)\\b', why: 'Narrow classification or extraction: a small model fits.' },
];

export function buildBrain(AE, kg, sk) {
  const FAM = [
    ['llm', 'GPT-class LLM'], ['slm', 'Small model'], ['rag', 'Retrieval (RAG)'], ['kg', 'Graph ML and knowledge graph'],
    ['ml', 'Classical ML and forecasting'], ['opt', 'Optimizer'], ['rl', 'Reinforcement learning'], ['speech', 'Speech'],
    ['mm', 'Vision and multimodal'], ['phys', 'Physical AI policy'],
  ];
  const model = (id) => AE.models.find((m) => m.id === id);
  const nodes = [], edges = [];
  const link = (s, t, rel) => edges.push({ s, t, rel });
  const SIG = [
    ['SIG-web', 'Web (this page)', 'live', 'Your question arrives here. This is the only live signal in the demo.'],
    ['SIG-chat', 'Chat', 'not connected', 'The site has a chat guide, but it does not feed this brain demo.'],
    ['SIG-email', 'Email', 'not connected', 'Not connected in this demo.'],
    ['SIG-voice', 'Voice', 'not connected', 'Not connected in this demo.'],
    ['SIG-iot', 'IoT sensors', 'not connected', 'Not connected in this demo.'],
    ['SIG-robot', 'Robots and machines', 'not connected', 'Not connected in this demo.'],
  ];
  for (const [id, label, status, what] of SIG) { nodes.push({ id, type: 'signal', label, facts: { status, what } }); link(id, 'BR-router', 'feeds'); }
  nodes.push({ id: 'BR-router', type: 'router', label: 'Brain router', facts: { what: 'Rules in code read the question, pick the graph and the model family.', rules: BRAIN_RULES.length } });
  nodes.push({ id: 'BR-kg', type: 'lookup', label: 'Knowledge graph lookup', facts: { what: 'Traverses the AP knowledge graph in code.', nodes: kg.stats.nodes, edges: kg.stats.edges } });
  nodes.push({ id: 'BR-skills', type: 'lookup', label: 'Skill graph lookup', facts: { what: 'Traverses the skill graph in code.', nodes: sk.stats.nodes, edges: sk.stats.edges } });
  link('BR-router', 'BR-kg', 'looks_up'); link('BR-router', 'BR-skills', 'looks_up');
  for (const [id, label] of FAM) {
    const m = model(id);
    const status = id === 'llm' ? 'run: composes the answer from the subgraph' : id === 'kg' ? 'graph traversal runs in code; graph ML is routed to, not run in this demo' : 'routed to, not run in this demo';
    nodes.push({ id: `MF-${id}`, type: 'family', label, facts: { status, good_at: m.good, evals: m.evals, mandatory_controls: m.mand, typical_ceiling: m.ceil } });
    link('BR-router', `MF-${id}`, 'picks');
  }
  link('BR-kg', 'MF-kg', 'is_a');
  nodes.push({ id: 'BR-agent', type: 'agentstep', label: 'Graph agent', facts: { skill: 'SK-graph', what: 'Answers only from the subgraph code selected.' } });
  nodes.push({ id: 'BR-gate', type: 'gate', label: 'Controls and evals gate', facts: { what: 'Checks citations, vendor names, prompt leaks, length and the call budget, in code.' } });
  nodes.push({ id: 'BR-action', type: 'action', label: 'Answer (read only)', facts: { what: 'The answer and its cited nodes. Nothing is written to any system.' } });
  nodes.push({ id: 'BR-trace', type: 'trace', label: 'Decision trace', facts: { what: 'Route, controls, evals, tokens and cost for each question.' } });
  nodes.push({ id: 'BR-memory', type: 'memory', label: 'Session memory', facts: { what: 'Traces are kept in your browser tab for this visit only. Nothing is stored on the server.' } });
  link('BR-kg', 'BR-agent', 'grounds'); link('BR-skills', 'BR-agent', 'grounds'); link('MF-llm', 'BR-agent', 'runs');
  link('BR-agent', 'BR-gate', 'checked_by'); link('BR-gate', 'BR-action', 'allows'); link('BR-action', 'BR-trace', 'writes'); link('BR-trace', 'BR-memory', 'appends'); link('BR-memory', 'BR-router', 'informs');
  const gateCtl = ['MR-04', 'PCS-01', 'PCS-02', 'PCS-05', 'CST-03', 'TAL-04', 'TRC-01', 'RES-02'];
  for (const c of gateCtl) {
    if (!AE.controlById[c]) throw new Error(`unknown control ${c}`);
    nodes.push({ id: c, type: 'control', label: `${c} ${AE.controlById[c].name}`, facts: { name: AE.controlById[c].name, purpose: AE.controlById[c].purpose } });
    link('BR-gate', c, 'enforces');
  }
  // Layout: left to right, one column per stage.
  const stages = [['signal'], ['router'], ['lookup'], ['family'], ['agentstep'], ['gate', 'control'], ['action'], ['trace', 'memory']];
  const X = [55, 180, 310, 450, 590, 730, 880, 1000];
  stages.forEach((types, ci) => {
    const col = nodes.filter((n) => types.includes(n.type));
    col.forEach((n, i) => { n.x = X[ci]; n.y = r1(40 + (520 * (i + 0.5)) / col.length); });
  });
  return { size: 600, nodes, edges, rules: BRAIN_RULES, families: FAM.map(([id, label]) => ({ id, label })), gate_controls: gateCtl, types: ['signal', 'router', 'lookup', 'family', 'agentstep', 'gate', 'control', 'action', 'trace', 'memory'] };
}

export function buildGraphs() {
  const AE = loadAE();
  const facts = readCodeFacts();
  const kg = buildKnowledgeGraph(loadSample(), AE, facts);
  const skills = buildSkillGraph(AE, facts);
  const brain = buildBrain(AE, kg, skills);
  return { generated_by: 'tools/build-graphs.mjs', kg, skills, brain };
}

export function graphsJson() {
  return `${JSON.stringify(buildGraphs(), null, 1)}\n`;
}

export function writeGraphs() {
  const out = graphsJson();
  writeFileSync(GRAPHS_OUT, out);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const g = buildGraphs();
  writeGraphs();
  console.log(`graphs.json: knowledge graph ${g.kg.stats.nodes} nodes, ${g.kg.stats.edges} edges; skill graph ${g.skills.stats.nodes} nodes, ${g.skills.stats.edges} edges; brain ${g.brain.nodes.length} nodes`);
}
