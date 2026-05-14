# Congressional Trade Monitor

Automatically mirrors stock trades filed by top-performing US politicians on your Alpaca paper trading account. Scrapes [Capitol Trades](https://www.capitoltrades.com) for new filings and places matching market orders in real time.

---

## How It Works

1. Fetches the latest disclosed trades from Capitol Trades for tracked politicians
2. Compares against a local log of already-executed trades to avoid duplicates
3. Validates each trade against Alpaca (asset must be active and tradable)
4. Checks buying power before buys, checks holdings before sells (no naked shorting)
5. Places a market order on Alpaca paper trading to mirror the trade
6. Logs the result to `executed_trades.json`

---

## Politicians Tracked

| Name | Party | 3-Year Volume | Notes |
|------|-------|--------------|-------|
| Nancy Pelosi | D | $97.81M | Heavily concentrated in big tech |
| Dave McCormick | R | $63.33M | Most active trader (278 trades) |
| Suzan DelBene | D | $42.96M | Tech-focused |
| Mark Warner | D | $29.98M | Diversified portfolio |

> Politicians have up to **45 days** to report trades under the STOCK Act, so new filings appear periodically rather than in real time.

---

## Alpaca Account

- **Endpoint:** `https://paper-api.alpaca.markets/v2`
- **Account type:** Paper trading (simulated money, $100,000 starting balance)
- **Credentials:** Stored in `config.js`

---

## Project Structure

```
├── monitor.js          # Main runner — orchestrates checks and order placement
├── scraper.js          # Fetches and parses trade data from Capitol Trades
├── alpaca.js           # Alpaca REST API wrapper (orders, positions, account)
├── tradeStore.js       # Persists executed trade IDs to avoid duplicates
├── config.js           # Credentials, politician list, share sizing rules
├── executed_trades.json # Auto-generated log of all placed orders
└── package.json
```

---

## Share Sizing

Trades are sized based on the dollar value reported by the politician:

| Reported Value | Shares Mirrored |
|---------------|----------------|
| Under $50K | 1 share |
| $50K – $99K | 2 shares |
| $100K – $999K | 3 shares |
| $1M+ | 5 shares |

---

## Running Locally

```bash
# Install dependencies
npm install

# Run one check cycle (scrape + place any new orders)
npm run once

# View log of all executed trades
npm run status

# Run continuously (checks every 30 min via node-cron)
npm start
```

---

## Automated Schedule

The monitor runs automatically on two tracks:

### 1. Windows Task Scheduler (local machine)
- **Interval:** Every 30 minutes
- **Hours:** Mon–Fri, 9:30am – 4:00pm ET
- **Requirement:** PC must be on
- Manage via Windows Task Scheduler → `CongressionalTradeMonitor`

### 2. Claude Code Remote Routine (cloud)
- **Interval:** Every 1 hour
- **Hours:** Mon–Fri, 9:00am – 4:00pm ET
- **Requirement:** None — runs in Anthropic's cloud even when PC is off
- View and manage at: https://claude.ai/code/routines

---

## Trade Safety Rules

- **No naked shorting:** Sells are only placed if the stock is already held in the portfolio
- **Buying power check:** Buys are skipped if cash is insufficient
- **No duplicates:** Each trade is identified by a unique transaction ID from Capitol Trades — never executed twice
- **Asset validation:** Skips any ticker that is not active and tradable on Alpaca

---

## Data Source

Trade data is sourced from [Capitol Trades](https://www.capitoltrades.com), which aggregates congressional financial disclosures filed under the **STOCK Act (Stop Trading on Congressional Knowledge Act)**. All trades are public record.

---

## Disclaimer

This project uses a **paper trading account** — no real money is involved. This is for educational and research purposes only. Nothing here constitutes financial advice.
