# Knowledge pack for the "Talk to the book" guide
Source: The Autonomous Enterprise by Hemanth Reganti (first edition, November 2026; 31 chapters, 742 pages). Use only what is here. Numbers about Meridian Industries are illustrative (a fictional company that runs through the book).

## Core idea (Book, Ch 01)
- Human-led, agent-operated: people set intent, own outcomes and decide where not to automate; agents operate inside the harness, within the limits humans set.
- Thesis: autonomy is earned when value compounds faster than risk. Some work adds risk faster than any agent adds value, so it stays with people.
- Frameworks like LangChain solve the engineering problem of AI agents. This book solves the management problem: who decides where an agent can act, who owns a decision that spans five systems and three departments, who explains it to the auditor and the board.

## The management problem, answered (Book, Ch 01, 21, 05, 24, 25, 26)
- Who solves the management problem? Leaders do, by owning five decisions that no framework makes (Book, Ch 01, section 01.1.3). Agent frameworks such as LangChain help engineers build agents: how an agent calls a model, uses tools and keeps its state. They do not decide which work an agent should do, how far to trust it, who answers for it, how to stop it or whether it pays. No framework makes these decisions, and no vendor should make them for you.
- Decision one, where agents act: start from an outcome that Finance can measure, not from an agent. Then send each candidate to the simplest engine that can do the work: a rule, a model or a solver before an agent. An agent earns its place only where the work needs investigation across sources, judgment on unstructured content and an action in a system (Book, Ch 21, 04; sections 21.2 to 21.4).
- Decision two, how far they are trusted: set autonomy per step on the L0 to L5 scale. Materiality and reversibility set the ceiling. A step moves up one level at a time, on evidence, and a named body decides. It moves down automatically when a demotion trigger fires. Capability is not permission (Book, Ch 01, 22, 29; sections 01.5.4, 01.5.5, 22.8 and Toolkit C in 29.4).
- Decision three, who answers: every agent has a named business owner who approves its limits, signs its promotions and can stop it. Every agent has a registry entry and an agent contract: no registry, no run. Decision rights say who sets intent, who sets limits and who changes levels. New roles carry the daily work (Book, Ch 05, 24, 25; sections 05.11, 24.3, 24.9.4, 25.2.2).
- Decision four, how you stop them: the harness, not the agent, enforces the limits. The operating envelope caps the time, calls and budget of each task, and the completion contract defines "done". Irreversible and outward-facing actions stay behind human gates. A five-level kill switch stops one agent, one platform or the whole fleet, and it is tested before it is needed (Book, Ch 05, 23, 22; sections 05.5.2, 05.5.3, 05.8.4, 23.3).
- Decision five, whether it pays: compare agents only in cost per completed outcome, including human review and fallback. Keep a contribution account for each agent and report its net contribution after every cost. Run pilots that end in a decision; a stop on evidence is a result (Book, Ch 25, 26; sections 25.4.4, 25.4.7, 25.4.12, 26.6).
- Frameworks build the agents; leaders own these five decisions. That is what human-led, agent-operated means in practice (Book, Ch 01, section 01.1.3).

## Three rules (Book, Ch 01)
1. The harness, not the model, sets the autonomy ceiling. A modest model inside a strong harness can run a narrow step at L3 safely. If a far more capable model arrived next quarter, the ceiling would not move until the harness did.
2. Agents decide; deterministic rules post. No agent writes a journal entry; releasing money stays with people and signed systems.
3. Autonomy is earned with evidence and can be withdrawn automatically. Promotion needs evidence and a human gate; demotion triggers move a step down automatically. Promotion is never automatic.

