import { exchangeService } from '../exchange/exchange-provider';
import { fvgService } from './fvg';
import { orderBlockService } from './order-block';
import { liquidityService } from './liquidity';
import { marketStructureService } from './market-structure';
import { timeAnalysisService } from './kill-zones';
import type { CandleData, ICTAnalysis, MultiTimeframeAnalysis } from '../../types/ict';

export class ICTService {
  async analyzeICT(
    symbol: string,
    primaryTimeframe: string = '15m',
    higherTimeframe: string = '4h'
  ): Promise<{
    primaryTimeframe: MultiTimeframeAnalysis;
    higherTimeframe: MultiTimeframeAnalysis;
    ictAnalysis: ICTAnalysis;
  }> {
    const [primaryCandles, higherCandles] = await Promise.all([
      exchangeService.fetchCandles(symbol, primaryTimeframe),
      exchangeService.fetchCandles(symbol, higherTimeframe),
    ]);

    const primaryAnalysis = this.analyzeTimeframe(primaryCandles);
    const higherAnalysis = this.analyzeTimeframe(higherCandles);
    const combinedICTAnalysis = this.combineAnalysis(primaryAnalysis, higherAnalysis);

    return {
      primaryTimeframe: {
        timeframe: primaryTimeframe,
        marketData: primaryCandles,
        ictAnalysis: primaryAnalysis,
        trendDirection: primaryAnalysis.marketStructure.trend,
      },
      higherTimeframe: {
        timeframe: higherTimeframe,
        marketData: higherCandles,
        ictAnalysis: higherAnalysis,
        trendDirection: higherAnalysis.marketStructure.trend,
      },
      ictAnalysis: combinedICTAnalysis,
    };
  }

  private analyzeTimeframe(candles: CandleData[]): ICTAnalysis {
    const [fvgs, orderBlocks, liquidity, marketStructure, timeAnalysis] = [
      fvgService.detectFairValueGaps(candles),
      orderBlockService.detectOrderBlocks(candles),
      liquidityService.analyzeLiquidity(candles),
      marketStructureService.analyzeMarketStructure(candles),
      timeAnalysisService.analyzeTime(),
    ];

    const confluence = this.calculateConfluence(fvgs, orderBlocks, liquidity, marketStructure);

    return {
      fairValueGaps: fvgs,
      orderBlocks,
      liquidity,
      marketStructure,
      timeAnalysis,
      confluence,
    };
  }

  private combineAnalysis(
    primary: ICTAnalysis,
    higher: ICTAnalysis
  ): ICTAnalysis {
    const combinedFVGs = [...primary.fairValueGaps];
    const combinedOBs = [...primary.orderBlocks];
    
    const combinedLiquidity = {
      ...primary.liquidity,
      buySide: primary.liquidity.buySide,
      sellSide: primary.liquidity.sellSide,
    };

    const combinedStructure = {
      ...primary.marketStructure,
      trend: higher.marketStructure.trend,
    };

    const combinedConfluence = this.calculateConfluence(
      combinedFVGs,
      combinedOBs,
      combinedLiquidity,
      combinedStructure
    );

    return {
      fairValueGaps: combinedFVGs,
      orderBlocks: combinedOBs,
      liquidity: combinedLiquidity,
      marketStructure: combinedStructure,
      timeAnalysis: primary.timeAnalysis,
      confluence: combinedConfluence,
    };
  }

