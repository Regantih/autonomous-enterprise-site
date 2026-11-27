// Renders the static (no-JS) HTML for /blueprints/team/ from src/assets/data/team.js, the same file the browser filters.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

export const TEAM_DATA_FILE = 'data/team.js';

export function loadTeam(assetsDir) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(assetsDir, TEAM_DATA_FILE), 'utf8'), ctx, { filename: TEAM_DATA_FILE });
  return ctx.window.AE.team;
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kindOf = (a) => a.kind || 'agent';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Every level a task range covers: 3 -> [3]; [1, 2] -> [1, 2]; null -> []. */
export function taskLevels(l) {
  if (l == null) return [];
  if (Array.isArray(l)) { const out = []; for (let i = l[0]; i <= l[1]; i++) out.push(i); return out; }
  return [l];
}
export const levelLabel = (l) => (l == null ? 'Level not stated' : Array.isArray(l) ? `L${l[0]}–L${l[1]}` : `L${l}`);

/** The set of levels an agent's tasks run at, sorted. */
export function agentLevels(a) {
  const s = new Set();
  for (const t of a.tasks) for (const l of taskLevels(t.l)) s.add(l);
  return [...s].sort((x, y) => x - y);
}
export function agentRange(a) {
  const ls = agentLevels(a);
  if (!ls.length) return null;
  return ls[0] === ls[ls.length - 1] ? ls[0] : [ls[0], ls[ls.length - 1]];
}

/** Counts computed from the data: departments, agents, human roles, tasks, and per department. */
export function teamCounts(T) {
  const per = Object.fromEntries(T.depts.map((d) => [d.id, { agents: 0, roles: 0, tasks: 0 }]));
  for (const a of T.agents) {
    const c = per[a.dept];
    if (kindOf(a) === 'role') c.roles++; else c.agents++;
    c.tasks += a.tasks.length;
  }
  const agents = T.agents.filter((a) => kindOf(a) === 'agent').length;
  return { depts: T.depts.length, agents, roles: T.agents.length - agents, tasks: T.agents.reduce((n, a) => n + a.tasks.length, 0), per };
}

export function deptCountLabel(c) {
  const parts = [];
  if (c.agents) parts.push(plural(c.agents, 'agent', 'agents'));
  if (c.roles) parts.push(plural(c.roles, 'human role', 'human roles'));
  return parts.join(' · ');
}

function searchText(a, d) {
  return [a.name, a.does, d.name, a.owner, a.approver, a.cite, ...a.tasks.map((t) => t.t), ...a.cannot, ...a.inputs, ...a.outputs]
    .join(' ').toLowerCase().replace(/\s+/g, ' ');
}

function card(a, d) {
  const role = kindOf(a) === 'role';
  const range = agentRange(a);
  const lv = role ? '<span class="tm-lvl tm-lvl-role">Human role</span>' : `<span class="tm-lvl${range == null ? ' tm-lvl-none' : ` tm-l${Array.isArray(range) ? range[1] : range}`}">${levelLabel(range)}</span>`;
  const tasks = role ? '' : ` <span class="tm-card-tasks" data-tm-tasks>${plural(a.tasks.length, 'task', 'tasks')}</span>`;
  return `<li class="tm-card${role ? ' tm-card-role' : ''}" data-tm-card data-id="${a.id}" data-kind="${kindOf(a)}" data-levels="${agentLevels(a).join(' ')}" data-task-levels="${a.tasks.map((t) => taskLevels(t.l).join(',') || '-').join(' ')}" data-search="${esc(searchText(a, d))}">
          <a class="tm-card-link" href="#a-${a.id}" data-tm-open="${a.id}">
            <span class="tm-card-name">${esc(a.name)}</span>
            <span class="tm-card-does">${esc(a.does)}</span>
            <span class="tm-card-meta">${lv}${tasks} <span class="md-cite">${esc(a.cite)}</span></span>
          </a>
        </li>`;
}

export function bands(T) {
  const C = teamCounts(T);
  return T.depts.map((d) => {
    const list = T.agents.filter((a) => a.dept === d.id);
    const c = C.per[d.id];
    return `<section class="tm-band tm-c-${d.id}" id="d-${d.id}" aria-labelledby="d-${d.id}-h" data-tm-band="${d.id}">
      <div class="tm-band-head">
        <h3 id="d-${d.id}-h">${esc(d.name)}</h3>
        <p class="tm-band-count" data-tm-band-count data-total="${list.length}">${deptCountLabel(c)}</p>
        <p class="tm-band-lead">${esc(d.lead)} <span class="md-cite">Book, ${esc(d.cite)}</span></p>
      </div>
      <ul class="tm-cards">
        ${list.map((a) => card(a, d)).join('\n        ')}
      </ul>
    </section>`;
  }).join('\n    ');
}

