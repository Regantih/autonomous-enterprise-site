import { GUIDE_MATURITY, GUIDE_ROLES, maturityLabel, roleLabel } from './validate';

/**
 * Shared pieces of the "Talk to the book" guide: models, caps, history hygiene and the deterministic rule checks.
 * The agent loop (tools, prompt, parsing) is in lib/guide-agent.ts and lib/guide-tools.ts; the Pages Function in
 * functions/api/guide.ts wires it to Workers AI and the per-visitor cap in D1.
 */

export const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct';
export const MAX_TOKENS = 480;
/** Visitor messages per conversation. */
export const MAX_TURNS = 12;
export const HISTORY_LIMIT = 8;
/** Model calls per visitor (salted IP hash) per hour. Every tool step that calls a model counts. */
export const GUIDE_RATE_LIMIT = 30;
export const MAX_MESSAGE_CHARS = 800;
export const REPLY_WORD_LIMIT = 150;
export const SUMMARY_WORD_LIMIT = 120;
/** Offer the next-step buttons from this many visitor messages onward. */
export const INVITE_AFTER_TURNS = 3;

export const OPENING_LINE = 'Human-led, agent-operated: autonomy is earned when value compounds faster than risk.';

export const AMAZON_PAPERBACK = 'https://www.amazon.com/dp/B0HS8HG6DP';
export const LINKEDIN = 'https://www.linkedin.com/in/hemanth-reganti-147153178/';

export type ChatRole = 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
}
/** Optional context from the role chips. Both fields may be empty: the agent infers them from the conversation. */
export interface Profile {
  role: string;
  maturity: string;
}

/** Signals that the visitor wants to work with or hear from Hemanth directly. */
const INTENT_RE =
  /\b(talk(?:ing)? (?:to|with) (?:him|hemanth|the author|someone|you)|speak(?:er|ing)?|keynote|advis(?:e|or|ory)|consult(?:ing|ant|ation)?|help (?:my|our) (?:team|company|board|leaders)|work with|hire|engage(?:ment)?|book (?:a|him)|workshop|contact|call with|meeting|podcast|interview)\b/i;

export function hasIntent(text: string): boolean {
  return INTENT_RE.test(text);
}

/**
 * Names that must never appear in a reply: software vendors and AI providers (LangChain is
 * the one allowed exception). The model is told the same; this is the deterministic backstop.
 */
export const BLOCKED_NAMES = [
  'SAP', 'Oracle', 'Microsoft', 'Salesforce', 'Workday', 'ServiceNow', 'OpenAI', 'Anthropic', 'Google',
  'AWS', 'Azure', 'IBM', 'UiPath', 'ChatGPT', 'Copilot', 'Gemini', 'Claude', 'Llama', 'Meta AI', 'Coupa',
  'Ariba', 'Snowflake', 'Databricks', 'NetSuite', 'Kinaxis', 'Blue Yonder', 'Nvidia', 'Cloudflare',
  'Hugging Face', 'Mistral', 'Infor', 'Dynamics 365', 'Zendesk', 'HubSpot', 'Automation Anywhere',
  'Blue Prism', 'Celonis', 'Palantir', 'Deloitte', 'Accenture', 'McKinsey', 'KPMG', 'EY', 'PwC',
  'Stripe', 'Visa', 'Mastercard', 'Cisco', 'Shopify',
];
const BLOCKED_RE = new RegExp(`\\b(${BLOCKED_NAMES.map((n) => n.replace(/ /g, '\\s+')).join('|')})\\b`, 'i');
/** No email address is ever published by the guide. */
export const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/** Markers that only appear in the system prompt; their presence in a reply means a leak. */
const PROMPT_MARKERS = ['NON-NEGOTIABLE RULES', 'KNOWLEDGE PACK', 'TOOL RESULTS', 'OUTPUT FORMAT', '<<<'];

export function violatesRules(reply: string): boolean {
  return BLOCKED_RE.test(reply) || EMAIL_RE.test(reply) || PROMPT_MARKERS.some((m) => reply.includes(m));
}

export function roleLine(profile: Profile): string {
  const role = roleLabel(profile.role);
  const maturity = maturityLabel(profile.maturity);
  if (!role && !maturity) return 'VISITOR: role and goal not given. Infer them from what the visitor writes.';
  return `VISITOR: ${role ? `role "${role}" (picked from a suggestion chip)` : 'role not given'}${maturity ? `; agents today "${maturity}"` : ''}. Tailor the answer to this.`;
}

function clean(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, MAX_MESSAGE_CHARS);
}

/** Keeps well-formed user/assistant turns only, trimmed to size. */
export function sanitizeHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const m of raw.slice(-(MAX_TURNS * 2 + 2))) {
    if (!m || typeof m !== 'object') continue;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue;
    const text = clean(content);
    if (text) out.push({ role, content: text });
  }
  return out;
}

export function countUserTurns(history: ChatMessage[]): number {
  return history.filter((m) => m.role === 'user').length;
}

export function shouldInvite(history: ChatMessage[]): boolean {
  const users = history.filter((m) => m.role === 'user');
  const last = users[users.length - 1]?.content ?? '';
  return users.length >= INVITE_AFTER_TURNS || hasIntent(last);
}

/** Role and maturity are optional; anything outside the known lists is dropped, never rejected. */
export function sanitizeProfile(raw: Record<string, unknown>): Profile {
  const role = String(raw.role ?? '');
  const maturity = String(raw.maturity ?? '');
  return {
    role: GUIDE_ROLES.some((r) => r.id === role) ? role : '',
    maturity: GUIDE_MATURITY.some((m) => m.id === maturity) ? maturity : '',
  };
}

/** The most recent messages, starting with a user turn. */
export function recentHistory(history: ChatMessage[]): ChatMessage[] {
  let recent = history.slice(-HISTORY_LIMIT);
  while (recent.length && recent[0].role !== 'user') recent = recent.slice(1);
  return recent;
}

/** Caps text at `limit` words, cutting at the last full sentence when possible. */
export function clampWords(text: string, limit: number): string {
  const t = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const words = t.split(/\s+/);
  if (words.length <= limit) return t;
  let cut = 0;
  let count = 0;
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) && count < limit) {
    count++;
    cut = m.index + m[0].length;
  }
  const head = t.slice(0, cut);
  const lastStop = Math.max(head.lastIndexOf('. '), head.lastIndexOf('? '), head.lastIndexOf('.\n'), head.lastIndexOf('?\n'));
  const end = /[.?!]$/.test(head) ? head.length : lastStop;
  return end > head.length * 0.5 ? head.slice(0, end + 1).trim() : `${head.replace(/[,;:]$/, '')}…`;
}
