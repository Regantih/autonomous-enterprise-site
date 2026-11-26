/* Questions leaders ask: tabs, numbered rows and seven tools.
   Every number here is illustrative, built on the book's frameworks. Nothing is stored or sent. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function money(n) {
    var a = Math.abs(n), s = n < 0 ? '-$' : '$';
    if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
    if (a >= 1e4) return s + Math.round(a / 1e3) + 'K';
    return s + Math.round(a).toLocaleString('en-US');
  }
  function money2(n) { return '$' + n.toFixed(2); }
  function pct(n, d) { return (n * 100).toFixed(d == null ? 0 : d) + '%'; }
  var uid = 0;
  function id(p) { uid += 1; return 'ld-' + p + '-' + uid; }
  function slider(key, label, min, max, step, val, fmt) {
    var i = id(key);
    return '<label class="ix-sl" for="' + i + '">' + label + ' <output data-o="' + key + '"></output>' +
      '<input id="' + i + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" data-k="' + key + '" data-f="' + (fmt || '') + '"></label>';
  }
  function fmtVal(v, f) {
    if (f === 'money') return money(v);
    if (f === 'money2') return money2(v);
    if (f === 'pct') return v + '%';
    if (f === 'pct1') return (+v).toFixed(1) + '%';
    if (f === 'num') return (+v).toLocaleString('en-US');
    return String(v);
  }
  function bindSliders(root, cb) {
    function upd() {
      $$('input[type="range"]', root).forEach(function (i) {
        var o = $('[data-o="' + i.dataset.k + '"]', root); if (o) o.textContent = fmtVal(+i.value, i.dataset.f);
      });
      cb();
    }
    $$('input, select', root).forEach(function (i) { i.addEventListener('input', upd); i.addEventListener('change', upd); });
    upd();
  }
  function val(root, k) { var i = $('[data-k="' + k + '"]', root); if (!i) return 0; return i.type === 'checkbox' ? i.checked : (i.tagName === 'SELECT' ? i.value : +i.value); }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* Book rule: materiality x reversibility sets the default ceiling (upper bound of each cell). */
  var CEIL = { low: { easy: 4, hard: 3, irr: 2 }, med: { easy: 3, hard: 2, irr: 2 }, high: { easy: 2, hard: 2, irr: 1 } };
  function ceilingOf(c) {
    if (c.dna) return 0;
    var l = CEIL[c.mat][c.rev];
    if (!c.data) l = Math.min(l, 2);
    if (c.reg) l = Math.min(l, 2);
    if (c.ext) l = Math.max(0, l - 1);
    return l;
  }

  /* ---------- 1. Funding calculator: staged gates ---------- */
  function funding(root) {
    root.innerHTML =
      '<p class="ix-cap">Size a staged portfolio. Each gate releases the next tranche only when its scorecard passes.</p>' +
      '<div class="ld-grid2">' +
        '<fieldset class="ld-fs"><legend>Portfolio</legend>' +
          slider('w', 'Workflows in the portfolio', 2, 20, 1, 8) +
          slider('v', 'Completed outcomes per workflow per month', 500, 20000, 500, 4000, 'num') +
          slider('share', 'Share of volume the agent completes at scale', 10, 90, 5, 60, 'pct') +
        '</fieldset>' +
        '<fieldset class="ld-fs"><legend>Unit economics</legend>' +
          slider('ch', 'Cost per completed outcome today', 2, 60, 0.5, 14, 'money2') +
          slider('ca', 'Cost per completed outcome with the agent (meters, model, review, fallback)', 0.5, 40, 0.5, 4.5, 'money2') +
        '</fieldset>' +
        '<fieldset class="ld-fs"><legend>Investment</legend>' +
          slider('h', 'Shared harness build (one time)', 200000, 5000000, 50000, 1200000, 'money') +
          slider('d', 'Data readiness per workflow', 0, 1000000, 10000, 150000, 'money') +
          slider('b', 'Agent build and evaluation per workflow', 20000, 1000000, 10000, 180000, 'money') +
          slider('c', 'Change and training per workflow', 0, 500000, 10000, 80000, 'money') +
        '</fieldset>' +
      '</div>' +
      '<div class="ld-split" aria-hidden="true"></div><ul class="ld-legend"></ul>' +
      '<ol class="ld-gates"></ol>' +
      '<div class="ld-kpis"></div>' +
      '<p class="ix-result ld-out" aria-live="polite"></p>' +
      '<p class="ld-fine">Illustrative model. Reuse lowers the cost of later waves by 20%. The harness runs at 20% of its build cost each year. Replace every input with your own baseline.</p>';
    var gatesEl = $('.ld-gates', root), split = $('.ld-split', root), legend = $('.ld-legend', root), kpis = $('.ld-kpis', root), out = $('.ld-out', root);
    function calc() {
      var W = val(root, 'w'), V = val(root, 'v'), share = val(root, 'share') / 100, ch = val(root, 'ch'), ca = val(root, 'ca');
      var H = val(root, 'h'), D = val(root, 'd'), B = val(root, 'b'), C = val(root, 'c');
      var pilots = Math.min(2, W), wave2 = Math.min(2, Math.max(0, W - 2)), rest = Math.max(0, W - 4), reuse = 0.8;
      var g = [
        { name: 'Gate 0 · Mobilize', months: 'Months 1&ndash;3', data: 0, harness: 0.15 * H, agents: 0, change: 0.25 * C * pilots,
          what: 'Charter, team, baselines, architecture decisions, first shadow agents.',
          release: 'Baselines signed. Owners named. Do-not-automate list drafted.' },
        { name: 'Gate 1 · Foundation and pilots', months: 'Months 4&ndash;13', data: D * pilots, harness: 0.6 * H, agents: B * pilots, change: 0.75 * C * pilots,
          what: 'Data gates, registry, identity, gateways, kill switch. ' + pilots + ' pilot workflow' + (pilots > 1 ? 's' : '') + ' to L2.',
          release: 'Harness live and kill switch tested. Pilots at L2 with evidence in view.' },
        { name: 'Gate 2 · First go-live', months: 'Months 14&ndash;19', data: D * wave2, harness: 0.25 * H, agents: B * wave2, change: C * wave2,
          what: 'Pilots promoted to L3 where evidence allows. ' + wave2 + ' more workflow' + (wave2 === 1 ? '' : 's') + ' in shadow.',
          release: 'Value signal rising faster than risk for two months. Audit sign-off on L3 steps.' },
        { name: 'Gate 3 · Scale', months: 'Months 20&ndash;30', data: D * rest * reuse, harness: 0, agents: B * rest * reuse, change: C * rest * reuse,
          what: rest + ' more workflow' + (rest === 1 ? '' : 's') + ' on the shared harness. Retire old interfaces.',
          release: 'Reuse rule met. No open finding above medium. Cost per completed outcome below plan.' }
      ];
      var tot = { data: 0, harness: 0, agents: 0, change: 0 };
      g.forEach(function (x) { x.total = x.data + x.harness + x.agents + x.change; ['data', 'harness', 'agents', 'change'].forEach(function (k) { tot[k] += x[k]; }); });
      var total = tot.data + tot.harness + tot.agents + tot.change;
      var parts = [['data', 'Data', 'ld-c1'], ['harness', 'Harness', 'ld-c2'], ['agents', 'Agents', 'ld-c3'], ['change', 'Change and training', 'ld-c4']];
      split.innerHTML = ''; legend.innerHTML = '';
      parts.forEach(function (p) {
        var s = el('span', p[2]); s.style.width = (total ? tot[p[0]] / total * 100 : 0) + '%'; split.appendChild(s);
        legend.appendChild(el('li', p[2], '<i></i>' + p[1] + ' <b>' + money(tot[p[0]]) + '</b> <small>' + pct(total ? tot[p[0]] / total : 0) + '</small>'));
      });
      gatesEl.innerHTML = '';
      var cum = 0;
      g.forEach(function (x, i) {
        cum += x.total;
        gatesEl.appendChild(el('li', 'ld-gate', '<p class="ld-gate-n">' + x.name + '</p><p class="ld-gate-m">' + x.months + '</p>' +
          '<p class="ld-gate-amt">' + money(x.total) + '</p><p class="ld-gate-cum">Cumulative ' + money(cum) + '</p>' +
          '<p class="ld-gate-w">' + x.what + '</p><p class="ld-gate-r"><b>Releases the next tranche when:</b> ' + x.release + '</p>'));
      });
      var saving = ch - ca, annual = W * V * 12 * share * saving, runCost = 0.2 * H;
      var net = annual - runCost, payback = net > 0 ? total / net : null;
      kpis.innerHTML =
        '<div><span>Total over 30 months</span><b>' + money(total) + '</b></div>' +
        '<div><span>Run-rate value per year at scale</span><b>' + money(annual) + '</b></div>' +
        '<div><span>Harness run cost per year</span><b>' + money(runCost) + '</b></div>' +
        '<div><span>Simple payback after scale</span><b>' + (payback ? payback.toFixed(1) + ' yrs' : 'None') + '</b></div>';
      var dataShare = total ? (tot.data + tot.harness) / total : 0, msg;
      if (saving <= 0) msg = '<b>No case yet.</b> The agent costs more per completed outcome than today. Fix review time and fallback share before you fund agents.';
      else if (dataShare < 0.4) msg = '<b>Agents-first warning.</b> Only ' + pct(dataShare) + ' goes to data and the harness. A board that funds agents first and data second pays twice.';
      else if (payback && payback > 4) msg = '<b>Thin case.</b> Payback is over four years. Count speed, cash and penalties avoided, or narrow to the strongest steps.';
      else msg = '<b>Fund Gate 0 and Gate 1 only.</b> Commit ' + money(g[0].total + g[1].total) + ' now. Release the rest when each scorecard passes.';
      out.innerHTML = msg;
    }
    bindSliders(root, calc);
  }

  /* ---------- 2. What-to-fund prioritizer ---------- */
  function prioritizer(root) {
    var rows = [
      { name: 'Customer dispute credits', value: 4, feas: 4, mat: 'low', rev: 'easy', data: true, reg: false, ext: false, dna: false },
      { name: 'Supplier invoice exceptions', value: 5, feas: 4, mat: 'med', rev: 'easy', data: true, reg: false, ext: false, dna: false },
      { name: 'Account reconciliations', value: 3, feas: 4, mat: 'low', rev: 'easy', data: true, reg: true, ext: false, dna: false },
      { name: 'Service voice line triage', value: 4, feas: 3, mat: 'low', rev: 'hard', data: true, reg: false, ext: true, dna: false },
      { name: 'Predictive maintenance work orders', value: 4, feas: 2, mat: 'med', rev: 'hard', data: false, reg: false, ext: false, dna: false },
      { name: 'Demand plan adjustments', value: 5, feas: 3, mat: 'high', rev: 'easy', data: true, reg: false, ext: false, dna: false },
      { name: 'Supplier bank-detail changes', value: 3, feas: 4, mat: 'high', rev: 'irr', data: true, reg: false, ext: true, dna: true }
    ];
    root.innerHTML =
      '<p class="ix-cap">Score candidate decision steps. The tool applies the book&rsquo;s ceiling rules and builds a ranked portfolio and a wave plan.</p>' +
      '<div class="ld-cands"></div>' +
      '<form class="ld-add"><label>Add a candidate step <input type="text" maxlength="60" placeholder="For example: freight claim approvals" required></label><button type="submit" class="btn btn-dark">Add</button></form>' +
      '<div class="ld-pr-out" aria-live="polite"></div>' +
      '<p class="ld-fine">Score = value &times; feasibility &times; ceiling, scaled to 100. Ceiling uses materiality and reversibility, then the modifiers: a failed data gate or regulation caps it at L2; an external commitment lowers it one level for 90 days. Illustrative.</p>';
    var list = $('.ld-cands', root), outEl = $('.ld-pr-out', root);
    function opt(v, cur, label) { return '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + label + '</option>'; }
    function sel(i, k, cur, opts, label) {
      var sid = id('p' + k);
      return '<label for="' + sid + '"><span>' + label + '</span><select id="' + sid + '" data-i="' + i + '" data-f="' + k + '">' + opts.map(function (o) { return opt(o[0], cur, o[1]); }).join('') + '</select></label>';
    }
    function chk(i, k, cur, label) { return '<label class="ld-ck"><input type="checkbox" data-i="' + i + '" data-f="' + k + '"' + (cur ? ' checked' : '') + '> ' + label + '</label>'; }
    var five = [[1, '1 low'], [2, '2'], [3, '3'], [4, '4'], [5, '5 high']];
    function drawCards() {
      list.innerHTML = '';
      rows.forEach(function (r, i) {
        var card = el('div', 'ld-cand');
        card.innerHTML = '<div class="ld-cand-h"><b>' + esc(r.name) + '</b><span class="ld-badge" data-badge="' + i + '"></span>' +
          '<button type="button" class="ld-x" data-rm="' + i + '" aria-label="Remove ' + esc(r.name) + '">&times;</button></div>' +
          '<div class="ld-cand-f">' +
          sel(i, 'value', r.value, five, 'Value') + sel(i, 'feas', r.feas, five, 'Feasibility') +
          sel(i, 'mat', r.mat, [['low', 'Low'], ['med', 'Medium'], ['high', 'High or regulatory']], 'Materiality') +
          sel(i, 'rev', r.rev, [['easy', 'Easy to reverse'], ['hard', 'Hard to reverse'], ['irr', 'Irreversible']], 'Reversibility') +
          '</div><div class="ld-cand-c">' +
          chk(i, 'data', r.data, 'Data passes its quality gate') + chk(i, 'reg', r.reg, 'Regulated or key control') +
          chk(i, 'ext', r.ext, 'Commits to a third party') + chk(i, 'dna', r.dna, 'On the do-not-automate list') + '</div>';
        list.appendChild(card);
      });
    }
    function score(r) { var c = ceilingOf(r); return { c: c, s: Math.round(r.value * r.feas * c / 100 * 100) }; }
    function result() {
      var scored = rows.map(function (r, i) { var x = score(r); return { r: r, i: i, c: x.c, s: x.s }; });
      scored.forEach(function (x) { var b = $('[data-badge="' + x.i + '"]', root); if (b) { b.textContent = x.r.dna ? 'People only' : 'Ceiling L' + x.c; b.className = 'ld-badge ld-l' + x.c; } });
      var human = [], fix = [], live = [];
      scored.forEach(function (x) { if (x.r.dna || x.c <= 1) human.push(x); else if (x.r.feas <= 2 || !x.r.data) fix.push(x); else live.push(x); });
      live.sort(function (a, b) { return b.s - a.s; });
      var w1 = [], w2 = [], w3 = [];
      live.forEach(function (x) {
        if (w1.length < 3 && x.c >= 3 && x.s >= 30) w1.push(x);
        else if (w2.length < 3) w2.push(x); else w3.push(x);
      });
      var ranked = scored.slice().sort(function (a, b) { return b.s - a.s; });
      var h = '<h4 class="ld-h">Ranked portfolio</h4><ol class="ld-rank">';
      ranked.forEach(function (x) {
        h += '<li><span class="ld-rank-n">' + esc(x.r.name) + '</span><span class="ld-bar"><i data-w="' + x.s + '"></i></span><b>' + x.s + '</b><small>' + (x.r.dna ? 'People only' : 'L' + x.c) + '</small></li>';
      });
      h += '</ol><h4 class="ld-h">Wave plan</h4><div class="ld-waves">';
      function wave(title, sub, arr, cls, empty) {
        return '<div class="ld-wave ' + cls + '"><p class="ld-wave-t">' + title + '</p><p class="ld-wave-s">' + sub + '</p><ul>' +
          (arr.length ? arr.map(function (x) { return '<li>' + esc(x.r.name) + '</li>'; }).join('') : '<li class="ld-empty">' + empty + '</li>') + '</ul></div>';
      }
      h += wave('Wave 1', 'Months 4&ndash;13. Shadow, then L2, then L3 on evidence.', w1, 'ld-w1', 'No step reaches L3 yet. Fix data or handoffs first.');
      h += wave('Wave 2', 'Months 14&ndash;19. Reuse the Wave 1 harness.', w2, 'ld-w2', 'None yet.');
      h += wave('Wave 3', 'Months 20&ndash;30. Scale and retire interfaces.', w3, 'ld-w3', 'None yet.');
      h += wave('Fix foundations first', 'Fund the data gate or the weakest handoff before the agent.', fix, 'ld-wf', 'Nothing blocked.');
      h += wave('Keep human-led', 'Agents may investigate and draft. People decide.', human, 'ld-wh', 'Nothing here.');
      h += '</div>';
      outEl.innerHTML = h;
      $$('.ld-bar i', outEl).forEach(function (b) { b.style.width = b.dataset.w + '%'; });
    }
    list.addEventListener('change', function (e) {
      var t = e.target, i = +t.dataset.i, f = t.dataset.f; if (!f || !rows[i]) return;
      rows[i][f] = t.type === 'checkbox' ? t.checked : (f === 'value' || f === 'feas' ? +t.value : t.value);
      result();
    });
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]'); if (!b) return;
      rows.splice(+b.dataset.rm, 1); drawCards(); result();
      var first = $('select', list); if (first) first.focus();
    });
    $('.ld-add', root).addEventListener('submit', function (e) {
      e.preventDefault(); var inp = $('input', e.target), name = inp.value.trim(); if (!name) return;
      rows.push({ name: name, value: 3, feas: 3, mat: 'low', rev: 'easy', data: true, reg: false, ext: false, dna: false });
      inp.value = ''; drawCards(); result();
      var cards = $$('.ld-cand', list); var s = $('select', cards[cards.length - 1]); if (s) s.focus();
    });
    drawCards(); result();
  }

  /* ---------- 3. Governance RACI generator ---------- */
  function raci(root) {
    var ROLES = ['Board', 'CEO', 'CFO', 'CIO', 'Risk and audit', 'Process owner', 'Agent owner'];
    var KEYS = ['board', 'ceo', 'cfo', 'cio', 'risk', 'po', 'ao'];
    root.innerHTML =
      '<p class="ix-cap">Generate decision rights for the program. Change the operating model and the ambition.</p>' +
      '<div class="ld-grid3">' +
        '<label><span>Operating model</span><select data-k="model"><option value="central">Central team</option><option value="hub" selected>Hub and spoke</option><option value="fed">Federated</option></select></label>' +
        '<label><span>Highest autonomy in scope</span><select data-k="amb"><option value="2">Up to L2</option><option value="3" selected>Up to L3</option><option value="4">L4 for selected chains</option></select></label>' +
        '<label class="ld-ck ld-ck-pad"><input type="checkbox" data-k="reg"> Regulated industry or high-risk uses in scope</label>' +
      '</div>' +
      '<div class="ld-tablewrap" tabindex="0" role="region" aria-label="RACI table, scroll sideways for more"><table class="ld-raci"><caption class="visually-hidden">Governance RACI. R responsible, A accountable, C consulted, I informed.</caption><thead></thead><tbody></tbody></table></div>' +
      '<ul class="ld-raci-key"><li><b class="ld-r-A">A</b> Accountable: one per decision</li><li><b class="ld-r-R">R</b> Responsible: does the work</li><li><b class="ld-r-C">C</b> Consulted before</li><li><b class="ld-r-I">I</b> Informed after</li></ul>' +
      '<div class="ix-result ld-raci-out" aria-live="polite"></div>' +
      '<p class="cta-row"><button type="button" class="btn btn-dark ld-csv">Download as CSV</button></p>' +
      '<p class="ld-fine">A starting point for your charter. Adjust it with your board and internal audit. Illustrative.</p>';
    function rows(model, amb, reg) {
      var run = model === 'central' ? 'cio' : (model === 'fed' ? 'po' : 'po');
      var hubC = model === 'hub' ? 'cio' : null;
      var R = [];
      function add(d, m) { R.push({ d: d, m: m }); }
      add('Set the charter and risk appetite', { board: reg ? 'A' : 'C', ceo: reg ? 'R' : 'A', cfo: 'C', cio: 'C', risk: 'C', po: 'I', ao: 'I' });
      add('Approve the portfolio and funding gates', { board: 'I', ceo: 'C', cfo: 'A', cio: 'R', risk: 'C', po: 'R', ao: 'I' });
      add('Set policy limits: amount, confidence, counterparty', { cfo: 'A', risk: 'C', po: 'R', cio: 'C', ao: 'I' });
      add('Approve actions above limits (decision cards)', { po: 'A', ao: 'I', risk: 'I' });
      add('Change an agent&rsquo;s instructions, tools or limits', model === 'fed' ? { ao: 'A', cio: 'C', po: 'C', risk: 'C' } : { cio: 'A', ao: 'R', po: 'C', risk: 'C' });
      add('Promote a step from L2 to L3', { po: 'A', ao: 'R', risk: 'C', cio: 'C', cfo: reg ? 'C' : 'I' });
      if (+amb >= 4) add('Promote a chain to L4', { board: 'A', ceo: 'R', cfo: 'C', cio: 'C', risk: 'C', po: 'R', ao: 'C' });
      add('Pull the kill switch', { po: 'A', ao: 'R', cio: 'R', risk: 'I', ceo: 'I' });
      add('Maintain the do-not-automate list', { ceo: 'A', risk: 'R', po: 'C', cfo: 'C', board: 'I' });
      add('Run the shared harness and agent register', { cio: 'A', ao: 'C', risk: 'C', po: 'I' });
      add('Review the monthly value&ndash;risk scorecard', { cfo: 'A', po: 'R', ao: 'R', cio: 'C', risk: 'C', ceo: 'I', board: model === 'central' ? 'I' : null });
      add('Respond to an audit or regulator finding', { risk: 'A', po: 'R', ao: 'R', cio: 'C', cfo: 'C', board: reg ? 'I' : null });
      if (hubC) R.forEach(function (r) { if (!r.m.cio && !/above limits|every agent action/.test(r.d)) r.m.cio = 'C'; });
      if (+amb <= 2) R = R.filter(function (r) { return r.d.indexOf('L2 to L3') < 0; }).concat([{ d: 'Approve every agent action (L2)', m: { po: 'A', ao: 'R', risk: 'I' } }]);
      if (run === 'cio') R.forEach(function (r) { if (r.d.indexOf('portfolio') >= 0) { r.m.cio = 'R'; r.m.po = 'C'; } });
      return R;
    }
    var thead = $('thead', root), tbody = $('tbody', root), outEl = $('.ld-raci-out', root), current = [];
    function draw() {
      current = rows(val(root, 'model'), val(root, 'amb'), val(root, 'reg'));
      thead.innerHTML = '<tr><th scope="col">Decision</th>' + ROLES.map(function (r) { return '<th scope="col">' + r + '</th>'; }).join('') + '</tr>';
      tbody.innerHTML = current.map(function (r) {
        return '<tr><th scope="row">' + r.d + '</th>' + KEYS.map(function (k) { var v = r.m[k]; return '<td>' + (v ? '<b class="ld-r-' + v + '">' + v + '</b>' : '<span class="ld-dash" aria-label="none">&ndash;</span>') + '</td>'; }).join('') + '</tr>';
      }).join('');
      var oneA = current.every(function (r) { return KEYS.filter(function (k) { return r.m[k] === 'A'; }).length === 1; });
      var approve = current.find(function (r) { return /above limits|every agent action/.test(r.d); });
      var change = current.find(function (r) { return /instructions, tools/.test(r.d); });
      var approver = approve ? KEYS.filter(function (k) { return approve.m[k] === 'A' || approve.m[k] === 'R'; }) : [];
      var changer = change ? KEYS.filter(function (k) { return change.m[k] === 'A' || change.m[k] === 'R'; }) : [];
      var sod = !approver.some(function (k) { return changer.indexOf(k) >= 0; });
      outEl.innerHTML = '<ul class="ld-checks">' +
        '<li class="' + (oneA ? 'ok' : 'warn') + '">' + (oneA ? 'One accountable role per decision.' : 'A decision has more or fewer than one A. Fix it.') + '</li>' +
        '<li class="' + (sod ? 'ok' : 'warn') + '">' + (sod ? 'Segregation of duties holds: the people who approve actions do not change limits, instructions or tools.' : 'Segregation of duties conflict: one role both approves actions and changes the agent.') + '</li>' +
        '<li class="ok">Accountability sits with executives, never with a model or a vendor.</li>' +
        (+val(root, 'amb') >= 4 ? '<li class="warn">L4 needs board-level risk acceptance for each chain.</li>' : '') + '</ul>';
    }
    $('.ld-csv', root).addEventListener('click', function () {
      function plain(s) { return s.replace(/&rsquo;/g, "'").replace(/&ndash;/g, '-').replace(/"/g, '""'); }
      var csv = '"Decision",' + ROLES.map(function (r) { return '"' + r + '"'; }).join(',') + '\n' +
        current.map(function (r) { return '"' + plain(r.d) + '",' + KEYS.map(function (k) { return '"' + (r.m[k] || '') + '"'; }).join(','); }).join('\n') + '\n';
      download('agent-program-raci.csv', csv, 'text/csv');
    });
    $$('select, input', root).forEach(function (i) { i.addEventListener('change', draw); });
    draw();
  }

  /* ---------- 4. Hire-and-upskill planner ---------- */
  function planner(root) {
    var ROLES = [
      { k: 'ao', name: 'Agent owner', does: 'Owns outcomes for an agent family. Sets limits with risk. Can stop the agent.', from: 'Process experts and team leads', inside: 1.0,
        n: function (w) { return Math.ceil(w / 2); } },
      { k: 'he', name: 'Harness engineer', does: 'Builds identity, gateways, policy checks, traces and the kill switch.', from: 'Integration and platform engineers', inside: 0.6,
        n: function (w) { return 2 + Math.ceil(w / 3); } },
      { k: 'ee', name: 'Evaluation engineer', does: 'Builds test sets, online evaluations and drift monitors. Gates every release.', from: 'Test analysts and data analysts', inside: 0.6,
        n: function (w) { return Math.max(1, Math.ceil(w / 4)); } },
      { k: 'pr', name: 'Process redesigner', does: 'Maps decisions, applies ceiling rules and redesigns handoffs.', from: 'Process excellence and lean leads', inside: 0.9,
        n: function (w, nw) { return Math.max(1, Math.ceil(nw / 2)); } },
      { k: 'rl', name: 'AI risk lead', does: 'Owns the control library, framework mapping and incident review.', from: 'Internal audit, compliance and model risk', inside: 0.8,
        n: function (w) { return 1 + Math.floor(w / 10); } }
    ];
    root.innerHTML =
      '<p class="ix-cap">Plan the five roles for 12 and 24 months. Fill from inside where a path exists.</p>' +
      '<div class="ld-grid2">' +
        '<fieldset class="ld-fs"><legend>Scope</legend>' +
          slider('w12', 'Workflows live or in build at 12 months', 1, 20, 1, 4) +
          slider('w24', 'Workflows live or in build at 24 months', 1, 40, 1, 10) +
          slider('staff', 'People in affected operations teams', 10, 2000, 10, 150, 'num') +
        '</fieldset>' +
        '<fieldset class="ld-fs"><legend>Sourcing</legend>' +
          slider('inside', 'Fill from inside where a path exists', 0, 100, 5, 70, 'pct') +
          '<p class="ld-fine">Agent owners come from the business. Harness and evaluation skills are harder to grow fast.</p>' +
        '</fieldset>' +
      '</div>' +
      '<div class="ld-tablewrap" tabindex="0" role="region" aria-label="Role plan, scroll sideways for more"><table class="ld-plan"><caption class="visually-hidden">Role plan at 12 and 24 months</caption><thead><tr><th scope="col">Role</th><th scope="col">What they do</th><th scope="col">12 months</th><th scope="col">24 months</th><th scope="col">From inside / hire (24 mo)</th><th scope="col">Best internal source</th></tr></thead><tbody></tbody></table></div>' +
      '<div class="ld-kpis ld-plan-k"></div>' +
      '<h4 class="ld-h">Reskilling paths</h4>' +
      '<ol class="ld-paths">' +
        '<li><b>Process expert or team lead &rarr; Agent owner</b><span>Owning outcomes, reading the scorecard, setting limits with risk.</span><em>About 3 months</em></li>' +
        '<li><b>Integration or platform engineer &rarr; Harness engineer</b><span>Agent identity, tool and model gateways, policy as code, decision traces.</span><em>About 6 months</em></li>' +
        '<li><b>Test or data analyst &rarr; Evaluation engineer</b><span>Test sets, online evaluations, calibration and drift.</span><em>About 6 months</em></li>' +
        '<li><b>Process excellence lead &rarr; Process redesigner</b><span>Decision mapping, ceiling rules, handoff design.</span><em>About 3 months</em></li>' +
        '<li><b>Internal auditor &rarr; AI risk lead</b><span>Control library, framework mapping, incident review.</span><em>About 6 months</em></li>' +
        '<li><b>Operations analyst &rarr; Exception specialist</b><span>Reading decision cards, override reasons, hard cases.</span><em>About 1 month</em></li>' +
      '</ol>' +
      '<p class="ix-result ld-plan-out" aria-live="polite"></p>' +
      '<p class="ld-fine">Ratios and times are illustrative: one agent owner per two workflows, two core harness engineers plus one per three workflows, one evaluation engineer per four workflows, one process redesigner per two new workflows, one AI risk lead plus one per ten workflows.</p>';
    var tbody = $('tbody', root), k = $('.ld-plan-k', root), outEl = $('.ld-plan-out', root);
    function calc() {
      var w12 = val(root, 'w12'), w24 = Math.max(val(root, 'w24'), w12), staff = val(root, 'staff'), s = val(root, 'inside') / 100;
      var t12 = 0, t24 = 0, tin = 0, thire = 0;
      tbody.innerHTML = ROLES.map(function (r) {
        var a = r.n(w12, w12), b = Math.max(a, r.n(w24, w24 - w12)), inn = Math.round(b * Math.min(1, r.inside * s)), hire = b - inn;
        t12 += a; t24 += b; tin += inn; thire += hire;
        return '<tr><th scope="row">' + r.name + '</th><td>' + r.does + '</td><td class="ld-num">' + a + '</td><td class="ld-num">' + b + '</td><td class="ld-num">' + inn + ' / ' + hire + '</td><td>' + r.from + '</td></tr>';
      }).join('');
      k.innerHTML = '<div><span>Roles at 12 months</span><b>' + t12 + '</b></div><div><span>Roles at 24 months</span><b>' + t24 + '</b></div>' +
        '<div><span>From inside</span><b>' + tin + '</b></div><div><span>External hires</span><b>' + thire + '</b></div>';
      outEl.innerHTML = 'Train all <b>' + staff + '</b> people in affected teams to read decision cards in year one. ' +
        (thire > tin ? 'You plan to hire more than you grow. Start reskilling paths now; they take three to six months.' : 'Most roles come from inside. Start the six-month paths first: harness, evaluation and risk.');
    }
    bindSliders(root, calc);
  }

  /* ---------- 5. Trust ladder ---------- */
  function trust(root) {
    var STEPS = {
      '12': { title: 'L1 &rarr; L2', from: 1, to: 2, nums: [
          { k: 'acc', label: 'Suggestions accepted', min: 0, max: 100, step: 1, v: 84, f: 'pct', ok: function (x) { return x >= 80; }, need: 'at least 80%' },
          { k: 'wk', label: 'Weeks of evidence', min: 0, max: 26, step: 1, v: 5, ok: function (x) { return x >= 4; }, need: 'at least 4 weeks' }],
        checks: ['Agent identity and permissions in place', 'Decision card shows evidence, rule and confidence', 'Approvers trained'] },
      '23': { title: 'L2 &rarr; L3', from: 2, to: 3, nums: [
          { k: 'ae', label: 'Approved without edits', min: 70, max: 100, step: 0.5, v: 96, f: 'pct1', ok: function (x) { return x >= 95; }, need: 'at least 95%' },
          { k: 'n', label: 'Actions observed', min: 0, max: 5000, step: 50, v: 1400, f: 'num', ok: function (x) { return x >= 1000; }, need: 'at least 1,000' },
          { k: 'mo', label: 'Months of evidence', min: 0, max: 12, step: 1, v: 3, ok: function (x) { return x >= 3; }, need: 'at least 3 months' },
          { k: 'rv', label: 'Reversal rate', min: 0, max: 3, step: 0.1, v: 0.4, f: 'pct1', ok: function (x) { return x < 0.5; }, need: 'below 0.5%' }],
        checks: ['Evidence includes a quarter-end', 'Limits enforced outside the model', 'Kill switch tested', 'Decision trace complete for every action', 'Internal audit sign-off'] },
      '34': { title: 'L3 &rarr; L4', from: 3, to: 4, nums: [
          { k: 'qe', label: 'Quarter-ends at L3', min: 0, max: 6, step: 1, v: 1, ok: function (x) { return x >= 2; }, need: 'at least 2' },
          { k: 'er', label: 'In-limit error rate (agent)', min: 0, max: 5, step: 0.1, v: 0.6, f: 'pct1', ok: null, need: '' },
          { k: 'hb', label: 'Human baseline error rate', min: 0, max: 5, step: 0.1, v: 0.9, f: 'pct1', ok: null, need: '' }],
        checks: ['Strong control score', 'Escalations handled within service level', 'Drift monitoring live', 'Board or executive risk acceptance recorded'] }
    };
    root.innerHTML =
      '<p class="ix-cap">Check the evidence for one promotion. A named person still signs. Promotion is never automatic.</p>' +
      '<div class="ld-ladder" aria-hidden="true">' + [0, 1, 2, 3, 4, 5].map(function (l) { return '<span data-l="' + l + '">L' + l + '</span>'; }).join('') + '</div>' +
      '<div class="ld-seg" role="group" aria-label="Choose a promotion"></div>' +
      '<div class="ld-trust-body"></div>' +
      '<div class="ix-result ld-trust-out" aria-live="polite"></div>' +
      '<p class="ld-fine"><b>Automatic demotion triggers:</b> an error above threshold, a failed data-quality gate, a change in the process or the model, or an audit finding. Thresholds are the book&rsquo;s illustrative figures.</p>';
    var seg = $('.ld-seg', root), body = $('.ld-trust-body', root), outEl = $('.ld-trust-out', root), cur = '23';
    Object.keys(STEPS).forEach(function (key) {
      var b = el('button', 'ld-segb', STEPS[key].title + '<span class="visually-hidden"> promotion</span>'); b.type = 'button'; b.dataset.key = key;
      b.addEventListener('click', function () { cur = key; draw(); }); seg.appendChild(b);
    });
    function draw() {
      var s = STEPS[cur];
      $$('.ld-segb', seg).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.key === cur)); });
      $$('.ld-ladder span', root).forEach(function (sp) { var l = +sp.dataset.l; sp.className = l === s.from ? 'from' : (l === s.to ? 'to' : (l < s.from ? 'past' : '')); });
      body.innerHTML = '<div class="ld-grid2"><div>' + s.nums.map(function (n) { return slider(n.k, n.label + (n.need ? ' <small>(' + n.need + ')</small>' : ''), n.min, n.max, n.step, n.v, n.f); }).join('') + '</div>' +
        '<fieldset class="ld-fs"><legend>Evidence on file</legend>' + s.checks.map(function (c, i) { return '<label class="ld-ck"><input type="checkbox" data-k="c' + i + '"' + (i < s.checks.length - 1 ? ' checked' : '') + '> ' + c + '</label>'; }).join('') + '</fieldset></div>';
      bindSliders(body, function () { judge(s); });
    }
    function judge(s) {
      var miss = [];
      s.nums.forEach(function (n) { if (n.ok && !n.ok(val(body, n.k))) miss.push(n.label + ': needs ' + n.need); });
      if (cur === '34' && !(val(body, 'er') < val(body, 'hb'))) miss.push('In-limit error must be below the human baseline');
      s.checks.forEach(function (c, i) { if (!val(body, 'c' + i)) miss.push(c); });
      outEl.innerHTML = miss.length
        ? '<b>Hold at L' + s.from + '.</b> ' + miss.length + ' item' + (miss.length > 1 ? 's' : '') + ' missing:<ul class="ld-checks">' + miss.map(function (m) { return '<li class="warn">' + m + '</li>'; }).join('') + '</ul>'
        : '<b>Ready for the human gate.</b> Put the evidence pack to the accountable owner. If they sign, the step moves to L' + s.to + ' and demotion triggers stay armed.';
    }
    draw();
  }

  /* ---------- 6. Decision threshold check ---------- */
  function threshold(root) {
    root.innerHTML =
      '<p class="ix-cap">Set the stakes for one action. See the confidence the agent needs to act alone.</p>' +
      slider('g', 'Gain if the action is right (G)', 10, 2000, 10, 100, 'money') +
      slider('l', 'Loss if the action is wrong (L)', 10, 20000, 10, 300, 'money') +
      slider('p', 'Agent confidence for this case', 50, 99, 1, 82, 'pct') +
      '<div class="ld-meter" aria-hidden="true"><span class="ld-meter-p"></span><span class="ld-meter-t"></span></div>' +
      '<p class="ix-result ld-th-out" aria-live="polite"></p>';
    var outEl = $('.ld-th-out', root);
    bindSliders(root, function () {
      var G = val(root, 'g'), L = val(root, 'l'), p = val(root, 'p') / 100, ps = L / (G + L);
      $('.ld-meter-p', root).style.width = (p * 100) + '%';
      $('.ld-meter-t', root).style.left = (ps * 100) + '%';
      outEl.innerHTML = 'Required confidence p* = L &divide; (G + L) = ' + money(L) + ' &divide; ' + money(G + L) + ' = <b>' + pct(ps) + '</b>. ' +
        (p >= ps ? '<b>Act within limits.</b> The agent may commit through a released interface, if policy limits also pass.'
          : '<b>Route to a person.</b> The approver gets a decision card with the evidence, the rule and the confidence.');
    });
  }

  /* ---------- 7. Weekly control room ---------- */
  function controlRoom(root) {
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var fams = [
      { name: 'Dispute credits', level: 3, vol: 1800, auto: 0.72, esc: 0.11, ovr: 0.03, rev: 0.30, cpo: 4.1, owner: 'Head of receivables' },
      { name: 'Invoice exceptions', level: 2, vol: 2600, auto: 0.0, esc: 0.18, ovr: 0.06, rev: 0.20, cpo: 6.2, owner: 'Head of payables' },
      { name: 'Account reconciliations', level: 3, vol: 900, auto: 0.64, esc: 0.09, ovr: 0.02, rev: 0.25, cpo: 5.4, owner: 'Controller' },
      { name: 'Service voice line', level: 2, vol: 5200, auto: 0.0, esc: 0.22, ovr: 0.08, rev: 0.10, cpo: 2.9, owner: 'Head of service' },
      { name: 'Maintenance work orders', level: 2, vol: 420, auto: 0.0, esc: 0.15, ovr: 0.05, rev: 0.15, cpo: 11.8, owner: 'Plant maintenance lead' }
    ];
    fams.forEach(function (f) { f.hist = [f.cpo]; f.good = 0; f.stopped = false; f.drift = false; f.note = ''; });
    var week = 1, killAge = 34, alerts = [];
    root.innerHTML =
      '<p class="ix-cap">What a leader reads each week. Step through weeks, stop an agent family, or run the kill switch test.</p>' +
      '<div class="ld-cr">' +
        '<div class="ld-cr-bar"><span></span><span></span><span></span><b>Control room &middot; fictional fleet &middot; illustrative</b><em class="ld-cr-week"></em></div>' +
        '<div class="ld-cr-tiles"></div>' +
        '<div class="ld-tablewrap ld-cr-wrap" tabindex="0" role="region" aria-label="Agent families, scroll sideways for more"><table class="ld-cr-t"><caption class="visually-hidden">Agent families this week</caption><thead><tr>' +
          '<th scope="col">Agent family</th><th scope="col">Level</th><th scope="col">Volume</th><th scope="col">Completed by agent</th><th scope="col">Escalated</th><th scope="col">Overrides</th><th scope="col">Reversals</th><th scope="col">Cost per completed outcome</th><th scope="col">Signal</th><th scope="col">Stop</th>' +
        '</tr></thead><tbody></tbody></table></div>' +
        '<div class="ld-cr-alerts" aria-live="polite"></div>' +
        '<p class="cta-row"><button type="button" class="btn btn-primary ld-next">Next week</button><button type="button" class="btn btn-ghost ld-kill-test">Run kill switch test</button></p>' +
      '</div>' +
      '<p class="ld-fine">A fictional fleet with simulated readings. Rules: reversals at or above 0.5% at L3 demote the family to L2 automatically. Drift holds promotion. Three good weeks in a row put a family forward for a human promotion review.</p>';
    var tiles = $('.ld-cr-tiles', root), tbody = $('tbody', root), alertsEl = $('.ld-cr-alerts', root);
    function spark(h) {
      var w = 56, ht = 18, mn = Math.min.apply(null, h), mx = Math.max.apply(null, h), r = mx - mn || 1;
      var pts = h.map(function (v, i) { return (h.length === 1 ? w : i / (h.length - 1) * w).toFixed(1) + ',' + (ht - 2 - (v - mn) / r * (ht - 4)).toFixed(1); }).join(' ');
      return '<svg class="ld-spark" viewBox="0 0 ' + w + ' ' + ht + '" width="' + w + '" height="' + ht + '" aria-hidden="true" focusable="false"><polyline points="' + pts + '"/></svg>';
    }
    function draw() {
      var done = 0, esc = 0, live = fams.filter(function (f) { return !f.stopped; });
      fams.forEach(function (f) { if (f.stopped) return; done += f.vol * (f.level >= 3 ? f.auto : 0); esc += f.vol * f.esc; });
      var risky = fams.filter(function (f) { return f.rev >= 0.5 || f.drift; }).length;
      $('.ld-cr-week', root).textContent = 'Week ' + week;
      tiles.innerHTML =
        '<div><span>Completed by agents</span><b>' + Math.round(done).toLocaleString('en-US') + '</b></div>' +
        '<div><span>Escalated to people</span><b>' + Math.round(esc).toLocaleString('en-US') + '</b></div>' +
        '<div class="' + (risky ? 'warn' : 'ok') + '"><span>Risk counterweights red</span><b>' + risky + '</b></div>' +
        '<div class="' + (killAge > 90 ? 'warn' : 'ok') + '"><span>Days since kill switch test</span><b>' + killAge + '</b></div>' +
        '<div><span>Families running</span><b>' + live.length + ' / ' + fams.length + '</b></div>';
      tbody.innerHTML = fams.map(function (f, i) {
        var sig = f.stopped ? '<span class="ld-sig stop">Stopped</span>' : (f.rev >= 0.5 || f.drift ? '<span class="ld-sig red">Risk leads</span>' : (f.good >= 3 ? '<span class="ld-sig green">Review for promotion</span>' : '<span class="ld-sig">Value leads</span>'));
        return '<tr class="' + (f.stopped ? 'is-stopped' : '') + '"><th scope="row">' + f.name + '<small>' + f.owner + '</small></th>' +
          '<td><b class="ld-lvl ld-l' + f.level + '">L' + f.level + '</b></td>' +
          '<td class="ld-num">' + f.vol.toLocaleString('en-US') + '</td>' +
          '<td class="ld-num">' + (f.level >= 3 ? pct(f.auto) : '<span title="At L2 people approve every action">All approved</span>') + '</td>' +
          '<td class="ld-num">' + pct(f.esc) + '</td><td class="ld-num">' + pct(f.ovr, 1) + '</td>' +
          '<td class="ld-num' + (f.rev >= 0.5 ? ' ld-bad' : '') + '">' + f.rev.toFixed(2) + '%</td>' +
          '<td class="ld-num">' + money2(f.cpo) + ' ' + spark(f.hist) + '</td>' +
          '<td>' + sig + (f.drift ? '<small>Drift flagged</small>' : '') + '</td>' +
          '<td><button type="button" class="ld-stop" data-i="' + i + '" aria-pressed="' + f.stopped + '">' + (f.stopped ? 'Restart' : 'Stop') + '<span class="visually-hidden"> ' + f.name + '</span></button></td></tr>';
      }).join('');
      var asks = [];
      fams.forEach(function (f) {
        if (f.stopped) asks.push('Who owns the restart decision for ' + f.name.toLowerCase() + ', and what evidence will they need?');
        else if (f.rev >= 0.5) asks.push('What caused the reversals in ' + f.name.toLowerCase() + '? Which actions need to be found and undone?');
        else if (f.drift) asks.push('Which input changed for ' + f.name.toLowerCase() + '? Hold promotion until drift clears.');
        else if (f.good >= 3 && f.level < 3) asks.push('Is ' + f.name.toLowerCase() + ' ready for the L2 to L3 gate? Ask for the evidence pack.');
      });
      if (killAge > 90) asks.push('The kill switch test is overdue. When will it run?');
      if (!asks.length) asks.push('No exceptions this week. Ask which drag to remove next.');
      alertsEl.innerHTML = (alerts.length ? '<h4 class="ld-h">This week&rsquo;s events</h4><ul class="ld-checks">' + alerts.map(function (a) { return '<li class="' + a[0] + '">' + a[1] + '</li>'; }).join('') + '</ul>' : '') +
        '<h4 class="ld-h">Questions to ask this week</h4><ol class="ld-asks">' + asks.slice(0, 4).map(function (a) { return '<li>' + a + '</li>'; }).join('') + '</ol>';
    }
    function step() {
      week += 1; killAge += 7; alerts = [];
      fams.forEach(function (f) {
        if (f.stopped) { alerts.push(['warn', f.name + ': stopped. All work routes to people with full context.']); return; }
        f.vol = Math.max(50, Math.round(f.vol * (0.94 + rnd() * 0.12)));
        f.esc = Math.min(0.4, Math.max(0.03, f.esc + (rnd() - 0.55) * 0.03));
        f.ovr = Math.min(0.15, Math.max(0.005, f.ovr + (rnd() - 0.55) * 0.012));
        if (f.level >= 3) f.auto = Math.min(0.9, Math.max(0.4, f.auto + (rnd() - 0.4) * 0.04));
        var shock = rnd() < 0.12;
        f.rev = Math.max(0.02, Math.min(1.5, f.rev + (rnd() - 0.55) * 0.12 + (shock ? 0.35 : 0)));
        f.drift = rnd() < 0.08;
        f.cpo = Math.max(0.8, f.cpo * (0.96 + rnd() * 0.06) + (shock ? 0.3 : 0));
        f.hist.push(+f.cpo.toFixed(2)); if (f.hist.length > 10) f.hist.shift();
        var improving = f.hist.length > 1 && f.hist[f.hist.length - 1] <= f.hist[f.hist.length - 2];
        if (f.level >= 3 && f.rev >= 0.5) { f.level = 2; f.good = 0; alerts.push(['warn', f.name + ': reversals at ' + f.rev.toFixed(2) + '%. Demoted to L2 by rule. People approve every action.']); }
        else if (f.drift) { f.good = 0; alerts.push(['warn', f.name + ': input drift detected. Promotion on hold.']); }
        else if (improving && f.rev < 0.5) { f.good += 1; if (f.good === 3) alerts.push(['ok', f.name + ': three good weeks. Put forward for a human promotion review.']); }
        else f.good = Math.max(0, f.good - 1);
      });
      draw();
    }
    tbody.addEventListener('click', function (e) {
      var b = e.target.closest('.ld-stop'); if (!b) return;
      var f = fams[+b.dataset.i]; f.stopped = !f.stopped;
      alerts = [[f.stopped ? 'warn' : 'ok', f.name + (f.stopped ? ': stopped by its owner. Work routes to people with full context.' : ': restarted at L2. It must earn L3 again.')]];
      if (!f.stopped) { f.level = 2; f.good = 0; }
      draw(); var nb = $('.ld-stop[data-i="' + b.dataset.i + '"]', tbody); if (nb) nb.focus();
    });
    $('.ld-next', root).addEventListener('click', step);
    $('.ld-kill-test', root).addEventListener('click', function () {
      killAge = 0; alerts = [['ok', 'Kill switch test passed: one agent, one scope and the whole fleet stopped and restarted. Evidence filed.']]; draw();
    });
    draw();
  }

  /* ---------- Tabs and numbered rows ---------- */
  function tabs() {
    var wrap = $('.lq-tabs-wrap'), list = $('.lq-tabs'), desc = $('.lq-desc');
    if (!wrap || !list) return;
    var panels = $$('.lq-panel');
    var bar = el('div', 'lq-tabbar'); bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'Question themes');
    var all = { theme: 'all', name: 'All', count: $$('.lq-row').length };
    var defs = [all].concat($$('.lq-tab', list).map(function (a) { return { theme: a.dataset.theme, name: a.firstChild.textContent, count: +$('.lq-count', a).textContent }; }));
    var btns = defs.map(function (d) {
      var b = el('button', 'lq-tabb', esc(d.name) + '<span class="lq-count">' + d.count + '</span>');
      b.type = 'button'; b.id = 'tab-' + d.theme; b.setAttribute('role', 'tab'); b.dataset.theme = d.theme;
      b.setAttribute('aria-controls', d.theme === 'all' ? panels.map(function (p) { return p.id; }).join(' ') : 't-' + d.theme);
      bar.appendChild(b); return b;
    });
    wrap.replaceChild(bar, list);
    panels.forEach(function (p) { p.setAttribute('role', 'tabpanel'); p.setAttribute('tabindex', '-1'); });
    function show(theme, focus) {
      btns.forEach(function (b) { var on = b.dataset.theme === theme; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
      panels.forEach(function (p) {
        p.hidden = theme !== 'all' && p.dataset.theme !== theme;
        p.classList.toggle('lq-solo', theme !== 'all');
        if (theme !== 'all' && !p.hidden) p.setAttribute('aria-labelledby', 'tab-' + theme); else p.removeAttribute('aria-labelledby');
      });
      var p = panels.filter(function (x) { return x.dataset.theme === theme; })[0];
      if (desc) desc.textContent = p ? p.dataset.desc : 'All eighteen questions, grouped by theme. Open any row.';
    }
    bar.addEventListener('click', function (e) { var b = e.target.closest('.lq-tabb'); if (b) show(b.dataset.theme); });
    bar.addEventListener('keydown', function (e) {
      var i = btns.indexOf(document.activeElement); if (i < 0) return;
      var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : null;
      if (n == null) return; e.preventDefault(); n = (n + btns.length) % btns.length; show(btns[n].dataset.theme, true);
    });
    function openHash() {
      var h = decodeURIComponent(location.hash.slice(1)); if (!h) return false;
      var t = document.getElementById(h); if (!t) return false;
      if (t.classList.contains('lq-panel')) { show(t.dataset.theme); return true; }
      if (t.tagName === 'DETAILS' && t.closest('.lq-panel')) {
        var p = t.closest('.lq-panel'); if (p.hidden) show(p.dataset.theme);
        t.open = true; setTimeout(function () { t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); $('summary', t).focus({ preventScroll: true }); }, 30);
        return true;
      }
      return false;
    }
    window.addEventListener('hashchange', openHash);
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#q-"], a[href^="#t-"]'); if (!a) return;
      if (location.hash === a.getAttribute('href')) { e.preventDefault(); openHash(); }
    });
    show('fund');
    openHash();
  }

  var MOUNTS = { funding: funding, prioritizer: prioritizer, raci: raci, planner: planner, trust: trust, threshold: threshold, 'control-room': controlRoom };
  tabs();
  $$('[data-lx]').forEach(function (n) {
    var f = MOUNTS[n.dataset.lx]; if (!f) return;
    try { f(n); var w = n.closest('.ix'); if (w) w.hidden = false; } catch (e) { /* keep static content */ }
  });
})();
