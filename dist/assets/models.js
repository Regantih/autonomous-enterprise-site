/* /blueprints/models/: filter the model matrix by layer. The buttons and counts are computed from the table rows. */
(function () {
  'use strict';
  var bar = document.querySelector('[data-md-filter]');
  var table = document.querySelector('.md-matrix');
  if (!bar || !table) return;
  var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr[data-layer]'));
  var count = document.querySelector('[data-md-count]');
  var layers = [];
  rows.forEach(function (r) { var l = r.getAttribute('data-layer'); if (layers.indexOf(l) < 0) layers.push(l); });
  layers.sort();
  function n(l) { return rows.filter(function (r) { return !l || r.getAttribute('data-layer') === l; }).length; }
  var buttons = [];
  function add(label, layer) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill';
    b.textContent = label + ' ';
    var c = document.createElement('span');
    c.textContent = String(n(layer));
    b.appendChild(c);
    b.setAttribute('aria-pressed', layer ? 'false' : 'true');
    b.addEventListener('click', function () { show(layer, b); });
    bar.appendChild(b);
    buttons.push(b);
  }
  function show(layer, btn) {
    var shown = 0;
    rows.forEach(function (r) { var on = !layer || r.getAttribute('data-layer') === layer; r.hidden = !on; if (on) shown++; });
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    if (count) count.textContent = 'Showing ' + shown + ' of ' + rows.length + ' families' + (layer ? ' in ' + layer + '.' : '.');
  }
  add('All layers', '');
  layers.forEach(function (l) { add(l, l); });
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Filter the matrix by layer');
  bar.hidden = false;
})();
