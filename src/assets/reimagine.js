/* Reimagine your operations: reads the inputs, runs the rule engine in reimagine-core.js and renders the result.
   Everything stays in this browser tab: no network calls, no storage, no model calls. */
(function () {
  'use strict';
  var R = window.AE && window.AE.reimagine;
  var root = document.querySelector('[data-rm]');
  if (!R || !root) return;
  var inputs = root.querySelector('#rm-inputs');
  var results = root.querySelector('#rm-results');
  var strip = root.querySelector('#rm-strip');
  var talk = root.querySelector('[data-rm-talk]');
  var timer = null;

  function checked(name) {
    return Array.prototype.map.call(inputs.querySelectorAll('input[name="' + name + '"]:checked'), function (n) { return n.value; });
  }
  function radio(name) { var n = inputs.querySelector('input[name="' + name + '"]:checked'); return n ? n.value : ''; }
  function val(id) { var n = inputs.querySelector('#' + id); return n ? n.value : ''; }
  function yn(prefix, list) { var o = {}; list.forEach(function (q) { o[q[0]] = radio(prefix + q[0]) === 'yes'; }); return o; }

  function read() {
    var ready = {};
    R.LAYERS.forEach(function (L) { ready[L.id] = checked('ready-' + L.id); });
    return {
      industry: val('rm-industry'), revenue: val('rm-revenue'), interfaces: val('rm-interfaces'),
      cores: { legacyErp: val('rm-legacyErp'), mainframe: val('rm-mainframe'), cloud: val('rm-cloud'), homegrown: val('rm-homegrown') },
      streams: checked('streams'), ot: radio('ot') === 'yes', ready: ready, outcomes: checked('outcomes'), appetite: radio('appetite'),
      erpQ: yn('erp-', R.CORE_Q), hgQ: yn('hg-', R.CORE_Q), mfQ: yn('mf-', R.MF_Q)
    };
  }

  function sync(i) {
    // Show each core's questions only when that core is counted.
    Array.prototype.forEach.call(inputs.querySelectorAll('[data-core]'), function (fs) { fs.hidden = !i.cores[fs.getAttribute('data-core')]; });
    // At most three outcomes: the rest are disabled until one is unticked.
    var full = i.outcomes.length >= 3;
    Array.prototype.forEach.call(inputs.querySelectorAll('input[name="outcomes"]'), function (n) { n.disabled = full && !n.checked; });
  }

  function update(announce) {
    var raw = read();
    var r = R.compute(raw);
    sync(r.input);
    results.innerHTML = R.renderResults(r);
    if (talk) talk.setAttribute('href', '/talk/?q=' + encodeURIComponent(R.summary(r)));
    clearTimeout(timer);
    var line = R.strip(r);
    var say = function () { if (strip.textContent !== line) strip.textContent = line; };
    if (announce) timer = setTimeout(say, 350); else say();
  }

  inputs.addEventListener('change', function () { update(true); });
  inputs.addEventListener('input', function (e) { if (e.target && e.target.type === 'number') update(true); });

  var load = root.querySelector('[data-rm-load]');
  if (load) {
    load.hidden = false;
    load.addEventListener('click', function () {
      inputs.innerHTML = R.renderInputs(R.MERIDIAN);
      update(true);
      var first = inputs.querySelector('select, input');
      if (first) first.focus();
    });
  }
  var print = root.querySelector('[data-rm-print]');
  if (print) {
    print.hidden = false;
    print.addEventListener('click', function () { window.print(); });
  }
  update(false);
})();
