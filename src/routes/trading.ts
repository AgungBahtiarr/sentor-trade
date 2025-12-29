import { Hono } from "hono";
import { exchangeService } from "../services/exchange/exchange-provider";
import { indicatorsService } from "../services/indicators";
import { aiAnalyzerService } from "../services/ai-analyzer";
import { ictService } from "../services/ict/ict-service";
import { fvgService } from "../services/ict/fvg";
import { orderBlockService } from "../services/ict/order-block";
import { liquidityService } from "../services/ict/liquidity";
import { marketStructureService } from "../services/ict/market-structure";
import { timeAnalysisService } from "../services/ict/kill-zones";
import type { TradingAnalysis } from "../types/trading";
import type { ICTTradingAnalysis, ICTSignal } from "../types/ict";

const tradingRouter = new Hono();

// ==================== HELPER FUNCTIONS ====================
/**
 * Calculate risk-reward ratio safely
 */
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

/**
 * Determine optimal stop loss based on signal type and levels
 */
function determineStopLoss(
  signalType: string,
  currentPrice: number,
  support: number,
  resistance: number,
): number {
  if (signalType === "BUY") {
    // For BUY: Stop below support with buffer
    return support > 0 ? support * 0.995 : currentPrice * 0.98;
  } else if (signalType === "SELL") {
    // For SELL: Stop above resistance with buffer
    return resistance > 0 ? resistance * 1.005 : currentPrice * 1.02;
  }
  return currentPrice * 0.98; // Default 2% stop
}

/**
 * Calculate multiple take profit levels with improved risk-reward ratios
 */
function calculateTakeProfits(
  signalType: string,
  entry: number,
  stopLoss: number,
  resistance: number,
  support: number,
): number[] {
  const risk = Math.abs(entry - stopLoss);

  if (signalType === "BUY") {
    return [
      entry + risk * 2, // TP1: 2R (minimum 1:2 RR)
      entry + risk * 3, // TP2: 3R
      resistance > entry ? resistance : entry + risk * 5, // TP3: Resistance or 5R
    ];
  } else if (signalType === "SELL") {
    return [
      entry - risk * 2, // TP1: 2R (minimum 1:2 RR)
      entry - risk * 3, // TP2: 3R
      support > 0 && support < entry ? support : entry - risk * 5, // TP3: Support or 5R
    ];
  }

  return [entry * 1.02, entry * 1.04, entry * 1.06]; // Default
}

