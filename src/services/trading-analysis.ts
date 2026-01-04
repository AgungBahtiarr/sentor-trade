import { exchangeService } from "./exchange/exchange-provider";
import { indicatorsService } from "./indicators";
import { aiAnalyzerService } from "./ai-analyzer";
import { fractalService } from "./fractal";
import { cacheService } from "./cache";
import { logger } from "../lib/logger";
import { CONFIG } from "../lib/config";
import {
  findNearestSupport,
  findNearestResistance,
} from "../lib/trading-utils";
import type { MarketData, TechnicalIndicators } from "../types/trading";
import type { TradingAnalysis } from "../types/trading";
import type { FractalData } from "./fractal";

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

export class TradingAnalysisService {
  private static instance: TradingAnalysisService;

  private constructor() {}

  public static getInstance(): TradingAnalysisService {
    if (!TradingAnalysisService.instance) {
      TradingAnalysisService.instance = new TradingAnalysisService();
    }
    return TradingAnalysisService.instance;
  }

  private generateCacheKey(symbol: string, timeframe: string): string {
    return `market:${symbol}:${timeframe}`;
  }

  private async getMarketDataWithCache(
    symbol: string,
    timeframe: string,
  ): Promise<MarketData> {
    const cacheKey = this.generateCacheKey(symbol, timeframe);

    const cachedData = cacheService.get<MarketData>(cacheKey);
    if (cachedData) {
      logger.debug("Using cached market data", { symbol, timeframe });
      return cachedData;
    }

    const marketData = await exchangeService.getMarketData(symbol, timeframe);
    cacheService.set(cacheKey, marketData, CONFIG.cache.marketDataTTL);

    return marketData;
  }

  private validateSymbol(symbol: string): boolean {
    return /^[A-Z]{2,20}USDT$/.test(symbol);
  }

  private validateTimeframe(timeframe: string): boolean {
    return timeframe in TIMEFRAME_MAPPING;
  }

  async performFractalAnalysis(
    symbol: string,
    entryTimeframe: string,
  ): Promise<
    TradingAnalysis & {
      fractalData: FractalData & {
        biasTimeframe: string;
        structureTimeframe: string;
        biasAnalysis: string;
        poiIdentified: string;
        structureValidation: string;
        setupConfirmation: string;
        setupPhase: string;
        entryZone: number | null;
        stopLoss: number | null;
        takeProfit: number | null;
        riskConsiderations: string;
        marketSummary: string;
      };
    }
  > {
    if (!this.validateSymbol(symbol)) {
      throw new Error("Invalid symbol format. Expected format: BTCUSDT");
    }

    if (!this.validateTimeframe(entryTimeframe)) {
      logger.warn("Unknown timeframe, defaulting to 15m", {
        timeframe: entryTimeframe,
      });
      entryTimeframe = "15m";
    }

    const mapping = TIMEFRAME_MAPPING[entryTimeframe as TimeframeKey];
    const structureTimeframe = mapping.structure;
    const biasTimeframe = mapping.bias;

    logger.info("Starting fractal analysis", {
      symbol,
      entryTimeframe,
      structureTimeframe,
      biasTimeframe,
    });

    const [biasMarketData, structureMarketData, entryMarketData] =
      await Promise.all([
        this.getMarketDataWithCache(symbol, biasTimeframe),
        this.getMarketDataWithCache(symbol, structureTimeframe),
        this.getMarketDataWithCache(symbol, entryTimeframe),
      ]);

    const indicators = indicatorsService.calculateAllIndicators(
      entryMarketData.candles,
    );

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
      logger.debug(
        `Setup phase is ${aiAnalysis.setupPhase}, forcing NO_SIGNAL`,
      );
      aiAnalysis.signal.signal = "NO_SIGNAL";
      aiAnalysis.signal.reasoning += ` Setup phase is ${aiAnalysis.setupPhase}, waiting for READY_TO_ENTER.`;
    }

    const nearestSupport = findNearestSupport(
      fractalData.pois,
      entryMarketData.currentPrice,
    );
    const nearestResistance = findNearestResistance(
      fractalData.pois,
      entryMarketData.currentPrice,
    );

    const analysis: TradingAnalysis = {
      marketData: entryMarketData,
      indicators,
      signal: {
        ...aiAnalysis.signal,
        riskLevel: aiAnalysis.riskLevel,
      },
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
        nearestSupport: nearestSupport || 0,
        nearestResistance: nearestResistance || 0,
      },
      timestamp: Date.now(),
    };

    return {
      ...analysis,
      fractalData: {
        ...fractalData,
        biasTimeframe,
        structureTimeframe,
        riskLevel: aiAnalysis.riskLevel,
        biasAnalysis: aiAnalysis.biasAnalysis,
        poiIdentified: aiAnalysis.poiIdentified,
        structureValidation: aiAnalysis.structureValidation,
        setupConfirmation: aiAnalysis.setupConfirmation,
        setupPhase: aiAnalysis.setupPhase,
        entryZone: aiAnalysis.entryZone,
        stopLoss: aiAnalysis.stopLoss,
        takeProfit: aiAnalysis.takeProfit,
        riskConsiderations: aiAnalysis.riskConsiderations,
        marketSummary: aiAnalysis.marketSummary,
      },
    };
  }

  async getIndicators(
    symbol: string,
    timeframe: string,
  ): Promise<{
    symbol: string;
    timeframe: string;
    currentPrice: number;
    priceChangePercent: number;
    indicators: TechnicalIndicators;
    supportResistance: any;
    timestamp: number;
  }> {
    if (!this.validateSymbol(symbol)) {
      throw new Error("Invalid symbol format. Expected format: BTCUSDT");
    }

    const marketData = await this.getMarketDataWithCache(symbol, timeframe);
    const indicators = indicatorsService.calculateAllIndicators(
      marketData.candles,
    );
    const supportResistance = indicatorsService.analyzeSupportResistance(
      marketData.candles,
    );

    return {
      symbol: marketData.symbol,
      timeframe: marketData.timeframe,
      currentPrice: marketData.currentPrice,
      priceChangePercent: marketData.priceChangePercent,
      indicators,
      supportResistance,
      timestamp: Date.now(),
    };
  }

  async getCurrentPrice(
    symbol: string,
  ): Promise<{ symbol: string; price: number; timestamp: number }> {
    if (!this.validateSymbol(symbol)) {
      throw new Error("Invalid symbol format. Expected format: BTCUSDT");
    }

    const price = await exchangeService.getCurrentPrice(symbol);

    return {
      symbol,
      price,
      timestamp: Date.now(),
    };
  }
}

export const tradingAnalysisService = TradingAnalysisService.getInstance();
