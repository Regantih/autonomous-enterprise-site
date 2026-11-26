/* Live AI agents client for /blueprints/loops/. Talks only to this site's own /api/agents (same origin).
   No storage, no third-party requests. Any failure hands control back to the scripted engine. */
(function (g) {
  'use strict';
  var AE = g.AE = g.AE || {};
  var ENDPOINT = '/api/agents';
  // Published Workers AI rates for the live model, USD per million tokens.
  var PRICE_IN = 0.293, PRICE_OUT = 2.253;
  var CLIENT_TIMEOUT_MS = 12000;
  var NOTE = 'Live agents are resting; showing the simulated run.';
  var ACTIONS = ['propose_variant', 'tighten_guardrail', 'request_decision', 'reframe_goal', 'none'];
  var AGENTS = ['proposer', 'harness', 'supervisor', 'evaluator', 'archivist'];
  var NAMES = { proposer: 'proposer', 'proposer agent': 'proposer', 'guardrail harness': 'harness', harness: 'harness', supervisor: 'supervisor',
    'supervisor agent': 'supervisor', evaluator: 'evaluator', archivist: 'archivist' };

  function agentId(v) { return typeof v === 'string' ? (NAMES[v.trim().toLowerCase()] || null) : null; }
  function action(v) { var t = v && typeof v === 'object' ? v.type : null; return ACTIONS.indexOf(t) >= 0 ? t : 'none'; }
  function cost(u) { return ((u.input_tokens || 0) * PRICE_IN + (u.output_tokens || 0) * PRICE_OUT) / 1e6; }
  function meter(u) {
    var n = (u.input_tokens || 0) + (u.output_tokens || 0);
    return '\u2248 ' + n.toLocaleString('en-US') + ' tokens \u00b7 \u2248 $' + cost(u).toFixed(4) + (u.estimated ? ' (estimated)' : '');
  }

  /* One NDJSON line from /api/agents to a typed event, or null. Unknown agents and actions are dropped. */
  function parseLine(line) {
    var o;
    try { o = JSON.parse(line); } catch (e) { return null; }
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
    if (o.action) return { t: 'action', type: action(o.action) };
    var a = agentId(o.id) || agentId(o.agent);
    if (a && typeof o.text === 'string' && o.text) return { t: 'turn', a: a, text: o.text };
    return null;
  }

  /* Sends one instruction. h: { delta(a, text), turn(a, text), action(type), usage(u), fallback(reason, note), done() }.
     Exactly one of fallback() or done() is called. Returns { abort() }. */
  function ask(payload, h) {
    var finished = false, turns = 0, act = 'none', ctl = null, timer = null, gotUsage = null;
    function end(ok, reason) {
      if (finished) return; finished = true;
      if (timer) clearTimeout(timer);
      if (ok) { if (gotUsage) h.usage(gotUsage); h.action(act); h.done(); }
      else h.fallback(reason || 'error', NOTE, turns);
    }
    if (typeof g.fetch !== 'function' || typeof g.TextDecoder !== 'function') { end(false, 'unsupported'); return { abort: function () {} }; }
    try { ctl = typeof g.AbortController === 'function' ? new g.AbortController() : null; } catch (e) { ctl = null; }
    // Stall timer: re-armed on every chunk, so a slow but steady stream is never cut.
    function arm() { if (timer) clearTimeout(timer); timer = setTimeout(function () { if (ctl) ctl.abort(); end(false, 'timeout'); }, CLIENT_TIMEOUT_MS); }
    arm();
    var body;
    try { body = JSON.stringify(payload); } catch (e) { end(false, 'error'); return { abort: function () {} }; }
    var p;
    try {
      p = g.fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, body: body, credentials: 'same-origin', signal: ctl ? ctl.signal : undefined });
    } catch (e) { end(false, 'network'); return { abort: function () {} }; }
    p.then(function (res) {
      var ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
      if (!res.ok || ct.indexOf('ndjson') < 0 || !res.body || !res.body.getReader) {
        var why = res.status === 429 ? 'limit' : 'unavailable';
        return (res.json ? res.json() : Promise.resolve(null)).then(function (j) { end(false, (j && j.reason) || why); }, function () { end(false, why); });
      }
      var reader = res.body.getReader(), dec = new g.TextDecoder(), buf = '', failed = false;
      function handle(line) {
        if (!line.trim() || failed) return;
        var ev = parseLine(line);
        if (!ev) return;
        if (ev.t === 'error') { failed = true; end(false, ev.reason); try { reader.cancel(); } catch (e) { /* ignore */ } return; }
        if (finished) return;
        if (ev.t === 'delta') h.delta(ev.a, ev.text);
        else if (ev.t === 'turn') { turns++; h.turn(ev.a, ev.text); }
        else if (ev.t === 'action') act = ev.type;
        else if (ev.t === 'usage') gotUsage = ev.usage;
      }
      function pump() {
        return reader.read().then(function (r) {
          if (finished) return;
          arm();
          if (r.done) {
            buf += dec.decode();
            handle(buf); buf = '';
            if (!failed) end(turns > 0, turns > 0 ? null : 'empty');
            return;
          }
          buf += dec.decode(r.value, { stream: true });
          var i;
          while ((i = buf.indexOf('\n')) >= 0) { var line = buf.slice(0, i); buf = buf.slice(i + 1); handle(line); if (finished) return; }
          return pump();
        });
      }
      return pump();
    }).catch(function () { end(false, 'network'); });
    return { abort: function () { if (!finished) { finished = true; if (timer) clearTimeout(timer); if (ctl) ctl.abort(); } } };
  }

  AE.loopsLive = { ENDPOINT: ENDPOINT, NOTE: NOTE, ACTIONS: ACTIONS, AGENTS: AGENTS, PRICE_IN: PRICE_IN, PRICE_OUT: PRICE_OUT,
    parseLine: parseLine, ask: ask, cost: cost, meter: meter, agentId: agentId };
})(typeof window !== 'undefined' ? window : globalThis);
