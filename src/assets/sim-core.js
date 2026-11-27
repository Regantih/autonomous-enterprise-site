/* Simulate your process: the editor model behind the workflows simulator. Pure functions, no network, no storage.
   A visitor flow is { template, steps: [{ name, lane, via, person, approval, exception }] }. The same schema comes
   back from /api/simulate (validated on the server). Steps become the player's step shape (lane, lvl, ho, ex), so
   every count comes from AE.flowStats, the rule the book workflows use. Load after data/workflows.js. */
(function (w) {
  'use strict';
  var AE = w.AE = w.AE || {};
  var LANES = [['outside', 'Outside party'], ['channel', 'Channel'], ['people', 'People'], ['systems', 'Systems of record']];
  // How the work reaches a step. Hand, email and scheduled file are queue waits by the player's rule.
  var VIA = [['none', 'No hand-off'], ['hand', 'By hand'], ['email', 'Email'], ['file', 'Scheduled file'], ['system', 'System to system']];
  var VIA_HO = { none: null, hand: 'manual', email: 'manual', file: 'file', system: 'api' };
  var MAX_STEPS = 20, MIN_STEPS = 2, NAME_MAX = 90;
  var laneIds = LANES.map(function (l) { return l[0]; }), viaIds = VIA.map(function (v) { return v[0]; });

  function templates() { return (AE.workflows || []).map(function (wf) { return { id: wf.id, short: wf.short, name: wf.name }; }); }
  function byId(id) { return (AE.workflows || []).filter(function (wf) { return wf.id === id; })[0] || null; }
  function cleanName(t) {
    return String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  }
  function step(raw, i) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var lane = laneIds.indexOf(raw.lane) >= 0 ? raw.lane : 'people';
    var via = i === 0 ? 'none' : viaIds.indexOf(raw.via) >= 0 ? raw.via : 'hand';
    var outside = lane === 'outside';
    var approval = !outside && raw.approval === true;
    return { name: cleanName(raw.name), lane: lane, via: via, person: !outside && (raw.person === true || approval), approval: approval, exception: i > 0 && raw.exception === true };
  }
  /* Any input becomes a valid flow or a list of problems. Never throws. */
  function normalize(raw) {
    var errors = [];
    raw = raw && typeof raw === 'object' ? raw : {};
    var template = byId(raw.template) ? raw.template : (AE.workflows && AE.workflows[0] ? AE.workflows[0].id : '');
    if (!byId(raw.template)) errors.push('template');
    var list = Array.isArray(raw.steps) ? raw.steps : [];
    var steps = list.slice(0, MAX_STEPS).map(step).filter(function (s) { return s.name.length > 0; });
    steps = steps.map(function (s, i) { return step(s, i); });
    if (list.length > MAX_STEPS) errors.push('too_many');
    if (steps.length < MIN_STEPS) errors.push('too_few');
    return { ok: steps.length >= MIN_STEPS, flow: { template: template, steps: steps }, errors: errors };
  }
  /* The book's Today flow for a template, in the editor's terms (counts stay identical: see the tests). */
  function fromTemplate(id) {
    var wf = byId(id) || (AE.workflows || [])[0];
    var steps = wf.today.map(function (t, i) {
      var via = !t.ho ? 'none' : t.ho === 'file' ? 'file' : t.ho === 'manual' ? (/email/i.test(t.name) ? 'email' : 'hand') : 'system';
      return { name: t.name, lane: laneIds.indexOf(t.lane) >= 0 ? t.lane : 'systems', via: i === 0 ? 'none' : via,
        person: t.lvl != null, approval: t.lvl != null && /approv/i.test(t.name), exception: !!t.ex };
    });
    return { template: wf.id, steps: steps };
  }
  function copy(flow) { return { template: flow.template, steps: flow.steps.map(function (s) { return Object.assign({}, s); }) }; }
  function fix(flow) { flow.steps = flow.steps.map(function (s, i) { return step(Object.assign({}, s, { name: s.name }), i); }); return flow; }
  function add(flow, at) {
    var f = copy(flow);
    if (f.steps.length >= MAX_STEPS) return f;
    var i = at == null ? f.steps.length : Math.max(0, Math.min(at, f.steps.length));
    f.steps.splice(i, 0, { name: 'New step', lane: 'people', via: 'hand', person: true, approval: false, exception: false });
    return fix(f);
  }
  function remove(flow, i) {
    var f = copy(flow);
    if (f.steps.length <= MIN_STEPS || i < 0 || i >= f.steps.length) return f;
    f.steps.splice(i, 1);
    return fix(f);
  }
  function move(flow, i, dir) {
    var f = copy(flow), j = i + dir;
    if (i < 0 || i >= f.steps.length || j < 0 || j >= f.steps.length) return f;
    var t = f.steps[i]; f.steps[i] = f.steps[j]; f.steps[j] = t;
    return fix(f);
  }
  function update(flow, i, patch) {
    var f = copy(flow);
    if (i < 0 || i >= f.steps.length) return f;
    var s = Object.assign({}, f.steps[i], patch);
    if (patch && patch.approval === true) s.person = true;
    if (patch && patch.person === false) s.approval = false;
    f.steps[i] = s;
    return fix(f);
  }
  function lvlOf(s) { return s.lane === 'outside' ? null : s.approval ? 1 : s.person ? 0 : null; }
  /* The player's step shape. Person or approval steps are L0 or L1 (a person touch); automated steps are rules. */
  function toSteps(flow) {
    return flow.steps.map(function (s, i) {
      return { id: 'u' + (i + 1), lane: s.lane, name: s.name, lvl: lvlOf(s), model: 'none', ho: i === 0 ? null : VIA_HO[s.via],
        via: s.via, controls: [], ev: '', ex: !!s.exception, card: '', log: s.name, layers: [], approval: !!s.approval, person: !!s.person };
    });
  }
  function compareLine(flow) {
    var wf = byId(flow.template);
    return AE.compareFlows(toSteps(flow), wf.steps, 'Your process', 'Agent-run');
  }
  AE.sim = { LANES: LANES, VIA: VIA, VIA_HO: VIA_HO, MAX_STEPS: MAX_STEPS, MIN_STEPS: MIN_STEPS, NAME_MAX: NAME_MAX, MAX_TEXT: 1200,
    templates: templates, byId: byId, normalize: normalize, fromTemplate: fromTemplate, add: add, remove: remove, move: move, update: update,
    toSteps: toSteps, stats: function (flow) { return AE.flowStats(toSteps(flow)); }, compareLine: compareLine };
})(typeof window !== 'undefined' ? window : globalThis);
