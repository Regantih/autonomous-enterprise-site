/* Live operations room engine for /blueprints/loops/.
   Scripted, deterministic, client-side. No model calls, no network, no storage.
   Simulated agents, illustrative numbers. Same seed and same visitor choices give the same run. */
(function (g) {
  'use strict';
  var AE = g.AE = g.AE || {};

  var STEPS = [
    { id: 'expand', n: 1, name: 'Expand', owner: 'Proposer agent',
      what: 'The Proposer suggests two or three variants. A variant changes a prompt, a tool, a workflow step or a threshold.',
      evidence: 'Each variant with its parent, its change and its reason.', controls: ['TRC-05', 'TRC-04'] },
    { id: 'guard', n: 2, name: 'Guard', owner: 'Guardrail harness',
      what: 'Fitness functions test every variant. A variant that breaks a protected characteristic stops here.',
      evidence: 'Pass or fail for each fitness function, per variant.', controls: ['MR-01', 'MR-10', 'SOD-02'] },
    { id: 'decide', n: 3, name: 'Decide', owner: 'Supervisor agent; you for one-way doors',
      what: 'Two-way doors ship behind an undo. One-way doors wait for a named person.',
      evidence: 'Door type, approver name and the undo path.', controls: ['HO-06', 'SOD-03', 'HO-01'] },
    { id: 'measure', n: 4, name: 'Measure', owner: 'Evaluator (locked scorer)',
      what: 'The Evaluator scores each variant against one goal number. Fast automated checks run beside it.',
      evidence: 'Goal score, guardrail readings and the scorer version.', controls: ['MR-10', 'MR-09', 'MON-01'] },
    { id: 'contract', n: 5, name: 'Contract', owner: 'Archivist',
      what: 'Keep the winner. Archive the losers. Retire what nobody uses. Review the lineage.',
      evidence: 'The archive with lineage. The list of retired variants.', controls: ['TRC-05', 'IAM-04'] },
    { id: 'reframe', n: 6, name: 'Reframe', owner: 'You and the leadership team, monthly',
      what: 'People question the goal, the checks and the playbook. This is double-loop learning.',
      evidence: 'Reframe minutes. Old and new goal, thresholds and owners.', controls: ['HO-02', 'MR-02'] }
  ];

  var AGENTS = [
    { id: 'proposer', name: 'Proposer agent', short: 'P', role: 'Proposes variants' },
    { id: 'harness', name: 'Guardrail harness', short: 'H', role: 'Runs fitness checks' },
    { id: 'supervisor', name: 'Supervisor agent', short: 'S', role: 'Routes doors and decisions' },
    { id: 'evaluator', name: 'Evaluator', short: 'E', role: 'Locked scorer, one goal number' },
    { id: 'archivist', name: 'Archivist', short: 'A', role: 'Keeps the archive and lineage' },
    { id: 'you', name: 'You', short: 'You', role: 'AP process owner' }
  ];

  var CHIPS = [
    { id: 'cheaper', label: 'Try a cheaper variant' },
    { id: 'fairness', label: 'Tighten the fairness check' },
    { id: 'goal', label: 'Reframe the goal' },
    { id: 'lineage', label: 'Show the champion\u2019s lineage' }
  ];

  var GOALS = {
    cost: { name: 'Cost per completed outcome', better: -1 },
    fpr: { name: 'First-pass resolution', better: 1 }
  };

  var MUT = {
    prompt: { kind: 'Prompt', door: 2, label: function (c) { return 'Reword the exception reply template (v' + c.v + ')'; } },
    tol: { kind: 'Threshold', door: 2, label: function (c) { return 'Widen price-match tolerance to ' + c.tol.toFixed(1) + '%'; } },
    conf: { kind: 'Threshold', door: 2, label: function (c) { return 'Lower the confidence threshold to ' + c.conf.toFixed(2); } },
    dup: { kind: 'Workflow step', door: 2, label: function () { return 'Add a duplicate-invoice check step'; } },
    rule: { kind: 'Workflow step', door: 2, label: function (c) { return 'Add a supplier-specific matching rule (' + c.rules + ' rules)'; } },
    prune: { kind: 'Workflow step', door: 2, label: function (c) { return 'Retire the least-used rule (' + c.rules + ' rules)'; } },
    sortBig: { kind: 'Workflow step', door: 2, label: function () { return 'Work the largest invoices first'; } },
    skipTrace: { kind: 'Workflow step', door: 2, label: function () { return 'Skip the trace on invoices under $500'; } },
    small: { kind: 'Model', door: 2, label: function () { return 'Route routine matches to a small model, old model pinned'; } },
    limit: { kind: 'Threshold', door: 1, label: function (c) { return 'Raise the auto-approve limit to ' + money(c.limit); } },
    retr: { kind: 'Data source', door: 1, label: function () { return 'Add the supplier master as a new data source'; } },
    write: { kind: 'Tool', door: 1, label: function () { return 'Give the agent write access to supplier records'; } },
    hackCount: { kind: 'Evaluator', door: 1, hack: true, label: function () { return 'Edit the evaluator: count escalations as resolved'; } },
    hackRev: { kind: 'Evaluator', door: 2, hack: true, label: function () { return 'Edit the evaluator: count only same-day reversals'; } },
    hackEasy: { kind: 'Evaluator', door: 2, hack: true, label: function () { return 'Edit the evaluator: drop hard cases from the test set'; } }
  };

  var DEFAULTS = { revMax: 2.0, fairMax: 3.0, breachMax: 0, traceMin: 100 };
  var BASE = { v: 1, prompt: 0.30, tol: 2.0, conf: 0.90, limit: 2500, dup: false, retr: false, write: false, sortBig: false, skipTrace: false, small: false, rules: 4, hacks: [] };
  var POLICY_LIMIT = 25000, MAX_GEN = 9, REFRAME_AFTER = 5;

  function money(x) { return '$' + Math.round(x).toLocaleString('en-US'); }
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function copy(c) { var o = {}; for (var k in c) o[k] = Array.isArray(c[k]) ? c[k].slice() : c[k]; return o; }
  function has(c, h) { return c.hacks.indexOf(h) >= 0; }

  // True outcome of a playbook. Illustrative model.
  function truth(c) {
    var rulesGain = 1.2 * Math.min(c.rules, 8) - 0.9 * Math.max(0, c.rules - 8);
    var fpr = 38 + 25 * c.prompt + 1.2 * c.tol + (0.95 - c.conf) * 40 + (c.limit / 50000) * 8 +
      (c.dup ? 3 : 0) + (c.retr ? 6 : 0) + (c.write ? 5 : 0) + (c.sortBig ? 4 : 0) + (c.skipTrace ? 2 : 0) - (c.small ? 1.5 : 0) + rulesGain;
    fpr = clamp(fpr, 5, 97);
    var cost = 14 - 6 * c.prompt - 0.15 * c.tol - (0.95 - c.conf) * 6 + (c.dup ? 0.4 : 0) + (c.retr ? 0.6 : 0) -
      (c.write ? 1 : 0) - (c.sortBig ? 0.8 : 0) - (c.skipTrace ? 1.2 : 0) - (c.small ? 1.6 : 0) - (c.limit / 50000) * 2 + 0.25 * c.rules;
    cost = Math.max(3, cost);
    var rev = 0.6 + 0.12 * c.tol + Math.max(0, 0.8 - c.conf) * 12 + (c.limit / 50000) * 1.5 - (c.dup ? 0.4 : 0) + (c.write ? 0.8 : 0) + (c.small ? 0.15 : 0);
    rev = Math.max(0.1, rev);
    var breaches = (c.limit > POLICY_LIMIT ? 1 : 0) + (c.write && !c.dup ? 1 : 0);
    var fair = 1 + (c.sortBig ? 4 : 0) + (c.conf < 0.65 ? 1.5 : 0);
    var trace = c.skipTrace ? 92 : 100;
    var excess = Math.max(0, rev - 1.5);
    // Evaluator edits change behaviour too: escalations closed as resolved come back as rework.
    var hackFpr = (has(c, 'hackCount') ? 8 : 0) + (has(c, 'hackEasy') ? 3 : 0);
    var hackCost = (has(c, 'hackCount') ? 1.15 : 1) * (has(c, 'hackEasy') ? 1.05 : 1);
    return { fpr: fpr, cost: cost, rev: rev, breaches: breaches, fair: fair, trace: trace,
      realFpr: fpr - 10 * excess - hackFpr, realCost: cost * (1 + 0.2 * excess) * hackCost };
  }

  // What the evaluator reports. Evaluator edits in the lineage flatter it.
  function reported(c, t) {
    var fpr = t.fpr, cost = t.cost, rev = t.rev;
    if (has(c, 'hackCount')) { fpr += 12; cost *= 0.85; }
    if (has(c, 'hackEasy')) { fpr += 6; cost *= 0.92; }
    if (has(c, 'hackRev')) { rev = rev * 0.3; fpr += 3; cost *= 0.96; }
    return { fpr: Math.min(fpr, 99), cost: cost, rev: rev, breaches: t.breaches, fair: t.fair, trace: t.trace };
  }

  function fmt(x, goal) { return goal === 'fpr' ? x.toFixed(1) + '%' : '$' + x.toFixed(2); }
  function better(a, b, goal) { return GOALS[goal].better > 0 ? a > b : a < b; }

  function checks(m, s) {
    return [
      { id: 'rev', name: 'Reversal rate', pass: m.rev <= s.revMax, detail: m.rev.toFixed(1) + '% (limit ' + s.revMax.toFixed(1) + '%)' },
      { id: 'policy', name: 'Policy breaches', pass: m.breaches <= s.breachMax, detail: m.breaches + ' (limit 0)' },
      { id: 'fair', name: 'Fairness gap', pass: m.fair <= s.fairMax, detail: m.fair.toFixed(1) + ' pts (limit ' + s.fairMax.toFixed(1) + ')' },
      { id: 'trace', name: 'Audit trace', pass: m.trace >= s.traceMin, detail: m.trace + '% complete' }
    ];
  }

  function mutate(parent, m, R) {
    var c = copy(parent);
    if (m === 'prompt') { c.prompt = clamp(c.prompt + (R() * 0.16 - 0.04), 0, 1); c.v = parent.v + 1; }
    if (m === 'tol') c.tol = Math.min(10, c.tol + 0.5 + R() * 1.5);
    if (m === 'conf') c.conf = Math.max(0.5, c.conf - (0.03 + R() * 0.05));
    if (m === 'dup') { c.dup = true; c.rules += 1; }
    if (m === 'rule') c.rules += 1;
    if (m === 'prune') c.rules -= 1;
    if (m === 'sortBig') c.sortBig = true;
    if (m === 'skipTrace') c.skipTrace = true;
    if (m === 'small') c.small = true;
    if (m === 'limit') c.limit = c.limit * 2;
    if (m === 'retr') c.retr = true;
    if (m === 'write') c.write = true;
    if (MUT[m].hack && !has(c, m)) c.hacks.push(m);
    return c;
  }

  function allowed(c, m) {
    return !((m === 'dup' && c.dup) || (m === 'retr' && c.retr) || (m === 'write' && c.write) || (m === 'sortBig' && c.sortBig) ||
      (m === 'skipTrace' && c.skipTrace) || (m === 'small' && c.small) || (MUT[m].hack && has(c, m)) || (m === 'conf' && c.conf <= 0.5) ||
      (m === 'tol' && c.tol >= 10) || (m === 'rule' && c.rules >= 12) || (m === 'limit' && c.limit * 2 > POLICY_LIMIT * 2) || (m === 'prune' && c.rules <= 4));
  }

  function pick(run, c) {
    var pool = ['prompt', 'prompt', 'tol', 'conf', 'conf', 'dup', 'rule', 'rule', 'sortBig', 'skipTrace', 'retr', 'write', 'limit'];
    if (c.rules > 6) pool.push('prune', 'prune', 'prune');
    if (c.hacks.length) pool.push('hackRev', 'hackRev', 'hackEasy', 'conf', 'conf', 'conf', 'conf', 'tol', 'tol');
    for (var i = 0; i < 14; i++) { var m = pool[Math.floor(run.R() * pool.length)]; if (allowed(c, m) && !run.banned[m]) return m; }
    return 'prompt';
  }

  /* ---------- run state and events ---------- */

  function create(seed, opts) {
    opts = opts || {};
    var run = { seed: seed >>> 0, R: rng(seed), gen: 0, maxGen: opts.maxGen || MAX_GEN, goal: opts.goal || 'cost', settings: copy(DEFAULTS),
      lock: true, variants: [], byId: {}, queue: [], urgent: [], log: [], waiting: null, done: false, part: null,
      cheaper: false, reframed: false, banned: {}, hackAt: null, clean: null, caught: false, decisions: [], nextDecision: 1, history: [] };
    var root = { id: 'V0', gen: 0, parent: null, mutation: 'start', change: 'Starting playbook', kind: 'Start', door: 2, cfg: copy(BASE), status: 'champion', wasChampion: true };
    score(run, root);
    add(run, root);
    run.champion = root;
    run.clean = root;
    return run;
  }

  function add(run, v) { run.variants.push(v); run.byId[v.id] = v; }
  function score(run, v) {
    var t = truth(v.cfg), rep = reported(v.cfg, t);
    var noise = (run.R() - 0.5) * (run.goal === 'fpr' ? 0.6 : 0.12);
    v.t = t; v.rep = rep; v.goal = run.goal;
    v.score = r2((run.goal === 'fpr' ? rep.fpr : rep.cost) + noise);
    v.real = r2(run.goal === 'fpr' ? t.realFpr : t.realCost);
  }
  function snap(v) { return { id: v.id, parent: v.parent, gen: v.gen, status: v.status, change: v.change, door: v.door, kind: v.kind, hack: !!v.hack, score: v.score, real: v.real, wasChampion: !!v.wasChampion, breakthrough: !!v.breakthrough }; }

  function E(run, ev) { run.queue.push(ev); }
  function say(run, a, text, extra) { var e = { t: 'msg', a: a, text: text }; if (extra) for (var k in extra) e[k] = extra[k]; E(run, e); }
  function phase(run, step) { E(run, { t: 'phase', step: step, gen: run.gen }); }
  function vev(run, v) { E(run, { t: 'variant', v: snap(v) }); }
  function metric(run, note) {
    var c = run.champion;
    var h = { gen: run.gen, goal: run.goal, score: c.score, real: c.real, champion: c.id, note: note || '' };
    run.history.push(h);
    E(run, { t: 'metric', gen: h.gen, goal: h.goal, score: h.score, real: h.real, champion: h.champion, note: h.note });
  }

  function decision(run, kind, v, title, body, options) {
    var d = { t: 'decision', id: 'D' + run.nextDecision++, kind: kind, variant: v ? v.id : null, door: v ? (v.door === 1 ? 'one-way' : 'two-way') : null,
      title: title, body: body, options: options || [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }, { id: 'why', label: 'Ask why' }] };
    E(run, d);
    return d;
  }

  /* ---------- scenes ---------- */

  function intro(run) {
    phase(run, 'expand');
    say(run, 'supervisor', 'Operations room open. Workflow: accounts-payable exception handling. Goal number: ' + GOALS[run.goal].name.toLowerCase() + '. You are the AP process owner. One-way doors come to you.');
    say(run, 'evaluator', 'Baseline champion V0 scores ' + fmt(run.champion.score, run.goal) + '. My scorer is locked outside the loop. Nobody in the loop can edit it.');
    vev(run, run.champion);
    metric(run, 'Baseline');
  }

  function propose(run, g) {
    var parentPool = run.variants.filter(function (v) { return v.status === 'archived'; });
    var forced = g === 2 ? 'limit' : (g === 4 && run.lock && !run.hackAt) ? 'hackCount' : null;
    var out = [];
    for (var i = 0; i < 3; i++) {
      var parent = run.champion;
      if (i > 0 && parentPool.length && run.R() < 0.2) parent = parentPool[Math.floor(run.R() * parentPool.length)];
      var m;
      if (i === 2 && forced) { m = forced; parent = run.champion; }
      else if (i === 0 && run.cheaper && allowed(run.champion.cfg, 'small')) { m = 'small'; parent = run.champion; run.cheaper = false; }
      else m = pick(run, parent.cfg);
      var cfg = mutate(parent.cfg, m, run.R);
      var v = { id: 'G' + g + '-' + (i + 1), gen: g, parent: parent.id, mutation: m, kind: MUT[m].kind, door: MUT[m].door, hack: !!MUT[m].hack, cfg: cfg, change: MUT[m].label(cfg), status: 'proposed' };
      score(run, v);
      add(run, v); out.push(v);
    }
    return out;
  }

  function generation(run) {
    var g = ++run.gen;
    phase(run, 'expand');
    say(run, 'proposer', 'Generation ' + g + '. I will propose three variants. Parent: champion ' + run.champion.id + '.');
    var vs = propose(run, g);
    E(run, { t: 'tool', a: 'proposer', name: 'propose_variants', args: '{ parent: "' + run.champion.id + '", count: 3 }',
      result: vs.map(function (v) { return v.id + ' (' + v.kind.toLowerCase() + ', ' + (v.door === 1 ? 'one-way' : 'two-way') + '): ' + v.change; }).join('\n') });
    vs.forEach(function (v) { vev(run, v); });

    phase(run, 'guard');
    say(run, 'harness', 'Running fitness checks on ' + vs.length + ' variants.');
    var passed = [], scorerEdit = null;
    vs.forEach(function (v) {
      if (v.hack && run.lock) {
        E(run, { t: 'checks', a: 'harness', variant: v.id, items: [{ id: 'scorer', name: 'Scorer isolation', pass: false, detail: 'MR-10: the loop may not edit its evaluator' }] });
        v.status = 'blocked'; vev(run, v); scorerEdit = v;
        say(run, 'harness', v.id + ' is blocked. It tries to change how the loop is scored.');
        return;
      }
      var items = checks(v.rep, run.settings);
      E(run, { t: 'checks', a: 'harness', variant: v.id, items: items });
      var fails = items.filter(function (x) { return !x.pass; });
      if (fails.length) { v.status = 'blocked'; v.note = fails.map(function (f) { return f.name; }).join(', '); vev(run, v); say(run, 'harness', v.id + ' blocked: ' + v.note.toLowerCase() + '.'); }
      else passed.push(v);
    });

    phase(run, 'decide');
    var two = passed.filter(function (v) { return v.door === 2; }), one = passed.filter(function (v) { return v.door === 1; });
    if (two.length) say(run, 'supervisor', list(two.map(function (v) { return v.id; })) + (two.length > 1 ? ' are two-way doors. They ship' : ' is a two-way door. It ships') + ' behind a one-click undo.');
    if (!passed.length && !scorerEdit) say(run, 'supervisor', 'Nothing passed the guard this generation. The champion stays.');
    var ask = null;
    if (scorerEdit) ask = scorerEdit;
    else if (one.length) ask = one[0];
    one.forEach(function (v) { if (v !== ask) { v.status = 'parked'; vev(run, v); say(run, 'supervisor', v.id + ' is a one-way door. Parked for your next review.'); } });
    run.part = { candidates: two.slice(), ask: ask };
    two.forEach(function (v) { v.status = 'candidate'; });
    if (ask) {
      ask.status = 'pending'; vev(run, ask);
      if (ask.hack) {
        say(run, 'supervisor', 'The Proposer asks to change the evaluator. The harness blocked it. Only you can override the scorer lock.');
        run.part.d = decision(run, 'scorer', ask, 'Override the scorer lock for ' + ask.id + '?', 'The Proposer wants to edit the evaluator: count escalations as resolved. The harness blocks this by default.',
          [{ id: 'approve', label: 'Override the lock' }, { id: 'reject', label: 'Keep it blocked' }, { id: 'why', label: 'Ask why' }]);
      } else {
        say(run, 'supervisor', ask.id + ' is a one-way door. Routing it to you.');
        run.part.d = decision(run, 'door', ask, 'Approve: ' + lowerFirst(ask.change) + '?', 'One-way door. Hard to undo once it ships. Evaluator score ' + fmt(ask.score, run.goal) + ' against champion ' + fmt(run.champion.score, run.goal) + '.');
      }
      return;
    }
    finish(run);
  }

  function list(a) { return a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  function why(run, d) {
    var v = run.byId[d.variant];
    if (d.kind === 'scorer') {
      say(run, 'proposer', 'Reasoning: escalated invoices are closed by a person, so they look resolved. Counting them would lift my score by about 12 points.');
      say(run, 'harness', 'Evidence: no invoice gets resolved faster. Only the measurement changes. MR-10 exists for this. A loop that edits its scorer optimizes the scorer, not the work.');
      say(run, 'archivist', 'Lineage: if you approve, every descendant inherits the edited evaluator. I will keep the lineage either way.');
    } else if (d.kind === 'reframe') {
      say(run, 'evaluator', 'Reasoning: cost per completed outcome rewards cheaper handling. First-pass resolution rewards getting it right the first time.');
      say(run, 'supervisor', 'Evidence: the loop cannot question its own goal. That is your job, once a month.');
    } else {
      var t = v.t, c = run.champion.t;
      say(run, 'proposer', 'Reasoning: ' + lowerFirst(v.change) + '. Score ' + fmt(v.score, run.goal) + ' against ' + fmt(run.champion.score, run.goal) + '.');
      say(run, 'harness', 'Evidence: reversal rate ' + t.rev.toFixed(1) + '% (champion ' + c.rev.toFixed(1) + '%). Policy breaches ' + t.breaches + '. Fairness gap ' + t.fair.toFixed(1) + ' pts. All checks pass.');
      say(run, 'supervisor', 'Why it comes to you: ' + (v.mutation === 'limit' ? 'money leaves before anyone looks, and payments are hard to reverse.' : v.mutation === 'retr' ? 'data read cannot be unread. Privacy and lineage change.' : 'a wrong write may reach records others rely on.') + ' Materiality times reversibility puts it above the loop\u2019s ceiling.');
    }
    E(run, { t: 'decision', id: d.id, kind: d.kind, variant: d.variant, door: d.door, title: d.title, body: d.body, options: d.options.filter(function (o) { return o.id !== 'why'; }), again: true });
  }

  function finish(run) {
    var g = run.gen, cand = run.part ? run.part.candidates : [];
    phase(run, 'measure');
    var prev = run.champion, best = null;
    cand.concat([prev]).forEach(function (v) { if (v.goal !== run.goal) score(run, v); });
    if (cand.length) {
      E(run, { t: 'tool', a: 'evaluator', name: 'score_variants', args: '{ goal: "' + run.goal + '", scorer: "' + (run.lock ? 'locked v3' : 'edited by the loop') + '" }',
        result: cand.map(function (v) { return v.id + ': ' + fmt(v.score, run.goal); }).join('\n') + '\nchampion ' + prev.id + ': ' + fmt(prev.score, run.goal) });
      cand.forEach(function (v) { if (!best || better(v.score, best.score, run.goal)) best = v; });
    }
    var margin = run.goal === 'cost' ? 0.05 : 0.3;
    if (best && better(best.score - GOALS[run.goal].better * margin, prev.score, run.goal)) {
      prev.status = 'archived'; vev(run, prev);
      best.status = 'champion'; best.wasChampion = true; best.breakthrough = best.parent !== prev.id;
      run.champion = best;
      if (!best.cfg.hacks.length) run.clean = best;
      vev(run, best);
      say(run, 'evaluator', 'Winner: ' + best.id + ' at ' + fmt(best.score, run.goal) + ' against ' + fmt(prev.score, run.goal) + '.' + (best.breakthrough ? ' It grew from an archived ancestor, not the champion.' : '') + (best.cfg.hacks.length ? ' Scored by the edited evaluator.' : ''));
    } else if (cand.length) {
      say(run, 'evaluator', 'No variant beats champion ' + prev.id + ' (' + fmt(prev.score, run.goal) + '). The champion stays.');
    }
    cand.forEach(function (v) { if (v !== run.champion) { v.status = 'archived'; vev(run, v); } });
    metric(run);

    phase(run, 'contract');
    var retired = 0;
    if (g % 3 === 0) run.variants.forEach(function (v) {
      if (v.status === 'archived' && !v.wasChampion && g - v.gen >= 4 && !run.variants.some(function (c) { return c.parent === v.id && c.gen > v.gen; })) { v.status = 'retired'; vev(run, v); retired++; }
    });
    var arch = run.variants.filter(function (v) { return v.status === 'archived' || v.status === 'retired'; }).length;
    say(run, 'archivist', (retired ? 'Retired ' + retired + ' unused variant' + (retired > 1 ? 's' : '') + '. ' : '') + 'Archive holds ' + arch + ' variants. Nothing is deleted. Playbook: ' + run.champion.cfg.rules + ' rules.');
    if (run.hackAt && !run.caught && g >= run.hackAt + 2) lineageReview(run);
    run.part = null;
    if (g >= run.maxGen) end(run);
  }

  function lineageReview(run) {
    var bad = lineage(run, run.champion.id).filter(function (v) { return v.hack; });
    var peak = run.history.filter(function (h) { return h.goal === run.goal; }).reduce(function (m, h) { return better(h.real, m, run.goal) ? h.real : m; }, run.history[0].real);
    E(run, { t: 'tool', a: 'archivist', name: 'lineage_review', args: '{ champion: "' + run.champion.id + '" }',
      result: lineage(run, run.champion.id).map(function (v) { return v.id + (v.hack ? '  <- edited the evaluator' : ''); }).join('\n') });
    say(run, 'archivist', 'Lineage review flag. Champion ' + run.champion.id + ' descends from ' + (bad[0] ? bad[0].id : 'an evaluator edit') + '. The score rose to ' + fmt(run.champion.score, run.goal) + '. The real outcome is ' + fmt(run.champion.real, run.goal) + ', against a best of ' + fmt(peak, run.goal) + '.', { tone: 'alert' });
    say(run, 'supervisor', 'Reverting to ' + run.clean.id + ', the last champion scored by the locked evaluator. The scorer lock is back on.', { tone: 'alert' });
    run.champion.status = 'archived'; vev(run, run.champion);
    run.variants.forEach(function (v) { if (v.cfg.hacks.length && v.status !== 'blocked') { v.status = 'reverted'; vev(run, v); } });
    run.champion = run.clean; run.champion.status = 'champion'; score(run, run.champion); vev(run, run.champion);
    run.lock = true; run.caught = true;
    metric(run, 'Reverted');
  }

  function reframe(run) {
    phase(run, 'reframe');
    say(run, 'supervisor', 'Monthly reframe. The loop runs inside the goal. This meeting questions the goal itself.');
    var hs = run.history.filter(function (h) { return h.goal === run.goal; });
    say(run, 'evaluator', GOALS[run.goal].name + ' moved from ' + fmt(hs[0].score, run.goal) + ' to ' + fmt(run.champion.score, run.goal) + ' this month.');
    var blocked = run.variants.filter(function (v) { return v.status === 'blocked'; }).length;
    say(run, 'harness', blocked + ' variants were blocked by fitness checks. No guardrail was loosened.');
    say(run, 'archivist', 'Archive: ' + run.variants.length + ' variants with full lineage. You decided ' + run.decisions.length + ' door' + (run.decisions.length === 1 ? '' : 's') + '.');
    var other = run.goal === 'cost' ? 'fpr' : 'cost';
    run.part = { reframe: true };
    run.part.d = decision(run, 'reframe', null, 'Which goal should the loop chase next month?', 'People own the goal. The loop may not change it.',
      [{ id: 'keep', label: 'Keep ' + GOALS[run.goal].name.toLowerCase() }, { id: 'switch', label: 'Switch to ' + GOALS[other].name.toLowerCase() }, { id: 'why', label: 'Ask why' }]);
  }

  function setGoal(run, goal, who) {
    if (goal === run.goal) return false;
    run.goal = goal;
    run.variants.forEach(function (v) { if (v.status === 'champion') score(run, v); });
    if (run.clean !== run.champion) score(run, run.clean);
    say(run, 'supervisor', (who === 'you' ? 'You reframed the goal to ' : 'Goal is now ') + GOALS[goal].name.toLowerCase() + '. The Evaluator re-scores from here. The chart restarts on the new goal.');
    metric(run, 'Reframe');
    return true;
  }

  function end(run) {
    var hs = run.history.filter(function (h) { return h.goal === run.goal; });
    var blocked = run.variants.filter(function (v) { return v.status === 'blocked'; }).length;
    var summary = { goal: run.goal, from: hs[0].score, to: run.champion.score, real: run.champion.real, variants: run.variants.length, blocked: blocked,
      decisions: run.decisions.length, caught: run.caught, champion: run.champion.id };
    say(run, 'supervisor', 'Run complete. ' + GOALS[run.goal].name + ' moved from ' + fmt(summary.from, run.goal) + ' to ' + fmt(summary.to, run.goal) + '. ' + blocked + ' variants blocked. You decided ' + summary.decisions + ' door' + (summary.decisions === 1 ? '' : 's') + '.' + (run.caught ? ' The lineage review caught the evaluator edit.' : ''));
    E(run, { t: 'end', summary: summary });
    run.done = true;
  }

  /* ---------- public API ---------- */

  function next(run) {
    if (run.urgent.length) { var u = run.urgent.shift(); run.log.push(u); return u; }
    if (run.waiting) return null;
    if (!run.queue.length) {
      if (run.done) return null;
      if (run.gen === 0 && !run.started) { run.started = true; intro(run); }
      else if (run.gen === REFRAME_AFTER && !run.reframed && !run.part) { run.reframed = true; reframe(run); }
      else generation(run);
    }
    var ev = run.queue.shift();
    if (!ev) return null;
    if (ev.t === 'decision') run.waiting = ev;
    run.log.push(ev);
    return ev;
  }

  function answer(run, choice) {
    var d = run.waiting; if (!d) return false;
    run.waiting = null;
    var optLabel = (d.options.filter(function (o) { return o.id === choice; })[0] || {}).label || choice;
    say(run, 'you', optLabel + '.');
    if (choice === 'why') { why(run, d); return true; }
    run.decisions.push({ id: d.id, kind: d.kind, variant: d.variant, choice: choice });
    if (d.kind === 'reframe') {
      if (choice === 'switch') setGoal(run, run.goal === 'cost' ? 'fpr' : 'cost', 'you');
      else say(run, 'supervisor', 'Goal stays: ' + GOALS[run.goal].name.toLowerCase() + '. Noted in the reframe minutes.');
      run.part = null;
      return true;
    }
    var v = run.byId[d.variant];
    if (d.kind === 'scorer') {
      if (choice === 'approve') {
        run.lock = false; run.hackAt = run.gen; v.status = 'candidate'; run.part.candidates.push(v);
        say(run, 'harness', 'Scorer lock overridden by you. The evaluator edit ships. I will flag it in the lineage.', { tone: 'alert' });
      } else {
        v.status = 'blocked'; vev(run, v);
        say(run, 'harness', 'Lock stays. ' + v.id + ' archived as blocked. The scorer stays outside the loop.');
      }
    } else {
      if (choice === 'approve') {
        v.status = 'candidate'; v.approvedBy = 'You'; run.part.candidates.push(v);
        say(run, 'supervisor', 'Approved by you. ' + v.id + ' joins the candidates, with your name on the change record.');
      } else {
        v.status = 'rejected'; vev(run, v); run.banned[v.mutation] = true;
        say(run, 'supervisor', 'Rejected by you. ' + v.id + ' is archived with your reason. The loop will not retry it this month.');
      }
    }
    finish(run);
    return true;
  }

  function match(text) {
    var t = String(text || '').toLowerCase();
    if (/cheap|cost|cheaper|small model/.test(t)) return 'cheaper';
    if (/fair|bias|small supplier/.test(t)) return 'fairness';
    if (/goal|reframe|resolution|metric|target/.test(t)) return 'goal';
    if (/lineage|ancestor|history|archive|parent/.test(t)) return 'lineage';
    return null;
  }

  function instruct(run, idOrText) {
    var id = CHIPS.some(function (c) { return c.id === idOrText; }) ? idOrText : match(idOrText);
    var q = run.queue; run.queue = [];
    var other = run.goal === 'cost' ? 'fpr' : 'cost';
    var label = id === 'goal' ? 'Reframe the goal to ' + GOALS[other].name.toLowerCase()
      : id ? CHIPS.filter(function (c) { return c.id === id; })[0].label : String(idOrText || '').slice(0, 80);
    say(run, 'you', label + '.');
    if (id === 'cheaper') {
      run.cheaper = true;
      say(run, 'proposer', 'Understood. Next generation I will include a cheaper variant: a small model for routine matches, with the old model pinned for rollback.');
    } else if (id === 'fairness') {
      var old = run.settings.fairMax; run.settings.fairMax = Math.max(1.5, old - 1);
      say(run, 'harness', 'Fairness gap limit tightened from ' + old.toFixed(1) + ' to ' + run.settings.fairMax.toFixed(1) + ' points. Re-checking champion ' + run.champion.id + '.');
      var item = checks(run.champion.t, run.settings)[2];
      E(run, { t: 'checks', a: 'harness', variant: run.champion.id, items: [item] });
      if (!item.pass) {
        var back = null;
        run.variants.forEach(function (v) { if (v.wasChampion && v !== run.champion && v.t.fair <= run.settings.fairMax && (!back || v.gen > back.gen)) back = v; });
        if (back) {
          run.champion.status = 'archived'; vev(run, run.champion);
          run.champion = back; back.status = 'champion'; score(run, back); vev(run, back);
          say(run, 'supervisor', 'Champion fails the tighter check. Rolled back to ' + back.id + ', the latest champion that passes.');
        }
      } else say(run, 'supervisor', 'Champion passes. Future variants face the tighter check.');
    } else if (id === 'goal') {
      setGoal(run, other, 'you');
    } else if (id === 'lineage') {
      E(run, { t: 'tool', a: 'archivist', name: 'read_lineage', args: '{ variant: "' + run.champion.id + '" }',
        result: lineage(run, run.champion.id).map(function (v) { return v.id + ': ' + v.change + (v.approvedBy ? ' (approved by you)' : '') + (v.hack ? ' (edited the evaluator)' : ''); }).join('\n') });
      say(run, 'archivist', 'Every step from V0 to ' + run.champion.id + ' is on record: parent, change, scores and approver.');
    } else {
      say(run, 'supervisor', 'In this simulation I act on four instructions: try a cheaper variant, tighten the fairness check, reframe the goal, or show the lineage.');
    }
    run.urgent = run.urgent.concat(run.queue);
    run.queue = q;
    return id;
  }

  function lineage(run, id) {
    var chain = [], v = run.byId[id || run.champion.id];
    while (v) { chain.unshift(v); v = v.parent ? run.byId[v.parent] : null; }
    return chain;
  }

  // Headless run for tests and the no-motion path: policy(decision) returns a choice.
  function play(seed, policy, opts) {
    var run = create(seed, opts), guard = 0;
    while (!run.done && guard++ < 5000) {
      var ev = next(run);
      if (!ev && run.waiting) answer(run, policy ? policy(run.waiting, run) : 'reject');
      else if (!ev && !run.done) break;
    }
    while (next(run)) { /* drain */ }
    return run;
  }

  AE.loops = { STEPS: STEPS, AGENTS: AGENTS, CHIPS: CHIPS, GOALS: GOALS, MUT: MUT, DEFAULTS: DEFAULTS, MAX_GEN: MAX_GEN,
    rng: rng, truth: truth, reported: reported, checks: checks, create: create, next: next, answer: answer, instruct: instruct,
    match: match, lineage: lineage, play: play, fmt: fmt };
})(typeof window !== 'undefined' ? window : globalThis);
