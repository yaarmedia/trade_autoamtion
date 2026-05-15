const ALPACA = {
  endpoint: 'https://paper-api.alpaca.markets/v2',
  key:      'PKENDOALUOVX3FOKDPDD5QWN5E',
  secret:   'F7kRC7s9jvmVnPjVqjXTb7MbNrgGAdovyrd8n5dsrPP4',
};

const STRATEGY = {
  // Symbols to trade
  symbols: ['QQQ', 'NVDA', 'AAPL', 'SPY', 'META', 'NFLX', 'CRM', 'MSFT', 'JPM'],

  // MACD settings (standard)
  macdFast:   12,
  macdSlow:   26,
  macdSignal: 9,

  // RSI settings
  rsiPeriod: 14,

  // Entry rules
  buyRsiMax:  55,   // only buy when RSI below this (not overbought)
  buyRsiMin:  30,   // don't buy when RSI below this (might be in freefall)

  // Exit rules
  sellRsiMin: 65,   // sell when RSI above this (overbought)
  stopLossPct: 0.05, // 5% stop loss

  // Position sizing: how much of portfolio per position
  positionPct: 0.20, // 20% of portfolio per symbol
};

module.exports = { ALPACA, STRATEGY };
