import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const QuoteInput = z.object({
  symbol: z.string().min(1).max(40),
});

export type Quote = {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  changePercent: number;
  marketState: string;
  updatedAt: number;
};

const CRYPTO = ["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "BNB", "MATIC", "LTC", "TRX", "AVAX"];

function candidates(raw: string): string[] {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  const list: string[] = [];
  if (CRYPTO.includes(s)) list.push(`${s}-USD`);
  if (s.endsWith("USDT")) list.push(`${s.replace(/USDT$/, "")}-USD`);
  if (s === "NIFTY" || s === "NIFTY50") list.push("^NSEI");
  if (s === "BANKNIFTY") list.push("^NSEBANK");
  if (s === "SENSEX") list.push("^BSESN");
  if (!s.includes(".") && !s.startsWith("^")) list.push(`${s}.NS`, `${s}.BO`);
  list.push(s);
  return [...new Set(list)];
}

async function fetchOne(ticker: string, host: string): Promise<Quote | null> {
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=1m&range=1d`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    chart?: { result?: Array<{ meta?: Record<string, unknown> }> };
  };
  const meta = json.chart?.result?.[0]?.meta;
  const price = meta?.["regularMarketPrice"];
  if (typeof price !== "number") return null;
  return {
    symbol: String(meta?.["symbol"] ?? ticker),
    name: String(meta?.["longName"] ?? meta?.["shortName"] ?? ticker),
    currency: String(meta?.["currency"] ?? ""),
    price,
    changePercent:
      typeof meta?.["regularMarketChangePercent"] === "number"
        ? (meta["regularMarketChangePercent"] as number)
        : 0,
    marketState: String(meta?.["marketState"] ?? ""),
    updatedAt: Date.now(),
  };
}

export const getQuote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => QuoteInput.parse(input))
  .handler(async ({ data }): Promise<QuoteResult> => {
    for (const ticker of candidates(data.symbol)) {
      for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
        try {
          const quote = await fetchOne(ticker, host);
          if (quote) return { quote };
        } catch {
          // try next host / candidate
        }
      }
    }
    return {
      quote: null,
      message: "ప్రస్తుత ధర దొరకలేదు. సింబల్ సరిచూడండి (ఉదా: RELIANCE, TCS, BTC).",
    };
  });
