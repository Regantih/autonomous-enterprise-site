/* Reference architecture for the human-led, agent-operated enterprise. Load after controls.js. */
(function (w) {
  'use strict';
  var AE = w.AE = w.AE || {};
  AE.archLayers = [
    { id: 'ch', name: 'Channels and signals' },
    { id: 'hum', name: 'Human command' },
    { id: 'orc', name: 'Orchestration' },
    { id: 'agt', name: 'Agents' },
    { id: 'int', name: 'Intelligence: model portfolio' },
    { id: 'har', name: 'Harness: control plane' },
    { id: 'tool', name: 'Tools and integration' },
    { id: 'dat', name: 'Data and context' },
    { id: 'asr', name: 'Assurance' }
  ];
  // K(id, layer, name, what, use, avoid, model, controls, failure, ceiling hint, framework anchor, alignment layers)
  function K(id, layer, name, what, use, avoid, model, ctl, fail, ceil, fw, al) {
    return { id: id, layer: layer, name: name, what: what, use: use, avoid: avoid, model: model,
      controls: ctl ? ctl.split(' ') : [], fail: fail, ceil: ceil, fw: fw, layers: al.split(' ') };
  }
  var FW = { scale: 'The autonomy scale, L0 to L5', ceiling: 'Materiality and reversibility', harness: 'The harness sets the ceiling',
    pvrc: 'Propose, validate, route, commit', 'weakest-link': 'The weakest-link rule', cost: 'Cost per completed outcome',
    'not-automate': 'When not to automate', maturity: 'Six-dimension maturity', flywheel: 'The value-risk flywheel',
    earned: 'Earned on evidence, taken back by rule', 'human-led': 'Human-led, agent-operated' };
  AE.frameworkNames = FW;

  AE.components = [
    K('web', 'ch', 'Web', 'Forms and portals start requests.', 'Structured requests with known fields.', 'Free text that needs a conversation.', 'small models for intake', 'PCS-01 PRV-04', 'Bad input reaches the agent unchecked.', 'Intake can run at L3.', 'pvrc', 'fe app'),
    K('chat', 'ch', 'Chat', 'People ask in natural language.', 'Questions, status and simple changes.', 'Decisions that need a signature.', 'GPT-class or small models', 'PRV-04 PCS-01 PCS-05', 'The agent sounds sure but is wrong.', 'Answers at L3; actions follow policy.', 'scale', 'fe app'),
    K('email', 'ch', 'Email', 'Customers and suppliers send requests and documents.', 'High-volume inbound requests.', 'Instructions to the agent; email is data.', 'small models, multimodal', 'PCS-01 PRV-01', 'Prompt injection hides in the email text.', 'Intake at L3; never trusted as instruction.', 'harness', 'app data'),
    K('voice', 'ch', 'Voice agents', 'Callers speak with an agent that listens and answers.', 'Common requests with clear policy.', 'Distressed callers or disputes; hand off fast.', 'speech-to-text, text-to-speech', 'PRV-04 IAM-05 HO-03', 'Misheard words lead to wrong actions.', 'L3 for answers; L2 for account changes.', 'harness', 'fe reg ops'),
    K('mobile', 'ch', 'Mobile', 'Field staff and customers use phone apps.', 'Approvals on the move and field capture.', 'Long reviews of complex evidence.', 'small and on-device models', 'HO-01 IAM-02', 'Approvals without evidence in view.', 'Approvals stay L2.', 'scale', 'fe'),
    K('iot', 'ch', 'IoT and edge sensors', 'Sensors stream readings from assets and sites.', 'Condition monitoring and early warning.', 'Direct control of machines.', 'classical ML, forecasting', 'OT-01 OT-02 OT-04', 'A faulty sensor triggers false work.', 'Monitoring at L4; actions at L2 to L3.', 'weakest-link', 'ops data be'),
    K('robots', 'ch', 'Robots and machines', 'Machines act in the physical world.', 'Repetitive tasks in mapped spaces.', 'Unmapped spaces shared with people.', 'physical AI', 'PHY-01 PHY-02 PHY-03', 'Unsafe motion near people.', 'Inside a safety envelope only.', 'harness', 'ops reg'),

    K('charter', 'hum', 'Charter', 'Leaders state intent, limits and the do-not-automate list.', 'Before any agent goes live.', 'As a one-time document; review it.', 'none', 'TAL-05 HO-02', 'Agents optimize the wrong goal.', 'Sets the ceiling for every step.', 'human-led', 'reg fin ops'),
    K('inbox', 'hum', 'Approval inbox and decision cards', 'People decide on cards with evidence, rule and options.', 'L2 steps and over-limit cases.', 'Low-value, reversible items; let them run.', 'none', 'HO-01 HO-05 SOD-01', 'Rubber-stamping.', 'Makes L2 safe and fast.', 'pvrc', 'fe ops reg'),
    K('escalation', 'hum', 'Escalation', 'Hard cases reach the right person with full context.', 'Low confidence, disputes and outages.', 'As the default path for all work.', 'none', 'HO-03 TAL-02', 'Cases bounce between teams.', 'Supports L3 exceptions.', 'pvrc', 'ops fe'),
    K('kill', 'hum', 'Kill switch', 'Owners stop an agent, a scope or the fleet.', 'Always. Test it every quarter.', 'Never skip the drill.', 'none', 'RES-01 RES-04 PHY-03', 'Nobody can stop a bad run.', 'Required from L2.', 'earned', 'ops reg fe'),
    K('owner', 'hum', 'Accountable owner', 'Each agent has one named person who answers for it.', 'Every agent, every version.', 'Shared or committee ownership.', 'none', 'HO-02 IAM-02', 'Nobody acts on alerts.', 'No owner, no run.', 'human-led', 'reg ops'),

    K('planner', 'orc', 'Planner and supervisor agent', 'Splits a goal into tasks and assigns them.', 'Multi-step goals across domains.', 'Simple flows; a workflow engine is safer.', 'reasoning models', 'RES-03 CST-01 TAL-03', 'Plans loop or drift from the goal.', 'L2 to L3 with guards.', 'weakest-link', 'app be ops'),
    K('wfengine', 'orc', 'Workflow engine', 'Runs fixed steps in a fixed order.', 'Known processes with clear rules.', 'Open-ended work.', 'rules', 'TAL-02 TRC-01', 'Rigid flows break on exceptions.', 'L3 to L4 for fixed steps.', 'pvrc', 'app be'),
    K('eventbus', 'orc', 'Event bus', 'Moves events between systems and agents in real time.', 'Signals that need fast reaction.', 'Batch data with no urgency.', 'none', 'DQ-02 TRC-02', 'Lost or duplicate events.', 'Event handoffs reach L3.', 'weakest-link', 'be data'),
    K('contracts', 'orc', 'Cross-agent contracts', 'Define who decides, what evidence returns and what happens on failure.', 'Any agent-to-agent handoff.', 'Implicit handoffs by shared memory.', 'none', 'TAL-03 HO-02', 'Agents blame each other; nobody decides.', 'Handoffs up to L4.', 'weakest-link', 'app be'),
    K('queues', 'orc', 'Queues', 'Hold work, set priority and absorb peaks.', 'Volume spikes and retries.', 'Hiding work that nobody owns.', 'none', 'TAL-04 RES-03', 'Silent backlog.', 'Supports every level.', 'cost', 'ops be'),

    K('ag-fin', 'agt', 'Finance agents', 'Disputes, invoice exceptions, reconciliations, close.', 'High-volume, rule-rich work.', 'Payment release and bank changes.', 'GPT-class, classical ML', 'TAL-01 TAL-05 DQ-04', 'Wrong postings.', 'L3 for small, reversible items.', 'ceiling', 'fin reg'),
    K('ag-sc', 'agt', 'Supply chain agents', 'Planning, purchasing and supplier follow-up.', 'Frequent, bounded decisions.', 'Large commitments to third parties.', 'forecasting, optimization', 'TAL-01 CST-02', 'Inventory swings.', 'L3 with spend limits.', 'cost', 'ops fin'),
    K('ag-svc', 'agt', 'Service agents', 'Answer customers and change orders.', 'Common requests with clear policy.', 'Complaints that need empathy and judgment.', 'GPT-class, retrieval, speech', 'HO-03 PCS-05', 'Confident wrong answers.', 'L3 for answers; L2 for refunds.', 'scale', 'ops fe'),
    K('ag-hr', 'agt', 'HR agents', 'Onboarding tasks, policy answers, scheduling.', 'Admin work around people.', 'Decisions about hiring, pay or dismissal.', 'GPT-class, retrieval', 'TAL-05 PRV-01 HO-01', 'Unfair or private data use.', 'L1 to L2 for decisions about people.', 'not-automate', 'reg data'),
    K('ag-mnt', 'agt', 'Maintenance agents', 'Turn signals into work orders and plans.', 'Condition-based maintenance.', 'Direct machine control.', 'classical ML, GPT-class', 'OT-03 HO-01 DQ-03', 'False work orders or missed failures.', 'L2 to L3; technician approves.', 'weakest-link', 'ops data'),

    K('llm', 'int', 'Frontier large language models (GPT-class)', 'Read, write and reason over language.', 'Unstructured text, drafting, explanation.', 'Arithmetic, postings and hard limits.', 'llm', 'PCS-01 PCS-02 MR-04', 'Plausible but wrong output.', 'L3 only inside a strong harness.', 'harness', 'app be'),
    K('slm', 'int', 'Small and open models', 'Cheaper, faster language models for narrow tasks.', 'Classification, extraction, routing, edge.', 'Broad open-ended reasoning.', 'slm', 'MR-01 TPS-01', 'Narrow skill breaks on new inputs.', 'L3 to L4 for narrow tasks.', 'cost', 'app be'),
    K('reason', 'int', 'Reasoning models', 'Plan and check multi-step problems.', 'Planning, root cause, complex exceptions.', 'Low-latency or low-cost paths.', 'reason', 'RES-03 CST-01 MR-04', 'Long chains hide a wrong step.', 'L2 to L3.', 'pvrc', 'app'),
    K('mm', 'int', 'Multimodal and vision', 'Read documents, images and video.', 'Invoices, forms, inspections.', 'Safety decisions without other checks.', 'mm', 'PCS-02 DQ-01', 'Misread fields.', 'L3 with schema checks.', 'pvrc', 'data app'),
    K('speech', 'int', 'Speech (speech-to-text, text-to-speech)', 'Turn voice into text and text into voice.', 'Voice channels and hands-free work.', 'Noisy settings without confirmation.', 'speech', 'PRV-04 PRV-02', 'Misheard numbers or names.', 'L3 with read-back.', 'harness', 'fe reg'),
    K('rag', 'int', 'Embeddings and retrieval (RAG)', 'Find the right documents and ground answers in them.', 'Policy answers and evidence packs.', 'Facts that live in systems of record; query them.', 'rag', 'PCS-04 MR-04 DQ-02', 'Stale or unauthorized documents.', 'L3 with citations.', 'harness', 'data'),
    K('kg', 'int', 'Knowledge graphs and graph machine learning', 'Resolve entities and relationships.', 'Suppliers, fraud rings, asset hierarchies.', 'Simple lookups.', 'kg', 'DQ-03 MR-04', 'Wrong entity match.', 'L3 for checks; people decide fraud.', 'maturity', 'data fin'),
    K('ml', 'int', 'Classical ML and forecasting', 'Predict numbers, classes and time series.', 'Demand, risk scores, anomalies.', 'Language tasks.', 'ml', 'MR-01 MON-02', 'Silent drift.', 'L3 to L4 with drift monitoring.', 'flywheel', 'data ops'),
    K('opt', 'int', 'Optimization solvers', 'Find the best plan under constraints.', 'Scheduling, routing, supply plans.', 'Fuzzy goals that nobody can state.', 'opt', 'MR-01 TAL-01', 'Optimal plan for the wrong objective.', 'L3 to L4 for plans; L2 for big commitments.', 'cost', 'ops fin'),
    K('rl', 'int', 'Reinforcement learning (incl. human feedback, bandits)', 'Learn actions from rewards over many trials.', 'Sequential decisions with fast feedback.', 'Live trials where errors are costly.', 'rl', 'MR-05 PHY-04 MON-03', 'Reward hacking.', 'Train in simulation; deploy at L2 to L3.', 'flywheel', 'ops reg'),
    K('rules', 'int', 'Rules engines and RPA', 'Apply fixed logic and repeat screen tasks.', 'Postings, limits, stable legacy screens.', 'Judgment or changing screens.', 'rules', 'TAL-02 SOD-02', 'Brittle bots break silently.', 'L4 for deterministic steps.', 'pvrc', 'app fin'),
    K('twin', 'int', 'Simulation and digital twins', 'Model a plant, warehouse or network in software.', 'Training and testing policies safely.', 'As proof without field validation.', 'twin', 'MR-05', 'Twin differs from reality.', 'Gates promotion; does not act.', 'earned', 'ops'),
    K('edge', 'int', 'Edge and IoT analytics', 'Compact models score sensor streams next to the machine.', 'Low-latency anomaly detection on equipment.', 'Heavy models on small devices.', 'edge', 'OT-01 OT-04 MON-02', 'Edge model versions drift apart.', 'Feeds L3 maintenance recommendations.', 'harness', 'data ops'),
    K('phys', 'int', 'Physical AI (robot foundation models, vision-language-action policies)', 'Perceive and act with robots.', 'Picking, inspection, handling in mapped cells.', 'Open spaces with people and no safety envelope.', 'phys', 'PHY-01 PHY-04 OT-03', 'Unsafe motion.', 'Inside a rated safety envelope only.', 'harness', 'ops reg'),

    K('H1', 'har', 'Identity and delegation', 'One identity per agent, acting for an accountable person.', 'Every agent call.', 'Shared service accounts.', 'none', '', 'No token, no call.', 'Required from L1.', 'harness', 'app be'),
    K('H2', 'har', 'Registry and lifecycle', 'Only registered, active agent versions run.', 'Every release.', 'Shadow agents outside the registry.', 'none', '', 'Unregistered agent is blocked.', 'Required from L1.', 'harness', 'app reg'),
    K('H3', 'har', 'Policy and limits', 'Thresholds, segregation of duties and blackout windows, outside the model.', 'Every action with value at risk.', 'Limits in prompts.', 'rules', '', 'Missing rule means escalate.', 'Sets the L3 boundary.', 'harness', 'fin reg be'),
    K('H4', 'har', 'Tool gateway', 'Scopes, rate limits, read and write separation.', 'Every tool call.', 'Direct database writes by agents.', 'none', '', 'Unknown tool is rejected.', 'Required from L2.', 'harness', 'be app'),
    K('H5', 'har', 'Model gateway', 'Routing, fallback, masking and quotas.', 'Every model call.', 'Direct calls to providers.', 'none', '', 'Fallback model or drop to L1.', 'Required from L1.', 'harness', 'be data'),
    K('H6', 'har', 'Context and memory', 'What may enter context and what memory may keep.', 'Every prompt and memory write.', 'Unfiltered documents in context.', 'none', '', 'Untrusted content treated as data.', 'Required from L1.', 'harness', 'data be'),
    K('H7', 'har', 'Verification and approval', 'Schema checks, a checker and approval cards.', 'Before every commit.', 'Self-checking by the same agent.', 'rules', '', 'Failed check goes to a person.', 'Makes L2 and L3 possible.', 'pvrc', 'app fe'),
    K('H8', 'har', 'Operating envelope and cost', 'Deadlines, call budgets, retries and loop guards.', 'Every run.', 'Unlimited retries.', 'none', '', 'Stop and escalate with trace.', 'Required from L2.', 'cost', 'fin ops be'),
    K('H9', 'har', 'Decision trace', 'What was seen, decided and done.', 'Every decision.', 'Logs that miss the evidence.', 'none', '', 'If the trace fails, the action fails.', 'Required from L1.', 'harness', 'reg data'),
    K('H10', 'har', 'Evaluation and kill switch', 'Test sets before release; stop an agent, a scope or the fleet.', 'Every release and every quarter.', 'Release without evals.', 'none', '', 'Kill switch tested quarterly.', 'Required from L2.', 'earned', 'reg ops'),

    K('apigw', 'tool', 'API gateway', 'Exposes released interfaces of core systems.', 'Every write to a system of record.', 'Screen scraping where an interface exists.', 'none', 'IAM-03 TAL-06', 'Unversioned interfaces change under the agent.', 'API handoffs reach L3.', 'weakest-link', 'app be'),
    K('toolc', 'tool', 'Tool contracts (MCP-style)', 'Typed, scoped descriptions of what a tool does.', 'Every tool an agent may call.', 'Generic tools with broad scopes.', 'none', 'TAL-03 IAM-03', 'Excessive agency.', 'Governed tools reach L3.', 'harness', 'app be'),
    K('rpa', 'tool', 'RPA bots', 'Repeat screen steps on legacy systems.', 'Stable screens with no interface.', 'Changing screens or judgment.', 'rules', 'SOD-02 TAL-06', 'Silent breaks when screens change.', 'L2 to L3; retire when an interface exists.', 'weakest-link', 'app'),
    K('mci', 'tool', 'Machine control interfaces', 'Request setpoints and tasks behind safety controllers and interlocks.', 'Plant and robot tasks.', 'Bypassing the control system.', 'none', 'OT-02 OT-03 PHY-01', 'Unsafe commands.', 'Behind interlocks only.', 'harness', 'ops reg be'),

    K('sor', 'dat', 'Systems of record', 'Ledgers, orders, assets, people.', 'The source of truth for facts.', 'As a scratchpad for agents.', 'none', 'DQ-02 TAL-06', 'Agents post wrong records.', 'Writes only through released interfaces.', 'pvrc', 'fin data app'),
    K('dprod', 'dat', 'Data products', 'Curated, owned datasets with contracts.', 'Planning, analytics and features.', 'Ownerless copies.', 'none', 'DQ-01 DQ-02', 'Stale or undefined data.', 'Gates the data modifier.', 'maturity', 'data'),
    K('vec', 'dat', 'Vector store', 'Stores embeddings for retrieval.', 'Policy and document search.', 'Facts that change daily.', 'rag', 'PCS-04', 'Leaks across access groups.', 'L3 with permission filters.', 'harness', 'data'),
    K('kgstore', 'dat', 'Knowledge graph', 'Stores entities and relationships.', 'Master data and fraud checks.', 'Transaction data.', 'kg', 'DQ-03', 'Wrong links spread.', 'Supports L3 checks.', 'maturity', 'data'),
    K('feat', 'dat', 'Feature store', 'Serves consistent features to models.', 'Classical ML in production.', 'One-off analysis.', 'ml', 'MON-02 DQ-02', 'Training and serving differ.', 'Supports L3 to L4 scoring.', 'flywheel', 'data'),
    K('stream', 'dat', 'Event streams', 'Ordered streams of business events.', 'Real-time agents.', 'Data that needs heavy cleaning first.', 'none', 'DQ-01', 'Out-of-order events.', 'Supports L3.', 'weakest-link', 'data be'),
    K('ts', 'dat', 'IoT time series', 'Sensor readings over time.', 'Condition monitoring and twins.', 'Without plausibility checks.', 'ml', 'OT-04', 'Bad sensors poison models.', 'Supports monitoring at L4.', 'weakest-link', 'data ops'),
    K('dqg', 'dat', 'Data quality gates', 'Check freshness, completeness and validity.', 'Before any agent reads.', 'After the decision.', 'rules', 'DQ-01', 'Garbage in, confident garbage out.', 'Failure caps the step at L2.', 'ceiling', 'data ops'),

    K('offeval', 'asr', 'Offline evals', 'Test sets run before release.', 'Every release and model change.', 'Only once at launch.', 'none', 'MR-01 TPS-03', 'Untested change goes live.', 'Gates every promotion.', 'earned', 'reg app'),
    K('oneval', 'asr', 'Online evals', 'Score live outputs and samples.', 'Every production step.', 'Instead of offline evals.', 'none', 'MON-01 HO-04', 'Quality drops unseen.', 'Required from L3.', 'earned', 'ops'),
    K('redteam', 'asr', 'Red-teaming', 'Attack the system on purpose.', 'Before release and after big changes.', 'As a one-time event.', 'none', 'PCS-01 PCS-03', 'Injection paths stay open.', 'Required before L3.', 'harness', 'reg be'),
    K('drift', 'asr', 'Drift and quality monitoring', 'Detect shifts in data and outputs.', 'All models in production.', 'Without an owner to act.', 'ml', 'MON-02 MON-03', 'Slow decay.', 'Triggers demotion.', 'earned', 'data ops'),
    K('tracestore', 'asr', 'Decision trace store', 'Keeps traces append-only.', 'Every decision.', 'Editable logs.', 'none', 'TRC-02 PRV-03', 'Evidence lost or altered.', 'Required from L2.', 'harness', 'reg data'),
    K('audit', 'asr', 'Audit', 'Independent review of controls and outcomes.', 'Every promotion to L3 and above.', 'Only after an incident.', 'none', 'TRC-03 HO-04', 'Control gaps found late.', 'Signs off L3.', 'earned', 'reg fin')
  ];
  AE.componentById = {};
  AE.components.forEach(function (c) {
    if (!c.controls.length && c.layer === 'har' && AE.controls) c.controls = AE.controls.filter(function (x) { return x.part === c.id; }).map(function (x) { return x.id; });
    AE.componentById[c.id] = c;
  });
  ['H9', 'tracestore'].forEach(function (id) { AE.componentById[id].link = { href: '/blueprints/trace/', label: 'Open the decision trace viewer' }; });
  ['kg', 'kgstore'].forEach(function (id) { AE.componentById[id].link = { href: '/blueprints/graphs/', label: 'Explore a real knowledge graph' }; });
  // Each model family's card on /blueprints/models/ (the book's account of that family).
  AE.modelPage = { llm: 'llm', reason: 'llm', slm: 'slm', ml: 'ml', opt: 'opt', rules: 'opt', rag: 'rag', kg: 'kg', mm: 'mm', speech: 'speech', edge: 'phys', phys: 'phys' };
  Object.keys(AE.modelPage).forEach(function (id) {
    if (!AE.componentById[id].link) AE.componentById[id].link = { href: '/blueprints/models/#' + AE.modelPage[id], label: 'How this model family fits' };
  });

  // Model family table and chooser.
  AE.models = [
    { id: 'llm', good: 'Language, drafting, explanation, flexible reasoning', weak: 'Arithmetic, exact recall, hard limits', evals: 'Task accuracy, groundedness, injection, refusal', ceil: 'L3 in a strong harness', mand: 'PCS-01 PCS-02 MR-04 PRV-02' },
    { id: 'slm', good: 'Narrow classification and extraction at low cost', weak: 'Broad or novel tasks', evals: 'Accuracy per class, robustness to new inputs', ceil: 'L3 to L4 for narrow tasks', mand: 'MR-01 PCS-02' },
    { id: 'reason', good: 'Multi-step plans and root cause', weak: 'Latency and cost', evals: 'Plan correctness, step validity, loop rate', ceil: 'L2 to L3', mand: 'RES-03 CST-01' },
    { id: 'mm', good: 'Documents, images, inspection', weak: 'Low-quality scans, rare layouts', evals: 'Field accuracy, layout coverage', ceil: 'L3 with schema checks', mand: 'PCS-02 DQ-01' },
    { id: 'speech', good: 'Voice in and out', weak: 'Noise, accents, numbers', evals: 'Word error rate, read-back accuracy', ceil: 'L3 with read-back', mand: 'PRV-04 IAM-05' },
    { id: 'rag', good: 'Grounded answers from documents', weak: 'Stale or missing documents', evals: 'Retrieval recall, citation accuracy, access leaks', ceil: 'L3 with citations', mand: 'PCS-04 MR-04' },
    { id: 'kg', good: 'Entities, relationships, explainable links', weak: 'Unstructured judgment', evals: 'Entity match precision, link coverage', ceil: 'L3 for checks', mand: 'DQ-03' },
    { id: 'ml', good: 'Numbers, time series, scores', weak: 'Language, regime change', evals: 'Error by segment, calibration, drift', ceil: 'L3 to L4 with drift monitoring', mand: 'MR-01 MON-02' },
    { id: 'opt', good: 'Best plan under constraints', weak: 'Unclear goals', evals: 'Constraint satisfaction, cost gap, scenario tests', ceil: 'L3 to L4 for plans', mand: 'MR-01 TAL-01' },
    { id: 'rl', good: 'Sequential decisions with feedback', weak: 'Safe exploration, reward design', evals: 'Simulation return, unsafe-action rate, shadow agreement', ceil: 'L2 to L3 after simulation', mand: 'MR-05 PHY-04 MON-03' },
    { id: 'rules', good: 'Exact, explainable, repeatable logic', weak: 'Ambiguity and change', evals: 'Rule coverage, regression tests', ceil: 'L4 for deterministic steps', mand: 'SOD-02 TRC-04' },
    { id: 'twin', good: 'Safe testing of policies and plans', weak: 'Gap to reality', evals: 'Sim-to-real agreement', ceil: 'Gates promotion; does not act', mand: 'MR-05' },
    { id: 'edge', good: 'Fast anomaly detection close to the machine', weak: 'Constrained hardware, version sprawl', evals: 'False alarm rate, missed-fault rate', ceil: 'L3 recommendations; machines stay in control', mand: 'OT-01 OT-04' },
    { id: 'phys', good: 'Perception and motion in mapped cells', weak: 'Open, crowded spaces', evals: 'Task success, safety stops, near misses', ceil: 'Inside a safety envelope', mand: 'PHY-01 PHY-02 PHY-04 OT-03' }
  ];
  AE.chooser = [
    { id: 'lang', q: 'The input is unstructured language', fam: { llm: 3, slm: 2, rag: 2 }, why: 'Language models read and write text.', ctl: 'PCS-01' },
    { id: 'nums', q: 'The task is about numbers or time series', fam: { ml: 3, opt: 1 }, why: 'Classical ML is accurate and cheap on numbers.', ctl: 'MON-02' },
    { id: 'explain', q: 'Each decision needs an explanation', fam: { rules: 2, kg: 2, rag: 1, llm: 1 }, why: 'Rules and graphs give explanations that auditors can follow.', ctl: 'TRC-01 MR-04' },
    { id: 'seq', q: 'Decisions are sequential, with feedback', fam: { rl: 3, opt: 2, twin: 1 }, why: 'Reinforcement learning and solvers handle sequences; train in simulation.', ctl: 'MR-05' },
    { id: 'phys', q: 'The work happens in the physical world', fam: { phys: 3, mm: 2, twin: 2, ml: 1, edge: 1 }, why: 'Physical AI acts; vision sees; the twin tests safely.', ctl: 'PHY-01 OT-03 PHY-04' },
    { id: 'rt', q: 'It needs real-time latency', fam: { slm: 2, ml: 2, rules: 2, edge: 1 }, why: 'Small models, classical ML and rules answer in milliseconds.', ctl: 'RES-02' },
    { id: 'cost', q: 'Cost per outcome is a big concern', fam: { slm: 2, rules: 2, ml: 1 }, why: 'Use the simplest engine that works.', ctl: 'CST-01 CST-02 CST-03' },
    { id: 'sensor', q: 'Signals come from sensors or machines', fam: { edge: 3, ml: 2, twin: 1 }, why: 'Edge analytics score streams fast; forecasting estimates time to failure.', ctl: 'OT-01 OT-04' },
    { id: 'reg', q: 'The step is regulated or a key control', fam: { rules: 2, kg: 1 }, why: 'Deterministic engines post; people sign.', ctl: 'HO-01 TRC-01 MR-02 SOD-01 MR-06' }
  ];

  // Eight architecture variations. Each path step: [component id, caption].
  AE.variations = [
    { id: 'assist', name: 'Assistant', level: 'L1', desc: 'A person asks, a GPT-class model drafts, the person acts.', path: [
      ['chat', 'A person asks a question in chat.'], ['H5', 'The model gateway masks personal data and routes the call.'], ['rag', 'Retrieval finds the policy and the records.'],
      ['llm', 'A GPT-class model drafts an answer with citations.'], ['H9', 'The trace records the sources and the draft.'], ['owner', 'The person reads the draft, decides and acts.'], ['sor', 'The person updates the system of record.']] },
    { id: 'single', name: 'Single agent with tools', level: 'L2 to L3', desc: 'One agent plans, calls governed tools and proposes; rules commit.', path: [
      ['email', 'A customer dispute arrives by email.'], ['H6', 'The email enters context as data, not as instructions.'], ['ag-fin', 'The finance agent plans the steps.'], ['llm', 'The model investigates and proposes a credit.'],
      ['H4', 'The tool gateway checks scopes on each call.'], ['H3', 'The policy table checks the limit and the threshold.'], ['H7', 'Verification checks the schema and evidence.'], ['apigw', 'Inside limits, a released interface commits.'], ['H9', 'The trace was written before the commit.']] },
    { id: 'supervisor', name: 'Supervisor and specialists', level: 'L3', desc: 'A supervisor agent splits the goal; specialists work under cross-agent contracts.', path: [
      ['web', 'A planner submits a goal: recover a late order.'], ['planner', 'The supervisor splits it into tasks.'], ['contracts', 'Contracts define who decides and what evidence returns.'], ['ag-sc', 'The supply chain agent finds stock and capacity.'],
      ['ag-fin', 'The finance agent checks credit and cost.'], ['H7', 'Verification checks each result against its contract.'], ['wfengine', 'The workflow engine joins the results.'], ['inbox', 'The planner approves the recovery plan.'], ['tracestore', 'Every handoff is in the trace store.']] },
    { id: 'iot', name: 'Event-driven IoT loop', level: 'L2 to L3', desc: 'Sensor anomaly to work order, with a technician approving.', path: [
      ['iot', 'A vibration sensor reports a rising trend.'], ['ts', 'Readings land in the time-series store.'], ['dqg', 'The plausibility gate checks the readings.'], ['edge', 'An edge model flags the anomaly at the machine.'], ['ml', 'A forecasting model estimates days to failure.'],
      ['eventbus', 'An anomaly event is published.'], ['ag-mnt', 'The maintenance agent drafts a work order.'], ['H3', 'Policy checks cost, window and safety class.'], ['inbox', 'The technician approves on a decision card.'], ['apigw', 'The work order and parts reservation commit.']] },
    { id: 'voice', name: 'Voice front door', level: 'L3', desc: 'Speech in, identity check, agent, speech out, and a warm handoff.', path: [
      ['voice', 'A customer calls the service line.'], ['speech', 'Speech-to-text transcribes; the caller hears the agent notice.'], ['H1', 'Identity verification runs before any account action.'], ['ag-svc', 'The service agent finds the intent.'],
      ['rag', 'Retrieval grounds the answer in policy.'], ['H3', 'Policy limits bound any change.'], ['speech', 'Text-to-speech reads back the result.'], ['escalation', 'Hard cases go to a person with the full context.']] },
    { id: 'physical', name: 'Physical AI cell', level: 'L3 in envelope', desc: 'A robot policy trained with reinforcement learning in a digital twin, deployed inside a safety envelope.', path: [
      ['twin', 'The digital twin models the cell and its hazards.'], ['rl', 'Reinforcement learning trains the policy in the twin.'], ['offeval', 'Shadow mode compares the policy with operators.'], ['H10', 'The release gate approves a limited cell.'],
      ['phys', 'The policy runs on the robot.'], ['mci', 'Commands pass the safety controller and interlocks.'], ['robots', 'The robot works within speed and force limits and the geofence.'], ['kill', 'Anyone can hit the e-stop; the owner can stop the fleet.']] },
    { id: 'optimizer', name: 'Optimizer and LLM', level: 'L3', desc: 'A solver decides the plan; a GPT-class model explains it and handles exceptions.', path: [
      ['stream', 'Orders and shipments stream in.'], ['ml', 'Forecast models predict demand with ranges.'], ['opt', 'The solver builds the plan under constraints.'], ['llm', 'The model explains the plan and its trade-offs.'],
      ['H3', 'Policy routes large changes to people.'], ['inbox', 'The planner approves.'], ['apigw', 'Orders release through released interfaces.']] },
    { id: 'graph', name: 'Graph-grounded agent', level: 'L2 to L3', desc: 'A knowledge graph resolves entities and links before the agent acts.', link: { href: '/blueprints/graphs/', label: 'Ask a real graph-grounded agent' }, path: [
      ['email', 'A new supplier invoice arrives.'], ['ag-fin', 'The finance agent starts its checks.'], ['kg', 'Graph models resolve the supplier entity.'], ['kgstore', 'The graph shows a bank account shared with another supplier.'],
      ['reason', 'A reasoning model tests the fraud-ring pattern.'], ['H3', 'Policy blocks payment and routes the case.'], ['escalation', 'The fraud team gets the graph path as evidence.'], ['H9', 'The trace keeps every check.']] }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
(function (w) {
  'use strict';
  var AE = w.AE = w.AE || {};
  AE.modelNames = {
    llm: 'GPT-class LLM', slm: 'Small model', reason: 'Reasoning model', mm: 'Multimodal and vision', speech: 'Speech',
    rag: 'Retrieval (RAG)', kg: 'Knowledge graph', ml: 'Classical ML and forecasting', opt: 'Optimization solver',
    rl: 'Reinforcement learning', rules: 'Rules engine', twin: 'Digital twin', edge: 'Edge and IoT analytics', phys: 'Physical AI', none: 'No model'
  };
})(typeof window !== 'undefined' ? window : globalThis);
