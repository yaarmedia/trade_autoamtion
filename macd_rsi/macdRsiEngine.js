const { STRATEGY } = require('./config');
const {
  isMarketOpen, getAccount, getPositions, getOrders,
  getBars, placeOrder, closePosition,
} = require('./alpaca');
const fs   = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'macd_rsi.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Indicators ──────────────────────────────────────────────────────────────

function ema(values, period) {
  const k = 2 / (period + 1);
  const result = [];
  let prev = null;
  for (const v of values) {
    if (prev === null) {
      // seed with SMA of first `period` values
      if (result.length < period - 1) { result.push(null); continue; }
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      result.push(seed);
    } else {
      prev = v * k + prev * (1 - k);
      result.push(prev);
    }
  }
  return result;
}

function calcMACD(closes) {
  const fast   = ema(closes, STRATEGY.macdFast);
  const slow   = ema(closes, STRATEGY.macdSlow);
  const macdLine = fast.map((f, i) => (f !== null && slow[i] !== null) ? f - slow[i] : null);

  // Signal line = EMA(macdLine, 9) — only over valid values
  const validMacd = macdLine.filter(v => v !== null);
  const signalRaw = ema(validMacd, STRATEGY.macdSignal);

  // Re-align signal to full length array
  const offset = macdLine.findIndex(v => v !== null);
  const signal = macdLine.map((v, i) => {
    if (v === null) return null;
    const idx = i - offset - (validMacd.length - signalRaw.length);
    return signalRaw[idx] ?? null;
  });

  const histogram = macdLine.map((m, i) =>
    m !== null && signal[i] !== null ? m - signal[i] : null
  );

  return { macdLine, signal, histogram };
}

function calcRSI(closes, period) {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);

  let gains = 0, losses = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) gains += changes[i];
    else losses += Math.abs(changes[i]);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + Math.max(0, changes[i])) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -changes[i])) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// ── Signal detection ─────────────────────────────────────────────────────────

// Returns 'buy', 'sell', or null
function getSignal(bars) {
  if (bars.length < STRATEGY.macdSlow + STRATEGY.macdSignal + 5) return null;

  const closes = bars.map(b => parseFloat(b.c));
  const rsi    = calcRSI(closes, STRATEGY.rsiPeriod);
  const { macdLine, signal } = calcMACD(closes);

  const lastIdx   = macdLine.length - 1;
  const prevIdx   = lastIdx - 1;
  const macdNow   = macdLine[lastIdx];
  const macdPrev  = macdLine[prevIdx];
  const sigNow    = signal[lastIdx];
  const sigPrev   = signal[prevIdx];

  if ([rsi, macdNow, macdPrev, sigNow, sigPrev].some(v => v === null)) return null;

  const crossedUp   = macdPrev < sigPrev && macdNow > sigNow;
  const crossedDown = macdPrev > sigPrev && macdNow < sigNow;

  log(`  RSI: ${rsi.toFixed(1)} | MACD: ${macdNow.toFixed(3)} | Signal: ${sigNow.toFixed(3)} | crossUp=${crossedUp} crossDown=${crossedDown}`);

  if (crossedUp && rsi >= STRATEGY.buyRsiMin && rsi <= STRATEGY.buyRsiMax) return 'buy';
  if (crossedDown && rsi >= STRATEGY.sellRsiMin) return 'sell';
  return null;
}

// ── Main engine ──────────────────────────────────────────────────────────────

async function runMacdRsi() {
  log('========== MACD/RSI RUN ==========');

  const open = await isMarketOpen().catch(() => false);
  if (!open) {
    log('Market is closed — skipping.');
    return;
  }
  log('Market is open — proceeding');

  const account   = await getAccount();
  const positions = await getPositions();
  const orders    = await getOrders('open');

  const equity = parseFloat(account.equity);
  const cash   = parseFloat(account.cash);
  log(`Equity: $${equity.toFixed(2)} | Cash: $${cash.toFixed(2)}`);

  for (const symbol of STRATEGY.symbols) {
    log(`--- ${symbol} ---`);

    // Skip if there's an open pending order
    const pendingOrder = orders.find(o => o.symbol === symbol);
    if (pendingOrder) {
      log(`  Open order already pending — skipping`);
      continue;
    }

    const bars = await getBars(symbol, 60).catch(() => []);
    if (bars.length < 40) {
      log(`  Not enough bar data (${bars.length}) — skipping`);
      continue;
    }

    const signal  = getSignal(bars);
    const pos     = positions.find(p => p.symbol === symbol);
    const holding = pos ? parseInt(pos.qty) : 0;
    const lastPrice = parseFloat(bars[bars.length - 1].c);

    // ── SELL / EXIT ────────────────────────────────────────────────────────
    if (holding > 0) {
      const avgCost  = parseFloat(pos.avg_entry_price);
      const pnlPct   = (lastPrice - avgCost) / avgCost;

      const stopHit  = pnlPct <= -STRATEGY.stopLossPct;
      const sellSig  = signal === 'sell';

      if (stopHit || sellSig) {
        const reason = stopHit ? `stop loss (${(pnlPct * 100).toFixed(1)}%)` : 'MACD/RSI sell signal';
        log(`  SELL ${holding} shares — ${reason}`);
        const result = await closePosition(symbol);
        if (result.success) log(`  Sell order placed: ${result.order.id}`);
        else log(`  Sell FAILED: ${result.error}`);
      } else {
        log(`  Holding ${holding} shares @ avg $${avgCost.toFixed(2)} | P&L: ${(pnlPct * 100).toFixed(1)}% | no exit signal`);
      }
      continue;
    }

    // ── BUY / ENTRY ────────────────────────────────────────────────────────
    if (signal === 'buy') {
      const allotment = equity * STRATEGY.positionPct;
      if (cash < allotment * 0.95) {
        log(`  Buy signal but insufficient cash ($${cash.toFixed(0)} < $${allotment.toFixed(0)})`);
        continue;
      }
      const qty = Math.floor(allotment / lastPrice);
      if (qty < 1) { log(`  Qty < 1 — skipping`); continue; }

      log(`  BUY ${qty} shares @ ~$${lastPrice.toFixed(2)} (allotment $${allotment.toFixed(0)})`);
      const result = await placeOrder({ symbol, qty, side: 'buy' });
      if (result.success) log(`  Buy order placed: ${result.order.id}`);
      else log(`  Buy FAILED: ${result.error}`);
    } else {
      log(`  No signal (${signal ?? 'neutral'}) — no position — watching`);
    }
  }

  log('========== DONE ==========');
}

module.exports = { runMacdRsi };