  private calculateConfluence(
    fvgs: any[],
    orderBlocks: any[],
    liquidity: any,
    marketStructure: any
  ): {
    bullishScore: number;
    bearishScore: number;
    primarySetup: string | null;
    secondaryConfirmations: string[];
  } {
    let bullishScore = 0;
    let bearishScore = 0;
    const secondaryConfirmations: string[] = [];
    let primarySetup: string | null = null;

    const activeBullishFVGs = fvgs.filter((fvg: any) => fvg.type === 'bullish' && !fvg.filled);
    const activeBearishFVGs = fvgs.filter((fvg: any) => fvg.type === 'bearish' && !fvg.filled);

    if (activeBullishFVGs.length > 0) {
      bullishScore += 30;
      secondaryConfirmations.push('Bullish FVG present');
    }
    if (activeBearishFVGs.length > 0) {
      bearishScore += 30;
      secondaryConfirmations.push('Bearish FVG present');
    }

    const activeBullishOBs = orderBlocks.filter((ob: any) => ob.type === 'bullish' && ob.active && ob.retested);
    const activeBearishOBs = orderBlocks.filter((ob: any) => ob.type === 'bearish' && ob.active && ob.retested);

    if (activeBullishOBs.length > 0) {
      bullishScore += 25;
      secondaryConfirmations.push('Bullish Order Block active and retested');
      if (!primarySetup) primarySetup = 'Bullish Order Block retest';
    }
    if (activeBearishOBs.length > 0) {
      bearishScore += 25;
      secondaryConfirmations.push('Bearish Order Block active and retested');
      if (!primarySetup) primarySetup = 'Bearish Order Block retest';
    }

    if (liquidity.lastSweep.type === 'buySide') {
      bullishScore += 20;
      secondaryConfirmations.push('Buy-side liquidity swept');
      if (!primarySetup) primarySetup = 'Buy-side liquidity sweep';
    }
    if (liquidity.lastSweep.type === 'sellSide') {
      bearishScore += 20;
      secondaryConfirmations.push('Sell-side liquidity swept');
      if (!primarySetup) primarySetup = 'Sell-side liquidity sweep';
    }

    if (marketStructure.trend === 'BULLISH') {
      bullishScore += 15;
      secondaryConfirmations.push('Market structure bullish');
    }
    if (marketStructure.trend === 'BEARISH') {
      bearishScore += 15;
      secondaryConfirmations.push('Market structure bearish');
    }

    if (marketStructure.lastBOS.type === 'bullish') {
      bullishScore += 10;
      secondaryConfirmations.push('Bullish Break of Structure');
    }
    if (marketStructure.lastBOS.type === 'bearish') {
      bearishScore += 10;
      secondaryConfirmations.push('Bearish Break of Structure');
    }

    if (marketStructure.lastCHoCH.type === 'bullish') {
      bullishScore += 10;
      secondaryConfirmations.push('Bullish Change of Character');
    }
    if (marketStructure.lastCHoCH.type === 'bearish') {
      bearishScore += 10;
      secondaryConfirmations.push('Bearish Change of Character');
    }

    if (marketStructure.timeAnalysis.killZone.active) {
      secondaryConfirmations.push(`Active ${marketStructure.timeAnalysis.killZone.name} Kill Zone`);
    }

    return {
      bullishScore,
      bearishScore,
      primarySetup,
      secondaryConfirmations,
    };
  }

  getSignalSummary(ictAnalysis: ICTAnalysis): {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null;
    confidence: number;
    keyFactors: string[];
  } {
    const { bullishScore, bearishScore, primarySetup, secondaryConfirmations } = ictAnalysis.confluence;
    const totalScore = bullishScore + bearishScore;
    
    if (totalScore < 30) {
      return {
        direction: null,
        confidence: 0,
        keyFactors: ['Insufficient confluence'],
      };
    }

    const leadingScore = Math.max(bullishScore, bearishScore);
    const confidence = (leadingScore / 100) * 100;

    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null = null;
    
    if (bullishScore > bearishScore + 20) {
      direction = 'BULLISH';
    } else if (bearishScore > bullishScore + 20) {
      direction = 'BEARISH';
    } else {
      direction = 'NEUTRAL';
    }

    const keyFactors = [primarySetup || 'No primary setup', ...secondaryConfirmations.slice(0, 3)];

    return {
      direction,
      confidence,
      keyFactors,
    };
  }
}

export const ictService = new ICTService();
