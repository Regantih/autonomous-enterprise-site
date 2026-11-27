// Renders the static (no-JS) HTML for the Blueprints pages from the same data files the browser uses.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

export const BP_DATA_FILES = ['data/controls.js', 'data/layers.js', 'data/workflows.js', 'data/architecture.js'];

export function loadBlueprintData(assetsDir) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of BP_DATA_FILES) vm.runInContext(readFileSync(join(assetsDir, f), 'utf8'), ctx, { filename: f });
  return ctx.window.AE;
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cid = (id) => `<a class="cid" href="/controls/#${id}">${id}</a>`;
const lvl = (n) => (n == null ? 'Rule' : `L${n}`);

export const SUBNAV = [
  ['architecture', '/architecture/', 'Architecture'],
  ['workflows', '/workflows/', 'Workflows'],
  ['controls', '/controls/', 'Controls'],
  ['designer', '/designer/', 'Designer'],
  ['trace', '/blueprints/trace/', 'Trace viewer'],
  ['loops', '/blueprints/loops/', 'Improvement loops'],
  ['graphs', '/blueprints/graphs/', 'Graphs'],
  ['models', '/blueprints/models/', 'Models'],
  ['design', '/blueprints/design/', 'Design choices'],
  ['organization', '/blueprints/organization/', 'Organization'],
  ['operations', '/blueprints/operations/', 'Operations'],
];

// One journey through the eleven tools: decide who owns what and which models fit, build the stack, run it.
// The first tool in each track is its starting point.
export const TRACKS = [
  { id: 'decide', name: 'Decide', purpose: 'Who owns each decision, which design choices hold and which models fit.', tools: ['organization', 'design', 'models'] },
  { id: 'build', name: 'Build', purpose: 'Lay out the stack, reimagine the workflows and design your own.', tools: ['architecture', 'workflows', 'designer', 'graphs'] },
  { id: 'run', name: 'Run', purpose: 'Control, operate, trace and improve agents once they are live.', tools: ['controls', 'operations', 'trace', 'loops'] },
];

const TOOL = Object.fromEntries(SUBNAV.map(([k, href, label]) => [k, { key: k, href, label }]));

export function trackOf(key) {
  const t = TRACKS.find((tr) => tr.tools.includes(key));
  return t ? { track: t, index: t.tools.indexOf(key) } : null;
}

/** Previous and next stop for a tool: within its track, then across to the next track's starting point. */
export function neighbours(key) {
  const at = trackOf(key);
  if (!at) return null;
  const { track, index } = at;
  const ti = TRACKS.indexOf(track);
  const prev = index > 0
    ? { ...TOOL[track.tools[index - 1]], kind: 'Previous' }
    : { href: '/blueprints/#tracks', label: 'All blueprints', kind: 'Back to' };
  let next;
  if (index < track.tools.length - 1) next = { ...TOOL[track.tools[index + 1]], kind: 'Next' };
  else if (ti < TRACKS.length - 1) {
    const nt = TRACKS[ti + 1];
    next = { ...TOOL[nt.tools[0]], kind: `Next track: ${nt.name}` };
  } else next = { href: '/blueprints/#tracks', label: 'All blueprints', kind: 'Back to' };
  return { track, prev, next };
}