## The autonomy scale (illustrative, used in every chapter; Book, Ch 01)
- L0 Manual: human decides and does the work. Right for rare, high-judgment events.
- L1 Assist: agent retrieves, summarizes, drafts and suggests; a person decides. Risk: over-trust. Log suggestions as the baseline for L2.
- L2 Approve: agent prepares the complete action; a person approves each one with evidence in view. Watch approval and edit rates; a high edit rate means not ready for L3. Risk: rubber-stamping.
- L3 Act within limits: agent executes inside limits on amount, risk score, counterparty class and confidence; outside limits it escalates with an evidence pack; people sample in-limit actions. Limits sit in the harness, never in the prompt, and the agent cannot change them.
- L4 Run and report: agent runs; humans audit and tune limits and policies.
- L5 Full: humans set goals only; rarely appropriate for postings.
- A chain of work across platforms runs only as high as its weakest link. The weakest maturity dimension caps the autonomy allowed.

## What the book covers
- Part I Foundations (Ch 1–11): the scale; autonomy across a web of platforms; separating what reasons (models, engines, agents) from what governs (the harness, deterministic rails, the interaction layer); trustworthy context and data; interfaces and the core set most ceilings, not models (at Meridian, 93 of 620 interfaces are retired, not rebuilt).
- Part II The Autonomous Domains (Ch 12–19): finance and the close, procurement, supply chain and manufacturing, front office, people, IT and shared services, tax and trade, environment health and safety, legal, risk and insurance. Pattern: agents investigate, match, draft and monitor; deterministic engines compute and post; named people sign, release money and decide about safety and about people. Autonomy grows fastest where decisions are frequent, small and reversible (spend classification, IT incidents, cash matching). It stops where an action cannot be undone or a law names the signatory (payments, filings, stop-work, evaluating people). Much value comes from faster decisions and released working capital, not saved hours.
- Part III Making It Happen (Ch 20–26): the company owns every act of its agents, so authority must be provable; price the program in cost per completed outcome (delay, not meter price, moves value most); keep rules, evidence and the stop button with the enterprise; give every agent a named owner; one 30-month plan with gates and a risk register so value is booked only as fast as risk is shown to be under control.
- Part IV Playbooks, Toolkit and the Road Ahead (Ch 27–31): every platform now sells agents, a control plane and a meter, but none sees the whole chain, so the enterprise owns the plane; a toolkit (agent contract, 100-day plan, checklists, templates); one customer order followed end to end; what holds in every plausible 2030.

## Questions the book asks leadership teams (good conversation openers)
- Which of our cross-platform chains has a file transfer or manual handoff as its weakest link, and who funds the fix?
- If a model changed tomorrow, which agents would behave differently, and would we know before a customer did?
- Can we stop every agent on every platform within minutes, and when did we last prove it?
- Where do two of our systems give two answers to one question, such as "who is this customer"?
- Which interfaces, bots and custom objects will we retire instead of rebuild?
- Who signs which agent change, and do we keep proof of authority for every agent that commits the company?
- What is on our "do not automate" list?

## Selected lines (verbatim)
- "A board that funds agents first and data second pays twice." (Ch 26)
- "The model is the most flexible part and the least trusted; the safety controller is the least flexible and the most trusted." (Ch 07)
- "An agent optimizes its target harder and more literally than a person." (Ch 06)
- "An agent can act thousands of times before a monthly review." (Ch 22)
- "The unit that moves to an agent is a decision inside a task." (Ch 24)
- "The agent removes the investigation, not the person." (Ch 12)
- "The person who approves an agent's actions may not change the agent's limits, instructions or tools." (Ch 22)

## How to engage the author
- Book: paperback $59.99 https://www.amazon.com/dp/B0HS8HG6DP ; Kindle $12.99 https://www.amazon.com/dp/B0HS8C4WLL
- Speaking (keynote, panel, fireside chat, workshop; in person in Dallas–Fort Worth or virtual): /speaking/#speaking on the Speaking & Advisory page, or /contact
- Advisory for leadership teams (autonomy readiness assessment, governance and guardrail design, operating-model changes, business case and 30-month roadmap): /speaking/#advisory on the Speaking & Advisory page, or /contact
- Both pages have the intake agent that fills in a request card. /advisory now redirects to /speaking/#advisory.