// ==================== STANDARD ANALYSIS ENDPOINT ====================
tradingRouter.get("/analyze", async (c) => {
  try {
    const symbol = c.req.query("symbol") || "BTCUSDT";
    const timeframe = c.req.query("timeframe") || "15m";
    console.log("📊 Standard Analysis:", { symbol, timeframe });

    // Fetch market data and calculate indicators
    const marketData = await exchangeService.getMarketData(symbol, timeframe);
    const indicators = indicatorsService.calculateAllIndicators(
      marketData.candles,
    );
    const supportResistance = indicatorsService.analyzeSupportResistance(
      marketData.candles,
    );

    // AI Analysis with optimized prompts
    const aiAnalysis = await aiAnalyzerService.analyzeMarket(
      marketData,
      indicators,
    );

    const analysis: TradingAnalysis = {
      marketData,
      indicators,
      signal: aiAnalysis.signal,
      trend: aiAnalysis.trend,
      supportResistance: {
        support: supportResistance.support,
        resistance: supportResistance.resistance,
        nearestSupport:
          aiAnalysis.supportResistance.supportLevel ||
          supportResistance.nearestSupport,
        nearestResistance:
          aiAnalysis.supportResistance.resistanceLevel ||
          supportResistance.nearestResistance,
      },
      timestamp: Date.now(),
    };

    return c.json({
      success: true,
      data: analysis,
      meta: {
        aiReasoning: aiAnalysis.signal.reasoning,
        riskConsiderations: aiAnalysis.riskConsiderations,
        marketSummary: aiAnalysis.marketSummary,
      },
    });
  } catch (error) {
    console.error("❌ Standard analysis error:", error);
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

// ==================== FIGHTER ANALYSIS ENDPOINT ====================
tradingRouter.get("/fighter/analyze", async (c) => {
  try {
    const symbol = c.req.query("symbol") || "BTCUSDT";
    const timeframe = c.req.query("timeframe") || "5m";
    console.log("⚡ Fighter Analysis (Scalping):", { symbol, timeframe });

    // Fetch market data and calculate indicators
    const marketData = await exchangeService.getMarketData(symbol, timeframe);
    const indicators = indicatorsService.calculateAllIndicators(
      marketData.candles,
    );
    const supportResistance = indicatorsService.analyzeSupportResistance(
      marketData.candles,
    );

    // AI Analysis with fighter prompts optimized for scalping
    const aiAnalysis = await aiAnalyzerService.analyzeFighterMarket(
      marketData,
      indicators,
    );

    const analysis: TradingAnalysis = {
      marketData,
      indicators,
      signal: aiAnalysis.signal,
      trend: aiAnalysis.trend,
      supportResistance: {
        support: supportResistance.support,
        resistance: supportResistance.resistance,
        nearestSupport:
          aiAnalysis.supportResistance.supportLevel ||
          supportResistance.nearestSupport,
        nearestResistance:
          aiAnalysis.supportResistance.resistanceLevel ||
          supportResistance.nearestResistance,
      },
      timestamp: Date.now(),
    };

    return c.json({
      success: true,
      data: analysis,
      meta: {
        mode: "fighter",
        scalpingTimeframe: aiAnalysis.scalpingTimeframe,
        aiReasoning: aiAnalysis.signal.reasoning,
        riskConsiderations: aiAnalysis.riskConsiderations,
        marketSummary: aiAnalysis.marketSummary,
      },
    });
  } catch (error) {
    console.error("❌ Fighter analysis error:", error);
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

// ==================== ICT ANALYSIS ENDPOINT (OPTIMIZED) ====================
tradingRouter.get("/ict/analyze", async (c) => {
  try {
    const symbol = c.req.query("symbol") || "BTCUSDT";
    const primaryTimeframe = c.req.query("timeframe") || "15m";
    const higherTimeframe = c.req.query("higherTimeframe") || "4h";
    console.log("🔥 ICT Analysis:", {
      symbol,
      primaryTimeframe,
      higherTimeframe,
    });

    // Perform ICT analysis
    const ictResult = await ictService.analyzeICT(
      symbol,
      primaryTimeframe,
      higherTimeframe,
    );
    if (!ictResult || !ictResult.ictAnalysis) {
      throw new Error("Failed to perform ICT analysis");
    }

    // Get market data and indicators
    const marketData = await exchangeService.getMarketData(
      symbol,
      primaryTimeframe,
    );
    const indicators = indicatorsService.calculateAllIndicators(
      marketData.candles,
    );
    const supportResistance = indicatorsService.analyzeSupportResistance(
      marketData.candles,
    );

    // AI Analysis with ICT-specific optimized prompts
    const aiAnalysis = await aiAnalyzerService.analyzeICTMarket(
      marketData,
      indicators,
      ictResult.ictAnalysis,
    );

    // Use AI-provided support/resistance levels (more accurate)
    const finalSupport = aiAnalysis.supportResistance.supportLevel;
    const finalResistance = aiAnalysis.supportResistance.resistanceLevel;

    // Conditionally calculate risk management only for actionable signals
    let riskManagement;
    if (aiAnalysis.signal.signal === 'BUY' || aiAnalysis.signal.signal === 'SELL') {
      // Calculate optimal stop loss
      const stopLoss = determineStopLoss(
        aiAnalysis.signal.signal,
        marketData.currentPrice,
        finalSupport,
        finalResistance,
      );

      // Calculate multiple take profit levels
      const takeProfits = calculateTakeProfits(
        aiAnalysis.signal.signal,
        marketData.currentPrice,
        stopLoss,
        finalResistance,
        finalSupport,
      );

      // Calculate risk-reward for first TP
      const riskReward = calculateRiskReward(
        marketData.currentPrice,
        stopLoss,
        takeProfits[0],
      );

      riskManagement = {
        entry: marketData.currentPrice,
        stopLoss: stopLoss,
        takeProfit: takeProfits,
        riskReward: riskReward,
      };
    }

    const signal: ICTSignal = {
      type: aiAnalysis.signal.signal,
      ictSpecific: aiAnalysis.ictSpecific,
      confidence: aiAnalysis.signal.confidence,
      reasoning: aiAnalysis.signal.reasoning,
      setup: aiAnalysis.setup,
      riskManagement,
      signalMethod: aiAnalysis.signalMethod,
      predictedDirection: aiAnalysis.predictedDirection,
      predictedConfidence: aiAnalysis.predictedConfidence,
      predictedMethod: aiAnalysis.predictedMethod,
      timeframeAnalysis: aiAnalysis.timeframeAnalysis,
    };

    const ictAnalysis: ICTTradingAnalysis = {
      primaryTimeframe: ictResult.primaryTimeframe,
      higherTimeframe: ictResult.higherTimeframe,
      signal,
      ictAnalysis: ictResult.ictAnalysis,
      secondaryIndicators: indicators,
      marketData: {
        symbol: marketData.symbol,
        timeframe: primaryTimeframe,
        currentPrice: marketData.currentPrice,
        priceChangePercent: marketData.priceChangePercent,
      },
      timestamp: Date.now(),
    };

    return c.json({
      success: true,
      data: ictAnalysis,
      meta: {
        aiReasoning: aiAnalysis.signal.reasoning,
        ictSpecific: aiAnalysis.ictSpecific,
        setupDetails: aiAnalysis.setup,
        riskConsiderations: aiAnalysis.riskConsiderations,
        marketSummary: aiAnalysis.marketSummary,
        supportResistanceLevels: {
          support: finalSupport,
          resistance: finalResistance,
          reasoning: aiAnalysis.supportResistance.reasoning,
        },
        signalMethod: aiAnalysis.signalMethod,
        predictedDirection: aiAnalysis.predictedDirection,
        predictedConfidence: aiAnalysis.predictedConfidence,
        predictedMethod: aiAnalysis.predictedMethod,
        timeframeAnalysis: aiAnalysis.timeframeAnalysis,
      },
    });
  } catch (error) {
    console.error("❌ ICT analysis error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to perform ICT analysis",
      },
      500,
    );
  }
});

// ==================== COMBINED ANALYSIS ====================
tradingRouter.get("/analyze/both", async (c) => {
  try {
    const symbol = c.req.query("symbol") || "BTCUSDT";
    const primaryTimeframe = c.req.query("timeframe") || "15m";
    const higherTimeframe = c.req.query("higherTimeframe") || "4h";
    console.log("🔄 Combined Analysis:", {
      symbol,
      primaryTimeframe,
      higherTimeframe,
    });

    // Get market data
    const marketData = await exchangeService.getMarketData(
      symbol,
      primaryTimeframe,
    );
    const indicators = indicatorsService.calculateAllIndicators(
      marketData.candles,
    );

    // Get ICT analysis
    const ictResult = await ictService.analyzeICT(
      symbol,
      primaryTimeframe,
      higherTimeframe,
    );
    if (!ictResult || !ictResult.ictAnalysis) {
      throw new Error("Failed to perform ICT analysis");
    }

    // Run both analyses in parallel (faster!)
    const { standard, ict } = await aiAnalyzerService.analyzeMarketBoth(
      marketData,
      indicators,
      ictResult.ictAnalysis,
    );

    return c.json({
      success: true,
      data: {
        symbol,
        timeframe: primaryTimeframe,
        higherTimeframe,
        currentPrice: marketData.currentPrice,
        standardAnalysis: {
          signal: standard.signal,
          trend: standard.trend,
          supportResistance: standard.supportResistance,
          summary: standard.marketSummary,
        },
        ictAnalysis: {
          signal: ict.signal,
          ictSpecific: ict.ictSpecific,
          setup: ict.setup,
          trend: ict.trend,
          supportResistance: ict.supportResistance,
          summary: ict.marketSummary,
        },
        consensus: {
          // If both agree on BUY/SELL, it's a strong signal
          agree: standard.signal.signal === ict.signal.signal,
          strongerSignal:
            standard.signal.confidence > ict.signal.confidence
              ? "standard"
              : "ict",
          recommendation:
            standard.signal.signal === ict.signal.signal &&
            standard.signal.signal !== "NO_SIGNAL"
              ? `STRONG ${standard.signal.signal}`
              : "WAIT_FOR_CLARITY",
        },
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("❌ Combined analysis error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to perform combined analysis",
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

// ==================== ICT SUB-ENDPOINTS ====================
tradingRouter.get("/ict/fvg", async (c) => {
  try {
    const symbol = c.req.query("symbol") || "BTCUSDT";
    const timeframe = c.req.query("timeframe") || "15m";

    const candles = await exchangeService.fetchCandles(symbol, timeframe);
    const fvgs = fvgService.detectFairValueGaps(candles);
    const activeFVGs = fvgService.getActiveFVGs(fvgs);

    return c.json({
      success: true,
      data: {
        symbol,
        timeframe,
        allFVGs: fvgs,
        activeFVGs,
        nearestFVG: fvgService.getNearestFVG(
          fvgs,
          candles[candles.length - 1].close,
        ),
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("❌ FVG analysis error:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze FVG",
      },
      500,
    );
  }
});

tradingRouter.get("/ict/orderblocks", async (c) => {
  try {
    const symbol = c.req.query("symbol") || "BTCUSDT";
    const timeframe = c.req.query("timeframe") || "15m";

    const candles = await exchangeService.fetchCandles(symbol, timeframe);
    const orderBlocks = orderBlockService.detectOrderBlocks(candles);
    const activeOBs = orderBlockService.getActiveOrderBlocks(orderBlocks);

    return c.json({
      success: true,
      data: {
        symbol,
        timeframe,
        allOrderBlocks: orderBlocks,
        activeOrderBlocks: activeOBs,
        nearestOrderBlock: orderBlockService.getNearestOrderBlock(
          orderBlocks,
          candles[candles.length - 1].close,
        ),
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("❌ Order blocks analysis error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze order blocks",
      },
      500,
    );
  }
});

tradingRouter.get("/ict/liquidity", async (c) => {
  try {
    const symbol = c.req.query("symbol") || "BTCUSDT";
    const timeframe = c.req.query("timeframe") || "15m";

    const candles = await exchangeService.fetchCandles(symbol, timeframe);
    const liquidity = liquidityService.analyzeLiquidity(candles);

    return c.json({
      success: true,
      data: {
        symbol,
        timeframe,
        liquidity,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("❌ Liquidity analysis error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze liquidity",
      },
      500,
    );
  }
});

tradingRouter.get("/ict/structure", async (c) => {
  try {
    const symbol = c.req.query("symbol") || "BTCUSDT";
    const timeframe = c.req.query("timeframe") || "15m";

    const candles = await exchangeService.fetchCandles(symbol, timeframe);
    const structure = marketStructureService.analyzeMarketStructure(candles);

    return c.json({
      success: true,
      data: {
        symbol,
        timeframe,
        structure,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("❌ Market structure analysis error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze market structure",
      },
      500,
    );
  }
});

tradingRouter.get("/ict/time", async (c) => {
  try {
    const timeAnalysis = timeAnalysisService.analyzeTime();
    const optimalTrading = timeAnalysisService.isOptimalTradingTime();
    const nextKillZone = timeAnalysisService.getNextKillZone();

    return c.json({
      success: true,
      data: {
        timeAnalysis,
        optimalTrading,
        nextKillZone,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("❌ Time analysis error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to analyze time",
      },
      500,
    );
  }
});

tradingRouter.get("/ict/killzones", async (c) => {
  return c.redirect("/api/trading/ict/time");
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