const li = (xs) => xs.map((x) => `<li>${esc(x)}</li>`).join('');
function field(label, body) { return body ? `<div class="tm-f"><dt>${label}</dt><dd>${body}</dd></div>` : ''; }
function listOrNone(xs, none) { return xs.length ? `<ul>${li(xs)}</ul>` : `<p class="tm-none">${none}</p>`; }

/** The full entry for one agent or role: the drill-down. Shown in the panel (JS) or at its anchor (no JS). */
export function entryBody(a, d) {
  const role = kindOf(a) === 'role';
  const tasks = a.tasks.length
    ? `<h4 class="tm-sub">Tasks and skills, each with its autonomy level</h4>
            <ol class="tm-tasks">${a.tasks.map((t) => `<li data-tm-task data-levels="${taskLevels(t.l).join(' ')}"><span class="tm-lvl${t.l == null ? ' tm-lvl-none' : ` tm-l${Array.isArray(t.l) ? t.l[1] : t.l}`}">${levelLabel(t.l)}</span> <span class="tm-task-t">${esc(t.t)}</span> <span class="md-cite">${esc(t.c)}</span></li>`).join('')}</ol>`
    : '';
  const range = agentRange(a);
  return `<p class="tm-entry-does">${esc(a.does)}</p>
          <dl class="tm-fields">
            ${field('Department', esc(d.name))}
            ${role ? '' : field('Autonomy level', `${levelLabel(range)} across its tasks`)}
            ${field('Inputs', a.inputs.length ? `<ul>${li(a.inputs)}</ul>` : '')}
            ${field('Outputs', a.outputs.length ? `<ul>${li(a.outputs)}</ul>` : '')}
            ${field(role ? 'Reports to' : 'Owner', esc(a.owner))}
            ${role ? '' : field('Approver', esc(a.approver))}
            ${field('What moves it up', esc(a.up))}
            ${field('What moves it down', esc(a.down))}
            ${role && !a.cannot.length ? '' : field('Cannot', listOrNone(a.cannot, 'The book lists no limit for this role.'))}
            ${field(role ? 'Sizing and limits' : 'Limits and thresholds', a.limits.length ? `<ul>${li(a.limits)}</ul>` : '')}
            ${field('Kill switch', esc(a.kill))}
            ${field('KPIs and evidence', listOrNone(a.kpis, 'The book names no KPI for this one.'))}
            ${field('Exception path to a person', esc(a.exception))}
            ${field('From the book', `<span class="md-cite">${[a.cite, ...a.refs].map(esc).join(', ')}</span>`)}
          </dl>
          ${tasks}`;
}

export function directory(T) {
  return T.depts.map((d) => {
    const list = T.agents.filter((a) => a.dept === d.id);
    return `<div class="tm-dir-group tm-c-${d.id}">
      <h3 class="tm-dir-h">${esc(d.name)} <span class="md-cite">Book, ${esc(d.cite)}</span></h3>
      ${list.map((a) => `<details class="tm-entry" id="a-${a.id}" data-tm-entry="${a.id}">
        <summary><span class="tm-entry-name">${esc(a.name)}</span> <span class="tm-entry-meta">${kindOf(a) === 'role' ? 'Human role' : levelLabel(agentRange(a))} · ${esc(a.cite)}</span></summary>
        <div class="tm-entry-body" data-tm-body>
          ${entryBody(a, d)}
        </div>
      </details>`).join('\n      ')}
    </div>`;
  }).join('\n    ');
}

function filters(T) {
  const C = teamCounts(T);
  const levelN = (l) => T.agents.filter((a) => agentLevels(a).includes(l)).length;
  return `<div class="tm-filters" role="search" aria-label="Filter the team" data-tm-filters hidden>
      <div class="tm-filter">
        <label for="tm-q">Search</label>
        <input id="tm-q" type="search" autocomplete="off" spellcheck="false" placeholder="Agent, task or owner" data-tm-q>
      </div>
      <div class="tm-filter">
        <label for="tm-dept">Department</label>
        <select id="tm-dept" data-tm-dept>
          <option value="">All departments · ${plural(C.agents, 'agent', 'agents')}</option>
          ${T.depts.map((d) => `<option value="${d.id}">${esc(d.short)} · ${deptCountLabel(C.per[d.id])}</option>`).join('\n          ')}
        </select>
      </div>
      <div class="tm-filter">
        <label for="tm-level">Autonomy level</label>
        <select id="tm-level" data-tm-level>
          <option value="">Any level</option>
          ${T.levels.map((v) => `<option value="${v.l}">L${v.l} ${esc(v.name)} · ${plural(levelN(v.l), 'agent', 'agents')}</option>`).join('\n          ')}
        </select>
      </div>
      <button class="btn btn-ghost tm-reset" type="button" data-tm-reset>Clear filters</button>
    </div>
    <p class="tm-status" role="status" aria-live="polite" data-tm-status>Showing all ${plural(C.agents, 'agent', 'agents')} and ${plural(C.roles, 'human role', 'human roles')} in ${C.depts} departments.</p>`;
}

