// Alpaca paper trading credentials
const ALPACA = {
  endpoint: 'https://paper-api.alpaca.markets/v2',
  key: 'PKMUHZB4FEQ5DBF5FXXMP6ITKU',
  secret: 'B8bPFpPvxNVE1g1vUnuynKpWTTcnQWvcj6c7Vs8rqW3Z',
};

// Politicians to follow (Capitol Trades profile IDs)
// Ranked by trading volume and historical performance
const POLITICIANS = [
  { id: 'P000197', name: 'Nancy Pelosi',    party: 'D', volume: '$97.81M' },
  { id: 'M001204', name: 'Dave McCormick',  party: 'R', volume: '$63.33M' },
  { id: 'D000617', name: 'Suzan DelBene',   party: 'D', volume: '$42.96M' },
  { id: 'W000805', name: 'Mark Warner',     party: 'D', volume: '$29.98M' },
];

// How many shares to buy/sell when mirroring a trade
// Scales with politician's trade size bucket
const MIRROR_SHARES = {
  default: 1,      // fallback
  small:   1,      // $1K–$15K reported range
  medium:  2,      // $15K–$50K
  large:   3,      // $50K–$100K
  xlarge:  5,      // $100K+
};

// How often to check for new trades (cron expression)
// Default: every 30 minutes during market hours
const CHECK_INTERVAL = '*/30 9-16 * * 1-5'; // Mon-Fri 9am-4pm

module.exports = { ALPACA, POLITICIANS, MIRROR_SHARES, CHECK_INTERVAL };
