import { Hono } from "hono";
import { tradingAnalysisService } from "../services/trading-analysis";
import { aiAnalyzerService } from "../services/ai-analyzer";
import { calculateRiskReward } from "../lib/trading-utils";
import { logger } from "../lib/logger";
import { errorHandler } from "../middleware/error-handler";

const tradingRouter = new Hono();

tradingRouter.use("*", errorHandler);

tradingRouter.get("/analyze", async (c) => {
  const symbol = c.req.query("symbol") || "BTCUSDT";
  const entryTimeframe = c.req.query("timeframe") || "5m";

  const analysis = await tradingAnalysisService.performFractalAnalysis(
    symbol,
    entryTimeframe,
  );

  const tradeParameters =
    analysis.signal.signal === "BUY" || analysis.signal.signal === "SELL"
      ? {
          riskLevel: analysis.signal.riskLevel,
          entryZone: analysis.fractalData.entryZone,
          stopLoss: analysis.fractalData.stopLoss,
          takeProfit: analysis.fractalData.takeProfit,
          riskReward: calculateRiskReward(
            analysis.fractalData.entryZone,
            analysis.fractalData.stopLoss,
            analysis.fractalData.takeProfit,
          ),
        }
      : undefined;

  return c.json({
    success: true,
    data: {
      marketData: analysis.marketData,
      indicators: analysis.indicators,
      signal: analysis.signal,
      trend: analysis.trend,
      supportResistance: analysis.supportResistance,
      timestamp: analysis.timestamp,
    },
    meta: {
      mode: "fractal",
      timeframes: {
        bias: analysis.fractalData.biasTimeframe,
        structure: analysis.fractalData.structureTimeframe,
        entry: entryTimeframe,
      },
      riskLevel: analysis.signal.riskLevel,
      fractalData: {
        dailyBias: analysis.fractalData.dailyBias,
        poi: analysis.fractalData.pois.slice(0, 5),
        cisds: analysis.fractalData.cisds.slice(-3),
      },
      biasAnalysis: analysis.fractalData.biasAnalysis,
      poiIdentified: analysis.fractalData.poiIdentified,
      structureValidation: analysis.fractalData.structureValidation,
      setupConfirmation: analysis.fractalData.setupConfirmation,
      setupPhase: analysis.fractalData.setupPhase,
      tradeParameters,
      riskConsiderations: analysis.fractalData.riskConsiderations,
      marketSummary: analysis.fractalData.marketSummary,
    },
  });
});

tradingRouter.get("/indicators", async (c) => {
  const symbol = c.req.query("symbol") || "BTCUSDT";
  const timeframe = c.req.query("timeframe") || "15m";

  const data = await tradingAnalysisService.getIndicators(symbol, timeframe);

  return c.json({
    success: true,
    data,
  });
});

tradingRouter.get("/price", async (c) => {
  const symbol = c.req.query("symbol") || "BTCUSDT";

  const data = await tradingAnalysisService.getCurrentPrice(symbol);

  return c.json({
    success: true,
    data,
  });
});

tradingRouter.get("/health", (c) => {
  return c.json({
    success: true,
    status: "ok",
    timestamp: Date.now(),
  });
});

tradingRouter.post("/test-llm", async (c) => {
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
});

export default tradingRouter;
