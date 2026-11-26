(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var MESSAGES = {
    valueMissing: function (label) { return label + ' is required.'; },
    typeMismatch: function () { return 'Please enter a valid email address.'; },
    tooShort: function (label, el) { return label + ' must be at least ' + el.minLength + ' characters.'; },
    tooLong: function (label, el) { return label + ' must be ' + el.maxLength + ' characters or fewer.'; },
    badInput: function () { return 'Please enter a valid date.'; }
  };

  function labelFor(form, el) {
    var fs = el.closest('fieldset');
    var lab = fs ? fs.querySelector('legend') : form.querySelector('label[for="' + el.id + '"]');
    var text = lab ? lab.firstChild.textContent : el.name;
    return text.replace(/\s+$/, '');
  }

  function errorSlot(form, name) {
    var el = form.querySelector('[name="' + name + '"]');
    if (!el) return null;
    var field = el.closest('.field');
    return field ? { field: field, input: el, slot: field.querySelector('.field-error') } : null;
  }

  function clearErrors(form) {
    form.querySelectorAll('.field-error').forEach(function (s) { s.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    var status = form.querySelector('.form-status');
    status.textContent = '';
    status.className = 'form-status';
  }

  function showErrors(form, errors) {
    var first = null;
    Object.keys(errors).forEach(function (name) {
      var t = errorSlot(form, name);
      if (!t || !t.slot) return;
      t.slot.textContent = errors[name];
      t.field.querySelectorAll('input, select, textarea').forEach(function (el) { el.setAttribute('aria-invalid', 'true'); });
      if (!first) first = t.input;
    });
    var count = Object.keys(errors).length;
    showStatus(form, count === 1 ? 'Please fix the highlighted field.' : 'Please fix the ' + count + ' highlighted fields.');
    if (first) first.focus();
  }

  function showStatus(form, text) {
    var status = form.querySelector('.form-status');
    status.textContent = text;
    status.className = 'form-status error';
  }

  function clientValidate(form) {
    var errors = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'hidden' || el.name === 'website' || errors[el.name]) return;
      if (typeof el.value === 'string' && el.type !== 'radio' && el.type !== 'checkbox' && el.value.trim() === '' && el.required) {
        errors[el.name] = MESSAGES.valueMissing(labelFor(form, el));
        return;
      }
      if (el.validity && !el.validity.valid) {
        var v = el.validity;
        var key = v.valueMissing ? 'valueMissing' : v.typeMismatch ? 'typeMismatch' : v.tooShort ? 'tooShort' : v.tooLong ? 'tooLong' : 'badInput';
        errors[el.name] = el.type === 'radio' ? 'Please choose one option.' : MESSAGES[key](labelFor(form, el), el);
      }
    });
    if (form.querySelector('input[name="goals"]') && !form.querySelector('input[name="goals"]:checked')) {
      errors.goals = 'Please choose at least one goal.';
    }
    return errors;
  }

  function collect(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      if (typeof value !== 'string') return;
      if (key === 'goals') (data.goals = data.goals || []).push(value);
      else data[key] = value;
    });
    return data;
  }

  function showSuccess(form) {
    var box = document.createElement('div');
    box.className = 'form-success';
    var h = document.createElement('h3');
    h.tabIndex = -1;
    h.textContent = form.getAttribute('data-success-title') || 'Thank you.';
    var p = document.createElement('p');
    p.textContent = form.getAttribute('data-success-body') || '';
    box.appendChild(h);
    box.appendChild(p);
    box.setAttribute('role', 'status');
    form.replaceWith(box);
    h.focus({ preventScroll: true });
    box.scrollIntoView({ block: 'center' });
  }

  document.querySelectorAll('form.request-form').forEach(function (form) {
    form.noValidate = true;
    var button = form.querySelector('button[type="submit"]');
    var idle = button.textContent;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (button.disabled) return;
      clearErrors(form);
      var errors = clientValidate(form);
      if (Object.keys(errors).length) { showErrors(form, errors); return; }

      button.disabled = true;
      button.textContent = 'Sending\u2026';
      form.setAttribute('aria-busy', 'true');

      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(collect(form)),
        credentials: 'same-origin'
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) { return { res: res, body: body }; });
        })
        .then(function (r) {
          if (r.res.ok && r.body.ok) { showSuccess(form); return; }
          if (r.body.errors) { showErrors(form, r.body.errors); return; }
          showStatus(form, r.body.error || 'Something went wrong. Please try again later.');
          form.querySelector('.form-status').focus();
        })
        .catch(function () {
          showStatus(form, 'We could not send your request. Check your connection and try again.');
          form.querySelector('.form-status').focus();
        })
        .then(function () {
          if (!form.isConnected) return;
          button.disabled = false;
          button.textContent = idle;
          form.removeAttribute('aria-busy');
        });
    });
  });
  // Contact tabs (ARIA tabs pattern; without JS the panels stay stacked with anchor links).
  document.querySelectorAll('[data-tabs]').forEach(function (root) {
    var list = root.querySelector('.tablist');
    var tabs = Array.prototype.slice.call(root.querySelectorAll('.tab'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    list.setAttribute('role', 'tablist');
    panels.forEach(function (p) { p.setAttribute('role', 'tabpanel'); p.tabIndex = -1; });
    function select(i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute('role', 'tab');
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }
    function fromHash() {
      var h = location.hash.slice(1);
      if (!h) return 0;
      for (var i = 0; i < panels.length; i++) {
        if (panels[i].id === h || panels[i].querySelector('[id="' + h + '"]')) return i;
      }
      return -1;
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        select(i, false);
        history.replaceState(null, '', '#' + panels[i].id);
      });
      t.addEventListener('keydown', function (e) {
        var n = tabs.length, k = e.key, j = null;
        if (k === 'ArrowRight') j = (i + 1) % n;
        else if (k === 'ArrowLeft') j = (i - 1 + n) % n;
        else if (k === 'Home') j = 0;
        else if (k === 'End') j = n - 1;
        if (j === null) return;
        e.preventDefault();
        select(j, true);
        history.replaceState(null, '', '#' + panels[j].id);
      });
    });
    var start = fromHash();
    select(start < 0 ? 0 : start, false);
    if (location.hash && start >= 0) list.scrollIntoView();
    window.addEventListener('hashchange', function () { var i = fromHash(); if (i >= 0) select(i, false); });
  });

  // Copy-to-clipboard for bios.
  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-copy'));
      var text = target.textContent.trim();
      function done(ok) {
        btn.textContent = ok ? 'Copied' : 'Select and copy';
        setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        var r = document.createRange(); r.selectNodeContents(target);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        done(false);
      }
    });
  });
})();

