/* Personal Risk Management Game: classroom interface. Game logic lives in model.js. */
(function () {
  'use strict';
  const M = window.RMGame;
  const STORE = 'im26-risk-game-v1';
  const MAX_TEAMS = 40;
  // Team ids A–Z, then AA, AB, …
  const teamId = i => (i < 26 ? '' : String.fromCharCode(64 + Math.floor(i / 26))) + String.fromCharCode(65 + (i % 26));
  const STEPS = ['Setup', 'Stage 1 decisions', 'Stage 1 dice', 'Stage 1 results', 'Stage 2 decisions', 'Stage 2 dice', 'Final results'];
  const SHORT = { D1: 'HO-3', D2: 'Jewelry', D3: 'Earthquake', D4: 'Air-con', D5: 'Auto', D6: 'Supp. LTD', D7: 'Health plan', D8: 'Ski lessons' };
  const app = document.getElementById('app');
  const nav = document.getElementById('steps');
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const chf = M.chf;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const OPTIMUM = M.optimum();

  let state = load() || fresh(6);
  let selected = null; // { team, sid } shown in the explanation panel
  let rolling = null;
  const openDetails = new Set(); // keeps <details> open across re-renders

  function fresh(n, names) {
    const teams = [], decisions = {};
    for (let i = 0; i < n; i++) {
      teams.push({ id: teamId(i), name: (names && names[i]) || 'Team ' + teamId(i) });
      decisions[teamId(i)] = {};
    }
    return { v: 1, step: 0, teams, decisions, rolls: {} };
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE));
      if (s && s.v === 1 && Array.isArray(s.teams) && s.decisions && s.rolls) return s;
    } catch (e) { /* storage unavailable: start fresh */ }
    return null;
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  function results() {
    const out = {};
    state.teams.forEach(t => { out[t.id] = M.teamResult(state.decisions[t.id], state.rolls); });
    return out;
  }
  const allComplete = stage => state.teams.every(t => M.complete(state.decisions[t.id], stage));
  const allRolled = stage => M.scenariosOf(stage).every(s => state.rolls[s.id] != null);
  // Long name lists (many teams) are shortened in status messages
  const listNames = names => names.length <= 6 ? names.map(esc).join(', ')
    : `${names.slice(0, 5).map(esc).join(', ')} and ${names.length - 5} more`;
  const teamName = id => (state.teams.find(t => t.id === id) || { name: id }).name;
  const overBudget = (t, stage) => { const b = M.budget(state.decisions[t.id]); return stage === 1 ? b.over1 : b.over2; };

  function stepDone(i) {
    return [false, allComplete(1), allRolled(1), allComplete(1) && allRolled(1),
      allComplete(2), allRolled(2), false][i];
  }

  function go(step) {
    state.step = Math.max(0, Math.min(STEPS.length - 1, step));
    selected = null;
    save();
    render();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function render() {
    nav.innerHTML = STEPS.map((s, i) => `<button class="step${i === state.step ? ' active' : ''}${stepDone(i) ? ' done' : ''}" data-action="go" data-step="${i}"${i === state.step ? ' aria-current="step"' : ''}><span>${String(i + 1).padStart(2, '0')}</span>${s}</button>`).join('');
    const pages = [pageSetup, () => pageDecisions(1), () => pageDice(1), () => pageResults(1), () => pageDecisions(2), () => pageDice(2), pageFinal];
    app.innerHTML = pages[state.step]();
  }

  // ---- 01 Setup -----------------------------------------------------------------------------

  function pageSetup() {
    const n = state.teams.length;
    return `
    <section>
      <p class="eyebrow">Tutorial I · Personal lines risk management</p>
      <h1>Personal Risk Management Game</h1>
      <p class="lead">Each team manages the risks of the Smith family. In every stage the teams choose insurance and loss control within a budget, then one roll of a 20-sided die per scenario decides which losses happen. The team with the highest final net worth wins.</p>
    </section>
    <div class="cols">
      <section class="card">
        <h2>Teams</h2>
        <div class="count-row">
          <label class="field" for="team-count">Number of teams</label>
          <div class="stepper">
            <button class="button" data-action="team-step" data-delta="-1" aria-label="One team fewer"${n <= 1 ? ' disabled' : ''}>−</button>
            <input id="team-count" data-input="team-count" type="number" min="1" max="${MAX_TEAMS}" value="${n}" inputmode="numeric">
            <button class="button" data-action="team-step" data-delta="1" aria-label="One team more"${n >= MAX_TEAMS ? ' disabled' : ''}>+</button>
          </div>
          <span class="muted small">1 to ${MAX_TEAMS} teams; the slides use 6 or 7. Teams can be added or removed at any point.</span>
        </div>
        <div class="team-names">${state.teams.map(t => `<label class="field">Team ${t.id}<input data-input="team-name" data-team="${t.id}" value="${esc(t.name)}" maxlength="24" autocomplete="off"></label>`).join('')}</div>
      </section>
      <section class="card">
        <h2>The game in brief</h2>
        <dl class="facts">
          <div><dt>Starting net worth</dt><dd>${chf(M.START_NET_WORTH)}</dd></div>
          <div><dt>Budget</dt><dd>${chf(M.STAGE_BUDGET)} per stage for premiums and loss control. Unused Stage 1 budget rolls over to Stage 2.</dd></div>
          <div><dt>Stage 1</dt><dd>Homeowners property and auto physical damage: 5 decisions, 5 loss scenarios</dd></div>
          <div><dt>Stage 2</dt><dd>Health and disability: 3 decisions, 3 loss scenarios</dd></div>
          <div><dt>Dice</dt><dd>One d20 roll per scenario for the whole class; each scenario is rolled once</dd></div>
          <div><dt>Net worth</dt><dd>Starting net worth minus premiums, loss-control costs and retained losses</dd></div>
        </dl>
      </section>
    </div>
    <details class="card" data-key="rules"${openDetails.has('rules') ? ' open' : ''}><summary>Calculation rules</summary>
      <ul>
        <li>HO-3: 80% coinsurance on the dwelling (required ${chf(128000)}); CHF 250 deductible per occurrence; Coverage C is 50% of Coverage A; contents are settled at replacement cost.</li>
        <li>Without the scheduled endorsement, theft of jewelry is covered only up to the HO-3 special limit of CHF 1,500.</li>
        <li>Earthquake endorsement: covers the dwelling (up to Coverage A, subject to coinsurance) and loss of use; deductible 10% of the insured dwelling value.</li>
        <li>The hydrant accident is a collision loss.</li>
        <li>Health losses occur in the order listed and share the annual deductibles and limits. PPO: CHF 300 in-network family deductible; out of network CHF 600 deductible, 20% coinsurance and a CHF 3,000 out-of-pocket limit. HMO: in-network only, CHF 25 copayment per office visit.</li>
        <li>Disability: 5 months × CHF 6,000 lost wages. The employer’s short-term disability replaces 100% for the first 90 days; then LTD pays 50% of the CHF 8,333 monthly salary up to CHF 2,000, or 75% up to CHF 6,000 with supplemental LTD.</li>
        <li>Ski lessons: the skiing accident happens only on a roll of 1–2 instead of 1–4.</li>
        <li>Expected values in the final results use the same rules and the stated probabilities.</li>
      </ul>
    </details>
    <div class="actions"><span class="note">The game is saved in this browser, so reloading the page keeps everything.</span>
      <button class="button primary" data-action="go" data-step="1">Start Stage 1 decisions</button></div>`;
  }

  // ---- 02 / 05 Decisions --------------------------------------------------------------------

  function pageDecisions(stage) {
    const decs = M.decisionsOf(stage);
    const legend = decs.map(x => `<article class="opt-card"><h3><span class="tag">${x.id}</span>${esc(x.title)}</h3><ul>${x.options.map(o => `<li><span class="key">(${o.key})</span><span>${esc(o.short)}</span><span class="cost">${o.cost ? chf(o.cost) : '—'}</span><span class="detail">${esc(o.detail)}</span></li>`).join('')}</ul></article>`).join('');
    const rows = state.teams.map(t => {
      const d = state.decisions[t.id], b = M.budget(d);
      const cost = stage === 1 ? b.c1 : b.c2, avail = stage === 1 ? b.avail1 : b.avail2;
      const cells = decs.map(x => `<td><div class="seg${d[x.id] ? '' : ' missing'}" role="group" aria-label="${esc(t.name)}, ${x.id}">${x.options.map(o => `<button data-action="choose" data-team="${t.id}" data-dec="${x.id}" data-opt="${o.key}" aria-pressed="${d[x.id] === o.key}">${o.key}</button>`).join('')}</div></td>`).join('');
      const left = stage === 2 && !M.complete(d, 1) ? '<span class="muted">Stage 1 missing</span>'
        : cost > avail ? `<span class="over">Over by ${chf(cost - avail)}</span>` : chf(avail - cost);
      return `<tr><th scope="row">${esc(t.name)}</th>${cells}<td class="num">${chf(cost)}</td>${stage === 2 ? `<td class="num">${M.complete(d, 1) ? chf(avail) : '—'}</td>` : ''}<td class="num">${left}</td></tr>`;
    }).join('');
    const missing = state.teams.filter(t => !M.complete(state.decisions[t.id], stage)).map(t => t.name);
    const over = state.teams.filter(t => overBudget(t, stage)).map(t => t.name);
    const blocked = missing.length > 0 || over.length > 0;
    const msg = missing.length ? `<span class="warn">Still missing: ${listNames(missing)}</span>`
      : over.length ? `<span class="warn">Over budget: ${listNames(over)}</span>`
      : '<span class="note">All decisions entered.</span>';
    return `
    <div class="page-head"><div><p class="eyebrow">Stage ${stage} · Decisions</p><h2>${stage === 1 ? 'Homeowners property and auto physical damage' : 'Health and disability risks'}</h2></div>
      <p>${stage === 1 ? `Each team has ${chf(M.STAGE_BUDGET)} for premiums; unused budget rolls over to Stage 2.` : `Each team has ${chf(M.STAGE_BUDGET)} plus whatever it did not spend in Stage 1, for premiums and loss control.`}</p></div>
    <div class="legend">${legend}</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Team</th>${decs.map(x => `<th>${x.id} · ${SHORT[x.id]}</th>`).join('')}<th class="num">${stage === 1 ? 'Premiums' : 'Premiums and loss control'}</th>${stage === 2 ? '<th class="num">Budget</th>' : ''}<th class="num">Budget left</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <div class="actions">
      <button class="button" data-action="go" data-step="${stage === 1 ? 0 : 3}">Back</button>
      ${msg}
      <button class="button primary" data-action="go" data-step="${stage === 1 ? 2 : 5}"${blocked ? ' disabled' : ''}>Roll the dice</button>
    </div>`;
  }

  // ---- 03 / 06 Dice -------------------------------------------------------------------------

  const DIE = '<svg viewBox="0 0 96 96" aria-hidden="true"><polygon points="48,4 88,26 88,70 48,92 8,70 8,26" fill="#fff" stroke="#d7dfd8" stroke-width="3" stroke-linejoin="round"/><polygon points="48,22 72,62 24,62" fill="none" stroke="#d7dfd8" stroke-width="1.5"/></svg>';

  function rollOutcome(s, roll) {
    if (roll == null) return null;
    if (s.maxWithControl && roll > s.maxWithControl && roll <= s.max) return 'partial';
    return roll <= s.max ? 'loss' : 'safe';
  }

  function pageDice(stage) {
    const cards = M.scenariosOf(stage).map(s => {
      const roll = state.rolls[s.id], out = rollOutcome(s, roll);
      const range = s.maxWithControl
        ? `Loss on <b>1–${s.max}</b> (${s.max * 5}%), on <b>1–${s.maxWithControl}</b> (${s.maxWithControl * 5}%) with ski lessons`
        : `Loss on <b>1–${s.max}</b> (${s.max * 5}%)`;
      let status = '', cls = '';
      if (out === 'loss') { cls = 'loss'; status = '<span class="chip loss">Loss</span>'; }
      else if (out === 'safe') { cls = 'safe'; status = '<span class="chip safe">No loss</span>'; }
      else if (out === 'partial') {
        const hit = state.teams.filter(t => state.decisions[t.id].D8 !== 'a');
        cls = hit.length ? 'loss' : 'safe';
        status = hit.length
          ? `<span class="chip partial">Loss only without ski lessons</span><div class="who">${hit.length === state.teams.length ? 'All teams' : `${hit.length} of ${state.teams.length} teams:`} ${hit.map(t => esc(t.name)).join(', ')}</div>`
          : '<span class="chip safe">No loss: every team took ski lessons</span>';
      }
      return `<article class="scen ${cls}">
        <div><span class="tag">${s.id}</span></div>
        <h3>${esc(s.title)}</h3>
        <div class="muted">${esc(s.loss)}</div>
        <div class="range">${range}</div>
        <div class="die-wrap"><div class="die">${DIE}<span data-die="${s.id}">${roll == null ? '?' : roll}</span></div>
          <div>${roll == null ? `<button class="button primary" data-action="roll" data-sid="${s.id}">Roll d20</button>` : status}</div></div>
        ${roll == null
          ? `<form class="manual" data-manual="${s.id}"><label for="m-${s.id}">Physical die</label><input id="m-${s.id}" type="number" min="1" max="20" inputmode="numeric" required><button>Set</button></form>`
          : `<div><button class="link" data-action="clear-roll" data-sid="${s.id}">Change this roll</button></div>`}
      </article>`;
    }).join('');
    const ready = allRolled(stage);
    return `
    <div class="page-head"><div><p class="eyebrow">Stage ${stage} · Dice</p><h2>${stage === 1 ? 'Which property losses happen?' : 'Which health and disability losses happen?'}</h2></div>
      <p>One roll per scenario for the whole class. Use the button, or type in the result of a physical die.</p></div>
    <div class="dice-grid">${cards}</div>
    <div class="actions">
      <button class="button" data-action="go" data-step="${stage === 1 ? 1 : 4}">Back to decisions</button>
      <span class="note">${ready ? 'All scenarios rolled.' : `${M.scenariosOf(stage).filter(s => state.rolls[s.id] == null).length} still to roll.`}</span>
      <button class="button primary" data-action="go" data-step="${stage === 1 ? 3 : 6}"${ready ? '' : ' disabled'}>Show results</button>
    </div>`;
  }

  // ---- 04 / 07 Results ----------------------------------------------------------------------

  function amountCell(team, sid, sc) {
    const sel = selected && selected.team === team && selected.sid === sid ? ' sel' : '';
    if (sc.status === 'pending' || sc.status === 'missing') return `<td class="num"><button class="amt zero${sel}" data-action="detail" data-team="${team}" data-sid="${sid}">—</button></td>`;
    const zero = sc.retained === 0 ? ' zero' : '';
    return `<td class="num"><button class="amt${zero}${sel}" data-action="detail" data-team="${team}" data-sid="${sid}">${sc.retained === 0 ? '0' : chf(sc.retained)}</button></td>`;
  }

  function scenarioHead(s) {
    const roll = state.rolls[s.id], out = rollOutcome(s, roll);
    const chip = roll == null ? '<span class="chip partial">not rolled</span>'
      : `<span class="chip ${out === 'safe' ? 'safe' : out === 'partial' ? 'partial' : 'loss'}">rolled ${roll}</span>`;
    return `<th class="num"><div class="colhead"><span>${s.id} · ${esc(s.short)}</span>${chip}</div></th>`;
  }

  function explainPanel(res) {
    const sc = selected && res[selected.team] ? res[selected.team].scen[selected.sid] : null;
    if (!sc) return '<section class="card explain" id="explain"><h3>How was this calculated?</h3><p class="empty">Click any amount in the table to see the calculation step by step.</p></section>';
    return `<section class="card explain" id="explain"><h3>${esc(teamName(selected.team))} · ${esc(M.scenario(selected.sid).title)}</h3><ol>${sc.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></section>`;
  }

  function pageResults(stage) {
    const scen = M.scenariosOf(stage), res = results();
    const rows = state.teams.map(t => {
      const r = res[t.id], st = r.stage[stage];
      const prior = stage === 1 ? M.START_NET_WORTH : r.nw1;
      const ok = st.complete && (stage === 1 || r.stage[1].complete);
      return `<tr><th scope="row">${esc(t.name)}</th>
        <td class="num">${chf(prior)}</td>
        <td class="num">${st.complete ? chf(st.cost) : '—'}</td>
        ${scen.map(s => amountCell(t.id, s.id, r.scen[s.id])).join('')}
        <td class="num">${st.complete ? chf(st.retained) : '—'}</td>
        <td class="num strong">${ok ? chf(stage === 1 ? r.nw1 : r.nw2) : '—'}</td>
        ${stage === 1 ? `<td class="num">${st.complete ? chf(r.budget.avail2) : '—'}</td>` : ''}</tr>`;
    }).join('');
    return `
    <div class="page-head"><div><p class="eyebrow">Stage ${stage} · Results</p><h2>Net worth after Stage ${stage}</h2></div>
      <p>Amounts are the losses each team retains. Click one to see how it was calculated.</p></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Team</th><th class="num">Net worth before</th><th class="num">${stage === 1 ? 'Premiums' : 'Premiums and loss control'}</th>${scen.map(scenarioHead).join('')}<th class="num">Retained losses</th><th class="num">Net worth after</th>${stage === 1 ? '<th class="num">Stage 2 budget</th>' : ''}</tr></thead>
      <tbody>${rows}</tbody></table></div>
    ${explainPanel(res)}
    <div class="actions">
      <button class="button" data-action="go" data-step="${stage === 1 ? 2 : 5}">Back to dice</button>
      ${allRolled(stage) ? '' : '<span class="warn">Some scenarios are not rolled yet.</span>'}
      <button class="button primary" data-action="go" data-step="${stage === 1 ? 4 : 6}">${stage === 1 ? 'Stage 2 decisions' : 'Final results'}</button>
    </div>`;
  }

  function ranks(values) {
    // values: array of numbers or null; higher is better; ties share a rank
    return values.map(v => v == null ? null : 1 + values.filter(w => w != null && w > v + 1e-9).length);
  }

  function pageFinal() {
    const res = results();
    const teams = state.teams.map(t => {
      const r = res[t.id];
      const ok = r.stage[1].complete && r.stage[2].complete;
      return { t, r, ok,
        nw: ok ? r.nw2 : null,
        exp: ok ? r.expectedNw : null,
        cost: r.stage[1].cost + r.stage[2].cost,
        retained: r.stage[1].retained + r.stage[2].retained,
        expRetained: ok ? r.stage[1].expected + r.stage[2].expected : null };
    });
    const rk = ranks(teams.map(x => x.nw)), erk = ranks(teams.map(x => x.exp));
    teams.forEach((x, i) => { x.rank = rk[i]; x.erank = erk[i]; });
    const order = teams.slice().sort((a, b) => (a.rank == null) - (b.rank == null) || a.rank - b.rank);
    const done = allComplete(1) && allComplete(2) && allRolled(1) && allRolled(2);

    const board = order.map(x => `<tr>
      <td>${x.rank == null ? '—' : `<span class="rank${x.rank === 1 ? ' first' : ''}">${x.rank}</span>`}</td>
      <th scope="row">${esc(x.t.name)}</th>
      <td class="num strong">${x.ok ? chf(x.nw) : '—'}</td>
      <td class="num">${chf(x.cost)}</td>
      <td class="num">${x.ok ? chf(x.retained) : '—'}</td>
      <td class="num">${x.ok ? chf(x.exp) : '—'}</td>
      <td class="num">${x.erank == null ? '—' : x.erank}</td>
      <td class="num ${x.ok ? (x.nw - x.exp >= 0 ? 'pos' : 'neg') : ''}">${x.ok ? (x.nw - x.exp >= 0 ? '+' : '') + chf(x.nw - x.exp) : '—'}</td></tr>`).join('');

    const scale = Math.max(1, ...teams.filter(x => x.ok).map(x => Math.max(x.cost + x.retained, x.cost + x.expRetained)));
    const bars = order.filter(x => x.ok).map(x => {
      const p = 100 * x.cost / scale, r = 100 * x.retained / scale, e = 100 * (x.cost + x.expRetained) / scale;
      return `<div class="bar-row"><span>${esc(x.t.name)}</span>
        <div class="bar" role="img" aria-label="${esc(x.t.name)}: premiums ${chf(x.cost)}, retained losses ${chf(x.retained)}, expected cost ${chf(x.cost + x.expRetained)}"><span class="p" style="width:${p}%"></span><span class="r" style="width:${r}%"></span><span class="e" style="left:calc(${e}% - 1px)"></span></div>
        <span class="num">${chf(x.cost + x.retained)}</span></div>`;
    }).join('');

    const pkg = M.DECISIONS.map(x => { const o = x.options.find(o => o.key === OPTIMUM.d[x.id]); return `<li><b>${x.id}</b> (${o.key}) ${esc(SHORT[x.id])}: ${esc(o.short)}</li>`; }).join('');
    const cmp = M.optionComparison(OPTIMUM.d).map(x => {
      const feasible = x.options.filter(o => !o.overBudget);
      const best = feasible.reduce((m, o) => (!m || o.expected < m.expected ? o : m), null);
      const cells = x.options.map(o => `<td class="${best && best.key === o.key ? 'best' : ''}">(${o.key}) ${esc(o.short)}: ${chf(o.expected)}${o.overBudget ? ' <span class="over">over budget</span>' : ''}</td>`);
      while (cells.length < 3) cells.push('<td></td>');
      return `<tr><th scope="row">${x.id} · ${esc(SHORT[x.id])}</th>${cells.join('')}</tr>`;
    }).join('');

    const allScen = M.SCENARIOS;
    const breakdown = state.teams.map(t => `<tr><th scope="row">${esc(t.name)}</th>${allScen.map(s => amountCell(t.id, s.id, res[t.id].scen[s.id])).join('')}</tr>`).join('');

    return `
    <div class="page-head"><div><p class="eyebrow">Final results</p><h2>Who protected the Smiths’ net worth best?</h2></div>
      <p>Expected net worth shows how each package would do on average with the stated probabilities. The gap to the actual result is luck.</p></div>
    ${done ? '' : '<p class="warn" style="color:var(--error);font-weight:600">Some decisions or rolls are still missing, so these results are provisional.</p>'}
    <div class="table-wrap"><table>
      <thead><tr><th>Rank</th><th>Team</th><th class="num">Final net worth</th><th class="num">Premiums and loss control</th><th class="num">Retained losses</th><th class="num">Expected net worth</th><th class="num">Rank by expected value</th><th class="num">Luck</th></tr></thead>
      <tbody>${board}</tbody></table></div>
    <div class="cols">
      <section class="card">
        <h2>Cost of risk</h2>
        <p class="muted">Premiums and loss control plus retained losses. The black mark is the expected cost of the team’s package.</p>
        <div class="board">${bars || '<p class="muted">No complete teams yet.</p>'}</div>
        <div class="key-row"><span><i style="background:var(--green)"></i>Premiums and loss control</span><span><i style="background:var(--amber)"></i>Retained losses</span><span><i style="background:var(--ink);width:3px"></i>Expected cost</span></div>
      </section>
      <section class="card">
        <h2>Expected-value benchmark</h2>
        <p class="muted">The package with the lowest expected cost of risk (premiums plus probability-weighted retained losses) that stays within budget: ${chf(OPTIMUM.total)}, i.e. an expected final net worth of ${chf(M.START_NET_WORTH - OPTIMUM.total)}.</p>
        <ul class="pkg">${pkg}</ul>
        <p class="muted" style="margin-top:12px;font-size:15px">It ignores risk aversion: a family that cannot absorb a large loss may sensibly pay more than this to cap the worst outcome.</p>
      </section>
    </div>
    <details class="card" data-key="debrief"${openDetails.has('debrief') ? ' open' : ''}><summary>Debrief: expected cost of each option</summary>
      <p class="muted" style="margin-top:12px">Expected cost of the stage (premiums plus probability-weighted retained losses) when the other decisions stay at the benchmark package. Shaded: the cheapest option within budget.</p>
      <div class="table-wrap" style="box-shadow:none"><table><tbody>${cmp}</tbody></table></div>
    </details>
    <details class="card" style="margin-top:18px" data-key="breakdown"${openDetails.has('breakdown') ? ' open' : ''}><summary>All retained losses by scenario</summary>
      <div class="table-wrap" style="box-shadow:none;margin-top:12px"><table>
        <thead><tr><th>Team</th>${allScen.map(scenarioHead).join('')}</tr></thead>
        <tbody>${breakdown}</tbody></table></div>
      ${explainPanel(res)}
    </details>
    <div class="actions">
      <button class="button" data-action="go" data-step="5">Back to Stage 2 dice</button>
      <button class="button" data-action="csv">Download results (CSV)</button>
    </div>`;
  }

  // ---- actions ------------------------------------------------------------------------------

  function d20() {
    const buf = new Uint32Array(1), limit = Math.floor(0x100000000 / 20) * 20;
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return (x % 20) + 1;
  }

  function roll(sid) {
    if (rolling || state.rolls[sid] != null) return;
    const final = d20();
    const finish = () => { state.rolls[sid] = final; rolling = null; save(); render(); };
    if (reduceMotion) { finish(); return; }
    rolling = sid;
    const face = app.querySelector(`[data-die="${sid}"]`);
    const btn = app.querySelector(`[data-action="roll"][data-sid="${sid}"]`);
    if (btn) btn.disabled = true;
    let ticks = 0;
    const timer = setInterval(() => {
      if (face) face.textContent = 1 + Math.floor(Math.random() * 20);
      if (++ticks >= 14) { clearInterval(timer); finish(); }
    }, 60);
  }

  function setTeamCount(n) {
    const cur = state.teams.length;
    if (n < cur) {
      const removed = state.teams.slice(n);
      const used = removed.some(t => Object.keys(state.decisions[t.id] || {}).length > 0);
      if (used && !confirm(`Remove ${removed.map(t => t.name).join(', ')} and their decisions?`)) { render(); return; }
      removed.forEach(t => { delete state.decisions[t.id]; });
      state.teams = state.teams.slice(0, n);
    } else {
      for (let i = cur; i < n; i++) {
        state.teams.push({ id: teamId(i), name: 'Team ' + teamId(i) });
        state.decisions[teamId(i)] = {};
      }
    }
    save();
    render();
  }

  function downloadCsv() {
    const res = results();
    const head = ['Team', ...M.DECISIONS.map(x => x.id), ...M.SCENARIOS.map(s => s.id + ' roll'), ...M.SCENARIOS.map(s => s.id + ' retained'),
      'Stage 1 premiums', 'Stage 1 retained', 'Net worth after Stage 1', 'Stage 2 premiums and loss control', 'Stage 2 retained', 'Final net worth', 'Expected final net worth'];
    const rows = state.teams.map(t => {
      const d = state.decisions[t.id], r = res[t.id];
      return [t.name, ...M.DECISIONS.map(x => d[x.id] || ''), ...M.SCENARIOS.map(s => state.rolls[s.id] == null ? '' : state.rolls[s.id]),
        ...M.SCENARIOS.map(s => r.scen[s.id].retained), r.stage[1].cost, r.stage[1].retained, r.nw1,
        r.stage[2].cost, r.stage[2].retained, r.nw2, r.expectedNw == null ? '' : Math.round(r.expectedNw)];
    });
    const csv = [head, ...rows].map(row => row.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'risk-game-results.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    const a = b.dataset.action;
    if (a === 'go') go(+b.dataset.step);
    else if (a === 'choose') {
      state.decisions[b.dataset.team][b.dataset.dec] = b.dataset.opt;
      save();
      render();
      const again = app.querySelector(`[data-action="choose"][data-team="${b.dataset.team}"][data-dec="${b.dataset.dec}"][data-opt="${b.dataset.opt}"]`);
      if (again) again.focus({ preventScroll: true });
    } else if (a === 'roll') roll(b.dataset.sid);
    else if (a === 'clear-roll') {
      if (confirm(`Clear the roll for “${M.scenario(b.dataset.sid).title}”?`)) { delete state.rolls[b.dataset.sid]; save(); render(); }
    } else if (a === 'detail') {
      selected = { team: b.dataset.team, sid: b.dataset.sid };
      render();
      const p = document.getElementById('explain');
      if (p) p.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    } else if (a === 'team-step') setTeamCount(Math.max(1, Math.min(MAX_TEAMS, state.teams.length + +b.dataset.delta)));
    else if (a === 'csv') downloadCsv();
  });

  document.addEventListener('toggle', e => {
    const k = e.target.dataset && e.target.dataset.key;
    if (k) { if (e.target.open) openDetails.add(k); else openDetails.delete(k); }
  }, true);

  app.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.input === 'team-name') {
      const t = state.teams.find(x => x.id === el.dataset.team);
      if (t) { t.name = el.value.trim() || 'Team ' + t.id; save(); }
    }
  });
  app.addEventListener('change', e => {
    if (e.target.dataset.input === 'team-count') {
      const n = parseInt(e.target.value, 10);
      setTeamCount(Number.isFinite(n) ? Math.max(1, Math.min(MAX_TEAMS, n)) : state.teams.length);
    }
  });
  app.addEventListener('submit', e => {
    const f = e.target.closest('[data-manual]');
    if (!f) return;
    e.preventDefault();
    const v = parseInt(f.querySelector('input').value, 10);
    if (v >= 1 && v <= 20) { state.rolls[f.dataset.manual] = v; save(); render(); }
  });
  document.querySelector('[data-home]').addEventListener('click', e => { e.preventDefault(); go(0); });
  document.getElementById('new-game').addEventListener('click', () => {
    if (!confirm('Start a new game? All decisions and dice rolls are cleared; team names are kept.')) return;
    state = fresh(state.teams.length, state.teams.map(t => t.name));
    go(0);
  });

  render();
})();
