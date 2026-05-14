const axios = require('axios');
const { ALPACA } = require('./config');

const headers = {
  'APCA-API-KEY-ID': ALPACA.key,
  'APCA-API-SECRET-KEY': ALPACA.secret,
  'Content-Type': 'application/json',
};

async function getAccount() {
  const res = await axios.get(`${ALPACA.endpoint}/account`, { headers });
  return res.data;
}

async function getPositions() {
  const res = await axios.get(`${ALPACA.endpoint}/positions`, { headers });
  return res.data;
}

async function getAsset(symbol) {
  try {
    const res = await axios.get(`${ALPACA.endpoint}/assets/${symbol}`, { headers });
    return res.data;
  } catch {
    return null;
  }
}

async function isMarketOpen() {
  const res = await axios.get(`${ALPACA.endpoint}/clock`, { headers });
  return res.data.is_open;
}

async function placeOrder({ symbol, qty, side, type = 'market', time_in_force = 'day', limit_price }) {
  const body = { symbol, qty: String(qty), side, type, time_in_force };
  if (limit_price) body.limit_price = String(limit_price);

  try {
    const res = await axios.post(`${ALPACA.endpoint}/orders`, body, { headers });
    return { success: true, order: res.data };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    return { success: false, error: msg };
  }
}

async function getOrders(status = 'all', limit = 50) {
  const res = await axios.get(`${ALPACA.endpoint}/orders`, {
    headers,
    params: { status, limit },
  });
  return res.data;
}

module.exports = { getAccount, getPositions, getAsset, isMarketOpen, placeOrder, getOrders };
