/* Decision trace viewer UI. Reads traces in the browser only: no network, no storage. */
(function () {
  'use strict';
  var AE = window.AE, T = AE && AE.trace, root = document.querySelector('[data-tv]');
  if (!T || !root) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cname(id) { var c = AE.controlById && AE.controlById[id]; return c ? c.name : ''; }
  function cid(id) { return AE.controlById && AE.controlById[id] ? '<a class="cid" href="/controls/#' + esc(id) + '">' + esc(id) + '</a>' : '<span class="cid">' + esc(id) + '</span>'; }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function time(t) { return String(t).replace(/^.*T/, '').replace(/Z$/, '').slice(0, 8); }

  var MET = [['actions', 'Actions'], ['auto', 'Auto-committed'], ['routed', 'Routed to a person'], ['blocked', 'Blocked by a control'], ['reversals', 'Reversals'], ['dropped', 'Dropped handoffs']];
  var BAD = { routed: 1, blocked: 1, reversals: 1, dropped: 1 };
  var COLS = [['agent', 'Agent'], ['role', 'Role'], ['level', 'Level'], ['actions', 'Actions'], ['escRate', 'Escalation rate'], ['revRate', 'Reversal rate'], ['blocks', 'Blocks'], ['dropped', 'Dropped handoffs'], ['events', 'Events']];
  var STATUS = { auto: 'Auto-committed', person: 'Decided by a person', blocked: 'Blocked by a control', reversed: 'Reversed', dropped: 'Dropped handoff', open: 'Open' };

  var st = { A: null, B: null, view: 'B', sort: 'actions', dir: -1, caseId: null, filter: '', source: 'sample' };
  function useSample() {
    st.A = { label: 'Baseline', events: T.sample(false) };
    st.B = { label: 'Fault-injected', events: T.sample(true) };
    st.source = 'sample'; st.view = 'B'; st.caseId = null;
  }

  root.innerHTML =
    '<div class="tv-top"><div class="wf-view tv-views" role="group" aria-label="Which run"></div>' +
    '<div class="tv-load"><label class="tv-drop" tabindex="0"><input type="file" accept=".jsonl,.json,.txt,application/json,text/plain" class="tv-file"><span><b>Load your trace</b> Drop a JSONL file here or choose one. Read in your browser only.</span></label>' +
    '<div class="tv-load-btns"><button type="button" class="pill tv-dl">Download the sample</button><button type="button" class="pill pill-ghost tv-reset">Back to the sample</button></div></div></div>' +
    '<p class="tv-status" aria-live="polite"></p>' +
    '<div class="tv-metrics"></div>' +
    '<div class="tv-notes" aria-live="polite"></div>' +
    '<h3 class="tv-h">Agents</h3><div class="fw-table-wrap tv-agents-wrap" tabindex="0" role="region" aria-label="Agents table"></div>' +
    '<h3 class="tv-h">Threads</h3><div class="tv-threads"><div class="tv-cases"><div class="tv-filter" role="group" aria-label="Filter cases"></div><ul class="tv-case-list"></ul></div>' +
    '<div class="tv-thread"><div class="tv-thread-head"><p class="tv-thread-t"></p><button type="button" class="pill tv-replay">Replay</button></div><ol class="tv-events" aria-live="polite"></ol></div></div>';

  var views = $('.tv-views', root);
  function viewButtons() {
    views.innerHTML = '';
    [['A', st.A.label], ['B', st.B.label], ['C', 'Compare']].forEach(function (v) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'seg'; b.textContent = v[1];
      b.setAttribute('aria-pressed', String(st.view === v[0]));
      b.addEventListener('click', function () { st.view = v[0]; st.caseId = null; render(); });
      views.appendChild(b);
    });
  }
  function cur() { return st.view === 'A' ? st.A.events : st.B.events; }

  function render() {
    viewButtons();
    var ev = cur(), m = T.metrics(ev), cmp = st.view === 'C' ? T.compare(st.A.events, st.B.events, cname) : null;
    $('.tv-metrics', root).innerHTML = MET.map(function (k) {
      if (!cmp) return '<div class="tv-m"><b>' + m[k[0]] + '</b><span>' + k[1] + '</span></div>';
      var a = cmp.base[k[0]], b = cmp.run[k[0]], d = b - a, worse = BAD[k[0]] ? d > 0 : d < 0;
      return '<div class="tv-m' + (d ? (worse ? ' tv-worse' : ' tv-better') : '') + '"><b>' + a + ' &rarr; ' + b + '</b><span>' + k[1] + '</span><em>' + (d > 0 ? '+' : '') + d + '</em></div>';
    }).join('') + '<p class="tv-m-note">' + (cmp ? st.A.label + ' to ' + st.B.label + '. ' : '') + m.agents + ' actors, ' + m.cases + ' cases. Auto-committed share ' + pct(cmp ? cmp.run.autoShare : m.autoShare) + '. Illustrative.</p>';
    $('.tv-notes', root).innerHTML = cmp ? '<p class="lf-label">What changed, in plain words</p><ul class="tv-note-list">' + cmp.notes.map(function (n) {
      return '<li class="tv-n tv-n-' + n.sev + '"><b>' + esc(n.title) + '</b><span>' + esc(n.text) + '</span></li>';
    }).join('') + '</ul>' : '';
    agents(ev);
    threads(cmp ? st.B.events : ev);
  }

  function agents(ev) {
    var rows = T.agentTable(ev), base = st.view === 'C' ? T.agentTable(st.A.events) : null;
    rows.sort(function (a, b) { var x = a[st.sort], y = b[st.sort]; if (x == null) x = -1; if (y == null) y = -1; return (x > y ? 1 : x < y ? -1 : 0) * st.dir; });
    function delta(r, k, rate) {
      if (!base) return '';
      var o = base.filter(function (x) { return x.agent === r.agent; })[0]; if (!o) return '';
      var d = r[k] - o[k]; if (Math.abs(d) < 1e-9) return '';
      return ' <small class="' + (d > 0 ? 'tv-up' : 'tv-down') + '">' + (d > 0 ? '+' : '') + (rate ? Math.round(d * 100) + ' pts' : d) + '</small>';
    }
    $('.tv-agents-wrap', root).innerHTML = '<table class="fw-table tv-table"><thead><tr>' + COLS.map(function (c) {
      var s = st.sort === c[0] ? (st.dir > 0 ? 'ascending' : 'descending') : 'none';
      return '<th scope="col" aria-sort="' + s + '"><button type="button" data-k="' + c[0] + '">' + c[1] + '</button></th>';
    }).join('') + '</tr></thead><tbody>' + rows.map(function (r) {
      return '<tr><th scope="row">' + esc(r.agent) + '</th><td>' + esc(r.role) + '</td><td>' + (r.level == null ? '&ndash;' : 'L' + r.level) + delta(r, 'level') + '</td><td>' + r.actions + delta(r, 'actions') + '</td><td>' + (r.actions ? pct(r.escRate) : '&ndash;') + delta(r, 'escRate', 1) + '</td><td>' + (r.actions ? pct(r.revRate) : '&ndash;') + delta(r, 'revRate', 1) + '</td><td>' + r.blocks + delta(r, 'blocks') + '</td><td>' + r.dropped + delta(r, 'dropped') + '</td><td>' + r.events + '</td></tr>';
    }).join('') + '</tbody></table>';
    $$('th button', root).forEach(function (b) {
      b.addEventListener('click', function () { var k = b.dataset.k; if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = k === 'agent' || k === 'role' ? 1 : -1; } agents(cur()); });
    });
  }

  function threads(ev) {
    var cs = T.cases(ev), counts = {};
    cs.forEach(function (c) { counts[c.status] = (counts[c.status] || 0) + 1; });
    var fl = $('.tv-filter', root); fl.innerHTML = '';
    [''].concat(Object.keys(STATUS)).forEach(function (k) {
      if (k && !counts[k]) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'pill';
      b.innerHTML = (k ? esc(STATUS[k]) : 'All') + ' <span>' + (k ? counts[k] : cs.length) + '</span>';
      b.setAttribute('aria-pressed', String(st.filter === k));
      b.addEventListener('click', function () { st.filter = k; st.caseId = null; threads(ev); });
      fl.appendChild(b);
    });
    var shown = cs.filter(function (c) { return !st.filter || c.status === st.filter; });
    if (!shown.some(function (c) { return c.id === st.caseId; })) {
      var pick = shown.filter(function (c) { return c.status !== 'auto'; })[0] || shown[0];
      st.caseId = pick ? pick.id : null;
    }
    var list = $('.tv-case-list', root);
    list.innerHTML = shown.map(function (c) {
      return '<li><button type="button" class="tv-case tv-s-' + c.status + '" aria-pressed="' + (c.id === st.caseId) + '" data-id="' + esc(c.id) + '"><b>' + esc(c.id) + '</b><span>' + esc(STATUS[c.status]) + '</span></button></li>';
    }).join('') || '<li class="muted">No cases with a case ID.</li>';
    $$('.tv-case', list).forEach(function (b) { b.addEventListener('click', function () { st.caseId = b.dataset.id; threads(ev); }); });
    var c = cs.filter(function (x) { return x.id === st.caseId; })[0];
    $('.tv-thread-t', root).innerHTML = c ? '<b>' + esc(c.id) + '</b> &middot; ' + esc(STATUS[c.status]) + ' &middot; ' + c.events.length + ' events' : 'No case selected';
    show(c, false);
  }

  var replayRun = 0;
  function evRow(e) {
    var who = esc(e.agent) + (e.to ? ' &rarr; ' + esc(e.to) : e.target ? ' &rarr; ' + esc(e.target) : '');
    var res = e.result ? '<em class="tv-r tv-r-' + (e.result === 'fail' ? 'fail' : 'pass') + '">' + esc(e.result) + '</em>' : '';
    return '<li class="tv-e tv-e-' + esc(e.type) + '"><span class="tv-e-t">' + esc(time(e.t)) + '</span><span class="tv-e-who">' + who + '</span><span class="tv-e-type">' + esc(e.type) + (e.route ? ' &middot; ' + esc(e.route) : '') + '</span>' +
      '<span class="tv-e-msg">' + esc(e.msg || '') + (e.amount != null ? ' <small>$' + esc(e.amount.toLocaleString('en-US')) + (e.conf != null ? ', confidence ' + esc(e.conf) : '') + '</small>' : '') +
      (e.control ? '<span class="tv-e-ctl">' + cid(e.control) + ' ' + esc(cname(e.control)) + ' ' + res + '</span>' : res) +
      (e.evidence ? '<span class="tv-e-ev">Evidence: ' + esc(e.evidence) + '</span>' : '') + '</span></li>';
  }
  function show(c, animate) {
    var ol = $('.tv-events', root), my = ++replayRun;
    if (!c) { ol.innerHTML = ''; return; }
    if (!animate || reduce) { ol.innerHTML = c.events.map(evRow).join(''); return; }
    ol.innerHTML = '';
    var i = 0;
    (function next() {
      if (my !== replayRun || i >= c.events.length) return;
      ol.insertAdjacentHTML('beforeend', evRow(c.events[i++]));
      ol.scrollTop = ol.scrollHeight;
      setTimeout(next, 380);
    })();
  }
  $('.tv-replay', root).addEventListener('click', function () {
    var c = T.cases(st.view === 'A' ? st.A.events : st.B.events).filter(function (x) { return x.id === st.caseId; })[0];
    show(c, true);
  });

  /* Loading a trace: read locally, never uploaded. */
  var status = $('.tv-status', root);
  function load(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { status.textContent = 'That file is larger than 5 MB. Load a smaller trace.'; return; }
    var rd = new FileReader();
    rd.onload = function () {
      var p = T.parse(rd.result);
      if (!p.events.length) { status.textContent = 'No valid events found. ' + (p.errors[0] ? 'Line ' + p.errors[0].line + ': ' + p.errors[0].error : ''); return; }
      var rs = T.runs(p.events);
      if (rs.length >= 2) { st.A = { label: rs[0], events: T.byRun(p.events, rs[0]) }; st.B = { label: rs[1], events: T.byRun(p.events, rs[1]) }; }
      else { st.A = { label: 'Sample baseline', events: T.sample(false) }; st.B = { label: 'Your trace', events: p.events }; }
      st.view = 'B'; st.caseId = null; st.filter = ''; st.source = 'file';
      status.textContent = 'Loaded ' + p.events.length + ' events from ' + file.name + '.' + (p.errors.length ? ' Skipped ' + p.errors.length + ' lines, for example line ' + p.errors[0].line + ': ' + p.errors[0].error : '') + ' The file stayed in your browser.';
      render();
    };
    rd.onerror = function () { status.textContent = 'The file could not be read.'; };
    rd.readAsText(file);
  }
  var drop = $('.tv-drop', root), input = $('.tv-file', root);
  input.addEventListener('change', function () { load(input.files && input.files[0]); input.value = ''; });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('tv-over'); }); });
  ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('tv-over'); }); });
  drop.addEventListener('drop', function (e) { load(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
  $('.tv-dl', root).addEventListener('click', function () {
    var blob = new Blob([T.toJSONL(T.sample(false)) + T.toJSONL(T.sample(true))], { type: 'application/x-ndjson' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sample-decision-trace.jsonl';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
  $('.tv-reset', root).addEventListener('click', function () { useSample(); status.textContent = 'Showing the illustrative sample.'; render(); });

  useSample();
  render();
  var wrap = root.closest('.bp-ix'); if (wrap) wrap.hidden = false;
})();
