const axios = require('axios');

const BASE = 'https://www.capitoltrades.com';

// Dollar value → share count to mirror
function valuToShares(value) {
  if (!value) return 1;
  if (value >= 1000000) return 5;
  if (value >= 100000)  return 3;
  if (value >= 50000)   return 2;
  return 1;
}

// Strip exchange suffix: "NVDA:US" → "NVDA"
function cleanTicker(raw) {
  if (!raw) return null;
  return raw.split(':')[0].trim().toUpperCase();
}

// Extract the embedded __next_f streaming JSON from a Capitol Trades HTML page
function extractNextFData(html) {
  const chunks = [];
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    chunks.push(raw);
  }
  return chunks.join('');
}

// Parse the "data":[...] array of trade records embedded in the page
function parseTradeRecords(allData) {
  const dataIdx = allData.indexOf('"data":[{"_issuerId"');
  if (dataIdx === -1) return [];

  let depth = 0;
  const start = allData.indexOf('[', dataIdx);
  let end = start;
  for (let i = start; i < allData.length; i++) {
    if (allData[i] === '[') depth++;
    else if (allData[i] === ']') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }

  try {
    return JSON.parse(allData.slice(start, end));
  } catch {
    return [];
  }
}

async function fetchPoliticianTrades(politicianId) {
  const url = `${BASE}/politicians/${politicianId}`;
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 20000,
    });

    const allData = extractNextFData(res.data);
    const records = parseTradeRecords(allData);

    return records.map(rec => {
      const tickerRaw = rec.issuer?.issuerTicker || '';
      const ticker    = cleanTicker(tickerRaw);
      if (!ticker) return null;

      const side = (rec.txType || '').toLowerCase();
      if (side !== 'buy' && side !== 'sell') return null;

      const qty = valuToShares(rec.value);
      const id  = `${politicianId}_${rec._txId}`;

      return {
        id,
        ticker,
        side,
        date:    rec.txDate,
        qty,
        value:   rec.value,
        price:   rec.price,
        comment: rec.comment || '',
        source:  politicianId,
        txId:    rec._txId,
      };
    }).filter(Boolean);

  } catch (err) {
    console.error(`  [scraper] Failed for ${politicianId}: ${err.message}`);
    return [];
  }
}

module.exports = { fetchPoliticianTrades };
