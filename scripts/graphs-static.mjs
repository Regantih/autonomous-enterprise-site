// Static (no-JS) HTML for /blueprints/graphs/: computed stats and full text tables of every node and edge.
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cidLink = (id) => (/^[A-Z]{2,3}-\d{2}$/.test(id) ? `<a class="cid" href="/controls/#${id}">${id}</a>` : esc(id));
const TYPE_LABEL = {
  supplier: 'Supplier', exception: 'Exception', extype: 'Exception type', policy: 'Policy', role: 'Role', control: 'Control',
  agent: 'Agent', skill: 'Skill', denied: 'Cannot do', tool: 'Tool or API', data: 'Data', level: 'Autonomy level',
  signal: 'Signal', router: 'Router', lookup: 'Graph lookup', family: 'Model family', agentstep: 'Agent', gate: 'Gate', action: 'Action', trace: 'Trace', memory: 'Memory',
};
export const typeLabel = (t) => TYPE_LABEL[t] || t;
const facts = (f) => Object.entries(f).map(([k, v]) => `<b>${esc(k.replace(/_/g, ' '))}:</b> ${esc(v)}`).join('; ');

function tables(g, name) {
  const byType = g.types.map((t) => [t, g.nodes.filter((n) => n.type === t)]).filter(([, ns]) => ns.length);
  const nodeRows = byType.map(([t, ns]) => ns.map((n) => `<tr><th scope="row">${cidLink(n.id)}</th><td>${esc(typeLabel(t))}</td><td>${esc(n.label)}</td><td>${facts(n.facts)}</td></tr>`).join('\n')).join('\n');
  const edgeRows = g.edges.map((e) => `<tr><td>${cidLink(e.s)}</td><td>${esc(e.rel.replace(/_/g, ' '))}</td><td>${cidLink(e.t)}</td></tr>`).join('\n');
  return `<details class="gr-alt">
      <summary>All ${g.nodes.length} nodes of the ${name}, as a table</summary>
      <div class="fw-table-wrap" tabindex="0" role="region" aria-label="Nodes of the ${name}"><table class="fw-table gr-table"><thead><tr><th scope="col">ID</th><th scope="col">Type</th><th scope="col">Label</th><th scope="col">Facts</th></tr></thead><tbody>
${nodeRows}
</tbody></table></div>
    </details>
    <details class="gr-alt">
      <summary>All ${g.edges.length} edges of the ${name}, as a table</summary>
      <div class="fw-table-wrap" tabindex="0" role="region" aria-label="Edges of the ${name}"><table class="fw-table gr-table"><thead><tr><th scope="col">From</th><th scope="col">Relation</th><th scope="col">To</th></tr></thead><tbody>
${edgeRows}
</tbody></table></div>
    </details>`;
}

function kgStats(s) {
  const li = (arr, f) => arr.map((x) => `<li>${f(x)}</li>`).join('');
  return `<ul class="gr-stats">
      <li><b>${s.nodes}</b> nodes</li><li><b>${s.edges}</b> edges</li><li><b>${s.components}</b> connected component${s.components === 1 ? '' : 's'}</li><li><b>${s.mean_degree}</b> mean degree</li>
    </ul>
    <div class="gr-stat-grid">
      <div><h4>Nodes by type</h4><ul>${li(Object.entries(s.nodes_by_type), ([k, v]) => `${esc(typeLabel(k))}: ${v}`)}</ul></div>
      <div><h4>Most exceptions</h4><ol>${li(s.suppliers_most_exceptions, (x) => `${esc(x.label)}: ${x.exceptions}`)}</ol></div>
      <div><h4>Highest risk score</h4><ol>${li(s.suppliers_highest_risk, (x) => `${esc(x.label)}: ${x.risk_score} (${x.needs_person} need a person, ${x.wrong_agent_suggestions} wrong agent suggestions)`)}</ol></div>
      <div><h4>Most connected nodes</h4><ol>${li(s.top_degree, (x) => `${esc(x.label)}: degree ${x.degree}`)}</ol></div>
    </div>
    <p class="gr-note">${esc(s.risk_definition)} Under the baseline policy, ${s.baseline_routes.resolver} exception${s.baseline_routes.resolver === 1 ? '' : 's'} go to the resolver agent, ${s.baseline_routes.clerk} to an AP clerk and ${s.baseline_routes.senior} to a senior approver.</p>`;
}

