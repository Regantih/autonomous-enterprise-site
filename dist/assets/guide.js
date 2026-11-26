/* Talk to the Book: an on-site agent with tools. Same-origin API only; state lives in sessionStorage.
   Free text works from the first message. Role chips are optional suggestions. Each answer shows what the agent
   did (its tool trace), the chapters it cites and any page or intake handoff it suggests. */
(function () {
  'use strict';
  var KEY = 'hle-guide-v2';
  var API = '/api/guide';
  var MAX_TURNS = 12;
  var MAX_CHARS = 600;
  var AMAZON = 'https://www.amazon.com/dp/B0HS8HG6DP';
  var LINKEDIN = 'https://www.linkedin.com/in/hemanth-reganti-147153178/';
  var PRICE_IN = 0.293, PRICE_OUT = 2.253;
  var OPENING = 'Human-led, agent-operated: autonomy is earned when value compounds faster than risk.';
  var INTRO = 'Ask me anything about the book. I search it, cite chapters and point you to the right page.';
  var ROLES = [
    ['ceo-board', 'CEO/board'], ['cfo-finance', 'CFO/finance'], ['cio-technology', 'CIO/technology'],
    ['operations', 'Operations/supply chain'], ['risk-audit', 'Risk/audit'], ['investor', 'Investor'], ['curious', 'Just curious']
  ];

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
  function extLink(href, text, cls) {
    var a = el('a', { href: href, rel: 'noopener', target: '_blank', class: cls || null }, text);
    a.appendChild(el('span', { class: 'visually-hidden' }, ' (opens in a new tab)'));
    return a;
  }
  function meterText(calls) {
    var i = 0, o = 0, est = false;
    calls.forEach(function (c) { i += c.usage.input_tokens || 0; o += c.usage.output_tokens || 0; if (c.usage.estimated) est = true; });
    var usd = (i * PRICE_IN + o * PRICE_OUT) / 1e6;
    return calls.length + ' AI call' + (calls.length === 1 ? '' : 's') + ' \u00b7 ' + (i + o).toLocaleString('en-US') + ' tokens \u00b7 $' + usd.toFixed(4) + (est ? ' (estimated)' : '');
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
    var hintId = this.id + '-qh';
    this.form.appendChild(el('label', { class: 'visually-hidden', for: inputId }, 'Ask the guide a question'));
    this.input = el('textarea', { id: inputId, rows: '1', maxlength: String(MAX_CHARS), autocomplete: 'off', enterkeyhint: 'send', placeholder: 'Ask in your own words', 'aria-describedby': hintId });
    this.send = el('button', { class: 'btn btn-primary', type: 'submit' }, 'Send');
    this.form.appendChild(this.input);
    this.form.appendChild(this.send);
    var foot = el('div', { class: 'guide-foot' });
    var reset = el('button', { class: 'guide-reset', type: 'button' }, 'Start over');
    this.hint = el('p', { class: 'guide-hint', id: hintId }, 'Press Enter to send. Each step the guide takes is one AI call.');
    this.status = el('p', { class: 'visually-hidden', role: 'status' });
    foot.appendChild(this.hint);
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
      self.input.focus();
    });
  };

  Guide.prototype.scroll = function () { this.log.scrollTop = this.log.scrollHeight; };

  Guide.prototype.bubble = function (who, text) {
    var b = el('div', { class: 'msg msg-' + who });
    b.appendChild(el('span', { class: 'visually-hidden' }, who === 'you' ? 'You: ' : who === 'site' ? 'Site notice: ' : 'Guide: '));
    String(text).split(/\n{2,}/).forEach(function (para) { if (para.trim()) b.appendChild(el('p', null, para.trim())); });
    this.log.appendChild(b);
    this.scroll();
    return b;
  };

  /** What the agent did, in order: tool trace, sources, page cards, intake handoff and the cost meter. */
  Guide.prototype.extras = function (b, m) {
    var self = this;
    if (m.trace && m.trace.length) {
      var tid = self.id + '-t' + (++uid);
      var wrap = el('div', { class: 'guide-trace' });
      wrap.appendChild(el('p', { class: 'guide-trace-h', id: tid }, 'What the guide did'));
      var ol = el('ol', { 'aria-labelledby': tid });
      m.trace.forEach(function (t) {
        var li = el('li', { class: 'guide-tool guide-tool-' + String(t.tool).replace(/[^a-z_]/g, '') });
        li.appendChild(el('span', { class: 'visually-hidden' }, 'Tool step: '));
        li.appendChild(document.createTextNode(t.label));
        if (t.detail) li.appendChild(el('span', { class: 'guide-tool-q' }, ' \u201c' + t.detail + '\u201d'));
        ol.appendChild(li);
      });
      wrap.appendChild(ol);
      b.appendChild(wrap);
    }
    // Chapters show only when the book search ran and returned them; a sample-data answer names its source instead.
    if (m.cites && m.cites.length) b.appendChild(el('p', { class: 'guide-cites' }, 'From the book: ' + m.cites.join(', ')));
    else if ((m.trace || []).some(function (t) { return t.tool === 'ask_graph'; })) b.appendChild(el('p', { class: 'guide-cites' }, 'From the synthetic sample data in the graphs'));
    if (m.notCovered) b.appendChild(el('p', { class: 'guide-cites guide-uncovered' }, 'Not in the book: ' + m.notCovered));
    // One or two suggested pages per answer; the server caps them too.
    var pages = (m.pages || []).slice(0, 2);
    if (pages.length) {
      var ul = el('ul', { class: 'guide-pages', 'aria-label': 'Suggested pages' });
      pages.forEach(function (p) {
        var li = el('li');
        li.appendChild(el('a', { href: p.href }, p.title));
        li.appendChild(el('span', null, ' ' + p.reason));
        ul.appendChild(li);
      });
      b.appendChild(ul);
    }
    if (m.handoff) {
      var h = el('div', { class: 'guide-handoff' });
      h.appendChild(el('p', null, 'The intake agent asks a few questions and fills a request card. Nothing is sent until you tick consent and press Send.'));
      h.appendChild(el('a', { class: 'btn btn-dark', href: m.handoff.href }, m.handoff.label + ' with the intake agent'));
      b.appendChild(h);
    }
    if (m.calls && m.calls.length) b.appendChild(el('p', { class: 'guide-meter' }, meterText(m.calls)));
    if (m.kind === 'site') {
      var p2 = el('p', { class: 'guide-alt' }, 'You can still ');
      p2.appendChild(extLink(LINKEDIN, 'message Hemanth on LinkedIn'));
      p2.appendChild(document.createTextNode(' or '));
      p2.appendChild(extLink(AMAZON, 'get the book'));
      p2.appendChild(document.createTextNode('.'));
      b.appendChild(p2);
    }
  };

  Guide.prototype.renderMessage = function (m) {
    var who = m.kind === 'site' ? 'site' : m.role === 'user' ? 'you' : 'guide';
    var b = this.bubble(who, m.content);
    if (who !== 'you') this.extras(b, m);
    return b;
  };

  Guide.prototype.chips = function () {
    var self = this;
    var gid = this.id + '-roles';
    var wrap = el('div', { class: 'guide-suggest' });
    wrap.appendChild(el('p', { class: 'guide-suggest-h', id: gid }, 'Optional: start from your role'));
    var group = el('div', { class: 'chips', role: 'group', 'aria-labelledby': gid });
    ROLES.forEach(function (item) {
      var text = item[0] === 'curious' ? 'I\u2019m just curious. Where should I start?' : 'I\u2019m in ' + item[1] + '. Where should I start?';
      var c = el('button', { class: 'chip', type: 'button', 'aria-label': item[1] + ': ask where to start' }, item[1]);
      c.addEventListener('click', function () {
        if (self.busy) return;
        self.s.role = item[0];
        self.ask(text);
      });
      group.appendChild(c);
    });
    wrap.appendChild(group);
    this.log.appendChild(wrap);
  };

  Guide.prototype.turns = function () { return this.s.messages.filter(function (m) { return m.role === 'user'; }).length; };

  Guide.prototype.renderAll = function () {
    var self = this;
    this.log.textContent = '';
    this.bubble('guide', OPENING + '\n\n' + INTRO);
    if (!this.turns()) this.chips();
    this.s.messages.forEach(function (m) { self.renderMessage(m); });
    if (this.s.actions) this.actions();
    this.lock();
    this.scroll();
  };

  Guide.prototype.lock = function () {
    var ended = !!this.s.done || this.turns() >= MAX_TURNS;
    this.input.disabled = ended || this.busy;
    this.send.disabled = ended || this.busy;
    this.input.placeholder = ended ? 'This conversation is complete. Press Start over for a new one.' : 'Ask in your own words';
  };

  Guide.prototype.focusFirst = function () { if (!this.input.disabled) this.input.focus(); };

  Guide.prototype.ask = function (text) {
    text = String(text || '').trim();
    if (!text || this.busy || this.input.disabled) return;
    this.input.value = '';
    var chips = this.log.querySelector('.guide-suggest');
    if (chips) chips.remove();
    this.s.messages.push({ role: 'user', content: text.slice(0, MAX_CHARS) });
    this.save();
    this.bubble('you', text);
    this.request();
  };

  Guide.prototype.payload = function () {
    var msgs = this.s.messages.filter(function (m) { return m.kind !== 'site' && !m.unanswered; }).map(function (m) { return { role: m.role, content: m.content }; });
    var clarified = this.s.messages.some(function (m) { return m.clarify; });
    return JSON.stringify({ action: 'chat', role: this.s.role || '', messages: msgs, clarified: clarified });
  };

  Guide.prototype.request = function () {
    var self = this;
    this.busy = true;
    this.lock();
    var dots = el('div', { class: 'msg msg-guide msg-typing', 'aria-hidden': 'true' });
    dots.appendChild(el('span')); dots.appendChild(el('span')); dots.appendChild(el('span'));
    this.log.appendChild(dots);
    this.scroll();
    this.status.textContent = 'The guide is working: searching the book and writing an answer.';
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: this.payload(), credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return { ok: false, message: 'The guide is offline: the server did not answer.' }; }); })
      .catch(function () { return { ok: false, message: 'The guide is offline: the network call failed.' }; })
      .then(function (d) {
        dots.remove();
        self.busy = false;
        self.status.textContent = '';
        var m;
        if (d.ok && typeof d.reply === 'string' && d.reply) {
          m = { role: 'assistant', content: d.reply, cites: d.cites || [], notCovered: d.not_covered || '', clarify: !!d.clarify, trace: d.trace || [], pages: d.pages || [], handoff: d.handoff || null, calls: d.calls || [] };
        } else {
          var msg = d.message || d.error || 'The guide could not answer.';
          if (d.retry_at) {
            try { msg += ' Back after ' + new Date(d.retry_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.'; } catch (e) { /* no locale support */ }
          }
          m = { role: 'assistant', kind: 'site', content: msg, trace: d.trace || [], calls: d.calls || [] };
          // The visitor's message got no answer; drop it from what the model sees next time.
          var last = self.s.messages[self.s.messages.length - 1];
          if (last && last.role === 'user') last.unanswered = true;
        }
        self.s.messages.push(m);
        if (d.actions || !d.ok) self.s.actions = true;
        if (d.done) self.s.done = true;
        self.save();
        var old = self.log.querySelector('.guide-actions');
        if (old) old.remove();
        var b = self.renderMessage(m);
        if (self.s.actions) self.actions();
        self.lock();
        if (!self.input.disabled) self.input.focus();
        else { b.setAttribute('tabindex', '-1'); b.focus(); }
      });
  };

  Guide.prototype.actions = function () {
    var row = el('div', { class: 'guide-actions', role: 'group', 'aria-label': 'Next steps' });
    row.appendChild(el('a', { class: 'btn btn-primary', href: '/speaking/#advisory' }, 'Talk with Hemanth'));
    row.appendChild(el('a', { class: 'btn btn-ghost', href: '/speaking/#speaking' }, 'Invite him to speak'));
    var book = el('a', { class: 'btn btn-ghost ext', href: AMAZON, rel: 'noopener', target: '_blank' }, 'Get the book');
    book.appendChild(el('span', { class: 'visually-hidden' }, ' on Amazon (opens in a new tab)'));
    row.appendChild(book);
    this.log.appendChild(row);
    this.scroll();
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
    if (embed) { e.preventDefault(); var g = embed.querySelector('textarea'); if (g) g.focus(); return; }
    if (!canModal || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    opener = t;
    openDialog();
  });
})();
