import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";
import { CONFIG, getEnvVar } from "../lib/config";
import type {
  MarketData,
  TechnicalIndicators,
  TradingSignal,
  TrendAnalysis,
} from "../types/trading";
import type { ICTAnalysis } from "../types/ict";

// ==================== SCHEMAS ====================
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

// ==================== TYPES ====================
type AnalysisResult = {
  signal: TradingSignal;
  trend: TrendAnalysis;
  supportResistance: {
    supportLevel: number;
    resistanceLevel: number;
    reasoning: string;
  };
  riskConsiderations: string;
  marketSummary: string;
};

type ICTAnalysisResult = AnalysisResult & {
  ictSpecific: string;
  setup: {
    primary: string;
    confirmations: string[];
    invalidations: string[];
  };
};

type StandardSchemaOutput = z.infer<typeof StandardAnalysisSchema>;
type ICTSchemaOutput = z.infer<typeof ICTAnalysisSchema>;

// ==================== SERVICE ====================
export class AIAnalyzerService {
  private static instance: AIAnalyzerService;
  private modelInstance: any = null;

  private constructor() {
    this.validateConfig();
  }

  // Singleton pattern
  public static getInstance(): AIAnalyzerService {
    if (!AIAnalyzerService.instance) {
      AIAnalyzerService.instance = new AIAnalyzerService();
    }
    return AIAnalyzerService.instance;
  }

  // Config validation
  private validateConfig(): void {
    if (!CONFIG.ai?.model) {
      throw new Error("AI model not configured in CONFIG");
    }
    if (typeof CONFIG.ai?.minConfidenceForSignal !== "number") {
      throw new Error("minConfidenceForSignal not set in CONFIG");
    }
  }

  // Model initialization with caching
  private getModel() {
    if (!this.modelInstance) {
      const apiKey = getEnvVar("OPENROUTER_API_KEY");
      if (!apiKey) {
        throw new Error(
          "OPENROUTER_API_KEY is not set in environment variables",
        );
      }

      const openRouter = createOpenRouter({ apiKey });
      this.modelInstance = openRouter(CONFIG.ai.model);
    }
    return this.modelInstance;
  }

  // ==================== CONTEXT BUILDERS ====================
  private buildMarketContext(
    marketData: MarketData,
    indicators: TechnicalIndicators,
  ): string {
    const { symbol, timeframe, currentPrice, priceChangePercent, candles } =
      marketData;
    const { rsi, ema, macd } = indicators;

    const recentCandles = candles.slice(-5);

    return [
      "MARKET CONTEXT:",
      `Symbol: ${symbol} (${timeframe})`,
      `Price: ${currentPrice} (${priceChangePercent}%)`,
      "",
      "INDICATORS:",
      `RSI: ${rsi.toFixed(2)}`,
      `EMA: 9(${ema.ema9.toFixed(2)}) / 21(${ema.ema21.toFixed(2)}) / 50(${ema.ema50.toFixed(2)})`,
      `MACD: Hist ${macd.histogram.toFixed(2)}, Line ${macd.macdLine.toFixed(2)}`,
      "",
      "RECENT PRICE ACTION:",
      ...recentCandles.map(
        (c, i) =>
          `Candle ${i + 1}: O=${c.open}, H=${c.high}, L=${c.low}, C=${c.close}`,
      ),
    ].join("\n");
  }

  private buildICTContext(ictAnalysis: ICTAnalysis): string {
    const {
      fairValueGaps,
      orderBlocks,
      liquidity,
      marketStructure,
      timeAnalysis,
      confluence,
    } = ictAnalysis;

    const activeFVGs = fairValueGaps.filter((f) => !f.filled).slice(0, 3);
    const activeOBs = orderBlocks.filter((ob) => ob.active).slice(0, 3);

    return [
      "ICT STRUCTURE CONTEXT:",
      `- Structure: ${marketStructure.trend} (${marketStructure.currentStructure.phase})`,
      `- Kill Zone: ${timeAnalysis.killZone.active ? "ACTIVE" : "INACTIVE"} (${timeAnalysis.session})`,
      `- Confluence Score: Bull ${confluence.bullishScore} / Bear ${confluence.bearishScore}`,
      "",
      "KEY ARRAYS:",
      `- FVGs: ${activeFVGs.map((f) => `${f.type} @ ${f.mid}`).join(", ") || "None"}`,
      `- Order Blocks: ${activeOBs.map((ob) => `${ob.type} @ ${ob.close}`).join(", ") || "None"}`,
      `- Liquidity: Swept Buy(${liquidity.totalBuySideSwept}) / Sell(${liquidity.totalSellSideSwept})`,
    ].join("\n");
  }

