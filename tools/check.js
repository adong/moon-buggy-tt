#!/usr/bin/env node
/* The headless check in node (no browser, no npm):
     node tools/check.js           the rules from the brief (see js/check.js)
     node tools/check.js --fails   also the broken versions, each of which must fail (proof the check can fail)
   Loads js/title.js, sim.js, bot.js and check.js into a sandbox with a fake `window`. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, JSON };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/title.js', 'js/sim.js', 'js/bot.js', 'js/check.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const MB = ctx.MB;
const args = process.argv.slice(2);
let bad = 0;

let t0 = Date.now();
const rules = MB.check.rules();
console.log(`rules: ${rules.filter((r) => r.ok).length} of ${rules.length} ok (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
for (const r of rules) console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.info ? ' (' + r.info + ')' : ''}`);
if (rules.some((r) => !r.ok)) bad++;

if (args.includes('--fails')) {
  t0 = Date.now();
  const sab = MB.check.sabotage();
  console.log(`fail variant: ${sab.filter((s) => s.caught).length} of ${sab.length} broken rules caught (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  for (const s of sab) console.log(`  ${s.caught ? 'caught' : 'MISSED'}: ${s.name}${s.probs.length ? ' (failed: ' + s.probs.join('; ') + ')' : ''}`);
  if (sab.some((s) => !s.caught)) bad++;
}
process.exitCode = bad ? 1 : 0;