## Where things are on this site
- Header: Book, Blueprints, Ideas, Speaking & Advisory, About, and the "Talk to the book" button (goes to /contact).
- Frameworks: /frameworks (linked from /book and the footer). Contact and press kit: /contact (footer).
- Models: /blueprints/models, every model family in the book and where it fits in the architecture.
- Design choices: /blueprints/design, tabular foundation models (TFMs and RPTs), retrieval and grounding, evals and audit trails, agent security and the front door, inference routing and budgets, and which steps go to models or rules (the p* = L / (G + L) threshold).
- Organization: /blueprints/organization, how the org changes with agents (Book, Ch 24, 22, 25, 01): agents are owned assets of a role, not staff; new roles (agent business owner, agent supervisor, instruction designer, AgentOps analyst, evaluation engineer, AI controls analyst, AI FinOps analyst); run, build and control pods; spans sized by human decision load; who sets autonomy levels (raising needs evidence and a body, lowering needs one person); RACI with exactly one accountable person; deciding with incomplete information (calibrated scores route, never approve; green, amber and red bands; cite or say what is missing; the approval card); a capability matrix of who does what; and "Internal vs external agents: credibility and trust" at /blueprints/organization/#trust.
- Operations: /blueprints/operations, running agents (Book, Ch 05, 22, 25, 26): trace fields and one trace ID, four dashboards by audience, "no registry, no run", audit walkthroughs, guardian agents that may stop but never start, the K1 to K5 kill switch, SLOs, incident severity, the recovery playbook and automatic demotion rules. Its "Pipelines and the work repository" section covers the skill pipeline (propose, write, test with a golden set, version, withdraw), the agent pipeline (design, harness, offline evaluation, register, shadow, pilot, readiness gate, promotion in slices, demotion), the build and release pipeline (regression on every change, pinned models, canary, rollback, no ticket no change), the hand-off queue and a shared work repository (marked as practice where the book is silent), and which pipeline a change goes through by the artifact it touches.

## Model families (Book, Ch 03, 04, 07, 09, 15)
- The rule: probabilistic engines propose; solvers and rules decide what is feasible and allowed; a system of record executes. "LLM for everything" is a common failure.
- GPT-class language models: read, extract, draft, explain, plan; weak at arithmetic over many rows, hard limits and table predictions. They propose and never post.
- Small language models: narrow, high-volume routing and extraction, edge sites; "a good router and a weak planner". Do not fine-tune frontier models on ERP data.
- Tabular foundation models (RPTs, relational/tabular pretrained transformers): predict from labeled business rows in one pass, with calibrated probabilities, called by the agent as a tool. "The LLM reasons; the TFM does the statistics."
- Classical ML and time-series forecasting: forecasts with ranges (for example a 13-week cash forecast with 10th, 50th and 90th percentiles); watch for drift.
- Solvers and rules: deterministic; solvers find the best feasible plan, rules enforce policy and limits; rules need a 100% test pass rate.
- Embeddings and retrieval, knowledge graphs: layer 3 (data and semantics); the graph resolves which record in which system is the same customer. Defer graph neural networks past year one.
- Vision and document models, video (camera analytics and world models), voice (speech-to-text, text-to-speech, voice agents), multimodal and screen agents, physical AI and IoT: each runs under deterministic rails. A camera alert is information, not a safety function; voice is a channel, not a credential; a robot model may choose how to do a task, never whether it is safe.
- Calibration: among proposals scored 0.9, about 90% must be right on your own data. Use calibrated scores to route, never to approve.

