# IM26 Risk Management Game

A classroom version of the Personal Lines Risk Management and Insurance Simulation Game for Tutorial I of Insurance Management.

Teams (1 to 40, added or removed at any point) act as risk managers for the Smith family over two stages: homeowners property and auto physical damage, then health and disability. The instructor enters each team's decisions, rolls one d20 per loss scenario for the whole class (or types in a physical die), and the site settles every loss and updates each team's net worth. Each retained amount can be opened to show the calculation step by step. The final page ranks teams by actual and expected net worth, separates luck from decision quality, and shows the lowest-expected-cost package within budget.

The game is adapted from Kerr and Avila (2013), *Personal lines risk management and insurance simulation game*, Risk Management and Insurance Review 16(1), 123–146. Amounts are in CHF as in the IM26 tutorial slides. Settlement rules that the slides leave open (jewelry theft limit, coinsurance on the dwelling, short-term disability for the first 90 days, the order of health claims) follow the paper and are listed under Calculation rules on the setup page.

All calculations take place in the browser. The game state is kept in the browser's local storage until a new game is started; results can be downloaded as CSV. Nothing is sent to a server.

`index.html` holds the page and styles, `app.js` the interface and `model.js` the decisions, scenarios and loss settlement. `node tests/model.test.js` checks the settlement rules.