  // ==================== SHARED ANALYSIS METHOD ====================
  private async analyzeWithSchema<
    T extends { signal: string; confidence: number },
  >(
    schema: z.ZodSchema<T>,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<T> {
    const { output } = await generateText({
      model: this.getModel(),
      output: Output.object({ schema }),
      system: systemPrompt,
      prompt: userPrompt,
    });

    // Auto-downgrade logic for low confidence
    const minConfidence = CONFIG.ai.minConfidenceForSignal;
    if (output.signal !== "NO_SIGNAL" && output.confidence < minConfidence) {
      const reasoningKey =
        "reasoning" in output ? "reasoning" : "signalReasoning";
      const originalReasoning = (output as any)[reasoningKey] || "";

      return {
        ...output,
        signal: "NO_SIGNAL" as any,
        [reasoningKey]: `[AUTO-DOWNGRADE] Confidence (${output.confidence}%) below threshold (${minConfidence}%). Original: ${originalReasoning}`,
      };
    }

    return output;
  }

  // ==================== FALLBACK GENERATOR ====================
  private createFallbackResult(
    marketData: MarketData,
    errorMessage: string,
  ): AnalysisResult {
    return {
      signal: {
        signal: "NO_SIGNAL",
        confidence: 0,
        reasoning: `Analysis failed: ${errorMessage}`,
      },
      trend: {
        trend: "NEUTRAL",
        strength: "WEAK",
        description: "Error occurred during analysis",
      },
      supportResistance: {
        supportLevel: marketData.currentPrice * 0.95,
        resistanceLevel: marketData.currentPrice * 1.05,
        reasoning: "Fallback levels due to analysis error",
      },
      riskConsiderations: "⚠️ System error - avoid trading until resolved",
      marketSummary: `Analysis Error: ${errorMessage}`,
    };
  }

  // ==================== STANDARD ANALYSIS ====================
  async analyzeMarket(
    marketData: MarketData,
    indicators: TechnicalIndicators,
  ): Promise<AnalysisResult> {
    try {
      const systemPrompt = `You are an elite Crypto Futures Trader with 10+ years experience. Your analysis must be PRECISE and ACTIONABLE.

**DECISION FRAMEWORK:**
1. **TREND FIRST** - Never trade against the dominant trend
   - Bullish: Price above EMA50 + Rising EMA9/21 + RSI > 50
   - Bearish: Price below EMA50 + Falling EMA9/21 + RSI < 50
   - Neutral: Mixed signals or choppy price action

2. **ENTRY CRITERIA** (ALL must align for BUY/SELL):
   ✅ BUY Requirements:
      - Bullish trend confirmed
      - RSI: 30-70 (avoid overbought)
      - MACD: Positive histogram + bullish crossover
      - Price: Near support or breaking resistance with volume
      - Recent candles: Higher lows pattern
      - Confidence: Must be >75%

   ✅ SELL Requirements:
      - Bearish trend confirmed
      - RSI: 30-70 (avoid oversold)
      - MACD: Negative histogram + bearish crossover
      - Price: Near resistance or breaking support with volume
      - Recent candles: Lower highs pattern
      - Confidence: Must be >75%

3. **NO_SIGNAL Triggers** (Safety first):
   - Conflicting indicators (e.g., bullish trend but bearish MACD)
   - RSI in extreme zones (<30 or >70)
   - Choppy/sideways price action
   - Low confidence (<75%)
   - Major S/R zone nearby without clear breakout

**SUPPORT/RESISTANCE RULES:**
- Support: Recent swing lows, EMA50, psychological levels
- Resistance: Recent swing highs, previous breakout points
- Must be within 5% of current price to be relevant

**OUTPUT QUALITY:**
- Be specific with numbers and levels
- Explain WHY, not just WHAT
- Always consider risk-reward ratio
- Default to NO_SIGNAL when uncertain`;

      const userPrompt = `Analyze this market data:\n${this.buildMarketContext(marketData, indicators)}

**YOUR TASK:**
1. Identify the current trend and strength
2. Check if ALL entry criteria align for BUY/SELL
3. Calculate precise support/resistance levels
4. Assess risk factors
5. Provide actionable signal with detailed reasoning`;

      const output = await this.analyzeWithSchema<StandardSchemaOutput>(
        StandardAnalysisSchema,
        systemPrompt,
        userPrompt,
      );

      return {
        signal: {
          signal: output.signal,
          confidence: output.confidence,
          reasoning: output.signalReasoning,
        },
        trend: {
          trend: output.trend,
          strength: output.trendStrength,
          description: output.trendDescription,
        },
        supportResistance: {
          supportLevel: output.supportLevel,
          resistanceLevel: output.resistanceLevel,
          reasoning: output.levelReasoning,
        },
        riskConsiderations: output.riskConsiderations,
        marketSummary: output.marketSummary,
      };
    } catch (error) {
      console.error("❌ Standard AI analysis error:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return this.createFallbackResult(marketData, errorMsg);
    }
  }

  // ==================== ICT ANALYSIS ====================
  async analyzeICTMarket(
    marketData: MarketData,
    indicators: TechnicalIndicators,
    ictAnalysis: ICTAnalysis,
  ): Promise<ICTAnalysisResult> {
    try {
      const marketCtx = this.buildMarketContext(marketData, indicators);
      const ictCtx = this.buildICTContext(ictAnalysis);

      const systemPrompt = `You are a MASTER ICT (Inner Circle Trader) Specialist following Michael Huddleston's methodology.

**ICT CORE PRINCIPLES (80% weight):**

1. **MARKET STRUCTURE ANALYSIS**
   - Bullish: Series of Higher Highs (HH) + Higher Lows (HL)
   - Bearish: Series of Lower Highs (LH) + Lower Lows (LL)
   - Only trade WITH structure, never against it

2. **ORDER BLOCKS (Primary Setup)**
   ✅ BULLISH Entry:
      - Price returns to BULLISH Order Block (last down candle before rally)
      - OB must be ACTIVE (not violated)
      - Confluence: Near FVG or liquidity sweep
      - Entry: OB retest with rejection wick

   ✅ BEARISH Entry:
      - Price returns to BEARISH Order Block (last up candle before drop)
      - OB must be ACTIVE (not violated)
      - Confluence: Near FVG or liquidity sweep
      - Entry: OB retest with rejection wick

3. **FAIR VALUE GAPS (FVG) - Premium Setups**
   - FVG = Imbalance/gap in 3-candle sequence
   - BULLISH: Enter when price fills bearish FVG (buy the discount)
   - BEARISH: Enter when price fills bullish FVG (sell the premium)
   - Only trade UNFILLED gaps - ignore filled ones

4. **LIQUIDITY CONCEPTS**
   - Smart Money HUNTS liquidity before reversal
   - Bullish Setup: Look for sell-side liquidity sweep (stop hunt below lows) → then buy
   - Bearish Setup: Look for buy-side liquidity sweep (stop hunt above highs) → then sell
   - Recent sweeps are CRITICAL confirmation

5. **KILL ZONES (Timing)**
   🟢 LONDON: 2-5 AM EST (High probability setups)
   🟢 NEW YORK: 8-11 AM EST (Highest volume, best entries)
   🔴 AVOID: Asian session unless VERY strong setup
   - If NOT in kill zone → Reduce confidence by 20-30%

6. **CONFLUENCE SCORING (Must have 3+ for signal)**
   - Order Block retest (Primary)
   - FVG fill (Primary)
   - Liquidity sweep (High value)
   - Market structure alignment
   - Kill zone active
   - Traditional indicators support

**TRADITIONAL INDICATORS (20% weight - Confirmation only):**
- RSI: Just for overbought/oversold context
- EMA: Trend filter only
- MACD: Secondary confirmation

**ENTRY REQUIREMENTS:**
✅ BUY Signal:
   1. Market structure: BULLISH (HH + HL pattern)
   2. One of: Bullish OB retest OR Bearish FVG fill
   3. Liquidity: Recent sell-side sweep preferred
   4. Confluence score: BULLISH > 3
   5. Kill zone: Active (or very strong setup if not)
   6. Confidence: >70%

✅ SELL Signal:
   1. Market structure: BEARISH (LH + LL pattern)
   2. One of: Bearish OB retest OR Bullish FVG fill
   3. Liquidity: Recent buy-side sweep preferred
   4. Confluence score: BEARISH > 3
   5. Kill zone: Active (or very strong setup if not)
   6. Confidence: >70%

🚫 NO_SIGNAL when:
   - Market structure unclear/choppy
   - No valid OB or FVG setup
   - Outside kill zones with weak confluence
   - Conflicting ICT signals
   - Confidence <70%

**INVALIDATIONS (Setup is VOID if):**
- Order Block violated (price closes through it)
- FVG already filled completely
- Market structure breaks (trend reversal)
- Stop loss level breached

**OUTPUT REQUIREMENTS:**
- Specify exact ICT concepts triggering signal
- Name the primary setup (e.g., "Bearish Breaker + FVG Confluence")
- List 3+ confirmations
- Define clear invalidation levels`;

      const userPrompt = `Perform deep ICT analysis on this market:\n${marketCtx}\n\n${ictCtx}

**YOUR ANALYSIS STEPS:**
1. Determine market structure (HH/HL or LH/LL)
2. Identify active Order Blocks and unfilled FVGs
3. Check for recent liquidity sweeps
4. Assess kill zone timing
5. Calculate confluence score (bullish vs bearish)
6. Validate ALL entry requirements
7. Define setup invalidations
8. Provide actionable signal with ICT-specific reasoning`;

      const output = await this.analyzeWithSchema<ICTSchemaOutput>(
        ICTAnalysisSchema,
        systemPrompt,
        userPrompt,
      );

      return {
        signal: {
          signal: output.signal,
          confidence: output.confidence,
          reasoning: output.reasoning,
        },
        trend: {
          trend: output.trend,
          strength: output.trendStrength,
          description: output.trendDescription,
        },
        supportResistance: {
          supportLevel: output.supportLevel,
          resistanceLevel: output.resistanceLevel,
          reasoning: output.levelReasoning,
        },
        riskConsiderations: output.riskConsiderations,
        marketSummary: output.marketSummary,
        ictSpecific: output.ictSpecific,
        setup: output.setup,
      };
    } catch (error) {
      console.error("❌ ICT AI analysis error:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      const fallback = this.createFallbackResult(marketData, errorMsg);

      return {
        ...fallback,
        ictSpecific: "Analysis failed",
        setup: {
          primary: "Error",
          confirmations: [],
          invalidations: ["System error occurred"],
        },
      };
    }
  }

  // ==================== PARALLEL ANALYSIS ====================
  async analyzeMarketBoth(
    marketData: MarketData,
    indicators: TechnicalIndicators,
    ictAnalysis: ICTAnalysis,
  ): Promise<{
    standard: AnalysisResult;
    ict: ICTAnalysisResult;
  }> {
    const [standard, ict] = await Promise.all([
      this.analyzeMarket(marketData, indicators),
      this.analyzeICTMarket(marketData, indicators, ictAnalysis),
    ]);

    return { standard, ict };
  }

  // ==================== LLM TEST ====================
  async testLLM(prompt: string): Promise<string> {
    try {
      const { text } = await generateText({
        model: this.getModel(),
        prompt,
      });
      return text;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`LLM test failed: ${errorMsg}`);
    }
  }
}

// Export singleton instance
export const aiAnalyzerService = AIAnalyzerService.getInstance();
