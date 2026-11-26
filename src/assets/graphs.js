/* Graphs, skill graph and the enterprise brain on /blueprints/graphs/.
   Data: AE.graphs, generated at build time by tools/build-graphs.mjs from committed data and code.
   The renderer is plain SVG: pan, zoom, filter, search, keyboard, neighbours and facts.
   The only network call is this site's own POST /api/graph/ask. Traces live in this tab only. */
(function () {
  'use strict';
  var AE = window.AE || {};
  var G = AE.graphs;
  if (!G) return;
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ASK = '/api/graph/ask';
  // Published rates for the model the agents run on, USD per million tokens.
  var PRICE_IN = 0.293, PRICE_OUT = 2.253;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function sv(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function btn(label, cls) { var b = el('button', cls, label); b.type = 'button'; return b; }
  function isCtl(id) { return /^[A-Z]{2,3}-\d{2}$/.test(id); }
  function cid(id) { return isCtl(id) ? '<a class="cid" href="/controls/#' + id + '">' + id + '</a>' : esc(id); }
  var TYPE_LABEL = { supplier: 'Supplier', exception: 'Exception', extype: 'Exception type', policy: 'Policy', role: 'Role', control: 'Control',
    agent: 'Agent', skill: 'Skill', denied: 'Cannot do', tool: 'Tool or API', data: 'Data', level: 'Autonomy level',
    signal: 'Signal', router: 'Router', lookup: 'Graph lookup', family: 'Model family', agentstep: 'Agent', gate: 'Gate', action: 'Action',
    trace: 'Trace', memory: 'Memory', mtrace: 'Session trace', mref: 'Cited node' };
  var REL = { billed_by: 'billed by', is_a: 'is a', routed_to: 'routed to', governed_by: 'governed by', enforced_by: 'enforced by', routes_to: 'routes to',
    has_skill: 'has skill', uses: 'uses', reads: 'reads', writes: 'writes', gated_by: 'gated by', runs_at: 'runs at', cannot: 'cannot', blocked_by: 'blocked by',
    feeds: 'feeds', looks_up: 'looks up', picks: 'picks', grounds: 'grounds', runs: 'runs', checked_by: 'checked by', allows: 'allows', appends: 'appends',
    informs: 'informs', enforces: 'enforces', recalls: 'recalls', cites: 'cites' };
  function relName(r) { return REL[r] || r.replace(/_/g, ' '); }
  function shortLabel(n, max) { var t = n.label; return t.length > max ? t.slice(0, max - 1) + '\u2026' : t; }

  /* ---------- the renderer ---------- */
  function Graph(root, data, opts) {
    opts = opts || {};
    var self = this;
    this.data = { nodes: data.nodes.map(function (n) { return Object.assign({}, n); }), edges: data.edges.slice() };
    this.byId = {}; this.adj = {};
    this.data.nodes.forEach(function (n) { self.byId[n.id] = n; self.adj[n.id] = []; });
    this.data.edges.forEach(function (e) { self.adj[e.s].push(e); self.adj[e.t].push(e); });
    this.hidden = {};
    this.size = data.size;
    var types = (data.types || []).filter(function (t) { return self.data.nodes.some(function (n) { return n.type === t; }); });
    root.className = 'gr';
    root.innerHTML =
      '<div class="gr-bar">' +
        '<div class="gr-find"><label class="visually-hidden" for="' + opts.key + '-q">Search ' + esc(opts.name) + '</label>' +
        '<input id="' + opts.key + '-q" class="gr-q" type="search" maxlength="60" autocomplete="off" placeholder="Search, for example ' + esc(opts.example) + '">' +
        '<button type="button" class="pill pill-dark gr-go">Find</button></div>' +
        '<div class="gr-zoom" role="group" aria-label="Zoom"><button type="button" class="pill" data-z="in" aria-label="Zoom in">+</button><button type="button" class="pill" data-z="out" aria-label="Zoom out">&minus;</button><button type="button" class="pill" data-z="reset">Reset view</button></div>' +
      '</div>' +
      '<fieldset class="gr-types"><legend>Show node types</legend></fieldset>' +
      '<p class="gr-hits" aria-live="polite"></p>' +
      '<div class="gr-main"><div class="gr-canvas" tabindex="0" role="group" aria-label="' + esc(opts.name) + '. Use arrow keys to move between nodes and Enter to open one."></div>' +
      '<aside class="gr-panel" aria-live="polite"><p class="gr-hint">' + esc(opts.hint || 'Click or tab to a node to see its facts and neighbours.') + '</p></aside></div>';
    var fs = $('.gr-types', root);
    types.forEach(function (t) {
      var l = el('label', 'gr-type', '<input type="checkbox" checked value="' + t + '"> <span class="gr-dot t-' + t + '" aria-hidden="true"></span>' + esc(TYPE_LABEL[t] || t));
      fs.appendChild(l);
    });
    fs.addEventListener('change', function (e) { if (e.target.type === 'checkbox') { self.hidden[e.target.value] = !e.target.checked; self.applyFilter(); } });
    this.root = root; this.panel = $('.gr-panel', root); this.hits = $('.gr-hits', root); this.opts = opts;
    this.canvas = $('.gr-canvas', root);
    this.svg = sv('svg', { class: 'gr-svg' }, this.canvas);
    this.gE = sv('g', { class: 'gr-edges' }, this.svg);
    this.gN = sv('g', { class: 'gr-nodes' }, this.svg);
    this.edgeEls = []; this.nodeEls = {};
    this.data.edges.forEach(function (e) { self.drawEdge(e); });
    this.data.nodes.forEach(function (n) { self.drawNode(n); });
    this.fit();
    this.focusId = null;
    // Search
    var q = $('.gr-q', root);
    function find() { self.search(q.value); }
    $('.gr-go', root).addEventListener('click', find);
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); find(); } });
    // Zoom buttons, wheel with Ctrl or Cmd, drag to pan.
    $$('[data-z]', root).forEach(function (b) { b.addEventListener('click', function () { var z = b.getAttribute('data-z'); if (z === 'reset') self.fit(); else self.zoom(z === 'in' ? 0.8 : 1.25); }); });
    this.svg.addEventListener('wheel', function (e) { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); self.zoom(e.deltaY < 0 ? 0.85 : 1.18, self.toSvg(e)); }, { passive: false });
    var drag = null;
    this.svg.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('.gn')) return;
      drag = { x: e.clientX, y: e.clientY, vb: self.vb.slice() }; self.svg.setPointerCapture(e.pointerId); self.svg.classList.add('dragging');
    });
    this.svg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var r = self.svg.getBoundingClientRect(), k = drag.vb[2] / r.width;
      self.setVb([drag.vb[0] - (e.clientX - drag.x) * k, drag.vb[1] - (e.clientY - drag.y) * k, drag.vb[2], drag.vb[3]]);
    });
    function end() { drag = null; self.svg.classList.remove('dragging'); }
    this.svg.addEventListener('pointerup', end); this.svg.addEventListener('pointercancel', end);
    // Keyboard: arrows move to the nearest visible node in that direction; Enter opens it; Escape clears.
    this.canvas.addEventListener('keydown', function (e) {
      var dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
      if (dir) { e.preventDefault(); self.step(dir); return; }
      if ((e.key === 'Enter' || e.key === ' ') && self.focusId) { e.preventDefault(); self.select(self.focusId); return; }
      if (e.key === 'Escape') { self.clear(); }
      if (e.key === '+' || e.key === '=') self.zoom(0.8);
      if (e.key === '-') self.zoom(1.25);
    });
    this.canvas.addEventListener('focus', function () { if (!self.focusId) { var first = self.visibleNodes()[0]; if (first) self.setFocus(first.id); } });
  }
  Graph.prototype.radius = function (n) {
    var d = this.adj[n.id].length;
    if (n.type === 'exception' || n.type === 'mref') return 5;
    return Math.max(7, Math.min(20, 5 + Math.sqrt(d) * 1.6));
  };
  Graph.prototype.drawEdge = function (e) {
    var a = this.byId[e.s], b = this.byId[e.t];
    var l = sv('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'ge r-' + e.rel }, this.gE);
    l.__e = e; this.edgeEls.push(l); return l;
  };
  Graph.prototype.drawNode = function (n) {
    var self = this;
    var g = sv('g', { class: 'gn t-' + n.type, tabindex: '-1', role: 'button', 'data-id': n.id, 'aria-label': (TYPE_LABEL[n.type] || n.type) + ': ' + n.label }, this.gN);
    sv('circle', { cx: n.x, cy: n.y, r: this.radius(n) }, g);
    var labelled = this.opts.labels ? this.opts.labels(n) : true;
    if (labelled) { var t = sv('text', { x: n.x, y: n.y + this.radius(n) + 12, 'text-anchor': 'middle' }, g); t.textContent = shortLabel(n, this.opts.labelMax || 22); }
    g.addEventListener('click', function () { self.setFocus(n.id); self.select(n.id); });
    g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); self.select(n.id); } });
    this.nodeEls[n.id] = g; return g;
  };
  Graph.prototype.addNode = function (n) {
    if (this.byId[n.id]) return;
    n = Object.assign({}, n); this.data.nodes.push(n); this.byId[n.id] = n; this.adj[n.id] = []; this.drawNode(n);
  };
  Graph.prototype.addEdge = function (e) {
    if (!this.byId[e.s] || !this.byId[e.t]) return;
    this.data.edges.push(e); this.adj[e.s].push(e); this.adj[e.t].push(e); var l = this.drawEdge(e); l.classList.add('ge-new');
    var r = this.nodeEls[e.s].querySelector('circle'); r.setAttribute('r', this.radius(this.byId[e.s]));
  };
  Graph.prototype.bbox = function () {
    var xs = [], ys = [];
    this.data.nodes.forEach(function (n) { xs.push(n.x); ys.push(n.y); });
    var p = 30, px = 75;
    return [Math.min.apply(null, xs) - px, Math.min.apply(null, ys) - p, Math.max.apply(null, xs) - Math.min.apply(null, xs) + 2 * px, Math.max.apply(null, ys) - Math.min.apply(null, ys) + 2 * p + 14];
  };
  Graph.prototype.fit = function () { this.setVb(this.bbox()); };
  Graph.prototype.setVb = function (vb) { this.vb = vb; this.svg.setAttribute('viewBox', vb.map(function (x) { return Math.round(x * 10) / 10; }).join(' ')); };
  Graph.prototype.zoom = function (k, at) {
    var vb = this.vb, c = at || [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2];
    var w = Math.max(80, Math.min(this.bbox()[2] * 3, vb[2] * k)), h = vb[3] * (w / vb[2]);
    this.setVb([c[0] - (c[0] - vb[0]) * (w / vb[2]), c[1] - (c[1] - vb[1]) * (h / vb[3]), w, h]);
  };
  Graph.prototype.toSvg = function (e) {
    var r = this.svg.getBoundingClientRect();
    return [this.vb[0] + (e.clientX - r.left) / r.width * this.vb[2], this.vb[1] + (e.clientY - r.top) / r.height * this.vb[3]];
  };
  Graph.prototype.center = function (id) {
    var n = this.byId[id], vb = this.vb;
    if (n.x < vb[0] + 20 || n.x > vb[0] + vb[2] - 20 || n.y < vb[1] + 20 || n.y > vb[1] + vb[3] - 20) this.setVb([n.x - vb[2] / 2, n.y - vb[3] / 2, vb[2], vb[3]]);
  };
  Graph.prototype.visibleNodes = function () { var h = this.hidden; return this.data.nodes.filter(function (n) { return !h[n.type]; }); };
  Graph.prototype.applyFilter = function () {
    var self = this;
    this.data.nodes.forEach(function (n) { self.nodeEls[n.id].classList.toggle('off', !!self.hidden[n.type]); });
    this.edgeEls.forEach(function (l) { var e = l.__e; l.classList.toggle('off', !!(self.hidden[self.byId[e.s].type] || self.hidden[self.byId[e.t].type])); });
  };
  Graph.prototype.setFocus = function (id) {
    if (this.focusId && this.nodeEls[this.focusId]) { this.nodeEls[this.focusId].classList.remove('kf'); this.nodeEls[this.focusId].setAttribute('tabindex', '-1'); }
    this.focusId = id; var g = this.nodeEls[id];
    g.classList.add('kf'); this.center(id);
    this.canvas.setAttribute('aria-activedescendant', '');
    this.hits.textContent = (TYPE_LABEL[this.byId[id].type] || '') + ': ' + this.byId[id].label + '. Press Enter to open.';
  };
  Graph.prototype.step = function (dir) {
    var cur = this.byId[this.focusId], best = null, bestScore = Infinity;
    if (!cur) { var f = this.visibleNodes()[0]; if (f) this.setFocus(f.id); return; }
    this.visibleNodes().forEach(function (n) {
      if (n.id === cur.id) return;
      var dx = n.x - cur.x, dy = n.y - cur.y, along = dx * dir[0] + dy * dir[1];
      if (along <= 0) return;
      var across = Math.abs(dx * dir[1] - dy * dir[0]), s = along + across * 2;
      if (s < bestScore) { bestScore = s; best = n; }
    });
    if (best) this.setFocus(best.id);
  };
  Graph.prototype.clear = function () {
    this.svg.classList.remove('has-sel', 'has-path');
    $$('.sel,.nb,.hl', this.svg).forEach(function (x) { x.classList.remove('sel', 'nb', 'hl'); });
    this.panel.innerHTML = '<p class="gr-hint">' + esc(this.opts.hint || 'Click or tab to a node to see its facts and neighbours.') + '</p>';
  };
  Graph.prototype.select = function (id) {
    var self = this, n = this.byId[id];
    if (!n) return;
    this.clear();
    this.svg.classList.add('has-sel');
    this.nodeEls[id].classList.add('sel');
    var groups = {};
    this.adj[id].forEach(function (e) {
      var other = e.s === id ? e.t : e.s, key = (e.s === id ? '' : '\u2190 ') + relName(e.rel);
      (groups[key] = groups[key] || []).push(other);
      self.nodeEls[other].classList.add('nb');
    });
    this.edgeEls.forEach(function (l) { if (l.__e.s === id || l.__e.t === id) l.classList.add('hl'); });
    var facts = Object.keys(n.facts || {}).map(function (k) {
      var v = String(n.facts[k]);
      var html = /controls$/.test(k) || k === 'mandatory_controls' ? v.split(' ').map(cid).join(' ') : esc(v);
      return '<div><dt>' + esc(k.replace(/_/g, ' ')) + '</dt><dd>' + html + '</dd></div>';
    }).join('');
    var nb = Object.keys(groups).map(function (k) {
      var ids = groups[k], more = ids.length > 14 ? '<li class="muted">and ' + (ids.length - 14) + ' more</li>' : '';
      return '<h4>' + esc(k) + ' (' + ids.length + ')</h4><ul class="gr-nb">' + ids.slice(0, 14).map(function (o) {
        return '<li><button type="button" class="gr-link" data-go="' + esc(o) + '">' + esc(self.byId[o].label) + '</button></li>';
      }).join('') + more + '</ul>';
    }).join('');
    var extra = this.opts.panelExtra ? this.opts.panelExtra(n, this) : '';
    this.panel.innerHTML = '<p class="gr-kicker"><span class="gr-dot t-' + n.type + '" aria-hidden="true"></span>' + esc(TYPE_LABEL[n.type] || n.type) + ' &middot; ' + cid(n.id) + '</p>' +
      '<h3>' + esc(n.label) + '</h3>' + extra + (facts ? '<dl class="gr-dl">' + facts + '</dl>' : '') + nb;
    $$('[data-go]', this.panel).forEach(function (b) { b.addEventListener('click', function () { var to = b.getAttribute('data-go'); self.setFocus(to); self.select(to); }); });
    if (this.opts.onSelect) this.opts.onSelect(n);
  };
  Graph.prototype.search = function (text) {
    var t = String(text || '').trim().toLowerCase(), self = this;
    if (!t) { this.hits.textContent = 'Type a name or an ID.'; return; }
    var found = this.data.nodes.filter(function (n) { return n.id.toLowerCase().indexOf(t) >= 0 || n.label.toLowerCase().indexOf(t) >= 0; });
    $$('.match', this.svg).forEach(function (x) { x.classList.remove('match'); });
    if (!found.length) { this.hits.textContent = 'No node matches \u201c' + text + '\u201d.'; return; }
    found.forEach(function (n) { self.nodeEls[n.id].classList.add('match'); });
    this.hits.textContent = found.length + ' match' + (found.length === 1 ? '' : 'es') + '. Showing ' + found[0].label + '.';
    this.setFocus(found[0].id); this.select(found[0].id);
  };
  /** Highlights a walked path edge by edge. ids are nodes to mark even when no edge reaches them. */
  Graph.prototype.showPath = function (edges, ids) {
    var self = this;
    this.clear();
    this.svg.classList.add('has-path');
    var keyOf = function (e) { return e.s + '>' + e.t + '>' + e.rel; }, want = {};
    edges.forEach(function (e, i) { want[keyOf(e)] = i; });
    (ids || []).forEach(function (id) { if (self.nodeEls[id]) self.nodeEls[id].classList.add('nb'); });
    this.edgeEls.forEach(function (l) {
      var i = want[keyOf(l.__e)];
      if (i == null) return;
      var on = function () { l.classList.add('hl'); self.nodeEls[l.__e.s].classList.add('nb'); self.nodeEls[l.__e.t].classList.add('nb'); };
      if (reduce) on(); else setTimeout(on, Math.min(i, 60) * 45);
    });
    if (ids && ids[0] && this.byId[ids[0]]) { this.nodeEls[ids[0]].classList.add('sel'); this.center(ids[0]); }
  };

  /* ---------- mounts ---------- */
  var graphs = {};
  function mount(key, f) {
    var n = $('[data-gr="' + key + '"]');
    if (!n) return;
    try { f(n); var w = n.closest('.bp-ix'); if (w) w.hidden = false; } catch (e) { if (window.console) console.error(e); }
  }

  mount('kg', function (root) {
    graphs.kg = new Graph(root, G.kg, { key: 'kg', name: 'Knowledge graph of the AP sample', example: 'Supplier 38 or AP-0012',
      labels: function (n) { return n.type !== 'exception' && n.type !== 'supplier'; }, labelMax: 24 });
  });

  mount('skills', function (root) {
    var g = graphs.skills = new Graph(root, G.skills, { key: 'sk', name: 'Skill graph of this site\u2019s agents', example: 'Proposer or MR-10', labelMax: 26,
      hint: 'Pick an agent above, or click any node.',
      panelExtra: function (n, gr) {
        if (n.type !== 'agent') return '';
        var can = gr.adj[n.id].filter(function (e) { return e.s === n.id && e.rel === 'has_skill'; }).map(function (e) { return gr.byId[e.t]; });
        var cannot = gr.adj[n.id].filter(function (e) { return e.s === n.id && e.rel === 'cannot'; }).map(function (e) { return gr.byId[e.t]; });
        return '<div class="gr-cando"><div><h4>Can</h4><ul>' + can.map(function (s) { return '<li>' + esc(s.label) + ' <b>' + esc(s.facts.autonomy) + '</b></li>'; }).join('') + '</ul></div>' +
          '<div><h4>Cannot</h4><ul>' + (cannot.length ? cannot.map(function (d) { return '<li>' + esc(d.label.replace(/^Cannot: /, '')) + ' ' + String(d.facts.controls).split(' ').map(cid).join(' ') + '</li>'; }).join('') : '<li>Nothing listed</li>') + '</ul></div></div>';
      } });
    var bar = el('div', 'gr-agents', '<p class="gr-agents-l">What can this agent do?</p>');
    var grp = el('div', 'gr-agent-btns'); grp.setAttribute('role', 'group'); grp.setAttribute('aria-label', 'Agents');
    G.skills.nodes.filter(function (n) { return n.type === 'agent'; }).forEach(function (a) {
      var b = btn(esc(a.label), 'pill'); b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        $$('button', grp).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        g.setFocus(a.id); g.select(a.id);
        // Highlight everything the agent reaches: its skills and their gates, and what it cannot do.
        var walk = [];
        g.adj[a.id].forEach(function (e) { if (e.s === a.id) { walk.push(e); g.adj[e.t].forEach(function (f) { if (f.s === e.t) walk.push(f); }); } });
        walk.forEach(function (e) { g.edgeEls.forEach(function (l) { if (l.__e === e) l.classList.add('hl'); }); g.nodeEls[e.t].classList.add('nb'); });
      });
      grp.appendChild(b);
    });
    bar.appendChild(grp);
    root.insertBefore(bar, root.firstChild);
  });

  /* ---------- the brain map and the ask panel ---------- */
  var S = { traces: 0, tokIn: 0, tokOut: 0, cost: 0, calls: 0 };

  mount('brain', function (root) {
    graphs.brain = new Graph(root, G.brain, { key: 'br', name: 'Enterprise brain map', example: 'router or speech', labelMax: 22,
      hint: 'Ask a question above to light up the route. Click any node to see what it does.' });
  });

  function centralTime(ms) {
    var d = new Date(ms), s;
    try { s = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }); }
    catch (e) { return d.toUTCString().slice(17, 22) + ' UTC'; }
    return s.replace(':00', '').replace(/\s?AM$/, ' am').replace(/\s?PM$/, ' pm') + ' Central';
  }
  function cost(u) { return ((u.input_tokens || 0) * PRICE_IN + (u.output_tokens || 0) * PRICE_OUT) / 1e6; }
  function meter(u) {
    var n = (u.input_tokens || 0) + (u.output_tokens || 0);
    return n.toLocaleString('en-US') + ' tokens (' + (u.input_tokens || 0).toLocaleString('en-US') + ' in, ' + (u.output_tokens || 0).toLocaleString('en-US') + ' out) \u00b7 $' + cost(u).toFixed(4) + (u.estimated ? ' (estimated)' : '');
  }
  var CHIPS = [
    'Which supplier is riskiest?',
    'Can the Proposer change the scorer?',
    'Which exceptions need the delegated authority?',
    'Forecast next month\u2019s exceptions for Supplier 38',
    'What does control MR-10 block?',
    'Which agents cannot write to the requests table?'
  ];

  mount('ask', function (root) {
    root.className = 'gr-ask';
    root.innerHTML = '<div class="gr-ask-top"><p class="gr-k">Ask the brain</p><p class="gr-meter" aria-live="off">Each question: one AI call on sample data and this site\u2019s own code. Nothing you type is stored.</p></div>' +
      '<div class="gr-chips" role="group" aria-label="Example questions"></div>' +
      '<div class="gr-askrow"><label class="visually-hidden" for="gr-q">Your question</label><input id="gr-q" class="gr-askq" type="text" maxlength="300" autocomplete="off" placeholder="Or type a question about the suppliers or the agents">' +
      '<button type="button" class="pill pill-dark gr-askbtn">Ask</button></div>' +
      '<p class="gr-count" aria-live="polite"></p>' +
      '<div class="gr-out" aria-live="polite"></div>' +
      '<div class="gr-mem"><h3 class="gr-h3">Session memory</h3><p class="gr-mem-n">No traces yet. Each answer adds one, here and on the map below. They stay in this tab only.</p><ol class="gr-mem-list"></ol></div>';
    var chips = $('.gr-chips', root), input = $('.gr-askq', root), go = $('.gr-askbtn', root), out = $('.gr-out', root);
    CHIPS.forEach(function (c) { var b = btn(esc(c), 'pill'); b.addEventListener('click', function () { input.value = c; ask(c); }); chips.appendChild(b); });
    go.addEventListener('click', function () { ask(input.value); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ask(input.value); } });
    input.addEventListener('input', function () { $('.gr-count', root).textContent = input.value.length > 250 ? (300 - input.value.length) + ' characters left' : ''; });
    var busy = false;

    function routeList(r, data) {
      var subs = data.subgraphs || [];
      var steps = [];
      steps.push(['Signal', 'Web (this page). The only live signal in this demo.']);
      steps.push(['Brain router', (r.matched.length ? 'Rules matched: ' + r.matched.map(function (m) { return m === 'skills' ? 'skill graph' : m === 'kg' ? 'knowledge graph' : m; }).join(', ') + '. ' : 'No rule matched. ') + r.why.join(' ')]);
      subs.forEach(function (s) { steps.push([s.graph === 'kg' ? 'Knowledge graph lookup' : 'Skill graph lookup', 'Code walked ' + s.path.length + ' edges and selected ' + s.nodes.length + ' nodes.' + (s.notes.length ? ' ' + s.notes.join(' ') : '')]); });
      steps.push(['Model families', '<ul class="gr-fams">' + r.families.map(function (f) {
        var badge = f.status === 'ran' ? '<span class="gr-b gr-b-run">Run</span>' : f.status === 'traversal_ran' ? '<span class="gr-b gr-b-code">Traversal ran in code</span>' : '<span class="gr-b gr-b-not">Routed to, not run in this demo</span>';
        return '<li>' + badge + ' <b>' + esc(f.label) + '.</b> ' + esc(f.why) + '</li>';
      }).join('') + '</ul>', true]);
      steps.push(['Skill and agent', 'Graph agent, skill: answer from a code-selected subgraph (L1, read only).']);
      steps.push(['Controls', '<ul class="gr-ctl">' + (data.controls || []).map(function (c) { return '<li>' + cid(c.id) + ' ' + esc(c.why) + '</li>'; }).join('') + '</ul>', true]);
      if (data.evals && data.evals.length) steps.push(['Evals run in code', '<ul class="gr-evals">' + data.evals.map(function (e) { return '<li class="' + (e.pass ? 'pass' : 'fail') + '"><b>' + (e.pass ? 'Pass' : 'Fail') + '</b> ' + esc(e.name) + ': ' + esc(e.detail) + '</li>'; }).join('') + '</ul>', true]);
      return '<ol class="gr-route">' + steps.map(function (s) { return '<li><b>' + esc(s[0]) + '</b><div>' + (s[2] ? s[1] : esc(s[1])) + '</div></li>'; }).join('') + '</ol>';
    }

    function light(data) {
      // Light the walked path on the graphs and the route on the brain map.
      (data.subgraphs || []).forEach(function (s) { var g = graphs[s.graph]; if (g) g.showPath(s.path, s.nodes.slice(0, 1)); });
      var b = graphs.brain; if (!b) return;
      var r = data.route, e = [];
      function E(s, t, rel) { e.push({ s: s, t: t, rel: rel }); }
      E('SIG-web', 'BR-router', 'feeds');
      if (r.graphs.kg) { E('BR-router', 'BR-kg', 'looks_up'); E('BR-kg', 'BR-agent', 'grounds'); E('BR-kg', 'MF-kg', 'is_a'); }
      if (r.graphs.skills) { E('BR-router', 'BR-skills', 'looks_up'); E('BR-skills', 'BR-agent', 'grounds'); }
      r.families.forEach(function (f) { E('BR-router', 'MF-' + f.id, 'picks'); });
      E('MF-llm', 'BR-agent', 'runs'); E('BR-agent', 'BR-gate', 'checked_by');
      (data.controls || []).forEach(function (c) { E('BR-gate', c.id, 'enforces'); });
      if (data.ok) { E('BR-gate', 'BR-action', 'allows'); E('BR-action', 'BR-trace', 'writes'); E('BR-trace', 'BR-memory', 'appends'); }
      b.showPath(e, ['BR-router']);
    }

    function remember(q, data) {
      var b = graphs.brain; S.traces++;
      var id = 'T' + S.traces, k = S.traces;
      if (b) {
        var base = b.byId['BR-memory'];
        var ty = 630 + (k - 1) * 56;
        b.addNode({ id: id, type: 'mtrace', label: 'Trace ' + k, x: 730, y: ty,
          facts: { question: q, answer: data.answer || '', cited: (data.cited || []).join(' '), families: data.route.families.map(function (f) { return f.label + ' (' + (f.status === 'ran' ? 'run' : f.status === 'traversal_ran' ? 'traversal in code' : 'routed to, not run') + ')'; }).join('; ') } });
        b.addEdge({ s: 'BR-memory', t: id, rel: 'recalls' });
        (data.cited || []).slice(0, 4).forEach(function (c, i) {
          var rid = 'M:' + c;
          var src = (G.kg.nodes.filter(function (n) { return n.id === c; })[0] || G.skills.nodes.filter(function (n) { return n.id === c; })[0]);
          if (!src) return;
          if (!b.byId[rid]) b.addNode({ id: rid, type: 'mref', label: src.label, x: 850 + (i % 2) * 130, y: ty - 14 + Math.floor(i / 2) * 28, facts: { from: c, graph: G.kg.nodes.indexOf(src) >= 0 ? 'knowledge graph' : 'skill graph' } });
          b.addEdge({ s: id, t: rid, rel: 'cites' });
        });
        b.fit();
      }
      var li = el('li', '', '<b>Trace ' + k + '.</b> ' + esc(q) + ' <span class="muted">' + esc(data.route.families.filter(function (f) { return f.status !== 'routed_not_run'; }).map(function (f) { return f.label; }).join(' + ')) + ' &middot; ' + (data.cited || []).length + ' cited</span>');
      $('.gr-mem-list', root).appendChild(li);
      $('.gr-mem-n', root).textContent = S.traces + ' trace' + (S.traces === 1 ? '' : 's') + ' this visit. They also appear as new nodes on the map below.';
    }

    function renderMeter() {
      $('.gr-meter', root).textContent = S.calls ? 'This visit: ' + S.calls + ' AI call' + (S.calls === 1 ? '' : 's') + ' \u00b7 ' + meter({ input_tokens: S.tokIn, output_tokens: S.tokOut }) : $('.gr-meter', root).textContent;
    }

    function citeButtons(ids) {
      return ids.map(function (c) { return '<button type="button" class="gr-cite" data-cite="' + esc(c) + '">' + esc(c) + '</button>'; }).join(' ');
    }

    function ask(text) {
      var q = String(text || '').trim();
      if (busy) return;
      if (!q) { out.innerHTML = '<p class="gr-stop">Type a question first.</p>'; return; }
      if (q.length > 300) { out.innerHTML = '<p class="gr-stop">Keep questions to 300 characters.</p>'; return; }
      busy = true; go.disabled = true;
      out.innerHTML = '<p class="gr-wait">Routing in code, walking the graph, then one AI call\u2026</p>';
      var t0 = Date.now();
      fetch(ASK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: q }) })
        .then(function (r) { return r.json().catch(function () { return { ok: false, reason: 'ai_error', message: 'The graph agent is resting: the model is unavailable right now.' }; }); })
        .then(function (data) {
          var ms = Date.now() - t0, calls = data.calls || [];
          calls.forEach(function (c) { S.calls++; S.tokIn += c.usage.input_tokens; S.tokOut += c.usage.output_tokens; S.cost += cost(c.usage); });
          renderMeter();
          var meterHtml = calls.map(function (c) { return '<p class="gr-callm"><span class="gr-live">AI call</span> Graph agent (' + (c.model === 'primary' ? 'main model' : 'fallback model') + ') \u00b7 ' + esc(meter(c.usage)) + '</p>'; }).join('');
          if (!data.route) { out.innerHTML = '<p class="gr-stop">' + esc(data.error || 'We could not read your request.') + '</p>'; return; }
          var head;
          if (data.ok) {
            head = '<div class="gr-answer"><p class="gr-k">Answer</p><p>' + esc(data.answer) + '</p>' + (data.cited.length ? '<p class="gr-cites">Cited nodes: ' + citeButtons(data.cited) + '</p>' : '') + meterHtml + '<p class="gr-lat">Answered in ' + (data.latency_ms != null ? (data.latency_ms / 1000).toFixed(1) : (ms / 1000).toFixed(1)) + ' s.</p></div>';
          } else {
            var when = data.retry_at ? ' Back at ' + centralTime(data.retry_at) + '.' : data.reason === 'ai_error' || data.reason === 'unavailable' ? ' Try again in a few minutes.' : '';
            head = '<div class="gr-answer gr-answer-stop"><p class="gr-k">No answer</p><p>' + esc(data.message || 'The graph agent is resting.') + esc(when) + ' The graphs, the route and the walk below are code and still work.</p>' + meterHtml + '</div>';
          }
          out.innerHTML = head + '<h3 class="gr-h3">How the brain routed it</h3>' + routeList(data.route, data);
          $$('[data-cite]', out).forEach(function (b) {
            b.addEventListener('click', function () {
              var id = b.getAttribute('data-cite'), g = graphs.kg && graphs.kg.byId[id] ? graphs.kg : graphs.skills;
              if (!g || !g.byId[id]) return;
              g.setFocus(id); g.select(id); g.root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
            });
          });
          light(data);
          if (data.ok) remember(q, data);
        })
        .catch(function () { out.innerHTML = '<p class="gr-stop">The graph agent is resting: the network call failed. The graphs still work.</p>'; })
        .then(function () { busy = false; go.disabled = false; });
    }
  });

  if (window.AE) window.AE.graphsUi = { Graph: Graph, CHIPS: CHIPS };
})();
