const cron       = require('node-cron');
const { POLITICIANS, CHECK_INTERVAL } = require('./config');
const { fetchPoliticianTrades }       = require('./scraper');
const { placeOrder, getAsset, isMarketOpen, getAccount, getPositions } = require('./alpaca');
const { hasExecuted, markExecuted, getLog } = require('./tradeStore');

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

async function processTrade(trade, politicianName, account, positions) {
  if (hasExecuted(trade.id)) {
    log(`  SKIP (already executed): ${trade.ticker} ${trade.side}`);
    return;
  }

  // Validate the asset is tradeable on Alpaca
  const asset = await getAsset(trade.ticker);
  if (!asset || !asset.tradable) {
    log(`  SKIP (not tradable on Alpaca): ${trade.ticker}`);
    return;
  }
  if (asset.status !== 'active') {
    log(`  SKIP (asset not active): ${trade.ticker}`);
    return;
  }

  const buyingPower = parseFloat(account.buying_power || 0);
  const cash        = parseFloat(account.cash || 0);

  // For SELL — only sell if we actually hold the stock (no naked shorting)
  if (trade.side === 'sell') {
    const pos = positions.find(p => p.symbol === trade.ticker);
    if (!pos) {
      log(`  SKIP sell ${trade.ticker} — not in portfolio`);
      return;
    }
    const available = parseInt(pos.qty_available || pos.qty || 0);
    if (available < 1) {
      log(`  SKIP sell ${trade.ticker} — no shares available to sell`);
      return;
    }
    // Sell only what we have, up to the desired qty
    trade.qty = Math.min(trade.qty, available);
  }

  // For BUY — check we have enough buying power
  if (trade.side === 'buy') {
    if (cash < 0 || buyingPower < 500) {
      log(`  SKIP buy ${trade.ticker} — insufficient buying power ($${buyingPower.toFixed(0)})`);
      return;
    }
  }

  log(`  MIRROR ${politicianName}: ${trade.side.toUpperCase()} ${trade.qty}x ${trade.ticker} | value: $${(trade.value || 0).toLocaleString()}`);

  const result = await placeOrder({
    symbol: trade.ticker,
    qty:    trade.qty,
    side:   trade.side,
    type:   'market',
    time_in_force: 'day',
  });

  if (result.success) {
    log(`  ORDER PLACED: ${result.order.id} | status: ${result.order.status}`);
    markExecuted(trade, result.order);
  } else {
    log(`  ORDER FAILED: ${result.error}`);
  }
}

async function runCheck() {
  log('=== Starting congressional trade check ===');

  const open = await isMarketOpen().catch(() => false);
  if (!open) {
    log('Market is closed — skipping. Will try again next run.');
    return;
  }
  log('Market is open — proceeding');

  const account = await getAccount().catch(() => null);
  if (!account) { log('ERROR: Could not fetch account'); return; }

  const cash         = parseFloat(account.cash || 0);
  const buyingPower  = parseFloat(account.buying_power || 0);
  const portfolioVal = parseFloat(account.portfolio_value || 0);
  log(`Account: $${cash.toFixed(2)} cash | $${buyingPower.toFixed(2)} buying power | $${portfolioVal.toFixed(2)} portfolio`);

  if (cash < 0) {
    log('WARNING: Cash is negative. Reset your paper account at https://app.alpaca.markets/paper-account — click "Reset" under Paper Trading.');
  }

  const positions = await getPositions().catch(() => []);
  log(`Positions: ${positions.length} holdings`);

  for (const pol of POLITICIANS) {
    log(`Checking trades for ${pol.name} (${pol.party})...`);
    const trades = await fetchPoliticianTrades(pol.id);

    if (trades.length === 0) {
      log(`  No trades found for ${pol.name}`);
      continue;
    }

    log(`  Found ${trades.length} trade(s) — checking for new ones...`);
    for (const trade of trades) {
      await processTrade(trade, pol.name, account, positions);
    }
  }

  log('=== Check complete ===\n');
}

async function showStatus() {
  const log2 = getLog();
  console.log('\n=== EXECUTED TRADES LOG ===');
  if (log2.length === 0) {
    console.log('No trades executed yet.');
    return;
  }
  for (const t of log2.slice(-20)) {
    console.log(`${t.executedAt.slice(0, 10)} | ${t.side.toUpperCase().padEnd(4)} | ${t.ticker.padEnd(6)} x${t.qty} | source: ${t.source} | alpaca: ${t.alpacaId || 'N/A'}`);
  }
  console.log('===========================\n');
}

async function main() {
  const arg = process.argv[2];

  if (arg === '--status') {
    await showStatus();
    return;
  }

  if (arg === '--once') {
    await runCheck();
    return;
  }

  // Default: run immediately then on schedule
  log(`Starting Capitol Trades monitor | schedule: "${CHECK_INTERVAL}"`);
  log(`Watching: ${POLITICIANS.map(p => p.name).join(', ')}`);
  await runCheck();

  cron.schedule(CHECK_INTERVAL, () => {
    runCheck().catch(err => log(`ERROR: ${err.message}`));
  });

  log(`Monitor running. Next check on schedule: ${CHECK_INTERVAL}`);
  log('Press Ctrl+C to stop.\n');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
