/* Talk to the Book: on-site guide. Same-origin API only; state lives in sessionStorage. */
(function () {
  'use strict';
  var KEY = 'hle-guide-v1';
  var API = '/api/guide';
  var MAX_TURNS = 12;
  var AMAZON = 'https://www.amazon.com/dp/B0HS8HG6DP';
  var OPENING = 'Human-led, agent-operated: autonomy is earned when value compounds faster than risk.';
  var ROLES = [
    ['ceo-board', 'CEO/board'], ['cfo-finance', 'CFO/finance'], ['cio-technology', 'CIO/technology'],
    ['operations', 'Operations/supply chain'], ['risk-audit', 'Risk/audit'], ['investor', 'Investor'], ['curious', 'Just curious']
  ];
  var MATURITY = [
    ['l0-l1', 'L0\u2013L1 exploring'], ['l2', 'L2 pilots with approval'], ['l3-plus', 'L3+ acting within limits'], ['not-sure', 'Not sure']
  ];
  var FALLBACK = 'The guide is taking a break right now. The book goes deeper on every one of these questions, and Hemanth is glad to continue the conversation with you directly.';

  function label(list, id) { for (var i = 0; i < list.length; i++) if (list[i][0] === id) return list[i][1]; return ''; }
  function load() {
    try { var s = JSON.parse(sessionStorage.getItem(KEY) || '{}'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; }
  }
  function store(s) { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ } }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    if (text) n.textContent = text;
    return n;
  }
  var uid = 0;

  function Guide(root) {
    this.root = root;
    this.s = load();
    if (!Array.isArray(this.s.messages)) this.s.messages = [];
    this.busy = false;
    this.id = 'g' + (++uid);
    this.build();
    this.renderAll();
  }

  Guide.prototype.save = function () { store(this.s); };

  Guide.prototype.build = function () {
    var self = this;
    this.root.textContent = '';
    this.log = el('div', { class: 'guide-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': 'Conversation with the guide', tabindex: '0' });
    this.form = el('form', { class: 'guide-input', novalidate: '' });
    var inputId = this.id + '-q';
    this.form.appendChild(el('label', { class: 'visually-hidden', for: inputId }, 'Your question'));
    this.input = el('textarea', { id: inputId, rows: '1', maxlength: '600', autocomplete: 'off', enterkeyhint: 'send' });
    this.send = el('button', { class: 'btn btn-primary', type: 'submit' }, 'Send');
    this.form.appendChild(this.input);
    this.form.appendChild(this.send);
    var foot = el('div', { class: 'guide-foot' });
    var reset = el('button', { class: 'guide-reset', type: 'button' }, 'Start over');
    this.status = el('p', { class: 'visually-hidden', role: 'status' });
    foot.appendChild(reset);
    foot.appendChild(this.status);
    this.root.appendChild(this.log);
    this.root.appendChild(this.form);
    this.root.appendChild(foot);

    this.form.addEventListener('submit', function (e) { e.preventDefault(); self.ask(self.input.value); });
    this.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); self.ask(self.input.value); }
    });
    reset.addEventListener('click', function () {
      self.s = { messages: [] };
      self.save();
      self.renderAll();
      self.focusFirst();
    });
  };

  Guide.prototype.bubble = function (who, text) {
    var b = el('div', { class: 'msg msg-' + who });
    b.appendChild(el('span', { class: 'visually-hidden' }, who === 'you' ? 'You: ' : 'Guide: '));
    String(text).split(/\n{2,}/).forEach(function (para) { if (para.trim()) b.appendChild(el('p', null, para.trim())); });
    this.log.appendChild(b);
    this.scroll();
    return b;
  };

  Guide.prototype.scroll = function () { this.log.scrollTop = this.log.scrollHeight; };

  Guide.prototype.chips = function (question, list, key) {
    var self = this;
    this.bubble('guide', question);
    var group = el('div', { class: 'chips', role: 'group', 'aria-label': question });
    list.forEach(function (item) {
      var c = el('button', { class: 'chip', type: 'button' }, item[1]);
      c.addEventListener('click', function () {
        group.remove();
        self.s[key] = item[0];
        self.save();
        self.bubble('you', item[1]);
        self.next(true);
      });
      group.appendChild(c);
    });
    this.log.appendChild(group);
    this.scroll();
  };

  Guide.prototype.renderAll = function () {
    var self = this;
    this.log.textContent = '';
    this.bubble('guide', OPENING);
    if (this.s.role) {
      this.bubble('guide', 'Where are you today?');
      this.bubble('you', label(ROLES, this.s.role));
    }
    if (this.s.maturity) {
      this.bubble('guide', 'Where are your agents today?');
      this.bubble('you', label(MATURITY, this.s.maturity));
    }
    this.s.messages.forEach(function (m, i) {
      if (i === 0 && m.role === 'user' && m.intro) return;
      self.bubble(m.role === 'user' ? 'you' : 'guide', m.content);
    });
    this.next(false);
  };

  /** Shows whatever the conversation needs next. `live` is true after a visitor action. */
  Guide.prototype.next = function (live) {
    var s = this.s;
    if (!s.role) { this.chips('Where are you today?', ROLES, 'role'); this.lock(true); if (live) this.focusFirst(); return; }
    if (!s.maturity) { this.chips('Where are your agents today?', MATURITY, 'maturity'); this.lock(true); if (live) this.focusFirst(); return; }
    if (!s.messages.length) {
      var intro = 'I\u2019m ' + label(ROLES, s.role) + '. Our agents today: ' + label(MATURITY, s.maturity) + '.';
      s.messages.push({ role: 'user', content: intro, intro: true });
      this.save();
      this.request();
      return;
    }
    if (s.lead === 'sent') this.bubble('guide', 'Thank you. Hemanth will reply to you directly.');
    else if (s.leadOpen) this.leadForm();
    else if (s.actions) this.actions();
    var turns = s.messages.filter(function (m) { return m.role === 'user'; }).length;
    this.lock(!!s.done || turns >= MAX_TURNS);
  };

  Guide.prototype.lock = function (locked) {
    this.input.disabled = locked || this.busy;
    this.send.disabled = locked || this.busy;
    this.input.placeholder = locked && !this.busy
      ? (this.s.role && this.s.maturity ? 'Thanks for the conversation' : 'Choose an option above')
      : 'Ask about the book\u2019s ideas';
  };

  Guide.prototype.focusFirst = function () {
    var t = this.log.querySelector('.chips .chip, .guide-lead input') || (!this.input.disabled && this.input);
    if (t) t.focus();
  };

  Guide.prototype.ask = function (text) {
    text = String(text || '').trim();
    if (!text || this.busy || this.input.disabled) return;
    this.input.value = '';
    this.s.messages.push({ role: 'user', content: text.slice(0, 600) });
    this.save();
    this.bubble('you', text);
    this.request();
  };

  Guide.prototype.payload = function (extra) {
    var body = { role: this.s.role, maturity: this.s.maturity, messages: this.s.messages.map(function (m) { return { role: m.role, content: m.content }; }) };
    for (var k in extra) body[k] = extra[k];
    return JSON.stringify(body);
  };

  Guide.prototype.request = function () {
    var self = this;
    this.busy = true;
    this.lock(true);
    var dots = el('div', { class: 'msg msg-guide msg-typing', 'aria-hidden': 'true' });
    dots.appendChild(el('span')); dots.appendChild(el('span')); dots.appendChild(el('span'));
    this.log.appendChild(dots);
    this.scroll();
    this.status.textContent = 'The guide is thinking.';
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: this.payload({ action: 'chat' }), credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .catch(function () { return {}; })
      .then(function (data) {
        dots.remove();
        self.busy = false;
        self.status.textContent = '';
        var reply = typeof data.reply === 'string' && data.reply ? data.reply : FALLBACK;
        self.s.messages.push({ role: 'assistant', content: reply });
        if (data.actions || !data.ok) self.s.actions = true;
        if (data.done) self.s.done = true;
        self.save();
        self.bubble('guide', reply);
        var old = self.log.querySelector('.guide-actions');
        if (old) old.remove();
        self.next(false);
        if (!self.input.disabled) self.input.focus();
      });
  };

  Guide.prototype.actions = function () {
    var self = this;
    var row = el('div', { class: 'guide-actions', role: 'group', 'aria-label': 'Next steps' });
    var talk = el('button', { class: 'btn btn-primary', type: 'button' }, 'Talk with Hemanth');
    talk.addEventListener('click', function () {
      row.remove();
      self.s.leadOpen = true;
      self.save();
      self.leadForm(true);
    });
    var speak = el('a', { class: 'btn btn-ghost', href: '/contact/#speaking' }, 'Invite him to speak');
    var book = el('a', { class: 'btn btn-ghost ext', href: AMAZON, rel: 'noopener', target: '_blank' }, 'Get the book');
    book.appendChild(el('span', { class: 'visually-hidden' }, ' on Amazon (opens in a new tab)'));
    row.appendChild(talk); row.appendChild(speak); row.appendChild(book);
    this.log.appendChild(row);
    this.scroll();
  };

  Guide.prototype.leadForm = function (focus) {
    var self = this;
    var id = this.id + '-lead';
    var f = el('form', { class: 'guide-lead', novalidate: '', 'aria-labelledby': id + '-t' });
    f.appendChild(el('p', { class: 'guide-lead-title', id: id + '-t' }, 'Talk with Hemanth'));
    function field(name, text, type, attrs) {
      var w = el('div', { class: 'field' });
      var fid = id + '-' + name;
      w.appendChild(el('label', { for: fid }, text));
      var a = { id: fid, name: name, type: type || 'text', 'aria-describedby': fid + '-e' };
      for (var k in attrs) a[k] = attrs[k];
      var i = el('input', a);
      w.appendChild(i);
      w.appendChild(el('p', { class: 'field-error', id: fid + '-e' }));
      f.appendChild(w);
      return i;
    }
    field('name', 'Name', 'text', { autocomplete: 'name', required: '', maxlength: '120' });
    field('email', 'Work email', 'email', { autocomplete: 'email', required: '', maxlength: '254' });
    field('organization', 'Organization', 'text', { autocomplete: 'organization', required: '', maxlength: '160' });
    var role = field('role', 'Role', 'text', { autocomplete: 'organization-title', maxlength: '120' });
    role.value = label(ROLES, this.s.role);
    field('goal', 'One-line goal', 'text', { required: '', maxlength: '200' });
    var hp = el('div', { class: 'hp', 'aria-hidden': 'true' });
    hp.appendChild(el('label', { for: id + '-website' }, 'Website'));
    hp.appendChild(el('input', { id: id + '-website', name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' }));
    f.appendChild(hp);
    var cw = el('div', { class: 'check' });
    var consent = el('input', { id: id + '-consent', name: 'consent', type: 'checkbox', checked: '' });
    cw.appendChild(consent);
    cw.appendChild(el('label', { for: id + '-consent' }, 'Share a summary of this chat with Hemanth'));
    f.appendChild(cw);
    var msg = el('p', { class: 'form-status', role: 'alert' });
    f.appendChild(msg);
    var btn = el('button', { class: 'btn btn-dark', type: 'submit' }, 'Send to Hemanth');
    f.appendChild(btn);

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {};
      ['name', 'email', 'organization', 'role', 'goal', 'website'].forEach(function (n) { data[n] = f.elements[n].value; });
      data.consent = consent.checked;
      var errors = {};
      if (data.name.trim().length < 2) errors.name = 'Name is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) errors.email = 'Please enter a valid email address.';
      if (!data.organization.trim()) errors.organization = 'Organization is required.';
      if (data.goal.trim().length < 3) errors.goal = 'Goal is required.';
      if (show(errors)) return;
      btn.disabled = true;
      msg.textContent = 'Sending\u2026';
      data.action = 'lead';
      data.maturity = self.s.maturity;
      // The transcript is only sent when the visitor consents to share it.
      var body = consent.checked ? JSON.parse(self.payload(data)) : data;
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .catch(function () { return {}; })
        .then(function (res) {
          btn.disabled = false;
          if (res.ok) {
            self.s.lead = 'sent';
            self.s.leadOpen = false;
            self.save();
            f.remove();
            var b = self.bubble('guide', 'Thank you, ' + data.name.trim().split(/\s+/)[0] + '. Hemanth will reply to ' + data.email.trim() + ' directly.');
            b.setAttribute('tabindex', '-1');
            b.focus();
            return;
          }
          if (res.errors) show(res.errors);
          msg.textContent = res.error || 'Something went wrong. Please try again, or use the contact page.';
        });
    });
    function show(errors) {
      var first = null;
      ['name', 'email', 'organization', 'role', 'goal'].forEach(function (n) {
        var i = f.elements[n];
        var e = document.getElementById(i.id + '-e');
        if (errors[n]) { i.setAttribute('aria-invalid', 'true'); e.textContent = errors[n]; if (!first) first = i; }
        else { i.removeAttribute('aria-invalid'); e.textContent = ''; }
      });
      if (first) { msg.textContent = 'Please check the highlighted fields.'; first.focus(); }
      return !!first;
    }
    this.log.appendChild(f);
    this.scroll();
    if (focus) f.elements.name.focus();
  };

  // Modal wrapper used on every page except /talk.
  var dialog = null;
  var opener = null;
  function focusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), [tabindex="0"]'),
      function (n) { return n.offsetParent !== null || n === document.activeElement; }
    );
  }
  function openDialog() {
    if (!dialog) {
      dialog = el('dialog', { class: 'guide-dialog', 'aria-labelledby': 'guide-dialog-title' });
      var head = el('div', { class: 'guide-dialog-head' });
      head.appendChild(el('h2', { id: 'guide-dialog-title' }, 'Talk to the book'));
      var close = el('button', { class: 'guide-close', type: 'button', 'aria-label': 'Close' }, '\u00d7');
      head.appendChild(close);
      var body = el('div', { class: 'guide' });
      dialog.appendChild(head);
      dialog.appendChild(body);
      document.body.appendChild(dialog);
      dialog.guide = new Guide(body);
      close.addEventListener('click', function () { dialog.close(); });
      dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
      dialog.addEventListener('close', function () {
        document.documentElement.classList.remove('guide-open');
        if (opener && opener.focus) opener.focus();
      });
      dialog.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var f = focusables(dialog);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    } else {
      // Pick up changes made on another page in this tab.
      dialog.guide.s = load();
      if (!Array.isArray(dialog.guide.s.messages)) dialog.guide.s.messages = [];
      if (!dialog.guide.busy) dialog.guide.renderAll();
    }
    document.documentElement.classList.add('guide-open');
    dialog.showModal();
    dialog.guide.focusFirst();
    dialog.guide.scroll();
  }

  var embed = document.querySelector('[data-guide-embed]');
  if (embed) new Guide(embed);
  var canModal = typeof HTMLDialogElement === 'function' && !embed;
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-guide-open]');
    if (!t) return;
    if (embed) { e.preventDefault(); var g = embed.querySelector('.chip, textarea'); if (g) g.focus(); return; }
    if (!canModal || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    opener = t;
    openDialog();
  });
})();