export function subnav(current) {
  // The hub lists every tool in its track cards, so its bar only jumps to the three tracks.
  if (current === 'hub') return `<nav class="bp-subnav" aria-label="Blueprints">
  <div class="container">
    <a class="bp-subnav-home" href="/blueprints/" aria-current="page">Blueprints</a>
    <a class="bp-subnav-start" href="/reimagine/">Start here</a>
    <ul class="bp-subnav-jump" aria-label="Tracks on this page">
${TRACKS.map((t) => `      <li><a href="#${t.id}">${t.name}</a></li>`).join('\n')}
    </ul>
  </div>
</nav>`;
  const tracks = TRACKS.map((t) => {
    const here = t.tools.includes(current);
    return `    <div class="bp-track${here ? ' is-current' : ''}">
      <a class="bp-track-name" href="/blueprints/#${t.id}">${t.name}</a>
      <ul aria-label="${t.name} track">
${t.tools.map((k) => `        <li><a href="${TOOL[k].href}"${k === current ? ' aria-current="page"' : ''}>${TOOL[k].label}</a></li>`).join('\n')}
      </ul>
    </div>`;
  }).join('\n');
  return `<nav class="bp-subnav" aria-label="Blueprints">
  <div class="container">
    <a class="bp-subnav-home" href="/blueprints/"${current === 'hub' ? ' aria-current="page"' : ''}>Blueprints</a>
    <a class="bp-subnav-start" href="/reimagine/"${current === 'reimagine' ? ' aria-current="page"' : ''}>Start here</a>
    <div class="bp-tracks">
${tracks}
    </div>
  </div>
</nav>`;
}

const CARD = {
  architecture: ['Reference architecture', () => 'Nine layers, from channels to assurance. Click any part. Play eight architecture patterns and pick the right models.'],
  workflows: ['Reimagined workflows', (AE) => `${AE.workflows.length} workflows as swimlanes, today versus reimagined. Run a case and inject failures to see which control catches them.`],
  controls: ['Controls library', (AE) => `${AE.controls.length} controls, mapped to public frameworks. Filter by category, harness part, level, layer and use.`],
  designer: ['Workflow designer', () => 'Add your steps. Get the ceiling per step, the weakest link, the required controls and a blueprint to export.'],
  trace: ['Decision trace viewer', () => 'See what a team of agents did and which control fired. Compare a normal run with a faulty one, or load your own trace.'],
  loops: ['Self-improving loops', () => 'A live operations room. Agents propose and test improvements. You approve the one-way doors and catch reward hacking.'],
  graphs: ['Graphs and the enterprise brain', () => 'A real knowledge graph and skill graph. Ask a question and watch the brain route it, walk the graph and answer.'],
  models: ['Models', () => 'GPT-class, small, tabular, forecasting, graph, vision, video, voice and physical AI models. What each does and where it fits.'],
  design: ['Design choices', () => 'Tabular models, retrieval, evals and audits, security, inference budgets, and which steps go to models or rules.'],
  organization: ['Organization', () => 'New roles, pods and spans. Who sets autonomy, who answers for it, and a matrix of who does what.'],
  operations: ['Operations', () => 'What to trace, dashboards, audits, the kill switch, SLOs, and the skill, agent and release pipelines.'],
};

/** The hub's three tracks: each tool as a card, the first one marked as the place to start. */
export function hubTracks(AE) {
  return TRACKS.map((t, ti) => `<section class="bp-trackcard" id="${t.id}" aria-labelledby="track-${t.id}">
      <div class="bp-trackcard-head">
        <p class="bp-trackcard-n">Track ${ti + 1} of ${TRACKS.length}</p>
        <h3 id="track-${t.id}">${t.name}</h3>
        <p>${t.purpose}</p>
      </div>
      <ol class="bp-cards">
${t.tools.map((k, i) => `        <li class="bp-card${i === 0 ? ' bp-card-start' : ''}">${i === 0 ? '<span class="bp-start">Start here</span>' : `<span class="bp-card-n">Step ${i + 1}</span>`}<h4><a href="${TOOL[k].href}">${CARD[k][0]}</a></h4><p>${esc(CARD[k][1](AE))}</p></li>`).join('\n')}
      </ol>
    </section>`).join('\n    ');
}

/** Home teaser: one line per track and its starting tool. */
export function homeTracks() {
  return TRACKS.map((t) => `<li class="track-teaser"><h3>${t.name}</h3><p>${t.purpose}</p><a class="more" href="${TOOL[t.tools[0]].href}">Start with ${TOOL[t.tools[0]].label}</a></li>`).join('\n      ');
}

