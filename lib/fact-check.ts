import { KG, type GNode, type Subgraph } from './graph';

/**
 * Figures bound to their labels, for answers drawn from the knowledge graph (synthetic sample AP data).
 *
 * The model reads each figure as a labelled fact ("Supplier 34: 3 exceptions need a person"). After it answers, code
 * finds every number the answer attaches to a known attribute (exceptions, exceptions that need a person, wrong agent
 * suggestions, risk score, risk rank, amounts, agent confidence) and checks it against the value for the entity the
 * sentence is about. A number that is in the data but belongs to another label ("4 need a person" when 4 is the
 * exception count) is caught here, which a plain "is this number anywhere in the evidence" check cannot do.
 */

export type Attr = 'exceptions' | 'needs_person' | 'wrong_agent_suggestions' | 'risk_score' | 'risk_rank' | 'amount' | 'agent_confidence';

export interface Mismatch {
  sentence: string;
  entity: string;
  attr: Attr;
  claimed: number;
  expected: number;
}

const BY_ID = new Map(KG.nodes.map((n) => [n.id, n]));
const CHECKED_TYPES = new Set(['supplier', 'extype', 'policy', 'exception']);

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const m = v.replace(/[$,]/g, '').match(/^\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

/** The value of one attribute for one node, or null when the node does not carry it. */
export function factValue(n: GNode, attr: Attr): number | null {
  const f = n.facts;
  switch (attr) {
    case 'amount': return num(f.total_amount ?? f.amount);
    case 'risk_rank': return num(f.risk_rank);
    case 'needs_person': return typeof f.needs_person === 'number' ? f.needs_person : null;
    default: return num(f[attr]);
  }
}

const ATTR_PHRASE: Record<Attr, string> = {
  exceptions: 'exceptions in total',
  needs_person: 'exceptions need a person',
  wrong_agent_suggestions: 'wrong agent suggestions',
  risk_score: 'risk score',
  risk_rank: 'risk rank',
  amount: 'total amount',
  agent_confidence: 'agent confidence',
};

/** Readable, labelled facts for the entities in a subgraph, so each number reaches the model next to its own label. */
export function factSheet(subs: Subgraph[], max = 10): string {
  const lines: string[] = [];
  for (const s of subs) {
    if (s.graph !== 'kg') continue;
    for (const id of s.nodes) {
      const n = BY_ID.get(id);
      if (!n || !['supplier', 'extype'].includes(n.type)) continue;
      const f = n.facts;
      const parts: string[] = [];
      if (f.exceptions !== undefined) parts.push(`${f.exceptions} ${ATTR_PHRASE.exceptions}`);
      if (typeof f.needs_person === 'number') parts.push(`${f.needs_person} of them need a person`);
      if (f.wrong_agent_suggestions !== undefined) parts.push(`${f.wrong_agent_suggestions} wrong agent suggestions`);
      if (f.risk_score !== undefined) parts.push(`risk score ${f.risk_score}`);
      if (f.risk_rank !== undefined) parts.push(`risk rank ${f.risk_rank}`);
      if (f.total_amount !== undefined) parts.push(`total amount ${f.total_amount}`);
      if (parts.length) lines.push(`${n.label} (${n.id}): ${parts.join('; ')}.`);
      if (lines.length >= max) break;
    }
  }
  return lines.length ? `FACTS BY ENTITY (computed in code; give each number only with its own label and entity):\n${lines.join('\n')}` : '';
}

// ---------- finding entities and figures in an answer ----------

interface Span { a: number; b: number; id?: string }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Labels without a leading ID, longest first, so "Price variance" is found before shorter words. */
const LABELS = KG.nodes
  .filter((n) => CHECKED_TYPES.has(n.type) && n.type !== 'supplier' && n.type !== 'exception')
  .map((n) => ({ id: n.id, re: new RegExp(`\\b${esc(n.label)}`, 'gi') }));
/** Labels of every other node (controls, roles); their digits are names, not figures. */
const OTHER_LABELS = KG.nodes.filter((n) => !CHECKED_TYPES.has(n.type)).map((n) => new RegExp(`\\b${esc(n.label)}`, 'gi'));

function entitySpans(sen: string): Span[] {
  const out: Span[] = [];
  for (const m of sen.matchAll(/\bsupplier\s*#?\s*(\d{1,2})\b/gi)) out.push({ a: m.index!, b: m.index! + m[0].length, id: `SUP-${m[1].padStart(2, '0')}` });
  for (const m of sen.matchAll(/\bSUP-(\d{1,2})\b/gi)) out.push({ a: m.index!, b: m.index! + m[0].length, id: `SUP-${m[1].padStart(2, '0')}` });
  for (const m of sen.matchAll(/\bAP-?\s?(\d{1,4})\b/gi)) out.push({ a: m.index!, b: m.index! + m[0].length, id: `AP-${m[1].padStart(4, '0')}` });
  for (const m of sen.matchAll(/\b(?:TYPE|POL)-[A-Za-z_-]+\b/g)) out.push({ a: m.index!, b: m.index! + m[0].length, id: m[0] });
  for (const l of LABELS) for (const m of sen.matchAll(l.re)) out.push({ a: m.index!, b: m.index! + m[0].length, id: l.id });
  return out.filter((s) => s.id && BY_ID.has(s.id)).sort((x, y) => x.a - y.a);
}

/** Spans whose digits are part of a name (control and role labels, IDs such as HO-01, levels such as L2, chapters). */
function nameSpans(sen: string): Span[] {
  const out: Span[] = [];
  for (const re of OTHER_LABELS) for (const m of sen.matchAll(re)) out.push({ a: m.index!, b: m.index! + m[0].length });
  for (const m of sen.matchAll(/\b[A-Z]{1,5}-\d+\b|\bL\d\b|\bCh(?:apter)?\.?\s*\d+/g)) out.push({ a: m.index!, b: m.index! + m[0].length });
  return out;
}

const NEED = String.raw`(?:still\s+)?(?:need|needs|needed|needing|require|requires|required|requiring|went\s+to|go\s+to|goes\s+to|routed\s+to|sent\s+to)\s+(?:a\s+|human\s+)?(?:person|human|people|reviewer|review)`;
const OF = String.raw`(?:of\s+(?:which|them|its|their|the|these|those|all)\s+(?:\d+\s+)?)?`;
const RE_NEEDS = new RegExp(`^${OF}(?:\\w+\\s+){0,2}?(?:exceptions?|invoices?|cases?|items?)?\\s*(?:that\\s+|which\\s+)?${NEED}`, 'i');
const RE_WRONG = new RegExp(`^${OF}(?:[\\w-]+\\s+){0,4}?(?:wrong|incorrect|mistaken)`, 'i');
const RE_EXC = /^(?:\w+\s+)?exceptions?\b/i;
const RE_SCORE_AFTER = /^(?:risk\s+)?(?:score|points?)\b/i;
const RE_SCORE_BEFORE = /risk\s+score\s*(?:of|is|was|at|:)?\s*$/i;
const RE_RANK_BEFORE = /\b(?:rank(?:ed|s)?|ranking)\s*(?:#|number|no\.?)?\s*$/i;
const RE_CONF_BEFORE = /confidence\s*(?:of|is|was|at|:)?\s*$/i;
const RE_AMT = /\b(?:total|billed|amount|worth|invoic\w*|spend)\b/i;

/** The attribute a number is attached to, read from the words around it inside its clause, or null. */
export function attrOf(before: string, after: string, money: boolean): Attr | null {
  if (money) return RE_AMT.test(before.slice(-50)) || RE_AMT.test(after.slice(0, 40)) ? 'amount' : null;
  if (/\bof\s+(?:its|their|the|these|those|all|them)?\s*$/i.test(before) && RE_EXC.test(after)) return 'exceptions'; // "3 of its 4 exceptions"
  if (RE_SCORE_BEFORE.test(before)) return 'risk_score';
  if (RE_RANK_BEFORE.test(before)) return 'risk_rank';
  if (RE_CONF_BEFORE.test(before)) return 'agent_confidence';
  if (RE_NEEDS.test(after)) return 'needs_person';
  if (RE_WRONG.test(after)) return 'wrong_agent_suggestions';
  if (RE_EXC.test(after)) return 'exceptions';
  if (RE_SCORE_AFTER.test(after)) return 'risk_score';
  return null;
}

/** Splits text into sentences (kept identical to the guide's own splitter). */
function splitSentences(text: string): string[] {
  return text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"\u201c(])/).map((x) => x.trim()).filter(Boolean);
}

/**
 * Sentences that attach a number to the wrong label or entity. The entity is the nearest one named before the number in
 * the same sentence, else the last one named in an earlier sentence. Numbers with no recognised label, or about an
 * entity that does not carry that attribute, are left to the general grounding check.
 */
export function misboundFigures(answer: string): Mismatch[] {
  const out: Mismatch[] = [];
  let carry: string | null = null;
  for (const sen of splitSentences(answer)) {
    const ents = entitySpans(sen);
    const skip = [...ents, ...nameSpans(sen)];
    for (const m of sen.matchAll(/(\$)?(\d[\d,]*(?:\.\d+)?)/g)) {
      const a = m.index!;
      const b = a + m[0].length;
      if (skip.some((s) => a >= s.a && a < s.b)) continue;
      if (/[A-Za-z-]$/.test(sen.slice(0, a))) continue; // part of a word or ID
      // The number's clause: back to the previous clause break, forward to the next one.
      const pre = sen.slice(0, a);
      const before = pre.slice(Math.max(pre.lastIndexOf(','), pre.lastIndexOf(';'), pre.lastIndexOf('('), pre.lastIndexOf(':')) + 1);
      const rest = sen.slice(b).replace(/^%/, '');
      const stop = rest.search(/[,;.)](?:\s|$)|\s(?:and|while|but|whereas)\s/);
      const after = (stop < 0 ? rest : rest.slice(0, stop)).trim();
      const attr = attrOf(before, after, !!m[1]);
      if (!attr) continue;
      const own = ents.filter((e) => e.b <= a).pop()?.id ?? carry;
      if (!own) continue;
      const node = BY_ID.get(own)!;
      const expected = factValue(node, attr);
      if (expected === null) continue;
      const claimed = Number(m[2].replace(/,/g, ''));
      if (Math.abs(claimed - expected) > 1e-9) out.push({ sentence: sen, entity: node.label, attr, claimed, expected });
    }
    const last = ents[ents.length - 1];
    if (last) carry = last.id!;
  }
  return out;
}

/** One line per mismatch, for the rewrite request. */
export function mismatchNote(ms: Mismatch[]): string {
  return ms.map((x) => `"${x.sentence}" gives ${x.claimed} for ${x.entity}'s ${ATTR_PHRASE[x.attr]}; the data says ${x.expected}.`).join(' ');
}
