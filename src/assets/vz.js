/* Visuals for leaders: storyboards with pictures, "Today vs Transformed" calculators, the clerk's week, the ownership
   map and the 30-month roadmap. All SVG is drawn here; no inline style, no network, nothing stored. Inputs can be
   shared through the URL hash only. Load after vz-core.js. */
(function () {
  'use strict';
  var AE = window.AE || {}, V = AE.vz;
  if (!V) return;
  var NS = 'http://www.w3.org/2000/svg';
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!mq.matches; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, t, cls, anchor) {
    var e = svgEl('text', { x: x, y: y, 'class': cls || '', 'text-anchor': anchor || 'start' }, parent);
    e.textContent = t;
    return e;
  }
  // Reveal once in view; at once when motion is reduced or the observer is missing.
  function onView(node, fn) {
    if (reduced() || !('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { threshold: 0.25 });
    io.observe(node);
  }
  // Tween an SVG attribute; jumps to the end when motion is reduced.
  function tween(el, attr, to, ms) {
    var from = parseFloat(el.getAttribute(attr)) || 0;
    if (reduced() || !window.requestAnimationFrame || from === to) { el.setAttribute(attr, to); return; }
    var t0 = null;
    el._tw = (el._tw || 0) + 1;
    var id = el._tw;
    function step(t) {
      if (id !== el._tw) return;
      if (t0 == null) t0 = t;
      var k = Math.min(1, (t - t0) / (ms || 500)), e = 1 - Math.pow(1 - k, 3);
      el.setAttribute(attr, from + (to - from) * e);
      if (k < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  /* ================= Pictures for storyboard panels ================= */
  // data-pic="icon|mail", "bars|4|0.03|4 days|39 min", "gauge|0.87|0.81", "dots|20|3", "level|3", "chain|5|2"
  var ICONS = {
    mail: function (g) { svgEl('rect', { x: 52, y: 16, width: 56, height: 38, rx: 3, 'class': 'd' }, g); svgEl('path', { d: 'M52 18 L80 40 L108 18', 'class': 'd' }, g); },
    doc: function (g) { svgEl('path', { d: 'M60 10 H92 L102 20 V62 H60 Z', 'class': 'd' }, g); [28, 38, 48].forEach(function (y) { svgEl('path', { d: 'M68 ' + y + ' H94', 'class': 'd thin' }, g); }); },
    graph: function (g) { var p = [[50, 20], [84, 14], [110, 36], [72, 52], [44, 48]]; [[0, 1], [1, 2], [1, 3], [3, 4], [0, 3]].forEach(function (l) { svgEl('path', { d: 'M' + p[l[0]] + ' L' + p[l[1]], 'class': 'd thin' }, g); }); p.forEach(function (q, i) { svgEl('circle', { cx: q[0], cy: q[1], r: i === 3 ? 7 : 5, 'class': i === 3 ? 'acc' : 'd' }, g); }); },
    db: function (g) { svgEl('ellipse', { cx: 80, cy: 16, rx: 24, ry: 7, 'class': 'd' }, g); svgEl('path', { d: 'M56 16 V54 A24 7 0 0 0 104 54 V16', 'class': 'd' }, g); svgEl('path', { d: 'M56 35 A24 7 0 0 0 104 35', 'class': 'd thin' }, g); },
    person: function (g) { svgEl('circle', { cx: 80, cy: 22, r: 10, 'class': 'd' }, g); svgEl('path', { d: 'M60 62 C60 42 100 42 100 62', 'class': 'd' }, g); },
    people: function (g) { [56, 80, 104].forEach(function (x, i) { svgEl('circle', { cx: x, cy: 24, r: 8, 'class': i === 1 ? 'acc' : 'd' }, g); svgEl('path', { d: 'M' + (x - 14) + ' 60 C' + (x - 14) + ' 42 ' + (x + 14) + ' 42 ' + (x + 14) + ' 60', 'class': 'd' }, g); }); },
    shield: function (g) { svgEl('path', { d: 'M80 8 L104 18 V36 C104 50 92 58 80 64 C68 58 56 50 56 36 V18 Z', 'class': 'd' }, g); svgEl('path', { d: 'M70 36 L78 44 L92 28', 'class': 'd acc-s' }, g); },
    gate: function (g) { svgEl('path', { d: 'M48 62 V14 M112 62 V14', 'class': 'd' }, g); svgEl('rect', { x: 48, y: 26, width: 64, height: 8, 'class': 'acc' }, g); svgEl('circle', { cx: 80, cy: 50, r: 6, 'class': 'd' }, g); },
    agent: function (g) { svgEl('rect', { x: 58, y: 20, width: 44, height: 34, rx: 6, 'class': 'd' }, g); svgEl('path', { d: 'M80 20 V10', 'class': 'd' }, g); svgEl('circle', { cx: 80, cy: 8, r: 3, 'class': 'acc' }, g); svgEl('circle', { cx: 71, cy: 35, r: 3, 'class': 'acc' }, g); svgEl('circle', { cx: 89, cy: 35, r: 3, 'class': 'acc' }, g); svgEl('path', { d: 'M71 45 H89', 'class': 'd thin' }, g); },
    factory: function (g) { svgEl('path', { d: 'M40 62 V30 L60 40 V30 L80 40 V30 L100 40 V14 H112 V62 Z', 'class': 'd' }, g); svgEl('rect', { x: 62, y: 48, width: 10, height: 14, 'class': 'acc' }, g); },
    truck: function (g) { svgEl('rect', { x: 40, y: 22, width: 50, height: 28, 'class': 'd' }, g); svgEl('path', { d: 'M90 30 H106 L116 40 V50 H90 Z', 'class': 'd' }, g); svgEl('circle', { cx: 56, cy: 54, r: 6, 'class': 'acc' }, g); svgEl('circle', { cx: 104, cy: 54, r: 6, 'class': 'acc' }, g); },
    coin: function (g) { svgEl('circle', { cx: 72, cy: 38, r: 20, 'class': 'd' }, g); svgEl('circle', { cx: 92, cy: 30, r: 20, 'class': 'd acc-s' }, g); },
    loop: function (g) { svgEl('path', { d: 'M104 36 A24 22 0 1 1 96 18', 'class': 'd' }, g); svgEl('path', { d: 'M96 8 L98 19 L87 21', 'class': 'd acc-s' }, g); },
    sign: function (g) { svgEl('path', { d: 'M40 54 H120', 'class': 'd thin' }, g); svgEl('path', { d: 'M48 46 C56 30 62 54 70 40 S84 34 90 44 S100 40 108 38', 'class': 'd acc-s' }, g); },
    clock: function (g) { svgEl('circle', { cx: 80, cy: 36, r: 24, 'class': 'd' }, g); svgEl('path', { d: 'M80 36 V20 M80 36 L92 42', 'class': 'd acc-s' }, g); },
    id: function (g) { svgEl('rect', { x: 50, y: 14, width: 60, height: 42, rx: 4, 'class': 'd' }, g); svgEl('circle', { cx: 66, cy: 32, r: 7, 'class': 'acc' }, g); svgEl('path', { d: 'M80 28 H100 M80 38 H96', 'class': 'd thin' }, g); },
    map: function (g) { svgEl('path', { d: 'M44 18 L66 10 L94 20 L116 12 V56 L94 64 L66 54 L44 62 Z', 'class': 'd' }, g); svgEl('path', { d: 'M66 10 V54 M94 20 V64', 'class': 'd thin' }, g); }
  };
  function pic(spec) {
    var a = String(spec || 'icon|doc').split('|');
    var svg = svgEl('svg', { viewBox: '0 0 160 72', 'class': 'vz-pic', 'aria-hidden': 'true', focusable: 'false' });
    var g = svgEl('g', {}, svg);
    if (a[0] === 'icon') (ICONS[a[1]] || ICONS.doc)(g);
    else if (a[0] === 'bars') {
      var x = +a[1], y = +a[2], m = Math.max(x, y) || 1;
      [[x, a[3], 'vz-pb-t', 14], [y, a[4], 'vz-pb-r', 44]].forEach(function (b) {
        svgEl('rect', { x: 8, y: b[3], width: Math.max(2, 80 * b[0] / m), height: 14, 'class': 'grow ' + b[2] }, g);
        text(g, 152, b[3] + 11, b[1] || '', 'vz-pt', 'end');
      });
    } else if (a[0] === 'gauge') {
      var p = +a[1], th = +a[2];
      function pt(v, r) { var ang = Math.PI * (1 - v); return [80 + r * Math.cos(ang), 62 - r * Math.sin(ang)]; }
      svgEl('path', { d: 'M28 62 A52 52 0 0 1 132 62', 'class': 'd thin' }, g);
      var t1 = pt(th, 46), t2 = pt(th, 60);
      svgEl('path', { d: 'M' + t1 + ' L' + t2, 'class': 'd acc-s' }, g);
      var n = pt(p, 44);
      svgEl('path', { d: 'M80 62 L' + n, 'class': 'd needle' }, g);
      text(g, t2[0] + 4, t2[1] - 2, 'p* ' + th, 'vz-pt');
      text(g, 4, 70, 'p ' + p, 'vz-pt vz-ptb');
    } else if (a[0] === 'dots') {
      var tot = Math.min(24, +a[1] || 1), hi = +a[2] || 0;
      for (var i = 0; i < tot; i++) svgEl('circle', { cx: 20 + (i % 12) * 11, cy: 22 + Math.floor(i / 12) * 22, r: 4, 'class': i < hi ? 'acc' : 'd' }, g);
    } else if (a[0] === 'level') {
      var L = +a[1];
      for (var k = 0; k <= 5; k++) {
        svgEl('rect', { x: 14 + k * 23, y: 50 - k * 8, width: 19, height: 8 + k * 8, 'class': k === L ? 'acc' : k < L ? 'vz-pl-done' : 'd thin' }, g);
        text(g, 23.5 + k * 23, 70, 'L' + k, 'vz-pt', 'middle');
      }
    } else if (a[0] === 'kill') {
      // K1..K5: the level pulled is orange; wider stops are taller.
      var K = +a[1];
      for (var q = 1; q <= 5; q++) {
        svgEl('rect', { x: 8 + (q - 1) * 30, y: 54 - q * 8, width: 24, height: 6 + q * 8, rx: 2, 'class': q === K ? 'acc' : 'd thin' }, g);
        text(g, 20 + (q - 1) * 30, 70, 'K' + q, q === K ? 'vz-pt vz-ptb' : 'vz-pt', 'middle');
      }
    } else if (a[0] === 'chain') {
      var nn = +a[1] || 4, cur = +a[2];
      for (var c = 0; c < nn; c++) {
        var cx = 20 + c * (120 / Math.max(1, nn - 1));
        if (c) svgEl('path', { d: 'M' + (cx - 120 / (nn - 1) + 7) + ' 36 H' + (cx - 7), 'class': 'd thin' }, g);
        svgEl('circle', { cx: cx, cy: 36, r: 7, 'class': c === cur ? 'acc' : 'd' }, g);
      }
    }
    return svg;
  }

  /* ================= Storyboard: pictures, step-through, play ================= */
  function story(ol) {
    var panels = $$(':scope > li', ol);
    if (!panels.length) return;
    panels.forEach(function (li) { if (li.dataset.pic) li.insertBefore(pic(li.dataset.pic), li.children[1] || null); });
    onView(ol, function () { ol.classList.add('vz-in'); });
    var ctl = document.createElement('div');
    ctl.className = 'vz-ctl';
    ctl.setAttribute('role', 'group');
    ctl.setAttribute('aria-label', 'Step through the storyboard');
    ctl.innerHTML = '<button type="button" class="btn btn-ghost btn-sm" data-a="prev">Previous</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-a="play" aria-pressed="false">Play</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-a="next">Next</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-a="all">Show all</button>' +
      '<p class="vz-status" aria-live="polite">' + panels.length + ' steps. Press Play or Next.</p>';
    ol.parentNode.insertBefore(ctl, ol);
    var cur = -1, timer = null, playBtn = $('[data-a="play"]', ctl), status = $('.vz-status', ctl);
    function title(i) { var h = $('h3', panels[i]); return h ? h.textContent : ''; }
    function show(i, fromUser) {
      cur = i;
      ol.classList.toggle('vz-dim', i >= 0);
      panels.forEach(function (li, j) { li.classList.toggle('vz-cur', j === i); });
      if (i < 0) { status.textContent = 'All ' + panels.length + ' steps shown.'; return; }
      status.textContent = 'Step ' + (i + 1) + ' of ' + panels.length + ': ' + title(i) + '.';
      if (fromUser || timer) {
        var r = panels[i].getBoundingClientRect(), vh = window.innerHeight || 800;
        if (r.top < 70 || r.bottom > vh) panels[i].scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      }
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } playBtn.setAttribute('aria-pressed', 'false'); playBtn.textContent = 'Play'; }
    function play() {
      if (timer) { stop(); return; }
      if (cur >= panels.length - 1) cur = -1;
      show(cur + 1, true);
      playBtn.setAttribute('aria-pressed', 'true'); playBtn.textContent = 'Pause';
      timer = setInterval(function () {
        if (cur >= panels.length - 1) { stop(); status.textContent += ' End of the story.'; return; }
        show(cur + 1);
      }, reduced() ? 6000 : 3400);
    }
    ctl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.dataset.a;
      if (a === 'play') return play();
      stop();
      if (a === 'next') show(Math.min(panels.length - 1, cur + 1), true);
      else if (a === 'prev') show(Math.max(0, cur - 1), true);
      else show(-1);
    });
    panels.forEach(function (li, j) { li.addEventListener('click', function () { stop(); show(j); }); });
  }

  /* ================= Today vs Transformed calculator ================= */
  var UNIT = { pct: '%', min: 'min', h: 'hours', days: 'days', num: '', people: '', fte: '' };
  function calc(root, spec, opts) {
    opts = opts || {};
    var names = opts.names || ['Today', 'Transformed'];
    var v = V.decode(spec, location.hash) || V.defaults(spec), fromHash = !!V.decode(spec, location.hash);
    var counts = opts.counts ? opts.counts() : null;
    var uid = 'vz-' + spec.id;
    function srcLine(i) {
      if (i.src === V.YOU) return '<span class="vz-src vz-src-you">Illustrative default. Set your own.' + (i.note ? ' ' + esc(i.note) : '') + '</span>';
      return '<span class="vz-src">Book figure, ' + (i.src === 'Hours bases' ? 'front matter, hours bases' : esc(i.src)) + '</span>';
    }
    var OWN = spec.own || [];
    function anyOwn() { return OWN.some(function (i) { return v[i.k] != null; }); }
    function ownHtml() {
      if (!OWN.length) return '';
      return '<details class="vz-mine"' + (anyOwn() ? ' open' : '') + '><summary>Add your own details</summary>' +
        '<p class="vz-src">Optional. Leave a box blank to keep the book default. A figure you enter replaces it.</p>' +
        OWN.map(function (i) {
          var unit = i.unit === 'money' ? '<span class="vz-u vz-cur">' + esc(V.sym(v.cur)) + '</span>' : '';
          return '<label class="vz-f" for="' + uid + '-o-' + i.k + '"><span class="vz-fl">' + esc(i.label) + '</span>' +
            '<span class="vz-fi">' + unit + '<input id="' + uid + '-o-' + i.k + '" type="number" inputmode="decimal" data-o="' + i.k + '" min="' + i.min + '" max="' + i.max + '" step="' + i.step + '" placeholder="Book default" value="' + (v[i.k] == null ? '' : v[i.k]) + '">' +
            (UNIT[i.unit] ? '<span class="vz-u">' + UNIT[i.unit] + '</span>' : '') + '</span>' +
            '<span class="vz-src" data-os="' + i.k + '"></span></label>';
        }).join('') + '</details>';
    }
    function ownSrc() {
      OWN.forEach(function (i) {
        var el = $('[data-os="' + i.k + '"]', root); if (!el) return;
        el.className = 'vz-src' + (v[i.k] == null ? '' : ' vz-src-you');
        el.textContent = v[i.k] == null ? 'Book default (' + i.src.replace('Hours bases', 'front matter') + '): ' + i.book + '.' : 'Your figure. It replaces the book default: ' + i.book + '.';
      });
    }
    var curOpts = V.CURRENCIES.map(function (c) { return '<option value="' + c[0] + '">' + (c[0] === 'XXX' ? 'Other (' + c[1] + ')' : c[0] + ' (' + c[1] + ')') + '</option>'; }).join('');
    root.innerHTML =
      '<div class="vz-calc">' +
        '<div class="vz-calc-head"><p class="vz-kicker">Today vs transformed &middot; your numbers</p><h3 class="vz-h">' + esc(spec.title) + '</h3>' +
        '<p class="vz-priv">Computed in your browser. Nothing is stored or sent.</p></div>' +
        '<div class="vz-calc-grid">' +
          '<fieldset class="vz-fs"><legend>Your inputs</legend>' +
            spec.inputs.map(function (i) {
              var unit = i.unit === 'money' ? '<span class="vz-u vz-cur">' + esc(V.sym(v.cur)) + '</span>' : '';
              return '<label class="vz-f" for="' + uid + '-' + i.k + '"><span class="vz-fl">' + esc(i.label) + '</span>' +
                '<span class="vz-fi">' + unit + '<input id="' + uid + '-' + i.k + '" type="number" inputmode="decimal" data-k="' + i.k + '" min="' + i.min + '" max="' + i.max + '" step="' + i.step + '" value="' + v[i.k] + '">' +
                (UNIT[i.unit] ? '<span class="vz-u">' + UNIT[i.unit] + '</span>' : '') + '</span>' + srcLine(i) + '</label>';
            }).join('') +
            (spec.choice ? '<label class="vz-f" for="' + uid + '-ch"><span class="vz-fl">' + esc(spec.choice.label) + '</span><span class="vz-fi"><select id="' + uid + '-ch" data-choice="1">' +
              Object.keys(spec.choice.options).map(function (k) { return '<option value="' + k + '"' + (v[spec.choice.k] === k ? ' selected' : '') + '>' + esc(spec.choice.options[k].label) + '</option>'; }).join('') +
              '</select></span><span class="vz-src">Book default: close Ch 01.9.2; order to cash Ch 30.5.1. Pick the closest.</span></label>' : '') +
            '<label class="vz-f" for="' + uid + '-cur"><span class="vz-fl">Currency</span><span class="vz-fi"><select id="' + uid + '-cur" data-cur="1">' + curOpts + '</select></span><span class="vz-src">Symbol only. Enter amounts in your currency; nothing is converted.</span></label>' +
            ownHtml() +
          '</fieldset>' +
          '<div class="vz-out"><div class="vz-legend" aria-hidden="true"><span class="vz-lg-t">' + esc(names[0]) + '</span><span class="vz-lg-r">' + esc(names[1]) + '</span></div><div class="vz-rows"></div>' +
          '<p class="vz-sum" role="status" aria-live="polite"></p><div class="vz-levers"></div></div>' +
        '</div>' +
        '<details class="vz-how"><summary>How this is calculated</summary><ul class="vz-formula"></ul></details>' +
        '<div class="vz-actions"><button type="button" class="btn btn-ghost btn-sm" data-a="reset">Reset to the defaults</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-a="share">Copy a link to this view</button><span class="vz-share-msg" role="status"></span></div>' +
        '<div class="vz-ask"><p class="vz-ask-h">Have more details or a different situation? Ask Hemanth.</p>' +
        '<p class="vz-ask-p">The guide opens with your figures in the box. Nothing is sent until you press Send.</p>' +
        '<p class="vz-ask-b"><a class="btn btn-primary btn-sm" data-ask="1" href="/talk/">Ask Hemanth through the guide</a>' +
        '<a class="more" href="' + V.LINKEDIN + '" rel="noopener" target="_blank">Message Hemanth on LinkedIn<span class="visually-hidden"> (opens in a new tab)</span></a></p></div>' +
      '</div>';
    $('[data-cur]', root).value = v.cur;
    var rowsEl = $('.vz-rows', root), sumEl = $('.vz-sum', root), levEl = $('.vz-levers', root), built = false;

    function rowHtml(r, i) {
      return '<div class="vz-row' + (r.key ? ' vz-key' : '') + '" data-i="' + i + '"><p class="vz-rl"><span class="vz-rlt">' + esc(r.label) + '</span> <span class="vz-tag"></span></p>' +
        '<div class="vz-b"><span class="vz-bn">' + esc(names[0]) + '</span><svg class="vz-bar" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect class="vz-bt" x="0" y="0" height="10" width="0"></rect></svg><b class="vz-vt"></b></div>' +
        '<div class="vz-b"><span class="vz-bn">' + esc(names[1]) + '</span><svg class="vz-bar" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect class="vz-br" x="0" y="0" height="10" width="0"></rect></svg><b class="vz-vr"></b></div>' +
        '<p class="vz-d"></p></div>';
    }
    function update() {
      if (opts.counts) counts = opts.counts();
      var r = spec.compute(v, counts);
      if (!built) { rowsEl.innerHTML = r.rows.map(rowHtml).join(''); built = true; }
      r.rows.forEach(function (row, i) {
        var el = $('.vz-row[data-i="' + i + '"]', rowsEl), m = Math.max(Math.abs(row.today), Math.abs(row.re)) || 1;
        $('.vz-rlt', el).textContent = row.label;
        var tag = $('.vz-tag', el);
        tag.textContent = row.basis === 'you' ? 'Your figure' : row.basis ? 'Book default (' + row.basis + ')' : '';
        tag.className = 'vz-tag' + (row.basis === 'you' ? ' vz-tag-you' : '');
        tween($('.vz-bt', el), 'width', Math.max(row.today ? 1 : 0, 100 * Math.abs(row.today) / m), 450);
        tween($('.vz-br', el), 'width', Math.max(row.re ? 1 : 0, 100 * Math.abs(row.re) / m), 450);
        $('.vz-vt', el).textContent = V.fmt(row.today, row.unit, v.cur);
        $('.vz-vr', el).textContent = V.fmt(row.re, row.unit, v.cur);
        var d = $('.vz-d', el), better;
        if (row.today === row.re) { d.textContent = 'Same'; better = null; }
        else if (!row.today) { d.textContent = (row.re > 0 ? '+' : '') + V.fmt(row.re, row.unit, v.cur); better = row.higher ? row.re > 0 : row.re < 0; }
        else { var pc = (row.re - row.today) / Math.abs(row.today) * 100; d.textContent = (pc > 0 ? '+' : '') + V.num(pc, Math.abs(pc) < 10 ? 1 : 0) + '%' ; better = row.higher ? pc > 0 : pc < 0; }
        if (row.neutral) better = null;
        d.className = 'vz-d' + (better === true ? ' vz-good' : better === false ? ' vz-bad' : '');
      });
      var key = r.rows.filter(function (x) { return x.key; })[0] || r.rows[0];
      sumEl.textContent = key.label + ': ' + names[0] + ' ' + V.fmt(key.today, key.unit, v.cur) + '; ' + names[1] + ' ' + V.fmt(key.re, key.unit, v.cur) + '.';
      if (r.levers) {
        var L = r.levers;
        levEl.innerHTML = '<p class="vz-lev"><b>Which lever matters most at your numbers?</b> One point less exception rate saves ' + esc(V.money(L.exceptionPoint, v.cur)) +
          ' a year. One point more agent share saves ' + esc(V.money(-L.autonomyPoint, v.cur)) + '. ' +
          (isFinite(L.ratio) ? 'So one point of exception rate is worth about <b>' + esc(V.num(L.ratio, 1)) + ' points</b> of agent share. ' : '') +
          'Remove the exception before you automate it. <span class="md-cite">Book, Ch 21.13.3</span></p>';
      }
      $('.vz-formula', root).innerHTML = r.formula.map(function (f) { return '<li' + (/^Your figure/.test(f) ? ' class="vz-f-you"' : '') + '>' + esc(f) + '</li>'; }).join('');
      ownSrc();
      // The guide reads #ask= in the browser only; the hash never reaches the server.
      $('[data-ask]', root).setAttribute('href', '/talk/#ask=' + encodeURIComponent(V.askText(spec, v, r)));
      if (opts.after) opts.after(r, v);
    }
    $$('input[data-k]', root).forEach(function (inp) {
      var spec_i = spec.inputs.filter(function (i) { return i.k === inp.dataset.k; })[0];
      inp.addEventListener('input', function () {
        var n = parseFloat(inp.value);
        if (inp.value === '' || !isFinite(n) || n < spec_i.min || n > spec_i.max) { inp.setAttribute('aria-invalid', 'true'); return; }
        inp.removeAttribute('aria-invalid'); v[spec_i.k] = n; update();
      });
      inp.addEventListener('change', function () { v[spec_i.k] = V.values(spec, v)[spec_i.k]; inp.value = v[spec_i.k]; inp.removeAttribute('aria-invalid'); update(); });
    });
    $$('input[data-o]', root).forEach(function (inp) {
      var oi = OWN.filter(function (i) { return i.k === inp.dataset.o; })[0];
      inp.addEventListener('input', function () {
        if (inp.value === '') { inp.removeAttribute('aria-invalid'); v[oi.k] = null; update(); return; }
        var n = parseFloat(inp.value);
        if (!isFinite(n) || n < oi.min || n > oi.max) { inp.setAttribute('aria-invalid', 'true'); return; }
        inp.removeAttribute('aria-invalid'); v[oi.k] = n; update();
      });
      inp.addEventListener('change', function () {
        v[oi.k] = inp.value === '' ? null : V.values(spec, v)[oi.k];
        inp.value = v[oi.k] == null ? '' : v[oi.k]; inp.removeAttribute('aria-invalid'); update();
      });
    });
    $('[data-cur]', root).addEventListener('change', function (e) { v.cur = e.target.value; $$('.vz-cur', root).forEach(function (s) { s.textContent = V.sym(v.cur); }); update(); });
    var ch = $('[data-choice]', root);
    if (ch) ch.addEventListener('change', function () { v[spec.choice.k] = ch.value; update(); });
    $('[data-a="reset"]', root).addEventListener('click', function () {
      v = V.defaults(spec);
      $$('input[data-k]', root).forEach(function (inp) { inp.value = v[inp.dataset.k]; inp.removeAttribute('aria-invalid'); });
      $$('input[data-o]', root).forEach(function (inp) { inp.value = ''; inp.removeAttribute('aria-invalid'); });
      $('[data-cur]', root).value = v.cur; $$('.vz-cur', root).forEach(function (s) { s.textContent = V.sym(v.cur); });
      if (ch) ch.value = v[spec.choice.k];
      update();
      $('.vz-share-msg', root).textContent = 'Defaults restored.';
    });
    $('[data-a="share"]', root).addEventListener('click', function () {
      var url = location.href.split('#')[0] + '#' + V.encode(spec, v), msg = $('.vz-share-msg', root);
      try { history.replaceState(null, '', url); } catch (e) { /* ignore */ }
      var done = function () { msg.textContent = 'Link copied. Your inputs travel in the link only.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { msg.textContent = 'The link is in the address bar.'; });
      else msg.textContent = 'The link is in the address bar.';
    });
    update();
    if (fromHash) setTimeout(function () { root.scrollIntoView({ block: 'start' }); }, 60);
    return { update: update };
  }

  /* ================= One clerk's week (Table 24.8) ================= */
  var CLS = { absorb: 'Absorb', augment: 'Augment', retain: 'Retain', 'new': 'New' };
  function clerk(root) {
    var rows = V.CLERK, tot = V.clerkTotals(), state = 'today', timer = null;
    root.innerHTML =
      '<div class="vz-clerk">' +
        '<div class="vz-ctl" role="group" aria-label="Show the clerk\u2019s time"><button type="button" class="btn btn-ghost btn-sm" data-s="today" aria-pressed="true">Today</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-s="after" aria-pressed="false">After L3</button>' +
        '<button type="button" class="btn btn-primary btn-sm" data-s="play">Play the change</button><p class="vz-status" aria-live="polite"></p></div>' +
        '<ol class="vz-ck">' + rows.map(function (r, i) {
          return '<li class="vz-ck-r vz-c-' + r.cls + '" data-i="' + i + '"><span class="vz-ck-l">' + esc(r.task) + ' <em>' + CLS[r.cls] + '</em></span>' +
            '<svg class="vz-bar" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect x="0" y="0" height="10" width="0"></rect></svg><b class="vz-ck-v"></b></li>';
        }).join('') +
        '<li class="vz-ck-r vz-ck-tot"><span class="vz-ck-l">Total time used</span><svg class="vz-bar" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect x="0" y="0" height="10" width="0"></rect></svg><b class="vz-ck-v"></b></li></ol>' +
        '<ul class="vz-ck-key" aria-label="Task classes"><li class="vz-c-absorb">Absorb: the agent does it</li><li class="vz-c-augment">Augment: the agent prepares, a person decides</li><li class="vz-c-retain">Retain: a person does it</li><li class="vz-c-new">New: work that did not exist</li></ul>' +
        '<div class="vz-ck-team"><label class="vz-f" for="vz-ck-n"><span class="vz-fl">People in your team doing this work</span><span class="vz-fi"><input id="vz-ck-n" type="number" inputmode="numeric" min="1" max="20000" step="1" value="85"></span><span class="vz-src">Book figure, Ch 24.7.9 (Meridian AP)</span></label>' +
        '<label class="vz-f" for="vz-ck-h"><span class="vz-fl">Productive hours per person-year</span><span class="vz-fi"><input id="vz-ck-h" type="number" inputmode="numeric" min="1000" max="2400" step="10" value="1800"><span class="vz-u">hours</span></span><span class="vz-src">Book figure, front matter, hours bases</span></label>' +
        '<p class="vz-ck-out" role="status" aria-live="polite"></p></div>' +
      '</div>';
    var lis = $$('.vz-ck-r', root), status = $('.vz-status', root);
    function paint(s) {
      state = s;
      $$('[data-s]', root).forEach(function (b) { if (b.dataset.s !== 'play') b.setAttribute('aria-pressed', String(b.dataset.s === s)); });
      rows.forEach(function (r, i) { var val = r[s]; tween($('rect', lis[i]), 'width', val * 100 / 30, 700); $('.vz-ck-v', lis[i]).textContent = val + '%'; });
      var t = tot[s];
      tween($('rect', lis[rows.length]), 'width', t, 700); $('.vz-ck-v', lis[rows.length]).textContent = t + '%';
      status.textContent = s === 'today' ? 'Today: ' + tot.today + '% of the clerk\u2019s time is used on these tasks.' : 'After L3: ' + tot.after + '% is used, and two new tasks exist.';
    }
    function team() {
      var n = +$('#vz-ck-n', root).value, h = +$('#vz-ck-h', root).value;
      if (!(n >= 1 && n <= 20000 && h >= 1000 && h <= 2400)) return;
      var r = V.clerkTeam(n, h);
      $('.vz-ck-out', root).innerHTML = 'About <b>' + Math.round(r.released * 100) + '%</b> of each person\u2019s time is released. For ' + V.num(n) + ' people that is about <b>' + V.num(r.hours) + ' hours a year</b>, or ' + V.num(r.people, 1) +
        ' person-years. It becomes a saving only when roles change, for example by not refilling posts. <span class="md-cite">Book, Ch 24.7.9 and Ch 01.9.1</span>';
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-s]'); if (!b) return;
      if (timer) { clearTimeout(timer); timer = null; }
      if (b.dataset.s === 'play') { paint('today'); timer = setTimeout(function () { timer = null; paint('after'); }, reduced() ? 0 : 1200); }
      else paint(b.dataset.s);
    });
    $$('input', root).forEach(function (i) { i.addEventListener('input', team); });
    team();
    var rects = $$('rect', root); rects.forEach(function (r) { r.setAttribute('width', 0); });
    onView(root, function () { paint(reduced() ? 'after' : 'today'); if (!reduced()) timer = setTimeout(function () { timer = null; paint('after'); }, 1600); });
  }

  /* ================= Who owns what (Ch 01.8) ================= */
  var OWNERS = [
    { id: 'cfo', role: 'CFO', owns: 'Owns the limits', text: 'The limit matrix is finance policy, not an IT setting.', href: '/frameworks/#ceiling', link: 'Materiality and reversibility' },
    { id: 'cio', role: 'CIO', owns: 'Owns the harness', text: 'Owns the harness, the interfaces and the cross-vendor inventory.', href: '/architecture/', link: 'Reference architecture' },
    { id: 'coo', role: 'COO', owns: 'Owns the boundary', text: 'Owns the boundary between agents and physical operations.', href: '/blueprints/models/', link: 'Models, including physical AI' },
    { id: 'chro', role: 'CHRO', owns: 'Owns role redesign', text: 'Owns role redesign and the HR uses classed as high-risk.', href: '/blueprints/organization/', link: 'Organization: humans and agents' },
    { id: 'cdo', role: 'Chief data officer', owns: 'Owns the context', text: 'Owns the system of context.', href: '/blueprints/graphs/', link: 'Knowledge graph and enterprise brain' },
    { id: 'cro', role: 'Chief risk officer and internal audit', owns: 'Own the evidence', text: 'Own the evidence standard for decision traces.', href: '/blueprints/trace/', link: 'Decision trace viewer' }
  ];
  var OWNERS_MAP = {
    label: 'Who owns what in the agent estate', hub: ['Every agent', 'A named business owner'],
    hubHtml: '<p class="vz-own-h">Every agent</p><p>Every agent has a named business owner. The owner signs its limits and promotions and can stop it. No registry, no run. <span class="md-cite">Book, Ch 24.3</span></p><p class="vz-own-hint">Select a role to see what it owns.</p>',
    nodes: OWNERS.map(function (o) {
      return { l1: o.role.length > 18 ? (o.id === 'cro' ? 'CRO and audit' : 'Chief data officer') : o.role, l2: o.owns,
        html: '<p class="vz-own-h">' + esc(o.role) + '</p><p>' + esc(o.text) + ' <span class="md-cite">Book, Ch 01.8</span></p><p><a class="more" href="' + o.href + '">' + esc(o.link) + '</a></p>' };
    })
  };
  function owners(root) { hubMap(root, OWNERS_MAP); }
  // A hub with nodes around it (wide) or two columns on a spine (narrow). Click, Enter or arrows select a node.
  function hubMap(root, M) {
    root.innerHTML = '<div class="vz-own"><div class="vz-own-svg"></div><div class="vz-own-detail" role="status" aria-live="polite"></div></div>';
    var host = $('.vz-own-svg', root), detail = $('.vz-own-detail', root), sel = null, lastW = 0, N = M.nodes;
    function select(i, focus) {
      sel = i;
      $$('.vz-node', host).forEach(function (n) { var on = +n.dataset.i === i; n.setAttribute('aria-pressed', String(on)); n.classList.toggle('on', on); if (on && focus) n.focus(); });
      $$('.vz-link', host).forEach(function (l) { l.classList.toggle('on', +l.dataset.i === i); });
      detail.innerHTML = i < 0 ? M.hubHtml : N[i].html;
    }
    function draw() {
      var narrow = host.clientWidth < 560;
      lastW = host.clientWidth;
      host.innerHTML = '';
      var rowsN = Math.ceil(N.length / 2);
      var W = narrow ? 340 : 700, H = narrow ? 170 + rowsN * 105 - 35 : 340, cx = W / 2, cy = narrow ? 70 : H / 2;
      var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'vz-own-map', role: 'group', 'aria-label': M.label }, host);
      var pos = N.map(function (o, i) {
        if (narrow) return [i % 2 ? W * 0.75 : W * 0.25, 170 + Math.floor(i / 2) * 105];
        var ang = -Math.PI / 2 + i * (2 * Math.PI / N.length) + (N.length === 6 ? Math.PI / 6 : 0);
        return [cx + 240 * Math.cos(ang), cy + 120 * Math.sin(ang)];
      });
      pos.forEach(function (p, i) {
        // Narrow: a spine down the middle, then across to each card's inner edge, so no line crosses a card.
        var d = narrow ? 'M' + cx + ' ' + (cy + 32) + ' V' + p[1] + ' H' + (p[0] < cx ? p[0] + 78 : p[0] - 78) : 'M' + cx + ' ' + cy + ' L' + p[0] + ' ' + p[1];
        svgEl('path', { d: d, 'class': 'vz-link d', 'data-i': i }, svg);
      });
      function node(i, x, y, w, h, l1, l2) {
        var g = svgEl('g', { 'class': 'vz-node' + (i < 0 ? ' vz-hub' : ''), 'data-i': i, tabindex: 0, role: 'button', 'aria-pressed': 'false', 'aria-label': l1 + ': ' + l2 }, svg);
        svgEl('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 6 }, g);
        text(g, x, y - 4, l1, 'vz-n1', 'middle');
        text(g, x, y + 14, l2, 'vz-n2', 'middle');
        return g;
      }
      node(-1, cx, cy, narrow ? 200 : 190, 64, M.hub[0], M.hub[1]);
      N.forEach(function (o, i) { node(i, pos[i][0], pos[i][1], narrow ? 156 : 196, 60, o.l1, o.l2); });
      select(sel == null ? -1 : sel);
    }
    host.addEventListener('click', function (e) { var n = e.target.closest('.vz-node'); if (n) select(+n.dataset.i); });
    host.addEventListener('keydown', function (e) {
      var n = e.target.closest('.vz-node'); if (!n) return;
      var i = +n.dataset.i, all = N.length;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select(i < 0 ? 0 : (i + 1) % all, true); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select(i <= 0 ? all - 1 : i - 1, true); }
    });
    draw();
    onView(root, function () { root.classList.add('vz-in'); });
    var rt = null;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (Math.abs(host.clientWidth - lastW) > 40) draw(); }, 150); });
    return { select: select };
  }

  /* ================= The five decisions leaders own (home; Ch 01.1) ================= */
  function decisions(root) {
    var D = V.DECISIONS, list = root.closest('.mgmt') && $('.mgmt-grid', root.closest('.mgmt'));
    hubMap(root, {
      label: 'Five decisions leaders own', hub: ['Leaders own', 'five decisions'],
      hubHtml: '<p class="vz-own-h">Five decisions no framework makes</p><p>Frameworks build the agents. Leaders own these five decisions. That is human-led, agent-operated. <span class="md-cite">Book, Ch 01.1</span></p><p class="vz-own-hint">Select a decision to see the question, the answer and its tool.</p>',
      nodes: D.map(function (d) {
        return { l1: d.l1, l2: d.l2, html: '<p class="vz-own-h">' + esc(d.l1) + '</p><p><b>' + esc(d.q) + '</b></p><p>' + esc(d.a) + ' <span class="md-cite">Book, ' + esc(d.c) + '</span></p><p><a class="more" href="' + d.href + '">' + esc(d.link) + '</a></p>' };
      })
    });
    // The five cards stay for no-JS readers; with the map they fold behind one button.
    if (list) {
      list.hidden = true;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-ghost btn-sm vz-listbtn'; b.setAttribute('aria-expanded', 'false');
      b.textContent = 'Show all five as a list';
      root.parentNode.appendChild(b);
      b.addEventListener('click', function () {
        list.hidden = !list.hidden;
        b.setAttribute('aria-expanded', String(!list.hidden));
        b.textContent = list.hidden ? 'Show all five as a list' : 'Hide the list';
      });
    }
  }


  /* ================= Animated flows: a token walks a route; maps of nodes you can open ================= */
  // Spec in vz-core.js (AE.vz.FLOWS). Wide and narrow layouts are grids; a narrow 'route' layout draws only the
  // current case as one column. Play moves a token edge by edge; Next steps; Show all gives the final state.
  function flow(root, F) {
    var keys = Object.keys(F.nodes), ci = 0, step = -1, timer = null, lastW = 0, narrow = false, svg, gEdges, gNodes, tok, swarmG;
    var uid = 'vzf-' + Math.random().toString(36).slice(2, 7);
    root.innerHTML = '<div class="vz-flow">' +
      '<div class="vz-cases" role="group" aria-label="Choose a case">' + F.cases.map(function (c, i) {
        return '<button type="button" class="vz-case" data-c="' + i + '" aria-pressed="' + (i === 0) + '">' + esc(c.name) + '</button>';
      }).join('') + '</div>' +
      '<div class="vz-ctl" role="group" aria-label="Step through the flow"><button type="button" class="btn btn-primary btn-sm" data-a="play" aria-pressed="false">Play</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-a="next">Next</button><button type="button" class="btn btn-ghost btn-sm" data-a="all">Show all</button>' +
      '<p class="vz-status" aria-live="polite"></p></div>' +
      '<div class="vz-flow-svg"></div>' +
      '<div class="vz-flow-grid"><ol class="vz-flow-steps" aria-label="Steps in this case"></ol><div class="vz-own-detail vz-flow-detail" role="status" aria-live="polite"></div></div>' +
    '</div>';
    var host = $('.vz-flow-svg', root), status = $('.vz-status', root), list = $('.vz-flow-steps', root), detail = $('.vz-flow-detail', root), playBtn = $('[data-a="play"]', root);
    function C() { return F.cases[ci]; }
    function say(k) { var c = C(); return (c.say && c.say[k]) || F.nodes[k].d; }
    function sub(k) { var c = C(); return (c.sub && c.sub[k]) || F.nodes[k].s; }
    function cite(k) { var c = C(); return (c.cite && c.cite[k]) || F.nodes[k].c; }
    var G = {};
    function geom() {
      narrow = host.clientWidth < 560;
      var route = narrow && F.narrow === 'route', cols = route ? 1 : F.cols[narrow ? 1 : 0], rows = route ? C().route.length : F.rows[narrow ? 1 : 0];
      var W = narrow ? 340 : 760, cw = W / cols, rh = narrow ? 84 : 92, nw = Math.min(narrow ? (route ? 250 : 140) : 150, cw - 14), nh = narrow ? 56 : 58;
      var pos = {};
      if (route) C().route.forEach(function (k, i) { pos[k] = [W / 2, 40 + i * rh]; });
      else keys.forEach(function (k) { var c = F.nodes[k][narrow ? 'n' : 'w']; if (c) pos[k] = [cw * (c[0] + 0.5), 40 + c[1] * rh]; });
      G = { W: W, H: 40 + (rows - 1) * rh + 40, cw: cw, rh: rh, nw: nw, nh: nh, pos: pos, route: route };
    }
    function edgePath(a, b, o) {
      var A = G.pos[a], B = G.pos[b];
      var bus = o && (narrow ? o.nb : o.wb);
      if (bus != null && !G.route) { var X = bus < 0 ? 4 : G.cw * (bus + 0.5); return 'M' + A[0] + ' ' + A[1] + ' H' + X + ' V' + B[1] + ' H' + B[0]; }
      if (A[0] === B[0] || A[1] === B[1]) return 'M' + A[0] + ' ' + A[1] + ' L' + B[0] + ' ' + B[1];
      var my = A[1] + (B[1] > A[1] ? 1 : -1) * G.rh / 2;
      return 'M' + A[0] + ' ' + A[1] + ' V' + my + ' H' + B[0] + ' V' + B[1];
    }
    function edgeOf(a, b) { for (var i = 0; i < F.edges.length; i++) if (F.edges[i][0] === a && F.edges[i][1] === b) return F.edges[i]; return null; }
    function draw() {
      geom(); lastW = host.clientWidth; host.innerHTML = '';
      svg = svgEl('svg', { viewBox: '0 0 ' + G.W + ' ' + G.H, 'class': 'vz-flow-map', role: 'group', 'aria-label': F.label }, host);
      gEdges = svgEl('g', {}, svg);
      var edges = G.route ? C().route.slice(1).map(function (k, i) { return [C().route[i], k]; }) : F.edges;
      edges.forEach(function (e) {
        if (!G.pos[e[0]] || !G.pos[e[1]]) return;
        svgEl('path', { d: edgePath(e[0], e[1], e[2]), 'class': 'vz-edge', 'data-e': e[0] + '>' + e[1] }, gEdges);
      });
      gNodes = svgEl('g', {}, svg);
      keys.forEach(function (k) {
        var p = G.pos[k]; if (!p) return;
        var n = F.nodes[k];
        var g = svgEl('g', { 'class': 'vz-fn' + (n.gate ? ' vz-gate-n' : '') + (n.stop ? ' vz-stop-n' : ''), 'data-k': k, tabindex: 0, role: 'button', 'aria-label': n.t + ': ' + sub(k) }, gNodes);
        svgEl('rect', { x: p[0] - G.nw / 2, y: p[1] - G.nh / 2, width: G.nw, height: G.nh, rx: n.gate ? 14 : 5 }, g);
        text(g, p[0], p[1] - 4, n.t, 'vz-n1', 'middle');
        var st = text(g, p[0], p[1] + 14, sub(k), 'vz-n2 vz-fs', 'middle');
        st.setAttribute('data-s', k);
        fit(g);
      });
      swarmG = svgEl('g', { 'class': 'vz-swarm' }, svg);
      tok = svgEl('circle', { r: 8, cx: -20, cy: -20, 'class': 'vz-tok' }, svg);
      paint();
    }
    // A label wider than its box is squeezed to fit, never clipped.
    function fit(g) { $$('text', g).forEach(function (t) { t.removeAttribute('textLength'); try { if (t.getComputedTextLength && t.getComputedTextLength() > G.nw - 8) { t.setAttribute('textLength', G.nw - 8); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } } catch (e) { /* not rendered yet */ } }); }
    function nodeEl(k) { return $('.vz-fn[data-k="' + k + '"]', svg); }
    function listSteps() {
      var c = C();
      list.innerHTML = c.route.map(function (k, i) {
        return '<li data-i="' + i + '"><b>' + esc(F.nodes[k].t) + (/[?.]$/.test(F.nodes[k].t) ? '' : '.') + '</b> ' + esc(say(k)) + ' <span class="md-cite">Book, ' + esc(cite(k)) + '</span></li>';
      }).join('') + '<li class="vz-flow-end" data-i="' + c.route.length + '">' + esc(c.end) + '</li>';
    }
    function paint() {
      var c = C(), r = c.route;
      $$('.vz-fn', svg).forEach(function (g) {
        var k = g.dataset.k, i = r.indexOf(k);
        g.classList.toggle('in', i >= 0); g.classList.toggle('done', i >= 0 && i < step); g.classList.toggle('cur', i >= 0 && i === step);
        g.classList.toggle('out', i < 0);
        var t = $('[data-s]', g); if (t && t.textContent !== sub(k)) { t.textContent = sub(k); fit(g); }
      });
      $$('.vz-edge', svg).forEach(function (e) {
        var ab = e.getAttribute('data-e').split('>'), i = r.indexOf(ab[0]);
        e.classList.toggle('on', i >= 0 && r[i + 1] === ab[1] && i + 1 <= step);
      });
      $$('li', list).forEach(function (li) { var i = +li.dataset.i; li.classList.toggle('on', i <= step || (step >= r.length - 1 && i === r.length)); li.classList.toggle('cur', i === step); });
      var at = step >= 0 ? G.pos[r[Math.min(step, r.length - 1)]] : null;
      if (at) { tok.setAttribute('cx', at[0]); tok.setAttribute('cy', at[1] - G.nh / 2 - 2); tok.classList.add('on'); } else tok.classList.remove('on');
    }
    function moveTok(a, b, ms, done) {
      var e = $('.vz-edge[data-e="' + a + '>' + b + '"]', svg);
      if (reduced() || !e || !e.getTotalLength || !window.requestAnimationFrame) { done(); return; }
      var L = e.getTotalLength(), t0 = null;
      function f(t) {
        if (t0 == null) t0 = t;
        var k = Math.min(1, (t - t0) / ms), pt = e.getPointAtLength(L * (1 - Math.pow(1 - k, 2)));
        tok.setAttribute('cx', pt.x); tok.setAttribute('cy', pt.y);
        if (k < 1) window.requestAnimationFrame(f); else done();
      }
      tok.classList.add('on');
      window.requestAnimationFrame(f);
    }
    function swarm(final) {
      var sw = C().swarm; swarmG.innerHTML = '';
      if (!sw) return;
      var counts = {}, ks = Object.keys(sw.to);
      ks.forEach(function (k) { counts[k] = 0; });
      // Interleave so the dots leave in a mixed stream, like a real queue.
      var mixed = [], pools = ks.map(function (k) { return { k: k, n: sw.to[k] }; });
      for (var j = 0; mixed.length < 100; j++) pools.forEach(function (p) { if (p.n > 0 && (j % Math.max(1, Math.round(100 / p.n / 2.5)) === 0 || j > 60)) { mixed.push(p.k); p.n--; } });
      function label(k) { var t = $('[data-s="' + k + '"]', svg); if (t) t.textContent = counts[k] + ' of 100'; }
      if (final || reduced() || !window.requestAnimationFrame) { ks.forEach(function (k) { counts[k] = sw.to[k]; label(k); }); status.textContent = 'All 100 items routed. ' + C().end; return; }
      var i = 0;
      ks.forEach(label);
      var iv = setInterval(function () {
        if (i >= mixed.length || C().swarm !== sw) { clearInterval(iv); return; }
        var k = mixed[i++], e = $('.vz-edge[data-e="' + sw.from + '>' + k + '"]', svg);
        if (!e) return;
        var dot = svgEl('circle', { r: 3.5, 'class': 'vz-dot' }, swarmG), L = e.getTotalLength();
        (function (dot, k) {
          var t0 = null;
          window.requestAnimationFrame(function f(t) {
            if (t0 == null) t0 = t;
            var q = Math.min(1, (t - t0) / 650), pt = e.getPointAtLength(L * q);
            dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
            if (q < 1) window.requestAnimationFrame(f); else { swarmG.removeChild(dot); counts[k]++; label(k); }
          });
        })(dot, k);
      }, 45);
    }
    function show(i) {
      var c = C(), r = c.route;
      step = Math.max(-1, Math.min(r.length - 1, i));
      paint();
      if (step < 0) { status.textContent = c.route.length + ' steps. Press Play or Next.'; detail.innerHTML = ''; return; }
      var k = r[step];
      status.textContent = 'Step ' + (step + 1) + ' of ' + r.length + ': ' + F.nodes[k].t + '.' + (step === r.length - 1 ? ' ' + c.end : '');
      detail.innerHTML = '<p class="vz-own-h">' + esc(F.nodes[k].t) + '</p><p>' + esc(say(k)) + ' <span class="md-cite">Book, ' + esc(cite(k)) + '</span></p>';
      if (step === r.length - 1 && c.swarm) swarm(false);
    }
    function stop() { if (timer) clearTimeout(timer); timer = null; playBtn.setAttribute('aria-pressed', 'false'); playBtn.textContent = 'Play'; }
    function advance() {
      var r = C().route;
      if (step >= r.length - 1) { stop(); return; }
      if (step < 0) { show(0); timer = setTimeout(advance, 1500); return; }
      var a = r[step], b = r[step + 1];
      moveTok(a, b, 700, function () { if (!timer) return; show(step + 1); timer = setTimeout(advance, step >= r.length - 1 ? 0 : 1900); });
    }
    function play() {
      if (timer) { stop(); return; }
      if (step >= C().route.length - 1) step = -1;
      playBtn.setAttribute('aria-pressed', 'true'); playBtn.textContent = 'Pause';
      timer = setTimeout(advance, 10);
    }
    function pick(i) {
      stop(); ci = i; step = -1;
      $$('.vz-case', root).forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.c === i)); });
      if (G.route) draw(); else { swarmG.innerHTML = ''; }
      listSteps(); show(-1);
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b && b.classList.contains('vz-case')) { pick(+b.dataset.c); play(); return; }
      if (b && b.dataset.a === 'play') return play();
      if (b && b.dataset.a === 'next') { stop(); if (step >= C().route.length - 1) step = -1; show(step + 1); return; }
      if (b && b.dataset.a === 'all') { stop(); show(C().route.length - 1); if (C().swarm) swarm(true); return; }
      var n = e.target.closest('.vz-fn');
      if (n) openNode(n.dataset.k);
    });
    function openNode(k) {
      stop();
      var i = C().route.indexOf(k);
      if (i >= 0) { show(i); return; }
      detail.innerHTML = '<p class="vz-own-h">' + esc(F.nodes[k].t) + '</p><p>' + esc(F.nodes[k].d) + ' <span class="md-cite">Book, ' + esc(F.nodes[k].c) + '</span></p><p class="vz-own-hint">Not on this case\u2019s path. Pick another case above.</p>';
    }
    host.addEventListener('keydown', function (e) {
      var n = e.target.closest('.vz-fn'); if (!n) return;
      var all = $$('.vz-fn', svg), i = all.indexOf(n);
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNode(n.dataset.k); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); all[(i + 1) % all.length].focus(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); all[(i - 1 + all.length) % all.length].focus(); }
    });
    draw(); listSteps();
    if (reduced()) { show(C().route.length - 1); if (C().swarm) swarm(true); }
    else { show(-1); onView(root, function () { root.classList.add('vz-in'); play(); }); }
    var rt = null;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (Math.abs(host.clientWidth - lastW) > 40 && (host.clientWidth < 560) !== narrow) { stop(); var s0 = step; draw(); show(s0); } }, 150); });
  }

  /* ================= Who may raise or lower a level (Table 25.2) ================= */
  function ladder(root) {
    var Lw = V.LADDER, sel = null, timer = null, at = 0;
    root.innerHTML = '<div class="vz-lad"><div class="vz-ctl" role="group" aria-label="Walk the ladder"><button type="button" class="btn btn-primary btn-sm" data-a="play" aria-pressed="false">Play: up the ladder, then down</button><p class="vz-status" aria-live="polite"></p></div>' +
      '<div class="vz-lad-wrap"><ul class="vz-lad-l" aria-label="Autonomy levels, highest first">' + Lw.levels.slice().reverse().map(function (l, ri) {
        var i = 5 - ri;
        return '<li class="vz-lv" data-l="' + i + '"><span class="vz-lv-k">' + l.l + '</span><span class="vz-lv-n">' + esc(l.n) + '<small>' + esc(l.who) + '</small></span></li>' + (i > 0 ? '<li class="vz-mv-row"><button type="button" class="vz-mv" data-m="' + (i - 1) + '" aria-pressed="false"><span aria-hidden="true">&uarr;</span> ' + Lw.levels[i - 1].l + ' to ' + l.l + ': <b>' + esc(Lw.up[i - 1].by) + '</b></button></li>' : '');
      }).join('') + '</ul>' +
      '<button type="button" class="vz-down" data-m="down" aria-pressed="false"><span aria-hidden="true">&darr;</span> Any level down: <b>' + esc(Lw.down.by) + '</b></button></div>' +
      '<div class="vz-own-detail" role="status" aria-live="polite"></div></div>';
    var det = $('.vz-own-detail', root), status = $('.vz-status', root), playBtn = $('[data-a="play"]', root);
    function mark(lv) { at = lv; $$('.vz-lv', root).forEach(function (li) { var l = +li.dataset.l; li.classList.toggle('on', l === lv); li.classList.toggle('below', l < lv); }); }
    function pick(m) {
      sel = m;
      $$('[data-m]', root).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === String(m))); });
      var u = m === 'down' ? Lw.down : Lw.up[+m];
      var head = m === 'down' ? 'Lowering a level' : Lw.levels[+m].l + ' to ' + Lw.levels[+m + 1].l;
      det.innerHTML = '<p class="vz-own-h">' + esc(head) + ': ' + esc(u.by) + '</p><p>' + esc(u.ev) + ' <span class="md-cite">Book, ' + esc(u.c) + '</span></p>';
    }
    function stop() { if (timer) clearInterval(timer); timer = null; playBtn.setAttribute('aria-pressed', 'false'); playBtn.textContent = 'Play: up the ladder, then down'; }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'play') {
        if (timer) return stop();
        var seq = [0, 1, 2, 3, 'down'], i = 0;
        playBtn.setAttribute('aria-pressed', 'true'); playBtn.textContent = 'Pause';
        mark(0); status.textContent = 'The step starts at L0.';
        timer = setInterval(function () {
          if (i >= seq.length) return stop();
          var m = seq[i++]; pick(m);
          if (m === 'down') { mark(2); status.textContent = 'An incident: one person drops it to L2 at once. No meeting.'; }
          else { mark(m + 1); status.textContent = Lw.levels[m].l + ' to ' + Lw.levels[m + 1].l + ': decided by ' + Lw.up[m].by + '.'; }
        }, reduced() ? 4000 : 2200);
        return;
      }
      if (b.dataset.m != null) { stop(); pick(b.dataset.m === 'down' ? 'down' : +b.dataset.m); if (b.dataset.m !== 'down') mark(+b.dataset.m + 1); }
    });
    mark(3); pick(2); status.textContent = 'Select a move to see the evidence and who decides.';
  }

  /* ================= Internal or external agent: the same five questions (Ch 23) ================= */
  function pair(root) {
    var Q = V.TRUST_Q;
    root.innerHTML = '<div class="vz-pair"><div class="vz-pair-q" role="group" aria-label="Pick a question">' + Q.map(function (q, i) {
      return '<button type="button" class="vz-case" data-q="' + i + '" aria-pressed="' + (i === 0) + '">' + esc(q.q) + '</button>';
    }).join('') + '</div>' +
      '<div class="vz-pair-row" aria-live="polite"><div class="vz-pair-card vz-pair-i"><p class="vz-pair-k">Your own agent</p><p class="vz-pair-a"></p></div>' +
      '<div class="vz-pair-mid" aria-hidden="true"><svg viewBox="0 0 60 40" focusable="false"><path class="vz-pair-line" d="M2 20 H58"></path><circle class="vz-pair-dot" cx="30" cy="20" r="6"></circle></svg><span>Your gateway</span></div>' +
      '<div class="vz-pair-card vz-pair-e"><p class="vz-pair-k">An outside agent</p><p class="vz-pair-a"></p></div></div>' +
      '<p class="vz-pair-cite"></p></div>';
    function pick(i) {
      $$('[data-q]', root).forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.q === i)); });
      var row = $('.vz-pair-row', root);
      row.classList.remove('flip'); void row.getBoundingClientRect(); row.classList.add('flip');
      $('.vz-pair-i .vz-pair-a', root).textContent = Q[i].i;
      $('.vz-pair-e .vz-pair-a', root).textContent = Q[i].e;
      $('.vz-pair-cite', root).innerHTML = '<span class="md-cite">Book, ' + esc(Q[i].c) + '</span>';
    }
    root.addEventListener('click', function (e) { var b = e.target.closest('[data-q]'); if (b) pick(+b.dataset.q); });
    pick(0);
  }

  /* ================= The book's 31 chapters by part, linked to the site ================= */
  function chapters(root) {
    var P = V.PARTS, all = [];
    P.forEach(function (p, pi) { p.ch.forEach(function (c) { all.push({ n: c[0], t: c[1], d: c[2], href: c[3], link: c[4], p: p.p, pn: p.n, pi: pi }); }); });
    root.innerHTML = '<div class="vz-chap"><div class="vz-ctl" role="group" aria-label="Filter chapters"><button type="button" class="vz-case" data-f="all" aria-pressed="true">All 31 chapters</button><button type="button" class="vz-case" data-f="site" aria-pressed="false">Chapters you can try on this site</button></div>' +
      '<div class="vz-chap-parts">' + P.map(function (p, pi) {
        return '<section class="vz-part vz-part-' + pi + '" aria-label="' + esc(p.p + ': ' + p.n) + '"><h3 class="vz-part-h">' + esc(p.p) + ' <span>' + esc(p.n) + '</span></h3><ul class="vz-chips">' +
          p.ch.map(function (c) { return '<li><button type="button" class="vz-chip' + (c[3] ? ' has' : '') + '" data-n="' + c[0] + '" aria-pressed="false"><b>' + (c[0] < 10 ? '0' : '') + c[0] + '</b> ' + esc(c[1].split(':')[0]) + '</button></li>'; }).join('') + '</ul></section>';
      }).join('') + '</div><div class="vz-own-detail" role="status" aria-live="polite"></div></div>';
    var det = $('.vz-own-detail', root), btns = $$('.vz-chip', root);
    function pick(n, focus) {
      var c = all.filter(function (x) { return x.n === n; })[0];
      btns.forEach(function (b) { var on = +b.dataset.n === n; b.setAttribute('aria-pressed', String(on)); if (on && focus) b.focus(); });
      det.innerHTML = '<p class="vz-own-h">Chapter ' + c.n + ': ' + esc(c.t) + '</p><p>' + esc(c.d) + ' <span class="md-cite">' + esc(c.p + ', ' + c.pn) + '</span></p>' +
        (c.href ? '<p><a class="more" href="' + c.href + '">Try it on this site: ' + esc(c.link) + '</a></p>' : '<p class="vz-own-hint">In the book only, for now.</p>');
    }
    root.addEventListener('click', function (e) {
      var f = e.target.closest('[data-f]');
      if (f) {
        $$('[data-f]', root).forEach(function (b) { b.setAttribute('aria-pressed', String(b === f)); });
        root.classList.toggle('vz-only-site', f.dataset.f === 'site'); return;
      }
      var b = e.target.closest('.vz-chip'); if (b) pick(+b.dataset.n);
    });
    root.addEventListener('keydown', function (e) {
      var b = e.target.closest('.vz-chip'); if (!b) return;
      var vis = btns.filter(function (x) { return !root.classList.contains('vz-only-site') || x.classList.contains('has'); }), i = vis.indexOf(b);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); pick(+vis[(i + 1) % vis.length].dataset.n, true); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); pick(+vis[(i - 1 + vis.length) % vis.length].dataset.n, true); }
    });
    pick(30);
    onView(root, function () { root.classList.add('vz-in'); });
  }

  /* ================= The 30-month roadmap with gates (Ch 26.3) ================= */
  var PHASES = [
    { n: '0 Mobilize', m: [1, 3], g: 'G0', what: 'Charter, team, baselines, architecture decisions, first shadow agents.' },
    { n: '1 Foundation and pilots', m: [4, 13], g: 'G1', what: 'Platforms, data, governance plane, first interface wave, first agents to L2.' },
    { n: '2 First go-live', m: [14, 19], g: 'G2', what: 'First region live; hypercare; first core agents in shadow.' },
    { n: '3 Scale', m: [20, 30], g: 'G3', what: 'Remaining waves; promotion and replication; decommission.' },
    { n: '4 Run', m: [31, 33], g: 'G4', what: 'Handover to the line organization and agent operations.' }
  ];
  var GATES = [
    { g: 'G0', m: 3, d: 'Commit to the 30-month plan', ev: 'Baselines signed; architecture chosen; governance plane design approved; three shadow agents running.', val: 'High-value use cases named, each with an outcome, an owner and a signed baseline.', risk: 'Do-not-automate list approved.' },
    { g: 'G1', m: 13, d: 'Release the first cutover wave', ev: 'Three dress rehearsals passed; governance plane live on all platforms; first agents at L2 with a clean audit walkthrough.', val: 'Agent success rate on high-value use cases against baseline.', risk: 'Overrides falling while post-approval errors hold.' },
    { g: 'G2', m: 19, d: 'Close phase 2; release wave 2', ev: 'First region stable for 3 months; first close on the new core within plan; exception agent through shadow; first benefits measured.', val: 'First benefits measured; reinvested hours.', risk: 'Autonomous completion read with its error rate; no rubber-stamp signal.' },
    { g: 'G3', m: 30, d: 'Declare scale complete', ev: 'All waves live; legacy cores decommissioned; 110 agents registered.', val: 'About 25% of decisions above L2.', risk: 'Demotions and severe incidents falling.' },
    { g: 'G4', m: 33, d: 'Hand over', ev: 'Runbooks owned by the line; benefits reconciled; program office closed.', val: 'Benefits reconciled to the ledger; role cards in force.', risk: 'The line passes both checks without program staff.' }
  ];
  function roadmap(root) {
    var timer = null;
    root.innerHTML =
      '<div class="vz-rm">' +
        '<div class="vz-ctl" role="group" aria-label="Walk the gates"><button type="button" class="btn btn-primary btn-sm" data-a="play" aria-pressed="false">Play the 33 months</button><p class="vz-status" aria-live="polite"></p></div>' +
        '<ol class="vz-rm-track">' + PHASES.map(function (p, i) {
          return '<li class="vz-ph vz-ph-' + i + '"><b>' + esc(p.n) + '</b><span>Months ' + p.m[0] + '&ndash;' + p.m[1] + '</span></li>';
        }).join('') + '</ol>' +
        '<div class="vz-rm-cursor" aria-hidden="true"><svg viewBox="0 0 330 12" preserveAspectRatio="none" focusable="false"><rect class="vz-rm-bg" x="0" y="4" width="330" height="4"></rect><rect class="vz-rm-fill" x="0" y="4" width="0" height="4"></rect>' +
          GATES.map(function (g) { return '<rect class="vz-rm-tick" x="' + (g.m * 10 - 1.5) + '" y="0" width="3" height="12"></rect>'; }).join('') + '</svg></div>' +
        '<div class="vz-rm-gates" role="group" aria-label="Gates">' + GATES.map(function (g, i) {
          return '<button type="button" class="vz-gate" data-i="' + i + '" aria-pressed="false"><b>' + g.g + '</b> Month ' + g.m + '</button>';
        }).join('') + '</div>' +
        '<div class="vz-rm-detail"></div>' +
      '</div>';
    var fill = $('.vz-rm-fill', root), det = $('.vz-rm-detail', root), status = $('.vz-status', root), play = $('[data-a="play"]', root);
    function gate(i) {
      var g = GATES[i], ph = PHASES[i];
      tween(fill, 'width', g.m * 10, 900);
      $$('.vz-gate', root).forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.i === i)); });
      $$('.vz-ph', root).forEach(function (li, j) { li.classList.toggle('on', j === i); li.classList.toggle('past', j < i); });
      det.innerHTML = '<p class="vz-rm-h">' + g.g + ' &middot; month ' + g.m + ': ' + esc(g.d) + '</p>' +
        '<p><b>Phase ' + esc(ph.n) + '.</b> ' + esc(ph.what) + '</p>' +
        '<dl class="vz-rm-dl"><dt>Minimum evidence</dt><dd>' + esc(g.ev) + '</dd><dt>Value signal</dt><dd>' + esc(g.val) + '</dd><dt>Risk counterweight</dt><dd>' + esc(g.risk) + '</dd></dl>' +
        '<p class="fw-note">The gate passes on a scorecard reading, not on delivery alone. Illustrative Meridian figures. <span class="md-cite">Book, Ch 26.3</span></p>';
      status.textContent = 'Gate ' + g.g + ', month ' + g.m + ': ' + g.d + '.';
    }
    function stop() { if (timer) clearInterval(timer); timer = null; play.setAttribute('aria-pressed', 'false'); play.textContent = 'Play the 33 months'; }
    play.addEventListener('click', function () {
      if (timer) return stop();
      var i = 0; gate(0); play.setAttribute('aria-pressed', 'true'); play.textContent = 'Pause';
      timer = setInterval(function () { i++; if (i >= GATES.length) return stop(); gate(i); }, reduced() ? 5000 : 3000);
    });
    root.addEventListener('click', function (e) { var b = e.target.closest('.vz-gate'); if (b) { stop(); gate(+b.dataset.i); } });
    gate(reduced() ? GATES.length - 1 : 0);
  }

  /* ================= Wire up ================= */
  function init() {
    $$('[data-vz]').forEach(function (el) {
      var t = el.getAttribute('data-vz'), wrap = el.closest('[hidden]');
      if (wrap && wrap.classList.contains('vz-wrap')) wrap.hidden = false;
      if (t === 'story') story(el);
      else if (t === 'clerk') clerk(el);
      else if (t === 'owners') owners(el);
      else if (t === 'roadmap') roadmap(el);
      else if (t === 'decisions') decisions(el);
      else if (t === 'ladder') ladder(el);
      else if (t === 'pair') pair(el);
      else if (t === 'chapters') chapters(el);
      else if (t.indexOf('flow:') === 0) { if (V.FLOWS[t.slice(5)]) flow(el, V.FLOWS[t.slice(5)]); }
      else if (t.indexOf('calc:') === 0) {
        var spec = V.specs[t.slice(5)];
        if (!spec) return;
        var o = {};
        if (spec.id === 'order') o.names = ['2026', 'Month 30'];
        if (spec.id === 'incident') o.names = ['By audit', 'By the loop'];
        if (spec.id === 'touch') {
          o.names = ['Your process', 'Agent-run'];
          var last = AE.simCounts || null;
          o.counts = function () { return AE.simCounts || last || { a: { touches: 0, exPeople: 0, handoffs: 0 }, b: { touches: 0, exPeople: 0, handoffs: 0 } }; };
          o.after = function () {
            var c = AE.simCounts, p = $('.vz-priv', el);
            if (p) p.textContent = (c && c.name ? 'Compared with the book\u2019s agent-run flow for ' + c.name + '. ' : '') + 'Computed in your browser. Nothing is stored or sent.';
          };
          var api = calc(el, spec, o);
          document.addEventListener('ae:sim-counts', function () { api.update(); });
          return;
        }
        calc(el, spec, o);
      }
    });
  }
  AE.vzUi = { pic: pic, PHASES: PHASES, GATES: GATES, OWNERS: OWNERS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
