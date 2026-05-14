const axios = require('axios');
const { ALPACA } = require('./config');

const headers = {
  'APCA-API-KEY-ID':     ALPACA.key,
  'APCA-API-SECRET-KEY': ALPACA.secret,
  'Content-Type':        'application/json',
};

async function getAccount() {
  const r = await axios.get(`${ALPACA.endpoint}/account`, { headers });
  return r.data;
}

async function getPositions() {
  const r = await axios.get(`${ALPACA.endpoint}/positions`, { headers });
  return r.data;
}

async function getOrders(status = 'open') {
  const r = await axios.get(`${ALPACA.endpoint}/orders`, { headers, params: { status, limit: 50 } });
  return r.data;
}

// Get latest stock quote
async function getQuote(symbol) {
  const r = await axios.get(`https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`, { headers });
  return r.data.quote;
}

// Get options chain filtered by type, expiration range, and strike range
async function getOptionsChain({ symbol, type, expAfter, expBefore, strikeGte, strikeLte }) {
  const params = {
    underlying_symbols: symbol,
    type,
    expiration_date_gte: expAfter,
    expiration_date_lte: expBefore,
    limit: 200,
  };
  if (strikeGte) params.strike_price_gte = strikeGte;
  if (strikeLte) params.strike_price_lte = strikeLte;

  const r = await axios.get(`${ALPACA.endpoint}/options/contracts`, { headers, params });
  return r.data.option_contracts || [];
}

// Get live greeks/quote for a specific options contract
async function getOptionQuote(symbol) {
  try {
    const r = await axios.get(`https://data.alpaca.markets/v1beta1/options/snapshots/${symbol}`, { headers });
    return r.data.snapshots?.[symbol] || null;
  } catch {
    return null;
  }
}

async function placeOptionsOrder({ symbol, qty, side, limitPrice }) {
  const body = {
    symbol,
    qty:         String(qty),
    side,
    type:        'limit',
    limit_price: String(limitPrice),
    time_in_force: 'day',
  };
  try {
    const r = await axios.post(`${ALPACA.endpoint}/orders`, body, { headers });
    return { success: true, order: r.data };
  } catch (err) {
    return { success: false, error: err.response?.data?.message || err.message };
  }
}

async function closePosition(symbol) {
  try {
    const r = await axios.delete(`${ALPACA.endpoint}/positions/${symbol}`, { headers });
    return { success: true, order: r.data };
  } catch (err) {
    return { success: false, error: err.response?.data?.message || err.message };
  }
}

async function isMarketOpen() {
  const r = await axios.get(`${ALPACA.endpoint}/clock`, { headers });
  return r.data.is_open;
}

module.exports = { getAccount, getPositions, getOrders, getQuote, getOptionsChain, getOptionQuote, placeOptionsOrder, closePosition, isMarketOpen };
