// Records one REAL run of the improvement loop on the live site and saves the event log the browser received,
// so visitors can replay it when the agents are unavailable. Drives the real page with a headless browser:
// asks the Proposer to edit the scorer, starts a run, asks why on the first one-way door, approves it, switches
// the goal at the monthly reframe. At most 10 loop calls plus 1 instruction call.
//   PLAYWRIGHT=/path/to/node_modules/playwright node tools/record-loop-run.mjs [https://humanledenterprise.com]
//   -> content/loops-recorded-run.json (then npm run build)
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const SITE = (process.argv[2] || 'https://humanledenterprise.com').replace(/\/+$/, '');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'loops-recorded-run.json');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const offsite = [];
page.on('request', (r) => { if (!r.url().startsWith(SITE)) offsite.push(r.url()); });
await page.goto(`${SITE}/blueprints/loops/`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-a="start"]');
const state = () => page.evaluate(() => window.AE.loopsRoom.state());

await page.click('[data-chip="scorer"]');
await page.waitForFunction(() => !window.AE.loopsRoom.state().asking, null, { timeout: 30000 });
const startedAt = new Date();
await page.click('.or-start');
let asked = false;
for (let i = 0; i < 400; i++) {
  await page.waitForTimeout(1000);
  const s = await state();
  if (s.ended || s.halted) break;
  if (s.busy || s.asking) continue;
  const why = page.locator('.or-dec:not(.answered) [data-dec="why"]');
  const approve = page.locator('.or-dec:not(.answered) [data-dec="approve"]');
  const goal = page.locator('.or-dec-goal:not(.answered) [data-goal="fpr"]');
  if (!asked && await why.count()) { asked = true; await why.first().click(); continue; }
  if (await approve.count()) { await approve.first().click(); continue; }
  if (await goal.count()) { await goal.first().click(); continue; }
}
const final = await state();
const transcript = (await page.evaluate(() => window.AE.loopsRoom.transcript())).map((x) => (x.k === 'ev' && x.ev.t === 'run' ? { k: 'ev', ev: { t: 'run' } } : x));
await browser.close();

const when = startedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
  .replace(/\s?AM$/, ' am').replace(/\s?PM$/, ' pm');
const usage = transcript.filter((x) => x.k === 'ev' && x.ev.t === 'usage').map((x) => x.ev);
const agentsUsage = transcript.filter((x) => x.k === 'agents' && x.usage).map((x) => x.usage);
const all = [...usage, ...agentsUsage];
const rec = {
  label: `Recorded real run, ${when} Central`,
  recorded_at: startedAt.toISOString(),
  site: SITE,
  note: 'The event log the browser received from the production agents and code during one real run, replayed as recorded.',
  summary: {
    ended: final.ended, halted: final.halted, goal: final.goal, champion: final.champion,
    loop_calls: usage.length, instruction_calls: agentsUsage.length,
    input_tokens: all.reduce((n, u) => n + u.input_tokens, 0), output_tokens: all.reduce((n, u) => n + u.output_tokens, 0),
    cost_usd: Number(all.reduce((n, u) => n + (u.input_tokens * 0.293 + u.output_tokens * 2.253) / 1e6, 0).toFixed(6)),
  },
  transcript,
};
writeFileSync(OUT, JSON.stringify(rec, null, 1) + '\n');
console.log(JSON.stringify(rec.summary, null, 1));
if (offsite.length) console.log('Off-site requests:', offsite);
