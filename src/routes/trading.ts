import { Hono } from "hono";
import { exchangeService } from "../services/exchange/exchange-provider";
import { indicatorsService } from "../services/indicators";
import { aiAnalyzerService } from "../services/ai-analyzer";
import { fractalService } from "../services/fractal";
import type { TradingAnalysis } from "../types/trading";

const tradingRouter = new Hono();

// ==================== HELPER FUNCTIONS ====================
function calculateRiskReward(
  entry: number,
  stopLoss: number,
  takeProfit: number,
): number {
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);

  if (risk === 0) return 0;
  return Number((reward / risk).toFixed(2));
}

// ==================== TIMEFRAME MAPPING ====================
const TIMEFRAME_MAPPING = {
  "1m": { structure: "5m", bias: "1h" },
  "3m": { structure: "15m", bias: "1h" },
  "5m": { structure: "15m", bias: "1h" },
  "15m": { structure: "1h", bias: "1d" },
  "30m": { structure: "4h", bias: "1d" },
  "1h": { structure: "4h", bias: "1d" },
  "4h": { structure: "1d", bias: "1w" },
  "1d": { structure: "1w", bias: "1M" },
} as const;

type TimeframeKey = keyof typeof TIMEFRAME_MAPPING;

// ==================== FRACTAL ANALYSIS ENDPOINT ====================
tradingRouter.get("/analyze", async (c) => {
  try {
    const symbol = c.req.query("symbol") || "BTCUSDT";
    let entryTimeframe = c.req.query("timeframe") || "5m";

    if (!(entryTimeframe in TIMEFRAME_MAPPING)) {
      console.warn(`⚠️ Unknown timeframe ${entryTimeframe}, defaulting to 15m`);
      entryTimeframe = "15m";
    }

    const mapping = TIMEFRAME_MAPPING[entryTimeframe as TimeframeKey];
    const structureTimeframe = mapping.structure;
    const biasTimeframe = mapping.bias;

    console.log("🔮 Fractal Analysis:", { symbol, entryTimeframe, structureTimeframe, biasTimeframe });

    const [
      biasMarketData,
      structureMarketData,
      entryMarketData,
    ] = await Promise.all([
      exchangeService.getMarketData(symbol, biasTimeframe),
      exchangeService.getMarketData(symbol, structureTimeframe),
      exchangeService.getMarketData(symbol, entryTimeframe),
    ]);

    const indicators = indicatorsService.calculateAllIndicators(entryMarketData.candles);

    const fractalData = fractalService.analyzeFractal(
      biasMarketData.candles,
      structureMarketData.candles,
      entryMarketData.candles,
    );

    const aiAnalysis = await aiAnalyzerService.analyzeFractalMarket(
      entryMarketData,
      indicators,
      fractalData,
    );

    if (aiAnalysis.setupPhase !== "READY_TO_ENTER") {
      console.log(`⏳ Setup phase is ${aiAnalysis.setupPhase}, forcing NO_SIGNAL`);
      aiAnalysis.signal.signal = "NO_SIGNAL";
      aiAnalysis.signal.reasoning += ` Setup phase is ${aiAnalysis.setupPhase}, waiting for READY_TO_ENTER.`;
    }

    const analysis: TradingAnalysis = {
      marketData: entryMarketData,
      indicators,
      signal: aiAnalysis.signal,
      trend: {
        trend: fractalData.dailyBias.type.includes("BULLISH")
          ? "BULLISH"
          : fractalData.dailyBias.type.includes("BEARISH")
          ? "BEARISH"
          : "NEUTRAL",
        strength: "MODERATE",
        description: fractalData.dailyBias.description,
      },
      supportResistance: {
        support: [fractalData.dailyBias.previousDay.low],
        resistance: [fractalData.dailyBias.previousDay.high],
        nearestSupport: fractalData.pois
          .filter((poi) => poi.price < entryMarketData.currentPrice)
          .sort((a, b) => b.price - a.price)[0]?.price || 0,
        nearestResistance: fractalData.pois
          .filter((poi) => poi.price > entryMarketData.currentPrice)
          .sort((a, b) => a.price - b.price)[0]?.price || 0,
      },
      timestamp: Date.now(),
    };

    return c.json({
      success: true,
      data: analysis,
      meta: {
        mode: "fractal",
        timeframes: {
          bias: biasTimeframe,
          structure: structureTimeframe,
          entry: entryTimeframe,
        },
        fractalData: {
          dailyBias: fractalData.dailyBias,
          poi: fractalData.pois.slice(0, 5),
          cisds: fractalData.cisds.slice(-3),
        },
        biasAnalysis: aiAnalysis.biasAnalysis,
        poiIdentified: aiAnalysis.poiIdentified,
        structureValidation: aiAnalysis.structureValidation,
        setupConfirmation: aiAnalysis.setupConfirmation,
        setupPhase: aiAnalysis.setupPhase,
        tradeParameters:
          aiAnalysis.signal.signal === "BUY" || aiAnalysis.signal.signal === "SELL"
            ? {
                entryZone: aiAnalysis.entryZone,
                stopLoss: aiAnalysis.stopLoss,
                takeProfit: aiAnalysis.takeProfit,
                riskReward: calculateRiskReward(
                  aiAnalysis.entryZone,
                  aiAnalysis.stopLoss,
                  aiAnalysis.takeProfit,
                ),
              }
            : undefined,
        riskConsiderations: aiAnalysis.riskConsiderations,
        marketSummary: aiAnalysis.marketSummary,
      },
    });
  } catch (error) {
    console.error("❌ Fractal analysis error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to analyze market",
      },
      500,
    );
  }
});

// ==================== INDICATORS ENDPOINT ====================
tradingRouter.get("/indicators", async (c) => {
  try {
    const symbol = c.req.query("symbol") || "BTCUSDT";
    const timeframe = c.req.query("timeframe") || "15m";

    const marketData = await exchangeService.getMarketData(symbol, timeframe);
    const indicators = indicatorsService.calculateAllIndicators(
      marketData.candles,
    );
    const supportResistance = indicatorsService.analyzeSupportResistance(
      marketData.candles,
    );

    return c.json({
      success: true,
      data: {
        symbol: marketData.symbol,
        timeframe: marketData.timeframe,
        currentPrice: marketData.currentPrice,
        priceChangePercent: marketData.priceChangePercent,
        indicators,
        supportResistance,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("❌ Indicators error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch indicators",
      },
      500,
    );
  }
});

// ==================== PRICE ENDPOINT ====================
tradingRouter.get("/price", async (c) => {
  try {
    const symbol = c.req.query("symbol") || "BTCUSDT";
    const price = await exchangeService.getCurrentPrice(symbol);

    return c.json({
      success: true,
      data: {
        symbol,
        price,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("❌ Price fetch error:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch price",
      },
      500,
    );
  }
});

// ==================== HEALTH CHECK ====================
tradingRouter.get("/health", (c) => {
  return c.json({
    success: true,
    status: "ok",
    timestamp: Date.now(),
  });
});

// ==================== LLM TEST ====================
tradingRouter.post("/test-llm", async (c) => {
  try {
    const body = await c.req.json();
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== "string") {
      return c.json(
        {
          success: false,
          error: "Prompt is required and must be a string",
        },
        400,
      );
    }

    const response = await aiAnalyzerService.testLLM(prompt);

    return c.json({
      success: true,
      data: {
        prompt,
        response,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("❌ LLM test error:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to test LLM",
      },
      500,
    );
  }
});

export default tradingRouter;
