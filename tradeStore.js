const fs   = require('fs');
const path = require('path');

const STORE_FILE = path.join(__dirname, 'executed_trades.json');

function load() {
  if (!fs.existsSync(STORE_FILE)) return { executedIds: [], log: [] };
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {
    return { executedIds: [], log: [] };
  }
}

function save(store) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function hasExecuted(tradeId) {
  return load().executedIds.includes(tradeId);
}

function markExecuted(trade, alpacaOrder) {
  const store = load();
  store.executedIds.push(trade.id);
  store.log.push({
    tradeId:    trade.id,
    ticker:     trade.ticker,
    side:       trade.side,
    qty:        trade.qty,
    date:       trade.date,
    source:     trade.source,
    executedAt: new Date().toISOString(),
    alpacaId:   alpacaOrder?.id || null,
    status:     alpacaOrder?.status || 'unknown',
  });
  save(store);
}

function getLog() {
  return load().log;
}

module.exports = { hasExecuted, markExecuted, getLog };
