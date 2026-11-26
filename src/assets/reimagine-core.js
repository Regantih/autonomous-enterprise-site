/* Reimagine your operations: a deterministic rule engine over the book's rules. Pure functions, no network, no storage.
   Every rule, label and level comes from The Autonomous Enterprise; each output carries its "Book, Ch NN.N" citation.
   Book figures are illustrative. Used in the browser (reimagine.js) and at build time (static Meridian result). */
(function (w) {
  'use strict';
  var AE = w.AE = w.AE || {};

  var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var cite = function (s) { return '<span class="rm-cite">Book, Ch ' + esc(s) + '</span>'; };
  var lv = function (n) { return 'L' + n; };

  /* ---------- Input vocabulary ---------- */
  var INDUSTRIES = [
    ['manufacturing', 'Manufacturing'], ['services', 'Healthcare or services'], ['retail', 'Retail or consumer'],
    ['utilities', 'Utilities or energy'], ['financial', 'Financial services'], ['public', 'Public sector'], ['other', 'Other']
  ];
  var REVENUE = [['lt500m', 'Under USD 500M'], ['500m-2b', 'USD 500M to 2B'], ['2b-10b', 'USD 2B to 10B'], ['gt10b', 'Over USD 10B']];
  var INTERFACES = [['lt100', 'Under 100'], ['100-300', '100 to 300'], ['300-1000', '300 to 1,000'], ['gt1000', 'Over 1,000']];
  var CORES = [
    ['legacyErp', 'Legacy ERPs', 'On-premises or old-release ERPs with their own support dates.'],
    ['mainframe', 'Mainframes', 'Count each mainframe that runs core logic, such as pricing or logistics.'],
    ['cloud', 'Modern cloud suites', 'Cloud ERP, CRM, HR, IT service or procurement suites on a current release.'],
    ['homegrown', 'Homegrown cores', 'In-house systems that act like an ERP for one domain.']
  ];
  // The book's domains (Chapters 12 to 20).
  var STREAMS = [
    ['r2r', 'Record-to-report', '12'], ['i2c', 'Invoice-to-cash and payables', '13'], ['procurement', 'Procurement', '14'],
    ['supply', 'Supply chain and manufacturing', '15'], ['front', 'Front office and people', '16'], ['it', 'IT and shared services', '17'],
    ['tax', 'Tax', '18'], ['ehs', 'Environment, health and safety', '19'], ['legal', 'Legal and risk', '20']
  ];
  // Readiness evidence from Table 26.3 (foundations before agents).
  var LAYERS = [
    { id: 'data', name: 'Data readiness', items: [['authority', 'Source authority'], ['lineage', 'Lineage'], ['freshness', 'Freshness'], ['access', 'Access'], ['ownership', 'Ownership']] },
    { id: 'platform', name: 'Platform stress test', items: [['load', 'Load'], ['latency', 'Latency'], ['availability', 'Availability'], ['observability', 'Observability'], ['cost', 'Cost'], ['recovery', 'Recovery']] },
    { id: 'gov', name: 'Govern the agentic layer', items: [['may', 'What agents may do'], ['humans', 'When humans step in'], ['trace', 'Tracing and reversal'], ['owner', 'Ownership']] }
  ];
  // Value types from Table 21.2.
  var OUTCOMES = [
    { id: 'capacity', name: 'Capacity (cost)', formula: 'hours saved x loaded rate x capture factor', mistake: 'Capture factor = 1' },
    { id: 'leakage', name: 'Leakage avoided', formula: 'spend in scope x leakage rate x recovery rate', mistake: 'Counting one-time recovery as recurring' },
    { id: 'wc', name: 'Working capital', formula: 'days reduced x daily balance', mistake: 'Booking cash release as profit' },
    { id: 'inventory', name: 'Inventory', formula: 'inventory reduced x carrying cost', mistake: 'Ignoring service-level guardrail' },
    { id: 'revenue', name: 'Revenue', formula: 'volume x margin x uplift', mistake: 'No control group' },
    { id: 'risk', name: 'Risk', formula: 'loss frequency x loss size x reduction', mistake: 'No baseline loss data' }
  ];
  var APPETITE = [['cautious', 'Cautious'], ['balanced', 'Balanced'], ['ambitious', 'Ambitious']];
  // Five questions per legacy core (Section 11.5.1). For mainframe and homegrown cores, read "support" as skills and hardware risk.
  var CORE_Q = [
    ['q1', 'Does support end before your earliest safe finish (plan plus 25% contingency)?'],
    ['q2', 'Does the vendor standard fit 80% or more of the scope?'],
    ['q3', 'Are several legacy cores merging into one?'],
    ['q4', 'Is converted history needed in the new core, after the two-year history rule?'],
    ['q5', 'Are there small entities with simple needs?']
  ];
  // Mainframe: wrap first, then choose per function (Section 11.12.2).
  var MF_Q = [
    ['risk', 'Hardware or skills risk within 24 months?'],
    ['standard', 'Does the new ERP cover its logic in standard?'],
    ['stable', 'Is it differentiating logic with stable rules?']
  ];

  /* ---------- Archetypes (Table 26.2, Section 01.7.4) ---------- */
  var ARCHETYPES = {
    meridian: { id: 'meridian', name: 'Meridian Industries', start: 'Two legacy ERPs, a mainframe, cloud suites and 620 interfaces (USD 5.0B manufacturer)', shape: '30-month plan with three core waves; the hardest version, so it shows every mechanism', range: [30, 30], cite: '26.1.3' },
    harbor: { id: 'harbor', name: 'Harbor Health Services', start: 'Cloud ERP, HR suite and CRM suite; no legacy ERP (USD 900M services company)', shape: 'No core clock: 12-15 months; the critical path is data quality and the governance plane', range: [12, 15], cite: '26.1.3' },
    northwind: { id: 'northwind', name: 'Northwind Retail', start: 'Cloud ERP suite, e-commerce platform and a homegrown warehouse system (USD 400M retailer)', shape: '9-12 months; buy vendor agents; wrap the warehouse system with a few APIs', range: [9, 12], cite: '26.1.3' },
    atlas: { id: 'atlas', name: 'Atlas Utilities', start: 'On-premises ERP on a current release, an asset system and OT/SCADA (regulated utility)', shape: 'Critical path is the OT boundary and the regulator; plant agents stay advisory (L1)', range: null, cite: '26.1.3' }
  };
  var ORDER = ['meridian', 'atlas', 'harbor', 'northwind'];

  /* ---------- Decisions per value stream (domain chapters; engines per Section 21.3.2) ----------
     eng: simplest engine first. src: where the engine comes from ('04.14' = the book's engine portfolio; otherwise the
     Section 21.3.2 filter applied to the book's description). max: highest level the book gives the decision.
     plat: platform that owns the decision. cross: crosses a platform boundary. core: depends on the transactional core.
     cp: commits the company to a third party. rev: reversibility class (Section 01.5.4). rank: pilot priority. */
  var DECISIONS = [
    { id: 'r2r-recon', s: 'r2r', d: 'Clear reconciliation items by match confidence', eng: 'Model + rule', src: '12.6.2', level: 'Green band L3; amber L2; red L1', max: 3, plat: 'ERP', core: true, rev: 'easy', rank: 7, cite: '12.6.2' },
    { id: 'r2r-ic', s: 'r2r', d: 'Resolve intercompany mismatches', eng: 'Rule + model + agent', src: '04.14', level: 'Within tolerance L3; FX differences L2; disputes L1', max: 3, plat: 'ERP', cross: true, core: true, rev: 'easy', rank: 9, cite: '12.8.1' },
    { id: 'r2r-accrual', s: 'r2r', d: 'Propose accruals at close', eng: 'Model + rule + agent', src: '04.14', level: 'L2', max: 2, plat: 'ERP', core: true, rev: 'hard', rank: 12, cite: '04.14' },
    { id: 'r2r-report', s: 'r2r', d: 'Draft the management pack narrative', eng: 'Agent drafts; person owns', src: '12.1.1', level: 'L1-L2', max: 2, plat: 'Reporting', rev: 'easy', cite: '12.1.1' },
    { id: 'r2r-post', s: 'r2r', d: 'Post journal entries', eng: 'Rule posts; no agent writes a journal entry', src: '24.7.5', level: 'L2 for ledger-posting agents', max: 2, plat: 'ERP', core: true, rev: 'hard', cite: '24.7.5' },

    { id: 'ap-exception', s: 'i2c', d: 'Resolve AP price and quantity variance exceptions', eng: 'Agent + model + rule', src: '04.14', level: 'L2; green band L3 within the executable limit', max: 3, plat: 'ERP', core: true, rev: 'easy', rank: 1, cite: '26.6.3' },
    { id: 'dispute', s: 'i2c', d: 'Resolve customer billing disputes and credits', eng: 'Agent + model + rule', src: '04.14', level: 'L2 at go-live; L3 for credits within limits after promotion', max: 3, plat: 'CRM and ERP', cross: true, cp: true, rev: 'easy', rank: 2, cite: '13.7.4' },
    { id: 'cash-app', s: 'i2c', d: 'Match incoming cash to open items', eng: 'Model + rule', src: '13.5.2', level: 'L2 at go-live; L3 above the clearing threshold after promotion', max: 3, plat: 'ERP', core: true, rev: 'easy', rank: 4, cite: '13.5.2' },
    { id: 'collections', s: 'i2c', d: 'Choose the collections treatment by late-payment risk', eng: 'Model + rule; agent drafts reminders', src: '04.14', level: 'L4 low risk; L3 templated; L1-L2 high risk', max: 4, plat: 'ERP', core: true, cp: true, rev: 'easy', rank: 8, cite: '13.6.3' },
    { id: 'bank-change', s: 'i2c', d: 'Change supplier bank details', eng: 'Person; agent assembles evidence', src: '13.10.1', level: 'L1', max: 1, plat: 'ERP', core: true, rev: 'irrev', cite: '13.10.1' },

    { id: 'spend-class', s: 'procurement', d: 'Classify spend', eng: 'Model', src: '04.14', level: 'L3-L4', max: 4, plat: 'Procurement suite', rev: 'easy', rank: 5, cite: '14.1.1' },
    { id: 'intake', s: 'procurement', d: 'Route requests by category and policy', eng: 'Rule + model', src: '14.1.1', level: 'L3', max: 3, plat: 'Procurement suite', rev: 'easy', rank: 10, cite: '14.1.1' },
    { id: 'tail', s: 'procurement', d: 'Award tail-spend spot buys under USD 25,000', eng: 'Agent runs the event; solver ranks; rule holds the limit', src: '14.7.2', level: 'L3 with weekly sample', max: 3, plat: 'Procurement suite', cp: true, rev: 'hard', rank: 13, cite: '14.7.2' },
    { id: 'obligations', s: 'procurement', d: 'Extract obligations from signed contracts', eng: 'Agent', src: '14.8.1', level: 'L2, then L3 for low-risk fields', max: 3, plat: 'Contract system', rev: 'easy', rank: 14, cite: '14.8.1' },
    { id: 'strategic', s: 'procurement', d: 'Award strategic or direct-material events over USD 1M', eng: 'Person; agent analyzes', src: '14.7.2', level: 'L1-L2', max: 2, plat: 'Procurement suite', cp: true, rev: 'irrev', cite: '14.7.2' },

    { id: 'safety-stock', s: 'supply', d: 'Set safety stock', eng: 'Model + solver + rule', src: '04.14', level: 'L3 under 20% change', max: 3, plat: 'Planning', core: true, plant: true, rev: 'easy', rank: 11, cite: '04.14' },
    { id: 'supplier-delay', s: 'supply', d: 'Flag supplier delay risk', eng: 'Model; agent explains', src: '04.14', level: 'L1-L2', max: 2, plat: 'Planning', rev: 'easy', rank: 15, cite: '04.14' },
    { id: 'reschedule', s: 'supply', d: 'Respond to a supplier change: reschedule or alternate source', eng: 'Agent + solver + rule', src: '15.3.3', level: 'Reschedule L3; alternate source L2', max: 3, plat: 'ERP and planning', cross: true, core: true, plant: true, rev: 'hard', rank: 16, cite: '15.3.3' },
    { id: 'spares', s: 'supply', d: 'Set spare-part service by criticality', eng: 'Rule + model', src: '15.5.2', level: 'Line-stop parts L2; reduced output L3; no impact L4', max: 4, plat: 'Asset system', plant: true, rev: 'easy', rank: 17, cite: '15.5.2' },
    { id: 'safety', s: 'supply', d: 'Any action that touches safety or regulated quality', eng: 'Person', src: '15.4.1', level: 'Never above L2', max: 2, plat: 'Plant', plant: true, rev: 'irrev', cite: '15.4.1' },

    { id: 'lead', s: 'front', d: 'Qualify leads against fixed criteria', eng: 'Rule + model', src: '16.3.1', level: 'L3', max: 3, plat: 'CRM', rev: 'easy', rank: 18, cite: '16.3.1' },
    { id: 'quote', s: 'front', d: 'Send quotes inside price bands', eng: 'Rule', src: '16.4.1', level: '0-5% discount L3; 5-15% L2; above 15% L1', max: 3, plat: 'CRM', cp: true, rev: 'hard', rank: 19, cite: '16.4.1' },
    { id: 'service', s: 'front', d: 'Answer order status and approve returns within policy', eng: 'Agent answers from systems; rule sets the limit', src: '16.5.2', level: 'Order status L4; returns L3 up to a value limit', max: 4, plat: 'CRM', cross: true, cp: true, rev: 'easy', rank: 6, cite: '16.5.2' },
    { id: 'hiring', s: 'front', d: 'Evaluate job applicants', eng: 'Person; agents organize, humans evaluate', src: '16.7.1', level: 'L0-L1 for job decisions', max: 1, plat: 'HR suite', rev: 'irrev', cite: '16.1.3' },

    { id: 'service-desk', s: 'it', d: 'Answer how-to and policy questions at the service desk', eng: 'Agent cites a knowledge article', src: '17.3.1', level: 'L4', max: 4, plat: 'IT service suite', rev: 'easy', rank: 3, cite: '17.3.1' },
    { id: 'ticket', s: 'it', d: 'Route IT tickets', eng: 'Model + rule', src: '04.14', level: 'L3', max: 3, plat: 'IT service suite', rev: 'easy', rank: 20, cite: '04.14' },
    { id: 'access', s: 'it', d: 'Grant access inside the role bundle', eng: 'Rule (SoD check)', src: '17.3.1', level: 'L3 inside the bundle; L1-L2 outside', max: 3, plat: 'IT service suite', rev: 'easy', rank: 21, cite: '17.3.1' },
    { id: 'change', s: 'it', d: 'Run standard changes in the window', eng: 'Workflow', src: '17.4.2', level: 'Standard L3; production data changes L1', max: 3, plat: 'IT service suite', rev: 'hard', rank: 22, cite: '17.4.2' },

    { id: 'tax-flag', s: 'tax', d: 'Flag a tax-code anomaly', eng: 'Rule decides; agent flags', src: '18.3.2', level: 'L4 (flag only; the engine result stands)', max: 4, plat: 'Tax engine', rev: 'easy', rank: 23, cite: '18.3.2' },
    { id: 'einvoice', s: 'tax', d: 'Pre-validate outbound e-invoices', eng: 'Rule (deterministic validator); agent explains failures', src: '18.4.3', level: 'L4', max: 4, plat: 'Tax engine', rev: 'easy', rank: 24, cite: '18.4.3' },
    { id: 'tax-return', s: 'tax', d: 'Prepare a return and its reconciliation', eng: 'Agent + rule', src: '18.3.2', level: 'L3 (prepared package)', max: 3, plat: 'Tax engine', rev: 'easy', rank: 25, cite: '18.3.2' },
    { id: 'tax-file', s: 'tax', d: 'File a return or pay the tax', eng: 'Person', src: '18.3.2', level: 'L0 for the agent', max: 0, plat: 'Tax engine', rev: 'irrev', cite: '18.3.2' },

    { id: 'incident', s: 'ehs', d: 'Structure an incident report', eng: 'Agent', src: '19.11.1', level: 'L3', max: 3, plat: 'EHS system', rev: 'easy', rank: 26, cite: '19.11.1' },
    { id: 'capa', s: 'ehs', d: 'Send CAPA reminders and escalate overdue items', eng: 'Workflow', src: '19.11.1', level: 'L4', max: 4, plat: 'EHS system', rev: 'easy', rank: 27, cite: '19.11.1' },
    { id: 'recordable', s: 'ehs', d: 'Decide recordability and reportability', eng: 'Person', src: '19.11.1', level: 'L2 (person decides)', max: 2, plat: 'EHS system', rev: 'irrev', cite: '19.11.1' },
    { id: 'regulator', s: 'ehs', d: 'Notify or file with a regulator', eng: 'Person', src: '19.11.1', level: 'L2 (person files and signs)', max: 2, plat: 'EHS system', rev: 'irrev', cite: '19.11.1' },

    { id: 'nda', s: 'legal', d: 'Triage NDAs', eng: 'Agent', src: '20.2.1', level: 'Own paper L3; third-party paper L2', max: 3, plat: 'Contract system', rev: 'easy', rank: 28, cite: '20.2.1' },
    { id: 'legal-oblig', s: 'legal', d: 'Extract obligations into dated records', eng: 'Agent', src: '20.2.1', level: 'L2, then L3 for low-risk fields', max: 3, plat: 'Contract system', rev: 'easy', rank: 29, cite: '20.2.1' },
    { id: 'reg-change', s: 'legal', d: 'Monitor regulatory change', eng: 'Agent reads; compliance owner decides', src: '20.2.1', level: 'L1-L2', max: 2, plat: 'Compliance', rev: 'easy', cite: '20.2.1' },
    { id: 'holds', s: 'legal', d: 'Issue legal hold notices', eng: 'Agent drafts; counsel issues', src: '20.2.1', level: 'Notices L2; privilege calls L1', max: 2, plat: 'Legal', rev: 'hard', cite: '20.2.1' }
  ];

  /* ---------- The book's Meridian case, as inputs ---------- */
  var MERIDIAN = {
    industry: 'manufacturing', revenue: '2b-10b',
    cores: { legacyErp: 2, mainframe: 1, cloud: 5, homegrown: 0 },
    interfaces: '300-1000',
    streams: ['r2r', 'i2c', 'procurement', 'front', 'it'],
    ot: false,
    ready: { data: ['access', 'freshness'], platform: ['availability', 'recovery'], gov: [] },
    outcomes: ['capacity', 'wc', 'leakage'],
    appetite: 'balanced',
    erpQ: { q1: true, q2: true, q3: true, q4: false, q5: true },
    hgQ: { q1: false, q2: true, q3: false, q4: false, q5: false },
    mfQ: { risk: false, standard: false, stable: true }
  };

  var ids = function (list) { return list.map(function (x) { return x[0]; }); };
  function pick(v, list, dflt) { return ids(list).indexOf(v) >= 0 ? v : dflt; }
  function clampInt(n) { n = Math.floor(+n); return isFinite(n) ? Math.max(0, Math.min(9, n)) : 0; }
  function only(arr, allowed) { arr = Array.isArray(arr) ? arr : []; return allowed.filter(function (x) { return arr.indexOf(x) >= 0; }); } // canonical order
  function bools(o, keys) { var r = {}; keys.forEach(function (k) { r[k] = !!(o && o[k]); }); return r; }

  /** Clean any input object into a known shape. Unknown values fall back to safe defaults. */
  function normalize(i) {
    i = i || {};
    var c = i.cores || {};
    var ready = i.ready || {};
    var r = {};
    LAYERS.forEach(function (L) { r[L.id] = only(ready[L.id], ids(L.items)); });
    return {
      industry: pick(i.industry, INDUSTRIES, 'other'),
      revenue: pick(i.revenue, REVENUE, '500m-2b'),
      cores: { legacyErp: clampInt(c.legacyErp), mainframe: clampInt(c.mainframe), cloud: clampInt(c.cloud), homegrown: clampInt(c.homegrown) },
      interfaces: pick(i.interfaces, INTERFACES, '100-300'),
      streams: only(i.streams, ids(STREAMS)),
      ot: !!i.ot,
      ready: r,
      outcomes: only(i.outcomes, OUTCOMES.map(function (o) { return o.id; })).slice(0, 3),
      appetite: pick(i.appetite, APPETITE, 'balanced'),
      erpQ: bools(i.erpQ, ids(CORE_Q)),
      hgQ: bools(i.hgQ, ids(CORE_Q)),
      mfQ: bools(i.mfQ, ids(MF_Q))
    };
  }

  /* ---------- Rules ---------- */
  function archetype(i) {
    var c = i.cores, legacy = c.legacyErp + c.mainframe + c.homegrown;
    var big = i.interfaces === '300-1000' || i.interfaces === 'gt1000';
    var s = { meridian: [], atlas: [], harbor: [], northwind: [] };
    var add = function (k, pts, why) { s[k].push([pts, why]); };
    if (c.legacyErp >= 2) add('meridian', 3, 'several legacy ERPs');
    else if (c.legacyErp === 1) add('meridian', 1, 'a legacy ERP');
    if (c.mainframe >= 1) add('meridian', 2, 'a mainframe running core logic');
    if (big) add('meridian', 2, 'hundreds of interfaces');
    if (i.revenue === '2b-10b' || i.revenue === 'gt10b') add('meridian', 1, 'large revenue');
    if (i.industry === 'manufacturing') add('meridian', 1, 'manufacturing');
    if (i.ot) add('atlas', 4, 'a regulator or OT boundary on the critical path');
    if (i.industry === 'utilities') add('atlas', 1, 'utilities or energy');
    if (legacy === 0) add('harbor', 3, 'no legacy core, so no core clock');
    if (i.industry === 'services') add('harbor', 1, 'a services business');
    if (i.revenue === '500m-2b') add('harbor', 1, 'mid-size revenue');
    if (c.cloud >= 2) add('harbor', 1, 'several cloud suites');
    if (c.homegrown >= 1 && c.legacyErp === 0 && c.mainframe === 0) add('northwind', 2, 'a homegrown core to wrap');
    if (i.revenue === 'lt500m') add('northwind', 2, 'a smaller company with little capacity to build');
    if (i.industry === 'retail') add('northwind', 1, 'retail');
    if (i.interfaces === 'lt100') add('northwind', 1, 'few interfaces');
    var score = function (k) { return s[k].reduce(function (a, x) { return a + x[0]; }, 0); };
    var best = ORDER.slice().sort(function (a, b) { return score(b) - score(a) || ORDER.indexOf(a) - ORDER.indexOf(b); });
    var id = best[0];
    return {
      id: id, a: ARCHETYPES[id], why: s[id].map(function (x) { return x[1]; }), score: score(id),
      runnerUp: score(best[1]) >= 2 ? ARCHETYPES[best[1]].name : null,
      otOverlay: i.ot && id !== 'atlas'
    };
  }

  function erpStrategy(q) {
    if (!q.q1) return { list: ['Keep-and-wrap'], why: 'Support does not end before your earliest safe finish: keep and wrap the core, and revisit later.' };
    var list = [], why = [];
    if (!q.q2) { list.push('Selective transition'); why.push('the standard fits under 80%, so keep differentiating logic as extensions outside the core'); }
    if (q.q3) { list.push('Greenfield implementation'); why.push('several cores merge, and greenfield consolidation is usually cheaper than converting each'); }
    if (q.q4) { list.push(q.q3 ? 'Selective transition' : 'Brownfield conversion or selective transition'); why.push('converted history is needed in the new core'); }
    if (q.q5) { list.push('Two-tier'); why.push('small entities with simple needs take a lighter tier-2 ERP'); }
    if (q.q2 && !q.q3 && !q.q4) { list.push('Upgrade in place or the same vendor\u2019s cloud release'); why.push('the standard fits and nothing merges'); }
    var uniq = []; list.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    uniq.push('Composable / clean core');
    return { list: uniq, why: 'Support ends before your safe finish; ' + why.join('; ') + '. Clean core combines with any path.' };
  }

  function mfStrategy(q) {
    var then = q.risk ? 'Rehost to buy time, then refactor' : q.standard ? 'Replace in a later wave' : q.stable ? 'Refactor or rebuild behind the same API' : 'Keep wrapped; review yearly';
    return { list: ['Wrap first, always', then], why: q.risk ? 'Hardware or skills risk within 24 months.' : q.standard ? 'The new ERP covers this logic in standard.' : q.stable ? 'Differentiating logic with stable rules.' : 'No trigger to move the logic yet.' };
  }

  function clocks(i) {
    var c = i.cores, cores = [];
    if (c.legacyErp) cores.push({ kind: 'Legacy ERP', count: c.legacyErp, q: CORE_Q.map(function (x) { return [x[1], i.erpQ[x[0]]]; }), st: erpStrategy(i.erpQ), cite: '11.5.1' });
    if (c.homegrown) cores.push({ kind: 'Homegrown core', count: c.homegrown, q: CORE_Q.map(function (x) { return [x[0] === 'q1' ? 'Do skills or hardware risks end its safe life before your earliest safe finish?' : x[1], i.hgQ[x[0]]]; }), st: erpStrategy(i.hgQ), cite: '11.5.1' });
    if (c.mainframe) cores.push({ kind: 'Mainframe', count: c.mainframe, q: MF_Q.map(function (x) { return [x[1], i.mfQ[x[0]]]; }), st: mfStrategy(i.mfQ), cite: '11.12.2' });
    // A core clock runs when at least one core actually moves (any strategy other than keeping it wrapped).
    cores.forEach(function (x) { x.moves = !(x.st.list.length === 1 && x.st.list[0] === 'Keep-and-wrap') && x.st.list[1] !== 'Keep wrapped; review yearly'; });
    return { core: cores.some(function (x) { return x.moves; }), cores: cores, wrapOnly: cores.length > 0 && !cores.some(function (x) { return x.moves; }), earlyStart: c.cloud > 0 };
  }

  function foundations(i) {
    var layers = LAYERS.map(function (L) {
      var have = i.ready[L.id];
      return { id: L.id, name: L.name, have: have.length, of: L.items.length, ready: have.length === L.items.length,
        missing: L.items.filter(function (x) { return have.indexOf(x[0]) < 0; }).map(function (x) { return x[1]; }) };
    });
    var gate = null;
    for (var k = 0; k < layers.length; k++) if (!layers[k].ready) { gate = layers[k]; break; }
    var stage = layers[0].ready && layers[2].ready ? 2 : 1;
    return { layers: layers, gate: gate, stage: stage };
  }

  var STAGE_PERMITS = { 1: 'L1 everywhere; L2 in pilots with full review', 2: 'L2 broadly; L3 in slices for non-financial, reversible actions' };

  function routing(i) {
    return STREAMS.filter(function (s) { return i.streams.indexOf(s[0]) >= 0; }).map(function (s) {
      return { id: s[0], name: s[1], ch: s[2], decisions: DECISIONS.filter(function (d) { return d.s === s[0]; }) };
    });
  }

  function ceilingOf(d, i, f) {
    var c = d.max, notes = [];
    if (i.ot && d.plant && c > 1) { c = 1; notes.push('plant agents stay advisory behind the OT boundary (Ch 26.1.3)'); }
    var pre = c;
    if (!f.layers[0].ready && pre > 2) notes.push('L2 until its data passes the quality gate (Ch 01.5.4)');
    if (d.cp && pre > 1) notes.push('one level lower for the first 90 days at a new level, because it commits the company to a third party (Ch 01.5.4)');
    return { ceil: c, notes: notes };
  }

  function pilots(i, ck, f) {
    var pool = DECISIONS.filter(function (d) { return d.rank && i.streams.indexOf(d.s) >= 0 && d.max >= 2 && !(i.ot && d.plant); })
      .sort(function (a, b) { return a.rank - b.rank; });
    var chosen = [], plats = [];
    // Three different platforms where possible, by rank; then make sure one pilot crosses a platform boundary.
    pool.forEach(function (d) { if (chosen.length < 3 && plats.indexOf(d.plat) < 0) { chosen.push(d); plats.push(d.plat); } });
    var cross = pool.filter(function (d) { return d.cross; })[0];
    if (cross && !chosen.some(function (x) { return x.cross; })) { if (chosen.length === 3) chosen.pop(); chosen.push(cross); }
    pool.forEach(function (d) { if (chosen.length < 3 && chosen.indexOf(d) < 0) chosen.push(d); });
    chosen.sort(function (a, b) { return a.rank - b.rank; });
    var startLevel = f.stage >= 2 ? 'Shadow, then L2 broadly' : 'Shadow, then L1; L2 only in the pilot with full review';
    return chosen.map(function (d, k) {
      var cl = ceilingOf(d, i, f);
      return {
        n: k + 1, d: d, learning: i.cores.legacyErp > 0 && !!d.core,
        start: startLevel, ceil: cl.ceil, notes: cl.notes, rev: { easy: 'Easily reversible', hard: 'Hard to reverse', irrev: 'Irreversible' }[d.rev]
      };
    });
  }

  function risks(i, ck, f, arch) {
    var c = i.cores, out = [];
    var add = function (id, name, why, cat) { if (!out.some(function (r) { return r.id === id; })) out.push({ id: id, name: name, why: why, cite: cat }); };
    var data = f.layers[0], gov = f.layers[2];
    var hasData = function (k) { return i.ready.data.indexOf(k) >= 0; };
    var hasGov = function (k) { return i.ready.gov.indexOf(k) >= 0; };
    if (ck.core) add('COR-01', 'Migration larger than estimated', 'You have a legacy core to move.', '26.10.2');
    if (c.legacyErp >= 2 && ck.core) add('INT-02', 'Bridges break intercompany', 'Several legacy ERPs run side by side during the waves.', '26.10.3');
    if (!hasData('authority') || !hasData('ownership')) add('DAT-01', 'Master data duplicates', 'Source authority or ownership is not yet evidenced.', '26.10.4');
    add('CTL-01', 'Rubber-stamp approvals', 'Every pilot starts with people approving agent proposals.', '26.10.6');
    if (i.outcomes.indexOf('capacity') >= 0) add('STR-02', 'Freed capacity absorbed', 'You chose capacity as an outcome.', '26.10.1');
    if (i.outcomes.indexOf('capacity') >= 0 || i.streams.indexOf('front') >= 0) add('PPL-01', 'Fear and bypass', 'Agents take over tasks people do today.', '26.10.7');
    if (c.cloud >= 2) add('VND-03', 'Metering and price changes', 'Several cloud suites each ship a meter.', '26.10.8');
    if (c.mainframe || ck.wrapOnly) add('INT-04', 'Mainframe wrap late', (c.mainframe ? 'Agents depend on APIs in front of the mainframe.' : 'Agents depend on the APIs that wrap your core.'), '26.10.3');
    if (i.streams.indexOf('supply') >= 0 && (c.legacyErp + c.cloud) >= 2) add('AGT-04', 'Error cascades across agents', 'Supply chain chains agents from demand to buying.', '26.10.5');
    if (ck.core) add('VND-01', 'Capability not GA', 'Core waves may plan on capabilities not yet generally available.', '26.10.8');
    if (i.interfaces === '300-1000' || i.interfaces === 'gt1000') add('INT-01', 'Hidden interfaces found late', 'Hundreds of interfaces rarely have a complete inventory.', '26.10.3');
    if (ck.core) add('COR-02', 'Migration starves agent work of key users', 'The same key users serve the migration and the agents.', '26.10.2');
    if (!hasGov('trace')) add('DAT-04', 'Traces not retained or queryable', 'Tracing and reversal are not yet evidenced.', '26.10.4');
    if (!hasGov('humans') || !hasGov('trace')) add('CTL-06', 'Kill switch without staffed fallback', 'When humans step in, and how actions reverse, is not yet evidenced.', '26.10.6');
    if (c.cloud + c.legacyErp >= 2) add('CTL-02', 'Conflicting duties across platforms', 'Agents will hold identities on more than one platform.', '26.10.6');
    if (i.ot || arch.id === 'atlas') add('CTL-05', 'High-risk AI use without its controls', 'A regulator sits on your critical path.', '26.10.6');
    if (i.appetite === 'ambitious') add('AGT-02', 'Agent promoted without evidence', 'An ambitious appetite pushes promotions ahead of evidence.', '26.10.5');
    if (i.streams.indexOf('supply') >= 0) add('AGT-05', 'Forecasting model degrades in a new regime', 'Supply chain decisions rest on forecasts.', '26.10.5');
    if (!data.ready) add('DAT-03', 'Definitions differ across entities', 'Lineage and shared definitions are not yet in place.', '26.10.4');
    void gov;
    return out;
  }

  function timeline(arch, ck) {
    var a = arch.a;
    // Meridian's five phases and gates (Table 26.4); other archetypes scale them to their Table 26.2 range.
    var P = [['0 Mobilize', 0, 3, 'G0'], ['1 Foundation and pilots', 3, 13, 'G1'], ['2 First go-live', 13, 19, 'G2'], ['3 Scale', 19, 30, 'G3'], ['4 Run', 30, 33, 'G4']];
    if (arch.id === 'meridian') {
      return { months: true, exact: true, total: 33, note: '30 months to G3, then 3 months of handover. Earliest safe finish with 25% contingency: about month 38 (Ch 11.3.2).',
        phases: P.map(function (p) { return { name: p[0], from: p[1] + 1, to: p[2], gate: p[3], label: 'Months ' + (p[1] + 1) + '-' + p[2] }; }), cite: '26.3.1' };
    }
    if (!a.range) {
      return { months: false, total: 33, note: 'The book gives no duration for this archetype: the regulator and the OT boundary set the pace.',
        phases: P.map(function (p) { return { name: p[0], from: p[1] + 1, to: p[2], gate: p[3], label: 'Pace set by the regulator' }; }), cite: '26.1.3' };
    }
    var lo = a.range[0], hi = a.range[1], mid = (lo + hi) / 2;
    var m = function (x, r) { return Math.max(1, Math.round(x / 30 * r)); };
    var phases = P.map(function (p, k) {
      var toLo = m(p[2], lo), toHi = m(p[2], hi);
      // Drawn at the middle of the range so the bars never overlap; the label carries the range.
      return { name: p[0], from: k ? P[k - 1][2] / 30 * mid + 1 : 1, to: p[2] / 30 * mid, gate: p[3], label: 'Ends month ' + (toLo === toHi ? toLo : toLo + '-' + toHi) };
    });
    var note = lo + '-' + hi + ' months to G3, scaled from Meridian\u2019s phase shape.';
    if (!ck.core) note += ' With no core clock, phase 2 is the first agents promoted, not a core go-live.';
    if (ck.core && arch.id !== 'meridian') note += ' A core that moves adds a core clock this archetype does not have: plan for the upper end or longer.';
    return { months: true, exact: false, total: 33 / 30 * mid, axisEnd: m(33, hi), note: note, phases: phases, cite: '26.1.3' };
  }

  function first90(i, ck, f, arch, pl) {
    var L = [];
    L.push(['Write each outcome as one sentence and test it: metric, baseline and target, date, one executive, a guardrail.', '21.2.1']);
    L.push(['Charter, team, signed baselines and architecture decisions.', '26.3.1']);
    if (ck.core) L.push(['Run the five questions once per legacy core; the steering committee approves a strategy per core (gate 1).', '11.5.2']);
    if (ck.core) L.push(['Check each support deadline against your earliest safe finish: start + duration + 25% contingency.', '11.3.2']);
    if (f.gate) L.push(['Fund ' + f.gate.name.toLowerCase() + ' first. Show evidence for: ' + f.gate.missing.join(', ').toLowerCase() + '.', '26.2.1']);
    L.push(['Approve the governance plane design and the do-not-automate list.', '26.3.5']);
    if (i.ot || arch.id === 'atlas') L.push(['Define what agents may never touch: control loops stay deterministic and local.', '01.7.4']);
    L.push(['Score the risk register: one named executive owner per risk.', '26.9.1']);
    L.push(['Name an agent business owner for each pilot.', '24.3.2']);
    L.push(['Get ' + (pl.length === 1 ? 'one shadow agent' : pl.length + ' shadow agents') + ' running, each with signed criteria, stop criteria and a disposition date.', '26.6.1']);
    L.push(['End of month 3, gate G0: go, go with dated conditions, or stop.', '26.3.3']);
    return L;
  }

  function compute(input) {
    var i = normalize(input);
    var arch = archetype(i);
    var ck = clocks(i);
    var f = foundations(i);
    var pl = pilots(i, ck, f);
    return {
      input: i, archetype: arch, clocks: ck, foundations: f, stagePermits: STAGE_PERMITS[f.stage],
      outcomes: OUTCOMES.filter(function (o) { return i.outcomes.indexOf(o.id) >= 0; }),
      routing: routing(i), timeline: timeline(arch, ck), first90: first90(i, ck, f, arch, pl), pilots: pl,
      risks: risks(i, ck, f, arch), isMeridian: same(i, normalize(MERIDIAN))
    };
  }

  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  /** A short, personal-data-free summary for the guide. */
  function summary(r) {
    var c = r.input.cores;
    var parts = [];
    if (c.legacyErp) parts.push(c.legacyErp + ' legacy ERP' + (c.legacyErp > 1 ? 's' : ''));
    if (c.mainframe) parts.push(c.mainframe + ' mainframe' + (c.mainframe > 1 ? 's' : ''));
    if (c.homegrown) parts.push(c.homegrown + ' homegrown core' + (c.homegrown > 1 ? 's' : ''));
    if (c.cloud) parts.push(c.cloud + ' cloud suite' + (c.cloud > 1 ? 's' : ''));
    var gate = r.foundations.gate ? r.foundations.gate.name.toLowerCase() : 'agents (all three foundations evidenced)';
    var s = 'My estate looks closest to ' + r.archetype.a.name + ' (' + (parts.join(', ') || 'no core systems listed') + '). '
      + (r.clocks.core ? 'We have a core clock. ' : 'We have no core clock. ')
      + 'Investment is gated by ' + gate + '. '
      + 'Pilot candidates: ' + r.pilots.map(function (p) { return p.d.d.charAt(0).toLowerCase() + p.d.d.slice(1); }).join('; ') + '. '
      + 'What should we decide first, and what would make you change this plan?';
    return s.slice(0, 590);
  }

  /** One line for the live status strip. */
  function strip(r) {
    var g = r.foundations.gate;
    return (r.isMeridian ? 'Showing the book\u2019s Meridian example. ' : 'Showing your scenario. ')
      + 'Closest archetype: ' + r.archetype.a.name + '. '
      + (g ? 'Invest now in ' + g.name.toLowerCase() + '. ' : 'All three foundations are evidenced. ')
      + r.pilots.length + ' pilot candidate' + (r.pilots.length === 1 ? '' : 's') + '.';
  }

  /* ---------- HTML ---------- */
  function chk(name, value, checked, label, extra) {
    return '<label class="rm-check"><input type="checkbox" name="' + name + '" value="' + value + '"' + (checked ? ' checked' : '') + (extra || '') + '> <span>' + esc(label) + '</span></label>';
  }
  function radios(name, list, v) {
    return list.map(function (x) { return '<label class="rm-check"><input type="radio" name="' + name + '" value="' + x[0] + '"' + (x[0] === v ? ' checked' : '') + '> <span>' + esc(x[1]) + '</span></label>'; }).join('');
  }
  function yesno(name, q, v) {
    return '<fieldset class="rm-yn"><legend>' + esc(q) + '</legend><label class="rm-check"><input type="radio" name="' + name + '" value="yes"' + (v ? ' checked' : '') + '> <span>Yes</span></label><label class="rm-check"><input type="radio" name="' + name + '" value="no"' + (!v ? ' checked' : '') + '> <span>No</span></label></fieldset>';
  }

  /** The input panel, prefilled. Plain controls, no form element; the script recomputes on every change. */
  function renderInputs(input) {
    var i = normalize(input);
    var h = [];
    h.push('<fieldset class="rm-fs"><legend>1. Your company</legend>');
    h.push('<div class="rm-row"><label class="rm-field" for="rm-industry"><span>Industry</span><select id="rm-industry" name="industry">' + INDUSTRIES.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === i.industry ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select></label>');
    h.push('<label class="rm-field" for="rm-revenue"><span>Revenue</span><select id="rm-revenue" name="revenue">' + REVENUE.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === i.revenue ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select></label></div>');
    h.push('</fieldset>');

    h.push('<fieldset class="rm-fs"><legend>2. Core systems</legend><p class="rm-hint" id="rm-cores-hint">Count each system. Enter 0 if you have none.</p><div class="rm-grid">');
    CORES.forEach(function (x) {
      h.push('<label class="rm-field rm-num" for="rm-' + x[0] + '"><span>' + esc(x[1]) + '</span><input id="rm-' + x[0] + '" name="' + x[0] + '" type="number" inputmode="numeric" min="0" max="9" step="1" value="' + i.cores[x[0]] + '" aria-describedby="rm-' + x[0] + '-h"><small id="rm-' + x[0] + '-h">' + esc(x[2]) + '</small></label>');
    });
    h.push('</div>');
    h.push('<label class="rm-field" for="rm-interfaces"><span>Interfaces between systems</span><select id="rm-interfaces" name="interfaces">' + INTERFACES.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === i.interfaces ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select></label>');
    h.push('</fieldset>');

    h.push('<fieldset class="rm-fs" data-core="legacyErp"' + (i.cores.legacyErp ? '' : ' hidden') + '><legend>Five questions for your legacy ERPs</legend><p class="rm-hint">Answer for the group. In practice, ask them once per core.</p>');
    CORE_Q.forEach(function (x) { h.push(yesno('erp-' + x[0], x[1], i.erpQ[x[0]])); });
    h.push('</fieldset>');
    h.push('<fieldset class="rm-fs" data-core="homegrown"' + (i.cores.homegrown ? '' : ' hidden') + '><legend>Five questions for your homegrown cores</legend><p class="rm-hint">Read support as skills and hardware risk.</p>');
    CORE_Q.forEach(function (x) { h.push(yesno('hg-' + x[0], x[0] === 'q1' ? 'Do skills or hardware risks end its safe life before your earliest safe finish?' : x[1], i.hgQ[x[0]])); });
    h.push('</fieldset>');
    h.push('<fieldset class="rm-fs" data-core="mainframe"' + (i.cores.mainframe ? '' : ' hidden') + '><legend>Your mainframe logic</legend><p class="rm-hint">Wrap first, always. These answers pick the long-term pattern.</p>');
    MF_Q.forEach(function (x) { h.push(yesno('mf-' + x[0], x[1], i.mfQ[x[0]])); });
    h.push('</fieldset>');

    h.push('<fieldset class="rm-fs"><legend>3. Value streams in scope</legend><p class="rm-hint">Pick the domains you want agents to work in first.</p><div class="rm-checks">');
    STREAMS.forEach(function (x) { h.push(chk('streams', x[0], i.streams.indexOf(x[0]) >= 0, x[1])); });
    h.push('</div></fieldset>');

    h.push('<fieldset class="rm-fs"><legend>4. Regulated or OT boundary</legend><p class="rm-hint">Is a regulator or a plant-control (OT) boundary on your critical path?</p><div class="rm-checks rm-inline">' + radios('ot', [['yes', 'Yes'], ['no', 'No']], i.ot ? 'yes' : 'no') + '</div></fieldset>');

    h.push('<fieldset class="rm-fs"><legend>5. Foundations: what can you show evidence for?</legend><p class="rm-hint">Tick only what you could show an auditor today.</p>');
    LAYERS.forEach(function (L) {
      h.push('<fieldset class="rm-sub"><legend>' + esc(L.name) + '</legend><div class="rm-checks">');
      L.items.forEach(function (x) { h.push(chk('ready-' + L.id, x[0], i.ready[L.id].indexOf(x[0]) >= 0, x[1])); });
      h.push('</div></fieldset>');
    });
    h.push('</fieldset>');

    h.push('<fieldset class="rm-fs"><legend>6. Top outcomes (up to three)</legend><p class="rm-hint" id="rm-out-hint">Pick up to three value types. Start from outcomes, not agents.</p><div class="rm-checks">');
    OUTCOMES.forEach(function (o) { h.push(chk('outcomes', o.id, i.outcomes.indexOf(o.id) >= 0, o.name, ' aria-describedby="rm-out-hint"')); });
    h.push('</div></fieldset>');

    h.push('<fieldset class="rm-fs"><legend>7. Risk appetite</legend><p class="rm-hint">Appetite changes the pace and the risks to watch, never the ceilings.</p><div class="rm-checks rm-inline">' + radios('appetite', APPETITE, i.appetite) + '</div></fieldset>');
    return h.join('\n');
  }

  function svgTimeline(t) {
    var W = 640, x0 = 4, span = W - 8, y = 34, H = 26;
    var tot = t.months ? t.total : 33;
    var pos = function (m) { return x0 + span * (m / tot); };
    var out = ['<svg class="rm-tl" viewBox="0 0 ' + W + ' 96" aria-hidden="true" focusable="false">'];
    t.phases.forEach(function (p, k) {
      var a = pos(p.from - 1), b = pos(p.to);
      out.push('<rect class="rm-ph rm-ph' + k + '" x="' + a.toFixed(1) + '" y="' + y + '" width="' + Math.max(2, b - a - 2).toFixed(1) + '" height="' + H + '" rx="3"></rect>');
      out.push('<text class="rm-ph-n" x="' + (a + 6).toFixed(1) + '" y="' + (y + 17) + '">' + p.name.charAt(0) + '</text>');
      out.push('<path class="rm-gate" d="M' + (b - 1).toFixed(1) + ' ' + (y - 12) + ' l6 6 l-6 6 l-6 -6 z"></path>');
      out.push('<text class="rm-gate-t" x="' + (b - 1).toFixed(1) + '" y="' + (y - 16) + '" text-anchor="' + (k === t.phases.length - 1 ? 'end' : 'middle') + '">' + p.gate + '</text>');
    });
    if (t.months) {
      out.push('<text class="rm-axis" x="' + x0 + '" y="86">Month 1</text>');
      out.push('<text class="rm-axis" x="' + (W - 4) + '" y="86" text-anchor="end">Month ' + (t.axisEnd ? 'about ' + t.axisEnd : tot) + '</text>');
    } else out.push('<text class="rm-axis" x="' + x0 + '" y="86">Relative phases; no durations in the book</text>');
    out.push('</svg>');
    return out.join('');
  }

  function section(id, title, citeTxt, body) {
    return '<section class="rm-out" id="out-' + id + '" aria-labelledby="h-' + id + '"><h3 id="h-' + id + '">' + esc(title) + '</h3>' + body + '<p class="rm-src">' + citeTxt + '</p></section>';
  }

  function renderResults(r) {
    var a = r.archetype, h = [];
    var label = r.isMeridian ? 'Illustrative example from the book: Meridian Industries' : 'Your scenario, computed in this browser from the book\u2019s rules';
    h.push('<p class="rm-label' + (r.isMeridian ? ' is-example' : '') + '">' + esc(label) + '</p>');

    h.push(section('archetype', 'Closest archetype: ' + a.a.name, cite(a.a.cite) + ' ' + cite('01.7.4'),
      '<p class="rm-big">' + esc(a.a.shape) + '.</p><p><b>Starting point in the book:</b> ' + esc(a.a.start) + '.</p>'
      + '<p><b>Why:</b> ' + (a.why.length ? esc(a.why.join('; ')) : 'no strong match, so the hardest case is the safe reference') + '.' + (a.runnerUp ? ' Next closest: ' + esc(a.runnerUp) + '.' : '') + '</p>'
      + (a.otOverlay ? '<p class="rm-flag"><b>OT overlay from Atlas Utilities:</b> control loops stay deterministic and local; agents work on the IT side of the boundary; plant agents stay advisory (L1).</p>' : '')));

    if (r.outcomes.length) {
      h.push(section('outcomes', 'Outcomes first', cite('21.2.1') + ' ' + cite('21.2.2'),
        '<p>An outcome is a measurable change in a business result, not an agent. Value each one with its formula.</p><ul class="rm-list">'
        + r.outcomes.map(function (o) { return '<li><b>' + esc(o.name) + ':</b> ' + esc(o.formula) + '. <span class="muted">Typical mistake: ' + esc(o.mistake) + '.</span></li>'; }).join('') + '</ul>'));
    }

    var ck = r.clocks;
    var clockBody = '<p class="rm-big">' + (ck.core ? 'You have a core clock and an autonomy clock.' : ck.wrapOnly ? 'No core clock yet: your cores stay and get wrapped, so the autonomy clock sets the pace.' : 'No core clock: only the autonomy clock runs.') + '</p>'
      + '<ul class="rm-list"><li><b>Core clock:</b> waves of 6-12 months, set by migration, testing, cutover rehearsals and support dates. It speeds up only a little, at high risk.</li>'
      + '<li><b>Autonomy clock:</b> promotions of 1-3 months, set by evidence. It speeds up only by collecting evidence faster.</li>'
      + (ck.core ? '<li><b>Rule:</b> sequence agents behind the waves, not in parallel with them.' + (ck.earlyStart ? ' Agents on cloud suites already in their target state can start early.' : '') + '</li>' : '') + '</ul>';
    ck.cores.forEach(function (c) {
      clockBody += '<div class="rm-core"><h4>' + esc(c.kind) + (c.count > 1 ? ' (' + c.count + ')' : '') + '</h4><ol class="rm-qa">'
        + c.q.map(function (q) { return '<li>' + esc(q[0]) + ' <b>' + (q[1] ? 'Yes' : 'No') + '</b></li>'; }).join('') + '</ol>'
        + '<p><b>Strategies that apply:</b> ' + esc(c.st.list.join(' + ')) + '.</p><p class="muted">' + esc(c.st.why) + ' ' + cite(c.cite) + '</p></div>';
    });
    if (ck.core) clockBody += '<p>Two human gates come before any build: the steering committee approves the strategy per core, then the wave plan.</p>';
    h.push(section('clocks', 'Two clocks', cite('26.1.1') + ' ' + cite('11.4.1') + ' ' + cite('11.5.2'), clockBody));

    var f = r.foundations;
    var fb = '<p class="rm-big">' + (f.gate ? 'Invest now in ' + esc(f.gate.name.toLowerCase()) + '. Bigger budgets above it wait for its evidence.' : 'All three foundations are evidenced. Agents can take a bigger budget.') + '</p><ol class="rm-layers">';
    f.layers.forEach(function (L, k) {
      var state = L.ready ? 'Ready' : (f.gate && f.gate.id === L.id ? 'Gates investment now' : 'Waits for the layer below');
      fb += '<li class="' + (L.ready ? 'is-ready' : f.gate && f.gate.id === L.id ? 'is-gate' : 'is-wait') + '"><b>' + (k + 1) + ' ' + esc(L.name) + '</b> <span class="rm-pill">' + state + '</span><br><span class="muted">' + L.have + ' of ' + L.of + ' evidenced' + (L.missing.length ? '. Missing: ' + esc(L.missing.join(', ').toLowerCase()) : '') + '.</span></li>';
    });
    fb += '<li class="' + (f.gate ? 'is-wait' : 'is-ready') + '"><b>4 Agents</b> <span class="rm-pill">' + (f.gate ? 'Waits for the layers below' : 'Can scale') + '</span></li></ol>';
    fb += '<p><b>Rule:</b> before a layer gets a bigger budget, show evidence that the layer beneath it is ready. No agent pilot that depends on a data product starts until that product passes its quality gate.</p>';
    fb += '<p><b>Starting stage:</b> ' + f.stage + '. It permits ' + esc(r.stagePermits) + '. The weakest dimension sets the stage; here only data and governance are rated, so confirm the rest with evidence. ' + cite('26.13.3') + '</p>';
    h.push(section('foundations', 'Foundations first', cite('26.2.1') + ' ' + cite('26.2.2'), fb));

    var rb = '<p>For each decision, use the simplest engine that can do the work:</p><ol class="rm-filter"><li>Stable logic you can write down: <b>rule or workflow</b>.</li><li>A prediction on tabular data: <b>model</b>.</li><li>An optimization with clear constraints: <b>solver</b>.</li><li>Investigation across sources, judgment on unstructured content and an action in a system: <b>agent</b>.</li></ol>';
    if (!r.routing.length) rb += '<p class="rm-flag">Pick at least one value stream to see its typical decisions.</p>';
    r.routing.forEach(function (s) {
      rb += '<div class="rm-stream"><h4>' + esc(s.name) + ' ' + cite(s.ch) + '</h4><div class="rm-table-wrap" tabindex="0" role="region" aria-label="' + esc(s.name) + ' decisions"><table class="rm-table"><thead><tr><th scope="col">Decision</th><th scope="col">Simplest engine</th><th scope="col">Level in the book</th><th scope="col">Source</th></tr></thead><tbody>'
        + s.decisions.map(function (d) { return '<tr><th scope="row">' + esc(d.d) + '</th><td data-label="Simplest engine">' + esc(d.eng) + '</td><td data-label="Level in the book">' + esc(d.level) + '</td><td data-label="Source">' + cite(d.cite) + '</td></tr>'; }).join('')
        + '</tbody></table></div></div>';
    });
    rb += '<p class="muted">Park a candidate before scoring if it has no data owner, is a prohibited practice, takes an irreversible action with no human gate, or runs where no platform can enforce its identity and tool limits. ' + cite('21.4.1') + '</p>';
    h.push(section('engines', 'Engine routing for your value streams', cite('21.3.2') + ' ' + cite('04.1.2') + ' Levels and limits in the book are illustrative.', rb));

    var t = r.timeline;
    var tb = '<p class="rm-big">' + esc(t.note) + '</p>' + svgTimeline(t) + '<ol class="rm-phases">'
      + t.phases.map(function (p) { return '<li><b>Phase ' + esc(p.name) + '</b> <span class="muted">' + esc(p.label) + '; exit gate ' + p.gate + '</span></li>'; }).join('') + '</ol>'
      + '<p>A gate is a decision, not a meeting: go, go with dated conditions, or stop. It passes when every value signal is at or above plan and no risk counterweight is worse than at the previous gate. ' + cite('26.3.3') + ' ' + cite('26.3.5') + '</p>';
    h.push(section('timeline', 'Phases and gates', cite(t.cite) + ' ' + cite(t.cite === '26.3.1' ? '26.3.2' : '26.3.1') + (t.exact ? ' Months are Meridian\u2019s illustrative plan.' : t.months ? ' Ranges are scaled from the book\u2019s ranges; treat them as illustrative.' : ''), tb));

    h.push(section('first90', 'Your first 90 days', cite('26.3.1') + ' ' + cite('26.3.2'),
      '<ol class="rm-check90">' + r.first90.map(function (x) { return '<li>' + esc(x[0]) + ' ' + cite(x[1]) + '</li>'; }).join('') + '</ol>'));

    var pb = '<p>Choose the first pilots to test the operating model, not only the technology: a trusted baseline, reversible and bounded errors, owned data, a named key user, and at least one that crosses a platform boundary.</p>';
    if (!r.pilots.length) pb += '<p class="rm-flag">No pilot candidates yet. Pick a value stream with decisions an agent can take.</p>';
    else pb += '<ol class="rm-pilots">' + r.pilots.map(function (p) {
      return '<li><h4>' + esc(p.d.d) + '</h4><dl>'
        + '<div><dt>Platform</dt><dd>' + esc(p.d.plat) + (p.d.cross ? ' (crosses a platform boundary)' : '') + '</dd></div>'
        + '<div><dt>Engine</dt><dd>' + esc(p.d.eng) + '</dd></div>'
        + '<div><dt>In shadow by</dt><dd>Month 3, as G0 evidence</dd></div>'
        + '<div><dt>Decision due</dt><dd>End of month 5: promote to shadow at scale, redesign or stop</dd></div>'
        + '<div><dt>Start</dt><dd>' + esc(p.start) + '</dd></div>'
        + '<div><dt>Ceiling</dt><dd>' + lv(p.ceil) + ' (' + esc(p.rev.toLowerCase()) + ')' + (p.notes.length ? '; ' + esc(p.notes.join('; ')) : '') + '</dd></div>'
        + '</dl>' + (p.learning ? '<p class="rm-flag">Learning pilot: it reads legacy data through read-only tools and builds the evaluation set. The production agent waits for its wave.</p>' : '')
        + '<p class="muted">Level in the book: ' + esc(p.d.level) + '. ' + cite(p.d.cite) + '</p></li>';
    }).join('') + '</ol>';
    pb += '<p>Each pilot runs 8 weeks including a month-end, with criteria signed before the build. Shadow exit needs at least 300 cases, error at or below the human baseline and zero critical errors. ' + cite('26.6.3') + ' ' + cite('26.7.1') + '</p>';
    pb += '<p>Give every agent one business owner and a net contribution account from day one: value minus meters, compute, review, incidents and allocated cost. No account, no promotion. ' + cite('24.3.2') + ' ' + cite('25.4.12') + '</p>';
    pb += '<p class="muted">The start level and ceiling are set by reversibility and impact, not model quality. Appetite never raises a ceiling. ' + cite('21.4.3') + ' ' + cite('01.5.4') + '</p>';
    h.push(section('pilots', 'First three pilots and their autonomy', cite('26.6.2') + ' ' + cite('24.7.5'), pb));

    var top = r.risks.slice(0, 8), more = r.risks.slice(8);
    var rk = '<ul class="rm-risks">' + top.map(function (x) { return '<li><b>' + x.id + ' ' + esc(x.name) + '.</b> ' + esc(x.why) + ' ' + cite(x.cite) + '</li>'; }).join('') + '</ul>'
      + (more.length ? '<p class="muted">Also triggered: ' + more.map(function (x) { return x.id + ' ' + esc(x.name); }).join('; ') + '.</p>' : '')
      + '<p>Write each as cause, event and effect, with one named executive owner, a key risk indicator and dated mitigations. No gate passes with a red risk that has no dated mitigation.</p>';
    if (r.input.appetite === 'cautious') rk += '<p class="muted">Cautious appetite: write the appetite per category before Phase 1, starting with postings and customer communication. ' + cite('26.9.4') + '</p>';
    h.push(section('risks', 'Top risks your inputs trigger', cite('26.9.2') + ' ' + cite('26.9.1'), rk));
    return h.join('\n');
  }

  AE.reimagine = {
    INDUSTRIES: INDUSTRIES, REVENUE: REVENUE, INTERFACES: INTERFACES, CORES: CORES, STREAMS: STREAMS, LAYERS: LAYERS,
    OUTCOMES: OUTCOMES, APPETITE: APPETITE, CORE_Q: CORE_Q, MF_Q: MF_Q, ARCHETYPES: ARCHETYPES, DECISIONS: DECISIONS, MERIDIAN: MERIDIAN,
    normalize: normalize, compute: compute, summary: summary, strip: strip, renderInputs: renderInputs, renderResults: renderResults, esc: esc
  };
})(typeof window !== 'undefined' ? window : globalThis);
