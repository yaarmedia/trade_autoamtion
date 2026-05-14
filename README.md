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

## Who We Copy and Why

Congressional trading mirroring is a real and widely used strategy — there are even ETFs built around it (e.g. NANC tracks Pelosi's trades). The core idea: politicians on key committees receive classified briefings, early regulatory signals, and insider knowledge about legislation that can move markets. Studies have shown congressional portfolios significantly outperform the S&P 500 on average.

We selected the four highest-volume, most consistent traders on Capitol Trades:

---

### Nancy Pelosi — $97.81M volume | 44 trades
**Why we copy her:** Pelosi is widely considered the single best trader in Congress. Her portfolio is laser-focused on big tech — NVIDIA, Apple, Alphabet, Amazon — and her timing has been uncanny. She bought NVIDIA call options before major AI legislation and chip subsidies. She sits at the intersection of Silicon Valley fundraising and Washington policy, giving her an unmatched read on the tech sector. There is an entire ETF (ticker: NANC) that does nothing but mirror her trades.

**What she trades:** NVDA, AAPL, GOOGL, AMZN, MSFT, PYPL, TEM

---

### Dave McCormick — $63.33M volume | 278 trades
**Why we copy him:** McCormick is the most *active* trader in Congress by trade count. A former hedge fund CEO (Bridgewater Associates), he brings a professional investor's discipline to his personal portfolio. His high frequency means more opportunities to mirror, and his Wall Street background suggests genuine skill rather than luck.

**What he trades:** Broadly diversified — NVDA, GOOGL, AAPL, AMGN, MSFT, QCOM, V

---

### Suzan DelBene — $42.96M volume | 174 trades
**Why we copy her:** DelBene sits on the House Ways and Means Committee, which controls tax policy, and is a former Microsoft executive. Her tech background and committee position give her deep insight into both corporate earnings trajectories and upcoming tax/regulatory changes that affect tech valuations.

**What she trades:** Tech-heavy, consistent with her background

---

### Mark Warner — $29.98M volume | 107 trades
**Why we copy him:** Warner is Vice Chair of the Senate Intelligence Committee and a former venture capitalist who made his fortune in telecom. He has early visibility into national security decisions, foreign investment restrictions (CFIUS), and emerging tech regulation — all of which have major market implications.

**What he trades:** WFC, MSFT, AAPL, IWD, HON, LNG — diversified with a financial/energy lean

---

### The Edge
The reason this strategy works is the **reporting delay loophole**. Politicians have up to **45 days** to report a trade. By the time it appears on Capitol Trades, the catalyst (a bill passing, a contract awarded, a regulatory decision) may already be public — but the stock often hasn't fully priced it in yet. Early movers still profit.

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
