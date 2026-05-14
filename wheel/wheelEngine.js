const { WHEEL } = require('./config');
const {
  getAccount, getPositions, getOrders, getQuote,
  getOptionsChain, getOptionQuote, placeOptionsOrder, isMarketOpen
} = require('./alpaca');
const fs   = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'wheel_log.json');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(__dirname, 'wheel.log'), line + '\n');
}

function loadLog() {
  if (!fs.existsSync(LOG_FILE)) return { phase: 'PUT', cycles: [], openOrder: null };
  return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
}

function saveLog(data) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
}

// Add days to today, return YYYY-MM-DD
function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function daysUntil(dateStr) {
  return Math.round((new Date(dateStr) - new Date()) / 86400000);
}

// Select best contract from chain targeting delta range
// Since Alpaca paper doesn't always return greeks, we approximate delta from moneyness
function selectStrike(contracts, spotPrice, type) {
  // For puts: target strikes at 80-92% of spot (roughly 0.20-0.28 delta proxy)
  // For calls: target strikes at 108-120% of spot
  const [lo, hi] = type === 'put'
    ? [spotPrice * 0.80, spotPrice * 0.92]
    : [spotPrice * 1.08, spotPrice * 1.20];

  const candidates = contracts.filter(c => {
    const s = parseFloat(c.strike_price);
    return s >= lo && s <= hi;
  });

  if (candidates.length === 0) return null;

  // Pick the one closest to the middle of the range
  const mid = (lo + hi) / 2;
  return candidates.sort((a, b) =>
    Math.abs(parseFloat(a.strike_price) - mid) - Math.abs(parseFloat(b.strike_price) - mid)
  )[0];
}

