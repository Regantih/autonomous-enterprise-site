/* Alignment across every layer of the enterprise. Each item names what the agent does, the alignment check, the controls and the evidence. */
(function (w) {
  'use strict';
  var AE = w.AE = w.AE || {};
  function I(t, agent, check, controls, evidence) { return { t: t, agent: agent, check: check, controls: controls.split(' '), evidence: evidence }; }
  AE.layers = [
    { id: 'fin', name: 'Financial', short: 'Fin',
      desc: 'Agents prepare and propose money movements. The ledger, the limits and the trace must always agree.',
      items: [
        I('Credits and adjustments', 'The agent investigates a dispute and proposes a credit memo.', 'A posted credit ties to the general ledger, the policy limit and the audit trail.', 'TAL-01 TAL-02 DQ-04 TRC-01', 'Daily tie-out report. Trace ID on every posting.'),
        I('Invoice exceptions', 'The agent resolves price and quantity variances inside tolerance.', 'The purchase order, the receipt and the invoice agree before release.', 'TAL-01 DQ-01 SOD-03', 'Match results. Version of the tolerance table.'),
        I('Close and reconciliations', 'The agent prepares reconciliations and proposes journals.', 'Subledger equals ledger. The preparer is never the approver.', 'DQ-04 SOD-01 HO-01', 'Signed reconciliations. Journal approval log.'),
        I('Payments and bank data', 'The agent prepares evidence only. It never releases money or changes bank details.', 'No agent holds a payment-release or bank-change permission.', 'TAL-05 TAL-07 IAM-03', 'Permission report with zero agent payment scopes.'),
        I('Cost of agent work', 'The agent records its spend per case.', 'Cost per completed outcome matches the finance allocation.', 'CST-01 CST-02', 'Monthly cost report reconciled to platform invoices.')
      ] },
    { id: 'reg', name: 'Regulatory and statutory', short: 'Reg',
      desc: 'Laws and standards set hard edges. Every step shows which rule applies and who signs.',
      items: [
        I('Human oversight where law requires it', 'The agent routes reserved decisions to named people.', 'The level of a step never exceeds its legal ceiling.', 'HO-01 HO-02 TAL-05 RES-01', 'Oversight design record. Approver logs.'),
        I('Record-keeping', 'The agent writes a trace for every decision.', 'Retention meets the statute, and each trace links to the record it supports.', 'TRC-01 TRC-02 PRV-03', 'Retention schedule. Trace samples.'),
        I('Key financial controls', 'Agent steps inside key controls stay at L2 until audit approves more.', 'The control matrix, the agent registry and the release log name the same steps.', 'SOD-01 SOD-02 TRC-04 MR-02', 'Control matrix with agent steps flagged. Audit sign-off.'),
        I('Privacy', 'The agent uses the minimum personal data.', 'The lawful basis for each field matches the context allow-list.', 'PRV-01 PRV-02 PRV-03', 'Data protection assessment. Masking logs.'),
        I('Machine and product safety', 'Physical AI runs inside rated safety functions.', 'No AI output can override the safety controller.', 'PHY-01 PHY-02 PHY-03 OT-03', 'Safety validation report. Risk assessment.'),
        I('Transparency', 'The agent tells people that they deal with an agent.', 'Every channel plays the same approved notice.', 'PRV-04 HO-03', 'Notice scripts. Call samples.')
      ] },
    { id: 'ops', name: 'Operational', short: 'Ops',
      desc: 'Agents run the work. Service levels, capacity and exceptions must stay in line with the plan.',
      items: [
        I('Service levels', 'The agent works the queue and escalates hard cases.', 'Escalations meet the same service level as agent-closed cases.', 'HO-03 MON-01', 'Service-level report by path.'),
        I('Exception routing', 'The agent sends each exception to one owner.', 'Every exception has an owner and lands in one inbox.', 'HO-01 TAL-02', 'Queue aging report.'),
        I('Capacity and envelope', 'The agent runs inside call, time and cost budgets.', 'Run budgets match planned volumes.', 'CST-01 RES-03 TAL-04', 'Budget-breach log.'),
        I('Field and plant work', 'The agent drafts work orders from sensor signals.', 'Each order matches the asset record, the part and the technician skill.', 'DQ-03 OT-04 HO-01', 'Work order audit sample.'),
        I('Continuity', 'On an outage, work falls back to people without loss.', 'Fallback queues and staffing match the demotion plan.', 'RES-02 RES-01 RES-04', 'Drill records.')
      ] },
    { id: 'app', name: 'Application', short: 'App',
      desc: 'Agents act through applications. Every action uses a released interface and the rules of that application.',
      items: [
        I('Released interfaces only', 'The agent calls tools, not screens.', 'Each tool maps to a versioned interface with the validations of the application.', 'TAL-03 IAM-03', 'Tool registry matched to the interface catalogue.'),
        I('Business rules stay in the application', 'The agent proposes a change.', 'The application validates the proposal again before commit.', 'PCS-02 TAL-02', 'Rejection logs.'),
        I('Idempotency and reversal', 'The agent commits through one key per action.', 'Each action can be reversed once, and only once.', 'TAL-06', 'Reversal tests.'),
        I('Registry and versions', 'Only registered agent versions run.', 'The registry, the release log and the running version agree.', 'MR-03 SOD-02 TRC-04', 'Release records.'),
        I('Cross-agent contracts', 'Agents hand work to other agents.', 'Each contract names who decides, what evidence returns and the failure path.', 'TAL-03 HO-02', 'Contract library.')
      ] },
    { id: 'fe', name: 'Technical: Frontend', short: 'FE',
      desc: 'What people see must match what the agent did and what policy allows.',
      items: [
        I('Decision cards', 'The agent sends a proposal to a person.', 'Card fields come from the trace, not from free model text.', 'HO-01 TRC-01', 'Card render samples.'),
        I('Approval screens', 'The agent waits for a decision.', 'Approve buttons show only for roles that may approve.', 'SOD-01 IAM-02', 'Role test results.'),
        I('Agent disclosure', 'The agent talks in chat or voice.', 'Every screen and call labels the agent.', 'PRV-04 PCS-05', 'Screenshots and scripts per release.'),
        I('Approval quality', 'The agent asks for approval on large items.', 'The screen shows the evidence before the approve button works.', 'HO-05', 'Time-on-card analytics.'),
        I('Owner console', 'The agent reports status to its owner.', 'The stop control is visible and works from the console.', 'RES-01 HO-02', 'Console audit and drill results.')
      ] },
    { id: 'be', name: 'Technical: Backend', short: 'BE',
      desc: 'Services enforce the limits. The model never holds them.',
      items: [
        I('Policy engine', 'The agent sends a proposal.', 'The policy service, not the prompt, decides inside or outside limits.', 'TAL-01 SOD-03', 'Policy table versions.'),
        I('Tool and model gateways', 'The agent calls tools and models.', 'Gateways enforce scopes, quotas and masking on every call.', 'TAL-03 TAL-04 PRV-02 CST-03', 'Gateway logs.'),
        I('Identity and tokens', 'The agent authenticates.', 'Each call carries an agent identity and an on-behalf-of owner.', 'IAM-01 IAM-02', 'Token issue logs.'),
        I('Resilience', 'The agent meets an error or a loop.', 'Fallback and guards trip before damage spreads.', 'RES-02 RES-03', 'Failure-injection test results.'),
        I('Trace write-ahead', 'The agent commits an action.', 'If the trace write fails, the action fails.', 'TRC-01 TRC-02', 'Failed-write tests.')
      ] },
    { id: 'data', name: 'Technical: Data', short: 'Data',
      desc: 'Agents read governed data. Context, features and traces stay consistent with systems of record.',
      items: [
        I('Quality gates', 'The agent reads input data.', 'The gate result travels with the data into the trace.', 'DQ-01', 'Gate dashboards.'),
        I('Lineage', 'The agent cites facts.', 'Every fact links back to a system of record.', 'DQ-02', 'Lineage samples.'),
        I('Golden records', 'The agent looks up suppliers, customers and assets.', 'One golden version per entity, with a named owner.', 'DQ-03', 'Duplicate-record rate.'),
        I('Permission-aware retrieval', 'The agent searches documents.', 'Retrieval applies the same access rights as the source system.', 'PCS-04 PRV-01', 'Retrieval access tests.'),
        I('Drift and labels', 'The agent learns from outcomes.', 'Live data stays close to the evaluated baseline, and overrides become labels.', 'MON-02 MON-04', 'Drift reports. Label sets.'),
        I('Trace and ledger tie-out', 'The agent posts through deterministic rules.', 'Trace totals equal ledger totals every day.', 'DQ-04 TRC-03', 'Tie-out reports.')
      ] }
  ];
  AE.layerById = {};
  AE.layers.forEach(function (l) { AE.layerById[l.id] = l; });
})(typeof window !== 'undefined' ? window : globalThis);
