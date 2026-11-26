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
];

export function subnav(current) {
  return `<nav class="bp-subnav" aria-label="Blueprints">
  <div class="container">
    <a class="bp-subnav-home" href="/blueprints/"${current === 'hub' ? ' aria-current="page"' : ''}>Blueprints</a>
    <ul>
${SUBNAV.map(([k, href, label]) => `      <li><a href="${href}"${k === current ? ' aria-current="page"' : ''}>${label}</a></li>`).join('\n')}
    </ul>
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
  return `<div class="fw-table-wrap bp-matrix-wrap" tabindex="0" role="region" aria-label="Workflows by layer matrix, scroll sideways"><table class="fw-table bp-matrix"><thead><tr><th scope="col">Workflow</th>${head}</tr></thead><tbody>
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
  <div class="fw-table-wrap"><table class="fw-table"><caption class="visually-hidden">Reimagined steps for ${esc(w.short)}</caption><thead><tr><th scope="col">Step</th><th scope="col">Lane</th><th scope="col">Level</th><th scope="col">Model</th><th scope="col">Handoff in</th><th scope="col">Controls</th><th scope="col">Layers</th></tr></thead><tbody>
${w.steps.map((s) => `    <tr><th scope="row">${esc(s.name)}${s.ex ? ' <span class="muted">(exception path)</span>' : ''}</th><td>${lane[s.lane]}</td><td>${lvl(s.lvl)}</td><td>${AE.modelNames[s.model]}</td><td>${s.ho ? ho[s.ho] : '&ndash;'}</td><td>${s.controls.map(cid).join(' ') || '&ndash;'}</td><td>${s.layers.map((l) => AE.layerById[l].short).join(' ') || '&ndash;'}</td></tr>`).join('\n')}
  </tbody></table></div>
  <h4>What the harness catches</h4>
  <ul class="fw-list">
${w.failures.map((f) => `    <li><strong>${ft[f.type]}.</strong> ${esc(f.what)} Caught by ${cid(f.control)}. ${esc(f.route)}</li>`).join('\n')}
  </ul>
  <p class="fw-note">Illustrative: cycle time ${w.metrics.today.cycle} to ${w.metrics.re.cycle}; touches ${w.metrics.today.touches} to ${w.metrics.re.touches}; cost per completed outcome ${w.metrics.today.cost} to ${w.metrics.re.cost}.</p>
</section>`).join('\n');
}

function archStatic(AE) {
  return AE.archLayers.map((L) => `<section class="ar-static-layer" aria-labelledby="arl-${L.id}"><h3 id="arl-${L.id}">${esc(L.name)}</h3><ul class="ar-static-list">
${AE.components.filter((c) => c.layer === L.id).map((c) => `  <li id="c-${c.id}"><b>${esc(c.name)}.</b> ${esc(c.what)} <span class="muted">Use for: ${esc(c.use)} Not for: ${esc(c.avoid)}</span> ${c.controls.slice(0, 4).map(cid).join(' ')}</li>`).join('\n')}
</ul></section>`).join('\n');
}

function modelTable(AE) {
  return `<div class="fw-table-wrap"><table class="fw-table bp-models"><thead><tr><th scope="col">Model family</th><th scope="col">Good at</th><th scope="col">Weak at</th><th scope="col">Evals you need</th><th scope="col">Typical ceiling</th></tr></thead><tbody>
${AE.models.map((m) => `<tr><th scope="row">${esc(AE.componentById[m.id].name)}</th><td>${esc(m.good)}</td><td>${esc(m.weak)}</td><td>${esc(m.evals)}</td><td>${esc(m.ceil)}</td></tr>`).join('\n')}
</tbody></table></div>`;
}

function variationsStatic(AE) {
  return `<ol class="bp-var-static">${AE.variations.map((v) => `<li><b>${esc(v.name)} (${v.level}).</b> ${esc(v.desc)} <span class="muted">${v.path.map((p) => esc(AE.componentById[p[0]].name)).join(' &rarr; ')}</span></li>`).join('')}</ol>`;
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
  };
}
