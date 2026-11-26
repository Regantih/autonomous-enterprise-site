/* Interactive frameworks from The Autonomous Enterprise. All numbers are the book's illustrative Meridian figures. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }
  var LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];

  /* ---------- 1. Live run: one case through the harness ---------- */
  function liveRun(root) {
    var CASES = {
      small: { label: 'Pricing dispute, $1,000 credit', amount: 1000, p: 0.87, dna: false,
        ask: 'Customer disputes invoice 90417417: billed the old price after a contract change. Requests a $1,000 credit.',
        think: 'Contract clause 4.2 sets the new price from Sept 1. Invoice is dated Sept 9. Proof of delivery matches. The credit equals the price difference. I propose a $1,000 credit memo.' },
      large: { label: 'Pricing dispute, $7,800 credit', amount: 7800, p: 0.87, dna: false,
        ask: 'Customer disputes a quarterly invoice: volume rebate not applied. Requests a $7,800 credit.',
        think: 'Rebate tier 2 applies above 40,000 units. Shipments total 41,200 units. One shipment is still in transit. I propose a $7,800 credit memo, with the open shipment flagged.' },
      bank: { label: 'Supplier asks to change bank details', amount: 0, p: 0.95, dna: true,
        ask: 'Email from a supplier: "Please update our bank account for all future payments."',
        think: 'This request changes where company money goes. I can prepare the evidence, but I cannot make this change.' }
    };
    var G = 100;
    root.innerHTML =
      '<div class="lr-tabs" role="tablist" aria-label="Choose a case"></div>' +
      '<div class="lr-console">' +
        '<div class="lr-bar"><span></span><span></span><span></span><b>Agent run &middot; Meridian Industries (illustrative)</b></div>' +
        '<ol class="lr-steps">' +
          '<li data-s="0"><p class="lr-k">01 The request</p><p class="lr-v lr-ask"></p></li>' +
          '<li data-s="1"><p class="lr-k">02 The agent proposes</p><p class="lr-v lr-think"></p></li>' +
          '<li data-s="2"><p class="lr-k">03 The harness checks</p><ul class="lr-checks"></ul></li>' +
          '<li data-s="3"><p class="lr-k">04 The outcome</p><div class="lr-out"></div></li>' +
        '</ol>' +
      '</div>' +
      '<div class="lr-tune"><p class="lr-k">Try your own case</p>' +
        '<label>Credit amount <output class="lr-a"></output><input type="range" min="100" max="12000" step="100" class="lr-amt"></label>' +
        '<label>Agent confidence <output class="lr-c"></output><input type="range" min="50" max="99" step="1" class="lr-conf"></label>' +
        '<p class="lr-formula"></p></div>';
    var tabs = $('.lr-tabs', root), current = null, token = 0;
    Object.keys(CASES).forEach(function (k, i) {
      var b = el('button', 'lr-tab', CASES[k].label); b.type = 'button'; b.setAttribute('role', 'tab');
      b.addEventListener('click', function () { run(k); });
      tabs.appendChild(b); CASES[k].btn = b;
    });
    var amt = $('.lr-amt', root), conf = $('.lr-conf', root);
    function custom() {
      CASES.custom = { amount: +amt.value, p: conf.value / 100, dna: false,
        ask: 'Customer disputes an invoice and requests a ' + money(+amt.value) + ' credit.',
        think: 'I checked the contract, the invoice and proof of delivery. My confidence the credit is valid is ' + (+conf.value) + '%. I propose a ' + money(+amt.value) + ' credit memo.' };
      run('custom', true);
    }
    amt.addEventListener('input', custom); conf.addEventListener('input', custom);
    function typeInto(node, text, my) {
      if (reduce) { node.textContent = text; return Promise.resolve(); }
      node.textContent = ''; node.classList.add('typing');
      var i = 0;
      return new Promise(function (res) {
        (function step() {
          if (my !== token) return res();
          i += 3; node.textContent = text.slice(0, i);
          if (i < text.length) setTimeout(step, 12); else { node.classList.remove('typing'); res(); }
        })();
      });
    }
    function decide(c) {
      var L = 0.1 * c.amount + 80, pStar = L / (G + L);
      var checks = [];
      checks.push(['ok', 'Identity', 'Dispute agent acts on behalf of the AR owner']);
      checks.push(['ok', 'Registry', 'Agent version 3 is registered and active']);
      checks.push(['ok', 'Context', 'Contract, invoice and delivery proof; email text treated as data']);
      if (c.dna) {
        checks.push(['stop', 'Do-not-automate list', 'Supplier bank data changes stay with people']);
        return { checks: checks, kind: 'stop', pStar: null, L: null };
      }
      checks.push(['ok', 'Verification', 'Schema valid; data fresh']);
      var inLimit = c.amount <= 5000;
      checks.push([inLimit ? 'ok' : 'warn', 'Policy limit', money(c.amount) + (inLimit ? ' is within' : ' is above') + ' the $5,000 limit']);
      var pass = c.p >= pStar;
      checks.push([pass ? 'ok' : 'warn', 'Decision threshold', 'Confidence ' + Math.round(c.p * 100) + '% vs required ' + Math.round(pStar * 100) + '%']);
      checks.push(['ok', 'Decision trace', 'Written before anything commits']);
      return { checks: checks, kind: inLimit && pass ? 'post' : 'human', pStar: pStar, L: L };
    }
    function run(k, instant) {
      var c = CASES[k], my = ++token; current = k;
      Object.keys(CASES).forEach(function (n) { if (CASES[n].btn) CASES[n].btn.setAttribute('aria-selected', String(n === k)); });
      var steps = $$('.lr-steps > li', root); steps.forEach(function (s) { s.classList.remove('on', 'done'); });
      var d = decide(c);
      $('.lr-a', root).textContent = money(c.amount || +amt.value);
      $('.lr-c', root).textContent = Math.round(c.p * 100) + '%';
      if (k !== 'custom' && !c.dna) { amt.value = c.amount; conf.value = Math.round(c.p * 100); }
      $('.lr-formula', root).innerHTML = d.pStar == null
        ? 'No threshold applies: this action is on the do-not-automate list.'
        : 'Gain if right G = $100. Loss if wrong L = 10% &times; amount + $80 = ' + money(d.L) + '. The agent may act alone only if confidence &ge; L &divide; (G + L) = <b>' + Math.round(d.pStar * 100) + '%</b>.';
      var ask = $('.lr-ask', root), think = $('.lr-think', root), list = $('.lr-checks', root), out = $('.lr-out', root);
      ask.textContent = ''; think.textContent = ''; list.innerHTML = ''; out.innerHTML = '';
      var fast = instant || reduce;
      (async function () {
        steps[0].classList.add('on');
        if (fast) ask.textContent = c.ask; else await typeInto(ask, c.ask, my);
        if (my !== token) return; steps[0].classList.add('done'); steps[1].classList.add('on');
        if (fast) think.textContent = c.think; else { await wait(250); await typeInto(think, c.think, my); }
        if (my !== token) return; steps[1].classList.add('done'); steps[2].classList.add('on');
        for (var i = 0; i < d.checks.length; i++) {
          if (!fast) await wait(320); if (my !== token) return;
          var ch = d.checks[i];
          list.appendChild(el('li', 'lr-' + ch[0], '<b>' + ch[1] + '</b><span>' + ch[2] + '</span>'));
        }
        if (!fast) await wait(350); if (my !== token) return;
        steps[2].classList.add('done'); steps[3].classList.add('on');
        if (d.kind === 'post') out.innerHTML = '<div class="lr-result lr-r-post"><b>Posted at L3</b><span>A deterministic rule posts the credit memo through a released interface. A person reviews a 5% sample later.</span></div>';
        else if (d.kind === 'human') out.innerHTML = '<div class="lr-result lr-r-human"><b>Routed to a person (L2)</b><span>The approver gets a card: proposed action, why, evidence, the rule that applied, confidence, what is missing, and options: approve, short-pay, ask the customer, reassign.</span></div>';
        else out.innerHTML = '<div class="lr-result lr-r-stop"><b>Stopped. People only.</b><span>The agent cannot hold this permission. The request goes to the supplier master workflow, where a named person verifies it by a known phone number.</span></div>';
        steps[3].classList.add('done');
      })();
    }
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); run('small'); }
    }, { threshold: 0.35 }) : null;
    if (io) io.observe(root); else run('small');
  }

  /* ---------- 2. Level explorer ---------- */
  function levelExplorer(root) {
    var D = [
      ['Manual', 'Human', 'Human', 'Clerk investigates the PO, receipt and invoice, then emails the buyer.', 20, 36000],
      ['Assist', 'Human', 'Human', 'Agent summarizes the mismatch and the likely cause; the clerk acts.', 12, 21600],
      ['Approve', 'Agent proposes', 'Agent, after approval', 'Agent proposes accept, request credit or block; the clerk approves each one.', 5, 9000],
      ['Act within limits', 'Agent', 'Agent', 'Agent resolves variances under $500 and under 2% of line value. 35% escalate; 5% of the rest are sampled.', 5.4, 9700],
      ['Run and report', 'Agent', 'Agent', 'Agent resolves everything except disputed or high-risk items (8% escalate). Monthly sample audit.', 1.2, 2600],
      ['Full', 'Agent', 'Agent', 'Agent sets its own sub-goals and changes its own limits. A boundary marker, not a target, for postings.', null, null]
    ];
    root.innerHTML = '<p class="ix-cap">Case: 108,000 supplier-invoice exceptions a year. Drag the slider.</p>' +
      '<input type="range" min="0" max="5" step="1" value="0" class="ix-range" aria-label="Autonomy level">' +
      '<div class="lx-ticks">' + LEVELS.map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div>' +
      '<div class="lx-card"><h4 class="lx-name"></h4><dl class="lx-who"><div><dt>Decides</dt><dd class="lx-d"></dd></div><div><dt>Executes</dt><dd class="lx-e"></dd></div></dl><p class="lx-how"></p></div>' +
      '<div class="lx-chart" aria-hidden="true"></div><p class="lx-note"></p>';
    var chart = $('.lx-chart', root);
    D.slice(0, 5).forEach(function (d, i) {
      var b = el('div', 'lx-bar', '<i style="height:' + (d[5] / 36000 * 100) + '%"></i><span>' + (d[5] / 1000).toFixed(1).replace('.0', '') + 'k h</span><em>' + LEVELS[i] + '</em>');
      chart.appendChild(b);
    });
    var r = $('.ix-range', root);
    function upd() {
      var i = +r.value, d = D[i];
      $('.lx-name', root).textContent = LEVELS[i] + ' ' + d[0];
      $('.lx-d', root).textContent = d[1]; $('.lx-e', root).textContent = d[2]; $('.lx-how', root).textContent = d[3];
      $$('.lx-bar', root).forEach(function (b, j) { b.classList.toggle('on', j === i); });
      $('.lx-note', root).textContent = i === 3
        ? 'Notice: hours rise slightly from L2 to L3, because the items that escalate are the hardest. The value at L3 is speed and freed-up people.'
        : (d[5] ? 'About ' + d[5].toLocaleString('en-US') + ' human hours a year at ' + d[4] + ' minutes per exception.' : 'L5 is not used for financial postings.');
    }
    r.addEventListener('input', upd); upd();
  }

  /* ---------- 3. Ceiling calculator ---------- */
  function ceiling(root) {
    var M = [[4, 3, 2], [3, 2, 1.5], [2, 1.5, 0.5]];
    var mats = ['Low (under $5,000)', 'Medium ($5k to $250k)', 'High or regulatory'];
    var revs = ['Easily reversible', 'Hard to reverse', 'Irreversible'];
    var mods = [['dq', 'Input data fails its quality gate', 'cap2'], ['reg', 'High-risk under law, or a key financial control', 'cap2'],
      ['cp', 'Commits the company to a third party (first 90 days)', 'minus1'], ['wl', 'Depends on a file or manual handoff', 'cap2']];
    root.innerHTML = '<div class="ce-grid" role="group" aria-label="Pick materiality and reversibility"><span></span>' +
      revs.map(function (r) { return '<b>' + r + '</b>'; }).join('') +
      mats.map(function (m, i) { return '<b>' + m + '</b>' + revs.map(function (_, j) {
        return '<button type="button" class="ce-cell" data-i="' + i + '" data-j="' + j + '">' + lab(M[i][j]) + '</button>'; }).join(''); }).join('') +
      '</div><fieldset class="ce-mods"><legend>Then apply the modifiers</legend>' +
      mods.map(function (m) { return '<label><input type="checkbox" value="' + m[0] + '"> ' + m[1] + '</label>'; }).join('') +
      '</fieldset><p class="ix-result ce-out" aria-live="polite"></p>';
    function lab(v) { return v === 1.5 ? 'L1&ndash;L2' : v === 0.5 ? 'L0&ndash;L1' : 'Up to L' + v; }
    var sel = [0, 0];
    $$('.ce-cell', root).forEach(function (b) { b.addEventListener('click', function () { sel = [+b.dataset.i, +b.dataset.j]; upd(); }); });
    $$('.ce-mods input', root).forEach(function (c) { c.addEventListener('change', upd); });
    function upd() {
      $$('.ce-cell', root).forEach(function (b) { b.classList.toggle('on', +b.dataset.i === sel[0] && +b.dataset.j === sel[1]); });
      var v = Math.floor(M[sel[0]][sel[1]]), why = [];
      $$('.ce-mods input', root).forEach(function (c) {
        if (!c.checked) return;
        var m = mods.filter(function (x) { return x[0] === c.value; })[0];
        if (m[2] === 'cap2' && v > 2) { v = 2; why.push('capped at L2'); }
        if (m[2] === 'minus1' && v > 0) { v -= 1; why.push('one level lower'); }
      });
      $('.ce-out', root).innerHTML = 'Highest safe level for this step: <b>L' + v + '</b>' + (why.length ? ' (' + why.join(', ') + ')' : '') + '. It still has to earn each level with evidence.';
    }
    upd();
  }

  /* ---------- 4. Promotion gate ---------- */
  function promotion(root) {
    root.innerHTML = '<p class="ix-cap">An agent at L2 wants to move to L3. Set its evidence.</p>' +
      '<label class="ix-sl">Approved without edits <output></output><input type="range" min="70" max="100" value="91" data-k="ok"></label>' +
      '<label class="ix-sl">Actions observed <output></output><input type="range" min="100" max="3000" step="100" value="600" data-k="n"></label>' +
      '<label class="ix-sl">Months, including a quarter-end <output></output><input type="range" min="0" max="6" value="2" data-k="m"></label>' +
      '<label class="ix-sl">Reversals <output></output><input type="range" min="0" max="20" value="8" data-k="rev"></label>' +
      '<div class="pr-checks"><label><input type="checkbox" data-k="lim"> Limits enforced outside the model</label><label><input type="checkbox" data-k="kill"> Kill switch tested</label><label><input type="checkbox" data-k="audit"> Internal audit signed off</label></div>' +
      '<ul class="pr-list"></ul><p class="ix-result pr-out" aria-live="polite"></p>' +
      '<div class="pr-trig"><span>Something goes wrong at L3:</span><button type="button" data-t="error">Error above threshold</button><button type="button" data-t="data">Data gate fails</button><button type="button" data-t="model">Model changes</button></div>';
    var demoted = null;
    function v(k) { var i = $('[data-k="' + k + '"]', root); return i.type === 'checkbox' ? i.checked : +i.value; }
    function upd() {
      $$('.ix-sl', root).forEach(function (l) { var i = $('input', l), o = $('output', l), k = i.dataset.k;
        o.textContent = k === 'ok' ? i.value + '%' : k === 'rev' ? (i.value / 10).toFixed(1) + '%' : k === 'n' ? (+i.value).toLocaleString('en-US') : i.value; });
      var t = [['At least 95% approved without edits', v('ok') >= 95], ['At least 1,000 actions', v('n') >= 1000], ['At least 3 months with a quarter-end', v('m') >= 3],
        ['Reversals below 0.5%', v('rev') / 10 < 0.5], ['Limits outside the model', v('lim')], ['Kill switch tested', v('kill')], ['Audit sign-off', v('audit')]];
      $('.pr-list', root).innerHTML = t.map(function (x) { return '<li class="' + (x[1] ? 'yes' : 'no') + '">' + x[0] + '</li>'; }).join('');
      var all = t.every(function (x) { return x[1]; });
      $('.pr-out', root).innerHTML = demoted ? '<b>Demoted to L2 automatically</b> (' + demoted + '). It must earn L3 again.'
        : all ? '<b>Ready for the human gate.</b> A person still decides. Promotion is never automatic.' : '<b>Stays at L2.</b> ' + t.filter(function (x) { return !x[1]; }).length + ' items of evidence are missing.';
    }
    $$('input', root).forEach(function (i) { i.addEventListener('input', function () { demoted = null; upd(); }); i.addEventListener('change', function () { demoted = null; upd(); }); });
    $$('.pr-trig button', root).forEach(function (b) { b.addEventListener('click', function () { demoted = b.textContent.toLowerCase(); upd(); }); });
    upd();
  }

  /* ---------- 5. Harness run animation ---------- */
  function harness(root) {
    var P = ['Identity and delegation', 'Registry and lifecycle', 'Policy and limits', 'Tool gateway', 'Model gateway', 'Context and memory', 'Verification and approval', 'Operating envelope and cost', 'Decision trace', 'Evaluation and kill switch'];
    var F = ['No token, no call', 'Unregistered agent blocked', 'Missing rule means escalate', 'Unknown tool rejected', 'Fallback model, or drop to L1', 'Untrusted content treated as data', 'Failed check goes to a person', 'Stop and escalate with trace', 'If the trace fails, the action fails', 'Stop one agent, a scope, or the fleet'];
    root.innerHTML = '<p class="ix-cap">Every agent action passes all ten parts. Break one and watch it fail safe.</p><div class="hx-row"></div><p class="ix-result hx-out" aria-live="polite"></p><div class="hx-btns"><button type="button" class="btn btn-dark hx-go">Run an action</button></div>';
    var row = $('.hx-row', root), broken = -1;
    P.forEach(function (p, i) { var b = el('button', 'hx-part', '<em>' + (i + 1) + '</em>' + p); b.type = 'button'; b.title = 'Break this part';
      b.addEventListener('click', function () { broken = broken === i ? -1 : i; $$('.hx-part', root).forEach(function (x, j) { x.classList.toggle('broken', j === broken); x.classList.remove('pass', 'fail'); });
        $('.hx-out', root).textContent = broken < 0 ? 'All parts healthy.' : 'Part ' + (i + 1) + ' is broken. Run an action.'; });
      row.appendChild(b); });
    $('.hx-go', root).addEventListener('click', async function () {
      var parts = $$('.hx-part', root); parts.forEach(function (x) { x.classList.remove('pass', 'fail'); });
      for (var i = 0; i < parts.length; i++) {
        await wait(170);
        if (i === broken) { parts[i].classList.add('fail'); $('.hx-out', root).innerHTML = '<b>Failed safe at part ' + (i + 1) + ':</b> ' + F[i] + '. Nothing reached the system of record.'; return; }
        parts[i].classList.add('pass');
      }
      $('.hx-out', root).innerHTML = '<b>Committed.</b> The action passed all ten parts and left a full decision trace.';
    });
    $('.hx-out', root).textContent = 'Click any part to break it, then run an action.';
  }

  /* ---------- 6. Weakest-link chain ---------- */
  function chain(root) {
    var H = [['Manual or email', 1], ['Scheduled file', 2], ['Synchronous API', 3], ['Governed agent tool', 3], ['Cross-agent contract', 3]];
    var links = [['Case triage', [2, 3]], ['Case to ERP', [1, 3]], ['Open item and terms check', [0, 3]], ['Proof of delivery', [2, 3]], ['Credit decision', [0, 3]], ['Post credit memo', [0, 3]]];
    root.innerHTML = '<p class="ix-cap">Case: a customer dispute crosses six links and four systems.</p><div class="ch-toggle" role="group"><button type="button" data-v="0" aria-pressed="true">Today</button><button type="button" data-v="1" aria-pressed="false">Month 18 design</button></div>' +
      '<ol class="ch-links"></ol><p class="ix-result ch-out" aria-live="polite"></p>';
    var ol = $('.ch-links', root), state = links.map(function (l) { return l[1][0]; });
    links.forEach(function (l, i) {
      var li = el('li', 'ch-link', '<span class="ch-name">' + l[0] + '</span><select aria-label="Level of ' + l[0] + '">' + LEVELS.slice(0, 5).map(function (x, j) { return '<option value="' + j + '">' + x + '</option>'; }).join('') + '</select>');
      $('select', li).addEventListener('change', function (e) { state[i] = +e.target.value; draw(); });
      ol.appendChild(li);
    });
    $$('.ch-toggle button', root).forEach(function (b) { b.addEventListener('click', function () {
      $$('.ch-toggle button', root).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      state = links.map(function (l) { return l[1][+b.dataset.v]; }); draw(); }); });
    function draw() {
      var min = Math.min.apply(null, state);
      $$('.ch-link', root).forEach(function (li, i) { $('select', li).value = state[i]; li.dataset.l = state[i]; li.classList.toggle('weak', state[i] === min); });
      var weak = links.filter(function (_, i) { return state[i] === min; }).map(function (l) { return l[0]; });
      $('.ch-out', root).innerHTML = 'The whole chain runs at <b>L' + min + '</b>, held there by: ' + weak.join(', ') + '. Fund this link first.';
    }
    draw();
  }

  /* ---------- 7. Cost per completed outcome ---------- */
  function cost(root) {
    var F = [['meter', 'Platform meter charges', 0, 10, 0.01, 2.34, '$'], ['model', 'Model and runtime', 0, 2, 0.01, 0.05, '$'], ['rev', 'Human review minutes', 0, 20, 1, 4, 'min'],
      ['rate', 'Loaded hourly rate', 30, 150, 1, 64, '$'], ['fb', 'Share that falls back to a person', 0, 50, 1, 8, '%'], ['fbm', 'Minutes per fallback', 5, 60, 1, 30, 'min'], ['base', 'Person-only minutes per case (your estimate)', 10, 90, 1, 40, 'min']];
    root.innerHTML = '<p class="ix-cap">Case: one customer dispute. Change any input.</p><div class="co-grid">' + F.map(function (f) {
      return '<label class="ix-sl">' + f[1] + ' <output></output><input type="range" data-k="' + f[0] + '" min="' + f[2] + '" max="' + f[3] + '" step="' + f[4] + '" value="' + f[5] + '"></label>'; }).join('') +
      '</div><div class="co-bars"><div><span>Agent path</span><i class="co-a"></i><b class="co-av"></b></div><div><span>Person only</span><i class="co-h"></i><b class="co-hv"></b></div></div><p class="ix-result co-out" aria-live="polite"></p>';
    function g(k) { return +$('[data-k="' + k + '"]', root).value; }
    function upd() {
      $$('.ix-sl', root).forEach(function (l, i) { var f = F[i], v = $('input', l).value; $('output', l).textContent = f[6] === '$' ? '$' + (+v).toFixed(2) : v + (f[6] === '%' ? '%' : ' min'); });
      var perMin = g('rate') / 60;
      var a = g('meter') + g('model') + g('rev') * perMin + (g('fb') / 100) * g('fbm') * perMin;
      var h = g('base') * perMin, mx = Math.max(a, h);
      $('.co-a', root).style.width = (a / mx * 100) + '%'; $('.co-h', root).style.width = (h / mx * 100) + '%';
      $('.co-av', root).textContent = '$' + a.toFixed(2); $('.co-hv', root).textContent = '$' + h.toFixed(2);
      $('.co-out', root).innerHTML = a < h ? 'The agent path costs <b>' + Math.round((1 - a / h) * 100) + '% less</b> per completed outcome. Watch the review and fallback minutes: they usually cost more than the meter.'
        : '<b>The agent path costs more.</b> A cheap action that leaves a person to finish the work is not cheap.';
    }
    $$('input', root).forEach(function (i) { i.addEventListener('input', upd); }); upd();
  }

  /* ---------- 8. Do-not-automate check ---------- */
  function dna(root) {
    var Q = ['Is the judgment itself the product?', 'Can nobody explain the workflow step by step?', 'Is an error irreversible, with no limit on the loss?', 'Is the process about to change?', 'Is the data unable to carry the decision?', 'Does the law reserve the decision to people?'];
    root.innerHTML = '<p class="ix-cap">Pick a step in your company and answer honestly.</p><ol class="dn-q">' + Q.map(function (q, i) {
      return '<li><span>' + q + '</span><span class="dn-yn" role="group"><button type="button" data-i="' + i + '" data-v="1">Yes</button><button type="button" data-i="' + i + '" data-v="0" aria-pressed="true">No</button></span></li>'; }).join('') + '</ol><p class="ix-result dn-out" aria-live="polite"></p>';
    var a = Q.map(function () { return 0; });
    $$('.dn-yn button', root).forEach(function (b) { b.addEventListener('click', function () {
      a[+b.dataset.i] = +b.dataset.v; $$('[data-i="' + b.dataset.i + '"]', root).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); upd(); }); });
    function upd() { var n = a.reduce(function (s, x) { return s + x; }, 0);
      $('.dn-out', root).innerHTML = n ? '<b>Keep a person deciding (L2 or below).</b> ' + n + ' condition' + (n > 1 ? 's' : '') + ' apply. Put this step on your do-not-automate list and review it like any control.'
        : '<b>No red flags.</b> This step can be a candidate for autonomy. Now find its ceiling and earn each level with evidence.'; }
    upd();
  }

  /* ---------- 9. Maturity radar ---------- */
  function maturity(root) {
    var D = ['Core and interfaces', 'Data and context', 'Agents and platform', 'Governance and controls', 'People and change', 'Value management'];
    var S = ['Experimenting', 'Adopting', 'Approved autonomy', 'Bounded autonomy', 'Autonomous operations'];
    var v = [1, 2, 1, 1, 2, 2];
    root.innerHTML = '<p class="ix-cap">Meridian&rsquo;s starting scores are loaded. Score your own company from 1 to 5.</p><div class="mt-wrap"><svg class="mt-svg" viewBox="-130 -120 260 240" role="img" aria-label="Maturity radar"></svg><div class="mt-sl">' +
      D.map(function (d, i) { return '<label class="ix-sl">' + d + ' <output></output><input type="range" min="1" max="5" value="' + v[i] + '" data-i="' + i + '"></label>'; }).join('') + '</div></div><p class="ix-result mt-out" aria-live="polite"></p>';
    var svg = $('.mt-svg', root);
    function pt(i, r) { var a = -Math.PI / 2 + i * Math.PI / 3; return [Math.cos(a) * r, Math.sin(a) * r]; }
    function draw() {
      var g = '';
      for (var k = 1; k <= 5; k++) g += '<polygon class="mt-ring" points="' + D.map(function (_, i) { return pt(i, k * 18).join(','); }).join(' ') + '"/>';
      D.forEach(function (d, i) { var p = pt(i, 90), q = pt(i, 104); g += '<line class="mt-ax" x1="0" y1="0" x2="' + p[0] + '" y2="' + p[1] + '"/><text x="' + q[0] + '" y="' + (q[1] + 3) + '" text-anchor="' + (Math.abs(q[0]) < 5 ? 'middle' : q[0] > 0 ? 'start' : 'end') + '">' + d.split(' ')[0] + '</text>'; });
      var min = Math.min.apply(null, v);
      g += '<polygon class="mt-shape" points="' + v.map(function (s, i) { return pt(i, s * 18).join(','); }).join(' ') + '"/>';
      v.forEach(function (s, i) { var p = pt(i, s * 18); g += '<circle class="' + (s === min ? 'mt-weak' : 'mt-dot') + '" cx="' + p[0] + '" cy="' + p[1] + '" r="4"/>'; });
      svg.innerHTML = g;
      $$('.mt-sl .ix-sl', root).forEach(function (l, i) { $('output', l).textContent = v[i]; });
      var weak = D.filter(function (_, i) { return v[i] === min; });
      var avg = v.reduce(function (a, b) { return a + b; }, 0) / 6;
      $('.mt-out', root).innerHTML = 'Your stage is <b>' + min + ' &middot; ' + S[min - 1] + '</b>, set by the weakest dimension (' + weak.join(', ') + '), not the average of ' + avg.toFixed(1) + '. The weakest control sets the ceiling.';
    }
    $$('input', root).forEach(function (i) { i.addEventListener('input', function () { v[+i.dataset.i] = +i.value; draw(); }); }); draw();
  }

  /* ---------- 10. Value-risk flywheel ---------- */
  function flywheel(root) {
    root.innerHTML = '<p class="ix-cap">Read one agent family for the month.</p><div class="fw-dials">' +
      '<label class="ix-sl">Value signal trend <output></output><input type="range" min="-20" max="30" value="12" data-k="v"></label>' +
      '<label class="ix-sl">Risk signal trend <output></output><input type="range" min="-20" max="30" value="4" data-k="r"></label></div>' +
      '<div class="fl-wheel" aria-hidden="true"><div class="fl-v"><span>Value</span></div><div class="fl-r"><span>Risk</span></div></div>' +
      '<label class="fl-red"><input type="checkbox" data-k="red"> A risk counterweight is red (errors, reversals, audit finding)</label><p class="ix-result fl-out" aria-live="polite"></p>';
    function g(k) { var i = $('[data-k="' + k + '"]', root); return i.type === 'checkbox' ? i.checked : +i.value; }
    function upd() {
      var v = g('v'), r = g('r');
      $$('.ix-sl', root).forEach(function (l) { var i = $('input', l); $('output', l).textContent = (i.value > 0 ? '+' : '') + i.value + '% a month'; });
      $('.fl-v', root).style.animationDuration = (reduce ? 0 : Math.max(1.2, 12 - v / 3)) + 's';
      $('.fl-r', root).style.animationDuration = (reduce ? 0 : Math.max(1.2, 12 - r / 3)) + 's';
      var out;
      if (g('red')) out = '<b>Hold every promotion in this family</b> until the counterweight clears. Add good drag: a tighter limit or a human gate.';
      else if (v > r) out = '<b>Value is compounding faster than risk.</b> This family may put a step forward for promotion, with evidence and a human gate.';
      else if (v < r) out = '<b>Risk is outrunning value.</b> Hold, and consider stepping down a level. Remove bad drag only where value is blocked.';
      else out = '<b>Even.</b> Hold the current level and keep reading monthly.';
      $('.fl-out', root).innerHTML = out;
    }
    $$('input', root).forEach(function (i) { i.addEventListener('input', upd); i.addEventListener('change', upd); }); upd();
  }

  var MOUNTS = { 'live-run': liveRun, levels: levelExplorer, ceiling: ceiling, promotion: promotion, harness: harness, chain: chain, cost: cost, dna: dna, maturity: maturity, flywheel: flywheel };
  $$('[data-ix]').forEach(function (n) { var f = MOUNTS[n.dataset.ix]; if (f) { try { f(n); var w = n.closest('.ix'); if (w) w.hidden = false; } catch (e) { /* keep static content */ } } });
})();
