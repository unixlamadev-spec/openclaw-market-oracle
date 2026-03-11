require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3012;
const SIGNAL_URL = 'https://trader.lpxpoly.com/v1/signal';
const AIPROX_REGISTER_URL = 'https://aiprox.dev/api/agents/register';

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'market-oracle' });
});

// Capabilities endpoint
app.get('/v1/capabilities', (req, res) => {
  res.json({
    capabilities: ['market-signal', 'batch-comparison', 'edge-analysis', 'timeframe-framing'],
    accepts: [
      'market (single slug)',
      'markets (array of slugs, up to 5)',
      'task (optional)',
      'timeframe (optional): short|medium|long'
    ],
    returns: {
      single: ['signal', 'edge', 'confidence', 'analysis', 'market'],
      batch: ['ranked (array ordered best opportunity first)', 'best_market']
    }
  });
});

// Fetch signal for a single market
async function fetchSignal(market, task, timeframe) {
  const signalRes = await fetch(SIGNAL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Spend-Token': process.env.SIGNAL_TOKEN
    },
    body: JSON.stringify({ market, task: task || '', timeframe: timeframe || 'medium' })
  });

  console.log(`[MARKET-ORACLE] Signal status for ${market}:`, signalRes.status);
  const responseText = await signalRes.text();
  console.log(`[MARKET-ORACLE] Response for ${market}:`, responseText.slice(0, 200));

  try {
    return { market, status: signalRes.status, data: JSON.parse(responseText) };
  } catch {
    return { market, status: signalRes.status, data: { raw: responseText } };
  }
}

// Rank batch results by edge/confidence (best first)
function rankResults(results) {
  return results
    .filter(r => r.status < 400)
    .sort((a, b) => {
      const edgeA = parseFloat(a.data?.edge) || 0;
      const edgeB = parseFloat(b.data?.edge) || 0;
      return edgeB - edgeA;
    });
}

// Main task endpoint
app.post('/v1/task', async (req, res) => {
  const { task, market, markets, timeframe } = req.body;

  if (!market && (!Array.isArray(markets) || markets.length === 0)) {
    return res.status(400).json({ error: 'market or markets array is required' });
  }

  const validTimeframes = ['short', 'medium', 'long'];
  const resolvedTimeframe = validTimeframes.includes(timeframe) ? timeframe : 'medium';

  // Batch mode
  if (Array.isArray(markets) && markets.length > 0) {
    const slugs = markets.slice(0, 5);
    console.log(`[MARKET-ORACLE] Batch mode: ${slugs.length} markets, timeframe: ${resolvedTimeframe}`);

    try {
      const results = await Promise.all(
        slugs.map(slug => fetchSignal(slug, task, resolvedTimeframe))
      );

      const ranked = rankResults(results);
      const errors = results.filter(r => r.status >= 400);

      return res.json({
        mode: 'batch',
        timeframe: resolvedTimeframe,
        ranked: ranked.map((r, i) => ({ rank: i + 1, market: r.market, ...r.data })),
        best_market: ranked[0]?.market || null,
        ...(errors.length > 0 ? { errors: errors.map(e => ({ market: e.market, error: e.data })) } : {})
      });
    } catch (err) {
      console.error('[MARKET-ORACLE ERROR]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // Single mode
  console.log(`[MARKET-ORACLE] Task: ${(task || '').slice(0, 100)}`);
  console.log(`[MARKET-ORACLE] Market: ${market}, timeframe: ${resolvedTimeframe}`);

  try {
    console.log('[MARKET-ORACLE] Proxying to signal service...');
    const result = await fetchSignal(market, task, resolvedTimeframe);

    return res.status(result.status).json({
      mode: 'single',
      timeframe: resolvedTimeframe,
      market,
      ...result.data
    });
  } catch (err) {
    console.error('[MARKET-ORACLE ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Register with AIProx on startup
async function registerWithAIProx() {
  try {
    const endpoint = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
    const res = await fetch(AIPROX_REGISTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'market-oracle',
        description: 'Polymarket signal and edge analysis agent. Accepts a single market slug or a batch of up to 5 for comparison. Supports short/medium/long timeframe framing. Returns ranked opportunities, signals, and edge analysis.',
        capability: 'market-data',
        rail: 'bitcoin-lightning',
        endpoint: `${endpoint}/v1/task`,
        price_per_call: 30,
        price_unit: 'sats'
      })
    });

    const data = await res.json();
    if (res.ok) {
      console.log('[REGISTER] Registered with AIProx:', data.name || 'market-oracle');
    } else {
      console.log('[REGISTER] AIProx response:', data.error || data.message || 'already registered');
    }
  } catch (err) {
    console.log('[REGISTER] Could not register with AIProx:', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`[MARKET-ORACLE] Running on port ${PORT}`);
  if (process.env.AUTO_REGISTER === 'true') {
    registerWithAIProx();
  }
});
