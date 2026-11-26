import { describe, expect, it } from 'vitest';
import { isHoneypotFilled, validateRequest } from '../lib/validate';

const speaking = {
  type: 'speaking',
  name: 'Jane Doe',
  email: 'Jane@Example.com',
  organization: 'Example Org',
  role: 'Chief of staff',
  event_name: 'Leadership Summit',
  event_date: '2027-03-14',
  delivery: 'in-person',
  location: 'Dallas',
  audience_size: '200-500',
  format: 'keynote',
  message: 'We would like a keynote on autonomy levels.',
};

const consultation = {
  type: 'consultation',
  name: 'Sam Lee',
  email: 'sam@example.com',
  organization: 'Acme',
  company_size: '5000-25000',
  goals: ['readiness-assessment', 'operating-model', 'operating-model'],
  timeline: '1-3-months',
};

const media = {
  type: 'media',
  name: 'Ana Ruiz',
  email: 'ana@example.com',
  outlet: 'Enterprise Weekly Podcast',
  topic: 'Governing AI agents',
  deadline: '2026-12-10',
  message: 'A 40-minute recorded interview for our leadership audience.',
};

const today = new Date('2026-11-25T12:00:00Z');

describe('validateRequest', () => {
  it('accepts a complete speaking request and moves type-specific fields into details', () => {
    const r = validateRequest(speaking, today);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ type: 'speaking', name: 'Jane Doe', email: 'jane@example.com', role: 'Chief of staff' });
    expect(r.value.details).toEqual({
      event_name: 'Leadership Summit',
      event_date: '2027-03-14',
      delivery: 'in-person',
      location: 'Dallas',
      audience_size: '200-500',
      format: 'keynote',
      message: 'We would like a keynote on autonomy levels.',
    });
  });

  it('accepts a consultation request, de-duplicates goals and drops empty optionals', () => {
    const r = validateRequest(consultation, today);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.role).toBeNull();
    expect(r.value.details).toEqual({
      company_size: '5000-25000',
      goals: ['readiness-assessment', 'operating-model'],
      timeline: '1-3-months',
    });
  });

  it('accepts a single goal sent as a string (form-encoded posts)', () => {
    const r = validateRequest({ ...consultation, goals: 'other' }, today);
    expect(r.ok && r.value.details.goals).toEqual(['other']);
  });

  it('rejects unknown types', () => {
    expect(validateRequest({ ...speaking, type: 'sales' })).toEqual({ ok: false, errors: { type: 'Unknown request type.' } });
  });

  it('reports every missing required speaking field', () => {
    const r = validateRequest({ type: 'speaking' }, today);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(
      ['delivery', 'email', 'event_name', 'format', 'message', 'name', 'organization'].sort(),
    );
  });

  it('requires at least one valid consultation goal', () => {
    const none = validateRequest({ ...consultation, goals: [] }, today);
    expect(!none.ok && none.errors.goals).toBe('Please choose at least one goal.');
    const bad = validateRequest({ ...consultation, goals: ['hack'] }, today);
    expect(!bad.ok && bad.errors.goals).toBe('Please choose valid goals.');
  });

  it.each([
    ['email', 'not-an-email'],
    ['email', 'a@b'],
    ['format', 'stand-up'],
    ['delivery', 'hologram'],
    ['audience_size', '10'],
    ['event_date', '2020-01-01'],
    ['event_date', '14/03/2027'],
    ['name', 'x'],
    ['message', 'short'],
    ['organization', 'o'.repeat(161)],
  ])('rejects invalid %s = %j', (field, value) => {
    const r = validateRequest({ ...speaking, [field]: value }, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[field]).toBeTruthy();
  });

  it('rejects invalid consultation selects', () => {
    const r = validateRequest({ ...consultation, company_size: 'huge', timeline: 'yesterday' }, today);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['company_size', 'timeline']);
  });

  it('trims whitespace and strips control characters', () => {
    const r = validateRequest({ ...speaking, name: '  Jane\u0000 Doe  ' }, today);
    expect(r.ok && r.value.name).toBe('Jane Doe');
  });

  it('ignores non-string values', () => {
    const r = validateRequest({ ...speaking, name: { $gt: '' } }, today);
    expect(!r.ok && r.errors.name).toBe('Name is required.');
  });
});

describe('isHoneypotFilled', () => {
  it('detects the hidden website field', () => {
    expect(isHoneypotFilled({ website: 'http://spam' })).toBe(true);
    expect(isHoneypotFilled({ website: '  ' })).toBe(false);
    expect(isHoneypotFilled({})).toBe(false);
  });
});

describe('validateRequest (media)', () => {
  it('accepts a media request, storing the outlet as organization', () => {
    const r = validateRequest(media, today);
    expect(r).toEqual({
      ok: true,
      value: {
        type: 'media', name: 'Ana Ruiz', email: 'ana@example.com', organization: 'Enterprise Weekly Podcast', role: null,
        details: { topic: 'Governing AI agents', deadline: '2026-12-10', message: 'A 40-minute recorded interview for our leadership audience.' },
      },
    });
  });

  it('treats the deadline as optional and ignores organization/role fields', () => {
    const r = validateRequest({ ...media, deadline: '', organization: 'Other', role: 'Host' }, today);
    expect(r.ok && r.value).toMatchObject({ organization: 'Enterprise Weekly Podcast', role: null, details: { topic: 'Governing AI agents' } });
    expect(r.ok && 'deadline' in r.value.details).toBe(false);
  });

  it('reports missing outlet, topic and message', () => {
    const r = validateRequest({ type: 'media', name: 'Ana Ruiz', email: 'ana@example.com' }, today);
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['message', 'outlet', 'topic']);
  });

  it('rejects past or malformed deadlines', () => {
    const past = validateRequest({ ...media, deadline: '2026-01-01' }, today);
    expect(!past.ok && past.errors.deadline).toBe('Deadline must be in the future.');
    const bad = validateRequest({ ...media, deadline: 'soon' }, today);
    expect(!bad.ok && bad.errors.deadline).toBe('Please enter a valid date.');
  });
});
