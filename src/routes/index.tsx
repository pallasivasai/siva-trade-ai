import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Gauge,
  LineChart,
  AlertTriangle,
  Bell,
  BellOff,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { analyzeTrade, type AnalysisResult } from "@/lib/analysis.functions";
import { getQuote, type QuoteResult } from "@/lib/quote.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI ట్రేడర్ – తెలుగులో స్మార్ట్ మార్కెట్ విశ్లేషణ" },
      {
        name: "description",
        content:
          "తెలుగులో AI మార్కెట్ విశ్లేషణ: ఎంట్రీ, టార్గెట్, స్టాప్‌లాస్ సూచనలు సులభంగా అర్థమయ్యేలా.",
      },
      { property: "og:title", content: "AI ట్రేడర్ – తెలుగులో స్మార్ట్ మార్కెట్ విశ్లేషణ" },
      {
        property: "og:description",
        content: "మీ స్టాక్ లేదా క్రిప్టో గురించి తెలుగులో స్పష్టమైన AI విశ్లేషణ పొందండి.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: Index,
});

const timeframes = ["ఇంట్రాడే", "స్వింగ్ (1-2 వారాలు)", "లాంగ్ టర్మ్"];
const risks = ["తక్కువ", "మధ్యస్థం", "ఎక్కువ"];

