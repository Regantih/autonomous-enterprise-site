/* Live operations room for /blueprints/loops/. Every number on screen comes from the real loop on the server:
   the Proposer and Supervisor are AI agents; the Guardrail harness, Evaluator and Archivist are code that runs each
   policy over the committed sample of 150 synthetic accounts-payable exceptions. No scripted engine, no simulated
   fallback. The only offline mode replays a recording of a real production run, labelled as such. No storage. */
(function () {
  'use strict';
  var AE = window.AE, Live = AE && AE.loopsLive;
  var root = document.querySelector('[data-lp="room"]');
  if (!Live || !root) return;
  var REC = AE.loopsRecorded && AE.loopsRecorded.transcript && AE.loopsRecorded.transcript.length ? AE.loopsRecorded : null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || root).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cid(id) { return '<a class="cid" href="/controls/#' + esc(id) + '">' + esc(id) + '</a>'; }
  function linkCids(t) { return esc(t).replace(/\b(MR-10|TRC-05|HO-06)\b/g, function (m) { return cid(m); }); }
  var AG = {}; Live.AGENTS.forEach(function (a) { AG[a.id] = a; });
  var STEP = {}; Live.STEPS.forEach(function (s, i) { STEP[s.id] = i; });
  var GOALS = Live.GOALS, fmt = Live.fmtGoal, gv = Live.goalValue;
  var LABEL = 'Real AI agents. Real computation on sample AP data.';

  /* ---------- skeleton ---------- */
  root.innerHTML =
    '<div class="or">' +
    '<div class="or-top">' +
      '<div class="or-title"><p class="or-k">Live operations room</p><p class="or-label">' + LABEL + '</p></div>' +
      '<div class="or-ctl">' +
        '<button type="button" class="pill or-start" data-a="start">Start a run</button>' +
        '<button type="button" class="pill pill-ghost or-pause" data-a="pause" aria-pressed="false" disabled>Pause</button>' +
        (REC ? '<button type="button" class="pill pill-ghost or-rec" data-a="recorded">Watch a recorded run</button>' : '') +
        '<span class="or-status" aria-live="polite">Ready</span>' +
      '</div>' +
      '<p class="or-runmeter" aria-live="off"></p>' +
    '</div>' +
    '<ul class="or-roster" aria-label="Agents in the room">' + Live.AGENTS.map(function (a) {
      return '<li class="or-ag or-ag-' + a.id + '" data-ag="' + a.id + '"><span class="or-av" aria-hidden="true">' + esc(a.short) + '</span><span class="or-ag-t"><b>' + esc(a.name) + '</b><small>' + esc(a.role) + '</small></span></li>';
    }).join('') + '</ul>' +
    '<div class="or-main">' +
      '<div class="or-center">' +
        '<div class="or-stream" role="log" aria-live="off" aria-label="Agent conversation" tabindex="0"></div>' +
        '<p class="visually-hidden or-announce" aria-live="polite"></p>' +
        '<div class="or-input">' +
          '<p class="or-input-k">Instruct the agents <small>Answered by the AI agents. Their choice feeds the next generation.</small></p>' +
          '<div class="or-chips">' + Live.CHIPS.map(function (c) { return '<button type="button" class="pill or-chip" data-chip="' + c.id + '">' + esc(c.label) + '</button>'; }).join('') + '</div>' +
          '<form class="or-form"><label class="visually-hidden" for="or-text">Instruction to the agents</label><input id="or-text" class="or-text" type="text" maxlength="300" autocomplete="off" placeholder="Or type a short instruction"><button type="submit" class="pill pill-dark">Send</button></form>' +
        '</div>' +
      '</div>' +
      '<div class="or-side">' +
        '<div class="or-ringbox"></div>' +
        '<div class="or-step" aria-live="polite"></div>' +
        '<div class="or-metrics"></div>' +
        '<div class="or-rails"></div>' +
        '<div class="or-chart"></div>' +
      '</div>' +
    '</div>' +
    '<div class="or-treebox"><p class="or-k or-k-dark">The archive: every variant and its parent</p><div class="or-tree" tabindex="0" role="region" aria-label="Archive tree of variants"></div>' +
      '<div class="or-legend"><span class="lg lg-champ">Champion</span><span class="lg lg-was">Former champion</span><span class="lg lg-arch">Archived</span><span class="lg lg-block">Blocked</span><span class="lg lg-pend">Waits for you</span><span class="lg lg-ret">Rejected</span></div>' +
      '<p class="or-node-info" aria-live="polite"></p></div>' +
    '</div>';

  var stream = $('.or-stream'), statusEl = $('.or-status'), startBtn = $('.or-start'), pauseBtn = $('.or-pause'), announce = $('.or-announce');

  /* ---------- loop ring ---------- */
  (function ring() {
    var cx = 160, cy = 160, R = 112, pos = [], svg = '<svg class="or-ring" viewBox="0 0 320 320" role="group" aria-label="The six-step loop. The active step lights up.">' +
      '<defs><marker id="or-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="or-arrh"/></marker></defs>';
    Live.STEPS.forEach(function (s, i) {
      var a = (-90 + i * 60) * Math.PI / 180; pos.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
      var a0 = (-90 + i * 60 + 19) * Math.PI / 180, a1 = (-90 + (i + 1) * 60 - 19) * Math.PI / 180;
      svg += '<path class="or-edge' + (i === 5 ? ' or-edge-back' : '') + '" d="M' + (cx + R * Math.cos(a0)).toFixed(1) + ',' + (cy + R * Math.sin(a0)).toFixed(1) + ' A' + R + ',' + R + ' 0 0 1 ' + (cx + R * Math.cos(a1)).toFixed(1) + ',' + (cy + R * Math.sin(a1)).toFixed(1) + '" marker-end="url(#or-arr)"/>';
    });
    svg += '<text class="or-ring-k" x="160" y="152" text-anchor="middle">ONE GOAL</text><text class="or-ring-t" x="160" y="176" text-anchor="middle">You own it</text>';
    Live.STEPS.forEach(function (s, i) {
      var p = pos[i];
      svg += '<g class="or-rn' + (s.id === 'decide' || s.id === 'reframe' ? ' or-rn-h' : '') + '" data-i="' + i + '" role="button" tabindex="0" aria-label="Step ' + s.n + ': ' + s.name + '">' +
        '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="34"/><text class="or-rn-n" x="' + p[0].toFixed(1) + '" y="' + (p[1] - 4).toFixed(1) + '" text-anchor="middle">' + s.n + '</text>' +
        '<text class="or-rn-t" x="' + p[0].toFixed(1) + '" y="' + (p[1] + 13).toFixed(1) + '" text-anchor="middle">' + s.name.toUpperCase() + '</text></g>';
    });
    $('.or-ringbox').innerHTML = svg + '</svg>';
  })();
  function stepDetail(i) {
    var s = Live.STEPS[i];
    $('.or-step').innerHTML = '<p class="or-step-h"><b>Step ' + s.n + ' &middot; ' + esc(s.name) + '</b> <span>' + esc(s.owner) + '</span></p><p>' + esc(s.what) + '</p><p class="or-step-e">Evidence: ' + esc(s.evidence) + ' ' + s.controls.map(cid).join(' ') + '</p>';
  }
  function lightStep(id) {
    var i = STEP[id]; if (i == null) return;
    $$('.or-rn').forEach(function (n, j) { n.classList.toggle('on', j === i); });
    stepDetail(i);
  }
  $$('.or-rn').forEach(function (n) {
    function pickIt() { stepDetail(parseInt(n.getAttribute('data-i'), 10)); }
    n.addEventListener('click', pickIt);
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickIt(); } });
  });

  /* ---------- state ---------- */
  var S, T, token = 0, timer = null, req = null, askReq = null;
  function fresh(mode) {
    return { mode: mode, run: null, gen: 0, curGen: 0, goal: 'cost', caps: { reversal_max: 2, fairness_max: 3 }, vmap: {}, order: [], champion: 'V0',
      champAt: {}, notes: [], pending: null, reframed: false, reframeOpen: false, wantReframe: false, busy: false, asking: false, paused: false,
      halted: null, ended: false, errored: false, loopCalls: 0, askCalls: 0, tokIn: 0, tokOut: 0, cost: 0, decisions: 0, says: [], sel: null, dataset: null };
  }
  function reset(mode, keepAsk) {
    var prev = S, prevT = T;
    token++;
    if (timer) clearTimeout(timer); timer = null;
    if (req) { req.abort(); req = null; }
    if (askReq) { askReq.abort(); askReq = null; }
    S = fresh(mode); T = [];
    if (keepAsk && prev && prev.mode === 'ask') {
      // Instructions sent before Start belong to this run: keep them, their cost and the conversation.
      S.notes = prev.notes; S.askCalls = prev.askCalls; S.tokIn = prev.tokIn; S.tokOut = prev.tokOut; S.says = prev.says; T = prevT;
    } else stream.innerHTML = '';
    $$('.or-ag').forEach(function (a) { a.classList.remove('talking'); });
    $$('.or-rn').forEach(function (n) { n.classList.remove('on'); });
    stepDetail(0);
    renderAll();
  }
  function setStatus(t, cls) { statusEl.textContent = t; statusEl.className = 'or-status' + (cls ? ' ' + cls : ''); }
  function inputsOn() { return S.mode !== 'playback' && !S.asking; }
  function syncInputs() { $$('.or-chip, .or-text, .or-form button').forEach(function (b) { b.disabled = !inputsOn(); }); pauseBtn.disabled = S.mode !== 'live' || S.ended; }
  function renderMeter() {
    var u = { input_tokens: S.tokIn, output_tokens: S.tokOut };
    $('.or-runmeter').textContent = S.mode === 'idle' ? 'Each run: up to ' + Live.CALLS_PER_RUN + ' AI calls on sample data. Nothing you type is stored.'
      : (S.mode === 'playback' ? 'Recorded run total: ' : 'This run: ') + S.loopCalls + ' of ' + Live.CALLS_PER_RUN + ' loop calls' + (S.askCalls ? ', ' + S.askCalls + ' instruction' + (S.askCalls > 1 ? 's' : '') : '') +
        ' \u00b7 ' + (S.tokIn + S.tokOut).toLocaleString('en-US') + ' tokens \u00b7 $' + Live.cost(u).toFixed(4);
  }
  function renderAll() { renderMeter(); renderMetrics(); renderChart(); renderTree(); syncInputs(); if (!S.sel) $('.or-node-info').textContent = 'Select a variant to read its lineage.'; }

  /* ---------- stream rendering ---------- */
  var follow = true;
  function nearBottom() { return stream.scrollHeight - stream.scrollTop - stream.clientHeight < 80; }
  stream.addEventListener('scroll', function () { follow = nearBottom(); });
  function toBottom() { follow = true; stream.scrollTop = stream.scrollHeight; }
  function append(el) {
    var stick = follow || nearBottom() || stream.querySelector('.or-empty');
    var e = stream.querySelector('.or-empty'); if (e) e.remove();
    stream.appendChild(el);
    if (stick) stream.scrollTop = stream.scrollHeight;
    return el;
  }
  function node(cls, html) { var d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; }
  function talking(a) { $$('.or-ag').forEach(function (x) { x.classList.toggle('talking', x.getAttribute('data-ag') === a); }); }
  function who(a) { return '<span class="or-av or-av-' + a + '" aria-hidden="true">' + esc(AG[a].short) + '</span>'; }
  function badge(source) { return source === 'model' ? '<span class="or-src or-src-ai">AI</span>' : source === 'code' ? '<span class="or-src or-src-code">Code</span>' : ''; }
  function clearThinking(a) { $$('.or-thinking' + (a ? '[data-a="' + a + '"]' : '')).forEach(function (el) { el.remove(); }); }
  function bubble(a, text, source, tone) {
    clearThinking(a); talking(a);
    var el = node('or-msg or-msg-' + a + (tone ? ' or-tone-' + tone : '') + (source === 'model' ? ' or-live' : ''), who(a) + '<div class="or-msg-b"><p class="or-msg-n">' + esc(AG[a].name) + ' ' + badge(source) + '</p><p class="or-msg-t">' + linkCids(text) + '</p></div>');
    el.setAttribute('data-a', a);
    announce.textContent = AG[a].name + ': ' + text;
    return append(el);
  }
  function snote(text, cls) { return append(node('or-snote' + (cls ? ' ' + cls : ''), esc(text))); }
  function meterLine(agent, u) {
    return append(node('or-meter', '<span class="or-live-b">AI call</span> ' + esc(AG[agent] ? AG[agent].name : agent) + ' \u00b7 ' + esc(Live.meter(u))));
  }

  /* ---------- events from the real loop ---------- */
  function entry(id) { return S.vmap[id]; }
  function apply(ev) {
    var e;
    switch (ev.t) {
      case 'run': S.run = ev.run; break;
      case 'dataset':
        S.dataset = ev;
        snote(ev.label + ' ' + ev.n + ' exceptions, ' + ev.small + ' from small suppliers. Every number below is computed from them.');
        break;
      case 'phase':
        if (typeof ev.gen === 'number' && ev.gen > S.gen) S.gen = ev.gen;
        S.curGen = ev.step === 'reframe' && S.reframed ? 'R' : ev.gen; lightStep(ev.step);
        if (S.curGen === 'R') S.champAt.R = S.champion;
        append(node('or-phase', '<span>' + (ev.step === 'reframe' ? 'Monthly reframe' : ev.gen === 0 ? 'Baseline' : 'Generation ' + ev.gen + ' &middot; Step ' + Live.STEPS[STEP[ev.step]].n + ' ' + esc(Live.STEPS[STEP[ev.step]].name)) + '</span>'));
        break;
      case 'thinking':
        clearThinking(); talking(ev.agent);
        append(node('or-msg or-thinking or-msg-' + ev.agent, who(ev.agent) + '<div class="or-msg-b"><p class="or-msg-n">' + esc(AG[ev.agent].name) + ' ' + badge('model') + '</p><p class="or-msg-t typing">Thinking</p></div>')).setAttribute('data-a', ev.agent);
        setStatus(AG[ev.agent].name + ' thinking', 'or-run');
        break;
      case 'say':
        if (!AG[ev.agent] || typeof ev.text !== 'string') break;
        bubble(ev.agent, ev.text, ev.source, ev.tone);
        S.says.push({ agent: ev.agent, text: ev.text.slice(0, 220) }); if (S.says.length > 8) S.says.shift();
        break;
      case 'note': clearThinking(ev.agent); snote(ev.text); break;
      case 'usage':
        S.loopCalls++; S.tokIn += ev.input_tokens || 0; S.tokOut += ev.output_tokens || 0; S.cost += Live.cost(ev);
        meterLine(ev.agent, ev); renderMeter();
        break;
      case 'variant':
        e = ev.v; if (!e || !e.id) break;
        if (!S.vmap[e.id]) S.order.push(e.id);
        S.vmap[e.id] = { id: e.id, parent: e.parent, gen: e.gen, status: e.status === 'proposed' ? 'proposed' : e.status, config: e.config, door: e.door, door_reasons: e.door_reasons || [], change: e.change, reason: e.reason, diff: e.diff || [], blocked: e.blocked, metrics: null, checks: null, scorer_request: e.scorer_request };
        if (e.id === 'V0') S.vmap.V0.status = 'champion';
        renderTree();
        break;
      case 'checks':
        e = entry(ev.id); if (e) e.checks = ev.items;
        append(node('or-checks', who('harness') + '<span class="or-checks-k">' + esc(ev.id) + (e && e.diff.length ? ' <small>' + esc(e.diff.join('; ')) + '</small>' : '') + '</span>' + ev.items.map(function (c) {
          return '<span class="or-chip-c ' + (c.pass ? 'ok' : 'bad') + '"><b>' + (c.pass ? 'Pass' : 'Fail') + '</b> ' + esc(c.name) + ' <small>' + linkCids(c.detail) + '</small></span>';
        }).join('')));
        if (ev.id === S.champion) renderMetrics();
        break;
      case 'metrics': e = entry(ev.id); if (e) e.metrics = ev.m; renderMetrics(); renderChart(); break;
      case 'status': e = entry(ev.id); if (e) e.status = ev.status; renderTree(); break;
      case 'ship':
        e = entry(ev.from); if (e) e.status = 'former';
        e = entry(ev.id); if (e) e.status = 'champion';
        append(node('or-ship', '<b>' + esc(ev.id) + '</b> ' + (ev.revert ? 'restored as champion: the loop reverted to an ancestor that passes' : ev.reframe ? 'is the champion under the new goal' : ev.approved ? 'ships: you approved a one-way door' : 'ships as champion behind a one-click undo') + ' <span>(was ' + esc(ev.from) + ')</span>'));
        break;
      case 'champion': S.champion = ev.id; S.champAt[S.curGen] = ev.id; renderAll(); break;
      case 'goal':
        S.goal = ev.goal === 'fpr' ? 'fpr' : 'cost';
        refreshChips(); renderAll();
        break;
      case 'decision': showDecision(ev); break;
      case 'error':
        S.errored = true; clearThinking();
        haltCard(ev.reason, ev.message, ev.retry_at);
        break;
      case 'done': clearThinking(); break;
    }
  }

  function showDecision(ev) {
    talking('supervisor');
    S.pending = { id: ev.id, alt: ev.alt || null };
    var el = node('or-dec', '<p class="or-dec-to">To: you, AP process owner <span class="or-dec-door">One-way door</span> ' + badge(ev.source) + '</p>' +
      '<p class="or-dec-t">' + esc(ev.title) + '</p><p class="or-dec-b">' + linkCids(ev.body || '') + '</p>' +
      (ev.door_reasons && ev.door_reasons.length ? '<p class="or-dec-r">Why it is one-way (decided in code): ' + esc(ev.door_reasons.join(' ')) + '</p>' : '') +
      '<p class="or-dec-btns">' + ev.options.map(function (o, i) { return '<button type="button" class="pill' + (i === 0 ? ' pill-dark' : '') + '" data-dec="' + esc(o.id) + '"' + (S.mode === 'playback' ? ' disabled' : '') + '>' + esc(o.label) + '</button>'; }).join('') + '</p>');
    el.setAttribute('data-id', ev.id);
    append(el); toBottom();
    announce.textContent = 'Decision for you: ' + ev.title;
    setStatus('Waiting for you', 'or-wait');
    var first = $('button', el); if (first && S.mode === 'live') first.focus({ preventScroll: true });
  }
  function answerCard(card, choiceId) {
    if (!card) return;
    $$('button', card).forEach(function (x) { x.disabled = true; x.classList.toggle('chosen', x.getAttribute('data-dec') === choiceId || x.getAttribute('data-goal') === choiceId); });
    card.classList.add('answered');
  }
  function you(text) {
    T.push({ k: 'you', text: text });
    var el = node('or-msg or-msg-you', who('you') + '<div class="or-msg-b"><p class="or-msg-n">You</p><p class="or-msg-t"></p></div>');
    $('.or-msg-t', el).textContent = text;
    append(el); toBottom();
  }

  function haltCard(reason, message, retryAt) {
    var hard = reason === 'daily_cap' || reason === 'run_cap' || reason === 'visitor_runs' || reason === 'expired';
    S.halted = hard ? 'hard' : 'soft';
    var el = node('or-halt', '<p>' + esc(Live.stopMessage(reason, message, retryAt)) + '</p><p class="or-halt-b">' +
      (!hard && S.mode === 'live' ? '<button type="button" class="pill pill-dark" data-a="retry">Try this step again</button>' : '') +
      (REC ? '<button type="button" class="pill" data-a="recorded">Watch a real run recorded earlier</button>' : '') + '</p>');
    append(el); toBottom();
    setStatus(hard ? 'Stopped' : 'Paused', 'or-wait');
  }

  /* ---------- the live run ---------- */
  function payload(extra) {
    var p = { run: S.run, goal: S.goal, caps: S.caps, champion: { id: S.champion, config: entry(S.champion).config },
      archive: S.order.map(function (id) { var e = S.vmap[id]; return { id: e.id, parent: e.parent, status: e.status === 'proposed' ? 'archived' : e.status, config: e.config, door: e.door, invalid: !!(e.blocked && e.blocked.kind !== 'guardrail'), note: e.blocked ? e.blocked.reason : '' }; }),
      notes: S.notes.slice(-4) };
    for (var k in extra) p[k] = extra[k];
    return p;
  }
  var last = null;
  function send(body, after) {
    var my = token;
    last = { body: body, after: after };
    S.busy = true; S.errored = false; S.halted = null; syncInputs();
    setStatus('Running', 'or-run');
    T.push({ k: 'req', action: body.action });
    req = Live.step(body, {
      event: function (ev) { if (my !== token) return; T.push({ k: 'ev', ev: ev }); apply(ev); },
      stop: function (reason, message, retryAt) {
        if (my !== token) return; req = null; S.busy = false;
        T.push({ k: 'ev', ev: { t: 'error', reason: reason, message: message, retry_at: retryAt } });
        clearThinking(); haltCard(reason, message, retryAt); syncInputs();
      },
      done: function () {
        if (my !== token) return; req = null; S.busy = false;
        if (!S.errored && after) after();
        syncInputs();
        if (!S.errored) advance();
      }
    });
  }
  function startRun() {
    reset('live', true);
    startBtn.textContent = 'New run';
    snote('Starting a real run. The Proposer and Supervisor are AI agents; the harness, Evaluator and Archivist are code.');
    send({ action: 'start' }, function () { S.gen = 0; });
  }
  function advance() {
    if (S.mode !== 'live' || S.busy || S.asking || S.pending || S.reframeOpen || S.halted || S.ended || !S.run) return;
    if (S.paused) { setStatus('Paused'); return; }
    if (S.wantReframe) { S.wantReframe = false; openReframe(false); return; }
    if (S.gen < 3) {
      var g = S.gen + 1, my = token;
      setStatus('Next: generation ' + g, 'or-run');
      timer = setTimeout(function () {
        timer = null;
        if (my !== token || S.busy || S.pending || S.paused || S.halted || S.reframeOpen || S.asking) { if (my === token) advance(); return; }
        var notes = S.notes.slice(-4); S.notes = [];
        var body = payload({ action: 'generation', gen: g }); body.notes = notes;
        send(body, function () { S.gen = g; });
      }, reduce ? 300 : 900);
      return;
    }
    if (!S.reframed) { openReframe(true); return; }
    finish();
  }
  function openReframe(monthly) {
    S.reframeOpen = true; lightStep('reframe');
    if (S.mode === 'live') T.push({ k: 'reframe', monthly: !!monthly });
    var other = S.goal === 'cost' ? 'fpr' : 'cost';
    var el = node('or-dec or-dec-goal', '<p class="or-dec-to">To: you, AP process owner <span class="or-dec-door">Goal</span></p>' +
      '<p class="or-dec-t">' + (monthly ? 'Monthly reframe: which goal should the loop chase?' : 'Reframe: which goal should the loop chase?') + '</p>' +
      '<p class="or-dec-b">Now: ' + esc(GOALS[S.goal].name) + '. Switching re-scores every eligible variant in the archive with the same locked scorer, and may change the champion.</p>' +
      '<p class="or-dec-btns"><button type="button" class="pill pill-dark" data-goal="' + other + '">Switch to ' + esc(GOALS[other].name.toLowerCase()) + '</button><button type="button" class="pill" data-goal="' + S.goal + '">Keep ' + esc(GOALS[S.goal].name.toLowerCase()) + '</button></p>');
    el.setAttribute('data-monthly', monthly ? '1' : '0');
    append(el); toBottom();
    setStatus('Waiting for you', 'or-wait');
  }
  function finish() {
    S.ended = true; syncInputs();
    var v0 = entry('V0'), ch = entry(S.champion), g = S.goal;
    var blocked = S.order.filter(function (id) { return S.vmap[id].status === 'blocked'; }).length;
    var per = [], cur = 'V0';
    [0, 1, 2, 3, 'R'].forEach(function (k) {
      if (S.champAt[k]) cur = S.champAt[k];
      if (k === 'R' && !S.champAt.R) return;
      if (k !== 'R' && k > S.gen) return;
      per.push((k === 'R' ? 'Reframe' : k ? 'G' + k : 'Start') + ' ' + cur + ' ' + fmt(gv(S.vmap[cur] && S.vmap[cur].metrics, g), g));
    });
    append(node('or-end', '<p class="or-k">Run complete</p><p>' + esc(GOALS[g].name) + ': ' + fmt(gv(v0.metrics, g), g) + ' at baseline to ' + fmt(gv(ch.metrics, g), g) + ' with champion ' + esc(ch.id) + '. By generation: ' + esc(per.join(' \u00b7 ')) + '.</p><p>' +
      (S.order.length - 1) + ' variants proposed, ' + blocked + ' blocked by the harness. You made ' + S.decisions + ' decision' + (S.decisions === 1 ? '' : 's') + '. ' + esc($('.or-runmeter').textContent) + '.</p>' +
      '<p class="or-halt-b"><button type="button" class="pill pill-dark" data-a="start">Start a new run</button>' + (REC ? ' <button type="button" class="pill" data-a="recorded">Watch the recorded run</button>' : '') + '</p>'));
    setStatus('Finished', 'or-done');
    announce.textContent = 'Run complete.';
    pauseBtn.disabled = true;
  }

  stream.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || S.mode !== 'live') return;
    var card = b.closest('.or-dec');
    if (b.hasAttribute('data-dec') && S.pending && !S.busy) {
      var choice = b.getAttribute('data-dec'), p = S.pending;
      answerCard(card, choice);
      if (choice === 'why') { you('Why is this coming to me?'); send(payload({ action: 'why', id: p.id, question: 'Why is this coming to me?' })); return; }
      S.pending = null; S.decisions++; S.halted = null;
      you(choice === 'approve' ? 'Approve ' + p.id + '.' : 'Reject ' + p.id + '.');
      send(payload({ action: 'decide', choice: choice, id: p.id, alt: p.alt }));
    } else if (b.hasAttribute('data-goal') && S.reframeOpen && !S.busy) {
      var to = b.getAttribute('data-goal'), monthly = card && card.getAttribute('data-monthly') === '1';
      answerCard(card, to);
      S.reframeOpen = false; S.decisions++; S.halted = null;
      if (monthly) S.reframed = true;
      you(to === S.goal ? 'Keep the goal: ' + GOALS[to].name.toLowerCase() + '.' : 'Switch the goal to ' + GOALS[to].name.toLowerCase() + '.');
      send(payload({ action: 'reframe', to: to }));
    }
  });

  /* ---------- metrics, rails, chart, tree ---------- */
  function renderMetrics() {
    var box = $('.or-metrics'), ch = S && entry(S.champion), m = ch && ch.metrics;
    if (!m) { box.innerHTML = '<div class="or-m"><span>Goal</span><b>&ndash;</b><small>Measured when a run starts</small></div>'; $('.or-rails').innerHTML = ''; return; }
    var other = S.goal === 'cost' ? 'fpr' : 'cost', base = entry('V0').metrics;
    box.innerHTML = '<div class="or-m or-m-goal"><span>' + esc(GOALS[S.goal].name) + '</span><b>' + fmt(gv(m, S.goal), S.goal) + '</b><small>Goal &middot; baseline ' + fmt(gv(base, S.goal), S.goal) + '</small></div>' +
      '<div class="or-m"><span>' + esc(GOALS[other].name) + '</span><b>' + fmt(gv(m, other), other) + '</b><small>Tracked, not the goal</small></div>' +
      '<div class="or-m"><span>Champion</span><b>' + esc(ch.id) + '</b><small>' + m.auto + ' of ' + m.n + ' without a person</small></div>';
    var checks = ch.checks || [];
    $('.or-rails').innerHTML = checks.length ? '<p class="or-rails-k">Champion guardrails <small>fairness cap ' + S.caps.fairness_max.toFixed(1) + ' pts</small></p>' + checks.filter(function (c) { return c.id !== 'scorer'; }).map(function (c) {
      return '<span class="or-chip-c ' + (c.pass ? 'ok' : 'bad') + '"><b>' + (c.pass ? 'Pass' : 'Fail') + '</b> ' + esc(c.name) + ' <small>' + esc(c.detail) + '</small></span>';
    }).join('') : '';
  }
  function renderChart() {
    var box = $('.or-chart');
    if (!S || !entry('V0') || !entry('V0').metrics) { box.innerHTML = ''; return; }
    var g = S.goal, W = 320, H = 170, pl = 44, pr = 12, pt = 12, pb = 26, cols = ['0', '1', '2', '3', 'R'], line = [], dots = [], vals = [];
    var champ = 'V0';
    cols.forEach(function (k, i) {
      if (S.champAt[k === 'R' ? 'R' : +k] !== undefined) champ = S.champAt[k === 'R' ? 'R' : +k];
      var reached = k === '0' || (k === 'R' ? S.reframed && S.champAt.R !== undefined : S.gen >= +k || S.champAt[+k] !== undefined);
      if (!reached) return;
      var e = entry(champ); if (e && e.metrics) { line.push([i, gv(e.metrics, g)]); vals.push(gv(e.metrics, g)); }
      if (k !== '0' && k !== 'R') S.order.forEach(function (id) { var v = S.vmap[id]; if (v.gen === +k && v.metrics) { dots.push([i, gv(v.metrics, g), v.status === 'blocked', id]); vals.push(gv(v.metrics, g)); } });
    });
    if (!vals.length) { box.innerHTML = ''; return; }
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = Math.max((hi - lo) * 0.15, g === 'fpr' ? 2 : 0.3); lo = Math.max(0, lo - pad); hi += pad;
    function X(i) { return pl + (W - pl - pr) * i / 4; }
    function Y(v) { return pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo)); }
    var s = '<svg class="or-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(GOALS[g].name) + ' of the champion by generation, computed on the sample data.">';
    for (var k = 0; k <= 3; k++) { var v = lo + (hi - lo) * k / 3, y = Y(v); s += '<line class="or-gl" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><text class="or-ax" x="' + (pl - 4) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + (g === 'fpr' ? v.toFixed(0) + '%' : '$' + v.toFixed(2)) + '</text>'; }
    ['Start', 'G1', 'G2', 'G3', 'Reframe'].forEach(function (t, i) { s += '<text class="or-ax" x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + (i === 4 ? 'end' : 'middle') + '">' + t + '</text>'; });
    dots.forEach(function (d) {
      var x = X(d[0]) + (/-2$/.test(d[3]) ? 7 : -7), y = Y(d[1]);
      s += d[2] ? '<path class="or-dx" d="M' + (x - 4).toFixed(1) + ',' + (y - 4).toFixed(1) + ' l8,8 M' + (x + 4).toFixed(1) + ',' + (y - 4).toFixed(1) + ' l-8,8"><title>' + esc(d[3]) + ' blocked</title></path>'
        : '<circle class="or-dv" r="3.5" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '"><title>' + esc(d[3] + ' ' + fmt(d[1], g)) + '</title></circle>';
    });
    s += '<polyline class="or-line-score" points="' + line.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '"/>';
    line.forEach(function (p) { s += '<circle class="or-dot" r="4" cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '"/>'; });
    box.innerHTML = s + '</svg><p class="or-key"><span class="k k-score">Champion</span><span class="k k-var">Variant</span><span class="k k-blk">Blocked</span></p><p class="or-key-n">' + esc(GOALS[g].name) + (g === 'cost' ? ', lower is better' : ', higher is better') + '. Computed on the sample data.</p>';
  }
  function cls(st) { return st === 'champion' ? 'champ' : st === 'blocked' ? 'block' : st === 'pending' ? 'pend' : st === 'rejected' ? 'ret' : st === 'former' ? 'was' : st === 'proposed' ? 'pend' : 'arch'; }
  function renderTree() {
    var box = $('.or-tree');
    if (!S || !S.order.length) { box.innerHTML = '<p class="or-tree-empty">The archive grows here as the agents work.</p>'; return; }
    var dx = 92, W = 60 + 3 * dx + 40, H = 120, lin = {};
    var c = entry(S.champion); while (c) { lin[c.id] = 1; c = c.parent ? entry(c.parent) : null; }
    function P(v) { return [32 + v.gen * dx, v.id === 'V0' ? 52 : /-1$/.test(v.id) ? 28 : 78]; }
    var s = '<svg class="or-tree-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Archive tree, ' + S.order.length + ' variants">';
    S.order.forEach(function (id) { var v = S.vmap[id]; if (!v.parent || !entry(v.parent)) return; var a = P(entry(v.parent)), b = P(v), mx = (a[0] + b[0]) / 2; s += '<path class="or-te' + (lin[v.id] && lin[v.parent] ? ' main' : '') + '" d="M' + a[0] + ',' + a[1] + ' C' + mx + ',' + a[1] + ' ' + mx + ',' + b[1] + ' ' + b[0] + ',' + b[1] + '"/>'; });
    S.order.forEach(function (id) {
      var v = S.vmap[id], p = P(v), st = v.status;
      s += '<g class="or-tn or-tn-' + cls(st) + (v.blocked && v.blocked.kind === 'scorer' ? ' hack' : '') + (S.sel === id ? ' sel' : '') + '" data-id="' + esc(id) + '" tabindex="0" role="button" aria-label="' + esc(id + ', ' + st + ': ' + (v.diff.join(', ') || v.change)) + '"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (st === 'champion' ? 11 : 8) + '"/>' +
        (st === 'blocked' ? '<path class="or-x" d="M' + (p[0] - 4) + ',' + (p[1] - 4) + ' l8,8 M' + (p[0] + 4) + ',' + (p[1] - 4) + ' l-8,8"/>' : '') +
        '<text class="or-tl" x="' + (p[0] + 14) + '" y="' + (p[1] + 4) + '">' + esc(id) + '</text><title>' + esc(id + ': ' + (v.diff.join(', ') || v.change)) + '</title></g>';
    });
    for (var gi = 0; gi <= 3; gi++) s += '<text class="or-ax" x="' + (32 + gi * dx) + '" y="' + (H - 4) + '" text-anchor="middle">' + (gi ? 'G' + gi : 'start') + '</text>';
    box.innerHTML = s + '</svg>';
  }
  function info(id) {
    S.sel = id; renderTree();
    var v = entry(id), chain = [], c = v, g = S.goal;
    while (c) { chain.unshift(c); c = c.parent ? entry(c.parent) : null; }
    $('.or-node-info').innerHTML = '<b>' + esc(v.id) + '</b> ' + esc(v.id === 'V0' ? 'Starting policy' : (v.diff.join(', ') || v.change)) + '. Status: ' + esc(v.status) + '. ' +
      (v.door === 'one-way' ? 'One-way door. ' : '') + (v.blocked ? 'Blocked: ' + esc(v.blocked.reason) + ' ' : '') +
      (v.metrics ? esc(GOALS[g].name) + ' ' + fmt(gv(v.metrics, g), g) + '. ' : '') + 'Lineage: ' + chain.map(function (x) { return '<span>' + esc(x.id) + '</span>'; }).join(' &rarr; ');
  }
  $('.or-tree').addEventListener('click', function (e) { var n = e.target.closest('.or-tn'); if (n) info(n.getAttribute('data-id')); });
  $('.or-tree').addEventListener('keydown', function (e) { var n = e.target.closest && e.target.closest('.or-tn'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); var id = n.getAttribute('data-id'); info(id); var f = $('.or-tn[data-id="' + id + '"]'); if (f) f.focus(); } });

  /* ---------- visitor instructions to the real agents ---------- */
  function agentState() {
    var ch = entry(S.champion);
    return {
      generation: S.gen, goal: S.goal, champion: S.champion,
      guardrails: ((ch && ch.checks) || []).filter(function (c) { return c.id !== 'scorer'; }).map(function (c) { return { name: (c.name.split(' ').pop() + ' ' + c.detail).slice(0, 40), status: c.pass ? 'pass' : 'fail' }; }),
      pending: S.pending ? { title: 'Approve ' + S.pending.id + ': ' + (entry(S.pending.id) ? entry(S.pending.id).diff.join(', ') : ''), door: 'one-way' } : null,
      events: S.says.slice(-6)
    };
  }
  function instruct(text) {
    if (!inputsOn()) return;
    text = String(text).trim().slice(0, 300); if (!text) return;
    if (S.mode === 'idle' || S.mode === 'playback') { reset('ask'); }
    var my = token, rec = { k: 'agents', instruction: text, turns: [], usage: null, action: 'none' }, cur = null;
    S.asking = true; syncInputs();
    you(text);
    T.pop(); T.push(rec);
    setStatus('Agents answering', 'or-run');
    function open(a) {
      if (cur && cur.a === a && !cur.closed) return cur;
      clearThinking(a); talking(a);
      var el = append(node('or-msg or-msg-' + a + ' or-live', who(a) + '<div class="or-msg-b"><p class="or-msg-n">' + esc(AG[a].name) + ' ' + badge('model') + '</p><p class="or-msg-t typing"></p></div>'));
      cur = { a: a, t: $('.or-msg-t', el), closed: false };
      return cur;
    }
    askReq = Live.ask({ instruction: text, state: agentState() }, {
      delta: function (a, d) { if (my !== token) return; var b = open(a); b.t.textContent += d; if (follow) stream.scrollTop = stream.scrollHeight; },
      turn: function (a, t) { if (my !== token) return; var b = open(a); b.t.classList.remove('typing'); b.t.innerHTML = linkCids(t); b.closed = true; rec.turns.push({ a: a, text: t }); S.says.push({ agent: a, text: t.slice(0, 220) }); announce.textContent = AG[a].name + ': ' + t; },
      usage: function (u) { if (my !== token) return; rec.usage = u; S.askCalls++; S.tokIn += u.input_tokens; S.tokOut += u.output_tokens; meterLine('agents', u); renderMeter(); },
      done: function (action) {
        if (my !== token) return;
        askReq = null; S.asking = false; rec.action = action;
        S.notes.push({ text: text, action: action });
        actOn(action, text);
        syncInputs(); if (!S.busy && !S.pending && !S.reframeOpen) setStatus(S.mode === 'live' ? 'Running' : 'Ready');
        advance();
      },
      stop: function (reason, message, retryAt) {
        if (my !== token) return;
        askReq = null; S.asking = false;
        $$('.or-msg-t.typing').forEach(function (t) { var m = t.closest('.or-msg'); if (m) m.remove(); });
        rec.stopped = reason;
        snote(Live.stopMessage(reason, message, retryAt) + (reason === 'daily_cap' && REC ? ' You can still watch a real run recorded earlier.' : ''), 'or-snote-alert');
        syncInputs(); advance();
      }
    });
  }
  function actOn(action, text) {
    if (action === 'tighten_guardrail') {
      if (S.caps.fairness_max > 1) {
        S.caps.fairness_max = Math.max(1, S.caps.fairness_max - 1);
        snote('Fairness cap is now ' + S.caps.fairness_max.toFixed(1) + ' pts. The harness applies it, to the champion too, from the next generation.');
      } else snote('The fairness cap is already at its tightest, 1.0 pts.');
      renderMetrics();
    } else if (action === 'reframe_goal') {
      if (S.mode === 'live' && !S.ended) { if (!S.busy && !S.pending && !S.reframeOpen) openReframe(false); else S.wantReframe = true; }
      else snote('Start a run to reframe its goal.');
    } else if (action === 'request_decision') {
      var cards = stream.querySelectorAll('.or-dec:not(.answered)'), card = cards[cards.length - 1];
      if (card) { var btn = $('button', card); if (btn) btn.focus({ preventScroll: true }); }
    }
    if (S.mode === 'live' && !S.ended && S.gen < 3) snote('Your instruction goes to the Proposer with generation ' + (S.gen + 1) + '.');
    else if (S.mode !== 'live') snote('Start a run and the Proposer reads this instruction in generation 1.');
  }
  function refreshChips() {
    var g = $('[data-chip="goal"]'); if (g && S) g.textContent = 'Reframe the goal to ' + GOALS[S.goal === 'cost' ? 'fpr' : 'cost'].name.toLowerCase();
  }

  /* ---------- replay of a recorded real run ---------- */
  function playRecorded() {
    if (!REC) return;
    reset('playback');
    startBtn.textContent = 'Start a live run';
    append(node('or-recbanner', '<b>' + esc(REC.label) + '</b> Played back from the event log of a real production run. No live calls are made.'));
    var items = REC.transcript, i = 0, my = token;
    setStatus('Recording', 'or-run');
    (function nextItem() {
      if (my !== token) return;
      if (i >= items.length) { setStatus('Recording ended', 'or-done'); toBottom(); append(node('or-end', '<p class="or-k">End of the recording</p><p class="or-halt-b"><button type="button" class="pill pill-dark" data-a="start">Start a live run</button></p>')); return; }
      var it = items[i++], wait = 160;
      if (it.k === 'ev') {
        var ev = it.ev;
        if (ev.t === 'done' || ev.t === 'run') wait = 0;
        apply(ev);
        if (ev.t === 'say') wait = reduce ? 250 : Math.min(2600, 500 + ev.text.length * 12);
        else if (ev.t === 'thinking') wait = reduce ? 200 : 900;
        else if (ev.t === 'decision') wait = 1400;
        if (ev.t === 'goal' || ev.t === 'champion') renderAll();
      } else if (it.k === 'you') {
        var cards = stream.querySelectorAll('.or-dec:not(.answered)'), card = cards[cards.length - 1];
        if (card) { var m = /^(Approve|Reject)/.exec(it.text), w = /^Why/.test(it.text), sw = /^Switch/.test(it.text), kp = /^Keep/.test(it.text);
          answerCard(card, m ? m[1].toLowerCase() : w ? 'why' : sw ? (S.goal === 'cost' ? 'fpr' : 'cost') : kp ? S.goal : ''); }
        if (/^(Approve|Reject|Switch|Keep)/.test(it.text)) S.decisions++;
        if (/^(Switch|Keep)/.test(it.text) && S.gen >= 3) S.reframed = true;
        if (/^(Approve|Reject)/.test(it.text)) S.pending = null;
        you(it.text); T.pop(); wait = 700;
      } else if (it.k === 'reframe') {
        openReframe(it.monthly); S.reframeOpen = false;
        $$('.or-dec-goal:not(.answered) button').forEach(function (x) { x.disabled = true; });
        wait = 1400;
      } else if (it.k === 'agents') {
        you(it.instruction); T.pop();
        (it.turns || []).forEach(function (t) { bubble(t.a, t.text, 'model'); });
        if (it.usage) { S.askCalls++; S.tokIn += it.usage.input_tokens; S.tokOut += it.usage.output_tokens; meterLine('agents', it.usage); renderMeter(); }
        wait = 1800;
      } else wait = 0;
      timer = setTimeout(nextItem, reduce ? Math.min(wait, 250) : wait);
    })();
  }

  /* ---------- controls ---------- */
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var a = b.getAttribute('data-a');
    if (a === 'start') startRun();
    else if (a === 'recorded') playRecorded();
    else if (a === 'pause') {
      S.paused = !S.paused; b.setAttribute('aria-pressed', String(S.paused)); b.textContent = S.paused ? 'Resume' : 'Pause';
      if (!S.paused) advance(); else if (!S.busy) setStatus('Paused');
    } else if (a === 'retry' && last && S.halted === 'soft' && !S.busy) {
      b.disabled = true; S.halted = null; send(last.body, last.after);
    } else if (b.hasAttribute('data-chip')) {
      var c = Live.CHIPS.filter(function (x) { return x.id === b.getAttribute('data-chip'); })[0];
      if (c) instruct(c.id === 'goal' ? 'I want to reframe the goal to ' + GOALS[S.goal === 'cost' ? 'fpr' : 'cost'].name.toLowerCase() + '.' : c.text);
    }
  });
  $('.or-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var inp = $('.or-text'), v = inp.value.trim(); if (!v || !inputsOn()) return;
    inp.value = ''; instruct(v);
  });

  reset('idle');
  stream.innerHTML = '<div class="or-empty"><p><b>Press Start a run.</b> AI agents improve an accounts-payable exception policy, and code measures every change on 150 sample exceptions.</p><p>You play the AP process owner. One-way doors come to you as decision cards. You can instruct the agents before or during the run.</p>' +
    (REC ? '<p>Or <button type="button" class="pill" data-a="recorded">watch a recorded real run</button> first.</p>' : '') + '</div>';
  refreshChips();
  AE.loopsRoom = { transcript: function () { return JSON.parse(JSON.stringify(T)); }, state: function () { return JSON.parse(JSON.stringify({ gen: S.gen, goal: S.goal, champion: S.champion, ended: S.ended, pending: S.pending, halted: S.halted, busy: S.busy, asking: S.asking, reframeOpen: S.reframeOpen, loopCalls: S.loopCalls, tokIn: S.tokIn, tokOut: S.tokOut, cost: S.cost })); } };
  var wrap = root.closest('.bp-ix'); if (wrap) wrap.hidden = false;
  var st = document.querySelector('[data-lp-static="room"]'); if (st) st.hidden = true;
})();
