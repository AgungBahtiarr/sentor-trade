import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";
import { CONFIG, FRACTAL_SYSTEM_PROMPT } from "../lib/config";
import { logger } from "../lib/logger";
import { cacheService } from "../services/cache";
import type {
  MarketData,
  TechnicalIndicators,
  TradingSignal,
} from "../types/trading";
import type { FractalData } from "./fractal";

const FractalAnalysisSchema = z.object({
  signal: z
    .enum(["BUY", "SELL", "NO_SIGNAL"])
    .describe("The trading decision based on TTrades logic"),
  confidence: z.number().min(0).max(100).describe("Confidence score 0-100%"),
  riskLevel: z
    .enum(["LOW", "MEDIUM", "HIGH"])
    .describe("Risk level: LOW (aligned with bias), MEDIUM (aligned with minor concerns), HIGH (contra-bias or major concerns)"),
  signalReasoning: z.string().describe("Detailed explanation for the decision"),
  biasAnalysis: z
    .string()
    .describe("Interpretation of the provided Daily Bias and HTF context"),
  poiIdentified: z
    .string()
    .describe(
      "Specific Point of Interest (FVG/OrderBlock) price is reacting to",
    ),
  structureValidation: z
    .string()
    .describe("Validation of structure (Sweep + Displacement)"),
  setupConfirmation: z
    .string()
    .describe("Confirmation of Continuation Order Block setup"),
  setupPhase: z
    .enum([
      "WAITING_FOR_SWEEP",
      "WAITING_FOR_CLOSE",
      "READY_TO_ENTER",
      "INVALID",
    ])
    .describe("Current precise phase of the setup"),
  entryZone: z
    .number()
    .nullable()
    .describe("Recommended entry price (null if NO_SIGNAL)"),
  stopLoss: z
    .number()
    .nullable()
    .describe("Stop loss price level (null if NO_SIGNAL)"),
  takeProfit: z
    .number()
    .nullable()
    .describe("Take profit price level (null if NO_SIGNAL)"),
  riskConsiderations: z
    .string()
    .describe("Risk factors (e.g., news, low volume, weak displacement, contra-bias)"),
  marketSummary: z.string().describe("Brief market overview"),
});

type FractalSchemaOutput = z.infer<typeof FractalAnalysisSchema>;

type FractalAnalysisResult = {
  signal: TradingSignal;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  biasAnalysis: string;
  poiIdentified: string;
  structureValidation: string;
  setupConfirmation: string;
  setupPhase:
    | "WAITING_FOR_SWEEP"
    | "WAITING_FOR_CLOSE"
    | "READY_TO_ENTER"
    | "INVALID";
  entryZone: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskConsiderations: string;
  marketSummary: string;
};

interface OpenRouterModel {
  name: string;
}

export class AIAnalyzerService {
  private static instance: AIAnalyzerService;
  private modelInstance: OpenRouterModel | null = null;
  private contextCache: Map<string, string> = new Map();

  private constructor() {
    this.validateConfig();
  }

  public static getInstance(): AIAnalyzerService {
    if (!AIAnalyzerService.instance) {
      AIAnalyzerService.instance = new AIAnalyzerService();
    }
    return AIAnalyzerService.instance;
  }

  private validateConfig(): void {
    if (!CONFIG.ai?.model) {
      throw new Error("AI model not configured in CONFIG");
    }
    if (typeof CONFIG.ai?.minConfidenceForSignal !== "number") {
      throw new Error("minConfidenceForSignal not set in CONFIG");
    }
  }

