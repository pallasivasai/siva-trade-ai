import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AnalysisInput = z.object({
  symbol: z.string().min(1).max(40),
  timeframe: z.string().min(1).max(30),
  risk: z.string().min(1).max(30),
  capital: z.string().max(20).optional(),
});

export type AnalysisResult = {
  summary: string;
  bias: string;
  entry: string;
  target: string;
  stopLoss: string;
  confidence: number;
  reasons: string[];
  risks: string[];
};

export const analyzeTrade = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AnalysisInput.parse(input))
  .handler(async ({ data }): Promise<AnalysisResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");

    const gateway = createLovableAiGatewayProvider(key, { structuredOutputs: true });

    const schema = z.object({
      summary: z.string(),
      bias: z.string(),
      entry: z.string(),
      target: z.string(),
      stopLoss: z.string(),
      confidence: z.number(),
      reasons: z.array(z.string()),
      risks: z.array(z.string()),
    });

    const prompt = `నువ్వు అనుభవజ్ఞుడైన మార్కెట్ విశ్లేషకుడివి. కింది ట్రేడ్ ఐడియాను విశ్లేషించు.
సింబల్/స్టాక్: ${data.symbol}
టైమ్‌ఫ్రేమ్: ${data.timeframe}
రిస్క్ స్థాయి: ${data.risk}
పెట్టుబడి: ${data.capital || "చెప్పలేదు"}

అన్ని సమాధానాలు తెలుగులోనే ఇవ్వు (సంఖ్యలు ఆంగ్ల అంకెల్లో).
summary: 2-3 వాక్యాల సరళమైన వివరణ.
bias: "బుల్లిష్" / "బేరిష్" / "న్యూట్రల్" లో ఒకటి.
entry, target, stopLoss: సాధారణ స్థాయి సూచనలు (శాతం లేదా ధర పరిధిగా).
confidence: 0-100 మధ్య సంఖ్య.
reasons: 3-4 చిన్న పాయింట్లు.
risks: 2-3 చిన్న రిస్క్ పాయింట్లు.
ఇది విద్యా ప్రయోజనం కోసమే; లాభం గ్యారెంటీ ఇవ్వకు.`;

    try {
      const result = streamText({
        model: gateway("google/gemini-3.6-flash"),
        prompt,
        output: Output.object({ schema }),
      });
      // consume the stream so the output promise resolves
      for await (const _ of result.textStream) void _;
      const output = await result.output;
      return {
        ...output,
        confidence: Math.max(0, Math.min(100, Math.round(output.confidence))),
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("విశ్లేషణ రూపొందించలేకపోయాం. మళ్లీ ప్రయత్నించండి.");
      }
      const message = error instanceof Error ? error.message : "";
      if (message.includes("429")) throw new Error("చాలా రిక్వెస్టులు వచ్చాయి. కాసేపు ఆగి ప్రయత్నించండి.");
      if (message.includes("402")) throw new Error("AI క్రెడిట్లు అయిపోయాయి. దయచేసి రీఛార్జ్ చేయండి.");
      throw new Error("సర్వర్ లోపం. మళ్లీ ప్రయత్నించండి.");
    }
  });
