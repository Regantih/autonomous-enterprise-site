export type RequestType = 'speaking' | 'consultation';

export interface ValidRequest {
  type: RequestType;
  name: string;
  email: string;
  organization: string;
  role: string | null;
  details: Record<string, string | string[]>;
}

export type ValidationResult =
  | { ok: true; value: ValidRequest }
  | { ok: false; errors: Record<string, string> };

export const HONEYPOT_FIELD = 'website';

export const SPEAKING_FORMATS = ['keynote', 'panel', 'fireside-chat', 'workshop'] as const;
export const SPEAKING_DELIVERY = ['in-person', 'virtual'] as const;
export const AUDIENCE_SIZES = ['under-50', '50-200', '200-500', '500-1000', 'over-1000'] as const;
export const COMPANY_SIZES = ['under-500', '500-5000', '5000-25000', 'over-25000'] as const;
export const CONSULTING_GOALS = [
  'readiness-assessment',
  'governance-guardrails',
  'operating-model',
  'business-case-roadmap',
  'other',
] as const;
export const TIMELINES = ['now', '1-3-months', '3-6-months', 'exploring'] as const;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Input = Record<string, unknown>;

function text(input: Input, key: string): string {
  const raw = input[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return '';
  // Strip control characters except tab/newline, normalise whitespace at the ends.
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

function list(input: Input, key: string): string[] {
  const raw = input[key];
  const arr = Array.isArray(raw) ? raw : raw === undefined || raw === null || raw === '' ? [] : [raw];
  return arr.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean);
}

class Checker {
  errors: Record<string, string> = {};
  constructor(private input: Input) {}

  str(key: string, label: string, opts: { required?: boolean; max: number; min?: number }): string {
    const v = text(this.input, key);
    if (!v) {
      if (opts.required) this.errors[key] = `${label} is required.`;
      return '';
    }
    if (opts.min && v.length < opts.min) this.errors[key] = `${label} must be at least ${opts.min} characters.`;
    else if (v.length > opts.max) this.errors[key] = `${label} must be ${opts.max} characters or fewer.`;
    return v;
  }

  /** `what` completes the sentence "Please choose ...", e.g. "a format". */
  choice<T extends string>(key: string, what: string, allowed: readonly T[], required: boolean): T | '' {
    const v = text(this.input, key);
    if (!v) {
      if (required) this.errors[key] = `Please choose ${what}.`;
      return '';
    }
    if (!(allowed as readonly string[]).includes(v)) {
      this.errors[key] = `Please choose ${what} from the list.`;
      return '';
    }
    return v as T;
  }
}

export function isHoneypotFilled(input: Input): boolean {
  return text(input, HONEYPOT_FIELD) !== '';
}

export function validateRequest(input: Input, today: Date = new Date()): ValidationResult {
  const c = new Checker(input);
  const type = text(input, 'type');
  if (type !== 'speaking' && type !== 'consultation') {
    return { ok: false, errors: { type: 'Unknown request type.' } };
  }

  const name = c.str('name', 'Name', { required: true, max: 120, min: 2 });
  const email = c.str('email', 'Email', { required: true, max: 254 });
  if (email && !c.errors.email && !EMAIL_RE.test(email)) c.errors.email = 'Please enter a valid email address.';
  const organization = c.str('organization', 'Organization', { required: true, max: 160 });
  const role = c.str('role', 'Role', { max: 120 });

  const details: Record<string, string | string[]> = {};
  const put = (k: string, v: string | string[]) => {
    if (Array.isArray(v) ? v.length : v) details[k] = v;
  };

  if (type === 'speaking') {
    put('event_name', c.str('event_name', 'Event name', { required: true, max: 160 }));
    const date = c.str('event_date', 'Event date', { max: 10 });
    if (date) {
      const parsed = new Date(`${date}T00:00:00Z`);
      const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
      if (!DATE_RE.test(date) || Number.isNaN(parsed.getTime())) c.errors.event_date = 'Please enter a valid date.';
      else if (parsed.getTime() < startOfToday - 86_400_000) c.errors.event_date = 'Event date must be in the future.';
    }
    put('event_date', c.errors.event_date ? '' : date);
    put('delivery', c.choice('delivery', 'in person or virtual', SPEAKING_DELIVERY, true));
    put('location', c.str('location', 'Location', { max: 160 }));
    put('audience_size', c.choice('audience_size', 'an audience size', AUDIENCE_SIZES, false));
    put('format', c.choice('format', 'a format', SPEAKING_FORMATS, true));
    put('message', c.str('message', 'Message', { required: true, max: 4000, min: 10 }));
  } else {
    put('company_size', c.choice('company_size', 'a company size', COMPANY_SIZES, false));
    const goals = list(input, 'goals');
    const allowed = CONSULTING_GOALS as readonly string[];
    if (goals.length === 0) c.errors.goals = 'Please choose at least one goal.';
    else if (goals.length > allowed.length || goals.some((g) => !allowed.includes(g))) {
      c.errors.goals = 'Please choose valid goals.';
    }
    put('goals', c.errors.goals ? [] : [...new Set(goals)]);
    put('timeline', c.choice('timeline', 'a timeline', TIMELINES, false));
    put('message', c.str('message', 'Message', { max: 4000 }));
  }

  if (Object.keys(c.errors).length) return { ok: false, errors: c.errors };
  return {
    ok: true,
    value: { type, name, email: email.toLowerCase(), organization, role: role || null, details },
  };
}