  private getModel(): OpenRouterModel {
    if (!this.modelInstance) {
      const apiKey = process.env.OPENROUTER_API_KEY;
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

  private generateCacheKey(
    symbol: string,
    timeframe: string,
    currentPrice: number,
  ): string {
    return `ai:${symbol}:${timeframe}:${currentPrice.toFixed(4)}`;
  }

  private adjustRiskForBiasAlignment(
    result: FractalAnalysisResult,
    fractalData: FractalData,
  ): FractalAnalysisResult {
    const { signal } = result.signal;
    const { dailyBias } = fractalData;

    if (signal === "NO_SIGNAL") {
      return result;
    }

    const isBullishBias = dailyBias.type.includes("BULLISH");
    const isBearishBias = dailyBias.type.includes("BEARISH");

    let adjustedRiskLevel = result.riskLevel;

    if (signal === "BUY" && isBearishBias) {
      adjustedRiskLevel = "HIGH";
      result.riskConsiderations = `[CONTRA-BIAS] Buy signal against Bearish bias. ${result.riskConsiderations}`;
    } else if (signal === "SELL" && isBullishBias) {
      adjustedRiskLevel = "HIGH";
      result.riskConsiderations = `[CONTRA-BIAS] Sell signal against Bullish bias. ${result.riskConsiderations}`;
    }

    result.riskLevel = adjustedRiskLevel;
    return result;
  }

  private async analyzeWithSchema<T extends { signal: string; confidence: number }>(
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

    const minConfidence = CONFIG.ai.minConfidenceForSignal;
    if (output.signal !== "NO_SIGNAL" && output.confidence < minConfidence) {
      logger.debug("Auto-downgrading signal due to low confidence", {
        originalSignal: output.signal,
        confidence: output.confidence,
        threshold: minConfidence,
      });

      const outputWithReasoning = output as { signalReasoning?: string };
      const originalReasoning = outputWithReasoning.signalReasoning || "";

      const downgradedOutput: any = {
        ...output,
        signal: "NO_SIGNAL" as const,
        signalReasoning: `[AUTO-DOWNGRADE] Confidence (${output.confidence}%) below threshold (${minConfidence}%). Original: ${originalReasoning}`,
        entryZone: null,
        stopLoss: null,
        takeProfit: null,
      };

      return downgradedOutput as T;
    }

    return output;
  }

  private buildFractalContext(
    marketData: MarketData,
    fractalData: FractalData,
    indicators: TechnicalIndicators,
  ): string {
    const { symbol, timeframe, currentPrice, candles } = marketData;
    const { dailyBias, swingPoints, pois, cisds } = fractalData;

    const cacheKey = `${symbol}:${timeframe}:${currentPrice.toFixed(4)}`;
    if (this.contextCache.has(cacheKey)) {
      return this.contextCache.get(cacheKey)!;
    }

    const recentCandles = candles.slice(-CONFIG.ai.contextCandles);
    const recentPOIs = pois.slice(0, CONFIG.ai.poiLimit);
    const recentCISDs = cisds.slice(-CONFIG.ai.cisdLimit);

    const indicatorsStr = Object.entries(indicators)
      .map(
        ([key, value]) =>
          `- ${key}: ${typeof value === "number" ? value.toFixed(4) : JSON.stringify(value)}`,
      )
      .join("\n");

    const context = [
      "=== FRACTAL MARKET CONTEXT ===",
      `Symbol: ${symbol} (${timeframe})`,
      `Current Price: ${currentPrice}`,
      `Time: ${new Date().toISOString()}`,
      "",
      "--- 1. DAILY BIAS ---",
      `Type: ${dailyBias.type}`,
      `Reason: ${dailyBias.description}`,
      `Prev Day Range: H=${dailyBias.previousDay.high}, L=${dailyBias.previousDay.low}`,
      "",
      "--- 2. POINTS OF INTEREST ---",
      ...recentPOIs.map(
        (poi) =>
          `- ${poi.type} at ${poi.price.toFixed(4)} (Strength: ${poi.strength})`,
      ),
      "",
      "--- 3. SWING POINTS ---",
      ...swingPoints
        .slice(-5)
        .map((sp) => `- ${sp.type} at ${sp.price.toFixed(4)}`),
      "",
      "--- 4. PRICE ACTION ---",
      ...recentCandles.map(
        (c, i) =>
          `C${i + 1}: O=${c.open}, H=${c.high}, L=${c.low}, C=${c.close} ${c.close > c.open ? "(Bull)" : "(Bear)"}`,
      ),
      "",
      "--- 5. INDICATORS ---",
      indicatorsStr || "No indicators",
    ].join("\n");

    this.contextCache.set(cacheKey, context);
    return context;
  }

  async analyzeFractalMarket(
    marketData: MarketData,
    indicators: TechnicalIndicators,
    fractalData: FractalData,
  ): Promise<FractalAnalysisResult> {
    try {
      const cacheKey = this.generateCacheKey(
        marketData.symbol,
        marketData.timeframe,
        marketData.currentPrice,
      );

      const cachedResult = cacheService.get<FractalAnalysisResult>(cacheKey);
      if (cachedResult) {
        logger.debug("Using cached AI analysis", { symbol: marketData.symbol });
        return cachedResult;
      }

      const userPrompt = `Analyze this market data:\n\n${this.buildFractalContext(
        marketData,
        fractalData,
        indicators,
      )}\n\nProvide analysis in JSON format.`;

      const output = await this.analyzeWithSchema<FractalSchemaOutput>(
        FractalAnalysisSchema,
        FRACTAL_SYSTEM_PROMPT,
        userPrompt,
      );

      const result: FractalAnalysisResult = {
        signal: {
          signal: output.signal,
          confidence: output.confidence,
          reasoning: output.signalReasoning,
        },
        riskLevel: output.riskLevel,
        biasAnalysis: output.biasAnalysis,
        poiIdentified: output.poiIdentified,
        structureValidation: output.structureValidation,
        setupConfirmation: output.setupConfirmation,
        setupPhase: output.setupPhase,
        entryZone: output.entryZone,
        stopLoss: output.stopLoss,
        takeProfit: output.takeProfit,
        riskConsiderations: output.riskConsiderations,
        marketSummary: output.marketSummary,
      };

      const adjustedResult = this.adjustRiskForBiasAlignment(result, fractalData);

      cacheService.set(cacheKey, adjustedResult, CONFIG.cache.llmResponseTTL);
      logger.info("AI analysis completed", {
        symbol: marketData.symbol,
        signal: output.signal,
        riskLevel: adjustedResult.riskLevel,
        phase: output.setupPhase,
      });

      return adjustedResult;
    } catch (error) {
      logger.error("AI analysis failed", {
        symbol: marketData.symbol,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  }

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

export const aiAnalyzerService = AIAnalyzerService.getInstance();
