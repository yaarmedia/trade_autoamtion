const ALPACA = {
  endpoint: 'https://paper-api.alpaca.markets/v2',
  key:      'PKCKKR7H2UMRLMBFP2TEN5PNAK',
  secret:   'AsTRF4DWT7LSv8D95sAZVyN76MMUhsALu4w9GB6PwoYV',
};

const WHEEL = {
  symbol:        'TSLA',
  // Target delta range for strike selection (lower = more OTM = safer)
  putDeltaMin:   0.20,
  putDeltaMax:   0.28,
  callDeltaMin:  0.20,
  callDeltaMax:  0.28,
  // Days to expiration window
  dteMin:        30,
  dteMax:        50,
  // Take profit: close position when premium decays to this % of original credit
  takeProfitPct: 0.50,   // close at 50% profit
  // Roll/close early when DTE reaches this threshold
  rollDte:       21,
  // Number of contracts to trade
  contracts:     1,
};

module.exports = { ALPACA, WHEEL };
