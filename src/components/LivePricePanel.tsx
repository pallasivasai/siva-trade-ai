import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Bell, BellRing, Target, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getQuote, type Quote } from "@/lib/quote.functions";

export function firstNumber(text: string): number | null {
  const match = text.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function fmt(n: number, currency: string) {
  const symbol = currency === "INR" ? "₹" : currency === "USDT" ? "$" : "";
  return `${symbol}${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

type Props = {
  symbol: string;
  entryText: string;
  targetText: string;
  stopLossText: string;
};

export function LivePricePanel({ symbol, entryText, targetText, stopLossText }: Props) {
  const fetchQuote = useServerFn(getQuote);
  const [alertsOn, setAlertsOn] = useState(true);
  const [target, setTarget] = useState<string>("");
  const [stop, setStop] = useState<string>("");
  const firedRef = useRef<{ target: boolean; stop: boolean }>({ target: false, stop: false });

  const entry = useMemo(() => firstNumber(entryText), [entryText]);

  useEffect(() => {
    setTarget(String(firstNumber(targetText) ?? ""));
    setStop(String(firstNumber(stopLossText) ?? ""));
    firedRef.current = { target: false, stop: false };
  }, [symbol, targetText, stopLossText]);

  const query = useQuery<Quote, Error>({
    queryKey: ["quote", symbol],
    queryFn: () => fetchQuote({ data: { symbol } }),
    refetchInterval: 15000,
    retry: 1,
  });

  const quote = query.data;

  const notify = (title: string, body: string) => {
    toast(title, { description: body, duration: 10000 });
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  };

  useEffect(() => {
    if (!quote || !alertsOn) return;
    const price = quote.price;
    const t = Number(target);
    const s = Number(stop);
    const up = entry != null && t ? t >= entry : true;

    if (t && !firedRef.current.target) {
      const hit = up ? price >= t : price <= t;
      if (hit && !armedRef.current) {
        // level already crossed on the very first reading — don't cry wolf
        firedRef.current.target = true;
      } else if (hit) {
        firedRef.current.target = true;
        notify(
          `🎯 ${quote.symbol} టార్గెట్ చేరింది!`,
          `ప్రస్తుత ధర ${fmt(price, quote.currency)} — మీ టార్గెట్ ${fmt(t, quote.currency)} చేరుకుంది. లాభం బుక్ చేసుకోవడం గురించి ఆలోచించండి.`,
        );
      }
    }
    if (s && !firedRef.current.stop) {
      const hit = up ? price <= s : price >= s;
      if (hit && !armedRef.current) {
        firedRef.current.stop = true;
      } else if (hit) {
        firedRef.current.stop = true;
        notify(
          `⚠️ ${quote.symbol} స్టాప్ లాస్ తాకింది!`,
          `ప్రస్తుత ధర ${fmt(price, quote.currency)} — మీ స్టాప్ లాస్ ${fmt(s, quote.currency)} దాటింది. రిస్క్ తగ్గించుకోండి.`,
        );
      }
    }
    armedRef.current = true;
  }, [quote, alertsOn, target, stop, entry]);

  const enableAlerts = async (on: boolean) => {
    setAlertsOn(on);
    if (on && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  const progress = (() => {
    const t = Number(target);
    if (!quote || !entry || !t || t === entry) return null;
    const pct = ((quote.price - entry) / (t - entry)) * 100;
    return Math.max(0, Math.min(100, pct));
  })();

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Activity className="size-5 text-primary" /> లైవ్ ధర
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {query.isFetching ? "అప్‌డేట్ అవుతోంది..." : "ప్రతి 15 సెకన్లకు అప్‌డేట్"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {query.error.message}
          </p>
        )}

        {quote && (
          <>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{quote.resolved}</div>
                <div className="text-3xl font-bold">{fmt(quote.price, quote.currency)}</div>
              </div>
              {quote.changePercent != null && (
                <div
                  className={
                    quote.changePercent >= 0 ? "text-[var(--bull)]" : "text-[var(--bear)]"
                  }
                >
                  {quote.changePercent >= 0 ? "▲" : "▼"} {Math.abs(quote.changePercent).toFixed(2)}%
                </div>
              )}
            </div>

            {progress != null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>ఎంట్రీ {entry ? fmt(entry, quote.currency) : "-"}</span>
                  <span>టార్గెట్ {fmt(Number(target), quote.currency)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="text-xs text-muted-foreground">
                  టార్గెట్ వైపు {progress.toFixed(0)}% ప్రయాణం పూర్తయింది
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary p-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            {alertsOn ? <BellRing className="size-4 text-accent" /> : <Bell className="size-4" />}
            ధర అలర్ట్‌లు
          </span>
          <Switch checked={alertsOn} onCheckedChange={enableAlerts} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="alert-target" className="flex items-center gap-2">
              <Target className="size-4 text-[var(--bull)]" /> టార్గెట్ ధర
            </Label>
            <Input
              id="alert-target"
              inputMode="decimal"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                firedRef.current.target = false;
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alert-stop" className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-[var(--bear)]" /> స్టాప్ లాస్ ధర
            </Label>
            <Input
              id="alert-stop"
              inputMode="decimal"
              value={stop}
              onChange={(e) => {
                setStop(e.target.value);
                firedRef.current.stop = false;
              }}
            />
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
          ఇప్పుడే రిఫ్రెష్ చేయండి
        </Button>
      </CardContent>
    </Card>
  );
}