function skillStats(g) {
  const s = g.stats;
  const agents = g.nodes.filter((n) => n.type === 'agent');
  const out = (id, rel) => g.edges.filter((e) => e.s === id && e.rel === rel).map((e) => g.nodes.find((n) => n.id === e.t));
  const rows = agents.map((a) => {
    const can = out(a.id, 'has_skill').map((sk) => `${esc(sk.label)} (${sk.facts.autonomy})`).join('; ');
    const cannot = out(a.id, 'cannot').map((d) => `${esc(d.label.replace(/^Cannot: /, ''))} (${d.facts.controls.split(' ').map(cidLink).join(' ')})`).join('; ');
    return `<tr><th scope="row">${esc(a.label)}</th><td>${can}</td><td>${cannot || '&ndash;'}</td></tr>`;
  }).join('\n');
  return `<ul class="gr-stats"><li><b>${s.nodes}</b> nodes</li><li><b>${s.edges}</b> edges</li><li><b>${s.controls_used.length}</b> controls, all from the library</li><li><b>${agents.length}</b> agents</li></ul>
    <div class="fw-table-wrap" tabindex="0" role="region" aria-label="What each agent can and cannot do"><table class="fw-table gr-table"><caption>What each agent can and cannot do</caption><thead><tr><th scope="col">Agent</th><th scope="col">Can (autonomy level)</th><th scope="col">Cannot (blocked by)</th></tr></thead><tbody>
${rows}
</tbody></table></div>`;
}

function brainStatic(b) {
  const fam = b.nodes.filter((n) => n.type === 'family');
  return `<ol class="gr-brain-static">
      <li><b>Signal.</b> Your question arrives on the web. Chat, email, voice, IoT and robot signals are not connected in this demo.</li>
      <li><b>Brain router.</b> ${b.rules.length} rules in code read the question and pick the graph and the model family.</li>
      <li><b>Graph lookup.</b> Code walks the knowledge graph or the skill graph and selects a subgraph.</li>
      <li><b>Model family.</b> One GPT-class model call writes the answer. Every other family is routed to, not run in this demo.</li>
      <li><b>Skill and agent.</b> The graph agent answers from the subgraph only.</li>
      <li><b>Gate.</b> Code checks citations, vendor names, prompt leaks, length and the call budget: ${b.gate_controls.map(cidLink).join(' ')}.</li>
      <li><b>Action.</b> A read-only answer with cited nodes.</li>
      <li><b>Trace and memory.</b> The trace is added to your session memory in this browser tab. Nothing is stored on the server.</li>
    </ol>
    <div class="fw-table-wrap" tabindex="0" role="region" aria-label="Model families the router can pick"><table class="fw-table gr-table"><caption>Model families the router can pick</caption><thead><tr><th scope="col">Family</th><th scope="col">In this demo</th><th scope="col">Evals you need</th><th scope="col">Mandatory controls</th></tr></thead><tbody>
${fam.map((n) => `<tr><th scope="row">${esc(n.label)}</th><td>${esc(n.facts.status)}</td><td>${esc(n.facts.evals)}</td><td>${n.facts.mandatory_controls.split(' ').map(cidLink).join(' ')}</td></tr>`).join('\n')}
</tbody></table></div>`;
}

export function graphsVars(graphs) {
  return {
    GR_KG_STATS: kgStats(graphs.kg.stats),
    GR_KG_TABLES: tables(graphs.kg, 'knowledge graph'),
    GR_KG_NODES: String(graphs.kg.stats.nodes),
    GR_KG_EDGES: String(graphs.kg.stats.edges),
    GR_SK_STATS: skillStats(graphs.skills),
    GR_SK_TABLES: tables(graphs.skills, 'skill graph'),
    GR_BRAIN_STATIC: brainStatic(graphs.brain),
    GR_BRAIN_TABLES: tables(graphs.brain, 'brain map'),
  };
}