export function breadcrumb(current) {
  const at = trackOf(current);
  if (!at) return '';
  return `<nav class="crumbs" aria-label="Breadcrumb">
      <ol>
        <li><a href="/blueprints/">Blueprints</a></li>
        <li><a href="/blueprints/#${at.track.id}">${at.track.name}</a></li>
        <li><span aria-current="page">${TOOL[current].label}</span></li>
      </ol>
    </nav>`;
}

export function pager(current) {
  const n = neighbours(current);
  if (!n) return '';
  const link = (x, rel, cls) => `<a class="bp-pager-link ${cls}" href="${x.href}"${rel ? ` rel="${rel}"` : ''}><span class="bp-pager-k">${x.kind}</span> <span class="bp-pager-t">${x.label}</span></a>`;
  return `<nav class="bp-pager" aria-label="${n.track.name} track: previous and next">
  <div class="container">
    <div class="bp-pager-row">
      ${link(n.prev, n.prev.kind === 'Previous' ? 'prev' : '', 'bp-pager-prev')}
      ${link(n.next, n.next.kind === 'Next' ? 'next' : '', 'bp-pager-next')}
    </div>
    <p class="bp-pager-ask"><a class="more" href="/talk/" data-guide-open>Ask the book about this</a></p>
  </div>
</nav>`;
}

function mapList(m, AE) {
  const out = [];
  if (m.nist.length) out.push(`<li><b>NIST AI RMF</b> ${m.nist.join(', ')}</li>`);
  if (m.eu.length) out.push(`<li><b>EU AI Act</b> ${m.eu.map((a) => `Art. ${a} ${AE.euNames[a]}`).join('; ')}</li>`);
  if (m.owasp.length) out.push(`<li><b>OWASP LLM 2025</b> ${m.owasp.map((o) => `${o} ${AE.owaspNames[o]}`).join('; ')}</li>`);
  if (m.sox.length) out.push(`<li><b>SOX/COSO ITGC</b> ${m.sox.join(', ')}</li>`);
  if (m.iso42001) out.push('<li><b>ISO/IEC 42001</b> AI management system</li>');
  if (m.iec62443) out.push('<li><b>IEC 62443</b> Industrial automation security</li>');
  if (m.iso10218) out.push('<li><b>ISO 10218</b> Industrial robot safety</li>');
  return out.join('');
}

function controlsList(AE) {
  const cat = Object.fromEntries(AE.categories.map((c) => [c.id, c.name]));
  const part = Object.fromEntries(AE.harness.map((h) => [h.id, h.name]));
  const app = Object.fromEntries(AE.appliesTo.map((a) => [a.id, a.name]));
  return AE.controls.map((c) => `<article class="ctl" id="${c.id}" data-cat="${c.cat}" data-type="${c.type}" data-part="${c.part}" data-min="${c.minLevel}" data-applies="${c.applies.join(' ')}" data-layers="${c.layers.join(' ')}">
  <header><span class="ctl-id">${c.id}</span><h3>${esc(c.name)}</h3></header>
  <p class="ctl-purpose">${esc(c.purpose)}</p>
  <ul class="ctl-tags"><li>${esc(cat[c.cat])}</li><li class="t-${c.type}">${c.type}</li><li>${esc(part[c.part])}</li><li>Required from L${c.minLevel}</li><li>${c.applies.map((a) => app[a]).join(', ')}</li></ul>
  <dl class="ctl-dl"><div><dt>How it works</dt><dd>${esc(c.how)}</dd></div><div><dt>Evidence an auditor asks for</dt><dd>${esc(c.evidence)}</dd></div><div><dt>Layers aligned</dt><dd>${c.layers.map((l) => AE.layerById[l].name).join(', ')}</dd></div></dl>
  <ul class="ctl-map">${mapList(c.map, AE)}</ul>
</article>`).join('\n');
}

