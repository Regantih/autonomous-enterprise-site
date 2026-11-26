# Knowledge pack for the "Talk to the book" guide
Source: The Autonomous Enterprise by Hemanth Reganti (first edition, November 2026; 31 chapters, 742 pages). Use only what is here. Numbers about Meridian Industries are illustrative (a fictional company that runs through the book).

## Core idea
- Human-led, agent-operated: people set intent, own outcomes and decide where not to automate; agents operate inside the harness, within the limits humans set.
- Thesis: autonomy is earned when value compounds faster than risk. Some work adds risk faster than any agent adds value, so it stays with people.
- Frameworks like LangChain solve the engineering problem of AI agents. This book solves the management problem: who decides where an agent can act, who owns a decision that spans five systems and three departments, who explains it to the auditor and the board.

## Three rules
1. The harness, not the model, sets the autonomy ceiling. A modest model inside a strong harness can run a narrow step at L3 safely. If a far more capable model arrived next quarter, the ceiling would not move until the harness did.
2. Agents decide; deterministic rules post. No agent writes a journal entry; releasing money stays with people and signed systems.
3. Autonomy is earned with evidence and can be withdrawn automatically. Promotion needs evidence and a human gate; demotion triggers move a step down automatically. Promotion is never automatic.

## The autonomy scale (illustrative, used in every chapter)
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
- "A board that funds agents first and data second pays twice."
- "The model is the most flexible part and the least trusted; the safety controller is the least flexible and the most trusted."
- "An agent optimizes its target harder and more literally than a person."
- "An agent can act thousands of times before a monthly review."
- "The unit that moves to an agent is a decision inside a task."
- "The agent removes the investigation, not the person."
- "The person who approves an agent's actions may not change the agent's limits, instructions or tools."

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
- Organization: /blueprints/organization, how the org changes with agents (Book, Ch 24, 22, 25, 01): agents are owned assets of a role, not staff; new roles (agent business owner, agent supervisor, instruction designer, AgentOps analyst, evaluation engineer, AI controls analyst, AI FinOps analyst); run, build and control pods; spans sized by human decision load; who sets autonomy levels (raising needs evidence and a body, lowering needs one person); RACI with exactly one accountable person; deciding with incomplete information (calibrated scores route, never approve; green, amber and red bands; cite or say what is missing; the approval card); and a capability matrix of who does what.
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
