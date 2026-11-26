/* The conversational intake agent on /contact/, /speaking/ and /advisory/. It replaced the request forms.
   A real model call asks one short question at a time and fills a request card. The visitor can edit any field
   inline. Code checks the card; nothing is sent until the visitor ticks consent and presses Send.
   Talks only to this site's own POST /api/intake. Keeps nothing in storage. */
(function () {
  'use strict';
  var root = document.querySelector('[data-intake]');
  if (!root || !window.fetch) return;
  var API = '/api/intake';
  var PRICE_IN = 0.293, PRICE_OUT = 2.253;
  var MAX = 400;
  var INTENTS = [
    { id: 'talk', label: 'A talk', hash: 'speaking' },
    { id: 'advisory', label: 'Advisory', hash: 'advisory' },
    { id: 'media', label: 'Media or a podcast', hash: 'media' }
  ];
  var OPT = {
    'in-person': 'In person', virtual: 'Virtual', keynote: 'Keynote', panel: 'Panel', 'fireside-chat': 'Fireside chat', workshop: 'Workshop',
    'under-50': 'Under 50', '50-200': '50 to 200', '200-500': '200 to 500', '500-1000': '500 to 1,000', 'over-1000': 'Over 1,000',
    'under-500': 'Under 500 employees', '500-5000': '500 to 5,000 employees', '5000-25000': '5,000 to 25,000 employees', 'over-25000': 'Over 25,000 employees',
    'readiness-assessment': 'Autonomy readiness assessment', 'governance-guardrails': 'Governance and guardrail design', 'operating-model': 'Operating-model changes',
    'business-case-roadmap': 'Business case and 30-month roadmap', other: 'Something else',
    now: 'Ready to start now', '1-3-months': 'In 1 to 3 months', '3-6-months': 'In 3 to 6 months', exploring: 'Exploring options'
  };
  var NAME = { key: 'name', label: 'Name', req: true, type: 'text', ac: 'name' };
  var EMAIL = { key: 'email', label: 'Email', req: true, type: 'email', ac: 'email' };
  var ORG = { key: 'organization', label: 'Organization', req: true, type: 'text', ac: 'organization' };
  var ROLE = { key: 'role', label: 'Role', req: false, type: 'text', ac: 'organization-title' };
  var FIELDS = {
    talk: [NAME, EMAIL, ORG, ROLE, { key: 'event_name', label: 'Event', req: true, type: 'text' }, { key: 'event_date', label: 'Event date', req: false, type: 'date' },
      { key: 'delivery', label: 'In person or virtual', req: true, opts: ['in-person', 'virtual'] }, { key: 'location', label: 'Location', req: false, type: 'text' },
      { key: 'audience_size', label: 'Audience size', req: false, opts: ['under-50', '50-200', '200-500', '500-1000', 'over-1000'] },
      { key: 'format', label: 'Format', req: true, opts: ['keynote', 'panel', 'fireside-chat', 'workshop'] }, { key: 'message', label: 'Message', req: true, type: 'area' }],
    advisory: [NAME, EMAIL, ORG, ROLE, { key: 'company_size', label: 'Company size', req: false, opts: ['under-500', '500-5000', '5000-25000', 'over-25000'] },
      { key: 'goals', label: 'Goals', req: true, list: true, opts: ['readiness-assessment', 'governance-guardrails', 'operating-model', 'business-case-roadmap', 'other'] },
      { key: 'timeline', label: 'Timeline', req: false, opts: ['now', '1-3-months', '3-6-months', 'exploring'] }, { key: 'message', label: 'Message', req: false, type: 'area' }],
    media: [NAME, EMAIL, { key: 'outlet', label: 'Outlet', req: true, type: 'text' }, { key: 'topic', label: 'Topic', req: true, type: 'text' },
      { key: 'deadline', label: 'Deadline', req: false, type: 'date' }, { key: 'message', label: 'Message', req: true, type: 'area' }]
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function cost(u) { return ((u.input_tokens || 0) * PRICE_IN + (u.output_tokens || 0) * PRICE_OUT) / 1e6; }
  function meter(u) {
    var n = (u.input_tokens || 0) + (u.output_tokens || 0);
    return n.toLocaleString('en-US') + ' tokens (' + (u.input_tokens || 0).toLocaleString('en-US') + ' in, ' + (u.output_tokens || 0).toLocaleString('en-US') + ' out) \u00b7 $' + cost(u).toFixed(4) + (u.estimated ? ' (estimated)' : '');
  }
  function centralTime(ms) {
    var d = new Date(ms), s;
    try { s = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }); }
    catch (e) { return d.toUTCString().slice(17, 22) + ' UTC'; }
    return s.replace(':00', '').replace(/\s?AM$/, ' am').replace(/\s?PM$/, ' pm') + ' Central';
  }
  function show(v) { if (Array.isArray(v)) return v.map(function (x) { return OPT[x] || x; }).join('; '); return OPT[v] || v; }

  var path = location.pathname;
  var fromHash = (INTENTS.filter(function (i) { return location.hash === '#' + i.hash; })[0] || {}).id;
  var S = { intent: /^\/speaking\//.test(path) ? 'talk' : /^\/advisory\//.test(path) ? 'advisory' : fromHash || null, messages: [], captured: {}, edited: {}, missing: [], busy: false, calls: 0, tokIn: 0, tokOut: 0, sent: false };

  root.innerHTML =
    '<div class="ik-intents" role="group" aria-label="What do you need?"></div>' +
    '<p class="ik-hint">Pick one, or just tell the agent in a sentence. It asks short questions and fills the card. You check the card and send it.</p>' +
    '<div class="ik-grid">' +
      '<div class="ik-chat"><ol class="ik-log" aria-live="polite" aria-label="Conversation with the intake agent"></ol>' +
        '<div class="ik-row"><label class="visually-hidden" for="ik-text">Your message to the intake agent</label>' +
        '<input id="ik-text" class="ik-text" type="text" maxlength="' + MAX + '" autocomplete="off" placeholder="For example: I run a CFO summit in March">' +
        '<button type="button" class="pill pill-dark ik-send">Send</button></div>' +
        '<p class="ik-meter" aria-live="off">Each reply is one AI call. Nothing is stored until you send the card.</p></div>' +
      '<section class="ik-card" aria-labelledby="ik-card-t"><h3 id="ik-card-t">What I&rsquo;ve captured</h3><p class="ik-card-sub"></p><dl class="ik-fields"></dl>' +
        '<div class="ik-consent"><input type="checkbox" id="ik-consent"> <label for="ik-consent">Send these details to Hemanth so he can reply by email. I agree.</label></div>' +
        '<button type="button" class="btn btn-dark ik-submit">Send to Hemanth</button><p class="ik-status" role="status"></p></section>' +
    '</div>';
  root.hidden = false;
  var log = $('.ik-log', root), text = $('.ik-text', root), send = $('.ik-send', root), fields = $('.ik-fields', root), status = $('.ik-status', root);

  var bar = $('.ik-intents', root);
  INTENTS.forEach(function (it) {
    var b = el('button', 'pill', esc(it.label)); b.type = 'button'; b.setAttribute('data-intent', it.id); b.setAttribute('aria-pressed', String(S.intent === it.id));
    b.addEventListener('click', function () { setIntent(it.id); text.focus(); });
    bar.appendChild(b);
  });
  function setIntent(id) {
    if (S.sent) return;
    if (S.intent && S.intent !== id) {
      // Keep the shared fields when switching.
      var keep = {}; ['name', 'email', 'organization', 'role', 'message'].forEach(function (k) { if (S.captured[k]) keep[k] = S.captured[k]; });
      if (id === 'media' && S.captured.organization) keep.outlet = S.captured.organization;
      S.captured = keep;
    }
    S.intent = id;
    $$('button', bar).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-intent') === id)); });
    render();
  }

  function missingLocal() {
    if (!S.intent) return [];
    return FIELDS[S.intent].filter(function (f) { var v = S.captured[f.key]; return f.req && !(Array.isArray(v) ? v.length : v); }).map(function (f) { return f.label; });
  }

  function render(errors) {
    errors = errors || {};
    var sub = $('.ik-card-sub', root);
    if (!S.intent) { sub.textContent = 'Pick what you need, or tell the agent.'; fields.innerHTML = ''; return; }
    var miss = missingLocal();
    sub.textContent = (INTENTS.filter(function (i) { return i.id === S.intent; })[0].label) + '. ' + (miss.length ? 'Still needed: ' + miss.join(', ') + '.' : 'Everything required is here. Check it, then send.');
    fields.innerHTML = '';
    FIELDS[S.intent].forEach(function (f) {
      var v = S.captured[f.key], has = Array.isArray(v) ? v.length : v;
      var row = el('div', 'ik-f' + (errors[f.key] ? ' ik-err' : ''));
      row.innerHTML = '<dt>' + esc(f.label) + (f.req ? ' <span class="ik-req">required</span>' : '') + '</dt><dd><span class="ik-v' + (has ? '' : ' ik-empty') + '">' + (has ? esc(show(v)) : '\u2013') + '</span>' +
        ' <button type="button" class="ik-edit" aria-label="Edit ' + esc(f.label) + '">Edit</button>' + (errors[f.key] ? '<span class="ik-errmsg">' + esc(errors[f.key]) + '</span>' : '') + '</dd>';
      $('.ik-edit', row).addEventListener('click', function () { edit(row, f); });
      fields.appendChild(row);
    });
  }

  function edit(row, f) {
    var dd = $('dd', row), v = S.captured[f.key], id = 'ik-e-' + f.key, ctl;
    if (f.list) {
      ctl = '<fieldset class="ik-opts"><legend class="visually-hidden">' + esc(f.label) + '</legend>' + f.opts.map(function (o) {
        return '<label><input type="checkbox" value="' + o + '"' + ((v || []).indexOf(o) >= 0 ? ' checked' : '') + '> ' + esc(OPT[o]) + '</label>';
      }).join('') + '</fieldset>';
    } else if (f.opts) {
      ctl = '<label class="visually-hidden" for="' + id + '">' + esc(f.label) + '</label><select id="' + id + '"><option value="">Not set</option>' + f.opts.map(function (o) { return '<option value="' + o + '"' + (v === o ? ' selected' : '') + '>' + esc(OPT[o]) + '</option>'; }).join('') + '</select>';
    } else if (f.type === 'area') {
      ctl = '<label class="visually-hidden" for="' + id + '">' + esc(f.label) + '</label><textarea id="' + id + '" rows="4" maxlength="1500">' + esc(v || '') + '</textarea>';
    } else {
      ctl = '<label class="visually-hidden" for="' + id + '">' + esc(f.label) + '</label><input id="' + id + '" type="' + f.type + '" maxlength="254"' + (f.ac ? ' autocomplete="' + f.ac + '"' : '') + ' value="' + esc(v || '') + '">';
    }
    dd.innerHTML = ctl + '<span class="ik-editbtns"><button type="button" class="pill pill-dark ik-save">Save</button> <button type="button" class="pill ik-cancel">Cancel</button></span>';
    var first = $('input, select, textarea', dd); if (first) first.focus();
    $('.ik-save', dd).addEventListener('click', function () {
      var nv;
      if (f.list) nv = $$('input:checked', dd).map(function (x) { return x.value; });
      else nv = String($('input, select, textarea', dd).value || '').trim();
      if (Array.isArray(nv) ? nv.length : nv) S.captured[f.key] = nv; else delete S.captured[f.key];
      S.edited[f.key] = true;
      render();
      var btn = $$('.ik-edit', fields)[FIELDS[S.intent].indexOf(f)]; if (btn) btn.focus();
    });
    $('.ik-cancel', dd).addEventListener('click', function () { render(); });
    dd.addEventListener('keydown', function (e) { if (e.key === 'Escape') render(); if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); $('.ik-save', dd).click(); } });
  }

  function bubble(who, html, cls) {
    var li = el('li', 'ik-m ik-' + who + (cls ? ' ' + cls : ''), '<b>' + (who === 'you' ? 'You' : who === 'agent' ? 'Intake agent (AI)' : 'Site') + '</b><span>' + html + '</span>');
    log.appendChild(li); log.scrollTop = log.scrollHeight; return li;
  }
  function renderMeter() {
    $('.ik-meter', root).textContent = 'This conversation: ' + S.calls + ' AI call' + (S.calls === 1 ? '' : 's') + ' \u00b7 ' + meter({ input_tokens: S.tokIn, output_tokens: S.tokOut });
  }
  var FALLBACK = ' You can still edit the card yourself and send it, or <a href="https://www.linkedin.com/in/hemanth-reganti-147153178/" rel="noopener" target="_blank">message Hemanth on LinkedIn<span class="visually-hidden"> (opens in a new tab)</span></a>.';

  function turn() {
    var t = String(text.value || '').trim();
    if (S.busy || S.sent) return;
    if (!t) { text.focus(); return; }
    if (t.length > MAX) { bubble('site', 'Keep each message to ' + MAX + ' characters.'); return; }
    text.value = '';
    S.messages.push({ role: 'user', content: t });
    bubble('you', esc(t));
    S.busy = true; send.disabled = true;
    var wait = bubble('agent', '<span class="ik-dots">Thinking</span>', 'ik-wait');
    var edited = Object.keys(S.edited);
    fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'turn', intent: S.intent, messages: S.messages.slice(-20), captured: S.captured, edited: edited }) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, reason: 'ai_error', message: 'The intake agent is resting: the model is unavailable right now.' }; }); })
      .then(function (d) {
        wait.remove();
        (d.calls || []).forEach(function (c) { S.calls++; S.tokIn += c.usage.input_tokens; S.tokOut += c.usage.output_tokens; });
        if (d.calls && d.calls.length) renderMeter();
        if (!d.ok) {
          var when = d.retry_at ? ' Back at ' + centralTime(d.retry_at) + '.' : '';
          bubble('site', esc(d.message || d.error || 'The intake agent is resting.') + esc(when) + FALLBACK, 'ik-stop');
          S.messages.pop();
          return;
        }
        S.messages.push({ role: 'assistant', content: d.reply });
        var li = bubble('agent', esc(d.reply));
        (d.calls || []).forEach(function (c) { li.appendChild(el('small', 'ik-callm', 'AI call \u00b7 ' + esc(meter(c.usage)))); });
        if (d.intent && d.intent !== S.intent) setIntent(d.intent);
        S.captured = d.captured || S.captured;
        S.missing = d.missing || [];
        render();
        var got = Object.keys(d.extracted || {});
        if (got.length) {
          $$('.ik-f', fields).forEach(function (row, i) { if (got.indexOf(FIELDS[S.intent][i].key) >= 0) row.classList.add('ik-new'); });
        }
      })
      .catch(function () { wait.remove(); S.messages.pop(); bubble('site', 'The intake agent is resting: the network call failed.' + FALLBACK, 'ik-stop'); })
      .then(function () { S.busy = false; send.disabled = false; });
  }
  send.addEventListener('click', turn);
  text.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); turn(); } });

  $('.ik-submit', root).addEventListener('click', function () {
    if (S.busy || S.sent) return;
    status.className = 'ik-status';
    if (!S.intent) { status.textContent = 'Pick what you need first.'; status.classList.add('ik-bad'); return; }
    if (!$('#ik-consent').checked) { status.textContent = 'Please tick the box to agree before sending.'; status.classList.add('ik-bad'); $('#ik-consent').focus(); return; }
    var miss = missingLocal();
    if (miss.length) { status.textContent = 'Still needed: ' + miss.join(', ') + '. Tell the agent, or press Edit.'; status.classList.add('ik-bad'); return; }
    S.busy = true; status.textContent = 'Sending\u2026';
    fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'submit', intent: S.intent, captured: S.captured, consent: true }) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Something went wrong on our side. Please try again later.' }; }); })
      .then(function (d) {
        if (!d.ok) { status.textContent = d.error || 'Not sent.'; status.classList.add('ik-bad'); if (d.errors) render(d.errors); return; }
        S.sent = true;
        root.classList.add('ik-done');
        status.textContent = '';
        $('.ik-card', root).innerHTML = '<h3>Sent. Thank you.</h3><p>Hemanth will reply to ' + esc(S.captured.email) + '. Nothing else from this conversation was stored.</p>';
        text.disabled = true; send.disabled = true;
      })
      .catch(function () { status.textContent = 'Not sent: the network call failed.'; status.classList.add('ik-bad'); })
      .then(function () { S.busy = false; });
  });

  render();
  if (window.AE) window.AE.intakeUi = { FIELDS: FIELDS, INTENTS: INTENTS };
  else window.AE = { intakeUi: { FIELDS: FIELDS, INTENTS: INTENTS } };
})();
