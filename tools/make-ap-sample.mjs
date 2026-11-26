// Generates the fixed SAMPLE DATASET of accounts-payable exceptions used by the real improvement loop on
// /blueprints/loops/. Run once; the output is committed. Synthetic data: no real suppliers, invoices or people.
//   node tools/make-ap-sample.mjs  ->  src/assets/data/ap-sample.json
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'data', 'ap-sample.json');
const N = 150;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(20261126);
const pick = (items) => {
  const total = items.reduce((n, [, w]) => n + w, 0);
  let x = R() * total;
  for (const [v, w] of items) if ((x -= w) < 0) return v;
  return items[items.length - 1][0];
};
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const other = (correct) => pick([['approve', 1], ['adjust', 1], ['reject', 1], ['hold', 1]].filter(([v]) => v !== correct));

const items = [];
for (let i = 0; i < N; i++) {
  const supplier_size = pick([['small', 35], ['mid', 35], ['large', 30]]);
  const exception_type = pick([['price_variance', 30], ['quantity_mismatch', 20], ['missing_po', 15], ['duplicate_suspect', 12], ['tax_code', 15], ['bank_detail_change', 8]]);
  // Log-normal amounts, median about $2,400; larger suppliers send larger invoices.
  const scale = supplier_size === 'small' ? 0.55 : supplier_size === 'mid' ? 1 : 1.8;
  const z = Math.sqrt(-2 * Math.log(R() || 1e-9)) * Math.cos(2 * Math.PI * R());
  const amount = Math.max(85, Math.min(68000, round(2400 * scale * Math.exp(1.05 * z), 2)));
  let variance_pct = null;
  let correct;
  if (exception_type === 'price_variance' || exception_type === 'quantity_mismatch') {
    variance_pct = round(0.2 + R() ** 1.9 * 11.8, 1);
    correct = variance_pct <= 2.0 ? 'approve' : variance_pct <= 4.5 ? (R() < 0.55 ? 'approve' : 'adjust') : (R() < 0.7 ? 'adjust' : 'hold');
  } else if (exception_type === 'missing_po') correct = R() < 0.6 ? 'approve' : 'hold';
  else if (exception_type === 'duplicate_suspect') correct = R() < 0.55 ? 'reject' : 'approve';
  else if (exception_type === 'tax_code') correct = R() < 0.7 ? 'adjust' : 'approve';
  else correct = 'hold';

  // Needs a person: every bank-detail change, anything above the $25,000 delegated authority, and some judgment cases.
  const judgment = R() < 0.09;
  const needs_human = exception_type === 'bank_detail_change' || amount > 25000 || judgment;

  // The resolver agent's suggestion and its confidence. Judgment cases and small suppliers (thinner history)
  // get lower confidence and more mistakes; small-supplier mistakes lean towards holding the invoice.
  let confidence = 0.55 + 0.44 * R() ** 0.55;
  if (judgment) confidence = 0.5 + R() * 0.32;
  let pCorrect = confidence ** 2.2;
  if (supplier_size === 'small') pCorrect -= 0.12;
  if (judgment) pCorrect -= 0.25;
  let suggestion = R() < pCorrect ? correct : supplier_size === 'small' && R() < 0.75 ? (correct === 'hold' ? 'approve' : 'hold') : other(correct);
  if (exception_type === 'bank_detail_change') suggestion = 'hold';
  items.push({
    id: `AP-${String(i + 1).padStart(4, '0')}`,
    supplier: `Supplier ${String(1 + Math.floor(R() * 60)).padStart(2, '0')}`,
    supplier_size,
    exception_type,
    amount,
    variance_pct,
    agent_suggestion: suggestion,
    agent_confidence: round(confidence, 2),
    correct_resolution: correct,
    needs_human,
  });
}

const out = {
  label: 'Sample data: synthetic accounts-payable exceptions. Not real suppliers, invoices or people.',
  generated: '2026-11-26',
  seed: 20261126,
  fields: {
    amount: 'Invoice amount in USD',
    supplier_size: 'small | mid | large',
    exception_type: 'price_variance | quantity_mismatch | missing_po | duplicate_suspect | tax_code | bank_detail_change',
    variance_pct: 'Price or quantity variance against the purchase order, percent (variance exceptions only)',
    agent_suggestion: "The resolver agent's suggested resolution: approve | adjust | reject | hold",
    agent_confidence: "The resolver agent's confidence in its suggestion, 0 to 1",
    correct_resolution: 'Ground truth: the resolution a careful AP specialist would choose',
    needs_human: 'Ground truth: a person must handle it (bank-detail change, above the $25,000 delegated authority, or a judgment call)',
  },
  items,
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`Wrote ${items.length} sample exceptions to ${OUT}`);
