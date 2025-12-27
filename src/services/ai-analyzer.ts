import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { CONFIG, getEnvVar } from "../lib/config";
import type {
  MarketData,
  TechnicalIndicators,
  TradingSignal,
  TrendAnalysis,
} from "../types/trading";
import type { ICTAnalysis } from "../types/ict";

// --- 1. DEFINISI SCHEMA ZOD (Validation Layer) ---

// Schema untuk Analisa Teknikal Standar
const StandardAnalysisSchema = z.object({
  signal: z.enum(["BUY", "SELL", "NO_SIGNAL"]).describe("The trading decision"),
  confidence: z.number().min(0).max(100).describe("Confidence score 0-100%"),
  signalReasoning: z.string().describe("Explanation for the signal decision"),
  trend: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
  trendStrength: z.enum(["STRONG", "MODERATE", "WEAK"]),
  trendDescription: z.string().describe("Context about the trend"),
  supportLevel: z.number().describe("Nearest key support price"),
  resistanceLevel: z.number().describe("Nearest key resistance price"),
  levelReasoning: z.string().describe("Why these levels matter"),
  riskConsiderations: z.string().describe("Risk factors to watch"),
  marketSummary: z.string().describe("Brief market overview"),
});

// Schema untuk Analisa ICT (Lebih kompleks)
const ICTAnalysisSchema = z.object({
  signal: z.enum(["BUY", "SELL", "NO_SIGNAL"]),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  ictSpecific: z
    .string()
    .describe("Specific ICT context e.g. 'OB Retest + FVG'"),
  setup: z.object({
    primary: z.string().describe("Main setup driver e.g. 'Bearish Breaker'"),
    confirmations: z.array(z.string()).describe("List of supporting factors"),
    invalidations: z
      .array(z.string())
      .describe("Factors that invalidate setup"),
  }),
  trend: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]),
  trendStrength: z.enum(["STRONG", "MODERATE", "WEAK"]),
  trendDescription: z.string(),
  supportLevel: z.number(),
  resistanceLevel: z.number(),
  levelReasoning: z.string(),
  riskConsiderations: z.string(),
  marketSummary: z.string(),
});

// --- 2. SERVICE CLASS ---

export class AIAnalyzerService {
  private openRouter: any = null;
  private model: any = null;

  private getModel() {
    if (!this.openRouter) {
      const apiKey = getEnvVar("OPENROUTER_API_KEY");
      if (!apiKey) {
        throw new Error(
          "OPENROUTER_API_KEY is not set in environment variables",
        );
      }

      this.openRouter = createOpenRouter({
        apiKey,
      });
    }

    if (!this.model) {
      this.model = this.openRouter(CONFIG.ai.model);
    }

    return this.model;
  }

  // Helper: Membuat string konteks data untuk prompt (Standard)
  private buildMarketContext(
    marketData: MarketData,
    indicators: TechnicalIndicators,
  ): string {
    const { symbol, timeframe, currentPrice, priceChangePercent, candles } =
      marketData;
    const { rsi, ema, macd } = indicators;

    const recentCandles = candles
      .slice(-5)
      .map(
        (c, i) =>
          `Candle ${i + 1}: O=${c.open}, H=${c.high}, L=${c.low}, C=${c.close}`,
      )
      .join("\n");

    return `
      MARKET CONTEXT:
      Symbol: ${symbol} (${timeframe})
      Price: ${currentPrice} (${priceChangePercent}%)

      INDICATORS:
      RSI: ${rsi.toFixed(2)}
      EMA: 9(${ema.ema9.toFixed(2)}) / 21(${ema.ema21.toFixed(2)}) / 50(${ema.ema50.toFixed(2)})
      MACD: Hist ${macd.histogram.toFixed(2)}, Line ${macd.macdLine.toFixed(2)}

      RECENT PRICE ACTION:
      ${recentCandles}
    `;
  }

  // Helper: Membuat string konteks data untuk prompt (ICT)
  private buildICTContext(ictAnalysis: ICTAnalysis): string {
    const {
      fairValueGaps,
      orderBlocks,
      liquidity,
      marketStructure,
      timeAnalysis,
      confluence,
    } = ictAnalysis;

    // Filter data aktif saja agar prompt ringkas
    const activeFVGs = fairValueGaps.filter((f) => !f.filled).slice(0, 3);
    const activeOBs = orderBlocks.filter((ob) => ob.active).slice(0, 3);

    return `
      ICT STRUCTURE CONTEXT:
      - Structure: ${marketStructure.trend} (${marketStructure.currentStructure.phase})
      - Kill Zone: ${timeAnalysis.killZone.active ? "ACTIVE" : "INACTIVE"} (${timeAnalysis.session})
      - Confluence Score: Bull ${confluence.bullishScore} / Bear ${confluence.bearishScore}

      KEY ARRAYS:
      - FVGs: ${activeFVGs.map((f) => `${f.type} @ ${f.mid}`).join(", ") || "None"}
      - Order Blocks: ${activeOBs.map((ob) => `${ob.type} @ ${ob.close}`).join(", ") || "None"}
      - Liquidity: Swept Buy(${liquidity.totalBuySideSwept}) / Sell(${liquidity.totalSellSideSwept})
    `;
  }

