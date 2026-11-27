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
  function owners(root) {
    root.innerHTML = '<div class="vz-own"><div class="vz-own-svg"></div><div class="vz-own-detail" role="status" aria-live="polite"></div></div>';
    var host = $('.vz-own-svg', root), detail = $('.vz-own-detail', root), sel = null, lastW = 0;
    function select(i, focus) {
      sel = i;
      $$('.vz-node', host).forEach(function (n) { var on = +n.dataset.i === i; n.setAttribute('aria-pressed', String(on)); n.classList.toggle('on', on); if (on && focus) n.focus(); });
      $$('.vz-link', host).forEach(function (l) { l.classList.toggle('on', +l.dataset.i === i); });
      if (i < 0) {
        detail.innerHTML = '<p class="vz-own-h">Every agent</p><p>Every agent has a named business owner. The owner signs its limits and promotions and can stop it. No registry, no run. <span class="md-cite">Book, Ch 24.3</span></p><p class="vz-own-hint">Select a role to see what it owns.</p>';
        return;
      }
      var o = OWNERS[i];
      detail.innerHTML = '<p class="vz-own-h">' + esc(o.role) + '</p><p>' + esc(o.text) + ' <span class="md-cite">Book, Ch 01.8</span></p><p><a class="more" href="' + o.href + '">' + esc(o.link) + '</a></p>';
    }
    function draw() {
      var narrow = host.clientWidth < 560;
      lastW = host.clientWidth;
      host.innerHTML = '';
      var W = narrow ? 340 : 700, H = narrow ? 470 : 340, cx = W / 2, cy = narrow ? 70 : H / 2;
      var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'vz-own-map', role: 'group', 'aria-label': 'Who owns what in the agent estate' }, host);
      var pos = OWNERS.map(function (o, i) {
        if (narrow) return [i % 2 ? W * 0.75 : W * 0.25, 170 + Math.floor(i / 2) * 105];
        var ang = -Math.PI / 2 + (i - 0.0) * (2 * Math.PI / OWNERS.length) + Math.PI / 6;
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
      node(-1, cx, cy, narrow ? 200 : 190, 64, 'Every agent', 'A named business owner');
      OWNERS.forEach(function (o, i) { node(i, pos[i][0], pos[i][1], narrow ? 156 : 196, 60, o.role.length > 18 ? (o.id === 'cro' ? 'CRO and audit' : 'Chief data officer') : o.role, o.owns); });
      select(sel == null ? -1 : sel);
    }
    host.addEventListener('click', function (e) { var n = e.target.closest('.vz-node'); if (n) select(+n.dataset.i); });
    host.addEventListener('keydown', function (e) {
      var n = e.target.closest('.vz-node'); if (!n) return;
      var i = +n.dataset.i, all = OWNERS.length;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select(i < 0 ? 0 : (i + 1) % all, true); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select(i <= 0 ? all - 1 : i - 1, true); }
    });
    draw();
    onView(root, function () { root.classList.add('vz-in'); });
    var rt = null;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (Math.abs(host.clientWidth - lastW) > 40) draw(); }, 150); });
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
      else if (t.indexOf('calc:') === 0) {
        var spec = V.specs[t.slice(5)];
        if (!spec) return;
        var o = {};
        if (spec.id === 'order') o.names = ['2026', 'Month 30'];
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