/* Small screens: sideways-scroll hints on wide tables and diagrams, and the "Talk to the book"
   button steps aside while the reader scrolls down. Classes only, so the CSP needs no inline style. */
(function () {
  'use strict';
  var HINTED = '.fw-table-wrap, .sl-wrap, .ar-svg-wrap, .ld-tablewrap';
  var MASKED = HINTED + ', .site-nav';
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  var queued = false;

  function hintFor(w) {
    var prev = w.previousElementSibling;
    if (prev && prev.classList.contains('x-hint')) return prev;
    if (!w.matches(HINTED) || !w.parentNode) return null;
    var h = document.createElement('p');
    h.className = 'x-hint';
    h.setAttribute('aria-hidden', 'true');
    h.textContent = (coarse ? 'Swipe' : 'Scroll') + ' sideways to see more';
    h.hidden = true;
    w.parentNode.insertBefore(h, w);
    return h;
  }

  function edges(w) {
    var max = w.scrollWidth - w.clientWidth;
    w.classList.toggle('x-more', max > 2 && w.scrollLeft < max - 2);
    w.classList.toggle('x-less', max > 2 && w.scrollLeft > 2);
  }

  function update() {
    queued = false;
    document.querySelectorAll(MASKED).forEach(function (w) {
      if (seen && !seen.has(w)) { seen.add(w); w.addEventListener('scroll', function () { edges(w); }, { passive: true }); }
      var wide = w.clientWidth > 0 && w.scrollWidth > w.clientWidth + 2;
      w.classList.toggle('x-scroll', wide);
      edges(w);
      if (wide || (w.previousElementSibling && w.previousElementSibling.classList.contains('x-hint'))) {
        var h = hintFor(w);
        if (h && h.hidden === wide) h.hidden = !wide;
      }
    });
  }
  function queue() { if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(update); } }

  if (seen) {
    queue();
    window.addEventListener('resize', queue, { passive: true });
    window.addEventListener('load', queue);
    if (window.MutationObserver) new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  }

  var fab = document.querySelector('.guide-fab');
  var small = window.matchMedia && window.matchMedia('(max-width: 59.99rem)');
  if (fab && small) {
    var lastY = window.pageYOffset || 0;
    /* Wider screens: the button also steps aside while it would sit on top of a wide table or diagram. */
    var covers = function () {
      var vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var fw = fab.offsetWidth, fh = fab.offsetHeight, gap = 24;
      var left = vw - fw - gap, top = vh - fh - gap;
      var ws = document.querySelectorAll(HINTED);
      for (var i = 0; i < ws.length; i++) {
        var r = ws[i].getBoundingClientRect();
        if (r.width && r.right > left && r.bottom > top && r.top < vh) return true;
      }
      return false;
    };
    var goingDown = false;
    var place = function () {
      var y = window.pageYOffset || 0, d = y - lastY;
      if (Math.abs(d) >= 8) { goingDown = d > 0; lastY = y; }
      var over = !small.matches && covers();
      var away = !fab.contains(document.activeElement) && (over || (small.matches && goingDown && y > 240));
      fab.classList.toggle('fab-away', away);
    };
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place, { passive: true });
    window.addEventListener('load', place);
  }
})();
