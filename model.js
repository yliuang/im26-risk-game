/* Personal Risk Management Game: decisions, scenarios and loss settlement.
   Pure functions with no DOM access, so the same file runs in the browser and in Node tests. */
(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.RMGame = model;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const START_NET_WORTH = 218000;
  const STAGE_BUDGET = 6000;
  const DWELLING = 160000;          // replacement cost of the house
  const COINSURANCE = 0.8;          // 80% coinsurance provision on the dwelling
  const HO_DEDUCTIBLE = 250;        // HO-3, once per occurrence across Coverages A-D
  const JEWELRY_THEFT_LIMIT = 1500; // HO-3 special limit for theft of jewelry
  const MONTHLY_SALARY = 100000 / 12;
  const MONTHLY_LOST_WAGES = 6000;  // CHF 30,000 over 5 months
  const DISABLED_MONTHS = 5;
  const STD_MONTHS = 3;             // employer STD replaces 100% for the first 90 days

  const DECISIONS = [
    { id: 'D1', stage: 1, title: 'HO-3 homeowners insurance', options: [
      { key: 'a', short: 'Full value', detail: 'Coverage A on the full dwelling value (CHF 160,000); Coverage C CHF 80,000', cost: 3000 },
      { key: 'b', short: '50% of value', detail: 'Coverage A on 50% of the dwelling value (CHF 80,000); Coverage C CHF 40,000', cost: 1500 }] },
    { id: 'D2', stage: 1, title: 'Scheduled jewelry endorsement', options: [
      { key: 'a', short: 'Buy', detail: 'Agreed value CHF 10,000, no deductible', cost: 2000 },
      { key: 'b', short: 'Skip', detail: 'Rely on HO-3 Coverage C', cost: 0 }] },
    { id: 'D3', stage: 1, title: 'Earthquake endorsement', options: [
      { key: 'a', short: 'Buy', detail: 'Dwelling and loss of use; deductible 10% of the insured dwelling value', cost: 500 },
      { key: 'b', short: 'Skip', detail: 'No earthquake cover', cost: 0 }] },
    { id: 'D4', stage: 1, title: 'Air-conditioning endorsement', options: [
      { key: 'a', short: 'Buy', detail: 'Covers the required maintenance, no deductible', cost: 750 },
      { key: 'b', short: 'Skip', detail: 'Retain the maintenance cost', cost: 0 }] },
    { id: 'D5', stage: 1, title: 'Auto physical damage', options: [
      { key: 'a', short: 'Low deductibles', detail: 'OTC CHF 250, collision CHF 500', cost: 2000 },
      { key: 'b', short: 'High deductibles', detail: 'OTC CHF 500, collision CHF 1,000', cost: 1000 },
      { key: 'c', short: 'Skip', detail: 'No physical damage cover', cost: 0 }] },
    { id: 'D6', stage: 2, title: 'Supplemental LTD insurance', options: [
      { key: 'a', short: 'Buy', detail: '75% of salary, up to CHF 6,000/month; 90-day waiting period', cost: 2400 },
      { key: 'b', short: 'Skip', detail: 'Employer LTD only: 50% of salary, up to CHF 2,000/month', cost: 0 }] },
    { id: 'D7', stage: 2, title: 'Health plan', options: [
      { key: 'a', short: 'PPO', detail: 'Deductible 300 in / 600 out of network; 80% out of network; out-of-network limit CHF 3,000', cost: 1800 },
      { key: 'b', short: 'HMO', detail: 'In-network only; no deductible; CHF 25 copayment; limit CHF 2,000', cost: 1200 }] },
    { id: 'D8', stage: 2, title: 'Ski lessons and helmet (loss control)', options: [
      { key: 'a', short: 'Buy', detail: 'Halves the chance of a skiing accident', cost: 300 },
      { key: 'b', short: 'Skip', detail: 'No change to the skiing risk', cost: 0 }] }
  ];

  const SCENARIOS = [
    { id: 'S1', stage: 1, short: 'Fire', title: 'Fire in the attached garage', loss: '25% of the dwelling value (CHF 40,000)', max: 4 },
    { id: 'S2', stage: 1, short: 'Theft', title: 'Theft of contents, incl. all of Karen’s jewelry', loss: 'CHF 22,000 (CHF 10,000 of which is jewelry)', max: 4 },
    { id: 'S3', stage: 1, short: 'Earthquake', title: 'Earthquake', loss: 'Total loss of the dwelling plus CHF 18,000 loss of use', max: 2 },
    { id: 'S4', stage: 1, short: 'Air-con', title: 'Air-conditioning maintenance', loss: 'CHF 800', max: 16 },
    { id: 'S5', stage: 1, short: 'Camry', title: 'Camry scraped by a fire hydrant', loss: 'CHF 6,300', max: 7 },
    { id: 'S6', stage: 2, short: 'Skiing', title: 'John’s skiing accident, non-network surgeon', loss: 'CHF 13,000 medical + CHF 30,000 lost wages (5 months)', max: 4, maxWithControl: 2 },
    { id: 'S7', stage: 2, short: 'Tom', title: 'Tom’s serious illness, network physicians (8 visits)', loss: 'CHF 5,500 medical', max: 5 },
    { id: 'S8', stage: 2, short: 'Karen', title: 'Karen’s pregnancy complications, non-network specialist', loss: 'CHF 20,000 medical', max: 4 }
  ];

  const chf = n => (n < 0 ? '−' : '') + 'CHF ' + Math.round(Math.abs(n)).toLocaleString('en-US');
  const pct = x => (Math.round(x * 1000) / 10).toLocaleString('en-US') + '%';

  const decisionsOf = stage => DECISIONS.filter(d => d.stage === stage);
  const scenariosOf = stage => SCENARIOS.filter(s => s.stage === stage);
  const scenario = id => SCENARIOS.find(s => s.id === id);

  function complete(d, stage) {
    return decisionsOf(stage).every(x => d && x.options.some(o => o.key === d[x.id]));
  }

  function stageCost(d, stage) {
    return decisionsOf(stage).reduce((sum, x) => {
      const o = x.options.find(o => o.key === d[x.id]);
      return sum + (o ? o.cost : 0);
    }, 0);
  }

  function budget(d) {
    const c1 = stageCost(d, 1), c2 = stageCost(d, 2);
    const avail2 = STAGE_BUDGET + Math.max(0, STAGE_BUDGET - c1);
    return { c1, c2, avail1: STAGE_BUDGET, avail2, over1: c1 > STAGE_BUDGET, over2: c2 > avail2 };
  }

  function lossRange(id, d) {
    const s = scenario(id);
    return id === 'S6' && d && d.D8 === 'a' ? s.maxWithControl : s.max;
  }
  const probability = (id, d) => lossRange(id, d) / 20;

  function settled(loss, paid, steps) {
    const retained = loss - paid;
    return { loss, paid, retained, steps: steps.concat(`Retained by the Smiths: ${chf(retained)}`) };
  }

  const coverageA = d => (d.D1 === 'a' ? DWELLING : DWELLING / 2);

  // ---- Stage 1: each occurrence is settled on its own -------------------------------------

  function fire(d) {
    const loss = 0.25 * DWELLING, A = coverageA(d), required = COINSURANCE * DWELLING;
    const steps = [`Loss: ${chf(loss)} (25% of the ${chf(DWELLING)} dwelling)`];
    let covered;
    if (A >= required) {
      covered = Math.min(loss, A);
      steps.push(`Coverage A ${chf(A)} meets the 80% requirement (${chf(required)}), so the loss is covered in full`);
    } else {
      covered = Math.min(A, loss * A / required);
      steps.push(`80% coinsurance: Coverage A ${chf(A)} ÷ required ${chf(required)} = ${pct(A / required)} of the loss = ${chf(covered)}`);
    }
    const paid = Math.max(0, covered - HO_DEDUCTIBLE);
    steps.push(`Minus the ${chf(HO_DEDUCTIBLE)} deductible: the insurer pays ${chf(paid)}`);
    return settled(loss, paid, steps);
  }

  function theft(d) {
    const jewelry = 10000, other = 12000, loss = jewelry + other, C = coverageA(d) / 2;
    const steps = [`Loss: ${chf(loss)} (jewelry ${chf(jewelry)}, other contents ${chf(other)})`];
    let paid = 0, hoCovered;
    if (d.D2 === 'a') {
      paid += jewelry;
      steps.push(`Scheduled jewelry endorsement pays the agreed ${chf(jewelry)} (no deductible)`);
      hoCovered = Math.min(other, C);
      steps.push(`HO-3 Coverage C (limit ${chf(C)}) covers the other contents: ${chf(hoCovered)}`);
    } else {
      hoCovered = Math.min(other + Math.min(jewelry, JEWELRY_THEFT_LIMIT), C);
      steps.push(`HO-3 Coverage C (limit ${chf(C)}): other contents ${chf(other)} + jewelry only up to the ${chf(JEWELRY_THEFT_LIMIT)} theft limit = ${chf(hoCovered)}`);
    }
    const hoPaid = Math.max(0, hoCovered - HO_DEDUCTIBLE);
    steps.push(`Minus the ${chf(HO_DEDUCTIBLE)} HO-3 deductible: HO-3 pays ${chf(hoPaid)}`);
    return settled(loss, paid + hoPaid, steps);
  }

  function earthquake(d) {
    const lossOfUse = 18000, loss = DWELLING + lossOfUse;
    const steps = [`Loss: total loss of the ${chf(DWELLING)} dwelling + ${chf(lossOfUse)} loss of use = ${chf(loss)}`];
    if (d.D3 !== 'a') {
      steps.push('HO-3 excludes earthquake and no endorsement was bought: nothing is paid');
      return settled(loss, 0, steps);
    }
    const A = coverageA(d), required = COINSURANCE * DWELLING;
    const dwellingCovered = Math.min(A, DWELLING * Math.min(1, A / required));
    if (A >= required) {
      steps.push(`Dwelling covered up to Coverage A: ${chf(dwellingCovered)}`);
    } else {
      steps.push(`Dwelling: 80% coinsurance gives ${pct(A / required)} × ${chf(DWELLING)} = ${chf(DWELLING * A / required)}, capped at Coverage A: ${chf(dwellingCovered)}`);
    }
    steps.push(`Loss of use covered: ${chf(lossOfUse)}`);
    const ded = 0.1 * A, paid = Math.max(0, dwellingCovered + lossOfUse - ded);
    steps.push(`Minus the deductible, 10% of the insured dwelling value ${chf(A)} = ${chf(ded)}: the insurer pays ${chf(paid)}`);
    return settled(loss, paid, steps);
  }

  function airConditioning(d) {
    const loss = 800, steps = [`Cost: ${chf(loss)}`];
    if (d.D4 === 'a') {
      steps.push('The air-conditioning endorsement pays it in full (no deductible)');
      return settled(loss, loss, steps);
    }
    steps.push('No endorsement: the Smiths pay the maintenance themselves');
    return settled(loss, 0, steps);
  }

  function camry(d) {
    const loss = 6300, steps = [`Damage: ${chf(loss)}, a collision loss (single-vehicle accident with a hydrant)`];
    const ded = d.D5 === 'a' ? 500 : d.D5 === 'b' ? 1000 : null;
    if (ded === null) {
      steps.push('No auto physical damage cover: nothing is paid');
      return settled(loss, 0, steps);
    }
    steps.push(`Collision deductible ${chf(ded)}: the insurer pays ${chf(loss - ded)}`);
    return settled(loss, loss - ded, steps);
  }

  const STAGE1 = { S1: fire, S2: theft, S3: earthquake, S4: airConditioning, S5: camry };

  // ---- Stage 2: annual deductibles and out-of-pocket limits are shared, so settle jointly ----

  function stage2(occ, d) {
    const ppo = d.D7 === 'a';
    let inDedUsed = 0, oonDedUsed = 0, oonOopUsed = 0;
    const out = {};

    function ppoOutOfNetwork(charge) {
      const steps = [];
      const ded = Math.min(600 - oonDedUsed, charge);
      oonDedUsed += ded;
      let share = ded + 0.2 * (charge - ded);
      steps.push(ded > 0
        ? `PPO out of network: deductible ${chf(ded)} + 20% of the remaining ${chf(charge - ded)} = ${chf(share)}`
        : `PPO out of network: deductible already met, 20% coinsurance = ${chf(share)}`);
      const room = 3000 - oonOopUsed;
      if (share > room) {
        steps.push(`Out-of-network limit CHF 3,000${oonOopUsed > 0 ? ` (${chf(oonOopUsed)} already paid this year)` : ''}: the Smiths pay ${chf(room)}`);
        share = room;
      }
      oonOopUsed += share;
      return { share, steps };
    }

    if (occ.S6) {
      const medical = 13000, lost = MONTHLY_LOST_WAGES * DISABLED_MONTHS;
      const steps = [`Medical: ${chf(medical)}, surgery by a non-network orthopedic specialist`];
      let medShare;
      if (ppo) {
        const r = ppoOutOfNetwork(medical);
        medShare = r.share;
        steps.push(...r.steps);
      } else {
        medShare = medical;
        steps.push('The HMO covers in-network services only: the surgery is not covered');
      }
      steps.push(`Lost wages: ${DISABLED_MONTHS} months × ${chf(MONTHLY_LOST_WAGES)} = ${chf(lost)}`);
      steps.push(`Months 1–${STD_MONTHS}: the employer’s short-term disability replaces 100%`);
      const ltdMonths = DISABLED_MONTHS - STD_MONTHS;
      let benefit;
      if (d.D6 === 'a') {
        benefit = Math.min(0.75 * MONTHLY_SALARY, 6000);
        steps.push(`Months 4–5: with supplemental LTD, 75% of the ${chf(MONTHLY_SALARY)} monthly salary = ${chf(0.75 * MONTHLY_SALARY)}, capped at ${chf(6000)}/month`);
      } else {
        benefit = Math.min(0.5 * MONTHLY_SALARY, 2000);
        steps.push(`Months 4–5: employer LTD pays 50% of the ${chf(MONTHLY_SALARY)} monthly salary = ${chf(0.5 * MONTHLY_SALARY)}, capped at ${chf(2000)}/month`);
      }
      const wageShare = ltdMonths * Math.max(0, MONTHLY_LOST_WAGES - benefit);
      steps.push(`Lost wages not replaced: ${ltdMonths} × ${chf(Math.max(0, MONTHLY_LOST_WAGES - benefit))} = ${chf(wageShare)}`);
      const loss = medical + lost;
      out.S6 = settled(loss, loss - medShare - wageShare, steps);
    }

    if (occ.S7) {
      const medical = 5500, steps = [`Medical: ${chf(medical)}, tests and 8 office visits with network physicians`];
      let share;
      if (ppo) {
        share = Math.min(300 - inDedUsed, medical);
        inDedUsed += share;
        steps.push(`PPO in network: family deductible ${chf(share)}, then 100% covered`);
      } else {
        share = Math.min(8 * 25, 2000);
        steps.push(`HMO in network: no deductible, CHF 25 copayment × 8 office visits = ${chf(share)}`);
      }
      out.S7 = settled(medical, medical - share, steps);
    }

    if (occ.S8) {
      const medical = 20000, steps = [`Medical: ${chf(medical)}, non-network pediatric specialist`];
      let share;
      if (ppo) {
        const r = ppoOutOfNetwork(medical);
        share = r.share;
        steps.push(...r.steps);
      } else {
        share = medical;
        steps.push('The HMO covers in-network services only: the specialist is not covered');
      }
      out.S8 = settled(medical, medical - share, steps);
    }
    return out;
  }

  // ---- Results for one team ---------------------------------------------------------------

  function noLoss(id, d, roll) {
    const range = lossRange(id, d);
    const note = id === 'S6' && d.D8 === 'a' && roll <= scenario(id).max
      ? `Rolled ${roll}: no loss, because the ski lessons shrink the loss range to 1–${range}`
      : `Rolled ${roll}: no loss (loss only on 1–${range})`;
    return { loss: 0, paid: 0, retained: 0, steps: [note] };
  }

  function teamResult(d, rolls) {
    d = d || {};
    const r = { scen: {}, stage: {} };
    for (const stage of [1, 2]) {
      const ok = complete(d, stage), ids = scenariosOf(stage).map(s => s.id);
      const occ = {};
      for (const id of ids) {
        const roll = rolls[id];
        if (roll == null) r.scen[id] = { status: 'pending', retained: 0, steps: ['Not rolled yet'] };
        else if (!ok) r.scen[id] = { status: 'missing', retained: 0, steps: ['Decisions for this stage are incomplete'] };
        else if (roll <= lossRange(id, d)) occ[id] = roll;
        else r.scen[id] = Object.assign({ status: 'none', roll }, noLoss(id, d, roll));
      }
      if (ok) {
        const joint = stage === 2 ? stage2({ S6: 'S6' in occ, S7: 'S7' in occ, S8: 'S8' in occ }, d) : null;
        for (const id of Object.keys(occ)) {
          const s = stage === 1 ? STAGE1[id](d) : joint[id];
          s.steps.unshift(`Rolled ${occ[id]}: loss (loss on 1–${lossRange(id, d)})`);
          r.scen[id] = Object.assign({ status: 'loss', roll: occ[id] }, s);
        }
      }
      const cost = stageCost(d, stage);
      const retained = ids.reduce((sum, id) => sum + r.scen[id].retained, 0);
      const rolled = ids.every(id => rolls[id] != null);
      r.stage[stage] = { complete: ok, rolled, done: ok && rolled, cost, retained,
        expected: ok ? expectedLoss(d, stage) : null };
    }
    const b = budget(d);
    r.budget = b;
    r.nw1 = START_NET_WORTH - r.stage[1].cost - r.stage[1].retained;
    r.nw2 = r.nw1 - r.stage[2].cost - r.stage[2].retained;
    r.expectedNw = r.stage[1].expected == null || r.stage[2].expected == null ? null
      : START_NET_WORTH - b.c1 - b.c2 - r.stage[1].expected - r.stage[2].expected;
    return r;
  }

  // ---- Expected values: enumerate every combination of the stage's loss events ------------

  function expectedLoss(d, stage) {
    const ids = scenariosOf(stage).map(s => s.id);
    if (stage === 1) {
      return ids.reduce((sum, id) => sum + probability(id, d) * STAGE1[id](d).retained, 0);
    }
    let total = 0;
    for (let mask = 0; mask < 1 << ids.length; mask++) {
      const occ = {};
      let p = 1;
      ids.forEach((id, i) => {
        const hit = (mask >> i) & 1;
        occ[id] = !!hit;
        p *= hit ? probability(id, d) : 1 - probability(id, d);
      });
      const out = stage2(occ, d);
      total += p * Object.values(out).reduce((s, x) => s + x.retained, 0);
    }
    return total;
  }

  function allPackages() {
    const lists = DECISIONS.map(x => x.options.map(o => o.key));
    const result = [];
    (function walk(i, acc) {
      if (i === DECISIONS.length) { result.push(Object.assign({}, acc)); return; }
      for (const k of lists[i]) { acc[DECISIONS[i].id] = k; walk(i + 1, acc); }
    })(0, {});
    return result;
  }

  // Lowest expected cost of risk (premiums + expected retained losses) within the budget.
  function optimum() {
    let best = null;
    for (const d of allPackages()) {
      const b = budget(d);
      if (b.over1 || b.over2) continue;
      const total = b.c1 + b.c2 + expectedLoss(d, 1) + expectedLoss(d, 2);
      if (!best || total < best.total - 1e-9) best = { d, total };
    }
    return best;
  }

  // Expected stage cost of each option of each decision, other decisions held at `base`.
  function optionComparison(base) {
    return DECISIONS.map(x => ({
      id: x.id, title: x.title, stage: x.stage,
      options: x.options.map(o => {
        const d = Object.assign({}, base, { [x.id]: o.key });
        const b = budget(d);
        return { key: o.key, short: o.short, cost: o.cost,
          expected: stageCost(d, x.stage) + expectedLoss(d, x.stage),
          overBudget: b.over1 || b.over2, chosen: base[x.id] === o.key };
      })
    }));
  }

  return { START_NET_WORTH, STAGE_BUDGET, DECISIONS, SCENARIOS, decisionsOf, scenariosOf, scenario,
    complete, stageCost, budget, lossRange, probability, teamResult, expectedLoss, optimum,
    optionComparison, chf, pct };
});
