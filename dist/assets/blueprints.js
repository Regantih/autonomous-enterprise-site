/* Blueprints: interactive architecture, workflows, controls and designer. Data comes from /assets/data/*.js. All numbers are illustrative. */
(function () {
  'use strict';
  var AE = window.AE;
  if (!AE || !AE.controls) return;
  var reduceMq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = !!(reduceMq && reduceMq.matches);
  // Follow the setting if the visitor changes it while the page is open.
  if (reduceMq && reduceMq.addEventListener) reduceMq.addEventListener('change', function (e) { reduce = e.matches; });
  var NS = 'http://www.w3.org/2000/svg';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function sv(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function cid(id) { return '<a class="cid" href="/controls/#' + id + '">' + id + '</a>'; }
  function cname(id) { var c = AE.controlById[id]; return c ? c.name : id; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }
  function lvl(n) { return n == null ? 'Rule' : 'L' + n; }
  function uniq(a) { var s = {}; return a.filter(function (x) { if (s[x]) return false; s[x] = 1; return true; }); }
  function btn(label, cls, attrs) { var b = el('button', cls, label); b.type = 'button'; for (var k in attrs || {}) b.setAttribute(k, attrs[k]); return b; }
  var HO_CEIL = {}; AE.handoffs.forEach(function (h) { HO_CEIL[h.id] = h.ceil; });
  var HO_NAME = {}; AE.handoffs.forEach(function (h) { HO_NAME[h.id] = h.name; });
  var LANE_NAME = {}; AE.lanes.forEach(function (l) { LANE_NAME[l.id] = l.name; });
  var LEVEL_MEANING = ['Manual: a person does the work.', 'Assist: the agent suggests; a person acts.', 'Approve: the agent proposes; a person approves each action.',
    'Act within limits: the agent acts; people handle exceptions and sample.', 'Run and report: the agent acts; people audit outcomes.', 'Full: a boundary marker, not a target.'];

  // Wrap text into lines of at most n characters.
  function wrap(text, n, max) {
    var words = String(text).split(' '), lines = [], cur = '';
    words.forEach(function (w) { if ((cur + ' ' + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) lines.push(cur);
    if (max && lines.length > max) { lines = lines.slice(0, max); lines[max - 1] = lines[max - 1].replace(/\s*\S*$/, '') + '\u2026'; }
    return lines;
  }
  function textLines(parent, x, y, lines, attrs, lh) {
    var t = sv('text', Object.assign({ x: x, y: y }, attrs || {}), parent);
    lines.forEach(function (l, i) { var s = sv('tspan', { x: x, dy: i ? (lh || 14) : 0 }, t); s.textContent = l; });
    return t;
  }

  // Move an SVG circle from point a to point b, optionally through waypoints (via), so the token can follow
  // the drawn connector instead of cutting across lanes. One ease over the whole route, paced by length.
  function moveToken(tok, a, b, ms, isLive, via) {
    if (reduce || !a) { tok.setAttribute('cx', b[0]); tok.setAttribute('cy', b[1]); return Promise.resolve(); }
    var pts = [a].concat(via || [], [b]), seg = [], total = 0;
    for (var j = 1; j < pts.length; j++) { var d = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); seg.push(d); total += d; }
    function at(e) {
      var dist = e * total;
      for (var j = 0; j < seg.length; j++) {
        if (dist <= seg[j] || j === seg.length - 1) { var f = seg[j] ? Math.min(1, dist / seg[j]) : 1; return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]; }
        dist -= seg[j];
      }
      return b;
    }
    return new Promise(function (res) {
      var t0 = null;
      function f(t) {
        if (isLive && !isLive()) return res();
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k, q = at(e);
        tok.setAttribute('cx', q[0]); tok.setAttribute('cy', q[1]);
        if (k < 1) requestAnimationFrame(f); else res();
      }
      requestAnimationFrame(f);
    });
  }
  // Waypoints along a swimlane connector: out of the right edge of step A, along the channel between the
  // columns, then into B (the same H-V-H elbow the arrows draw). Straight when both sit in one lane.
  function laneVia(A, B) {
    if (!A || !B || Math.abs(A.cy - B.cy) < 1) return null;
    var right = 2 * A.cx - A.x;
    if (B.x <= right) return null;
    var mx = (right + B.x) / 2;
    return [[mx, A.cy], [mx, B.cy]];
  }
  // Keep the moving token in view inside a sideways-scrolling diagram (phones), gliding unless motion is reduced.
  function follow(host, left) {
    left = Math.max(0, left);
    if (Math.abs(host.scrollLeft - left) < 2) return;
    if (host.scrollTo && !reduce) host.scrollTo({ left: left, behavior: 'smooth' }); else host.scrollLeft = left;
  }
  // When a run starts, bring the diagram it plays in to sit just below the sticky header (only if it is not
  // already fully in view), so the token never starts off-screen.
  function placeBelowHeader(node) {
    if (!node || !node.getBoundingClientRect) return;
    var hd = $('.site-header'), hb = hd ? Math.max(0, hd.getBoundingClientRect().bottom) : 0, r = node.getBoundingClientRect(), vh = window.innerHeight;
    var inView = r.top >= hb && r.bottom <= vh, tallAndTop = r.height > vh - hb && Math.abs(r.top - hb - 8) < 12;
    if (inView || tallAndTop) return;
    var top = Math.max(0, window.pageYOffset + r.top - hb - 8);
    if (window.scrollTo) { try { window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, top); } }
  }
  function typeInto(node, text, isLive) {
    if (reduce) { node.textContent = text; return Promise.resolve(); }
    node.textContent = ''; node.classList.add('typing');
    var i = 0;
    return new Promise(function (res) {
      (function step() {
        if (isLive && !isLive()) { node.classList.remove('typing'); return res(); }
        i += 2; node.textContent = text.slice(0, i);
        if (i < text.length) setTimeout(step, 14); else { node.classList.remove('typing'); res(); }
      })();
    });
  }

  /* ---------- Shared: alignment layer filter (tab row of rounded buttons) ---------- */
  function layerFilter(onChange, label) {
    var wrapEl = el('div', 'lf');
    wrapEl.appendChild(el('p', 'lf-label', label || 'Alignment layer'));
    var row = el('div', 'lf-tabs'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Filter by alignment layer');
    var desc = el('p', 'lf-desc'); desc.setAttribute('aria-live', 'polite');
    var current = null;
    var opts = [{ id: null, name: 'All layers', desc: 'Show every layer: financial, regulatory and statutory, operational, application and technical.' }].concat(AE.layers);
    opts.forEach(function (o) {
      var b = btn(esc(o.name), 'pill', { 'aria-pressed': String(o.id === null), 'data-layer': o.id || '' });
      b.addEventListener('click', function () {
        current = o.id;
        $$('button', row).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        desc.textContent = o.desc; onChange(current);
      });
      row.appendChild(b);
    });
    desc.textContent = opts[0].desc;
    wrapEl.appendChild(row); wrapEl.appendChild(desc);
    return { el: wrapEl, get: function () { return current; } };
  }
  function layerStrip(layers, active) {
    return '<span class="ls" aria-label="Layers aligned: ' + (layers.length ? layers.map(function (l) { return AE.layerById[l].name; }).join(', ') : 'none') + '">' +
      AE.layers.map(function (L) { return '<span class="ls-i' + (layers.indexOf(L.id) >= 0 ? ' on' : '') + (active === L.id ? ' cur' : '') + '" title="' + esc(L.name) + '">' + L.short + '</span>'; }).join('') + '</span>';
  }

  /* ---------- Hub: alignment across every layer ---------- */
  function alignment(root) {
    root.innerHTML = '';
    var tabs = el('div', 'al-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Enterprise layers');
    var desc = el('p', 'al-desc al-desc-live');
    var list = el('ol', 'al-rows'); list.id = 'al-rows'; list.setAttribute('aria-live', 'polite');
    root.appendChild(tabs); root.appendChild(desc); root.appendChild(list);
    var buttons = AE.layers.map(function (L, i) {
      var b = btn(esc(L.name), 'al-tab', { role: 'tab', 'aria-selected': 'false', 'aria-controls': 'al-rows', id: 'alt-' + L.id, tabindex: '-1' });
      b.addEventListener('click', function () { show(i); });
      b.addEventListener('keydown', function (e) {
        var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (k) { e.preventDefault(); var n = (i + k + AE.layers.length) % AE.layers.length; show(n); buttons[n].focus(); }
      });
      tabs.appendChild(b); return b;
    });
    function show(i) {
      var L = AE.layers[i];
      buttons.forEach(function (b, j) { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
      list.setAttribute('aria-labelledby', 'alt-' + L.id);
      desc.textContent = L.desc;
      list.innerHTML = '';
      L.items.forEach(function (it, n) {
        var li = el('li', 'al-row');
        var id = 'al-p-' + L.id + n;
        var head = btn('<span class="al-n">' + String(n + 1).padStart(2, '0') + '</span><span class="al-t">' + esc(it.t) + '</span><span class="al-ctl">' + it.controls.join(' &middot; ') + '</span><span class="al-x" aria-hidden="true"></span>', 'al-head', { 'aria-expanded': n === 0 ? 'true' : 'false', 'aria-controls': id });
        var panel = el('div', 'al-panel', '<dl><div><dt>What the agent does</dt><dd>' + esc(it.agent) + '</dd></div><div><dt>Alignment check</dt><dd>' + esc(it.check) + '</dd></div>' +
          '<div><dt>Controls embedded</dt><dd>' + it.controls.map(function (c) { return cid(c) + ' ' + esc(cname(c)); }).join('<br>') + '</dd></div><div><dt>Evidence</dt><dd>' + esc(it.evidence) + '</dd></div></dl>');
        panel.id = id; panel.hidden = n !== 0;
        head.addEventListener('click', function () { var o = head.getAttribute('aria-expanded') === 'true'; head.setAttribute('aria-expanded', String(!o)); panel.hidden = o; });
        li.appendChild(head); li.appendChild(panel); list.appendChild(li);
      });
    }
    var start = 0, m = /^#layer-(\w+)/.exec(location.hash);
    if (m) AE.layers.forEach(function (L, i) { if (L.id === m[1]) start = i; });
    show(start);
  }

  /* ---------- Hub: one request through the stack ---------- */
  function hubFlow(root) {
    var STEPS = [
      ['Channels and signals', 'Email', 'A customer disputes invoice 90417417 by email.'],
      ['Human command', 'Charter', 'The charter and the do-not-automate list set the limits. The AR lead owns this agent.'],
      ['Orchestration', 'Workflow engine', 'The workflow engine starts the dispute flow and queues the case.'],
      ['Agents', 'Finance agent', 'The dispute agent plans: read the contract, the invoice and the proof of delivery.'],
      ['Intelligence', 'GPT-class + retrieval', 'A GPT-class model reads the contract. Retrieval grounds every claim in a source.'],
      ['Harness', 'Policy and limits', 'Limits, the decision threshold L \u00f7 (G + L) and verification check the proposal. The trace is written.'],
      ['Tools and integration', 'Released interface', 'Inside limits, a released interface commits the $1,000 credit (illustrative).'],
      ['Data and context', 'Ledger', 'The system of record updates, and the ledger tie-out confirms the posting.'],
      ['Assurance', 'Trace and evals', 'The trace store keeps the evidence. A 5% sample goes to a reviewer.']
    ];
    root.innerHTML = '<div class="hf"><div class="hf-svg-wrap"></div><div class="hf-side"><div class="lr-console"><div class="lr-bar"><span></span><span></span><span></span><b>Request trace &middot; illustrative</b></div><ol class="hf-log" aria-live="polite"></ol></div>' +
      '<div class="hf-ctl"></div></div></div>';
    var W = 560, H = 9 * 50 + 20;
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'hf-svg', role: 'img', 'aria-label': 'Nine layers of the stack with a request flowing through them' });
    $('.hf-svg-wrap', root).appendChild(svg);
    var pts = [], bands = sv('g', {}, svg), line = sv('polyline', { class: 'hf-line' }, svg), nodes = sv('g', {}, svg);
    STEPS.forEach(function (s, i) {
      var y = 10 + i * 50, nx = i % 2 ? 420 : 330;
      var g = sv('g', { class: 'hf-row', 'data-i': i }, bands);
      sv('rect', { x: 4, y: y, width: W - 8, height: 42, rx: 8, class: 'hf-band' }, g);
      var tx = sv('text', { x: 18, y: y + 26, class: 'hf-name' }, g); tx.textContent = s[0];
      var gn = sv('g', { class: 'hf-row', 'data-i': i }, nodes);
      sv('rect', { x: nx - 70, y: y + 8, width: 140, height: 26, rx: 13, class: 'hf-node' }, gn);
      var t2 = sv('text', { x: nx, y: y + 25, class: 'hf-node-t', 'text-anchor': 'middle' }, gn); t2.textContent = s[1];
      pts.push([nx, y + 21]);
    });
    line.setAttribute('points', pts.map(function (p) { return p.join(','); }).join(' '));
    var tok = sv('circle', { r: 9, class: 'tok', cx: pts[0][0], cy: pts[0][1] }, svg);
    var log = $('.hf-log', root), ctl = $('.hf-ctl', root), run = 0, playing = false;
    var play = btn('Replay', 'pill pill-dark'); ctl.appendChild(play);
    play.addEventListener('click', function () { start(); });
    async function start() {
      var my = ++run; playing = true; log.innerHTML = '';
      function live() { return my === run; }
      for (var i = 0; i < STEPS.length; i++) {
        $$('.hf-row', svg).forEach(function (g) { g.classList.toggle('on', +g.dataset.i === i); g.classList.toggle('done', +g.dataset.i < i); });
        await moveToken(tok, i ? pts[i - 1] : null, pts[i], 600, live);
        if (!live()) return;
        var li = el('li', '', '<b>' + String(i + 1).padStart(2, '0') + ' ' + esc(STEPS[i][0]) + '</b><span></span>');
        log.appendChild(li);
        await typeInto($('span', li), STEPS[i][2], live);
        await wait(350); if (!live()) return;
      }
      playing = false;
    }
    if (reduce) { STEPS.forEach(function (s, i) { log.appendChild(el('li', '', '<b>' + String(i + 1).padStart(2, '0') + ' ' + esc(s[0]) + '</b><span>' + esc(s[2]) + '</span>')); }); return; }
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { threshold: 0.3 }) : null;
    if (io) io.observe(root); else start();
  }

  /* ---------- Architecture: layered diagram, side panel, variations ---------- */
  var SHORT = { llm: 'GPT-class LLMs', slm: 'Small and open models', rag: 'Embeddings and RAG', kg: 'Knowledge graphs', ml: 'Classical ML and forecasting',
    rl: 'Reinforcement learning', rules: 'Rules engines and RPA', twin: 'Simulation and digital twins', phys: 'Physical AI', speech: 'Speech in and out',
    mm: 'Multimodal and vision', inbox: 'Approval inbox', iot: 'IoT and edge sensors', planner: 'Planner and supervisor', toolc: 'Tool contracts (MCP-style)' };
  // Simple line icons per layer, drawn in a 20x20 box.
  var ICONS = {
    ch: 'M3 10a7 7 0 0 1 14 0M6 10a4 4 0 0 1 8 0M10 10v8',
    hum: 'M10 3a3 3 0 1 1 0 6a3 3 0 1 1 0-6M4 18c0-4 3-6 6-6s6 2 6 6',
    orc: 'M4 4h4v4H4zM12 12h4v4h-4zM12 4h4v4h-4zM8 6h4M14 8v4',
    agt: 'M5 7h10v9H5zM8 11h.01M12 11h.01M10 3v4M7 16v2M13 16v2',
    int: 'M10 3a7 7 0 1 1 0 14a7 7 0 1 1 0-14M7 9h.01M13 9h.01M10 12v2M6 6l2 2M14 6l-2 2',
    har: 'M10 2l7 3v5c0 4-3 7-7 8c-4-1-7-4-7-8V5zM7 10l2 2l4-4',
    tool: 'M13 3a4 4 0 0 0-4 5l-6 6l3 3l6-6a4 4 0 0 0 5-4l-2 2l-2-2l2-2z',
    dat: 'M4 5c0-2 12-2 12 0v10c0 2-12 2-12 0zM4 5c0 2 12 2 12 0M4 10c0 2 12 2 12 0',
    asr: 'M10 2a8 8 0 1 1 0 16a8 8 0 1 1 0-16M6 10l3 3l5-6'
  };
  function architecture(root) {
    var lf = layerFilter(applyLayer);
    root.innerHTML = '<div class="ar-top"><p class="lf-label">Architecture pattern</p><div class="ar-vars" role="group" aria-label="Architecture patterns"></div></div>' +
      '<div class="ar-svg-wrap" tabindex="0" role="region" aria-label="Architecture diagram, scroll sideways on small screens"></div>' +
      '<div class="ar-grid"><div class="lr-console ar-console"><div class="lr-bar"><span></span><span></span><span></span><b class="ar-title">Pick a pattern to watch a request flow</b></div><ol class="ar-log" aria-live="polite"></ol><div class="ar-ctl"></div></div>' +
      '<aside class="ar-side"><div class="ar-panel" aria-live="polite"></div></aside></div>';
    root.insertBefore(lf.el, root.firstChild);
    var X0 = 186, WIDTH = 1010, BH = 48, GAP = 8, PAD = 12, y = 8, boxes = {};
    var svg = sv('svg', { class: 'ar-svg', role: 'group', 'aria-label': 'Reference architecture in nine layers' });
    var gBands = sv('g', {}, svg), gPath = sv('g', {}, svg), gBoxes = sv('g', {}, svg);
    AE.archLayers.forEach(function (L, li) {
      var comps = AE.components.filter(function (c) { return c.layer === L.id; });
      var rows = comps.length > 8 ? 2 : 1, cols = Math.ceil(comps.length / rows);
      var h = rows * BH + (rows - 1) * GAP + PAD * 2;
      sv('rect', { x: 0, y: y, width: X0 + WIDTH + 6, height: h, rx: 10, class: 'ar-band' + (L.id === 'har' ? ' ar-band-har' : li % 2 ? ' ar-band-alt' : '') }, gBands);
      sv('path', { d: ICONS[L.id], transform: 'translate(12,' + (y + h / 2 - 10) + ')', class: 'ar-icon' }, gBands);
      textLines(gBands, 40, y + h / 2 - (wrap(L.name, 18).length - 1) * 7 + 4, wrap(L.name, 18), { class: 'ar-lname' }, 14);
      var bw = (WIDTH - (cols - 1) * GAP) / cols;
      comps.forEach(function (c, i) {
        var r = Math.floor(i / cols), k = i % cols, bx = X0 + k * (bw + GAP), by = y + PAD + r * (BH + GAP);
        var g = sv('g', { class: 'ar-c', tabindex: '0', role: 'button', 'data-id': c.id, 'aria-label': c.name }, gBoxes);
        sv('rect', { x: bx, y: by, width: bw, height: BH, rx: 8 }, g);
        var lines = wrap(SHORT[c.id] || c.name.replace(/\s*\(.*\)$/, ''), Math.max(10, Math.floor(bw / 7)), 2);
        textLines(g, bx + bw / 2, by + BH / 2 + 4 - (lines.length - 1) * 7, lines, { 'text-anchor': 'middle' }, 14);
        boxes[c.id] = [bx + bw / 2, by + BH / 2];
        g.addEventListener('click', function () { select(c.id); });
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(c.id); } });
      });
      y += h + 6;
    });
    svg.setAttribute('viewBox', '0 0 ' + (X0 + WIDTH + 6) + ' ' + y);
    $('.ar-svg-wrap', root).appendChild(svg);
    var panel = $('.ar-panel', root);
    function select(id) {
      var c = AE.componentById[id], L = AE.archLayers.filter(function (x) { return x.id === c.layer; })[0];
      $$('.ar-c', svg).forEach(function (g) { g.classList.toggle('sel', g.dataset.id === id); });
      var fam = AE.models.filter(function (m) { return m.id === id; })[0];
      panel.innerHTML = '<p class="ar-kicker">' + esc(L.name) + '</p><h3>' + esc(c.name) + '</h3><p>' + esc(c.what) + '</p>' +
        '<dl class="ar-dl"><div><dt>Use it when</dt><dd>' + esc(c.use) + '</dd></div><div><dt>Do not use it for</dt><dd>' + esc(c.avoid) + '</dd></div>' +
        '<div><dt>Typical model family</dt><dd>' + esc(AE.modelNames[c.model] || c.model) + '</dd></div>' +
        (fam ? '<div><dt>Evals you need</dt><dd>' + esc(fam.evals) + '</dd></div>' : '') +
        '<div><dt>Controls it enforces</dt><dd>' + (c.controls.length ? c.controls.map(function (x) { return cid(x) + ' ' + esc(cname(x)); }).join('<br>') : '&ndash;') + '</dd></div>' +
        '<div><dt>Main failure mode</dt><dd>' + esc(c.fail) + '</dd></div><div><dt>Autonomy ceiling hint</dt><dd>' + esc(c.ceil) + '</dd></div>' +
        '<div><dt>Layers aligned</dt><dd>' + layerStrip(c.layers, lf.get()) + '</dd></div>' +
        '<div><dt>Related framework</dt><dd><a href="/frameworks/#' + c.fw + '">' + esc(AE.frameworkNames[c.fw]) + '</a></dd></div></dl>' +
        (c.link ? '<p class="ar-link"><a class="btn btn-dark" href="' + c.link.href + '">' + esc(c.link.label) + '</a></p>' : '');
    }
    function applyLayer(l) {
      $$('.ar-c', svg).forEach(function (g) {
        var c = AE.componentById[g.dataset.id], on = l && c.layers.indexOf(l) >= 0;
        g.classList.toggle('al-on', !!on); g.classList.toggle('al-dim', !!l && !on);
      });
      var s = $('.ar-c.sel', svg); if (s) select(s.dataset.id);
    }
    // Variations
    var vars = $('.ar-vars', root), log = $('.ar-log', root), title = $('.ar-title', root), ctl = $('.ar-ctl', root), run = 0, current = null;
    var tok = sv('circle', { r: 9, class: 'tok', cx: -20, cy: -20 }, svg);
    var replay = btn('Replay', 'pill pill-dark'); replay.disabled = true; ctl.appendChild(replay);
    var clear = btn('Clear pattern', 'pill pill-ghost'); clear.disabled = true; ctl.appendChild(clear);
    replay.addEventListener('click', function () { if (current) play(current); });
    clear.addEventListener('click', function () { run++; current = null; reset(); });
    AE.variations.forEach(function (v, i) {
      var b = btn('<b>' + String.fromCharCode(97 + i) + '</b> ' + esc(v.name) + ' <span>' + v.level + '</span>', 'pill ar-var', { 'aria-pressed': 'false', 'data-v': v.id });
      b.addEventListener('click', function () { play(v); });
      vars.appendChild(b);
    });
    function reset() {
      gPath.innerHTML = ''; log.innerHTML = ''; title.textContent = 'Pick a pattern to watch a request flow';
      tok.setAttribute('cx', -20); tok.setAttribute('cy', -20); svg.classList.remove('has-path');
      $$('.ar-c', svg).forEach(function (g) { g.classList.remove('on', 'cur'); });
      $$('.ar-var', vars).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      replay.disabled = clear.disabled = true;
      $$('.ar-vlink', ctl).forEach(function (a) { a.remove(); });
    }
    async function play(v) {
      var my = ++run; current = v; reset(); replay.disabled = clear.disabled = false;
      function live() { return my === run; }
      $$('.ar-var', vars).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === v.id)); });
      title.textContent = v.name + ' \u00b7 ' + v.level + ' \u00b7 ' + v.desc;
      if (v.link) ctl.appendChild(el('a', 'pill pill-ghost ar-vlink', esc(v.link.label))).setAttribute('href', v.link.href);
      svg.classList.add('has-path');
      var pts = v.path.map(function (p) { return boxes[p[0]]; });
      var ids = v.path.map(function (p) { return p[0]; });
      $$('.ar-c', svg).forEach(function (g) { g.classList.toggle('on', ids.indexOf(g.dataset.id) >= 0); });
      sv('polyline', { points: pts.map(function (p) { return p.join(','); }).join(' '), class: 'ar-path' }, gPath);
      for (var i = 0; i < v.path.length; i++) {
        $$('.ar-c', svg).forEach(function (g) { g.classList.toggle('cur', g.dataset.id === v.path[i][0]); });
        await moveToken(tok, i ? pts[i - 1] : null, pts[i], 650, live);
        if (!live()) return;
        var li = el('li', '', '<b>' + String(i + 1).padStart(2, '0') + ' ' + esc(AE.componentById[v.path[i][0]].name) + '</b><span></span>');
        log.appendChild(li);
        await typeInto($('span', li), v.path[i][1], live);
        await wait(300); if (!live()) return;
      }
    }
    select('H3');
  }

  /* ---------- Model chooser ---------- */
  function chooser(root) {
    root.innerHTML = '<fieldset class="mc-q"><legend>Describe the task</legend></fieldset><div class="mc-out" aria-live="polite"></div>';
    var fs = $('.mc-q', root);
    AE.chooser.forEach(function (q) { var l = el('label', 'mc-opt', '<input type="checkbox" value="' + q.id + '"> ' + esc(q.q)); fs.appendChild(l); });
    $('input[value="lang"]', fs).checked = true; $('input[value="reg"]', fs).checked = true;
    function upd() {
      var on = $$('input:checked', fs).map(function (i) { return i.value; });
      var score = {}, why = {}, ctl = [];
      AE.chooser.forEach(function (q) {
        if (on.indexOf(q.id) < 0) return;
        ctl = ctl.concat(q.ctl.split(' '));
        Object.keys(q.fam).forEach(function (f) { score[f] = (score[f] || 0) + q.fam[f]; (why[f] = why[f] || []).push(q.why); });
      });
      var fams = Object.keys(score).sort(function (a, b) { return score[b] - score[a]; }).slice(0, 4);
      var out = $('.mc-out', root);
      if (!fams.length) { out.innerHTML = '<p class="ix-result">Pick at least one property. With no special needs, start with rules and a workflow engine.</p>'; return; }
      var models = fams.map(function (f) { return AE.models.filter(function (m) { return m.id === f; })[0]; });
      models.forEach(function (m) { ctl = ctl.concat(m.mand.split(' ')); });
      ctl = uniq(ctl);
      out.innerHTML = '<ol class="mc-list">' + models.map(function (m, i) {
        return '<li><h4>' + (i + 1) + '. ' + esc(AE.componentById[m.id].name) + '</h4><p>' + esc(uniq(why[m.id]).join(' ')) + '</p><p><b>Evals:</b> ' + esc(m.evals) + '. <b>Typical ceiling:</b> ' + esc(m.ceil) + '.</p></li>';
      }).join('') + '</ol><p class="mc-ctl"><b>Mandatory controls:</b> ' + ctl.map(function (c) { return cid(c); }).join(' ') + '</p>' +
        '<p class="fw-note">A guide, not a rule. Rules before models, workflows before agents.</p>';
    }
    fs.addEventListener('change', upd); upd();
  }

  /* ---------- Shared: swimlane renderer ---------- */
  /* Laid out for the width it gets, drawn at 1:1 so text keeps its CSS size. When the steps fit (CW >= CWMIN)
     the diagram fills its box with no sideways scroll; otherwise (phones, long designer flows) it scrolls
     under a solid sticky lane-label column. Redraws itself when its box changes width, keeping step state. */
  var SL = { LW: 128, CW: 156, BW: 140, LH: 112, BH: 74, CWMIN: 104, CWSCROLL: 136, NAME_PX: 13, LINE: 15 };
  function chainOf(steps) {
    var min = 5, weak = [];
    steps.forEach(function (s) { if (s.ex) return; if (s.lvl != null) min = Math.min(min, s.lvl); if (s.ho) min = Math.min(min, HO_CEIL[s.ho]); });
    steps.forEach(function (s) {
      if (s.ex) return;
      if (s.lvl === min) weak.push({ id: s.id, why: s.name + ' (' + lvl(s.lvl) + ')' });
      else if (s.ho && HO_CEIL[s.ho] === min) weak.push({ id: s.id, why: HO_NAME[s.ho] + ' handoff into \u201c' + s.name + '\u201d (L' + min + ')' });
    });
    return { level: min, weak: weak };
  }
  var measureCtx = null;
  function textWidth(t, font) {
    if (!measureCtx) { try { measureCtx = document.createElement('canvas').getContext('2d'); } catch (e) { measureCtx = false; } }
    if (!measureCtx) return String(t).length * 7;
    measureCtx.font = font; return measureCtx.measureText(t).width;
  }
  // Wrap text to a pixel width; the last allowed line ends with an ellipsis when text is cut.
  function wrapPx(text, maxPx, max, font) {
    var words = String(text).split(' '), lines = [], cur = '';
    words.forEach(function (w) { var t = (cur + ' ' + w).trim(); if (cur && textWidth(t, font) > maxPx) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    if (max && lines.length > max) {
      lines = lines.slice(0, max);
      var last = lines[max - 1];
      while (last.indexOf(' ') > 0 && textWidth(last + '\u2026', font) > maxPx) last = last.replace(/\s*\S*$/, '');
      lines[max - 1] = last + '\u2026';
    }
    return lines;
  }
  var slState = typeof WeakMap === 'function' ? new WeakMap() : null;
  function drawSwimlane(host, steps, opts) {
    opts = opts || {};
    var prev = slState && slState.get(host);
    if (prev && prev.ro) prev.ro.disconnect();
    var api = { svg: null, pos: {}, laneY: {}, cw: SL.CW, lh: SL.LH, lw: SL.LW, fit: false };
    var drawnFor = -1;
    function layout(avail) {
      var n = Math.max(1, steps.length), lw = avail && avail < 640 ? 90 : 104, pad = 8;
      var cw = avail ? (avail - lw - pad) / n : 0, fit = cw >= SL.CWMIN;
      if (!fit) cw = SL.CWSCROLL;
      var bw = Math.min(cw - 10, 210), maxLines = opts.compact ? 2 : bw < 120 ? 5 : 4;
      var font = '400 ' + SL.NAME_PX + 'px ' + (getComputedStyle(host).fontFamily || 'sans-serif');
      var names = steps.map(function (s) { return wrapPx(s.name, bw - 16, maxLines, font); });
      var lines = Math.max.apply(null, names.map(function (l) { return l.length; }).concat([2]));
      var bh = (opts.compact ? 32 : 34) + lines * SL.LINE;
      return { n: n, lw: lw, cw: cw, bw: bw, bh: bh, lh: bh + (opts.compact ? 12 : 32), names: names, fit: fit, w: fit ? Math.floor(avail - lw) : Math.ceil(n * cw + pad) };
    }
    function draw() {
      var avail = host.clientWidth;
      drawnFor = avail;
      // Keep what the visitor or a running case left on the steps.
      var keep = {}, tokEl = api.svg ? $('.tok', api.svg) : null;
      if (api.svg) $$('.sl-step', api.svg).forEach(function (g) { keep[g.dataset.id] = ['sel', 'cur', 'done', 'hit', 'waited', 'waiting'].filter(function (c) { return g.classList.contains(c); }); });
      var Lo = layout(avail), lanes = opts.lanes ? AE.lanes.filter(function (L) { return opts.lanes.indexOf(L.id) >= 0; }) : AE.lanes, H = lanes.length * Lo.lh, W = Lo.w;
      host.innerHTML = '';
      host.classList.toggle('sl-fit', Lo.fit);
      var row = el('div', 'sl-row');
      var lab = sv('svg', { viewBox: '0 0 ' + Lo.lw + ' ' + H, width: Lo.lw, height: H, class: 'sl-lab', 'aria-hidden': 'true' });
      var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'sl-svg', role: 'group', 'aria-label': opts.label || 'Swimlane diagram' });
      var defs = sv('defs', {}, svg), mk = sv('marker', { id: 'sl-arrow-' + (opts.key || 'a'), viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      sv('path', { d: 'M0 0L10 5L0 10z', class: 'sl-arrowhead' }, mk);
      var laneY = {};
      lanes.forEach(function (L, i) {
        var y = i * Lo.lh, cls = 'sl-lane' + (i % 2 ? ' alt' : '') + (L.id === 'harness' ? ' har' : '');
        laneY[L.id] = y;
        sv('rect', { x: 0, y: y, width: Lo.lw, height: Lo.lh, class: cls }, lab);
        sv('rect', { x: 0, y: y, width: W, height: Lo.lh, class: cls }, svg);
        var ln = wrap(L.name, Lo.lw < 100 ? 9 : 10);
        textLines(lab, 10, y + Lo.lh / 2 + 4 - (ln.length - 1) * 7.5, ln, { class: 'sl-lname' }, 15);
      });
      sv('line', { x1: Lo.lw - 0.5, y1: 0, x2: Lo.lw - 0.5, y2: H, class: 'sl-lab-edge' }, lab);
      var gA = sv('g', {}, svg), gB = sv('g', {}, svg), pos = {}, nL = AE.layers.length, seg = Lo.bw / nL;
      steps.forEach(function (s, i) {
        var bx = i * Lo.cw + (Lo.cw - Lo.bw) / 2 + 3, by = laneY[s.lane] + (opts.compact ? 6 : 10);
        pos[s.id] = { x: bx, y: by, cx: bx + Lo.bw / 2, cy: by + Lo.bh / 2, col: i };
        var weak = opts.weak && opts.weak.indexOf(s.id) >= 0;
        var al = opts.layer ? s.layers.indexOf(opts.layer) >= 0 : false;
        var g = sv('g', { class: 'sl-step' + (s.ex ? ' ex' : '') + (weak ? ' weak' : '') + (s.lane === 'harness' ? ' har' : '') + (opts.layer ? (al ? ' al-on' : ' al-dim') : '') + (keep[s.id] && keep[s.id].length ? ' ' + keep[s.id].join(' ') : ''), tabindex: '0', role: 'button', 'data-id': s.id,
          'aria-label': 'Step ' + (i + 1) + ': ' + s.name + ', ' + lvl(s.lvl) + (s.ex ? ', exception path' : '') + (opts.queues && AE.isQueueWait(s) ? ', queue wait before this step' : '') }, gB);
        sv('rect', { x: bx, y: by, width: Lo.bw, height: Lo.bh, rx: 8, class: 'sl-box' }, g);
        sv('rect', { x: bx + 6, y: by + 6, width: 38, height: 19, rx: 9.5, class: 'sl-badge l' + (s.lvl == null ? 'r' : s.lvl) }, g);
        var bt = sv('text', { x: bx + 25, y: by + 20, 'text-anchor': 'middle', class: 'sl-badge-t' }, g); bt.textContent = lvl(s.lvl);
        var nt = sv('text', { x: bx + Lo.bw - 8, y: by + 20, 'text-anchor': 'end', class: 'sl-num' }, g); nt.textContent = String(i + 1).padStart(2, '0');
        var tl = textLines(g, bx + 8, by + (opts.compact ? 40 : 42), Lo.names[i], { class: 'sl-name' }, SL.LINE);
        if (Lo.names[i].join(' ') !== s.name) { var tt = sv('title', {}, g); tt.textContent = s.name; g.insertBefore(tt, g.firstChild); }
        if (opts.queues && AE.isQueueWait(s)) {
          // Queue clock: shown once the case has waited here (side-by-side run).
          var q = sv('g', { class: 'sl-q' }, g), qx = bx + Lo.bw - 38, qy = by + 15;
          sv('circle', { cx: qx, cy: qy, r: 7, class: 'sl-q-face' }, q);
          sv('path', { d: 'M' + qx + ' ' + (qy - 4) + 'V' + qy + 'H' + (qx + 3), class: 'sl-q-hand' }, q);
        }
        if (!opts.compact) AE.layers.forEach(function (L, k) {
          var on = s.layers.indexOf(L.id) >= 0;
          sv('rect', { x: bx + k * seg, y: by + Lo.bh + 5, width: seg - 2.5, height: 7, rx: 2, class: 'sl-ls' + (on ? ' on' : '') + (opts.layer === L.id ? ' cur' : '') }, g);
        });
        g.addEventListener('click', function () { if (opts.onSelect) opts.onSelect(s, i); });
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (opts.onSelect) opts.onSelect(s, i); } });
      });
      function arrow(a, b, dashed) {
        var A = pos[a.id], B = pos[b.id], x1 = A.x + Lo.bw, y1 = A.cy, x2 = B.x, y2 = B.cy, mx = (x1 + x2) / 2;
        sv('path', { d: 'M' + x1 + ' ' + y1 + 'H' + mx + 'V' + y2 + 'H' + (x2 - 2), class: 'sl-arrow' + (dashed ? ' dash' : ''), 'marker-end': 'url(#sl-arrow-' + (opts.key || 'a') + ')' }, gA);
      }
      var lastMain = null;
      steps.forEach(function (s, i) {
        if (s.ex) { if (lastMain) arrow(lastMain, s, true); var nx = steps.slice(i + 1).filter(function (x) { return !x.ex; })[0]; if (nx) arrow(s, nx, true); return; }
        if (lastMain) arrow(lastMain, s, false);
        lastMain = s;
      });
      row.appendChild(lab); row.appendChild(svg); host.appendChild(row);
      var ringEl = api.svg ? $('.tok-wait', api.svg) : null;
      if (ringEl) svg.appendChild(ringEl);
      if (tokEl) {
        svg.appendChild(tokEl);
        var cur = $('.sl-step.cur', svg) || $('.sl-step.hit', svg);
        if (!cur && opts.keepLast) { var dn = $$('.sl-step.done', svg); cur = dn[dn.length - 1]; }
        if (cur && pos[cur.dataset.id]) { tokEl.setAttribute('cx', pos[cur.dataset.id].cx); tokEl.setAttribute('cy', pos[cur.dataset.id].cy); if (ringEl) { ringEl.setAttribute('cx', pos[cur.dataset.id].cx); ringEl.setAttribute('cy', pos[cur.dataset.id].cy); } }
      }
      api.svg = svg; api.pos = pos; api.laneY = laneY; api.cw = Lo.cw; api.lh = Lo.lh; api.lw = Lo.lw; api.fit = Lo.fit;
    }
    draw();
    var st = { ro: null };
    if (window.ResizeObserver) {
      var q = false;
      st.ro = new ResizeObserver(function () {
        if (q) return; q = true;
        (window.requestAnimationFrame || setTimeout)(function () { q = false; if (host.isConnected && host.clientWidth > 0 && Math.abs(host.clientWidth - drawnFor) > 1) draw(); });
      });
      st.ro.observe(host);
    }
    if (slState) slState.set(host, st);
    return api;
  }
  function stepDetail(s, layer) {
    var ctls = s.controls;
    return '<p class="ar-kicker">' + esc(LANE_NAME[s.lane]) + (s.ex ? ' &middot; exception path' : '') + '</p><h3>' + esc(s.name) + '</h3>' +
      '<dl class="ar-dl"><div><dt>Autonomy level</dt><dd>' + (s.lvl == null ? 'Deterministic rule or outside party. No model decides here.' : '<b>L' + s.lvl + '</b> ' + esc(LEVEL_MEANING[s.lvl])) + '</dd></div>' +
      '<div><dt>Model family</dt><dd>' + esc(AE.modelNames[s.model] || '&ndash;') + '</dd></div>' +
      (s.ho ? '<div><dt>Handoff in</dt><dd>' + esc(HO_NAME[s.ho]) + ', ceiling L' + HO_CEIL[s.ho] + '</dd></div>' : '') +
      '<div><dt>Controls embedded</dt><dd>' + (ctls.length ? ctls.map(function (c) { return cid(c) + ' ' + esc(cname(c)); }).join('<br>') : 'None') + '</dd></div>' +
      (s.ev ? '<div><dt>Evidence and KPI</dt><dd>' + esc(s.ev) + '</dd></div>' : '') + '</dl>' +
      (s.card ? '<div class="dcard"><p class="dcard-k">Decision card: what the person sees</p><p>' + esc(s.card) + '</p></div>' : '') +
      '<div class="la"><p class="dcard-k">Layer alignment for this step</p><ul class="la-list">' + AE.layers.map(function (L) {
        var ids = ctls.filter(function (c) { return AE.controlById[c] && AE.controlById[c].layers.indexOf(L.id) >= 0; });
        return '<li class="' + (ids.length ? 'on' : 'off') + (layer === L.id ? ' cur' : '') + '"><span>' + esc(L.name) + '</span><span>' + (ids.length ? ids.join(' ') : 'no check at this step') + '</span></li>';
      }).join('') + '</ul></div>';
  }

  /* ---------- Workflows player ---------- */
  function workflows(root) {
    var st = { wf: 0, view: 're', layer: null, sel: null };
    var hash = /^#wf-(\w+)/.exec(location.hash);
    if (hash) AE.workflows.forEach(function (w, i) { if (w.id === hash[1]) st.wf = i; });
    var lf = layerFilter(function (l) { st.layer = l; render(); });
    root.innerHTML = '<div class="wf-tabs" role="group" aria-label="Workflows"></div><div class="wf-bar"><div class="wf-view" role="group" aria-label="View"></div><p class="wf-chain" aria-live="polite"></p></div>' +
      '<div class="sl-wrap wf-single" tabindex="0" role="region" aria-label="Swimlane diagram"></div>' +
      '<div class="wf-both" hidden><p class="wf-both-cap"><b>Today</b> <span>As-is best practice: lanes, manual hand-offs, approval queues.</span></p>' +
      '<div class="sl-wrap wf-sl-today" tabindex="0" role="region" aria-label="Today swimlane"></div>' +
      '<p class="wf-both-cap wf-both-re"><b>Agent-run</b> <span>Agents act within limits; people approve exceptions.</span></p>' +
      '<div class="sl-wrap wf-sl-re" tabindex="0" role="region" aria-label="Agent-run swimlane"></div>' +
      '<p class="fw-note wf-pace"><span class="wf-pace-k" aria-hidden="true"></span> The clock marks a queue wait: a hand-off by hand, email or scheduled file. Waits are illustrative pacing (animation speed, not real time).</p></div>' +
      '<div class="wf-grid"><div><div class="wf-run"><div class="wf-run-btns"></div><p class="lf-label">Inject a failure</p><div class="wf-fails" role="group" aria-label="Failure injection"></div></div>' +
      '<div class="lr-console wf-console"><div class="lr-bar"><span></span><span></span><span></span><b class="wf-ctitle">Case console</b></div><ol class="wf-log" aria-live="polite"></ol><div class="wf-result" aria-live="polite"></div></div>' +
      '<div class="wf-metrics"></div></div><aside class="ar-side"><div class="ar-panel wf-panel" aria-live="polite"></div></aside></div>';
    var tabs = $('.wf-tabs', root);
    root.insertBefore(lf.el, $('.wf-single', root));
    AE.workflows.forEach(function (w, i) {
      var b = btn('<b>' + (i + 1) + '</b> ' + esc(w.short), 'pill', { 'aria-pressed': 'false' });
      b.addEventListener('click', function () { st.wf = i; st.sel = null; run++; render(); });
      tabs.appendChild(b);
    });
    var view = $('.wf-view', root);
    [['today', 'Today'], ['re', 'Reimagined'], ['both', 'Side by side']].forEach(function (v) {
      var b = btn(v[1], 'seg', { 'aria-pressed': String(v[0] === st.view), 'data-v': v[0] });
      b.addEventListener('click', function () { st.view = v[0]; st.sel = null; run++; render(); });
      view.appendChild(b);
    });
    var runBtn = btn('Run it', 'btn btn-primary wf-runbtn'); $('.wf-run-btns', root).appendChild(runBtn);
    runBtn.addEventListener('click', function () { if (st.view === 'both') goBoth(); else go(null); });
    var both = $('.wf-both', root), hostT = $('.wf-sl-today', root), hostR = $('.wf-sl-re', root), pair = null;
    var host = $('.wf-single', root), panel = $('.wf-panel', root), log = $('.wf-log', root), result = $('.wf-result', root), run = 0, lane = null, tok = null;
    function steps() { var w = AE.workflows[st.wf]; return st.view === 'today' ? w.today : w.steps; }
    function usedLanes(ss) { return uniq(ss.map(function (s) { return s.lane; })); }
    function drawPair(w) {
      function one(h, ss, key, name) {
        var ch = chainOf(ss);
        var api = drawSwimlane(h, ss, { layer: st.layer, weak: ch.weak.map(function (x) { return x.id; }), key: key, label: w.name + ', ' + name, lanes: usedLanes(ss), compact: true, queues: true, keepLast: true,
          onSelect: function (s) { st.sel = s.id; select(s); } });
        api.ring = sv('circle', { r: 17, class: 'tok-wait', cx: -40, cy: -40 }, api.svg);
        api.tok = sv('circle', { r: 10, class: 'tok', cx: -30, cy: -30 }, api.svg);
        return api;
      }
      return { today: one(hostT, w.today, 'wft', 'today'), re: one(hostR, w.steps, 'wfr', 'agent-run') };
    }
    function svgs() { return pair ? [pair.today.svg, pair.re.svg] : [lane.svg]; }
    function render() {
      var w = AE.workflows[st.wf], ss = steps(), ch = chainOf(ss), isBoth = st.view === 'both';
      $$('button', tabs).forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === st.wf)); });
      $$('button', view).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === st.view)); });
      host.hidden = isBoth; both.hidden = !isBoth;
      runBtn.textContent = isBoth ? 'Run both' : 'Run it';
      if (isBoth) {
        var cT = chainOf(w.today);
        $('.wf-chain', root).innerHTML = '<b>Same case, two flows.</b> Chain level L' + cT.level + ' today, L' + ch.level + ' agent-run, by the weakest-link rule. <a href="/frameworks/#weakest-link">Why</a>';
        pair = drawPair(w); lane = null; tok = null;
      } else {
        pair = null;
        $('.wf-chain', root).innerHTML = '<b>Chain level L' + ch.level + '</b> by the weakest-link rule. ' + (ch.weak.length > 2 ? 'Every main step and handoff is at L' + ch.level + ', so raise them together.' : 'Held by: ' + ch.weak.map(function (x) { return esc(x.why); }).join('; ') + '.') + ' <a href="/frameworks/#weakest-link">Why</a>';
        lane = drawSwimlane(host, ss, { layer: st.layer, weak: ch.weak.map(function (x) { return x.id; }), key: 'wf', label: w.name + ', ' + (st.view === 're' ? 'reimagined' : 'today'),
          onSelect: function (s) { st.sel = s.id; select(s); } });
        tok = sv('circle', { r: 10, class: 'tok', cx: -30, cy: -30 }, lane.svg);
      }
      var fails = $('.wf-fails', root); fails.innerHTML = '';
      $('.wf-run .lf-label', root).hidden = isBoth;
      if (isBoth) fails.appendChild(el('span', 'muted wf-note', 'Failure injection runs in the Today or Reimagined view.'));
      else AE.failureTypes.forEach(function (ft) {
        var f = w.failures.filter(function (x) { return x.type === ft.id; })[0];
        if (!f) return;
        var b = btn(esc(ft.name), 'pill pill-warn');
        b.addEventListener('click', function () { go(f); });
        fails.appendChild(b);
      });
      if (st.view === 'today') fails.appendChild(el('span', 'muted wf-note', 'Today there is no harness. Inject a failure to see who catches it.'));
      var m = w.metrics;
      $('.wf-metrics', root).innerHTML = '<p class="dcard-k">Before and after &middot; illustrative</p><table class="wf-mt"><thead><tr><th scope="col"></th><th scope="col">Today</th><th scope="col">Reimagined</th></tr></thead><tbody>' +
        '<tr><th scope="row">Cycle time</th><td>' + m.today.cycle + '</td><td>' + m.re.cycle + '</td></tr><tr><th scope="row">Touches per case</th><td>' + m.today.touches + '</td><td>' + m.re.touches + '</td></tr>' +
        '<tr><th scope="row">Cost per completed outcome</th><td>' + m.today.cost + '</td><td>' + m.re.cost + '</td></tr><tr><th scope="row">Chain level</th><td>L' + chainOf(w.today).level + '</td><td>L' + chainOf(w.steps).level + '</td></tr></tbody></table>' +
        '<p class="fw-note">Illustrative figures, not client data. <a href="/frameworks/#' + w.fw + '">Related framework: ' + esc(AE.frameworkNames[w.fw]) + '</a></p>';
      log.innerHTML = ''; result.innerHTML = '';
      $('.wf-ctitle', root).textContent = 'Case console \u00b7 ' + w.short + ' \u00b7 ' + (isBoth ? 'side by side' : st.view === 're' ? 'reimagined' : 'today');
      var s = ss.filter(function (x) { return x.id === st.sel; })[0] || ss.filter(function (x) { return x.card; })[0] || ss[1];
      select(s);
    }
    function select(s) {
      svgs().forEach(function (svg) { $$('.sl-step', svg).forEach(function (g) { g.classList.toggle('sel', g.dataset.id === s.id); }); });
      panel.innerHTML = stepDetail(s, st.layer);
    }
    function line(cls, html) { var li = el('li', cls, html); log.appendChild(li); log.scrollTop = log.scrollHeight; return li; }
    async function go(fail) {
      var my = ++run; function live() { return my === run; }
      var ss = steps(), w = AE.workflows[st.wf];
      log.innerHTML = ''; result.innerHTML = '';
      placeBelowHeader(host);
      $$('.sl-step', lane.svg).forEach(function (g) { g.classList.remove('done', 'cur', 'hit'); });
      var prev = null, prevPos = null, main = ss.filter(function (s) { return !s.ex; }), t = 0, re = st.view === 're';
      function stamp(s) {
        t += re ? (s.lane === 'people' ? 600 : s.lane === 'outside' ? 0 : 4) : (s.ho === 'manual' ? 1.5 : s.ho === 'file' ? 0.5 : 0.1) * 86400;
        if (!re) return '+' + (t / 86400).toFixed(1) + 'd';
        return '+' + (t >= 60 ? Math.floor(t / 60) + 'm ' : '') + (t % 60) + 's';
      }
      if (fail) line('wf-l-warn', '<b>Injected</b><span>' + esc(fail.what) + '</span>');
      for (var i = 0; i < main.length; i++) {
        var s = main[i], p = lane.pos[s.id], g = $('.sl-step[data-id="' + s.id + '"]', lane.svg);
        g.classList.add('cur');
        if (!lane.fit) follow(host, p.cx + lane.lw - host.clientWidth / 2);
        var via = laneVia(prevPos, p);
        await moveToken(tok, prev, [p.cx, p.cy], via ? 700 : 550, live, via); if (!live()) return;
        prev = [p.cx, p.cy]; prevPos = p;
        select(s);
        var li = line('wf-l-step', '<b>' + stamp(s) + ' &middot; ' + String(ss.indexOf(s) + 1).padStart(2, '0') + ' ' + esc(LANE_NAME[s.lane]) + ' &middot; ' + lvl(s.lvl) + '</b><span></span>');
        await typeInto($('span', li), st.view === 're' ? s.log : s.name, live); if (!live()) return;
        if (st.view !== 're' && s.ho === 'manual') line('wf-l-warn', '<b>Manual handoff</b><span>A person reads, re-keys or waits. Ceiling L1.</span>');
        if (!re && fail && i === Math.min(2, main.length - 1)) {
          await wait(300); if (!live()) return;
          line('wf-l-stop', '<b>No control fires</b><span>' + esc(fail.what) + ' Nothing checks it. It is caught only if a person happens to notice.</span>');
          result.innerHTML = '<div class="lr-result lr-r-stop"><b>Undetected today</b><span>The error moves on. It surfaces later as a reversal, a complaint or an audit finding. In the reimagined flow, ' + cid(fail.control) + ' catches it at the step where it starts.</span></div>';
          return;
        }
        for (var k = 0; k < s.controls.length; k++) {
          var c = s.controls[k];
          if (fail && fail.step === s.id && fail.control === c) break;
          await wait(110); if (!live()) return;
          line('wf-l-ok', '<b>' + c + '</b><span>' + esc(cname(c)) + '</span>');
        }
        if (fail && fail.step === s.id) {
          await wait(250); if (!live()) return;
          g.classList.add('hit');
          line('wf-l-stop', '<b>Caught by ' + fail.control + '</b><span>' + esc(cname(fail.control)) + '</span>');
          var target = ss.filter(function (x) { return x.lane === fail.lane && ss.indexOf(x) > ss.indexOf(s); })[0];
          var dest = target ? [lane.pos[target.id].cx, lane.pos[target.id].cy] : [p.cx + lane.cw / 2, lane.laneY[fail.lane] + lane.lh / 2];
          if (target) $('.sl-step[data-id="' + target.id + '"]', lane.svg).classList.add('cur');
          var tp = target ? lane.pos[target.id] : null, rv = laneVia(p, tp);
          if (tp && !lane.fit) follow(host, tp.cx + lane.lw - host.clientWidth / 2);
          await moveToken(tok, prev, dest, rv ? 750 : 650, live, rv); if (!live()) return;
          line('wf-l-route', '<b>Routed to ' + esc(LANE_NAME[fail.lane]) + '</b><span>' + esc(fail.route) + '</span>');
          result.innerHTML = '<div class="lr-result lr-r-human"><b>Caught, not crashed</b><span>' + esc(fail.what) + ' Control ' + cid(fail.control) + ' stopped it at step ' + (ss.indexOf(s) + 1) + '. Every path ends in a decision trace.</span></div>';
          select(s);
          return;
        }
        g.classList.remove('cur'); g.classList.add('done');
      }
      var ch = chainOf(ss);
      result.innerHTML = st.view === 're'
        ? '<div class="lr-result lr-r-post"><b>Completed at chain level L' + ch.level + '</b><span>Every step left a trace. Illustrative cycle time ' + w.metrics.re.cycle + ', cost per completed outcome ' + w.metrics.re.cost + '.</span></div>'
        : '<div class="lr-result lr-r-human"><b>Completed by hand at L' + ch.level + '</b><span>Illustrative cycle time ' + w.metrics.today.cycle + ', ' + w.metrics.today.touches + ' touches, cost per completed outcome ' + w.metrics.today.cost + '.</span></div>';
    }
    // Side-by-side run: the same case through Today and Agent-run at once. Both tokens move at one speed;
    // a token pauses with a clock at each queue wait its own step data has (AE.isQueueWait). Nothing here is
    // a measured time: the pause is animation pacing, and the result line is AE.compareLine (counts only).
    var QWAIT = 1200;
    function flowOf(key) {
      var w = AE.workflows[st.wf], re = key === 're';
      return { api: pair[key], host: re ? hostR : hostT, steps: re ? w.steps : w.today, name: re ? 'Agent-run' : 'Today', re: re };
    }
    function stepLine(F, s) {
      line('wf-l-step', '<b>' + F.name + ' &middot; ' + String(F.steps.indexOf(s) + 1).padStart(2, '0') + ' ' + esc(LANE_NAME[s.lane]) + ' &middot; ' + lvl(s.lvl) + '</b><span>' + esc(F.re ? s.log : s.name) + '</span>');
    }
    function waitLine(F, s) {
      line('wf-l-warn', '<b>' + F.name + ' &middot; queue wait</b><span>Waits on a ' + esc(HO_NAME[s.ho].toLowerCase()) + ' hand-off into step ' + String(F.steps.indexOf(s) + 1).padStart(2, '0') + '.</span>');
    }
    function finish(F) {
      var main = F.steps.filter(function (s) { return !s.ex; }), last = main[main.length - 1], p = F.api.pos[last.id];
      main.forEach(function (s) { var g = $('.sl-step[data-id="' + s.id + '"]', F.api.svg); g.classList.add('done'); if (AE.isQueueWait(s)) g.classList.add('waited'); });
      F.api.tok.setAttribute('cx', p.cx); F.api.tok.setAttribute('cy', p.cy);
      if (!F.api.fit) follow(F.host, p.cx + F.api.lw - F.host.clientWidth / 2);
    }
    async function runFlow(F, live) {
      var main = F.steps.filter(function (s) { return !s.ex; }), prev = null, prevPos = null, api = F.api;
      for (var i = 0; i < main.length; i++) {
        var s = main[i], p = api.pos[s.id], g = $('.sl-step[data-id="' + s.id + '"]', api.svg);
        g.classList.add('cur');
        if (!api.fit) follow(F.host, p.cx + api.lw - F.host.clientWidth / 2);
        var via = laneVia(prevPos, p);
        await moveToken(api.tok, prev, [p.cx, p.cy], via ? 700 : 550, live, via); if (!live()) return;
        prev = [p.cx, p.cy]; prevPos = p;
        if (AE.isQueueWait(s)) {
          api.ring.setAttribute('cx', p.cx); api.ring.setAttribute('cy', p.cy); api.ring.classList.add('on'); g.classList.add('waiting');
          waitLine(F, s);
          await wait(QWAIT); if (!live()) return;
          api.ring.classList.remove('on'); g.classList.remove('waiting'); g.classList.add('waited');
        }
        stepLine(F, s);
        await wait(260); if (!live()) return;
        g.classList.remove('cur'); g.classList.add('done');
      }
    }
    function bothResult(w) {
      result.innerHTML = '<div class="lr-result lr-r-post wf-cmp"><b>Same case, two flows</b><span>' + esc(AE.compareLine(w)) +
        ' A person touch is a main-path step at L0 to L2. Counts come from the step data; waits are illustrative pacing (animation speed, not real time).</span></div>';
    }
    async function goBoth() {
      var my = ++run; function live() { return my === run; }
      var w = AE.workflows[st.wf], A = flowOf('today'), B = flowOf('re');
      log.innerHTML = ''; result.innerHTML = '';
      placeBelowHeader(both);
      [A, B].forEach(function (F) {
        $$('.sl-step', F.api.svg).forEach(function (g) { g.classList.remove('done', 'cur', 'hit', 'waited', 'waiting'); });
        F.api.ring.classList.remove('on'); F.api.tok.setAttribute('cx', -30); F.api.tok.setAttribute('cy', -30);
      });
      if (reduce) {
        // No movement: final states, the full log and the comparison at once.
        [A, B].forEach(function (F) { finish(F); F.steps.filter(function (s) { return !s.ex; }).forEach(function (s) { if (AE.isQueueWait(s)) waitLine(F, s); stepLine(F, s); }); });
        bothResult(w); return;
      }
      await Promise.all([runFlow(A, live), runFlow(B, live)]); if (!live()) return;
      bothResult(w);
    }
    render();
  }

  /* ---------- Controls library ---------- */
  function controls(root) {
    var list = document.getElementById('ctl-list'); if (!list) return;
    var cards = $$('.ctl', list);
    var lf = layerFilter(function () { apply(); });
    function opt(v, t) { return '<option value="' + v + '">' + esc(t) + '</option>'; }
    root.innerHTML = '<div class="cf"><label class="cf-search">Search <input type="search" class="cf-q" placeholder="ID, name, purpose, framework"></label>' +
      '<label>Category <select data-f="cat">' + opt('', 'All') + AE.categories.map(function (c) { return opt(c.id, c.name); }).join('') + '</select></label>' +
      '<label>Type <select data-f="type">' + opt('', 'All') + AE.controlTypes.map(function (t) { return opt(t, t.charAt(0).toUpperCase() + t.slice(1)); }).join('') + '</select></label>' +
      '<label>Harness part <select data-f="part">' + opt('', 'All') + AE.harness.map(function (h) { return opt(h.id, h.id.slice(1) + ' ' + h.name); }).join('') + '</select></label>' +
      '<label>Required at level <select data-f="min">' + opt('', 'Any') + [0, 1, 2, 3, 4].map(function (n) { return opt(n, 'L' + n + ' (needed by then)'); }).join('') + '</select></label>' +
      '<label>Applies to <select data-f="applies">' + opt('', 'All') + AE.appliesTo.map(function (a) { return opt(a.id, a.name); }).join('') + '</select></label></div>' +
      '<div class="cf-bar"><p class="cf-count" aria-live="polite"></p><div class="wf-view" role="group" aria-label="View"></div></div><div class="cf-alt" hidden></div>';
    root.insertBefore(lf.el, $('.cf-bar', root));
    var q = $('.cf-q', root), alt = $('.cf-alt', root), mode = 'list';
    var viewRow = $('.wf-view', root);
    [['list', 'List'], ['heat', 'Coverage heatmap'], ['level', 'By autonomy level']].forEach(function (v) {
      var b = btn(v[1], 'seg', { 'aria-pressed': String(v[0] === 'list'), 'data-v': v[0] });
      b.addEventListener('click', function () { mode = v[0]; $$('button', viewRow).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); apply(); });
      viewRow.appendChild(b);
    });
    function f(k) { return $('[data-f="' + k + '"]', root).value; }
    function match(c) {
      var t = q.value.trim().toLowerCase(), L = lf.get();
      if (f('cat') && c.cat !== f('cat')) return false;
      if (f('type') && c.type !== f('type')) return false;
      if (f('part') && c.part !== f('part')) return false;
      if (f('min') !== '' && c.minLevel > +f('min')) return false;
      if (f('applies') && c.applies.indexOf(f('applies')) < 0) return false;
      if (L && c.layers.indexOf(L) < 0) return false;
      if (t) {
        var m = c.map, hay = [c.id, c.name, c.purpose, c.how, c.evidence, m.nist.join(' '), m.owasp.join(' '), m.sox.join(' '), m.eu.map(function (a) { return 'art ' + a; }).join(' '),
          m.iso42001 ? 'iso 42001' : '', m.iec62443 ? 'iec 62443' : '', m.iso10218 ? 'iso 10218' : ''].join(' ').toLowerCase();
        if (hay.indexOf(t) < 0) return false;
      }
      return true;
    }
    function apply() {
      var shown = AE.controls.filter(match);
      var ids = {}; shown.forEach(function (c) { ids[c.id] = 1; });
      cards.forEach(function (n) { n.hidden = !ids[n.id]; });
      $('.cf-count', root).textContent = 'Showing ' + shown.length + ' of ' + AE.controls.length + ' controls';
      list.hidden = mode !== 'list'; alt.hidden = mode === 'list';
      if (mode === 'heat') heat(shown); else if (mode === 'level') byLevel(shown);
    }
    function heat(shown) {
      var max = 1, grid = {};
      shown.forEach(function (c) { var k = c.cat + '|' + c.part; grid[k] = (grid[k] || 0) + 1; max = Math.max(max, grid[k]); });
      alt.innerHTML = '<p>Rows are control categories. Columns are the ten harness parts. Each cell counts the controls in view. Click a cell to list them.</p><div class="fw-table-wrap" tabindex="0" role="region" aria-label="Coverage heatmap"><table class="hm"><thead><tr><th scope="col">Category</th>' +
        AE.harness.map(function (h) { return '<th scope="col"><span>' + h.id.slice(1) + '</span> ' + esc(h.short) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        AE.categories.map(function (c) {
          return '<tr><th scope="row">' + esc(c.name) + '</th>' + AE.harness.map(function (h) {
            var n = grid[c.id + '|' + h.id] || 0, lv = n ? Math.ceil(4 * n / max) : 0;
            return '<td>' + (n ? '<button type="button" class="hm-c h' + lv + '" data-cat="' + c.id + '" data-part="' + h.id + '" aria-label="' + n + ' controls: ' + esc(c.name) + ', ' + esc(h.name) + '">' + n + '</button>' : '<span class="hm-c h0" aria-hidden="true"></span>') + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
      $$('.hm-c[data-cat]', alt).forEach(function (b) {
        b.addEventListener('click', function () {
          $('[data-f="cat"]', root).value = b.dataset.cat; $('[data-f="part"]', root).value = b.dataset.part;
          $('button[data-v="list"]', viewRow).click();
        });
      });
    }
    function byLevel(shown) {
      alt.innerHTML = '<p>Each column lists the controls that become required at that level. Controls from lower levels still apply. Raising a step one level adds the next column.</p><div class="lv-cols">' +
        [0, 1, 2, 3].map(function (n) {
          var cs = shown.filter(function (c) { return c.minLevel === n; });
          return '<section class="lv-col"><h3>L' + n + (n === 3 ? ' and above' : '') + ' <span>' + cs.length + '</span></h3><ul>' + cs.map(function (c) { return '<li>' + cid(c.id) + ' ' + esc(c.name) + '</li>'; }).join('') + '</ul></section>';
        }).join('') + '</div>';
    }
    q.addEventListener('input', apply);
    $$('select', root).forEach(function (s) { s.addEventListener('change', apply); });
    apply();
    var h = location.hash.slice(1), target = h && document.getElementById(h);
    if (target && target.classList.contains('ctl')) { target.classList.add('flash'); target.scrollIntoView(); }
  }

  /* ---------- Designer ---------- */
  var MATRIX = [[4, 3, 2], [3, 2, 1.5], [2, 1.5, 0.5]];
  var MAT = [['low', 'Low (under $5,000)'], ['med', 'Medium ($5,000 to $250,000)'], ['high', 'High (over $250,000) or regulatory']];
  var REV = [['easy', 'Easily reversible'], ['hard', 'Hard to reverse'], ['irr', 'Irreversible']];
  var TOUCH = [['none', 'Software only'], ['voice', 'Voice callers'], ['iot', 'IoT sensors'], ['machines', 'Machines or robots']];
  var LANG = ['llm', 'slm', 'reason', 'mm', 'speech', 'rag'];
  var EXAMPLE = [
    { name: 'Classify the dispute email', mat: 'low', rev: 'easy', dq: true, reg: false, ext: false, ho: 'event', model: 'slm', touch: 'none', proven: 3, G: 20, L: 10 },
    { name: 'Investigate and propose a credit', mat: 'low', rev: 'easy', dq: true, reg: false, ext: false, ho: 'tool', model: 'llm', touch: 'none', proven: 3, G: 100, L: 180 },
    { name: 'Post a credit memo under $5,000', mat: 'low', rev: 'hard', dq: true, reg: false, ext: true, ho: 'api', model: 'rules', touch: 'none', proven: 3, G: 100, L: 400 },
    { name: 'Approve a credit over $5,000', mat: 'med', rev: 'hard', dq: true, reg: true, ext: true, ho: 'tool', model: 'none', touch: 'none', proven: 2, G: 400, L: 2000 },
    { name: 'Notify the customer', mat: 'low', rev: 'easy', dq: true, reg: false, ext: true, ho: 'tool', model: 'llm', touch: 'none', proven: 3, G: 10, L: 30 }
  ];
  function rate(s) {
    var i = MAT.map(function (m) { return m[0]; }).indexOf(s.mat), j = REV.map(function (r) { return r[0]; }).indexOf(s.rev);
    var base = Math.floor(MATRIX[i][j]), v = base, why = ['Materiality and reversibility: up to L' + base + '.'];
    if (!s.dq && v > 2) { v = 2; why.push('Data quality gate fails: capped at L2.'); }
    if (s.reg && v > 2) { v = 2; why.push('Regulated or key control: capped at L2.'); }
    if (s.ext && v > 0) { v -= 1; why.push('Commits to a third party: one level lower for 90 days.'); }
    if (HO_CEIL[s.ho] < v) { v = HO_CEIL[s.ho]; why.push(HO_NAME[s.ho] + ' handoff: capped at L' + v + '.'); }
    var run = Math.min(v, s.proven);
    if (run < v) why.push('Evidence proven to L' + s.proven + ': runs at L' + run + ' until it earns more.');
    var p = s.L / (s.G + s.L);
    return { base: base, ceiling: v, run: run, why: why, p: p, ctl: required(s, run) };
  }
  function required(s, run) {
    var out = {};
    function add(ids, why) { ids.split(' ').forEach(function (id) { if (AE.controlById[id]) (out[id] = out[id] || []).push(why); }); }
    var human = s.model === 'none';
    add('TRC-01', 'Every step leaves a trace');
    if (!human) {
      add('IAM-01 MR-03 HO-02 DQ-02 TPS-01', 'Any agent step');
      if (run >= 2) add('IAM-02 SOD-01 SOD-03 HO-01 HO-05 RES-01 TRC-02 DQ-01', 'Runs at L2 or above');
      if (run >= 3) add('TAL-01 TAL-02 HO-04 MON-01 MON-03 TAL-06', 'Runs at L3 or above');
      var fam = AE.models.filter(function (m) { return m.id === s.model; })[0];
      if (fam) add(fam.mand, AE.modelNames[s.model] + ' model family');
      if (LANG.indexOf(s.model) >= 0) add('PCS-01 PCS-02 PRV-02 CST-03', 'Language model in the loop');
    } else add('SOD-01', 'A person decides');
    if (s.reg) add('TRC-03 MR-02 SOD-02 TRC-04', 'Regulated or key control');
    if (s.ext) add('TAL-04 HO-03', 'Commits to a third party');
    if (!s.dq) add('DQ-01 DQ-03 MON-02', 'Data quality gate fails');
    if (s.ho === 'manual') add('HO-03', 'Manual handoff');
    if (s.ho === 'file') add('DQ-01', 'File handoff');
    if (s.mat !== 'low') add('DQ-04 SOD-01', 'Material amount');
    if (s.rev === 'irr') add('TAL-05 HO-01', 'Irreversible action');
    if (s.touch === 'voice') add('PRV-04 IAM-05 HO-03', 'Voice callers');
    if (s.touch === 'iot') add('OT-01 OT-02 OT-04', 'IoT sensors');
    if (s.touch === 'machines') add('PHY-01 PHY-02 PHY-03 PHY-05 OT-03', 'Machines or robots');
    return out;
  }
  function designer(root) {
    var steps = EXAMPLE.map(function (s) { return Object.assign({}, s); }), layer = null;
    var lf = layerFilter(function (l) { layer = l; compute(); });
    root.innerHTML = '<div class="dz-ed"><ol class="dz-steps"></ol><div class="btn-row"><button type="button" class="btn btn-dark dz-add">Add a step</button><button type="button" class="btn btn-ghost dz-reset">Load the example</button></div></div>' +
      '<div class="dz-out" aria-live="polite"></div>';
    root.insertBefore(lf.el, $('.dz-out', root));
    var ol = $('.dz-steps', root), out = $('.dz-out', root);
    function sel(name, opts, v) { return '<select data-k="' + name + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
    function chk(name, label, v) { return '<label class="dz-chk"><input type="checkbox" data-k="' + name + '"' + (v ? ' checked' : '') + '> ' + label + '</label>'; }
    function editor() {
      ol.innerHTML = '';
      steps.forEach(function (s, i) {
        var li = el('li', 'dz-step');
        li.innerHTML = '<div class="dz-row1"><span class="dz-n">' + String(i + 1).padStart(2, '0') + '</span><label class="dz-name">Step name <input type="text" data-k="name" value="' + esc(s.name) + '" maxlength="80"></label>' +
          '<div class="dz-move"><button type="button" data-a="up" aria-label="Move step ' + (i + 1) + ' up">&uarr;</button><button type="button" data-a="down" aria-label="Move step ' + (i + 1) + ' down">&darr;</button><button type="button" data-a="del" aria-label="Remove step ' + (i + 1) + '">&times;</button></div></div>' +
          '<div class="dz-fields"><label>Materiality ' + sel('mat', MAT, s.mat) + '</label><label>Reversibility ' + sel('rev', REV, s.rev) + '</label>' +
          '<label>Handoff in ' + sel('ho', AE.handoffs.map(function (h) { return [h.id, h.name + ' (L' + h.ceil + ')']; }), s.ho) + '</label>' +
          '<label>Model family ' + sel('model', Object.keys(AE.modelNames).map(function (k) { return [k, k === 'none' ? 'None: a person decides' : AE.modelNames[k]]; }), s.model) + '</label>' +
          '<label>Touches ' + sel('touch', TOUCH, s.touch) + '</label><label>Evidence proven to ' + sel('proven', [0, 1, 2, 3, 4].map(function (n) { return [n, 'L' + n]; }), s.proven) + '</label>' +
          '<label>Gain if right, G ($) <input type="number" min="0" step="10" data-k="G" value="' + s.G + '"></label><label>Loss if wrong, L ($) <input type="number" min="0" step="10" data-k="L" value="' + s.L + '"></label></div>' +
          '<div class="dz-checks">' + chk('dq', 'Data quality gate passes', s.dq) + chk('reg', 'Regulated or key control', s.reg) + chk('ext', 'Commits to an outside party', s.ext) + '</div>';
        $$('[data-k]', li).forEach(function (inp) {
          inp.addEventListener(inp.type === 'text' || inp.type === 'number' ? 'input' : 'change', function () {
            var k = inp.dataset.k;
            s[k] = inp.type === 'checkbox' ? inp.checked : (k === 'G' || k === 'L' || k === 'proven') ? Math.max(0, +inp.value || 0) : inp.value;
            compute();
          });
        });
        $$('[data-a]', li).forEach(function (b) {
          b.addEventListener('click', function () {
            var a = b.dataset.a;
            if (a === 'del' && steps.length > 1) steps.splice(i, 1);
            if (a === 'up' && i > 0) steps.splice(i - 1, 0, steps.splice(i, 1)[0]);
            if (a === 'down' && i < steps.length - 1) steps.splice(i + 1, 0, steps.splice(i, 1)[0]);
            editor(); compute();
          });
        });
        ol.appendChild(li);
      });
    }
    $('.dz-add', root).addEventListener('click', function () {
      steps.push({ name: 'New step', mat: 'low', rev: 'easy', dq: true, reg: false, ext: false, ho: 'api', model: 'llm', touch: 'none', proven: 2, G: 100, L: 100 });
      editor(); compute(); var last = $$('.dz-step input[data-k="name"]', ol).pop(); if (last) last.focus();
    });
    $('.dz-reset', root).addEventListener('click', function () { steps = EXAMPLE.map(function (s) { return Object.assign({}, s); }); editor(); compute(); });
    function blueprint() {
      var rated = steps.map(rate), chain = Math.min.apply(null, rated.map(function (r) { return r.run; }));
      var all = {}; rated.forEach(function (r) { Object.keys(r.ctl).forEach(function (id) { all[id] = 1; }); });
      return { steps: steps, rated: rated, chain: chain, weak: steps.filter(function (_, i) { return rated[i].run === chain; }).map(function (s) { return s.name; }),
        controls: AE.controls.filter(function (c) { return all[c.id]; }) };
    }
    function laneSteps(b) {
      var out = [], n = 0;
      b.steps.forEach(function (s, i) {
        var r = b.rated[i], ids = Object.keys(r.ctl), lys = {};
        ids.forEach(function (id) { AE.controlById[id].layers.forEach(function (l) { lys[l] = 1; }); });
        var layers = AE.layers.map(function (L) { return L.id; }).filter(function (l) { return lys[l]; });
        var human = s.model === 'none' || r.run <= 1;
        out.push({ id: 'd' + (n++), lane: human ? 'people' : 'agents', name: s.name, lvl: r.run, model: s.model, ho: s.ho, controls: ids, layers: layers, ev: 'Decision threshold ' + Math.round(r.p * 100) + '%' });
        if (!human && r.run >= 2) out.push({ id: 'd' + (n++), lane: 'harness', name: 'Validate and route: ' + s.name, lvl: null, model: 'rules', ho: 'api', controls: ids.filter(function (id) { return /^(TAL|SOD|DQ|PCS)/.test(id); }), layers: layers, ev: '' });
        if (!human && r.run === 2) out.push({ id: 'd' + (n++), lane: 'people', name: 'Approve on a decision card', lvl: 2, model: 'none', ho: 'tool', controls: ['HO-01', 'HO-05'], layers: ['fe', 'ops', 'reg', 'fin'], ev: '' });
      });
      out.push({ id: 'd' + n, lane: 'systems', name: 'Commit through a released interface', lvl: null, model: 'rules', ho: 'api', controls: ['TAL-06', 'TRC-01'], layers: ['be', 'fin', 'app', 'reg', 'fe'], ev: '' });
      return out;
    }
    function compute() {
      var b = blueprint();
      var rows = b.steps.map(function (s, i) {
        var r = b.rated[i], ids = Object.keys(r.ctl);
        var shown = layer ? ids.filter(function (id) { return AE.controlById[id].layers.indexOf(layer) >= 0; }) : ids;
        var lys = {}; ids.forEach(function (id) { AE.controlById[id].layers.forEach(function (l) { lys[l] = 1; }); });
        return '<tr' + (r.run === b.chain ? ' class="weak"' : '') + '><th scope="row">' + String(i + 1).padStart(2, '0') + ' ' + esc(s.name) + '<br>' + layerStrip(Object.keys(lys), layer) + '</th>' +
          '<td><b class="lvchip l' + r.run + '">L' + r.run + '</b><span class="muted"> ceiling L' + r.ceiling + '</span></td><td>' + r.why.map(esc).join('<br>') + '</td>' +
          '<td>' + Math.round(r.p * 100) + '%<br><span class="muted">L &divide; (G + L) = ' + s.L + ' &divide; ' + (s.G + s.L) + '</span></td>' +
          '<td>' + (shown.length ? shown.map(cid).join(' ') : '<span class="muted">none at this layer</span>') + '</td></tr>';
      }).join('');
      var byCat = AE.categories.map(function (c) {
        var cs = b.controls.filter(function (x) { return x.cat === c.id && (!layer || x.layers.indexOf(layer) >= 0); });
        return cs.length ? '<li><b>' + esc(c.name) + '</b> ' + cs.map(function (x) { return cid(x.id) + ' ' + esc(x.name); }).join('; ') + '</li>' : '';
      }).join('');
      out.innerHTML = '<div class="dz-sum"><div><span class="dz-big">L' + b.chain + '</span><span>Chain level</span></div><div><span class="dz-big">' + b.steps.length + '</span><span>Steps</span></div><div><span class="dz-big">' + b.controls.length + '</span><span>Required controls</span></div>' +
        '<p>Weakest link: <b>' + b.weak.map(esc).join(', ') + '</b>. Fund this link first; never promise a chain level above it.</p></div>' +
        '<div class="fw-table-wrap"><table class="fw-table dz-table"><thead><tr><th scope="col">Step and layers</th><th scope="col">Runs at</th><th scope="col">Why</th><th scope="col">Decision threshold</th><th scope="col">Required controls' + (layer ? ' (' + esc(AE.layerById[layer].name) + ')' : '') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<h3 class="dz-h">Generated swimlane</h3><div class="sl-wrap dz-sl" tabindex="0" role="region" aria-label="Generated swimlane"></div><div class="ar-panel dz-panel" aria-live="polite"><p class="muted">Click a step in the swimlane for details.</p></div>' +
        '<h3 class="dz-h">Required controls by category</h3><ul class="dz-ctl">' + (byCat || '<li class="muted">No controls at this layer.</li>') + '</ul>' +
        '<div class="btn-row dz-export"><button type="button" class="btn btn-primary dz-json">Download JSON</button><button type="button" class="btn btn-dark dz-print">Print or save as PDF</button></div>' +
        '<p class="fw-note">Illustrative thresholds from the book. Set your own with internal audit.</p>';
      var ls = laneSteps(b);
      drawSwimlane($('.dz-sl', out), ls, { layer: layer, key: 'dz', label: 'Generated swimlane', weak: ls.filter(function (s) { return s.lvl === b.chain && s.lane !== 'harness'; }).map(function (s) { return s.id; }),
        onSelect: function (s) { $('.dz-panel', out).innerHTML = stepDetail(s, layer); } });
      $('.dz-json', out).addEventListener('click', function () {
        var data = { title: 'Workflow blueprint', source: 'humanledenterprise.com/designer (illustrative)', chainLevel: 'L' + b.chain, weakestLink: b.weak,
          steps: b.steps.map(function (s, i) { var r = b.rated[i]; return Object.assign({}, s, { ceiling: 'L' + r.ceiling, runsAt: 'L' + r.run, reasons: r.why, decisionThreshold: Math.round(r.p * 1000) / 1000, controls: Object.keys(r.ctl) }); }),
          controls: b.controls.map(function (c) { return { id: c.id, name: c.name, purpose: c.purpose, layers: c.layers }; }) };
        var url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        var a = document.createElement('a'); a.href = url; a.download = 'workflow-blueprint.json'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
      $('.dz-print', out).addEventListener('click', function () { window.print(); });
    }
    editor(); compute();
  }

  var MOUNTS = { alignment: alignment, 'hub-flow': hubFlow, architecture: architecture, chooser: chooser, workflows: workflows, controls: controls, designer: designer };
  $$('[data-bp]').forEach(function (n) {
    var f = MOUNTS[n.dataset.bp];
    if (!f) return;
    try { f(n); var w = n.closest('.bp-ix'); if (w) w.hidden = false; document.documentElement.classList.add('bp-js'); } catch (e) { if (window.console) console.error(e); }
  });
})();
