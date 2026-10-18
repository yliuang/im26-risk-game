// Run with: node tests/model.test.js
const assert = require('assert');
const M = require('../model.js');

const all = { S1: 1, S2: 1, S3: 1, S4: 1, S5: 1, S6: 1, S7: 1, S8: 1 };
const none = { S1: 20, S2: 20, S3: 20, S4: 20, S5: 20, S6: 20, S7: 20, S8: 20 };
const ret = (d, rolls, id) => M.teamResult(d, rolls).scen[id].retained;

// Excel "Group A" package: D1 b, D2 b, D3 b, D4 a, D5 b, D6 a, D7 b, D8 a
const groupA = { D1: 'b', D2: 'b', D3: 'b', D4: 'a', D5: 'b', D6: 'a', D7: 'b', D8: 'a' };
assert.strictEqual(ret(groupA, all, 'S1'), 15250);   // 80% coinsurance penalty
assert.strictEqual(ret(groupA, all, 'S2'), 8750);    // jewelry theft limit 1,500
assert.strictEqual(ret(groupA, all, 'S3'), 178000);  // no earthquake cover
assert.strictEqual(ret(groupA, all, 'S4'), 0);
assert.strictEqual(ret(groupA, all, 'S5'), 1000);
assert.strictEqual(ret(groupA, all, 'S6'), 13000);   // HMO: non-network not covered; supplemental LTD: wages replaced
assert.strictEqual(ret(groupA, all, 'S7'), 200);     // HMO copayments
assert.strictEqual(ret(groupA, all, 'S8'), 20000);

const full = { D1: 'a', D2: 'a', D3: 'a', D4: 'b', D5: 'a', D6: 'b', D7: 'a', D8: 'b' };
assert.strictEqual(ret(full, all, 'S1'), 250);
assert.strictEqual(ret(full, all, 'S2'), 250);
assert.strictEqual(ret(full, all, 'S3'), 16000);     // 10% of 160,000
assert.strictEqual(ret(full, all, 'S4'), 800);
assert.strictEqual(ret(full, all, 'S5'), 500);
assert.strictEqual(ret(full, all, 'S6'), 3000 + 8000); // PPO OON limit + employer LTD gap
assert.strictEqual(ret(full, all, 'S7'), 300);
assert.strictEqual(ret(full, all, 'S8'), 0);         // OON limit already reached
assert.strictEqual(ret({ ...full, D1: 'b' }, all, 'S3'), 88000); // 50% HO-3: coverage A cap 80,000 - 8,000 ded
assert.strictEqual(ret(full, { ...all, S6: 20 }, 'S8'), 3000);

// Ski lessons: roll 3 is a loss without lessons, no loss with them
assert.strictEqual(M.teamResult({ ...full, D8: 'b' }, { ...none, S6: 3 }).scen.S6.status, 'loss');
assert.strictEqual(M.teamResult({ ...full, D8: 'a' }, { ...none, S6: 3 }).scen.S6.status, 'none');

// Net worth bookkeeping matches the Excel: start - premiums - retained
const rA = M.teamResult(groupA, all);
assert.strictEqual(rA.stage[1].cost, 3250);
assert.strictEqual(rA.nw1, 218000 - 3250 - (15250 + 8750 + 178000 + 0 + 1000));

// Budget: 1a+2a+3a+5b = 6,500 exceeds the Stage 1 budget
assert.strictEqual(M.budget({ D1: 'a', D2: 'a', D3: 'a', D4: 'b', D5: 'b' }).over1, true);

const opt = M.optimum();
console.log('EV optimum:', JSON.stringify(opt.d), 'expected cost', opt.total.toFixed(2));
assert.deepStrictEqual(opt.d, { D1: 'a', D2: 'b', D3: 'a', D4: 'b', D5: 'b', D6: 'b', D7: 'a', D8: 'a' });
assert.strictEqual(Math.round(M.expectedLoss(opt.d, 1)), 4390);
assert.strictEqual(Math.round(M.expectedLoss(opt.d, 2)), 1715); // 0.28*3000 + 0.25*300 + 0.1*8000
console.log('all model tests passed');
