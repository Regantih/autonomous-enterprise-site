/* /blueprints/team/: filter the agent cards by department, autonomy level and search, and open an agent's full entry
   in a panel. Counts come from the rendered cards, which come from data/team.js. Without JS the cards link to the entries. */
(function () {
  'use strict';
  var root = document.querySelector('[data-tm-bands]');
  if (!root) return;
  var bar = document.querySelector('[data-tm-filters]');
  var q = document.querySelector('[data-tm-q]');
  var dept = document.querySelector('[data-tm-dept]');
  var level = document.querySelector('[data-tm-level]');
  var status = document.querySelector('[data-tm-status]');
  var empty = document.querySelector('[data-tm-empty]');
  var bands = Array.prototype.slice.call(document.querySelectorAll('[data-tm-band]'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-tm-card]'));
  var dialog = document.querySelector('[data-tm-dialog]');
  var dTitle = document.querySelector('[data-tm-dialog-title]');
  var dBody = document.querySelector('[data-tm-dialog-body]');
  var opener = null;

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function has(list, v) { return (' ' + list + ' ').indexOf(' ' + v + ' ') >= 0; }

  function apply() {
    var text = (q.value || '').trim().toLowerCase();
    var words = text ? text.split(/\s+/) : [];
    var d = dept.value;
    var l = level.value;
    var agents = 0;
    var roles = 0;
    bands.forEach(function (band) {
      var id = band.getAttribute('data-tm-band');
      var shown = 0;
      var total = 0;
      Array.prototype.slice.call(band.querySelectorAll('[data-tm-card]')).forEach(function (c) {
        total++;
        var isRole = c.getAttribute('data-kind') === 'role';
        var ok = (!d || d === id) &&
          (l === '' || (!isRole && has(c.getAttribute('data-levels'), l))) &&
          words.every(function (w) { return c.getAttribute('data-search').indexOf(w) >= 0; });
        c.hidden = !ok;
        var tag = c.querySelector('[data-tm-tasks]');
        if (tag) {
          var tl = c.getAttribute('data-task-levels').split(' ');
          var all = tl.length;
          if (l === '') tag.textContent = plural(all, 'task', 'tasks');
          else {
            var m = tl.filter(function (x) { return x.split(',').indexOf(l) >= 0; }).length;
            tag.textContent = m + ' of ' + all + ' tasks at L' + l;
          }
        }
        if (ok) { shown++; if (isRole) roles++; else agents++; }
      });
      band.hidden = shown === 0;
      var count = band.querySelector('[data-tm-band-count]');
      if (count) {
        if (!count.hasAttribute('data-full')) count.setAttribute('data-full', count.textContent);
        count.textContent = shown === total ? count.getAttribute('data-full') : shown + ' of ' + total + ' shown';
      }
    });
    var filtered = text || d || l !== '';
    status.textContent = (filtered ? 'Showing ' : 'Showing all ') + plural(agents, 'agent', 'agents') + (roles || !filtered ? ' and ' + plural(roles, 'human role', 'human roles') : '') +
      (l !== '' ? ' with a task at L' + l : '') + (d ? ' in ' + dept.options[dept.selectedIndex].text.split(' · ')[0] : '') + (text ? ' matching “' + q.value.trim() + '”' : '') + '.';
    empty.hidden = agents + roles > 0;
  }

  function reset() {
    q.value = '';
    dept.value = '';
    level.value = '';
    apply();
    q.focus();
  }

  function open(id, from) {
    var entry = document.getElementById('a-' + id);
    if (!entry || !dialog || typeof dialog.showModal !== 'function') return false;
    var body = entry.querySelector('[data-tm-body]');
    dTitle.textContent = entry.querySelector('.tm-entry-name').textContent;
    dBody.innerHTML = '';
    dBody.appendChild(body.cloneNode(true));
    var l = level.value;
    if (l !== '') {
      Array.prototype.slice.call(dBody.querySelectorAll('[data-tm-task]')).forEach(function (t) {
        if (has(t.getAttribute('data-levels'), l)) t.classList.add('is-match');
      });
    }
    opener = from || null;
    dialog.showModal();
    dBody.scrollTop = 0;
    return true;
  }

  // Cards open the panel; with no dialog support they fall back to the anchor and its open entry.
  root.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-tm-open]') : null;
    if (!a) return;
    if (open(a.getAttribute('data-tm-open'), a)) e.preventDefault();
  });
  if (dialog) {
    document.querySelector('[data-tm-close]').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', function () { if (opener && opener.focus) opener.focus(); opener = null; });
  }

  // A link to #a-<id> opens that entry in the directory.
  function openHash() {
    var h = location.hash.slice(1);
    if (h.indexOf('a-') !== 0) return;
    var el = document.getElementById(h);
    if (el && el.tagName === 'DETAILS') el.open = true;
  }
  window.addEventListener('hashchange', openHash);
  openHash();

  [q, dept, level].forEach(function (el) { el.addEventListener('input', apply); el.addEventListener('change', apply); });
  Array.prototype.slice.call(document.querySelectorAll('[data-tm-reset]')).forEach(function (b) { b.addEventListener('click', reset); });
  bar.hidden = false;
  apply();
})();