async function runWheel() {
  log('========== WHEEL STRATEGY RUN ==========');

  const open = await isMarketOpen().catch(() => false);
  if (!open) {
    log('Market closed — skipping execution (options orders require open market)');
    return;
  }

  const account   = await getAccount();
  const positions = await getPositions();
  const orders    = await getOrders('open');
  const state     = loadLog();

  const cash = parseFloat(account.cash);
  log(`Account cash: $${cash.toFixed(2)} | Phase: ${state.phase}`);

  // Check if we already have an open options order pending
  const pendingOptionsOrder = orders.find(o =>
    o.symbol?.startsWith(WHEEL.symbol) && o.asset_class === 'us_option'
  );
  if (pendingOptionsOrder) {
    log(`Open options order already exists: ${pendingOptionsOrder.symbol} ${pendingOptionsOrder.side} — skipping`);
    return;
  }

  // Get TSLA stock position (100 shares = assigned from put)
  const stockPos = positions.find(p => p.symbol === WHEEL.symbol && p.asset_class === 'us_equity');
  const optionPos = positions.find(p => p.symbol?.startsWith(WHEEL.symbol) && p.asset_class === 'us_option');

  // Get current TSLA price
  const quote    = await getQuote(WHEEL.symbol);
  const spotPrice = parseFloat(quote.ap || quote.bp || 0);
  log(`TSLA spot price: $${spotPrice.toFixed(2)}`);

  // ── MANAGE EXISTING OPTIONS POSITION ─────────────────────────────────────
  if (optionPos) {
    const dte        = daysUntil(state.openOrder?.expDate || '2099-01-01');
    const currentVal = parseFloat(optionPos.market_value);
    const openCredit = state.openOrder?.credit || 0;
    const profitPct  = openCredit > 0 ? (openCredit - Math.abs(currentVal)) / openCredit : 0;

    log(`Existing option: ${optionPos.symbol} | P&L: ${(profitPct * 100).toFixed(0)}% | DTE: ${dte}`);

    const shouldClose = profitPct >= WHEEL.takeProfitPct || dte <= WHEEL.rollDte;
    if (shouldClose) {
      const reason = profitPct >= WHEEL.takeProfitPct ? '50% profit target hit' : `${dte} DTE — rolling early`;
      log(`Closing position: ${reason}`);

      // Buy to close at mid price
      const snap    = await getOptionQuote(optionPos.symbol);
      const bid     = snap?.latestQuote?.bp || 0;
      const ask     = snap?.latestQuote?.ap || 0;
      const midPrice = ((bid + ask) / 2).toFixed(2);

      const result = await placeOptionsOrder({
        symbol:     optionPos.symbol,
        qty:        WHEEL.contracts,
        side:       'buy',
        limitPrice: midPrice,
      });

      if (result.success) {
        log(`Buy-to-close order placed: ${result.order.id}`);
        state.phase = stockPos ? 'CALL' : 'PUT';
        saveLog(state);
      } else {
        log(`Buy-to-close FAILED: ${result.error}`);
      }
      return;
    }

    log('Position healthy — no action needed');
    return;
  }

  // ── PHASE 1: SELL CASH-SECURED PUT ───────────────────────────────────────
  if (!stockPos || parseInt(stockPos.qty) < 100) {
    log('PHASE 1 — Selling cash-secured put on TSLA');

    const requiredCash = spotPrice * 100 * 0.85; // need ~85% of spot to secure
    if (cash < requiredCash) {
      log(`Insufficient cash ($${cash.toFixed(0)}) to secure put. Need ~$${requiredCash.toFixed(0)}`);
      return;
    }

    const expAfter  = addDays(WHEEL.dteMin);
    const expBefore = addDays(WHEEL.dteMax);

    log(`Looking for put: ${expAfter} to ${expBefore}, strike ~$${(spotPrice * 0.86).toFixed(0)}-$${(spotPrice * 0.92).toFixed(0)}`);

    const contracts = await getOptionsChain({
      symbol:    WHEEL.symbol,
      type:      'put',
      expAfter,
      expBefore,
      strikeGte: (spotPrice * 0.75).toFixed(0),
      strikeLte: (spotPrice * 0.95).toFixed(0),
    });

    log(`Found ${contracts.length} put contracts in range`);
    if (contracts.length === 0) { log('No contracts found — try again next run'); return; }

    const contract = selectStrike(contracts, spotPrice, 'put');
    if (!contract) { log('No suitable strike found'); return; }

    log(`Selected: ${contract.symbol} | Strike: $${contract.strike_price} | Exp: ${contract.expiration_date}`);

    // Get live quote for the contract
    const snap  = await getOptionQuote(contract.symbol);
    const bid   = snap?.latestQuote?.bp || parseFloat(contract.close_price || 1);
    const ask   = snap?.latestQuote?.ap || bid * 1.1;
    const mid   = ((bid + ask) / 2).toFixed(2);
    const credit = parseFloat(mid) * 100;

    log(`Premium — Bid: $${bid} | Ask: $${ask} | Mid: $${mid} | Total credit: $${credit.toFixed(0)}`);

    const result = await placeOptionsOrder({
      symbol:     contract.symbol,
      qty:        WHEEL.contracts,
      side:       'sell',
      limitPrice: mid,
    });

    if (result.success) {
      log(`SELL PUT ORDER PLACED: ${result.order.id} | ${contract.symbol} @ $${mid}`);
      state.phase = 'PUT_OPEN';
      state.openOrder = {
        id:      result.order.id,
        symbol:  contract.symbol,
        type:    'put',
        strike:  contract.strike_price,
        expDate: contract.expiration_date,
        credit,
        placedAt: new Date().toISOString(),
      };
      state.cycles = state.cycles || [];
      saveLog(state);
    } else {
      log(`SELL PUT FAILED: ${result.error}`);
    }
    return;
  }

  // ── PHASE 2: SELL COVERED CALL ────────────────────────────────────────────
  if (stockPos && parseInt(stockPos.qty) >= 100) {
    log(`PHASE 2 — Selling covered call | Holding ${stockPos.qty} shares @ avg $${parseFloat(stockPos.avg_entry_price).toFixed(2)}`);

    const expAfter  = addDays(WHEEL.dteMin);
    const expBefore = addDays(WHEEL.dteMax);
    const avgCost   = parseFloat(stockPos.avg_entry_price);
    // Call strike must be at or above cost basis to avoid a loss if called away
    const strikeFloor = Math.max(avgCost, spotPrice * 1.05);

    log(`Looking for call: ${expAfter} to ${expBefore}, strike ~$${strikeFloor.toFixed(0)}-$${(spotPrice * 1.20).toFixed(0)}`);

    const contracts = await getOptionsChain({
      symbol:    WHEEL.symbol,
      type:      'call',
      expAfter,
      expBefore,
      strikeGte: strikeFloor.toFixed(0),
      strikeLte: (spotPrice * 1.25).toFixed(0),
    });

    log(`Found ${contracts.length} call contracts in range`);
    if (contracts.length === 0) { log('No contracts found — try again next run'); return; }

    const contract = selectStrike(contracts, spotPrice, 'call');
    if (!contract) { log('No suitable strike found'); return; }

    log(`Selected: ${contract.symbol} | Strike: $${contract.strike_price} | Exp: ${contract.expiration_date}`);

    const snap  = await getOptionQuote(contract.symbol);
    const bid   = snap?.latestQuote?.bp || parseFloat(contract.close_price || 1);
    const ask   = snap?.latestQuote?.ap || bid * 1.1;
    const mid   = ((bid + ask) / 2).toFixed(2);
    const credit = parseFloat(mid) * 100;

    log(`Premium — Bid: $${bid} | Ask: $${ask} | Mid: $${mid} | Total credit: $${credit.toFixed(0)}`);

    const result = await placeOptionsOrder({
      symbol:     contract.symbol,
      qty:        WHEEL.contracts,
      side:       'sell',
      limitPrice: mid,
    });

    if (result.success) {
      log(`SELL CALL ORDER PLACED: ${result.order.id} | ${contract.symbol} @ $${mid}`);
      state.phase = 'CALL_OPEN';
      state.openOrder = {
        id:      result.order.id,
        symbol:  contract.symbol,
        type:    'call',
        strike:  contract.strike_price,
        expDate: contract.expiration_date,
        credit,
        placedAt: new Date().toISOString(),
      };
      saveLog(state);
    } else {
      log(`SELL CALL FAILED: ${result.error}`);
    }
  }
}

module.exports = { runWheel };
