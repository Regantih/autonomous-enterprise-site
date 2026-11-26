/* Live operations room UI for /blueprints/loops/. Plays the scripted engine in loops-core.js.
   Instructions go to live AI agents through loops-live.js when available, and fall back to the
   scripted engine on any failure. No storage. Illustrative numbers. */
(function () {
  'use strict';
  var AE = window.AE, L = AE && AE.loops, Live = AE && AE.loopsLive;
  var root = document.querySelector('[data-lp="room"]');
  if (!L || !root) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || root).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cid(id) { return '<a class="cid" href="/controls/#' + esc(id) + '">' + esc(id) + '</a>'; }
  function linkCids(t) { return esc(t).replace(/\b(MR-10|TRC-05|HO-06)\b/g, function (m) { return cid(m); }); }
  var AG = {}; L.AGENTS.forEach(function (a) { AG[a.id] = a; });
  var STEP = {}; L.STEPS.forEach(function (s, i) { STEP[s.id] = i; });
  var SEED = 7;

  /* ---------- skeleton ---------- */
  root.innerHTML =
    '<div class="or">' +
    '<div class="or-top">' +
      '<div class="or-title"><p class="or-k">Live operations room</p><p class="or-label">Simulated run, live AI agents when you type. Illustrative numbers.</p></div>' +
      '<div class="or-ctl">' +
        '<button type="button" class="pill or-start" data-a="start">Start</button>' +
        '<span class="or-speed" role="group" aria-label="Speed"><button type="button" class="seg" data-speed="1" aria-pressed="true">1x</button><button type="button" class="seg" data-speed="2" aria-pressed="false">2x</button></span>' +
        '<button type="button" class="pill pill-ghost or-replay" data-a="replay">Replay</button>' +
        (Live ? '<button type="button" class="seg or-live-t" data-a="live" aria-pressed="true" title="Typed instructions and chips are answered by live AI agents. Start, decisions and the run itself stay scripted.">Live agents (AI)</button>' : '') +
        '<span class="or-status" aria-live="polite">Ready</span>' +
      '</div>' +
    '</div>' +
    '<ul class="or-roster" aria-label="Agents in the room">' + L.AGENTS.map(function (a) {
      return '<li class="or-ag or-ag-' + a.id + '" data-ag="' + a.id + '"><span class="or-av" aria-hidden="true">' + esc(a.short) + '</span><span class="or-ag-t"><b>' + esc(a.name) + '</b><small>' + esc(a.role) + '</small></span></li>';
    }).join('') + '</ul>' +
    '<div class="or-main">' +
      '<div class="or-center">' +
        '<div class="or-stream" role="log" aria-live="off" aria-label="Agent conversation" tabindex="0"></div>' +
        '<p class="visually-hidden or-announce" aria-live="polite"></p>' +
        '<div class="or-input">' +
          '<p class="or-input-k">Instruct the agents</p>' +
          '<div class="or-chips">' + L.CHIPS.map(function (c) { return '<button type="button" class="pill or-chip" data-chip="' + c.id + '" disabled>' + esc(c.label) + '</button>'; }).join('') + '</div>' +
          '<form class="or-form"><label class="visually-hidden" for="or-text">Instruction to the agents</label><input id="or-text" class="or-text" type="text" maxlength="300" autocomplete="off" placeholder="Or type a short instruction" disabled><button type="submit" class="pill pill-dark" disabled>Send</button></form>' +
        '</div>' +
      '</div>' +
      '<div class="or-side">' +
        '<div class="or-ringbox"></div>' +
        '<div class="or-step" aria-live="polite"></div>' +
        '<div class="or-metrics"></div>' +
        '<div class="or-chart"></div>' +
      '</div>' +
    '</div>' +
    '<div class="or-treebox"><p class="or-k or-k-dark">The archive: every variant and its parent</p><div class="or-tree" tabindex="0" role="region" aria-label="Archive tree of variants"></div>' +
      '<div class="or-legend"><span class="lg lg-champ">Champion</span><span class="lg lg-was">Former champion</span><span class="lg lg-arch">Archived</span><span class="lg lg-block">Blocked</span><span class="lg lg-pend">Waits for you or parked</span><span class="lg lg-ret">Retired, rejected or reverted</span></div>' +
      '<p class="or-node-info" aria-live="polite"></p></div>' +
    '</div>';

  var stream = $('.or-stream'), statusEl = $('.or-status'), startBtn = $('.or-start'), announce = $('.or-announce');

  /* ---------- loop ring ---------- */
  var ringPos = [];
  (function ring() {
    var cx = 160, cy = 160, R = 112, svg = '<svg class="or-ring" viewBox="0 0 320 320" role="group" aria-label="The six-step loop. The active step lights up.">' +
      '<defs><marker id="or-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="or-arrh"/></marker></defs>';
    L.STEPS.forEach(function (s, i) {
      var a = (-90 + i * 60) * Math.PI / 180; ringPos.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
      var a0 = (-90 + i * 60 + 19) * Math.PI / 180, a1 = (-90 + (i + 1) * 60 - 19) * Math.PI / 180;
      svg += '<path class="or-edge' + (i === 5 ? ' or-edge-back' : '') + '" d="M' + (cx + R * Math.cos(a0)).toFixed(1) + ',' + (cy + R * Math.sin(a0)).toFixed(1) + ' A' + R + ',' + R + ' 0 0 1 ' + (cx + R * Math.cos(a1)).toFixed(1) + ',' + (cy + R * Math.sin(a1)).toFixed(1) + '" marker-end="url(#or-arr)"/>';
    });
    svg += '<text class="or-ring-k" x="160" y="152" text-anchor="middle">ONE GOAL</text><text class="or-ring-t" x="160" y="176" text-anchor="middle">You own it</text>';
    L.STEPS.forEach(function (s, i) {
      var p = ringPos[i];
      svg += '<g class="or-rn' + (s.id === 'decide' || s.id === 'reframe' ? ' or-rn-h' : '') + '" data-i="' + i + '" role="button" tabindex="0" aria-label="Step ' + s.n + ': ' + s.name + '">' +
        '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="34"/><text class="or-rn-n" x="' + p[0].toFixed(1) + '" y="' + (p[1] - 4).toFixed(1) + '" text-anchor="middle">' + s.n + '</text>' +
        '<text class="or-rn-t" x="' + p[0].toFixed(1) + '" y="' + (p[1] + 13).toFixed(1) + '" text-anchor="middle">' + s.name.toUpperCase() + '</text></g>';
    });
    svg += '</svg>';
    $('.or-ringbox').innerHTML = svg;
  })();
  function stepDetail(i) {
    var s = L.STEPS[i];
    $('.or-step').innerHTML = '<p class="or-step-h"><b>Step ' + s.n + ' &middot; ' + esc(s.name) + '</b> <span>' + esc(s.owner) + '</span></p><p>' + esc(s.what) + '</p><p class="or-step-e">Evidence: ' + esc(s.evidence) + ' ' + s.controls.map(cid).join(' ') + '</p>';
  }
  function lightStep(id) {
    var i = STEP[id];
    $$('.or-rn').forEach(function (n, j) { n.classList.toggle('on', j === i); });
    stepDetail(i);
  }
  $$('.or-rn').forEach(function (n) {
    function pickIt() { stepDetail(parseInt(n.getAttribute('data-i'), 10)); }
    n.addEventListener('click', pickIt);
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickIt(); } });
  });

  /* ---------- state ---------- */
  var run, playing = false, started = false, speed = 1, timer = null, pending = null, busy = false, token = 0;
  var liveOn = !!Live, liveHold = false, liveReq = null;
  var vmap = {}, order = [], hist = [], sel = null, champ = null;

  function reset() {
    token++;
    if (liveReq) { liveReq.abort(); liveReq = null; }
    liveHold = false;
    if (timer) clearTimeout(timer);
    timer = null; pending = null; busy = false; playing = false; started = false;
    run = L.create(SEED);
    vmap = {}; order = []; hist = []; sel = null; champ = null;
    stream.innerHTML = '<div class="or-empty"><p><b>Press Start.</b> Five simulated agents improve an accounts-payable workflow in front of you.</p><p>You play the AP process owner. One-way doors come to you as decision cards. You can also instruct the agents at any time.</p></div>';
    $$('.or-ag').forEach(function (a) { a.classList.remove('talking'); });
    $$('.or-rn').forEach(function (n) { n.classList.remove('on'); });
    stepDetail(0);
    setStatus('Ready');
    startBtn.textContent = 'Start'; startBtn.setAttribute('aria-pressed', 'false');
    enableInput(false);
    renderMetrics(); renderChart(); renderTree(); $('.or-node-info').textContent = 'Select a variant to read its lineage.';
  }
  function setStatus(t, cls) { statusEl.textContent = t; statusEl.className = 'or-status' + (cls ? ' ' + cls : ''); }
  function enableInput(on) { $$('.or-chip, .or-text, .or-form button').forEach(function (b) { b.disabled = !on || liveHold; }); }

  // Scheduler that respects pause. Stale callbacks from an old run are dropped by token.
  function later(fn, ms) {
    var my = token; busy = true;
    timer = setTimeout(function () {
      timer = null;
      if (my !== token) return;
      if (!playing || liveHold) { pending = fn; return; }
      fn();
    }, Math.max(0, (reduce ? Math.min(ms, 260) : ms) / speed));
  }
  function tick() {
    if (!playing || liveHold) { busy = false; return; }
    var ev = L.next(run);
    if (!ev) {
      busy = false;
      if (run.waiting) setStatus('Waiting for you', 'or-wait');
      else if (run.done) { setStatus('Finished', 'or-done'); playing = false; startBtn.textContent = 'Start'; }
      return;
    }
    setStatus('Running', 'or-run');
    show(ev, function (ms) { later(tick, ms); });
  }
  function kick() { if (playing && !busy && !liveHold) tick(); }

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
  }
  function node(cls, html) { var d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; }
  function talking(a) { $$('.or-ag').forEach(function (x) { x.classList.toggle('talking', x.getAttribute('data-ag') === a); }); }
  function who(a) { var g = AG[a]; return '<span class="or-av or-av-' + a + '" aria-hidden="true">' + esc(g.short) + '</span>'; }

  function show(ev, done) {
    if (ev.t === 'msg') return showMsg(ev, done);
    if (ev.t === 'phase') {
      lightStep(ev.step);
      var s = L.STEPS[STEP[ev.step]];
      append(node('or-phase', '<span>' + (ev.step === 'reframe' ? 'Monthly reframe meeting' : 'Generation ' + ev.gen + ' &middot; Step ' + s.n + ' ' + esc(s.name)) + '</span>'));
      return done(320);
    }
    if (ev.t === 'tool') {
      talking(ev.a);
      var d = document.createElement('details'); d.className = 'or-tool';
      d.innerHTML = '<summary>' + who(ev.a) + '<span class="or-tool-k">Tool call</span> <code>' + esc(ev.name) + '(' + esc(ev.args) + ')</code></summary><pre>' + esc(ev.result) + '</pre>';
      append(d);
      return done(700);
    }
    if (ev.t === 'checks') {
      talking('harness');
      append(node('or-checks', who('harness') + '<span class="or-checks-k">' + esc(ev.variant) + '</span>' + ev.items.map(function (c) {
        return '<span class="or-chip-c ' + (c.pass ? 'ok' : 'bad') + '"><b>' + (c.pass ? 'Pass' : 'Fail') + '</b> ' + esc(c.name) + ' <small>' + esc(c.detail) + '</small></span>';
      }).join('')));
      return done(560);
    }
    if (ev.t === 'variant') {
      if (!vmap[ev.v.id]) order.push(ev.v.id);
      vmap[ev.v.id] = ev.v;
      if (ev.v.status === 'champion') champ = ev.v;
      renderTree();
      return done(40);
    }
    if (ev.t === 'metric') {
      hist.push(ev); champ = vmap[ev.champion] || champ;
      renderMetrics(); renderChart(); refreshChips();
      return done(160);
    }
    if (ev.t === 'decision') return showDecision(ev, done);
    if (ev.t === 'end') {
      var s2 = ev.summary;
      append(node('or-end', '<p class="or-k">Run complete</p><p>' + esc(L.GOALS[s2.goal].name) + ': ' + L.fmt(s2.from, s2.goal) + ' to ' + L.fmt(s2.to, s2.goal) + '. ' + s2.variants + ' variants, ' + s2.blocked + ' blocked by guardrails. You decided ' + s2.decisions + '.' +
        (s2.caught ? ' The lineage review caught the evaluator edit.' : '') + '</p><p>Replay and choose differently. Approve the evaluator edit to see reward hacking, or switch the goal in the reframe.</p><button type="button" class="pill pill-dark" data-a="replay">Replay</button>'));
      announce.textContent = 'Run complete.';
      return done(100);
    }
    done(0);
  }

  function showMsg(ev, done) {
    talking(ev.a);
    var el = node('or-msg or-msg-' + ev.a + (ev.tone ? ' or-tone-' + ev.tone : ''), who(ev.a) + '<div class="or-msg-b"><p class="or-msg-n">' + esc(AG[ev.a].name) + '</p><p class="or-msg-t"></p></div>');
    append(el);
    var t = $('.or-msg-t', el), words = ev.text.split(' '), i = 0, my = token;
    announce.textContent = AG[ev.a].name + ': ' + ev.text;
    if (reduce || ev.a === 'you') { t.innerHTML = linkCids(ev.text); return done(reduce ? 260 : 300); }
    t.classList.add('typing');
    (function word() {
      if (my !== token) return;
      i++;
      t.textContent = words.slice(0, i).join(' ');
      if (follow) stream.scrollTop = stream.scrollHeight;
      if (i < words.length) later(word, 42);
      else { t.classList.remove('typing'); t.innerHTML = linkCids(ev.text); done(420); }
    })();
  }

  function showDecision(ev, done) {
    talking('supervisor');
    var door = ev.kind === 'reframe' ? 'Goal' : ev.kind === 'scorer' ? 'Scorer lock' : (ev.door === 'one-way' ? 'One-way door' : 'Two-way door');
    var el = node('or-dec' + (ev.kind === 'scorer' ? ' or-dec-scorer' : ''),
      '<p class="or-dec-to">To: you, AP process owner <span class="or-dec-door">' + esc(door) + '</span></p>' +
      '<p class="or-dec-t">' + esc(ev.title) + '</p><p class="or-dec-b">' + linkCids(ev.body) + '</p>' +
      '<p class="or-dec-btns">' + ev.options.map(function (o, i) { return '<button type="button" class="pill' + (i === 0 ? ' pill-dark' : '') + '" data-dec="' + esc(o.id) + '">' + esc(o.label) + '</button>'; }).join('') + '</p>');
    append(el);
    stream.scrollTop = stream.scrollHeight;
    announce.textContent = 'Decision for you: ' + ev.title;
    setStatus('Waiting for you', 'or-wait');
    var first = $('button', el); if (first && started) first.focus({ preventScroll: true });
    done(0);
  }

  stream.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-dec')) {
      if (!run.waiting) return;
      var card = b.closest('.or-dec');
      $$('button', card).forEach(function (x) { x.disabled = true; x.classList.toggle('chosen', x === b); });
      card.classList.add('answered');
      L.answer(run, b.getAttribute('data-dec'));
      resume();
    }
  });

  /* ---------- metrics, chart, tree ---------- */
  function renderMetrics() {
    var box = $('.or-metrics'), last = hist[hist.length - 1];
    if (!last) { box.innerHTML = '<div class="or-m"><span>Goal</span><b>&ndash;</b><small>Starts when the run starts</small></div>'; return; }
    var gap = Math.abs(last.score - last.real) > (last.goal === 'fpr' ? 1.5 : 0.3);
    box.innerHTML = '<div class="or-m"><span>Score the loop sees</span><b>' + L.fmt(last.score, last.goal) + '</b><small>' + esc(L.GOALS[last.goal].name) + '</small></div>' +
      '<div class="or-m' + (gap ? ' bad' : '') + '"><span>Real outcome</span><b>' + L.fmt(last.real, last.goal) + '</b><small>' + (gap ? 'Diverging from the score' : 'Measured outside the loop') + '</small></div>' +
      '<div class="or-m"><span>Champion</span><b>' + esc(last.champion) + '</b><small>Generation ' + last.gen + '</small></div>';
  }
  function renderChart() {
    var box = $('.or-chart'), last = hist[hist.length - 1];
    if (!last) { box.innerHTML = ''; return; }
    var goal = last.goal, h = hist.filter(function (x) { return x.goal === goal; });
    var W = 320, H = 170, pl = 40, pr = 10, pt = 10, pb = 24, g0 = h[0].gen, n = Math.max(L.MAX_GEN - g0, 4);
    var vals = []; h.forEach(function (x) { vals.push(x.score, x.real); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = Math.max((hi - lo) * 0.2, goal === 'fpr' ? 2 : 0.4); lo -= pad; hi += pad;
    function X(gen) { return pl + (W - pl - pr) * (gen - g0) / n; }
    function Y(v) { return pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo)); }
    var s = '<svg class="or-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(L.GOALS[goal].name) + ' by generation: score and real outcome. Illustrative.">';
    for (var k = 0; k <= 3; k++) { var v = lo + (hi - lo) * k / 3, y = Y(v); s += '<line class="or-gl" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><text class="or-ax" x="' + (pl - 4) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + (goal === 'fpr' ? v.toFixed(0) + '%' : '$' + v.toFixed(1)) + '</text>'; }
    for (var gi = g0; gi <= g0 + n; gi++) s += '<text class="or-ax" x="' + X(gi).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + gi + '</text>';
    function pts(key) { return h.map(function (x, i) { return X(x.gen + (i && x.gen === h[i - 1].gen ? 0.25 : 0)).toFixed(1) + ',' + Y(x[key]).toFixed(1); }).join(' '); }
    s += '<polyline class="or-line-real" points="' + pts('real') + '"/><polyline class="or-line-score" points="' + pts('score') + '"/>';
    if (h.length < 3) h.forEach(function (x) { s += '<circle class="or-dot or-dot-r" r="3" cx="' + X(x.gen).toFixed(1) + '" cy="' + Y(x.real).toFixed(1) + '"/><circle class="or-dot" r="4" cx="' + X(x.gen).toFixed(1) + '" cy="' + Y(x.score).toFixed(1) + '"/>'; });
    h.forEach(function (x) { if (x.note && x.note !== 'Baseline') s += '<text class="or-note" x="' + X(x.gen).toFixed(1) + '" y="' + (pt + 9) + '" text-anchor="middle">' + esc(x.note) + '</text>'; });
    s += '</svg>';
    box.innerHTML = s + '<p class="or-key"><span class="k k-score">Score the loop sees</span><span class="k k-real">Real outcome</span></p><p class="or-key-n">' + esc(L.GOALS[goal].name) + (goal === 'cost' ? ', lower is better' : ', higher is better') + '. Illustrative.</p>';
  }
  function renderTree() {
    var box = $('.or-tree'), maxGen = 0;
    order.forEach(function (id) { maxGen = Math.max(maxGen, vmap[id].gen); });
    if (!order.length) { box.innerHTML = '<p class="or-tree-empty">The archive grows here as the agents work.</p>'; return; }
    var dx = 64, W = 44 + Math.max(maxGen, 6) * dx + 30, H = 132, lin = {};
    if (champ) { var c = champ; while (c) { lin[c.id] = 1; c = c.parent ? vmap[c.parent] : null; } }
    function slot(v) { return v.gen === 0 ? 1 : parseInt(v.id.split('-')[1], 10) - 1; }
    function P(v) { return [30 + v.gen * dx, 22 + slot(v) * 40]; }
    var s = '<svg class="or-tree-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Archive tree, ' + order.length + ' variants">';
    order.forEach(function (id) { var v = vmap[id]; if (!v.parent || !vmap[v.parent]) return; var a = P(vmap[v.parent]), b = P(v), mx = (a[0] + b[0]) / 2; s += '<path class="or-te' + (lin[v.id] && lin[v.parent] ? ' main' : '') + '" d="M' + a[0] + ',' + a[1] + ' C' + mx + ',' + a[1] + ' ' + mx + ',' + b[1] + ' ' + b[0] + ',' + b[1] + '"/>'; });
    order.forEach(function (id) {
      var v = vmap[id], p = P(v), st = v.status;
      var cls = st === 'champion' ? 'champ' : st === 'blocked' ? 'block' : (st === 'pending' || st === 'parked' || st === 'candidate' || st === 'proposed') ? 'pend' : (st === 'retired' || st === 'rejected' || st === 'reverted') ? 'ret' : v.wasChampion ? 'was' : 'arch';
      s += '<g class="or-tn or-tn-' + cls + (v.hack ? ' hack' : '') + (sel === id ? ' sel' : '') + '" data-id="' + id + '" tabindex="0" role="button" aria-label="' + esc(id + ', ' + st + ': ' + v.change) + '"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (st === 'champion' ? 11 : 8) + '"/>' +
        (st === 'blocked' ? '<path class="or-x" d="M' + (p[0] - 4) + ',' + (p[1] - 4) + ' l8,8 M' + (p[0] + 4) + ',' + (p[1] - 4) + ' l-8,8"/>' : '') + (v.breakthrough ? '<text class="or-star" x="' + (p[0] + 9) + '" y="' + (p[1] - 9) + '">&#9733;</text>' : '') + '<title>' + esc(id + ': ' + v.change) + '</title></g>';
    });
    for (var gi = 0; gi <= maxGen; gi++) s += '<text class="or-ax" x="' + (30 + gi * dx) + '" y="' + (H - 4) + '" text-anchor="middle">' + (gi ? 'G' + gi : 'start') + '</text>';
    box.innerHTML = s + '</svg>';
    box.scrollLeft = box.scrollWidth;
  }
  function info(id) {
    sel = id; renderTree();
    var v = vmap[id], chain = [], c = v;
    while (c) { chain.unshift(c); c = c.parent ? vmap[c.parent] : null; }
    $('.or-node-info').innerHTML = '<b>' + esc(v.id) + '</b> ' + esc(v.change) + '. Status: ' + esc(v.status) + '. ' + (v.door === 1 ? 'One-way door. ' : '') + 'Lineage: ' + chain.map(function (x) { return '<span' + (x.hack ? ' class="or-flag"' : '') + '>' + esc(x.id) + '</span>'; }).join(' &rarr; ');
  }
  $('.or-tree').addEventListener('click', function (e) { var n = e.target.closest('.or-tn'); if (n) info(n.getAttribute('data-id')); });
  $('.or-tree').addEventListener('keydown', function (e) { var n = e.target.closest && e.target.closest('.or-tn'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); var id = n.getAttribute('data-id'); info(id); var f = $('.or-tn[data-id="' + id + '"]'); if (f) f.focus(); } });

  /* ---------- controls ---------- */
  function start() {
    if (!started) { started = true; enableInput(true); }
    if (run.done) { reset(); started = true; enableInput(true); }
    playing = true; startBtn.textContent = 'Pause'; startBtn.setAttribute('aria-pressed', 'true');
    if (pending) { var f = pending; pending = null; f(); } else kick();
  }
  function resume() {
    toBottom();
    if (!playing) { playing = true; startBtn.textContent = 'Pause'; startBtn.setAttribute('aria-pressed', 'true'); }
    if (pending) { var f = pending; pending = null; f(); } else kick();
  }
  function pause() { playing = false; startBtn.textContent = 'Resume'; startBtn.setAttribute('aria-pressed', 'false'); setStatus('Paused'); }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var a = b.getAttribute('data-a');
    if (a === 'start') { if (playing) pause(); else start(); }
    else if (a === 'replay') { reset(); start(); }
    else if (b.hasAttribute('data-speed')) { speed = parseInt(b.getAttribute('data-speed'), 10); $$('[data-speed]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }
    else if (a === 'live') { liveOn = !liveOn; b.setAttribute('aria-pressed', String(liveOn)); }
    else if (b.hasAttribute('data-chip')) instruct(b.getAttribute('data-chip'), b.textContent);
  });
  $('.or-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var inp = $('.or-text'), v = inp.value.trim(); if (!v || liveHold) return;
    inp.value = ''; instruct(v, v);
  });
  function scripted(input) { L.instruct(run, input); refreshChips(); resume(); }

  /* ---------- live AI agents ---------- */
  function instruct(input, label) {
    if (liveHold) return;
    if (!liveOn || !Live) return scripted(input);
    label = String(label || input).trim().slice(0, 300);
    var my = token, state = L.liveState(run), group = [], cur = null, usage = null;
    liveHold = true; enableInput(false);
    var you = node('or-msg or-msg-you', who('you') + '<div class="or-msg-b"><p class="or-msg-n">' + esc(AG.you.name) + '</p><p class="or-msg-t"></p></div>');
    $('.or-msg-t', you).textContent = label + (/[.?!]$/.test(label) ? '' : '.');
    append(you); group.push(you); toBottom();
    setStatus('Live agents', 'or-run');
    function bubble(a) {
      if (cur && cur.a === a && !cur.closed) return cur;
      var el = node('or-msg or-msg-' + a + ' or-live', who(a) + '<div class="or-msg-b"><p class="or-msg-n">' + esc(AG[a].name) + ' <span class="or-live-b">LIVE</span></p><p class="or-msg-t typing"></p></div>');
      el.setAttribute('data-a', a);
      append(el); group.push(el); talking(a);
      cur = { a: a, el: el, t: $('.or-msg-t', el), closed: false };
      return cur;
    }
    function finish() {
      liveReq = null; liveHold = false;
      if (my !== token) return;
      enableInput(true); refreshChips(); resume();
    }
    liveReq = Live.ask({ instruction: label, state: state }, {
      delta: function (a, text) { if (my !== token) return; var b = bubble(a); b.t.textContent += text; if (follow) stream.scrollTop = stream.scrollHeight; },
      turn: function (a, text) {
        if (my !== token) return;
        var b = bubble(a); b.t.classList.remove('typing'); b.t.innerHTML = linkCids(text); b.closed = true;
        announce.textContent = AG[a].name + ': ' + text;
      },
      usage: function (u) { usage = u; },
      action: function (type) {
        if (my !== token) return;
        L.note(run, 'you', label);
        group.forEach(function (el) { var a = el.getAttribute('data-a'), t = el.querySelector('.or-msg-t'); if (a && t) L.note(run, a, t.textContent); });
        if (usage) append(node('or-meter', '<span class="or-live-b">LIVE</span> ' + esc(Live.meter(usage))));
        if (type === 'request_decision' && run.waiting) {
          var cards = stream.querySelectorAll('.or-dec:not(.answered)'), card = cards[cards.length - 1];
          if (card) { var btn = $('button', card); if (btn) btn.focus({ preventScroll: true }); }
        }
        if (type === 'none' && L.match(label) === 'lineage') type = 'show_lineage';
        L.applyLive(run, type);
      },
      done: finish,
      fallback: function (reason) {
        liveReq = null; liveHold = false;
        if (my !== token) return;
        group.forEach(function (el) { el.remove(); });
        if (reason === 'visitor_limit' || reason === 'daily_cap' || reason === 'limit') {
          liveOn = false; var tg = $('[data-a="live"]'); if (tg) tg.setAttribute('aria-pressed', 'false');
        }
        append(node('or-note', esc(Live.NOTE)));
        enableInput(true);
        scripted(input);
      }
    });
  }
  function refreshChips() {
    var g = $('[data-chip="goal"]'); if (g && run) g.textContent = 'Reframe the goal to ' + L.GOALS[run.goal === 'cost' ? 'fpr' : 'cost'].name.toLowerCase();
  }

  reset(); refreshChips();
  var wrap = root.closest('.bp-ix'); if (wrap) wrap.hidden = false;
  var st = document.querySelector('[data-lp-static="room"]'); if (st) st.hidden = true;
})();
