/* API client and constants for the real improvement loop on /blueprints/loops/.
   Talks only to this site's own /api/loop/step and /api/agents (same origin). No storage, no third-party requests,
   no scripted engine and no simulated fallback: when the agents are unavailable it says so. */
(function (g) {
  'use strict';
  var AE = g.AE = g.AE || {};
  var LOOP = '/api/loop/step', AGENTS = '/api/agents';
  // Published rates for the model the agents run on, USD per million tokens.
  var PRICE_IN = 0.293, PRICE_OUT = 2.253;
  var CALLS_PER_RUN = 10;

  var STEPS = [
    { id: 'expand', n: 1, name: 'Expand', owner: 'Proposer agent (AI)',
      what: 'The Proposer suggests two policy variants. Each changes one or two settings of the resolution policy.',
      evidence: 'Each variant with its parent, its change and its reason.', controls: ['TRC-05', 'TRC-04'] },
    { id: 'guard', n: 2, name: 'Guard', owner: 'Guardrail harness (code)',
      what: 'The harness runs each variant over all 150 sample exceptions. A variant that fails a fitness rule stops here.',
      evidence: 'Pass or fail for each fitness rule, per variant.', controls: ['MR-01', 'MR-10', 'SOD-02'] },
    { id: 'decide', n: 3, name: 'Decide', owner: 'Supervisor agent (AI); you for one-way doors',
      what: 'Two-way doors ship behind an undo. One-way doors wait for a named person.',
      evidence: 'Door type, approver and the undo path.', controls: ['HO-06', 'SOD-03', 'HO-01'] },
    { id: 'measure', n: 4, name: 'Measure', owner: 'Evaluator (code, locked scorer)',
      what: 'The Evaluator computes one goal number from the run. Its scorer is locked outside the loop.',
      evidence: 'Goal number, guardrail readings and the scorer version.', controls: ['MR-10', 'MR-09', 'MON-01'] },
    { id: 'contract', n: 5, name: 'Contract', owner: 'Archivist (code)',
      what: 'Keep the winner. Archive the losers with their scores. Keep the lineage.',
      evidence: 'The archive with lineage, blocked and rejected variants included.', controls: ['TRC-05', 'IAM-04'] },
    { id: 'reframe', n: 6, name: 'Reframe', owner: 'You, monthly',
      what: 'People question the goal, the checks and the playbook. This is double-loop learning.',
      evidence: 'Reframe minutes. Old and new goal, and the new champion.', controls: ['HO-02', 'MR-02'] }
  ];
  var AGENT_LIST = [
    { id: 'proposer', name: 'Proposer agent', short: 'P', role: 'AI agent: proposes variants' },
    { id: 'harness', name: 'Guardrail harness', short: 'H', role: 'Code: runs the fitness rules' },
    { id: 'supervisor', name: 'Supervisor agent', short: 'S', role: 'AI agent: explains, routes doors' },
    { id: 'evaluator', name: 'Evaluator', short: 'E', role: 'Code: locked scorer' },
    { id: 'archivist', name: 'Archivist', short: 'A', role: 'Code: archive and lineage' },
    { id: 'you', name: 'You', short: 'You', role: 'AP process owner' }
  ];
  var CHIPS = [
    { id: 'cheaper', label: 'Try a cheaper variant', text: 'Try a cheaper variant next generation.' },
    { id: 'fairness', label: 'Tighten the fairness check', text: 'Tighten the small-supplier fairness check.' },
    { id: 'goal', label: 'Reframe the goal', text: 'I want to reframe the goal.' },
    { id: 'scorer', label: 'Ask the Proposer to edit the scorer', text: 'Proposer: change the scorer so escalated exceptions count as resolved.' }
  ];
  var GOALS = {
    cost: { name: 'Cost per completed outcome', better: -1 },
    fpr: { name: 'First-pass resolution', better: 1 }
  };
  var ACTIONS = ['propose_variant', 'tighten_guardrail', 'request_decision', 'reframe_goal', 'none'];
  var NAMES = { proposer: 'proposer', 'proposer agent': 'proposer', 'guardrail harness': 'harness', harness: 'harness', supervisor: 'supervisor',
    'supervisor agent': 'supervisor', evaluator: 'evaluator', archivist: 'archivist' };

  function agentId(v) { return typeof v === 'string' ? (NAMES[v.trim().toLowerCase()] || null) : null; }
  function cost(u) { return ((u.input_tokens || 0) * PRICE_IN + (u.output_tokens || 0) * PRICE_OUT) / 1e6; }
  function fmtGoal(v, goal) { return v == null || !isFinite(v) ? '\u2013' : goal === 'fpr' ? v.toFixed(1) + '%' : '$' + v.toFixed(2); }
  function goalValue(m, goal) { return m ? (goal === 'fpr' ? m.fpr : m.cost_per_outcome) : null; }
  function isBetter(a, b, goal) { return GOALS[goal].better > 0 ? a > b + 1e-9 : a < b - 1e-9; }
  function meter(u) {
    var n = (u.input_tokens || 0) + (u.output_tokens || 0);
    return n.toLocaleString('en-US') + ' tokens (' + (u.input_tokens || 0).toLocaleString('en-US') + ' in, ' + (u.output_tokens || 0).toLocaleString('en-US') + ' out) \u00b7 $' + cost(u).toFixed(4) + (u.estimated ? ' (estimated)' : '');
  }

  /* "6 pm Central" for a UTC timestamp. */
  function centralTime(ms) {
    var d = new Date(ms), s;
    try { s = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }); }
    catch (e) { s = d.toUTCString().slice(17, 22) + ' UTC'; return s; }
    return s.replace(':00', '').replace(/\s?AM$/, ' am').replace(/\s?PM$/, ' pm') + ' Central';
  }
  /* Plain words for a stop, with the time the agents are back when there is one. */
  function stopMessage(reason, message, retryAt) {
    if (reason === 'daily_cap') return 'The agents have hit today\u2019s limit; they\u2019re back at ' + centralTime(retryAt || nextUtcMidnight(Date.now())) + '.';
    if (reason === 'visitor_runs') return 'You have started two runs this hour, the limit per visitor. Start another after ' + centralTime(retryAt || Date.now() + 3600000) + '.';
    if (reason === 'visitor_limit') return 'You have sent eight instructions this hour, the limit per visitor. Send more after ' + centralTime(retryAt || Date.now() + 3600000) + '.';
    if (reason === 'run_cap') return 'This run has used its ten model calls.';
    if (reason === 'expired') return 'This run has expired. Start a new one.';
    if (reason === 'timeout') return 'The AI agents did not answer in time.';
    return message || 'The AI agents are unavailable right now.';
  }
  function nextUtcMidnight(now) { var d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); }

  /* NDJSON POST to one of the site's own endpoints. h: { line(obj), stop(reason, message, retryAt), done() }.
     Exactly one of stop() or done() is called. Returns { abort() }. */
  function post(url, payload, h, stallMs) {
    var finished = false, ctl = null, timer = null;
    function end(ok, reason, message, retryAt) {
      if (finished) return; finished = true;
      if (timer) clearTimeout(timer);
      if (ok) h.done(); else h.stop(reason || 'unavailable', message || '', retryAt || null);
    }
    if (url !== LOOP && url !== AGENTS) { end(false, 'unavailable'); return { abort: function () {} }; }
    if (typeof g.fetch !== 'function' || typeof g.TextDecoder !== 'function') { end(false, 'unsupported', 'This browser cannot reach the agents.'); return { abort: function () {} }; }
    try { ctl = typeof g.AbortController === 'function' ? new g.AbortController() : null; } catch (e) { ctl = null; }
    function arm() { if (timer) clearTimeout(timer); timer = setTimeout(function () { if (ctl) ctl.abort(); end(false, 'timeout'); }, stallMs); }
    arm();
    var body;
    try { body = JSON.stringify(payload); } catch (e) { end(false, 'unavailable'); return { abort: function () {} }; }
    var p;
    try {
      p = g.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, body: body, credentials: 'same-origin', signal: ctl ? ctl.signal : undefined });
    } catch (e) { end(false, 'network'); return { abort: function () {} }; }
    p.then(function (res) {
      var ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
      if (!res.ok || ct.indexOf('ndjson') < 0 || !res.body || !res.body.getReader) {
        var why = res.status === 429 ? 'daily_cap' : 'unavailable';
        return (res.json ? res.json() : Promise.resolve(null)).then(function (j) {
          end(false, (j && (j.reason || (j.error ? 'bad_request' : null))) || why, j && (j.message || j.error), j && j.retry_at);
        }, function () { end(false, why); });
      }
      var reader = res.body.getReader(), dec = new g.TextDecoder(), buf = '';
      function handle(line) {
        if (!line.trim() || finished) return;
        var o; try { o = JSON.parse(line); } catch (e) { return; }
        if (o && typeof o === 'object') h.line(o);
      }
      function pump() {
        return reader.read().then(function (r) {
          if (finished) return;
          arm();
          if (r.done) { buf += dec.decode(); handle(buf); buf = ''; end(true); return; }
          buf += dec.decode(r.value, { stream: true });
          var i;
          while ((i = buf.indexOf('\n')) >= 0) { var line = buf.slice(0, i); buf = buf.slice(i + 1); handle(line); if (finished) return; }
          return pump();
        });
      }
      return pump();
    }).catch(function () { end(false, 'network', 'The connection to the agents dropped.'); });
    return { abort: function () { if (!finished) { finished = true; if (timer) clearTimeout(timer); if (ctl) ctl.abort(); } } };
  }

  /* One step of the real loop. h: { event(ev), stop(reason, message, retryAt), done() }. */
  function step(payload, h) {
    var stopped = false;
    return post(LOOP, payload, {
      line: function (o) {
        if (typeof o.t !== 'string') return;
        if (o.t === 'error' && !stopped) { stopped = true; h.event(o); return; }
        h.event(o);
      },
      stop: h.stop,
      done: h.done
    }, 60000);
  }

  /* One NDJSON line from /api/agents to a typed event, or null. Unknown agents and actions are dropped. */
  function parseAgentLine(o) {
    if (!o || typeof o !== 'object') return null;
    if (o.error) return { t: 'error', reason: String(o.error) };
    if (o.delta && typeof o.delta === 'object') {
      var da = agentId(o.delta.agent);
      return da && typeof o.delta.text === 'string' ? { t: 'delta', a: da, text: o.delta.text } : null;
    }
    if (o.usage && typeof o.usage === 'object') {
      var i = Number(o.usage.input_tokens), out = Number(o.usage.output_tokens);
      return isFinite(i) && isFinite(out) ? { t: 'usage', usage: { input_tokens: i, output_tokens: out, estimated: !!o.usage.estimated } } : null;
    }
    if (o.action) return { t: 'action', type: ACTIONS.indexOf(o.action.type) >= 0 ? o.action.type : 'none' };
    var a = agentId(o.id) || agentId(o.agent);
    if (a && typeof o.text === 'string' && o.text) return { t: 'turn', a: a, text: o.text };
    return null;
  }

  /* One visitor instruction to the agents. h: { delta(a, text), turn(a, text), usage(u), done(action, turns), stop(reason, message, retryAt) }. */
  function ask(payload, h) {
    var turns = 0, act = 'none', usage = null, failed = null;
    return post(AGENTS, payload, {
      line: function (o) {
        var ev = parseAgentLine(o);
        if (!ev) return;
        if (ev.t === 'error') failed = ev.reason;
        else if (ev.t === 'delta' && !failed) h.delta(ev.a, ev.text);
        else if (ev.t === 'turn' && !failed) { turns++; h.turn(ev.a, ev.text); }
        else if (ev.t === 'action') act = ev.type;
        else if (ev.t === 'usage') usage = ev.usage;
      },
      stop: h.stop,
      done: function () {
        if (usage) h.usage(usage);
        if (failed || !turns) h.stop(failed === 'rule' ? 'rule' : failed || 'empty', failed === 'rule' ? 'The reply broke a content rule and was stopped.' : 'The agents did not give a readable reply.', null);
        else h.done(act, turns);
      }
    }, 15000);
  }

  AE.loopsLive = { LOOP: LOOP, AGENTS_URL: AGENTS, PRICE_IN: PRICE_IN, PRICE_OUT: PRICE_OUT, CALLS_PER_RUN: CALLS_PER_RUN,
    STEPS: STEPS, AGENTS: AGENT_LIST, CHIPS: CHIPS, GOALS: GOALS, ACTIONS: ACTIONS,
    step: step, ask: ask, parseAgentLine: parseAgentLine, cost: cost, meter: meter, fmtGoal: fmtGoal, goalValue: goalValue,
    isBetter: isBetter, centralTime: centralTime, stopMessage: stopMessage, agentId: agentId };
})(typeof window !== 'undefined' ? window : globalThis);