function alignment(AE) {
  return AE.layers.map((l) => `<section class="al-layer" id="layer-${l.id}" aria-labelledby="al-${l.id}">
  <h3 id="al-${l.id}">${esc(l.name)}</h3>
  <p class="al-desc">${esc(l.desc)}</p>
  <ol class="al-items">
${l.items.map((it) => `    <li><details><summary>${esc(it.t)}</summary><dl><div><dt>What the agent does</dt><dd>${esc(it.agent)}</dd></div><div><dt>Alignment check</dt><dd>${esc(it.check)}</dd></div><div><dt>Controls embedded</dt><dd>${it.controls.map(cid).join(' ')}</dd></div><div><dt>Evidence</dt><dd>${esc(it.evidence)}</dd></div></dl></details></li>`).join('\n')}
  </ol>
</section>`).join('\n');
}

function matrix(AE) {
  const head = AE.layers.map((l) => `<th scope="col">${esc(l.name)}</th>`).join('');
  const rows = AE.workflows.map((w) => {
    const cells = AE.layers.map((l) => {
      const ids = [...new Set(w.steps.flatMap((s) => s.controls).filter((id) => AE.controlById[id].layers.includes(l.id)))].sort();
      return `<td data-layer="${l.id}">${ids.length ? ids.map(cid).join(' ') : '<span class="muted">&ndash;</span>'}</td>`;
    }).join('');
    return `<tr><th scope="row"><a href="/workflows/#wf-${w.id}">${esc(w.short)}</a></th>${cells}</tr>`;
  }).join('\n');
  return `<div class="fw-table-wrap bp-matrix-wrap" tabindex="0" role="region" aria-label="Workflows by layer matrix"><table class="fw-table bp-matrix"><thead><tr><th scope="col">Workflow</th>${head}</tr></thead><tbody>
${rows}
</tbody></table></div>`;
}

function chainLevel(AE, steps) {
  const ceil = Object.fromEntries(AE.handoffs.map((h) => [h.id, h.ceil]));
  let min = 5;
  for (const s of steps) {
    if (s.ex) continue;
    if (s.lvl != null) min = Math.min(min, s.lvl);
    if (s.ho) min = Math.min(min, ceil[s.ho]);
  }
  return min;
}

function workflowsStatic(AE) {
  const lane = Object.fromEntries(AE.lanes.map((l) => [l.id, l.name]));
  const ho = Object.fromEntries(AE.handoffs.map((h) => [h.id, h.name]));
  const ft = Object.fromEntries(AE.failureTypes.map((f) => [f.id, f.name]));
  return AE.workflows.map((w, i) => `<section class="wf-static" id="wf-${w.id}" aria-labelledby="wfh-${w.id}">
  <p class="fw-num">${String(i + 1).padStart(2, '0')} &middot; Chain level today L${chainLevel(AE, w.today)}, reimagined L${chainLevel(AE, w.steps)}</p>
  <h3 id="wfh-${w.id}">${esc(w.name)}</h3>
  <p>${esc(w.summary)} <a href="/frameworks/#${w.fw}">Related framework: ${esc(AE.frameworkNames[w.fw])}</a>.</p>
  <div class="fw-table-wrap bp-steps-wrap"><table class="fw-table bp-steps"><caption class="visually-hidden">Reimagined steps for ${esc(w.short)}</caption><thead><tr><th scope="col">Step</th><th scope="col">Lane</th><th scope="col">Level</th><th scope="col">Model</th><th scope="col">Handoff in</th><th scope="col">Controls</th><th scope="col">Layers</th></tr></thead><tbody>
${w.steps.map((s) => `    <tr><th scope="row">${esc(s.name)}${s.ex ? ' <span class="muted">(exception path)</span>' : ''}</th><td data-label="Lane"><span class="bp-v">${lane[s.lane]}</span></td><td data-label="Level"><span class="bp-v">${lvl(s.lvl)}</span></td><td data-label="Model"><span class="bp-v">${esc(AE.modelNames[s.model]).replace(/\S+-\S+/g, (m) => `<span class="bp-nb">${m}</span>`)}</span></td><td data-label="Handoff in"><span class="bp-v">${s.ho ? ho[s.ho] : '&ndash;'}</span></td><td data-label="Controls"><span class="bp-v">${s.controls.length ? `<span class="bp-chips">${s.controls.map(cid).join(' ')}</span>` : '&ndash;'}</span></td><td data-label="Layers"><span class="bp-v">${s.layers.length ? `<span class="bp-chips">${s.layers.map((l) => `<span class="bp-chip">${AE.layerById[l].short}</span>`).join(' ')}</span>` : '&ndash;'}</span></td></tr>`).join('\n')}
  </tbody></table></div>
  <h4>What the harness catches</h4>
  <ul class="fw-list">
${w.failures.map((f) => `    <li><strong>${ft[f.type]}.</strong> ${esc(f.what)} Caught by ${cid(f.control)}. ${esc(f.route)}</li>`).join('\n')}
  </ul>
  <p class="fw-note">Illustrative: cycle time ${w.metrics.today.cycle} to ${w.metrics.re.cycle}; touches ${w.metrics.today.touches} to ${w.metrics.re.touches}; cost per completed outcome ${w.metrics.today.cost} to ${w.metrics.re.cost}.</p>
</section>`).join('\n');
}