function formatPrice(value: number, currency: string) {
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : "";
  return `${symbol}${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function notify(title: string, body: string) {
  toast(title, { description: body, duration: 10000 });
  try {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") new Notification(title, { body });
    }
  } catch {
    // notifications unavailable
  }
}

function Index() {
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState(timeframes[1]);
  const [risk, setRisk] = useState(risks[1]);
  const [capital, setCapital] = useState("");
  const [activeSymbol, setActiveSymbol] = useState("");
  const [alertsOn, setAlertsOn] = useState(true);
  const firedRef = useRef<{ target: boolean; stop: boolean }>({ target: false, stop: false });

  const run = useServerFn(analyzeTrade);
  const quoteFn = useServerFn(getQuote);

  const quoteQuery = useQuery<QuoteResult, Error>({
    queryKey: ["quote", activeSymbol],
    enabled: activeSymbol.length > 0,
    queryFn: () => quoteFn({ data: { symbol: activeSymbol } }),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    retry: 1,
  });

  const mutation = useMutation<AnalysisResult, Error>({
    mutationFn: async () => {
      let live: QuoteResult["quote"] = null;
      try {
        live = (await quoteFn({ data: { symbol } })).quote;
      } catch {
        live = null;
      }
      firedRef.current = { target: false, stop: false };
      setActiveSymbol(symbol.trim());
      return run({
        data: {
          symbol,
          timeframe,
          risk,
          capital,
          ...(live ? { currentPrice: live.price, currency: live.currency } : {}),
        },
      });
    },
  });

  const result = mutation.data;
  const quote = quoteQuery.data?.quote ?? null;
  const quoteMessage = quoteQuery.data?.message ?? quoteQuery.error?.message ?? null;

  // లైవ్ ధర టార్గెట్ / స్టాప్‌లాస్‌ను తాకినప్పుడు తెలుగులో అలర్ట్
  useEffect(() => {
    if (!alertsOn || !result || !quote) return;
    const price = quote.price;
    const bullish = result.targetPrice >= result.entryPrice;
    const hitTarget = bullish ? price >= result.targetPrice : price <= result.targetPrice;
    const hitStop = bullish ? price <= result.stopPrice : price >= result.stopPrice;

    if (hitTarget && !firedRef.current.target) {
      firedRef.current.target = true;
      notify(
        `🎯 ${activeSymbol.toUpperCase()} టార్గెట్ చేరింది!`,
        `ప్రస్తుత ధర ${formatPrice(price, quote.currency)} — మీ టార్గెట్ ${formatPrice(result.targetPrice, quote.currency)} చేరుకుంది. లాభం బుక్ చేయడం గురించి ఆలోచించండి.`,
      );
    }
    if (hitStop && !firedRef.current.stop) {
      firedRef.current.stop = true;
      notify(
        `⚠️ ${activeSymbol.toUpperCase()} స్టాప్ లాస్ తాకింది`,
        `ప్రస్తుత ధర ${formatPrice(price, quote.currency)} — మీ స్టాప్ లాస్ ${formatPrice(result.stopPrice, quote.currency)} దాటింది. రిస్క్‌ను నియంత్రించండి.`,
      );
    }
  }, [quote, result, alertsOn, activeSymbol]);

  const toggleAlerts = async (on: boolean) => {
    setAlertsOn(on);
    if (on && typeof window !== "undefined" && "Notification" in window) {
      try {
        if (Notification.permission === "default") await Notification.requestPermission();
      } catch {
        // ignore
      }
    }
  };


  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2 text-lg font-bold">
          <TrendingUp className="size-6 text-primary" />
          <span className="text-gradient-gold">AI ట్రేడర్</span>
        </div>
        <span className="text-xs text-muted-foreground">తెలుగులో మార్కెట్ విశ్లేషణ</span>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-8 pt-6 text-center">
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          మార్కెట్‌ను <span className="text-gradient-gold">తెలుగులో</span> అర్థం చేసుకోండి
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          స్టాక్ లేదా క్రిప్టో పేరు ఇవ్వండి — AI మీకు ఎంట్రీ, టార్గెట్, స్టాప్‌లాస్ మరియు రిస్క్‌లను
          సులభమైన తెలుగులో వివరిస్తుంది.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <Sparkles className="size-4 text-accent" /> క్షణాల్లో విశ్లేషణ
          </span>
          <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <ShieldCheck className="size-4 text-primary" /> రిస్క్ మేనేజ్‌మెంట్ దృష్టి
          </span>
          <span className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <Gauge className="size-4 text-accent" /> కాన్ఫిడెన్స్ స్కోర్
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-16">
        <Card className="shadow-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <LineChart className="size-5 text-primary" /> విశ్లేషణ ప్రారంభించండి
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="symbol">స్టాక్ / క్రిప్టో పేరు</Label>
                <Input
                  id="symbol"
                  placeholder="ఉదా: RELIANCE, NIFTY, BTC"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capital">పెట్టుబడి (ఐచ్ఛికం)</Label>
                <Input
                  id="capital"
                  placeholder="ఉదా: ₹50,000"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>టైమ్‌ఫ్రేమ్</Label>
              <div className="flex flex-wrap gap-2">
                {timeframes.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={timeframe === t ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setTimeframe(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>రిస్క్ స్థాయి</Label>
              <div className="flex flex-wrap gap-2">
                {risks.map((r) => (
                  <Button
                    key={r}
                    type="button"
                    variant={risk === r ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setRisk(r)}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!symbol.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "AI విశ్లేషిస్తోంది..." : "AI విశ్లేషణ పొందండి"}
            </Button>

            {mutation.isError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
                {mutation.error.message}
              </p>
            )}
          </CardContent>
        </Card>

        {result && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>{symbol.toUpperCase()} విశ్లేషణ</span>
                <span
                  className={
                    result.bias.includes("బేరిష్")
                      ? "text-[var(--bear)]"
                      : result.bias.includes("బుల్లిష్")
                        ? "text-[var(--bull)]"
                        : "text-muted-foreground"
                  }
                >
                  {result.bias}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border border-border bg-secondary p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Radio className="size-3.5 animate-pulse text-[var(--bull)]" /> లైవ్ ధర
                      {quoteQuery.isFetching && <span>(అప్‌డేట్ అవుతోంది...)</span>}
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      {quote ? formatPrice(quote.price, quote.currency) : "—"}
                    </div>
                    {quote && (
                      <div
                        className={
                          quote.changePercent >= 0
                            ? "text-xs text-[var(--bull)]"
                            : "text-xs text-[var(--bear)]"
                        }
                      >
                        {quote.changePercent >= 0 ? "▲" : "▼"} {Math.abs(quote.changePercent).toFixed(2)}% ·{" "}
                        {new Date(quote.updatedAt).toLocaleTimeString("en-IN")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {alertsOn ? (
                      <Bell className="size-4 text-primary" />
                    ) : (
                      <BellOff className="size-4 text-muted-foreground" />
                    )}
                    <Label htmlFor="alerts" className="text-xs">
                      ధర అలర్ట్‌లు
                    </Label>
                    <Switch id="alerts" checked={alertsOn} onCheckedChange={toggleAlerts} />
                  </div>
                </div>
                {!quote && quoteMessage && (
                  <p className="mt-2 text-xs text-muted-foreground">{quoteMessage}</p>
                )}
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">{result.summary}</p>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "ఎంట్రీ", value: result.entry, level: result.entryPrice },
                  { label: "టార్గెట్", value: result.target, level: result.targetPrice },
                  { label: "స్టాప్ లాస్", value: result.stopLoss, level: result.stopPrice },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-border bg-secondary p-3">
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="mt-1 font-semibold">{item.value}</div>
                    {quote && item.level > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        లైవ్ ధర నుండి {(((item.level - quote.price) / quote.price) * 100).toFixed(2)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>


              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>కాన్ఫిడెన్స్</span>
                  <span className="font-semibold text-primary">{result.confidence}%</span>
                </div>
                <Progress value={result.confidence} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold">కారణాలు</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {result.reasons.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">రిస్క్‌లు</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {result.risks.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" />
          గమనిక: ఇది విద్యా మరియు సమాచార ప్రయోజనం కోసమే. మార్కెట్‌లో ఎప్పుడూ లాభం గ్యారెంటీ ఉండదు —
          పెట్టుబడి నిర్ణయాలు మీ సొంత బాధ్యత.
        </p>
      </section>
    </main>
  );
}