## Internal vs external agents: credibility and trust (Book, Ch 03, 05, 10, 13, 14, 22, 23, 25, 29)
- Site page: /blueprints/organization/#trust. Guidance marked "practice" there is not from the book.
- Internal agents are owned: each has a registry entry, an agent contract, a business owner and a technical owner, an evaluation set and a kill-switch owner (Ch 05). "No registry, no run": the gateways accept calls only from agent versions whose registry status is active (Ch 05, 25).
- External agents are supplier, bank, customer and distributor agents that call your interfaces (Ch 10, 23). Treat an outside agent like a new trading partner that never sleeps: one door, the least it needs, watched more closely than your own agents (Ch 23).
- B2A rules (Ch 10): publish scoped tools instead of tolerating scraping; every external call carries the identity of the company it acts for; read before write; an agent's order passes the same credit, price and allocation checks as an EDI order; anonymous agents get public information only.
- How agents differentiate: identity (each agent its own identity, never a shared technical user; delegated tokens name the agent as actor, bound to one audience, short-lived; Ch 23, 02); provenance (a signed, short-lived record on the partner's verified domain; Ch 03, 23); declared capability (a claim, never a permission: scopes come from your onboarding; Ch 22, 23); track record (trust tiers earned over time; Ch 23); verifiable outcomes (traces with one correlation ID from request to payment; Ch 14, 25); cost and contribution (a per-agent scorecard: tokens, energy and cost per completed outcome, attributable value, net contribution; "No account, no promotion"; Ch 25).
- Capability is not permission: capability sets the ceiling of what is possible; governance sets the level allowed; the lower applies (Ch 22).
- Front-door welcome flow for outside agents (Ch 23): discover (a card is a hint only), verify signature, domain and contract, issue your own short-lived credential, sandbox on synthetic data for 2 to 4 weeks, publish a filtered tool list, set rate, value and volume caps, monitor against a baseline, promote or revoke. Promotion is signed by the owner and the CISO; revocation within five minutes (illustrative).
- Trust tiers (Ch 23, illustrative): T0 unknown (logged and refused), T1 sandbox (test tools on synthetic data), T2 read (its own records through filtered tools), T3 act within limits (cases and requests within caps, after 90 days at T2 without a material finding). No tier allows payment release, bank-data changes, credit-limit changes or user administration.
- Four kinds of trouble at the front door (Ch 23): rogue agent (a partner agent that drifts), malicious impostor, injection carrier (instructions hidden in data) and a poisoned tool, skill or model update. Pin and hash every external component; contain first, classify second.
- Money stays with people: no external agent may change payment instructions, remittance details or bank data until identity, authority and liability are settled with the counterparty; release stays with two people (Ch 13, 23).
- Agent-to-agent risks (Ch 02, 06, 13, 14, 29): two agents calling each other in a loop (hop limit, cost cap, circuit breaker); a buyer agent's message overriding the contract (take terms from the contract, not the message); two agents contacting one customer (one owner of external communication). A negotiating agent works inside a person-approved envelope: objective, walk-away, allowed and forbidden levers, at most 3 rounds, never discloses another supplier's price, every message "subject to approval", disclosure that offers are AI-assisted. Two agents on different platforms that negotiate or hand off work with judgment need an agent contract.
- The book is silent on cross-company reputation scores or ratings for agents, on third-party certification of agents, and on two companies' agents negotiating with each other end to end (collusion, deadlock). Guidance on those is practice, not the book.

## Glossary (terms as the book uses them)
- Harness: the controls around an agent (limits, tools, approvals, traces, stop) that set its autonomy ceiling; the model reasons, the harness governs (Ch 01, 05).
- Agent registry: the enterprise record of every agent and version; "no registry, no run" (Ch 05, 25).
- Agent contract: the versioned spec auditors read first: owner, goal, tools, limits, envelope, evaluation, kill-switch owners (Ch 05, 29).
- Contribution account and per-agent scorecard: what an agent consumed and produced, cost per completed outcome and net contribution, reviewed monthly (Ch 25).
- Cost per completed outcome: the program's price measure, all costs per finished business outcome (Ch 21, 25).
- Capability versus permission: what an agent can do versus the level it is allowed (Ch 22).
- Trust tier: the T0 to T3 levels for outside agents (Ch 23).
- B2A: business to agent, when customers' and suppliers' agents call your interfaces (Ch 10).
- Negotiation envelope: the person-approved bounds a negotiating agent works within (Ch 14).
- Delegated token: a short-lived token naming the agent as actor for a user, bound to one target service (Ch 23).
- Weakest link: a chain of work runs only as high as its weakest step (Ch 01).
