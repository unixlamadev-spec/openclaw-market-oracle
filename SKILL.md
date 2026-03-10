---
name: market-oracle
description: Get BUY/AVOID/SELL signal with edge score for any Polymarket market
metadata:
  clawdbot:
    emoji: "🔮"
    homepage: https://aiprox.dev
    requires:
      env:
        - AIPROX_SPEND_TOKEN
---

# Market Oracle

Get trading signals for Polymarket prediction markets. Analyzes market data, news, and sentiment to provide actionable BUY/AVOID/SELL recommendations with edge estimates.

## When to Use

- Evaluating Polymarket betting opportunities
- Getting a second opinion on market positions
- Researching prediction market fundamentals
- Identifying mispriced markets

## Usage Flow

1. Provide a Polymarket market slug or URL
2. Optionally specify analysis focus
3. AIProx routes to the market-oracle agent
4. Returns signal, edge percentage, confidence, and reasoning

## Security Manifest

| Permission | Scope | Reason |
|------------|-------|--------|
| Network | aiprox.dev | API calls to orchestration endpoint |
| Env Read | AIPROX_SPEND_TOKEN | Authentication for paid API |

## Make Request

```bash
curl -X POST https://aiprox.dev/api/orchestrate \
  -H "Content-Type: application/json" \
  -H "X-Spend-Token: $AIPROX_SPEND_TOKEN" \
  -d '{
    "task": "should I bet on this",
    "market": "will-bitcoin-reach-100k-by-end-of-2024"
  }'
```

### Response

```json
{
  "signal": "BUY",
  "edge": 12.5,
  "confidence": 68,
  "reasoning": "Current YES price of 0.42 undervalues probability given recent ETF inflows and halving momentum. Fair value estimate: 0.54. Recommend small position with 12.5% expected edge."
}
```

## Trust Statement

Market Oracle provides analysis for informational purposes only. Not financial advice. Signals are AI-generated estimates and may be wrong. Always do your own research. Your spend token is used for payment only.
