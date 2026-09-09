import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const QuoteInput = z.object({ symbol: z.string().min(1).max(40) });

export type Quote = {
  symbol: string;
  resolved: string;
  price: number;
  currency: string;
  changePercent: number | null;
  market: "crypto" | "stock";
  time: number;
};

const CRYPTO = new Set([
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "DOGE",
  "BNB",
  "ADA",
  "MATIC",
  "LTC",
  "AVAX",
  "TRX",
  "DOT",
  "SHIB",
  "LINK",
]);

const INDEX_MAP: Record<string, string> = {
  NIFTY: "^NSEI",
  NIFTY50: "^NSEI",
  BANKNIFTY: "^NSEBANK",
  SENSEX: "^BSESN",
};

async function yahoo(sym: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    sym,
  )}?interval=1m&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  const meta = json?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== "number") return null;
  const prev = typeof meta?.chartPreviousClose === "number" ? meta.chartPreviousClose : null;
  return {
    resolved: String(meta?.symbol ?? sym),
    price,
    currency: String(meta?.currency ?? "INR"),
    changePercent: prev ? ((price - prev) / prev) * 100 : null,
  };
}

export const getQuote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => QuoteInput.parse(input))
  .handler(async ({ data }): Promise<Quote> => {
    const raw = data.symbol.trim().toUpperCase().replace(/\s+/g, "");
    const base = raw.replace(/(USDT|USD|INR)$/, "");

    if (CRYPTO.has(base)) {
      const pair = `${base}USDT`;
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`);
      if (res.ok) {
        const j = (await res.json()) as any;
        const price = Number(j.lastPrice);
        if (Number.isFinite(price)) {
          return {
            symbol: raw,
            resolved: pair,
            price,
            currency: "USDT",
            changePercent: Number(j.priceChangePercent) || 0,
            market: "crypto",
            time: Date.now(),
          };
        }
      }
    }

    const candidates = INDEX_MAP[raw]
      ? [INDEX_MAP[raw]!]
      : raw.startsWith("^") || raw.includes(".")
        ? [raw]
        : [`${raw}.NS`, `${raw}.BO`, raw];

    for (const c of candidates) {
      const q = await yahoo(c);
      if (q) {
        return {
          symbol: raw,
          ...q,
          market: "stock",
          time: Date.now(),
        };
      }
    }

    throw new Error("ఈ సింబల్‌కు ప్రస్తుత ధర దొరకలేదు. సరైన పేరు ఇవ్వండి (ఉదా: RELIANCE, NIFTY, BTC).");
  });