  // --- METHOD 1: ANALISA STANDAR ---
  async analyzeMarket(
    marketData: MarketData,
    indicators: TechnicalIndicators,
  ): Promise<{
    signal: TradingSignal;
    trend: TrendAnalysis;
    supportResistance: {
      supportLevel: number;
      resistanceLevel: number;
      reasoning: string;
    };
    riskConsiderations: string;
    marketSummary: string;
  }> {
    try {
      // Panggil AI dengan generateObject + structured output
      const { object } = await generateObject({
        model: this.getModel(),
        schema: StandardAnalysisSchema,
        system: `You are an expert Crypto Futures Trader.
                 Analyze the provided data.
                 Prioritize Trend Following.
                 Only signal BUY/SELL if confidence is >70% with strong confluence.
                 Otherwise signal NO_SIGNAL.`,
        prompt: `Analyze this market data:\n${this.buildMarketContext(marketData, indicators)}`,
      });

      // Validasi Confidence (Risk Management Layer)
      const minConfidence = CONFIG.ai.minConfidenceForSignal;
      let finalSignal = object.signal;
      let finalReasoning = object.signalReasoning;

      if (finalSignal !== "NO_SIGNAL" && object.confidence < minConfidence) {
        finalSignal = "NO_SIGNAL";
        finalReasoning = `[AUTO-DOWNGRADE] AI Confidence (${object.confidence}%) is below threshold (${minConfidence}%). Reasoning: ${finalReasoning}`;
      }

      // Mapping hasil object Zod ke return type aplikasi
      return {
        signal: {
          signal: finalSignal,
          confidence: object.confidence,
          reasoning: finalReasoning,
        },
        trend: {
          trend: object.trend,
          strength: object.trendStrength,
          description: object.trendDescription,
        },
        supportResistance: {
          supportLevel: object.supportLevel,
          resistanceLevel: object.resistanceLevel,
          reasoning: object.levelReasoning,
        },
        riskConsiderations: object.riskConsiderations,
        marketSummary: object.marketSummary,
      };
    } catch (error) {
      throw new Error(
        `Standard AI analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // --- METHOD 2: ANALISA ICT ---
  async analyzeICTMarket(
    marketData: MarketData,
    indicators: TechnicalIndicators,
    ictAnalysis: ICTAnalysis,
  ): Promise<{
    signal: TradingSignal;
    trend: TrendAnalysis;
    supportResistance: {
      supportLevel: number;
      resistanceLevel: number;
      reasoning: string;
    };
    riskConsiderations: string;
    marketSummary: string;
    ictSpecific: string;
    setup: {
      primary: string;
      confirmations: string[];
      invalidations: string[];
    };
  }> {
    try {
      const marketCtx = this.buildMarketContext(marketData, indicators);
      const ictCtx = this.buildICTContext(ictAnalysis);

      const { object } = await generateObject({
        model: this.getModel(),
        schema: ICTAnalysisSchema,
        system: `You are an ICT (Inner Circle Trader) Specialist.
                 Weight ICT concepts (FVG, Order Blocks, Liquidity) as 80% of your decision.
                 Use Traditional indicators only as secondary confirmation.

                 RULES:
                 1. BUY ONLY if: Bullish OB retest OR Bullish FVG Fill + Liquidity Sweep.
                 2. SELL ONLY if: Bearish OB retest OR Bearish FVG Fill + Liquidity Sweep.
                 3. If structure is unclear or outside Kill Zones, signal NO_SIGNAL.`,
        prompt: `Analyze this market setup:\n${marketCtx}\n\n${ictCtx}`,
      });

      // Validasi Confidence
      const minConfidence = CONFIG.ai.minConfidenceForSignal;
      let finalSignal = object.signal;
      let finalReasoning = object.reasoning;

      if (finalSignal !== "NO_SIGNAL" && object.confidence < minConfidence) {
        finalSignal = "NO_SIGNAL";
        finalReasoning = `[AUTO-DOWNGRADE] Confidence (${object.confidence}%) below threshold. ${finalReasoning}`;
      }

      return {
        signal: {
          signal: finalSignal,
          confidence: object.confidence,
          reasoning: finalReasoning,
        },
        trend: {
          trend: object.trend,
          strength: object.trendStrength,
          description: object.trendDescription,
        },
        supportResistance: {
          supportLevel: object.supportLevel,
          resistanceLevel: object.resistanceLevel,
          reasoning: object.levelReasoning,
        },
        riskConsiderations: object.riskConsiderations,
        marketSummary: object.marketSummary,
        ictSpecific: object.ictSpecific, // Data khusus ICT
        setup: object.setup, // Setup ICT
      };
    } catch (error) {
      throw new Error(
        `ICT AI analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // --- METHOD 3: TEST LLM PROMPT ---
  async testLLM(prompt: string): Promise<string> {
    try {
      const { text } = await generateText({
        model: this.getModel(),
        prompt,
      });
      return text;
    } catch (error) {
      throw new Error(
        `LLM test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export const aiAnalyzerService = new AIAnalyzerService();
