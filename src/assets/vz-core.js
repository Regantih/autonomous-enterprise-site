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


  /* ---------- 7. A defect: found by audit, or by the root-cause loop (Ch 30.4) ---------- */
  // The book's incident: 12 invoices billed in error (USD 30,830), 3 disputed, 9 paid without complaint. The rule:
  // one root cause 3 or more times in 30 days on one channel opens an incident and pulls the narrowest kill switch.
  var INCIDENT_BOOK = { invoices: 12, amount: 30830, disputed: 3, paidSilently: 9, rule: 3, window: 30, lagDays: 44 };
  var INCIDENT = {
    id: 'incident', title: 'Your defect: found by audit, or by the root-cause loop',
    inputs: [
      { k: 'od', label: 'Orders a day on the channel', unit: 'num', min: 1, max: 100000, step: 1, def: 200, src: YOU },
      { k: 'e', label: 'Share of orders the defect hits', unit: 'pct', min: 0.1, max: 50, step: 0.1, def: 0.9, src: YOU, note: 'The book\u2019s channel reached 0.9% value-weighted error in August (Ch 30.4.2).' },
      { k: 'amt', label: 'Amount billed in error per order', unit: 'money', min: 1, max: 1000000, step: 1, def: 2569, src: 'Ch 30.4.2', note: '' },
      { k: 'd', label: 'Share of wrong invoices the customer disputes', unit: 'pct', min: 1, max: 100, step: 1, def: 25, src: 'Ch 30.4.2' },
      { k: 'lag', label: 'Days from invoice to the customer\u2019s dispute', unit: 'days', min: 0, max: 180, step: 1, def: 44, src: 'Ch 30.3' },
      { k: 'D', label: 'Days until an audit finds it today', unit: 'days', min: 1, max: 730, step: 1, def: 90, src: YOU, note: 'The book says months later, in an audit (Ch 30.4.3).' }
    ],
    own: [
      { k: 'k', label: 'Your rule: same root cause this many times', unit: 'num', min: 1, max: 50, step: 1, src: 'Ch 30.4.2', book: '3 times' },
      { k: 'win', label: 'Your rule window', unit: 'days', min: 1, max: 365, step: 1, src: 'Ch 30.4.2', book: '30 days' }
    ],
    compute: function (v) {
      var k = set(v.k) ? v.k : INCIDENT_BOOK.rule, win = set(v.win) ? v.win : INCIDENT_BOOK.window;
      var wpd = v.od * v.e / 100, dpd = wpd * v.d / 100;
      var fires = dpd * win >= k;
      var daysR = fires ? Math.min(v.D, v.lag + k / dpd) : v.D;
      var wT = wpd * v.D, wR = wpd * daysR, mine = set(v.k) || set(v.win);
      var f = [
        'Wrong invoices a day = orders a day \u00d7 share the defect hits = ' + num(wpd, 2) + '.',
        'Found by audit: the defect runs until the audit day. Wrong invoices = wrong a day \u00d7 days.',
        'Root-cause loop: an incident opens at the ' + num(k) + 'th dispute with one cause inside ' + num(win) + ' days (Book, Ch 30.4.2). Days = days to the first dispute + ' + num(k) + ' \u00f7 disputes a day.',
        'Paid without complaint = wrong invoices \u00d7 (1 \u2212 share disputed). With the book defaults this gives 12 invoices, 9 paid silently and about USD 30,830 (Ch 30.4.2).',
        'The narrow stop (K2) then holds only the faulty scope for review. Other traffic keeps running (Book, Ch 30.4.2).'
      ];
      if (!fires) f.push('At your numbers, fewer than ' + num(k) + ' disputes arrive in ' + num(win) + ' days, so the rule does not fire. Both columns are the same.');
      if (set(v.k)) f.push('Your figure: the rule fires at ' + num(v.k) + ' disputes with one cause. The book uses 3.');
      if (set(v.win)) f.push('Your figure: a window of ' + num(v.win) + ' days. The book uses 30.');
      return {
        rows: [
          { label: 'Days the defect runs', today: v.D, re: daysR, unit: 'days', basis: basis(mine, 'Ch 30.4.2') },
          { label: 'Invoices billed in error', today: wT, re: wR, unit: 'num' },
          { label: 'Amount billed in error', today: wT * v.amt, re: wR * v.amt, unit: 'money', key: true, basis: basis(mine, 'Ch 30.4.2') },
          { label: 'Invoices paid without complaint', today: wT * (1 - v.d / 100), re: wR * (1 - v.d / 100), unit: 'num' }
        ],
        fires: fires,
        formula: f
      };
    }
  };
  INCIDENT.inputs[2].note = 'USD 30,830 over 12 invoices in the book.';

  /* ---------- Animated flows (content only; drawing lives in vz.js) ----------
     Each node: t title, s subtitle, d detail (plain sentences), c chapter; w / n grid cells for wide / narrow
     layouts. Edges: [from, to, opts]; opts.wb / opts.nb put a vertical bus at that column (wide / narrow).
     Cases: a route through the nodes; say[node] replaces the node detail for that case. */
  var FLOWS = {
    rag: {
      label: 'One agent step: find, ground, cite', cols: [4, 2], rows: [3, 5],
      nodes: {
        q: { t: 'The question', s: 'Is the deduction valid?', w: [0, 0], n: [0, 0], c: 'Ch 30.3', d: 'Gulf Coast paid USD 3,450 less: \u201cfreight not per contract\u201d. The dispute agent must decide if the claim is valid.' },
        resolve: { t: 'Resolve', s: 'Graph: payer, contract', w: [1, 0], n: [1, 0], c: 'Ch 09.4', d: 'The harness looks up golden IDs in the graph: who the payer is, which contract and delivery terms apply.' },
        retrieve: { t: 'Retrieve', s: 'Policy first, filtered', w: [2, 0], n: [1, 1], c: 'Ch 08.8.3', d: 'Current policy and limits load first. A permission filter at query time drops passages the agent may not see.' },
        prec: { t: 'Precedent', s: 'Like for like, dated', w: [3, 0], n: [0, 1], c: 'Ch 08.8.4', d: 'Past cases enter as evidence only: same customer, same contract term, outcome confirmed. Each carries its date and policy version.' },
        assemble: { t: 'Assemble', s: 'Stable first, wrapped', w: [3, 1], n: [0, 2], c: 'Ch 05.4.3', d: 'Stable content goes first, variable content last. Emails and PDFs are wrapped as data, never instructions.' },
        check: { t: 'Every fact sourced?', s: 'The output contract', w: [2, 1], n: [1, 2], gate: true, c: 'Ch 05.4.3', d: 'The output contract needs a source for every factual claim and a \u201cmissing information\u201d field.' },
        cite: { t: 'Cite', s: 'Each fact has a source', w: [1, 1], n: [0, 3], c: 'Ch 08.8.3', d: 'Contract DAP Houston, the freight line on the invoice, the carrier tender: each fact points to its record.' },
        answer: { t: 'Decide', s: 'Valid claim, p 0.96', w: [0, 1], n: [0, 4], end: true, c: 'Ch 30.3', d: 'The claim is valid on deterministic evidence. The model scores p 0.96 against a threshold of 0.81.' },
        gap: { t: 'Flag the gap', s: 'Says what it lacks', w: [2, 2], n: [1, 3], end: true, stop: true, c: 'Ch 08.8.3', d: 'An agent that cannot cite says what it lacks. A gap stated is a gap a steward can fix.' }
      },
      edges: [['q', 'resolve'], ['resolve', 'retrieve'], ['retrieve', 'prec'], ['prec', 'assemble'], ['assemble', 'check'], ['check', 'cite'], ['cite', 'answer'], ['check', 'gap']],
      cases: [
        { id: 'cite', name: 'Evidence complete', route: ['q', 'resolve', 'retrieve', 'prec', 'assemble', 'check', 'cite', 'answer'], end: 'Every fact is cited. The decision and its sources go into the trace.' },
        { id: 'gap', name: 'A fact is missing', route: ['q', 'resolve', 'retrieve', 'prec', 'assemble', 'check', 'gap'],
          say: { check: 'The carrier tender is not in the loaded records. The check fails on one fact.', gap: 'The agent does not guess. It names the missing tender and routes the case to a person.' },
          end: 'A gap filled by the model is a defect. A gap stated can be fixed.' },
        { id: 'old', name: 'An old precedent', route: ['q', 'resolve', 'retrieve', 'prec', 'assemble', 'check', 'cite', 'answer'],
          say: { prec: 'One past case closed under a superseded threshold. It is shown and flagged, never copied.' },
          end: 'Precedent is evidence, never authority. Current policy decides.' }
      ]
    },
    inference: {
      label: 'One step at run time: route, budget, fall back', cols: [5, 2], rows: [4, 7],
      nodes: {
        step: { t: 'One step', s: 'Needs an answer', w: [0, 1], n: [0, 0], c: 'Ch 09.4', d: 'The context is assembled. Now the step needs an engine.' },
        gw: { t: 'Model gateway', s: 'Pins, masks, logs', w: [1, 1], n: [1, 0], c: 'Ch 05.8.1, Ch 06', d: 'The gateway pins versions, masks personal data, filters input and output, and logs model, tokens and latency.' },
        route: { t: 'Route', s: 'Cheapest that passes', w: [2, 1], n: [1, 1], gate: true, c: 'Ch 09.4', d: 'Each step goes to the cheapest engine that passes evaluation: rules, a tabular model, a small model, a frontier model or a person.' },
        rules: { t: 'Rules', s: '39% of items', w: [0, 2], n: [1, 2], c: 'Ch 21.14.3', d: 'In the book\u2019s AP simulation, rules resolve 39% of items.' },
        tab: { t: 'Tabular model', s: '8%', w: [1, 2], n: [1, 3], c: 'Ch 21.14.3', d: 'A tabular model scores 8% of items, on CPU.' },
        small: { t: 'Small model', s: '4%', w: [2, 2], n: [1, 4], c: 'Ch 21.14.3', d: 'A small model handles 4% of items.' },
        front: { t: 'Frontier model', s: '13%', w: [3, 2], n: [1, 5], c: 'Ch 21.14.3', d: 'A frontier model takes the hard 13%. A stronger model on hard items often costs less per outcome.' },
        person: { t: 'Person', s: '36%', w: [4, 2], n: [1, 6], c: 'Ch 21.14.3', d: 'People decide 36% of items in the simulation.' },
        env: { t: 'Envelope', s: 'Deadline, calls, cost', w: [3, 3], n: [0, 5], gate: true, c: 'Ch 05.5.3', d: 'The harness, not the agent, limits each task: a deadline, model calls, tool calls, retries and a shared budget.' },
        val: { t: 'Validate and trace', s: 'Commit or escalate', w: [4, 3], n: [0, 6], end: true, c: 'Ch 09.4', d: 'Code checks the answer against limits and the threshold, writes the trace, then commits or escalates.' },
        stop: { t: 'Stop and escalate', s: 'With the trace', w: [2, 3], n: [0, 4], end: true, stop: true, c: 'Ch 05.5.3', d: 'At a limit the run stops and escalates to a person with its trace. A loop cannot burn on unseen.' },
        fb: { t: 'Fallback', s: 'From another provider', w: [1, 0], n: [0, 1], c: 'Ch 04.2.3', d: 'Every production agent keeps one tested fallback from a different provider.' },
        l1: { t: 'Degrade to L1', s: 'A person decides', w: [0, 0], n: [0, 2], end: true, stop: true, c: 'Ch 05.8.1', d: 'If no model can serve, the gateway degrades the step to L1. A person decides with the agent\u2019s help.' }
      },
      edges: [['step', 'gw'], ['gw', 'route'], ['route', 'rules', { nb: 0.5 }], ['route', 'tab', { nb: 0.5 }], ['route', 'small', { nb: 0.5 }], ['route', 'front', { nb: 0.5 }], ['route', 'person', { nb: 0.5 }],
        ['front', 'env'], ['env', 'val'], ['env', 'stop'], ['gw', 'fb'], ['fb', 'l1']],
      cases: [
        { id: 'swarm', name: 'Route 100 items', route: ['step', 'gw', 'route'], swarm: { from: 'route', to: { rules: 39, tab: 8, small: 4, front: 13, person: 36 } },
          say: { route: 'One hundred AP exceptions arrive. Watch where each one goes.' },
          end: 'Routing across engines: USD 1.06M against USD 2.84M for an all-human desk, on 108,000 exceptions (illustrative).' },
        { id: 'hard', name: 'A hard item', route: ['step', 'gw', 'route', 'front', 'env', 'val'],
          say: { route: 'This exception needs judgment across documents. It goes to the frontier model.', env: 'The run stays inside its deadline and budget. Normal runs need 4 to 6 model calls of 12 allowed.' },
          end: 'Compute is about 1.6% of total cost. Review and wrong actions dominate.' },
        { id: 'limit', name: 'A run hits its limit', route: ['step', 'gw', 'route', 'front', 'env', 'stop'],
          say: { env: 'The run reaches its cap of 12 model calls before it finishes.', stop: 'The run stops and escalates with its trace. The run-level cap is the most effective cost control.' },
          end: 'Cap steps: input grows with the square of the step count.' },
        { id: 'down', name: 'The provider is down', route: ['step', 'gw', 'fb', 'l1'],
          say: { gw: 'The primary model does not answer.', fb: 'The tested fallback from another provider takes the step.', l1: 'If the fallback fails too, the step drops to L1. Nobody waits in silence.' },
          end: 'Keep one tested fallback per production agent.' }
      ]
    },
    demotion: {
      label: 'How an agent is demoted and restored', cols: [5, 2], rows: [4, 6],
      nodes: {
        run: { t: 'Agent at L3', s: 'Acting within limits', w: [0, 0], n: [0, 0], c: 'Ch 01.5', d: 'The agent acts alone inside its limits. People handle exceptions and sample its work.' },
        sample: { t: 'Weekly sample', s: 'A critical error?', w: [1, 0], n: [1, 0], gate: true, c: 'Ch 24.7.6', d: 'People review a weekly sample. One critical error is enough.' },
        err: { t: 'Error watch', s: 'Above 0.2% a month?', w: [1, 1], n: [1, 1], gate: true, c: 'Ch 24.7.6', d: 'Value-weighted error above 0.2% in a month triggers demotion.' },
        ctrl: { t: 'Control watch', s: 'Breach or no trace?', w: [1, 2], n: [1, 2], gate: true, c: 'Ch 24.7.6', d: 'A control breach, missing traces or a vendor model change that fails regression.' },
        ready: { t: 'Readiness check', s: 'Fails after go-live?', w: [1, 3], n: [1, 3], gate: true, c: 'Ch 06.3', d: 'A readiness check that fails after go-live demotes the agent one level.' },
        l2: { t: 'Down to L2', s: 'Person approves each', w: [2, 1], n: [0, 1], stop: true, c: 'Ch 24.7.6', d: 'The agent only proposes. A person approves every action.' },
        shadow: { t: 'Down to shadow', s: 'Sees, does not act', w: [2, 2], n: [0, 2], stop: true, c: 'Ch 24.7.6', d: 'The agent sees live triggers but takes no action.' },
        down1: { t: 'Down one level', s: 'Automatic', w: [2, 3], n: [0, 3], stop: true, c: 'Ch 06.3', d: 'The drop is automatic. Nobody debates it first.' },
        council: { t: 'Council review', s: 'In 10 working days', w: [3, 1], n: [0, 4], c: 'Ch 24.7.6', d: 'The autonomy council reviews every demotion within 10 working days.' },
        fix: { t: 'Fix and retest', s: 'Root cause, retest', w: [4, 1], n: [1, 4], c: 'Ch 25', d: 'Find the root cause: data, rule, context, model, tool, timing or vendor change. Then run the full regression.' },
        restart: { t: 'Restore on evidence', s: 'Owners sign', w: [4, 2], n: [1, 5], end: true, c: 'Ch 01.5.5', d: 'Restart only after tests pass and the owner and control owner sign. Promotion is never automatic.' }
      },
      edges: [['run', 'sample'], ['run', 'err', { wb: 0.5, nb: 0.5 }], ['run', 'ctrl', { wb: 0.5, nb: 0.5 }], ['run', 'ready', { wb: 0.5, nb: 0.5 }],
        ['sample', 'l2'], ['err', 'l2'], ['ctrl', 'shadow'], ['ready', 'down1'],
        ['l2', 'council', { nb: -0.47 }], ['shadow', 'council', { nb: -0.47 }], ['down1', 'council'], ['council', 'fix'], ['fix', 'restart']],
      cases: [
        { id: 'sample', name: 'Critical error in the sample', route: ['run', 'sample', 'l2', 'council', 'fix', 'restart'], end: 'Lowering a level needs one rule and no meeting. Raising it needs evidence and a body.' },
        { id: 'a2a', name: 'Error above 0.2%: the book\u2019s case', route: ['run', 'err', 'l2', 'council', 'fix', 'restart'],
          say: { err: 'In August the A2A order channel reached 0.9% value-weighted error. The trigger is 0.2%.', l2: 'The A2A write path went to L2 by rule, not by debate.', fix: 'The team fixed the map and added an invariant and negative tests.', restart: 'Twenty orders ran in shadow with zero differences. The council restored the scope on September 19.' },
          end: 'Certification bounds how often. The loop and the kill switch bound how long and how far.' },
        { id: 'ctrl', name: 'Control breach or missing trace', route: ['run', 'ctrl', 'shadow', 'council', 'fix', 'restart'], end: 'A missing trace is a control breach. The agent loses its actions first.' },
        { id: 'ready', name: 'Readiness check fails', route: ['run', 'ready', 'down1', 'council', 'fix', 'restart'], end: 'Demotion is automatic. Promotion never is.' }
      ]
    },
    pipelines: {
      label: 'Which pipeline a change goes through', cols: [5, 1], rows: [4, 0], narrow: 'route',
      nodes: {
        chg: { t: 'The change', s: 'By its artifact', w: [0, 1], c: 'Ch 25', d: 'Classify the change by the artifact it touches. The class sets the pipeline and the approver.' },
        s1: { t: 'Skill: propose', s: 'From hard cases', w: [1, 0], c: 'Ch 24', d: 'Ideas come from hard cases, the exception list and override reasons. An agent may draft a skill but never approve it.' },
        s2: { t: 'Golden-set test', s: 'Before first use', w: [2, 0], c: 'Ch 05', d: 'AgentOps runs a golden set per skill before first use.' },
        s3: { t: 'Version and release', s: 'Traced by version', w: [3, 0], c: 'Ch 05', d: 'Same release policy as instructions. The skill version is written to every trace.' },
        r1: { t: 'Ticket', s: 'No ticket, no change', w: [1, 1], c: 'Ch 22', d: 'An instruction changed without a ticket is a control failure.' },
        r2: { t: 'Full regression', s: 'Three test sets', w: [2, 1], c: 'Ch 06', d: 'Run the golden set, trajectory checks and adversarial set. Store the results in the registry entry.' },
        r3: { t: 'Shadow, then canary', s: 'Rolls back on breach', w: [3, 1], c: 'Ch 06', d: 'A new version starts in shadow unless minor. A small share of live volume runs at the target level first.' },
        a1: { t: 'Offline evaluation', s: 'Before any live use', w: [1, 2], c: 'Ch 06', d: 'Tool tests, golden set, trajectory checks, adversarial and envelope tests.' },
        a2: { t: 'Shadow and pilot', s: '4 weeks, 300 cases', w: [2, 2], c: 'Ch 26', d: 'Live triggers, no actions, for at least 4 weeks with a month-end and 300 cases.' },
        a3: { t: 'Readiness gate', s: 'Twelve checks', w: [3, 2], c: 'Ch 06', d: 'L3 needs all twelve checks. L2 needs a named subset and a dated plan.' },
        w1: { t: 'Hand-off queue', s: 'A production asset', w: [1, 3], c: 'Ch 25', d: 'Size it, watch its age and label each human decision as evaluation data.' },
        ok: { t: 'Approver', s: 'Named per class', w: [4, 1], end: true, c: 'Ch 25', d: 'The approver depends on the class of change.' },
        okp: { t: 'Person on the queue', s: 'Decides the case', w: [4, 3], end: true, c: 'Practice', d: 'A named person decides. The item keeps its trace ID and approval card.' }
      },
      edges: [['chg', 's1', { wb: 0.5 }], ['chg', 'r1'], ['chg', 'a1', { wb: 0.5 }], ['chg', 'w1', { wb: 0.5 }], ['s1', 's2'], ['s2', 's3'], ['r1', 'r2'], ['r2', 'r3'], ['a1', 'a2'], ['a2', 'a3'],
        ['s3', 'ok', { wb: 3.5 }], ['r3', 'ok'], ['a3', 'ok', { wb: 3.5 }], ['w1', 'okp']],
      cases: [
        { id: 'skill', name: 'New skill wording', route: ['chg', 's1', 's2', 's3', 'ok'], sub: { ok: 'Product owner' }, say: { ok: 'Class: standard if evaluation passes. The product owner approves.' }, end: 'Withdrawing a skill returns every agent that loads it to shadow until retested.' },
        { id: 'instr', name: 'Instruction text', route: ['chg', 'r1', 'r2', 'r3', 'ok'], sub: { ok: 'Product owner' }, say: { ok: 'Class: standard if evaluation passes. The product owner approves.' }, end: 'Prompts and policies are released like code. Evals are the gate.' },
        { id: 'limit', name: 'Threshold or limit', route: ['chg', 'r1', 'r2', 'r3', 'ok'], sub: { ok: 'Owner and risk lead' }, say: { ok: 'Class: normal, control-relevant. The owner and the risk lead approve.' }, end: 'Test each limit at the boundary before shadow and after every change.' },
        { id: 'model', name: 'Model version', route: ['chg', 'r1', 'r2', 'r3', 'ok'], sub: { ok: 'Eval engineer, owner' }, say: { r2: 'A vendor update is a model change. Run the full regression set.', ok: 'Class: normal, full regression. The evaluation engineer and the owner approve.' }, end: 'Watch the SLOs for two weeks after a vendor update.' },
        { id: 'tools', name: 'Tools and permissions', route: ['chg', 'a1', 'a2', 'a3', 'ok'], sub: { ok: 'Risk lead, platform' }, say: { ok: 'Class: major, with a duties check. The risk lead and the platform team approve.' }, end: 'An agent\u2019s limits, permissions and kill switch stay outside its own write scope.' },
        { id: 'level', name: 'Autonomy level', route: ['chg', 'a1', 'a2', 'a3', 'ok'], sub: { ok: 'Autonomy council' }, say: { ok: 'Class: major. The autonomy council decides.' }, end: 'No financial agent is promoted in the last month of a quarter.' },
        { id: 'self', name: 'A change the agent proposes', route: ['chg', 'r1', 'r2', 'r3', 'ok'], sub: { ok: 'That class\u2019s approver' }, say: { chg: 'The agent drafts a change to its own instructions. It goes through the pipeline of that artifact.', ok: 'Never self-approved. The approver for that class decides.' }, end: 'Changes an agent proposes roll back automatically on an SLO breach.' },
        { id: 'case', name: 'A case the agent cannot finish', route: ['chg', 'w1', 'okp'], say: { chg: 'This is not a change. It is work the agent hands to a person.' }, end: 'Practice, not from the book: every agent item names the person who answers for it.' }
      ]
    },
    tiers: {
      label: 'How an outside agent earns trust, and loses it', cols: [4, 2], rows: [2, 5],
      nodes: {
        t0: { t: 'T0 Unknown', s: 'Logged and refused', w: [0, 0], n: [0, 0], c: 'Ch 23.4', d: 'Nothing is allowed. A published card is a hint only and never grants a scope.' },
        verify: { t: 'Verify', s: 'Signature, domain', w: [1, 0], n: [1, 0], gate: true, c: 'Ch 23.4', d: 'Check the signature, the domain, the contract and the partner\u2019s master record. Then issue your own short-lived credential.' },
        t1: { t: 'T1 Sandbox', s: 'Synthetic data only', w: [2, 0], n: [1, 1], c: 'Ch 23.4', d: 'Test tools on synthetic data for two to four weeks. Security tests must pass.' },
        t2: { t: 'T2 Read', s: 'Own records only', w: [3, 0], n: [0, 1], c: 'Ch 23.4', d: 'Read its own records through filtered tools. The owner and the CISO sign the move.' },
        t3: { t: 'T3 Act within limits', s: 'Cases, within caps', w: [3, 1], n: [0, 2], c: 'Ch 23.4', d: 'Create or update cases and requests within caps, after 90 days at T2 without a material finding.' },
        mon: { t: 'Monitor', s: 'Alert on deviation', w: [2, 1], n: [1, 2], gate: true, c: 'Ch 23.4', d: 'Baseline the agent\u2019s behavior and alert on deviation. Caps on rate, value and data volume sit at the gateway.' },
        rev: { t: 'Revoke', s: 'Within five minutes', w: [1, 1], n: [1, 3], stop: true, end: true, c: 'Ch 23.4', d: 'The gateway denies the agent within five minutes. The path is tested quarterly.' },
        never: { t: 'Never, at any tier', s: 'Payments, bank data', w: [0, 1], n: [0, 4], c: 'Ch 23.4', d: 'No tier allows payment release, bank-data changes, credit-limit changes or user administration.' }
      },
      edges: [['t0', 'verify'], ['verify', 't1'], ['t1', 't2'], ['t2', 't3'], ['t3', 'mon'], ['mon', 'rev'], ['rev', 't0', { nb: -0.47 }]],
      cases: [
        { id: 'earn', name: 'Earn trust', route: ['t0', 'verify', 't1', 't2', 't3'], end: 'Trust is earned over time, one tier at a time. Values are illustrative.' },
        { id: 'revoke', name: 'Revoke', route: ['t3', 'mon', 'rev', 't0'], say: { t0: 'The agent is back to nothing. Requests are logged and refused.' }, end: 'Revocation is a tested path, from both sides.' }
      ]
    }
  };

  /* ---------- Maps ---------- */
  var DECISIONS = [
    { l1: '1 Where agents act', l2: 'Rule, model, person?', q: 'Which decisions should an agent make, and which belong to a rule, a model or a person?', a: 'Start from an outcome Finance can measure. Then use the simplest engine that works: rules, models or solvers before agents.', c: 'Ch 21.3', href: '/blueprints/design/#deterministic', link: 'Which step goes where' },
    { l1: '2 How far trusted', l2: 'A level per step', q: 'How much may this agent do alone, and what evidence moves it up or down?', a: 'Set a level per step, L0 to L5. Promotion is earned on evidence and decided by a named body. Demotion is automatic.', c: 'Ch 01.5', href: '/blueprints/organization/#delegation', link: 'Who sets the level' },
    { l1: '3 Who answers', l2: 'A named owner', q: 'Who is accountable when this agent acts, and who may change its limits?', a: 'Every agent has a named business owner. The owner signs its limits and promotions and can stop it. No registry, no run.', c: 'Ch 24.3', href: '/blueprints/organization/#org', link: 'Agents are owned, not managed' },
    { l1: '4 How you stop them', l2: 'Limits and a kill switch', q: 'What stops this agent, how fast, and who may pull the switch?', a: 'The harness enforces limits and budgets. Irreversible steps stay behind human gates. A tested kill switch stops one agent or the fleet.', c: 'Ch 05.8', href: '/blueprints/operations/#killswitch', link: 'The kill switch' },
    { l1: '5 Whether it pays', l2: 'Cost per outcome', q: 'Does this agent create more value than it costs, after review, incidents and fixed cost?', a: 'Compare agents in cost per completed outcome. Track each agent\u2019s net contribution. Run pilots that end in a decision.', c: 'Ch 25.4', href: '/frameworks/#cost', link: 'Price your exceptions' }
  ];
  // Decision rights for autonomy changes (Table 25.2, Ch 25.2.2; evidence from Ch 01.5.5 and Table 24.7).
  var LADDER = {
    levels: [
      { l: 'L0', n: 'Manual', who: 'A person does the work' },
      { l: 'L1', n: 'Assist', who: 'A person uses suggestions' },
      { l: 'L2', n: 'Approve', who: 'A person approves every action' },
      { l: 'L3', n: 'Act within limits', who: 'A person handles exceptions' },
      { l: 'L4', n: 'Run and report', who: 'A person audits and tunes' },
      { l: 'L5', n: 'Full', who: 'A person sets goals only' }
    ],
    up: [
      { from: 0, by: 'Process product owner', ev: 'Shadow exit: 4 weeks with a month-end, at least 300 cases, error at or below the human baseline.', c: 'Ch 24.7, Table 24.7' },
      { from: 1, by: 'Process product owner', ev: 'Suggestion acceptance at or above 80% over 4 weeks. Registered, with its own identity. Roles approved.', c: 'Ch 25.2.2' },
      { from: 2, by: 'Owner and risk lead, or the autonomy council', ev: 'Three months with a quarter-end and at least 1,000 actions. SLOs met. For a step that triggers a posting or payment, the autonomy council decides.', c: 'Ch 25.2.2' },
      { from: 3, by: 'Autonomy council, endorsed by the risk council', ev: 'Two quarter-ends at L3. Harness score 17 to 20. Error below target. An audit cycle passed.', c: 'Ch 25.2.2' },
      { from: 4, by: 'Board-level risk acceptance', ev: 'Normally not pursued for postings. L5 is a boundary marker, not a target.', c: 'Ch 01.5.5' }
    ],
    down: { by: 'Owner or AgentOps, at once', ev: 'An incident or an SLO breach. Lowering a level needs one person and no meeting.', c: 'Ch 25.2.2' }
  };
  var TRUST_Q = [
    { q: 'Who is it?', i: 'Yours: built or bought, with a named business owner and a technical owner.', e: 'A supplier\u2019s, bank\u2019s or customer\u2019s agent calling your systems. You still name an owner on your side.', c: 'Ch 05, Ch 23' },
    { q: 'Where is it recorded?', i: 'The enterprise registry. No registry, no run.', e: 'Its own registry record, with a trust tier.', c: 'Ch 23, Ch 25' },
    { q: 'How is it identified?', i: 'Its own identity on every platform. Delegated tokens name the agent, for one target, for minutes.', e: 'A signed, short-lived record on the partner\u2019s verified domain. Then your own short-lived credential.', c: 'Ch 03, Ch 23' },
    { q: 'What may it do?', i: 'What its agent contract and autonomy level allow, L0 to L5.', e: 'Only the filtered tools you publish for it. Read before write.', c: 'Ch 05, Ch 23' },
    { q: 'How is it stopped?', i: 'Your kill switch, through your gateways.', e: 'Revocation at your gateway within five minutes, tested from both sides.', c: 'Ch 05, Ch 23' }
  ];
  // The book's 31 chapters by part (front matter, "How to read this book"). href: the site page that covers it.
  var PARTS = [
    { p: 'Part I', n: 'Foundations', ch: [
      [1, 'The Autonomous Enterprise', 'The definition, the autonomy scale L0 to L5 and the value thesis.', '/frameworks/#scale', 'The frameworks'],
      [2, 'Autonomy Across a Web of Platforms', 'The weakest-link rule and how agents work across many platforms.', '/frameworks/#weakest-link', 'The weakest link'],
      [3, 'Reference Architecture and Build Blueprint', 'Six layers, four planes, and deterministic and probabilistic paths.', '/architecture/', 'Reference architecture'],
      [4, 'The AI Engines', 'Language, tabular, time-series and graph models, solvers and rules, and how to pick one.', '/blueprints/models/', 'Models'],
      [5, 'Agents, Orchestration and the Harness', 'The agent, its memory and context, and the ten-part harness with the kill switch.', '/frameworks/#harness', 'The harness'],
      [6, 'Testing, Evals and Human-Agent Loops', 'How to test agents, the readiness gate and loops in production.', '/blueprints/loops/', 'Self-improving loops'],
      [7, 'The Interaction Layer', 'Text, voice, vision and physical AI under one control design.', '/blueprints/design/', 'Design'],
      [8, 'The Data and Semantics Foundation', 'Data products, semantics and the rules for grounding agents.', '/blueprints/graphs/', 'Knowledge graph'],
      [9, 'Building the Company Brain', 'Which store holds what, and how one step reads the brain at run time.', '/blueprints/design/#rag', 'Retrieval: find, ground, cite'],
      [10, 'Interfaces in Transition', 'The interface inventory, eleven types and six dispositions.', '/architecture/#patterns', 'Integration patterns'],
      [11, 'Core Modernization', 'Options for the core system and how to decide among them.', '/reimagine/', 'Reimagine your operations']
    ] },
    { p: 'Part II', n: 'The Autonomous Domains', ch: [
      [12, 'Finance I: Record-to-Report', 'The autonomous close: journals, reconciliations, accruals and intercompany.', '/workflows/#wf-r2r', 'Record-to-report workflow'],
      [13, 'Finance II: Invoice-to-Cash, Payables and Treasury', 'Billing, credit, cash application, collections and disputes.', '/workflows/#wf-o2c', 'Order-to-cash workflow'],
      [14, 'Procurement and Spend', 'Intake to purchase order, sourcing and contract agents.', '/workflows/#wf-supplier', 'Supplier onboarding workflow'],
      [15, 'Supply Chain, Manufacturing and Physical AI', 'Planning, maintenance and robots, set by reversibility and impact.', '/workflows/#wf-picking', 'Warehouse picking workflow'],
      [16, 'Front Office and People', 'Sales, pricing, service, recruiting and onboarding.', '/workflows/#wf-voice', 'Customer service voice workflow'],
      [17, 'IT, Shared Services and Industry Scenarios', 'Service desk, incidents and change, and industry cases.', '', ''],
      [18, 'Tax, Trade and Statutory Reporting', 'Indirect tax, e-invoicing mandates, direct tax and statutory accounts.', '', ''],
      [19, 'Environment, Health and Safety', 'Incident intake, investigations, permits and emissions reporting.', '', '']
    ] },
    { p: 'Part III', n: 'Making It Happen', ch: [
      [20, 'Legal, Risk and Insurance', 'Liability when an agent acts, contract terms and insurance.', '/controls/', 'Controls library'],
      [21, 'Strategy, Value and the Business Case', 'Start from outcomes, the cost model and cost per certified outcome.', '/frameworks/#cost', 'Exception cost calculator'],
      [22, 'Governance, Controls and Audit', 'Segregation of duties, decision traces and audit evidence.', '/blueprints/trace/', 'Decision trace viewer'],
      [23, 'Agent Security and the Front Door', 'Agent identity, prompt injection, the kill switch and outside agents.', '/blueprints/organization/#trust', 'Internal and external agents'],
      [24, 'People, Talent and Organization Design', 'Role redesign by task, new roles and bringing people with you.', '/blueprints/organization/', 'Organization'],
      [25, 'Running the Agent Estate', 'AgentOps, workloads, FinOps across meters and vendors.', '/blueprints/operations/', 'Operations'],
      [26, 'The Roadmap and Risk', 'Phases and gates over 30 months, pilots and the risk register.', '/frameworks/#roadmap', 'The 30-month roadmap']
    ] },
    { p: 'Part IV', n: 'Playbooks, Toolkit and the Road Ahead', ch: [
      [27, 'Platform Playbooks I: Enterprise Suites', 'How each suite does autonomy and how its customers get there.', '', ''],
      [28, 'Platform Playbooks II: Front-Office, Workflow, Hyperscaler and AI-Native', 'The other platforms a suite-centric program meets.', '', ''],
      [29, 'The Practitioner\u2019s Toolkit', 'Templates and checklists: agent contract, promotion checklist, 100-day plan.', '/designer/', 'Workflow designer'],
      [30, 'Capstone: One Order End to End', 'One customer order from a buying agent to cash, close and profit.', '/book/#one-order', 'One order, end to end'],
      [31, 'Direction and the Road Ahead (2027\u20132030)', 'Dated events to watch and trends to 2030.', '', '']
    ] }
  ];

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
    specs: { exc: EXCEPTIONS, queue: QUEUE, order: ORDER, estate: ESTATE, touch: TOUCH, incident: INCIDENT },
    INCIDENT_BOOK: INCIDENT_BOOK, FLOWS: FLOWS, DECISIONS: DECISIONS, LADDER: LADDER, TRUST_Q: TRUST_Q, PARTS: PARTS,
    ORDER_BOOK: ORDER_BOOK, RATIOS: RATIOS, CLERK: CLERK, clerkTotals: clerkTotals, clerkTeam: clerkTeam,
    values: values, defaults: defaults, encode: encode, decode: decode, askText: askText,
    LINKEDIN: 'https://www.linkedin.com/in/hemanth-reganti-147153178/'
  };
})(typeof window !== 'undefined' ? window : globalThis);
