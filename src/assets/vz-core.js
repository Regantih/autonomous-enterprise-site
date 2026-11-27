/* Visuals and "Today vs Transformed" calculators: the pure model. No DOM.
   Every effect comes from (a) a figure in The Autonomous Enterprise, cited to its chapter, (b) a step count already on
   the site, or (c) a parameter the visitor sets. Defaults the book does not give are marked src: 'you'.
   Computed in the browser; nothing is stored or sent. */
(function (w) {
  'use strict';
  var AE = w.AE = w.AE || {};
  var YOU = 'you'; // a parameter the visitor sets; shown as "Illustrative default. Set your own."

  var CURRENCIES = [['USD', '$'], ['EUR', '\u20ac'], ['GBP', '\u00a3'], ['INR', '\u20b9'], ['JPY', '\u00a5'], ['XXX', '\u00a4']];
  function sym(cur) { for (var i = 0; i < CURRENCIES.length; i++) if (CURRENCIES[i][0] === cur) return CURRENCIES[i][1]; return '$'; }

  function num(n, d) {
    if (!isFinite(n)) return '\u2013';
    d = d == null ? (Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2) : d;
    var s = Math.abs(n).toFixed(d).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (s[1] && /^0+$/.test(s[1])) s.length = 1;
    return (n < 0 ? '-' : '') + s.join('.');
  }
  // Large sums as 2.2M / 94k; small sums with cents.
  function money(n, cur) {
    var a = Math.abs(n), p = n < 0 ? '-' : '', s = sym(cur || 'USD');
    if (!isFinite(n)) return '\u2013';
    if (a === 0) return s + '0';
    if (a >= 1e9) return p + s + num(a / 1e9, 2) + 'B';
    if (a >= 1e6) return p + s + num(a / 1e6, a >= 1e7 ? 1 : 2) + 'M';
    if (a >= 1e4) return p + s + num(a / 1e3, 0) + 'k';
    if (a >= 100) return p + s + num(a, 0);
    return p + s + a.toFixed(2);
  }
  function fmt(v, unit, cur) {
    if (unit === 'money') return money(v, cur);
    if (unit === 'pct') return num(v, v % 1 ? 1 : 0) + '%';
    if (unit === 'h') return num(v, v >= 100 ? 0 : 1) + ' h';
    if (unit === 'min') return num(v, v % 1 ? 1 : 0) + ' min';
    if (unit === 'days') return num(v, v % 1 && v < 10 ? 2 : v % 1 ? 1 : 0) + (v === 1 ? ' day' : ' days');
    if (unit === 'fte') return num(v, 1) + ' FTE';
    if (unit === 'people') return num(v, 1);
    return num(v);
  }
  function clamp(v, inp) {
    v = +v;
    if (!isFinite(v)) return inp.def;
    return Math.min(inp.max, Math.max(inp.min, v));
  }
  // "Add your own details": blank means the book default applies (null); a number replaces it.
  function own(x, inp) {
    if (x == null || x === '' || !isFinite(+x)) return null;
    return Math.min(inp.max, Math.max(inp.min, +x));
  }
  function set(x) { return x != null; }
  // Row basis tag: the book default with its chapter, or the visitor's own figure.
  function basis(yours, ch) { return yours ? 'you' : ch; }
  function values(spec, raw) {
    var v = {};
    raw = raw || {};
    spec.inputs.forEach(function (i) { v[i.k] = clamp(raw[i.k] == null ? i.def : raw[i.k], i); });
    (spec.own || []).forEach(function (i) { v[i.k] = own(raw[i.k], i); });
    v.cur = sym(raw.cur) && CURRENCIES.some(function (c) { return c[0] === raw.cur; }) ? raw.cur : 'USD';
    return v;
  }

  /* ---------- 1. Exception cost (Ch 21.13.3) ---------- */
  var EXCEPTIONS = {
    id: 'exc', title: 'Your exception cost: today and transformed',
    caseWord: 'cases',
    inputs: [
      { k: 'n', label: 'Cases a year (invoices, orders, claims)', unit: 'num', min: 1000, max: 5000000, step: 1000, def: 900000, src: 'Ch 21.13.3' },
      { k: 'e', label: 'Share of cases that raise an exception', unit: 'pct', min: 1, max: 60, step: 0.5, def: 12, src: 'Ch 21.13.3' },
      { k: 't', label: 'Person minutes per exception today', unit: 'min', min: 1, max: 240, step: 1, def: 20, src: 'Ch 21.13.3' },
      { k: 'fte', label: 'Loaded cost per person-year', unit: 'money', min: 5000, max: 400000, step: 1000, def: 110000, src: 'Hours bases' },
      { k: 'hrs', label: 'Productive hours per person-year', unit: 'h', min: 1000, max: 2400, step: 10, def: 1800, src: 'Hours bases' },
      { k: 'a', label: 'Share of exceptions agents resolve', unit: 'pct', min: 0, max: 95, step: 1, def: 50, src: YOU },
      { k: 'ca', label: 'Cost per resolution by an agent', unit: 'money', min: 0, max: 20, step: 0.05, def: 0.5, src: 'Ch 21.13.3' }
    ],
    own: [
      { k: 'drop', label: 'Your expected fall in the exception rate', unit: 'pct', min: 0, max: 95, step: 1, src: 'Ch 21.13.3', book: 'no fall: agents resolve exceptions, they do not remove them' },
      { k: 'rw', label: 'Share of exceptions worked twice (rework)', unit: 'pct', min: 0, max: 100, step: 1, src: 'Ch 21.13.3', book: 'no rework' }
    ],
    compute: function (v) {
      var n = v.n, e = v.e / 100, a = v.a / 100, t = v.t, wpm = v.fte / v.hrs / 60, ca = v.ca;
      var drop = set(v.drop) ? v.drop / 100 : 0, k = 1 + (set(v.rw) ? v.rw / 100 : 0);
      var ex = n * e, exR = ex * (1 - drop);
      var unitToday = t * wpm, unitRe = (1 - a) * t * wpm + a * ca;
      var hT = ex * k * t / 60, hR = exR * k * (1 - a) * t / 60;
      var dE = n * 0.01 * k * unitRe, dA = exR * k * 0.01 * (ca - t * wpm);
      var f = [
        'Cost per minute w = loaded cost \u00f7 productive hours \u00f7 60 = ' + num(wpm, 2) + '.',
        'Cost C = N \u00d7 e \u00d7 [ (1 \u2212 a) \u00d7 t \u00d7 w + a \u00d7 c_a ]. Today a = 0. (Book, Ch 21.13.3)',
        'Hours = N \u00d7 e \u00d7 (1 \u2212 a) \u00d7 t \u00f7 60. People = hours \u00f7 productive hours.',
        'One more point of exception rate: N \u00d7 1% \u00d7 [ (1 \u2212 a) \u00d7 t \u00d7 w + a \u00d7 c_a ]. One more point of agent share: N \u00d7 e \u00d7 1% \u00d7 (c_a \u2212 t \u00d7 w).'
      ];
      if (set(v.drop)) f.push('Your figure: transformed exceptions = N \u00d7 e \u00d7 (1 \u2212 ' + num(v.drop) + '%). The book default keeps them the same.');
      if (set(v.rw)) f.push('Your figure: every exception is worked (1 + ' + num(v.rw) + '%) times. Cost, hours and levers are multiplied by ' + num(k, 2) + ' on both sides.');
      return {
        rows: [
          { label: 'Exceptions a year', today: ex, re: exR, unit: 'num', basis: basis(set(v.drop), 'Ch 21.13.3'), note: 'Same exceptions: agents resolve them, they do not remove them.' },
          { label: 'Exception cost a year', today: ex * k * unitToday, re: exR * k * unitRe, unit: 'money', key: true, basis: basis(set(v.drop) || set(v.rw), 'Ch 21.13.3') },
          { label: 'Person hours a year', today: hT, re: hR, unit: 'h' },
          { label: 'People on exceptions', today: hT / v.hrs, re: hR / v.hrs, unit: 'fte' },
          { label: 'Cost per exception', today: unitToday, re: unitRe, unit: 'money' }
        ],
        levers: { exceptionPoint: dE, autonomyPoint: dA, ratio: dA ? Math.abs(dE / dA) : Infinity, hoursPerExceptionPoint: n * 0.01 * k * (1 - a) * t / 60 },
        perMinute: wpm,
        formula: f
      };
    }
  };

  /* ---------- 2. The exception queue: people today and with agents (Ch 25.3.6) ---------- */
  var QUEUE = {
    id: 'queue', title: 'Your exception queue: people today and with agents',
    inputs: [
      { k: 'n', label: 'Cases a year', unit: 'num', min: 1000, max: 5000000, step: 1000, def: 900000, src: 'Ch 24.7.9' },
      { k: 'e', label: 'Share of cases that raise an exception', unit: 'pct', min: 1, max: 60, step: 0.5, def: 12, src: 'Ch 24.7.9' },
      { k: 'days', label: 'Working days a year', unit: 'days', min: 150, max: 365, step: 1, def: 250, src: 'Ch 25.3.6' },
      { k: 't', label: 'Person minutes per exception today', unit: 'min', min: 1, max: 240, step: 1, def: 20, src: 'Ch 25.3.6' },
      { k: 'ho', label: 'Share the agent hands to a person', unit: 'pct', min: 0, max: 100, step: 1, def: 25, src: YOU, note: 'The book\u2019s example uses 25% (Ch 25.3.6).' },
      { k: 'th', label: 'Person minutes per hand-off', unit: 'min', min: 1, max: 240, step: 1, def: 12, src: 'Ch 25.3.6' },
      { k: 'ph', label: 'Productive hours per person per day', unit: 'h', min: 4, max: 10, step: 0.5, def: 7, src: 'Ch 25.3.6' },
      { k: 'fte', label: 'Loaded cost per person-year', unit: 'money', min: 5000, max: 400000, step: 1000, def: 110000, src: 'Hours bases' }
    ],
    own: [
      { k: 'rw', label: 'Share of exceptions worked twice (rework)', unit: 'pct', min: 0, max: 100, step: 1, src: 'Ch 25.3.6', book: 'no rework' },
      { k: 'q', label: 'Separate queues (regions or entities)', unit: 'num', min: 1, max: 200, step: 1, src: 'Ch 25.3.6', book: 'one shared queue, fractional people' },
      { k: 'prem', label: 'Overtime and contractor premium on queue time', unit: 'pct', min: 0, max: 200, step: 1, src: 'Hours bases', book: 'no premium' }
    ],
    compute: function (v) {
      var k = 1 + (set(v.rw) ? v.rw / 100 : 0), cost = v.fte * (1 + (set(v.prem) ? v.prem / 100 : 0));
      var perDay = v.n * v.e / 100 / v.days, handed = perDay * v.ho / 100;
      var hT = perDay * k * v.t / 60, hR = handed * k * v.th / 60;
      // Separate queues cannot share people: each queue rounds up to whole people.
      function ppl(h) { return set(v.q) ? v.q * Math.ceil(h / v.q / v.ph - 1e-9) : h / v.ph; }
      var pT = ppl(hT), pR = ppl(hR);
      var f = [
        'Exceptions a day = cases \u00d7 exception share \u00f7 working days.',
        'Today: hours = exceptions a day \u00d7 minutes \u00f7 60. With agents: hours = exceptions a day \u00d7 hand-off share \u00d7 hand-off minutes \u00f7 60.',
        'People = hours \u00f7 productive hours a day. Book example: 432 a day \u00d7 20 min \u2248 20 people; 108 hand-offs \u00d7 12 min \u2248 3 supervisors. (Ch 25.3.6)',
        'Released hours become savings only when roles change: by attrition, redeployment or avoided hiring. (Ch 01.9.1)'
      ];
      if (set(v.rw)) f.push('Your figure: hours are multiplied by (1 + ' + num(v.rw) + '% rework) = ' + num(k, 2) + ' on both sides.');
      if (set(v.q)) f.push('Your figure: people = ' + num(v.q) + ' queues \u00d7 round up (hours \u00f7 ' + num(v.q) + ' \u00f7 productive hours a day).');
      if (set(v.prem)) f.push('Your figure: cost = people \u00d7 loaded cost \u00d7 (1 + ' + num(v.prem) + '% premium).');
      var mine = set(v.rw) || set(v.q);
      return {
        rows: [
          { label: 'Exceptions a day', today: perDay, re: perDay, unit: 'num' },
          { label: 'Exceptions that reach a person each day', today: perDay, re: handed, unit: 'num' },
          { label: 'Person hours a day', today: hT, re: hR, unit: 'h', basis: basis(set(v.rw), 'Ch 25.3.6') },
          { label: 'People needed on the queue', today: pT, re: pR, unit: 'people', key: true, basis: basis(mine, 'Ch 25.3.6') },
          { label: 'Cost of those people a year', today: pT * cost, re: pR * cost, unit: 'money', basis: basis(mine || set(v.prem), 'Ch 25.3.6') }
        ],
        formula: f
      };
    }
  };

  /* ---------- 3. One order, 2026 vs month 30 (Ch 30.5) ---------- */
  var ORDER_BOOK = { touchesT: 31, touchesR: 3, hoursT: 15.5, minutesR: 35, cashT: 140, cashR: 73, disputeT: 38, disputeR: 1, serveT: 1093, serveR: 51, rate: 64 };
  var ORDER = {
    id: 'order', title: 'The capstone order at your volume',
    inputs: [
      { k: 'n', label: 'Orders a year like this one', unit: 'num', min: 10, max: 1000000, step: 10, def: 2000, src: YOU },
      { k: 'rate', label: 'Loaded cost per person-hour', unit: 'money', min: 5, max: 300, step: 1, def: 64, src: 'Ch 30.5.2' },
      { k: 's', label: 'Share of orders that run the month-30 way', unit: 'pct', min: 0, max: 100, step: 5, def: 100, src: YOU }
    ],
    own: [
      { k: 'hT', label: 'Your person hours per order today', unit: 'h', min: 0.1, max: 500, step: 0.1, src: 'Ch 30.5.2', book: '15.5 hours' },
      { k: 'cut', label: 'Your expected cut in person hours per order', unit: 'pct', min: 0, max: 99, step: 1, src: 'Ch 30.5.2', book: '15.5 hours to about 35 minutes, about 96%' },
      { k: 'cT', label: 'Your order-to-cash days today', unit: 'days', min: 1, max: 365, step: 1, src: 'Ch 30.5.1', book: '140 days' },
      { k: 'cR', label: 'Your target order-to-cash days', unit: 'days', min: 0.5, max: 365, step: 0.5, src: 'Ch 30.5.1', book: '140 to 73 days, ratio 0.52' }
    ],
    compute: function (v) {
      var B = ORDER_BOOK, s = v.s / 100;
      var perT = set(v.hT) ? v.hT : B.hoursT;
      var perR = set(v.cut) ? perT * (1 - v.cut / 100) : perT * (B.minutesR / 60) / B.hoursT;
      var hT = v.n * perT, hR = v.n * (s * perR + (1 - s) * perT);
      var tT = v.n * B.touchesT, tR = v.n * (s * B.touchesR + (1 - s) * B.touchesT);
      var cT = set(v.cT) ? v.cT : B.cashT, cR = set(v.cR) ? v.cR : cT * B.cashR / B.cashT, myCash = set(v.cT) || set(v.cR);
      var myH = set(v.hT) || set(v.cut);
      var f = [
        'Book, per order: 31 person touches and 15.5 hours in 2026; 3 gates and about 35 minutes at month 30. (Ch 30.5.2)',
        'Hours a year = orders \u00d7 [ share \u00d7 35 \u00f7 60 + (1 \u2212 share) \u00d7 15.5 ]. Cost = hours \u00d7 your hourly cost.',
        'Day counts are the book\u2019s one order and do not scale with volume: 140 to 73 days, dispute 38 to 1 day. (Ch 30.5.1)',
        'Your orders are not the book\u2019s order. Use the per-order figures as a scale, not a forecast.'
      ];
      if (myH) f.push('Your figure: hours per order today = ' + num(perT) + '; after = ' + (set(v.cut) ? num(perT) + ' \u00d7 (1 \u2212 ' + num(v.cut) + '%)' : num(perT) + ' \u00d7 the book ratio (35 min \u00f7 15.5 h)') + ' = ' + num(perR, 2) + ' hours.');
      if (myCash) f.push('Your figure: order to cash today = ' + num(cT) + ' days; after = ' + (set(v.cR) ? 'your target' : num(cT) + ' \u00d7 73 \u00f7 140 (book ratio)') + ' = ' + num(cR, 1) + ' days.');
      return {
        rows: [
          { label: 'Person touches a year', today: tT, re: tR, unit: 'num', basis: 'Ch 30.5.2' },
          { label: 'Person hours a year', today: hT, re: hR, unit: 'h', basis: basis(myH, 'Ch 30.5.2') },
          { label: 'Cost of person time a year', today: hT * v.rate, re: hR * v.rate, unit: 'money', key: true, basis: basis(myH, 'Ch 30.5.2') },
          { label: myCash ? 'Order to full cash (your order)' : 'Order to full cash (book order)', today: cT, re: cR, unit: 'days', fixed: !myCash, basis: basis(myCash, 'Ch 30.5.1') },
          { label: 'Dispute on the short payment (book order)', today: B.disputeT, re: B.disputeR, unit: 'days', fixed: true, basis: 'Ch 30.5.1' }
        ],
        formula: f
      };
    }
  };

  /* ---------- 4. Capacity and cycle time for an estate (Ch 01.9, Ch 21.13.2, Ch 30.5.1) ---------- */
  var RATIOS = { o2c: { label: 'Order to cash: 140 to 73 days (Ch 30.5.1)', r: 73 / 140 }, close: { label: 'Close: 9 to 5 days (Ch 01.9.2)', r: 5 / 9 } };
  var ESTATE = {
    id: 'estate', title: 'Your estate: today and transformed',
    inputs: [
      { k: 'fte', label: 'People in the processes you chose', unit: 'num', min: 1, max: 50000, step: 1, def: 400, src: 'Ch 01.9.2' },
      { k: 'cost', label: 'Loaded cost per person-year', unit: 'money', min: 5000, max: 400000, step: 1000, def: 110000, src: 'Ch 01.9.2' },
      { k: 'abs', label: 'Share of the work agents absorb by year 3', unit: 'pct', min: 0, max: 80, step: 1, def: 20, src: YOU, note: 'The book\u2019s Meridian sizing uses 20% (Ch 01.9.2).' },
      { k: 'cap', label: 'Share of released hours you turn into savings', unit: 'pct', min: 0, max: 100, step: 5, def: 50, src: YOU, note: 'Meridian realizes half, by attrition and avoided hiring (Ch 01.9.2).' },
      { k: 'cyc', label: 'Cycle time today, in days', unit: 'days', min: 0.5, max: 365, step: 0.5, def: 9, src: YOU },
      { k: 'sys', label: 'Systems a case touches today', unit: 'num', min: 1, max: 30, step: 1, def: 6, src: YOU },
      { k: 'sysT', label: 'Systems a case touches after', unit: 'num', min: 1, max: 30, step: 1, def: 4, src: YOU }
    ],
    own: [
      { k: 'tgt', label: 'Your target cycle time, in days', unit: 'days', min: 0.1, max: 365, step: 0.5, src: 'Ch 01.9.2', book: 'the book ratio you picked' },
      { k: 'ot', label: 'Overtime and contractor cost a year', unit: 'money', min: 0, max: 1000000000, step: 1000, src: 'Ch 01.9.1', book: 'none' },
      { k: 'sp', label: 'Cost added per extra system touched', unit: 'pct', min: 0, max: 50, step: 1, src: 'Ch 21.13.2', book: 'about 10%' }
    ],
    choice: { k: 'ratio', label: 'Cycle-time ratio to apply', def: 'close', options: RATIOS },
    compute: function (v) {
      var ot = set(v.ot) ? v.ot : 0, base = v.fte * v.cost + ot;
      var people = v.fte * v.abs / 100, gross = base * v.abs / 100, net = gross * v.cap / 100;
      var R = RATIOS[v.ratio] || RATIOS.close, ratio = R.r, dSys = v.sysT - v.sys;
      var pct = set(v.sp) ? v.sp / 100 : 0.1, sysFactor = Math.pow(1 + pct, dSys);
      var cycR = set(v.tgt) ? v.tgt : v.cyc * ratio, ch = v.ratio === 'o2c' ? 'Ch 30.5.1' : 'Ch 01.9.2';
      var f = [
        'Capacity = people \u00d7 loaded cost \u00d7 share absorbed. Saving = capacity \u00d7 share captured. (Ch 01.9.1)',
        'Capacity is not cost until you act on it: released hours become savings only by attrition, redeployment or avoided hiring. (Ch 01.9.1)',
        'Cycle time after = today \u00d7 the book ratio you picked. The book\u2019s ratios are one order and one close, not a forecast.',
        'Each system a case touches adds about 10% to cost in Meridian\u2019s illustrative regression: index = 100 \u00d7 1.1 ^ (systems after \u2212 systems today). (Ch 21.13.2)'
      ];
      if (set(v.ot)) f.push('Your figure: people cost = people \u00d7 loaded cost + overtime and contractors (' + money(ot, v.cur) + '). Capacity and saving use that total.');
      if (set(v.tgt)) f.push('Your figure: cycle time after = your target, ' + num(v.tgt) + ' days. It replaces the book ratio.');
      if (set(v.sp)) f.push('Your figure: index = 100 \u00d7 (1 + ' + num(v.sp) + '%) ^ (systems after \u2212 systems today). It replaces the book\u2019s 10%.');
      return {
        rows: [
          { label: 'People cost a year', today: base, re: base - net, unit: 'money', key: true, basis: basis(set(v.ot), 'Ch 01.9.2'), note: 'Only the captured share counts as a saving.' },
          { label: 'Capacity released (people)', today: 0, re: people, unit: 'people', higher: true },
          { label: 'Capacity released (value a year)', today: 0, re: gross, unit: 'money', higher: true, basis: basis(set(v.ot), 'Ch 01.9.2') },
          { label: set(v.tgt) ? 'Cycle time, your target' : 'Cycle time, at the book\u2019s ratio', today: v.cyc, re: cycR, unit: 'days', basis: basis(set(v.tgt), ch) },
          { label: 'Cost index from systems touched (today = 100)', today: 100, re: 100 * sysFactor, unit: 'num', basis: basis(set(v.sp), 'Ch 21.13.2') }
        ],
        formula: f
      };
    }
  };

  /* ---------- 5. Person hours from the simulator's step counts (workflows) ---------- */
  var TOUCH = {
    id: 'touch', title: 'Your hours: your process and the agent-run flow',
    inputs: [
      { k: 'n', label: 'Cases a year', unit: 'num', min: 10, max: 5000000, step: 10, def: 10000, src: YOU },
      { k: 'm', label: 'Minutes a person spends per touch', unit: 'min', min: 1, max: 240, step: 1, def: 15, src: YOU },
      { k: 'x', label: 'Share of cases that leave the main path', unit: 'pct', min: 0, max: 100, step: 1, def: 10, src: YOU },
      { k: 'rate', label: 'Loaded cost per person-hour', unit: 'money', min: 5, max: 300, step: 1, def: 64, src: 'Hours bases' }
    ],
    own: [
      { k: 'mB', label: 'Minutes per person touch in the agent-run flow', unit: 'min', min: 0.5, max: 240, step: 0.5, src: 'Hours bases', book: 'the same minutes as your process' },
      { k: 'rw', label: 'Share of touches redone (rework)', unit: 'pct', min: 0, max: 100, step: 1, src: 'Hours bases', book: 'no rework' }
    ],
    // counts: { a: flowStats of the visitor's process, b: flowStats of the book's agent-run flow }
    compute: function (v, counts) {
      counts = counts || { a: { touches: 0, exPeople: 0, handoffs: 0 }, b: { touches: 0, exPeople: 0, handoffs: 0 } };
      var k = 1 + (set(v.rw) ? v.rw / 100 : 0), mB = set(v.mB) ? v.mB : v.m;
      function hours(c, m) { return v.n * (c.touches + (c.exPeople ? v.x / 100 : 0)) * k * m / 60; }
      var hA = hours(counts.a, v.m), hB = hours(counts.b, mB), mine = set(v.mB) || set(v.rw);
      var f = [
          'Touch and hand-off counts come from the step data: your process and the book\u2019s agent-run flow.',
          'Hours = cases \u00d7 (person touches + exception share, if any exception path goes to a person) \u00d7 minutes per touch \u00f7 60.',
          'Hand-offs count every kind: an agent-run flow often has more, but they are system to system, not queue waits. Cost = hours \u00d7 your hourly cost. Every time input is yours; the book gives no minutes per touch for your process.'
        ];
      if (set(v.mB)) f.push('Your figure: the agent-run side uses ' + num(v.mB) + ' minutes per touch instead of your ' + num(v.m) + '.');
      if (set(v.rw)) f.push('Your figure: hours are multiplied by (1 + ' + num(v.rw) + '% rework) = ' + num(k, 2) + ' on both sides.');
      return {
        rows: [
          { label: 'Person touches per case (main path)', today: counts.a.touches, re: counts.b.touches, unit: 'num' },
          { label: 'Hand-offs per case (any kind)', today: counts.a.handoffs, re: counts.b.handoffs, unit: 'num', neutral: true },
          { label: 'Person hours a year', today: hA, re: hB, unit: 'h', basis: mine ? 'you' : null },
          { label: 'Cost of person time a year', today: hA * v.rate, re: hB * v.rate, unit: 'money', key: true, basis: mine ? 'you' : null }
        ],
        formula: f
      };
    }
  };

  /* ---------- 6. One AP clerk's time, today and after (Table 24.8, Ch 24.7.9) ---------- */
  var CLERK = [
    { task: 'Entry and validation of non-EDI invoices', cls: 'absorb', today: 25, after: 2 },
    { task: 'Three-way match, clean cases', cls: 'absorb', today: 15, after: 1 },
    { task: 'Price and quantity variances', cls: 'augment', today: 20, after: 12 },
    { task: 'Chasing missing goods receipts', cls: 'augment', today: 10, after: 4 },
    { task: 'Supplier queries', cls: 'augment', today: 15, after: 8 },
    { task: 'Duplicate checks; accrual support', cls: 'retain', today: 10, after: 8 },
    { task: 'Reviewing override reports', cls: 'new', today: 0, after: 6 },
    { task: 'Root causes; instruction proposals', cls: 'new', today: 0, after: 10 }
  ];
  function clerkTotals() {
    return CLERK.reduce(function (s, r) { s.today += r.today; s.after += r.after; return s; }, { today: 0, after: 0 });
  }
  function clerkTeam(team, hours) {
    var t = clerkTotals(), released = (t.today - t.after) / 100;
    return { released: released, hours: team * hours * released, people: team * released };
  }

  /* ---------- Share links: inputs live in the URL hash only ---------- */
  function encode(spec, v) {
    var parts = spec.inputs.filter(function (i) { return v[i.k] !== i.def; }).map(function (i) { return i.k + ':' + v[i.k]; });
    (spec.own || []).forEach(function (i) { if (set(v[i.k])) parts.push(i.k + ':' + v[i.k]); });
    if (spec.choice && v[spec.choice.k] !== spec.choice.def) parts.push(spec.choice.k + ':' + v[spec.choice.k]);
    if (v.cur && v.cur !== 'USD') parts.push('cur:' + v.cur);
    return 'vz-' + spec.id + '=' + parts.join(',');
  }
  function decode(spec, hash) {
    var m = String(hash || '').replace(/^#/, '').match(new RegExp('^vz-' + spec.id + '=([A-Za-z0-9.:,_-]*)$'));
    if (!m) return null;
    var raw = {};
    m[1].split(',').forEach(function (p) {
      var kv = p.split(':');
      if (kv.length !== 2) return;
      if (kv[0] === 'cur') raw.cur = kv[1];
      else if (spec.choice && kv[0] === spec.choice.k) { if (spec.choice.options[kv[1]]) raw[kv[0]] = kv[1]; }
      else if (kv[1] !== '') raw[kv[0]] = +kv[1];
    });
    var v = values(spec, raw);
    if (spec.choice) v[spec.choice.k] = raw[spec.choice.k] || spec.choice.def;
    return v;
  }
  function defaults(spec) {
    var v = values(spec, {});
    if (spec.choice) v[spec.choice.k] = spec.choice.def;
    return v;
  }

  // A short prefill for the guide: inputs the visitor changed, own details and the key result. Max 560 chars.
  function askText(spec, v, r) {
    var bits = [];
    spec.inputs.forEach(function (i) { if (v[i.k] !== i.def) bits.push(i.label + ' ' + fmt(v[i.k], i.unit, v.cur)); });
    (spec.own || []).forEach(function (i) { if (set(v[i.k])) bits.push(i.label + ' ' + fmt(v[i.k], i.unit, v.cur)); });
    var key = r.rows.filter(function (x) { return x.key; })[0] || r.rows[0];
    var t = 'From the calculator "' + spec.title + '". ' + (bits.length ? 'My inputs: ' + bits.join('; ') + '. ' : 'I used the book defaults. ') +
      key.label + ': ' + fmt(key.today, key.unit, v.cur) + ' today, ' + fmt(key.re, key.unit, v.cur) + ' after. ';
    var tail = 'My situation is different. I would like to ask Hemanth.';
    if (t.length + tail.length > 560) t = t.slice(0, 556 - tail.length) + '... ';
    return t + tail;
  }

  AE.vz = {
    YOU: YOU, CURRENCIES: CURRENCIES, sym: sym, num: num, money: money, fmt: fmt,
    specs: { exc: EXCEPTIONS, queue: QUEUE, order: ORDER, estate: ESTATE, touch: TOUCH },
    ORDER_BOOK: ORDER_BOOK, RATIOS: RATIOS, CLERK: CLERK, clerkTotals: clerkTotals, clerkTeam: clerkTeam,
    values: values, defaults: defaults, encode: encode, decode: decode, askText: askText,
    LINKEDIN: 'https://www.linkedin.com/in/hemanth-reganti-147153178/'
  };
})(typeof window !== 'undefined' ? window : globalThis);
