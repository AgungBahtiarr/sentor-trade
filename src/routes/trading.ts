import { Hono } from 'hono';
import { binanceService } from '../services/binance';
import { indicatorsService } from '../services/indicators';
import { aiAnalyzerService } from '../services/ai-analyzer';
import type { TradingAnalysis } from '../types/trading';

const tradingRouter = new Hono();

tradingRouter.get('/analyze', async (c) => {
  try {
    const symbol = c.req.query('symbol') || 'BTCUSDT';
    const timeframe = c.req.query('timeframe') || '15m';

    const marketData = await binanceService.getMarketData(symbol, timeframe);
    const indicators = indicatorsService.calculateAllIndicators(marketData.candles);
    const supportResistance = indicatorsService.analyzeSupportResistance(marketData.candles);
    
    const aiAnalysis = await aiAnalyzerService.analyzeMarket(marketData, indicators);

    const analysis: TradingAnalysis = {
      marketData,
      indicators,
      signal: aiAnalysis.signal,
      trend: aiAnalysis.trend,
      supportResistance: {
        support: supportResistance.support,
        resistance: supportResistance.resistance,
        nearestSupport: supportResistance.nearestSupport,
        nearestResistance: supportResistance.nearestResistance,
      },
      timestamp: Date.now(),
    };

    return c.json({
      success: true,
      data: analysis,
      analysis: {
        ...aiAnalysis,
        supportResistanceLevels: supportResistance,
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze market',
      },
      500
    );
  }
});

tradingRouter.get('/indicators', async (c) => {
  try {
    const symbol = c.req.query('symbol') || 'BTCUSDT';
    const timeframe = c.req.query('timeframe') || '15m';

    const marketData = await binanceService.getMarketData(symbol, timeframe);
    const indicators = indicatorsService.calculateAllIndicators(marketData.candles);
    const supportResistance = indicatorsService.analyzeSupportResistance(marketData.candles);

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
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch indicators',
      },
      500
    );
  }
});

tradingRouter.get('/price', async (c) => {
  try {
    const symbol = c.req.query('symbol') || 'BTCUSDT';
    const price = await binanceService.getCurrentPrice(symbol);

    return c.json({
      success: true,
      data: {
        symbol,
        price,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch price',
      },
      500
    );
  }
});

tradingRouter.get('/health', (c) => {
  return c.json({
    success: true,
    status: 'ok',
    timestamp: Date.now(),
  });
});

export default tradingRouter;
