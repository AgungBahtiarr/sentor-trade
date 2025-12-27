import { Hono } from 'hono';
import { exchangeService } from '../services/exchange/exchange-provider';
import { indicatorsService } from '../services/indicators';
import { aiAnalyzerService } from '../services/ai-analyzer';
import { ictService } from '../services/ict/ict-service';
import { fvgService } from '../services/ict/fvg';
import { orderBlockService } from '../services/ict/order-block';
import { liquidityService } from '../services/ict/liquidity';
import { marketStructureService } from '../services/ict/market-structure';
import { timeAnalysisService } from '../services/ict/kill-zones';
import type { TradingAnalysis } from '../types/trading';
import type { ICTTradingAnalysis, ICTSignal } from '../types/ict';

const tradingRouter = new Hono();

tradingRouter.get('/analyze', async (c) => {
  try {
    const symbol = c.req.query('symbol') || 'BTCUSDT';
    const timeframe = c.req.query('timeframe') || '15m';
    console.log('Backend received symbol:', symbol, 'timeframe:', timeframe);

    const marketData = await exchangeService.getMarketData(symbol, timeframe);
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

    const marketData = await exchangeService.getMarketData(symbol, timeframe);
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
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch price',
      },
      500
    );
  }
});

tradingRouter.get('/ict/analyze', async (c) => {
  try {
    const symbol = c.req.query('symbol') || 'BTCUSDT';
    const primaryTimeframe = c.req.query('timeframe') || '15m';
    const higherTimeframe = c.req.query('higherTimeframe') || '4h';
    console.log('Backend ICT received symbol:', symbol, 'primaryTimeframe:', primaryTimeframe, 'higherTimeframe:', higherTimeframe);

    const ictResult = await ictService.analyzeICT(symbol, primaryTimeframe, higherTimeframe);
    if (!ictResult || !ictResult.ictAnalysis) {
      throw new Error('Failed to perform ICT analysis');
    }

    const marketData = await exchangeService.getMarketData(symbol, primaryTimeframe);
    const indicators = indicatorsService.calculateAllIndicators(marketData.candles);
    const supportResistance = indicatorsService.analyzeSupportResistance(marketData.candles);

    const aiAnalysis = await aiAnalyzerService.analyzeICTMarket(marketData, indicators, ictResult.ictAnalysis);

    const signal: ICTSignal = {
      type: aiAnalysis.signal.signal,
      ictSpecific: aiAnalysis.ictSpecific,
      confidence: aiAnalysis.signal.confidence,
      reasoning: aiAnalysis.signal.reasoning,
      setup: aiAnalysis.setup,
      riskManagement: {
        entry: marketData.currentPrice,
        stopLoss: supportResistance.nearestSupport || supportResistance.nearestResistance || 0,
        takeProfit: [supportResistance.nearestResistance || 0],
        riskReward: 0,
      },
    };

    signal.riskManagement.riskReward = signal.riskManagement.takeProfit[0] > 0 
      ? Math.abs(signal.riskManagement.takeProfit[0] - signal.riskManagement.entry) / 
        Math.abs(signal.riskManagement.entry - signal.riskManagement.stopLoss)
      : 0;

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
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to perform ICT analysis',
      },
      500
    );
  }
});

tradingRouter.get('/ict/fvg', async (c) => {
  try {
    const symbol = c.req.query('symbol') || 'BTCUSDT';
    const timeframe = c.req.query('timeframe') || '15m';

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
        nearestFVG: fvgService.getNearestFVG(fvgs, candles[candles.length - 1].close),
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze FVG',
      },
      500
    );
  }
});

tradingRouter.get('/ict/orderblocks', async (c) => {
  try {
    const symbol = c.req.query('symbol') || 'BTCUSDT';
    const timeframe = c.req.query('timeframe') || '15m';

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
        nearestOrderBlock: orderBlockService.getNearestOrderBlock(orderBlocks, candles[candles.length - 1].close),
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze order blocks',
      },
      500
    );
  }
});

tradingRouter.get('/ict/liquidity', async (c) => {
  try {
    const symbol = c.req.query('symbol') || 'BTCUSDT';
    const timeframe = c.req.query('timeframe') || '15m';

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
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze liquidity',
      },
      500
    );
  }
});

tradingRouter.get('/ict/structure', async (c) => {
  try {
    const symbol = c.req.query('symbol') || 'BTCUSDT';
    const timeframe = c.req.query('timeframe') || '15m';

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
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze market structure',
      },
      500
    );
  }
});

tradingRouter.get('/ict/time', async (c) => {
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
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze time',
      },
      500
    );
  }
});

tradingRouter.get('/ict/killzones', async (c) => {
  return c.redirect('/api/trading/ict/time');
});

tradingRouter.get('/health', (c) => {
  return c.json({
    success: true,
    status: 'ok',
    timestamp: Date.now(),
  });
});

tradingRouter.post('/test-llm', async (c) => {
  try {
    const body = await c.req.json();
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== 'string') {
      return c.json(
        {
          success: false,
          error: 'Prompt is required and must be a string',
        },
        400
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
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test LLM',
      },
      500
    );
  }
});

export default tradingRouter;