function archStatic(AE) {
  return AE.archLayers.map((L) => `<section class="ar-static-layer" aria-labelledby="arl-${L.id}"><h3 id="arl-${L.id}">${esc(L.name)}</h3>${L.id === 'int' ? '<p><a href="/blueprints/models/">Every model family in depth: what it does, an example, its autonomy and its tests</a>.</p>' : ''}<ul class="ar-static-list">
${AE.components.filter((c) => c.layer === L.id).map((c) => `  <li id="c-${c.id}"><b>${esc(c.name)}.</b> ${esc(c.what)} <span class="muted">Use for: ${esc(c.use)} Not for: ${esc(c.avoid)}</span> ${c.controls.slice(0, 4).map(cid).join(' ')}</li>`).join('\n')}
</ul></section>`).join('\n');
}

function modelTable(AE) {
  return `<div class="fw-table-wrap"><table class="fw-table bp-models"><thead><tr><th scope="col">Model family</th><th scope="col">Good at</th><th scope="col">Weak at</th><th scope="col">Evals you need</th><th scope="col">Typical ceiling</th></tr></thead><tbody>
${AE.models.map((m) => `<tr><th scope="row">${AE.modelPage && AE.modelPage[m.id] ? `<a href="/blueprints/models/#${AE.modelPage[m.id]}">${esc(AE.componentById[m.id].name)}</a>` : esc(AE.componentById[m.id].name)}</th><td>${esc(m.good)}</td><td>${esc(m.weak)}</td><td>${esc(m.evals)}</td><td>${esc(m.ceil)}</td></tr>`).join('\n')}
</tbody></table></div>`;
}

function variationsStatic(AE) {
  return `<ol class="bp-var-static">${AE.variations.map((v) => `<li><b>${esc(v.name)} (${v.level}).</b> ${esc(v.desc)} <span class="muted">${v.path.map((p) => esc(AE.componentById[p[0]].name)).join(' &rarr; ')}</span>${v.link ? ` <a href="${v.link.href}">${esc(v.link.label)}</a>.` : ''}</li>`).join('')}</ol>`;
}

export function blueprintVars(assetsDir) {
  const AE = loadBlueprintData(assetsDir);
  return {
    BP_ALIGNMENT: alignment(AE),
    BP_MATRIX: matrix(AE),
    BP_CONTROLS: controlsList(AE),
    BP_CONTROLS_COUNT: String(AE.controls.length),
    BP_WORKFLOWS: workflowsStatic(AE),
    BP_WORKFLOWS_COUNT: String(AE.workflows.length),
    BP_ARCH: archStatic(AE),
    BP_MODELS: modelTable(AE),
    BP_VARIATIONS: variationsStatic(AE),
    BP_HUB_TRACKS: hubTracks(AE),
    BP_HOME_TRACKS: homeTracks(),
  };
}
