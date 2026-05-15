const axios = require('axios');
const { ALPACA } = require('./config');

const api = axios.create({
  baseURL: ALPACA.endpoint,
  headers: {
    'APCA-API-KEY-ID':     ALPACA.key,
    'APCA-API-SECRET-KEY': ALPACA.secret,
  },
});

const dataApi = axios.create({
  baseURL: 'https://data.alpaca.markets/v2',
  headers: {
    'APCA-API-KEY-ID':     ALPACA.key,
    'APCA-API-SECRET-KEY': ALPACA.secret,
  },
});

async function isMarketOpen() {
  const { data } = await api.get('/clock');
  return data.is_open;
}

async function getAccount() {
  const { data } = await api.get('/account');
  return data;
}

async function getPositions() {
  const { data } = await api.get('/positions');
  return data;
}

async function getOrders(status = 'open') {
  const { data } = await api.get('/orders', { params: { status, limit: 50 } });
  return data;
}

// Fetch last `limit` daily bars for a symbol
async function getBars(symbol, limit = 60) {
  // Go back far enough to cover limit trading days (~1.5x calendar days)
  const start = new Date();
  start.setDate(start.getDate() - Math.ceil(limit * 1.5));
  const { data } = await dataApi.get(`/stocks/${symbol}/bars`, {
    params: {
      timeframe: '1Day',
      start: start.toISOString().split('T')[0],
      limit,
      adjustment: 'split',
    },
  });
  return data.bars || [];
}

async function placeOrder({ symbol, qty, side, type = 'market', limitPrice }) {
  const body = {
    symbol,
    qty,
    side,
    type,
    time_in_force: type === 'limit' ? 'day' : 'day',
  };
  if (type === 'limit' && limitPrice) body.limit_price = String(limitPrice);

  try {
    const { data } = await api.post('/orders', body);
    return { success: true, order: data };
  } catch (err) {
    return { success: false, error: err.response?.data?.message || err.message };
  }
}

async function closePosition(symbol) {
  try {
    const { data } = await api.delete(`/positions/${symbol}`);
    return { success: true, order: data };
  } catch (err) {
    return { success: false, error: err.response?.data?.message || err.message };
  }
}

module.exports = { isMarketOpen, getAccount, getPositions, getOrders, getBars, placeOrder, closePosition };
