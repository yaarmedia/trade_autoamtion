# Automated Trading System

Two live automated strategies running on Alpaca paper trading accounts, monitored via Claude Code remote routines. Built to compare performance between a data-driven mirroring strategy and an options income strategy.

---

## Live Strategies

| Strategy | Account | Status | Schedule |
|----------|---------|--------|---------|
| [Congressional Trade Mirror](#strategy-1-congressional-trade-mirror) | `PKVJNEAQHM6...` | ✅ Live | Every 30 min / hourly |
| [TSLA Wheel Strategy](#strategy-2-tsla-wheel-strategy) | `PKCKKR7H2...` | ✅ Live | Hourly |

Both strategies:
- Only execute when the US market is open (checks Alpaca `/clock` endpoint)
- Skip weekends, holidays, and pre/after-market hours automatically
- Run on separate $100,000 paper accounts for clean performance comparison

---

## Where to Monitor

| What | Where |
|------|-------|
| Routine run logs | https://claude.ai/code/routines |
| Live positions & P&L | https://app.alpaca.markets (switch accounts) |
| Order history | Alpaca dashboard → Orders tab |
| Trade execution log | `executed_trades.json` (congressional) |
| Wheel cycle log | `wheel/wheel_log.json` + `wheel/wheel.log` |
| Source code | https://github.com/yaarmedia/trade_autoamtion |

---

## Strategy 1: Congressional Trade Mirror

### How It Works
1. Scrapes [Capitol Trades](https://www.capitoltrades.com) for new trade filings
2. Compares against a local log of already-executed trades (no duplicates)
3. Validates each ticker is active and tradable on Alpaca
4. Checks buying power before buys, checks holdings before sells
5. Places a market order to mirror the politician's trade
6. Logs result to `executed_trades.json`

### Who We Copy and Why

Congressional trading mirroring is a real strategy — there are even ETFs built around it (NANC mirrors Pelosi's trades). The edge: politicians on key committees receive classified briefings, early regulatory signals, and insider knowledge about legislation that moves markets. Studies show congressional portfolios significantly outperform the S&P 500.

---

#### Nancy Pelosi — $97.81M | 44 trades
**Why:** Widely considered the best trader in Congress. Laser-focused on big tech with uncanny timing — bought NVIDIA before major AI legislation and chip subsidies. Sits at the intersection of Silicon Valley fundraising and Washington policy. There is an entire ETF (NANC) that does nothing but mirror her.

**Trades:** NVDA, AAPL, GOOGL, AMZN, MSFT, PYPL, TEM

#### Dave McCormick — $63.33M | 278 trades
**Why:** Most active trader in Congress by count. Former CEO of Bridgewater Associates (world's largest hedge fund) — brings professional discipline. High frequency = more mirroring opportunities.

**Trades:** NVDA, GOOGL, AAPL, AMGN, MSFT, QCOM, V

#### Suzan DelBene — $42.96M | 174 trades
**Why:** Sits on House Ways and Means Committee (controls tax policy). Former Microsoft executive. Deep insight into both tech earnings and upcoming regulatory changes.

**Trades:** Tech-heavy, consistent with her background

#### Mark Warner — $29.98M | 107 trades
**Why:** Vice Chair of Senate Intelligence Committee. Former VC who made his fortune in telecom. Early visibility into national security decisions, CFIUS rulings, and emerging tech regulation.

**Trades:** WFC, MSFT, AAPL, IWD, HON, LNG

---

#### The Edge
Politicians have up to **45 days** to report a trade under the STOCK Act. By the time it appears on Capitol Trades, the catalyst may be public — but the stock often hasn't fully priced it in yet.

### Share Sizing

| Reported Value | Shares Mirrored |
|---------------|----------------|
| Under $50K | 1 share |
| $50K – $99K | 2 shares |
| $100K – $999K | 3 shares |
| $1M+ | 5 shares |

### Running Locally

```bash
npm install
npm run once     # single check cycle
npm run status   # view executed trade log
npm start        # run continuously (every 30 min)
```

### Schedule
- **Local:** Windows Task Scheduler → `CongressionalTradeMonitor` — every 30 min, Mon–Fri 9:30am–4pm ET
- **Cloud:** [Claude Code Routine](https://claude.ai/code/routines/trig_01VcywzMXTBfaLEVMNx3pNbZ) — every hour, Mon–Fri

---

## Strategy 2: TSLA Wheel Strategy

### How It Works

The wheel is an options income strategy that generates consistent premium by cycling between two positions:

**Phase 1 — Sell Cash-Secured Put (CSP)**
- Sell an OTM put on TSLA at 0.20–0.28 delta, 30–50 DTE
- Collect premium upfront
- If it expires worthless → keep premium, repeat Phase 1
- If TSLA drops below strike → get assigned 100 shares, move to Phase 2

**Phase 2 — Sell Covered Call (CC)**
- Now holding 100 shares of TSLA from assignment
- Sell an OTM call above cost basis at 0.20–0.28 delta, 30–50 DTE
- Collect premium upfront
- If it expires worthless → keep premium, repeat Phase 2
- If TSLA rises above strike → shares get called away, move back to Phase 1

**Repeat indefinitely**, collecting premium every cycle.

### Why TSLA
TSLA has consistently high implied volatility (IV), which means fatter option premiums. Higher IV = more income collected per contract. The tradeoff is larger potential swings — managed by using lower delta strikes and avoiding earnings weeks.

### Risk Management Rules
- **Strike selection:** 0.20–0.28 delta (roughly 12–20% OTM) — conservative buffer
- **Take profit:** Close position at 50% of max profit — locks in gains early, frees up capital
- **Roll early:** Close and re-sell at 21 DTE — avoids gamma acceleration near expiry
- **Call floor:** Covered call strike must be at or above cost basis — never sell shares at a loss
- **No naked positions:** Puts are always cash-secured, calls are always covered

### Files
```
wheel/
├── run.js           # Entry point
├── wheelEngine.js   # Full strategy logic (phase detection, strike selection, order management)
├── alpaca.js        # Alpaca API wrapper for options
├── config.js        # Credentials, delta targets, DTE window, take-profit rules
├── wheel_log.json   # State file: current phase, open order, cycle history
└── wheel.log        # Full timestamped text log of every action
```

### Running Locally
```bash
cd wheel
npm install
node run.js    # execute one cycle
```

### Schedule
- **Local:** Windows Task Scheduler → `WheelStrategyTSLA` — every hour, Mon–Fri 9:35am–4pm ET
- **Cloud:** [Claude Code Routine](https://claude.ai/code/routines/trig_01FH25fqCeCFovTPEr9kUUXh) — every hour, Mon–Fri

---

## Other Strategies (Potential Future Additions)

### Options Income
| Strategy | Description |
|----------|-------------|
| **Iron Condor** | Sell OTM call spread + put spread simultaneously — profit if price stays in range |
| **Earnings IV Crush** | Sell straddle before earnings, close after implied volatility collapses |
| **Covered Strangle** | Sell OTM call + OTM put at same time — more premium than wheel |
| **PMCC** | Buy deep ITM LEAP, sell short-term calls against it — less capital than covered calls |
| **0DTE Scalping** | Buy/sell options expiring same day — high frequency, high risk |

### Momentum / Trend
| Strategy | Description |
|----------|-------------|
| **52-Week High Breakout** | Buy stocks making new highs with volume confirmation |
| **RSI Mean Reversion** | Buy oversold stocks, sell overbought — works in choppy markets |
| **MACD Crossover** | Buy when fast MA crosses above slow MA on trending stocks |
| **Dual Momentum** | Rotate monthly between SPY, bonds, and cash based on relative strength |

### Data-Driven / Edge
| Strategy | Description |
|----------|-------------|
| **Insider Trading Mirror** | Mirror SEC Form 4 filings by corporate insiders — more frequent signals than congressional |
| **Options Flow** | Follow unusual large-volume options activity to spot smart money moves early |
| **Short Interest Squeeze** | Buy high-short-interest stocks with rising price momentum |
| **VIX Spike Buyer** | Buy SPY when VIX spikes above 30 — contrarian crash buying |

### ETF / Systematic
| Strategy | Description |
|----------|-------------|
| **DCA on SPY/QQQ** | Buy fixed dollar amount weekly regardless of price |
| **Sector Rotation** | Rotate between S&P sectors based on economic cycle phase |
| **TQQQ/SQQQ Switch** | Hold TQQQ in uptrend, SQQQ in downtrend — leveraged ETF momentum |

---

## Project Structure

```
├── monitor.js           # Congressional trade monitor runner
├── scraper.js           # Capitol Trades scraper
├── alpaca.js            # Alpaca API wrapper (equities)
├── tradeStore.js        # Executed trade deduplication store
├── config.js            # Congressional strategy config + credentials
├── executed_trades.json # Auto-generated congressional trade log
├── package.json
└── wheel/
    ├── run.js           # Wheel strategy entry point
    ├── wheelEngine.js   # Wheel strategy logic
    ├── alpaca.js        # Alpaca API wrapper (options)
    ├── config.js        # Wheel strategy config + credentials
    ├── wheel_log.json   # Wheel state and cycle history
    └── wheel.log        # Full timestamped execution log
```

---

## Disclaimer

This project uses **paper trading accounts** — no real money is involved. This is for educational and research purposes only. Nothing here constitutes financial advice.