function levelsTable(T) {
  return `<ol class="tm-scale">
${T.levels.map((v) => `      <li class="tm-l${v.l}"><span class="tm-lvl tm-l${v.l}">L${v.l}</span> <b>${esc(v.name)}.</b> ${esc(v.who)}</li>`).join('\n')}
    </ol>`;
}

function summary(T) {
  const C = teamCounts(T);
  return `<ul class="tm-stats" aria-label="The team in numbers">
      <li><b data-tm-n="depts">${C.depts}</b> departments</li>
      <li><b data-tm-n="agents">${C.agents}</b> agents</li>
      <li><b data-tm-n="tasks">${C.tasks}</b> tasks and skills</li>
      <li><b data-tm-n="roles">${C.roles}</b> human roles</li>
    </ul>`;
}

export function teamVars(assetsDir) {
  const T = loadTeam(assetsDir);
  return {
    TEAM_SUMMARY: summary(T),
    TEAM_SCALE: levelsTable(T),
    TEAM_FILTERS: filters(T),
    TEAM_BANDS: bands(T),
    TEAM_DIRECTORY: directory(T),
  };
}

// ---------- the guide's knowledge pack ----------

/** Longest line the guide's search returns for one agent; search_book hands the model at most four lines. */
export const TEAM_LINE_MAX = 760;

const flat = (t) => String(t).replace(/\s+/g, ' ').trim();
const list = (xs, n) => xs.slice(0, n).map(flat).join('; ');
const clip = (t, n) => (t.length <= n ? t : `${t.slice(0, n - 1).replace(/[\s,;:]+\S*$/, '')}…`);

/**
 * One searchable line per agent or human role, summarised to fit TEAM_LINE_MAX: what it does and its department come
 * first, then its level by task, owner, a limit, a KPI and what it cannot do. A part that does not fit is left out
 * whole (the page has the rest); the chapter citation always closes the line so an answer can cite it.
 */
export function teamAgentLine(a, d) {
  const ch = a.cite.replace(/^Ch\s+/, '');
  const range = agentRange(a);
  const who = kindOf(a) === 'role' ? 'human role' : 'agent';
  const cite = ` [Ch ${ch}]`;
  const head = clip(`${a.name} (${who}, ${d.short} department; Ch ${ch}): ${flat(a.does)}`, 300);
  const optional = [
    `${range == null ? 'Level not stated in the book' : `Autonomy ${levelLabel(range)}`}${a.tasks.length ? `; tasks: ${a.tasks.slice(0, 2).map((t) => `${flat(t.t)} (${levelLabel(t.l)})`).join('; ')}` : ''}.`,
    `Owner: ${flat(a.owner)}${a.approver && !/^n\/a$/i.test(flat(a.approver)) ? `; approver: ${flat(a.approver)}` : ''}.`,
    a.limits.length ? `Limit: ${list(a.limits, 1)}.` : '',
    a.kpis.length ? `KPIs: ${list(a.kpis, 2)}.` : '',
    a.cannot.length ? `Cannot: ${list(a.cannot, 1)}.` : '',
  ].filter(Boolean).map((t) => t.replace(/\.\.$/, '.'));
  let line = head.replace(/\.?$/, '.');
  for (const part of optional) if (line.length + 1 + part.length + cite.length <= TEAM_LINE_MAX) line += ` ${part}`;
  return line + cite;
}

/** The team section of the guide's knowledge pack, generated from the same data file the page renders. */
export function teamKnowledge(T) {
  const c = teamCounts(T);
  const byDept = new Map(T.depts.map((d) => [d.id, d]));
  const lines = [
    `## Agent operations team (page /blueprints/team/; Book, Ch 12–20, 05, 06, 22, 24, 25)`,
    `- The Agent Operations Team page at /blueprints/team/ lists every agent the book names: ${c.agents} agents and ${c.roles} human roles in ${c.depts} departments, ${c.tasks} tasks, each task tagged with its L0 to L5 level or "Level not stated", with owner, approver, limits, kill switch, KPIs and a chapter citation (Ch 12–20, 05, 22, 24, 25).`,
  ];
  for (const d of T.depts) {
    const names = T.agents.filter((a) => a.dept === d.id).map((a) => a.name);
    lines.push(`- ${d.short} department (${flat(d.name)}; ${d.cite}): ${flat(d.lead)} ${deptCountLabel(c.per[d.id])}: ${names.join(', ')}.`);
  }
  for (const a of T.agents) lines.push(`- ${teamAgentLine(a, byDept.get(a.dept))}`);
  return lines.join('\n');
}
