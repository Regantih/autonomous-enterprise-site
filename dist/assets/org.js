/* /blueprints/organization/: filter the capability matrix by who does the work. Buttons and counts are computed from the table rows. */
(function () {
  'use strict';
  var bar = document.querySelector('[data-cap-filter]');
  var table = document.querySelector('.cap-matrix');
  if (!bar || !table) return;
  var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr[data-who]'));
  var count = document.querySelector('[data-cap-count]');
  var groups = [];
  rows.forEach(function (r) { var w = r.getAttribute('data-who'); if (groups.indexOf(w) < 0) groups.push(w); });
  function n(w) { return rows.filter(function (r) { return !w || r.getAttribute('data-who') === w; }).length; }
  var buttons = [];
  function show(who, btn) {
    var shown = 0;
    rows.forEach(function (r) { var on = !who || r.getAttribute('data-who') === who; r.hidden = !on; if (on) shown++; });
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    if (count) count.textContent = 'Showing ' + shown + ' of ' + rows.length + ' tasks' + (who ? ': ' + who + '.' : '.');
  }
  function add(label, who) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill';
    b.textContent = label + ' ';
    var c = document.createElement('span');
    c.textContent = String(n(who));
    b.appendChild(c);
    b.setAttribute('aria-pressed', who ? 'false' : 'true');
    b.addEventListener('click', function () { show(who, b); });
    bar.appendChild(b);
    buttons.push(b);
  }
  add('Everyone', '');
  groups.forEach(function (w) { add(w, w); });
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Filter the matrix by who does the work');
  bar.hidden = false;
})();
