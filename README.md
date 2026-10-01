# SIVA Trade AI

SIVA Trade AI is a Telugu-first market-analysis web application. It accepts a stock or crypto symbol, retrieves a recent market quote, and generates a structured AI-assisted analysis for a selected timeframe and risk level.

> **Important:** This project provides educational market analysis and alerts. It does not place trades, execute orders, or guarantee profits.

## What the application does

The application combines two server-side flows:

1. **Market quote lookup** — the entered symbol is normalized into common Yahoo Finance-style tickers and a recent quote is fetched.
2. **AI analysis** — the symbol, timeframe, risk, optional capital, and current price are sent to an AI model, which returns a structured analysis in Telugu.

The UI provides:

- **Timeframe:** Intraday, Swing (1–2 weeks), Long Term
- **Risk:** Low, Medium, High
- **Capital:** optional amount

The analysis result includes a summary, directional bias, entry range, target, stop-loss, confidence, reasons, and risks.

## Live quote flow

The quote query refreshes every **15 seconds** while a symbol is active.

The current symbol normalization supports:

- Indian indices: NIFTY, NIFTY50, BANKNIFTY, SENSEX
- Common crypto symbols such as BTC, ETH, SOL, XRP, DOGE, ADA, BNB, MATIC, LTC, TRX, AVAX
- Indian equity fallbacks using .NS and .BO
- Explicit ticker formats

The quote object used by the UI contains the symbol, name, currency, price, percentage change, market state, and update timestamp.

## AI analysis

The analysis server function validates input with Zod and requires LOVABLE_API_KEY.

Current implementation:

- **Model:** google/gemini-3.6-flash
- **Structured output:** Zod schema through the AI SDK
- **Language:** Telugu
- **Constraint:** the prompt explicitly treats the result as educational and does not promise profit

The returned structure contains:

| Field | Purpose |
|---|---|
| summary | Short Telugu explanation |
| bias | Bullish / Bearish / Neutral |
| entry | Entry range |
| target | Target range |
| stopLoss | Stop-loss range |
| entryPrice | Numeric entry reference |
| targetPrice | Numeric target reference |
| stopPrice | Numeric stop reference |
| confidence | 0–100 confidence value |
| reasons | Main analysis reasons |
| risks | Main risk points |

## Price alerts

After analysis, the application compares the latest quote with the generated target and stop-loss values.

When alerts are enabled:

- target hits can trigger a Telugu toast notification
- stop-loss hits can trigger a Telugu toast notification
- browser notifications are used when permission is already granted

## Application flow

```text
Symbol + timeframe + risk + optional capital
                 |
                 v
          getQuote server fn
                 |
                 v
       Yahoo Finance chart data
                 |
                 v
        analyzeTrade server fn
                 |
                 v
         Lovable AI Gateway
                 |
                 v
       Gemini structured result
                 |
                 v
      Telugu analysis + levels
                 |
                 v
        Live price comparison
                 |
           +-----+-----+
           |           |
        Target       Stop-loss
        alert         alert
```

## Technology stack

- TanStack Start
- React 19
- TypeScript
- Tailwind CSS
- TanStack React Query
- Zod
- AI SDK
- Lovable AI Gateway
- Yahoo Finance chart endpoint
- Lucide React
- Sonner

## Key files

| File | Responsibility |
|---|---|
| `src/routes/index.tsx` | Main UI, inputs, quote refresh, results and alerts |
| `src/lib/quote.functions.ts` | Symbol normalization and quote retrieval |
| `src/lib/analysis.functions.ts` | AI prompt, validation, structured output and error handling |
| `src/lib/ai-gateway.server.ts` | Lovable AI Gateway provider |
| `src/router.tsx` | Router setup |
| `src/server.ts` | Server entry |
| `src/start.ts` | TanStack Start entry |

## Run locally

```bash
git clone https://github.com/pallasivasai/siva-trade-ai.git
cd siva-trade-ai
npm install
npm run dev
```

Required environment variable:

```env
LOVABLE_API_KEY=your_key
```

Without this key, the AI analysis path cannot run.

## Limitations

- This is an analysis and monitoring tool, not a brokerage or order-execution system.
- Quote availability depends on the external finance endpoint.
- AI output depends on the supplied inputs and available quote data.
- Browser notifications depend on browser permission.

## Links

- [GitHub Repository](https://github.com/pallasivasai/siva-trade-ai)
