/* Simulate your process: the visitor's own flow against the book's agent-run flow, in the workflows player.
   Mode A builds the flow step by step (no network). Mode B sends a description to /api/simulate, which drafts the
   same step JSON with an AI model; the draft loads into the editor to be checked before it runs. Counts come from
   the step data only (AE.flowStats); waits are animation pacing, not time. Load after blueprints.js and sim-core.js. */
(function () {
  'use strict';
  var AE = window.AE;
  if (!AE || !AE.sim || !AE.ui || !AE.workflows) return;
  var U = AE.ui, S = AE.sim, $ = U.$, $$ = U.$$, esc = U.esc, el = U.el, btn = U.btn, sv = U.sv;
  var QWAIT = 1200;
  function lvl(n) { return n == null ? 'Rule' : 'L' + n; }
  function opt(v, t, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(t) + '</option>'; }
  function uniq(a) { var s = {}; return a.filter(function (x) { if (s[x]) return false; s[x] = 1; return true; }); }

  function mount(root) {
    var st = { flow: S.fromTemplate(AE.workflows[0].id), dirty: false, mode: 'build', busy: false };
    var run = 0;
    root.innerHTML =
      '<div class="sim-modes wf-view" role="group" aria-label="How to start"></div>' +
      '<div class="sim-ai" hidden><label class="sim-label" for="sim-text">Describe your process today</label>' +
      '<textarea id="sim-text" class="sim-text" rows="5" maxlength="' + S.MAX_TEXT + '" aria-describedby="sim-count sim-notice" placeholder="For example: Customers email disputes to a shared inbox. A clerk finds the invoice, emails sales for approval, then keys a credit memo by hand and emails the customer."></textarea>' +
      '<div class="sim-ai-row"><p id="sim-count" class="sim-count">0 / ' + S.MAX_TEXT.toLocaleString('en-US') + ' characters</p>' +
      '<button type="button" class="btn btn-primary sim-draft">Draft my flow</button></div>' +
      '<p id="sim-notice" class="fw-note sim-notice">Your text is sent to an AI model to draft the flow. Nothing is saved.</p></div>' +
      '<p class="sim-msg" role="status" aria-live="polite"></p>' +
      '<div class="sim-build"><div class="sim-tplrow"><label class="sim-label">Closest book workflow <select class="sim-tpl">' +
      S.templates().map(function (t) { return opt(t.id, t.short, st.flow.template); }).join('') + '</select></label>' +
      '<button type="button" class="btn btn-ghost sim-reset">Start from its today flow</button></div>' +
      '<p class="sim-help">Your process today, in order. Up to ' + S.MAX_STEPS + ' steps. For each step: where it happens, how the work reaches it, and whether a person does or approves it.</p>' +
      '<ol class="dz-steps sim-steps"></ol>' +
      '<div class="btn-row sim-btns"><button type="button" class="btn btn-dark sim-add">Add a step</button><button type="button" class="btn btn-primary sim-run">Run side by side</button></div>' +
      '<p class="sim-live" aria-live="polite"></p></div>' +
      '<div class="sim-out" hidden><p class="wf-both-cap"><b>Your process</b> <span>As you described it.</span></p>' +
      '<div class="sl-wrap sim-sl-you" tabindex="0" role="region" aria-label="Your process swimlane"></div>' +
      '<p class="wf-both-cap wf-both-re"><b>Agent-run</b> <span class="sim-re-cap"></span></p>' +
      '<div class="sl-wrap sim-sl-re" tabindex="0" role="region" aria-label="Agent-run swimlane"></div>' +
      '<p class="fw-note wf-pace"><span class="wf-pace-k" aria-hidden="true"></span> The clock marks a queue wait: a hand-off by hand, email or scheduled file. Waits are illustrative pacing (animation speed, not real time).</p>' +
      '<div class="lr-console wf-console"><div class="lr-bar"><span></span><span></span><span></span><b>Case console &middot; your process</b></div><ol class="wf-log sim-log" aria-live="polite"></ol><div class="wf-result sim-result" aria-live="polite"></div></div>' +
      '<div class="btn-row"><button type="button" class="btn btn-dark sim-again">Run again</button><button type="button" class="btn btn-ghost sim-edit">Edit my steps</button></div></div>';

    var modes = $('.sim-modes', root), ai = $('.sim-ai', root), msg = $('.sim-msg', root), tpl = $('.sim-tpl', root), ol = $('.sim-steps', root);
    var live = $('.sim-live', root), out = $('.sim-out', root), text = $('.sim-text', root), count = $('#sim-count', root), draftBtn = $('.sim-draft', root);
    var hostY = $('.sim-sl-you', root), hostR = $('.sim-sl-re', root), log = $('.sim-log', root), result = $('.sim-result', root), pair = null;

    [['build', 'Build step by step'], ['ai', 'Describe in words (AI)']].forEach(function (m) {
      var b = btn(m[1], 'seg', { 'aria-pressed': String(m[0] === st.mode), 'data-m': m[0] });
      b.addEventListener('click', function () { setMode(m[0]); });
      modes.appendChild(b);
    });
    function setMode(m) {
      st.mode = m;
      $$('button', modes).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === m)); });
      ai.hidden = m !== 'ai';
      if (m === 'ai') text.focus();
    }
    function say(t, kind) { msg.textContent = t || ''; msg.className = 'sim-msg' + (kind ? ' sim-msg-' + kind : ''); }

    /* ---------- Editor ---------- */
    function sel(k, opts, v, label, disabled) {
      return '<label>' + label + ' <select data-k="' + k + '"' + (disabled ? ' disabled' : '') + '>' + opts.map(function (o) { return opt(o[0], o[1], v); }).join('') + '</select></label>';
    }
    function chk(k, label, v, disabled) {
      return '<label class="dz-chk"><input type="checkbox" data-k="' + k + '"' + (v ? ' checked' : '') + (disabled ? ' disabled' : '') + '> ' + label + '</label>';
    }
    function editor(focus) {
      ol.innerHTML = '';
      var n = st.flow.steps.length;
      st.flow.steps.forEach(function (s, i) {
        var li = el('li', 'dz-step sim-step'), num = i + 1, outside = s.lane === 'outside';
        li.innerHTML = '<div class="dz-row1"><span class="dz-n" aria-hidden="true">' + String(num).padStart(2, '0') + '</span>' +
          '<label class="dz-name">Step ' + num + ' <input type="text" data-k="name" value="' + esc(s.name) + '" maxlength="' + S.NAME_MAX + '"></label>' +
          '<div class="dz-move"><button type="button" data-a="up" aria-label="Move step ' + num + ' up"' + (i === 0 ? ' disabled' : '') + '>&uarr;</button>' +
          '<button type="button" data-a="down" aria-label="Move step ' + num + ' down"' + (i === n - 1 ? ' disabled' : '') + '>&darr;</button>' +
          '<button type="button" data-a="del" aria-label="Remove step ' + num + '"' + (n <= S.MIN_STEPS ? ' disabled' : '') + '>&times;</button></div></div>' +
          '<div class="dz-fields">' + sel('lane', S.LANES, s.lane, 'Where it happens') +
          sel('via', i === 0 ? [['none', 'Start of the process']] : S.VIA, s.via, 'How the work reaches it', i === 0) + '</div>' +
          '<div class="dz-checks">' + chk('person', 'A person does or checks it', s.person, outside) + chk('approval', 'It is an approval', s.approval, outside) +
          (i > 0 ? chk('exception', 'Only when something goes wrong', s.exception) : '') + '</div>';
        $$('[data-k]', li).forEach(function (inp) {
          inp.addEventListener(inp.type === 'text' ? 'input' : 'change', function () {
            var k = inp.dataset.k, patch = {};
            patch[k] = inp.type === 'checkbox' ? inp.checked : inp.value;
            st.flow = S.update(st.flow, i, patch); st.dirty = true;
            if (k === 'lane' || k === 'approval' || k === 'person') editor({ i: i, k: k }); else summary();
          });
        });
        $$('[data-a]', li).forEach(function (b) {
          b.addEventListener('click', function () {
            var a = b.dataset.a, to = i;
            if (a === 'up') { st.flow = S.move(st.flow, i, -1); to = i - 1; }
            if (a === 'down') { st.flow = S.move(st.flow, i, 1); to = i + 1; }
            if (a === 'del') { st.flow = S.remove(st.flow, i); to = Math.min(i, st.flow.steps.length - 1); }
            st.dirty = true;
            editor(a === 'del' ? { i: to, k: 'name' } : { i: to, a: a });
            say(a === 'del' ? 'Step ' + (i + 1) + ' removed.' : 'Step moved to position ' + (to + 1) + '.');
          });
        });
        ol.appendChild(li);
      });
      $('.sim-add', root).disabled = n >= S.MAX_STEPS;
      if (focus) {
        var row = ol.children[focus.i], target = row && (focus.a ? $('[data-a="' + focus.a + '"]', row) : $('[data-k="' + focus.k + '"]', row));
        if (target && target.disabled) target = $('[data-k="name"]', row);
        if (target) target.focus();
      }
      summary();
    }
    // Share the step counts with the hours panel (vz.js): your process and the book's agent-run flow.
    function emitCounts() {
      var wf = S.byId(st.flow.template);
      if (!wf) return;
      AE.simCounts = { a: S.stats(st.flow), b: AE.flowStats(wf.steps), name: wf.short };
      document.dispatchEvent(new CustomEvent('ae:sim-counts'));
    }
    function summary() {
      emitCounts();
      var f = S.stats(st.flow);
      live.innerHTML = '<b>' + f.steps + ' main-path ' + (f.steps === 1 ? 'step' : 'steps') + '</b>, ' + f.waits + ' queue ' + (f.waits === 1 ? 'wait' : 'waits') + ', ' + f.touches + ' person ' + (f.touches === 1 ? 'touch' : 'touches') + ' so far.';
    }
    function loadTemplate(id) {
      st.flow = S.fromTemplate(id); st.dirty = false; tpl.value = st.flow.template; editor();
    }
    tpl.addEventListener('change', function () {
      if (!st.dirty) { loadTemplate(tpl.value); say('Loaded the book\u2019s today flow for ' + S.byId(tpl.value).short + '. Edit it to match yours.'); return; }
      st.flow = { template: tpl.value, steps: st.flow.steps }; summary();
      say('Your steps are unchanged; they will be compared with the agent-run flow for ' + S.byId(tpl.value).short + '.');
    });
    $('.sim-reset', root).addEventListener('click', function () { loadTemplate(tpl.value); say('Loaded the book\u2019s today flow for ' + S.byId(tpl.value).short + '.'); });
    $('.sim-add', root).addEventListener('click', function () {
      if (st.flow.steps.length >= S.MAX_STEPS) return;
      st.flow = S.add(st.flow); st.dirty = true; editor({ i: st.flow.steps.length - 1, k: 'name' });
      say('Step ' + st.flow.steps.length + ' added.');
    });

    /* ---------- Mode B: AI draft ---------- */
    text.addEventListener('input', function () { count.textContent = text.value.length.toLocaleString('en-US') + ' / ' + S.MAX_TEXT.toLocaleString('en-US') + ' characters'; });
    draftBtn.addEventListener('click', function () {
      var t = text.value.trim();
      if (t.length < 20) { say('Describe your process in a sentence or two: who does what, in order.', 'warn'); text.focus(); return; }
      if (st.busy) return;
      st.busy = true; draftBtn.disabled = true; draftBtn.textContent = 'Drafting\u2026'; say('Drafting your flow\u2026');
      fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'draft', text: t.slice(0, S.MAX_TEXT) }) })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (d) {
          var n = d && d.ok ? S.normalize(d.draft) : null;
          if (n && n.ok) {
            st.flow = n.flow; st.dirty = true; tpl.value = n.flow.template;
            setMode('build'); editor({ i: 0, k: 'name' });
            say('Draft loaded: ' + n.flow.steps.length + ' steps, compared with ' + S.byId(n.flow.template).short + '. Check each step, then run side by side.', 'ok');
          } else {
            setMode('build');
            say((d && (d.message || d.error)) || 'The AI draft is not available right now. You can still build your flow step by step below.', 'warn');
          }
        })
        .catch(function () { setMode('build'); say('The AI draft is not available right now. You can still build your flow step by step below.', 'warn'); })
        .then(function () { st.busy = false; draftBtn.disabled = false; draftBtn.textContent = 'Draft my flow'; });
    });

    /* ---------- Run side by side ---------- */
    function draw() {
      var wf = S.byId(st.flow.template), you = S.toSteps(st.flow);
      $('.sim-re-cap', root).textContent = 'The book\u2019s ' + wf.short.toLowerCase() + ' flow: agents act within limits; people approve exceptions.';
      function one(h, ss, key, name) {
        var ch = U.chainOf(ss);
        var api = U.drawSwimlane(h, ss, { weak: ch.weak.map(function (x) { return x.id; }), key: key, label: name, lanes: uniq(ss.map(function (s) { return s.lane; })), compact: true, queues: true, keepLast: true });
        api.ring = sv('circle', { r: 17, class: 'tok-wait', cx: -40, cy: -40 }, api.svg);
        api.tok = sv('circle', { r: 10, class: 'tok', cx: -30, cy: -30 }, api.svg);
        return api;
      }
      pair = { you: { api: one(hostY, you, 'simy', 'Your process'), host: hostY, steps: you, name: 'Your process', re: false },
        re: { api: one(hostR, wf.steps, 'simr', 'Agent-run, ' + wf.short), host: hostR, steps: wf.steps, name: 'Agent-run', re: true } };
    }
    function line(cls, html) { var li = el('li', cls, html); log.appendChild(li); log.scrollTop = log.scrollHeight; }
    function stepLine(F, s) { line('wf-l-step', '<b>' + F.name + ' &middot; ' + String(F.steps.indexOf(s) + 1).padStart(2, '0') + ' ' + esc(U.laneName[s.lane]) + ' &middot; ' + lvl(s.lvl) + '</b><span>' + esc(F.re ? s.log : s.name) + '</span>'); }
    function waitLine(F, s) {
      var how = F.re ? U.handoffName[s.ho].toLowerCase() : s.via === 'email' ? 'email' : s.via === 'file' ? 'scheduled file' : 'by-hand';
      line('wf-l-warn', '<b>' + F.name + ' &middot; queue wait</b><span>Waits on ' + (how === 'email' ? 'an' : 'a') + ' ' + esc(how) + ' hand-off into step ' + String(F.steps.indexOf(s) + 1).padStart(2, '0') + '.</span>');
    }
    function finish(F) {
      var main = F.steps.filter(function (s) { return !s.ex; }), last = main[main.length - 1], p = F.api.pos[last.id];
      main.forEach(function (s) { var g = $('.sl-step[data-id="' + s.id + '"]', F.api.svg); g.classList.add('done'); if (AE.isQueueWait(s)) g.classList.add('waited'); });
      F.api.tok.setAttribute('cx', p.cx); F.api.tok.setAttribute('cy', p.cy);
    }
    async function runFlow(F, isLive) {
      var main = F.steps.filter(function (s) { return !s.ex; }), prev = null, prevPos = null, api = F.api;
      for (var i = 0; i < main.length; i++) {
        var s = main[i], p = api.pos[s.id], g = $('.sl-step[data-id="' + s.id + '"]', api.svg);
        g.classList.add('cur');
        if (!api.fit) U.follow(F.host, p.cx + api.lw - F.host.clientWidth / 2);
        var via = U.laneVia(prevPos, p);
        await U.moveToken(api.tok, prev, [p.cx, p.cy], via ? 700 : 550, isLive, via); if (!isLive()) return;
        prev = [p.cx, p.cy]; prevPos = p;
        if (AE.isQueueWait(s)) {
          api.ring.setAttribute('cx', p.cx); api.ring.setAttribute('cy', p.cy); api.ring.classList.add('on'); g.classList.add('waiting');
          waitLine(F, s);
          await U.wait(QWAIT); if (!isLive()) return;
          api.ring.classList.remove('on'); g.classList.remove('waiting'); g.classList.add('waited');
        }
        stepLine(F, s);
        await U.wait(260); if (!isLive()) return;
        g.classList.remove('cur'); g.classList.add('done');
      }
    }
    function showResult() {
      result.innerHTML = '<div class="lr-result lr-r-post wf-cmp"><b>Your process and the agent-run flow</b><span>' + esc(S.compareLine(st.flow)) +
        ' A person touch is a main-path step at L0 to L2. Counts come from the step data; waits are illustrative pacing (animation speed, not real time).</span></div>';
    }
    async function go() {
      var n = S.normalize(st.flow);
      if (!n.ok) { say('Give your process at least ' + S.MIN_STEPS + ' named steps first.', 'warn'); return; }
      st.flow = n.flow;
      var my = ++run; function isLive() { return my === run; }
      out.hidden = false; draw(); log.innerHTML = ''; result.innerHTML = '';
      U.placeBelowHeader(out);
      var A = pair.you, B = pair.re;
      if (U.reduced()) {
        [A, B].forEach(function (F) { finish(F); F.steps.filter(function (s) { return !s.ex; }).forEach(function (s) { if (AE.isQueueWait(s)) waitLine(F, s); stepLine(F, s); }); });
        showResult(); return;
      }
      await Promise.all([runFlow(A, isLive), runFlow(B, isLive)]); if (!isLive()) return;
      showResult();
    }
    $('.sim-run', root).addEventListener('click', go);
    $('.sim-again', root).addEventListener('click', go);
    $('.sim-edit', root).addEventListener('click', function () { run++; var f = $('[data-k="name"]', ol); if (f) { U.placeBelowHeader(ol); f.focus(); } });
    editor();
  }

  $$('[data-sim]').forEach(function (n) {
    try { mount(n); var w = n.closest('.bp-ix'); if (w) w.hidden = false; } catch (e) { if (window.console) console.error(e); }
  });
})();
