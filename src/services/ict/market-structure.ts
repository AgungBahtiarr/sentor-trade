import type { CandleData, MarketStructurePoint, MarketStructureAnalysis } from '../../types/ict';

export class MarketStructureService {
  analyzeMarketStructure(candles: CandleData[]): MarketStructureAnalysis {
    const swingPoints = this.identifyMarketStructure(candles);
    const recentStructure = swingPoints.slice(-10);
    
    const trend = this.determineTrend(recentStructure);
    const lastBOS = this.findLastBOS(swingPoints);
    const lastCHoCH = this.findLastCHoCH(swingPoints);

    return {
      trend,
      currentStructure: {
        direction: trend === 'BULLISH' ? 'bullish' : trend === 'BEARISH' ? 'bearish' : 'bullish',
        phase: this.determinePhase(recentStructure),
      },
      lastBOS,
      lastCHoCH,
      swingPoints,
      recentStructure,
    };
  }

  private identifyMarketStructure(candles: CandleData[]): MarketStructurePoint[] {
    const structure: MarketStructurePoint[] = [];
    const period = 5;

    if (candles.length < period * 2 + 1) return structure;

    let lastHigh = candles[period].high;
    let lastLow = candles[period].low;

    for (let i = period; i < candles.length - period; i++) {
      const isSwingHigh = this.isSwingHigh(candles, i, period);
      const isSwingLow = this.isSwingLow(candles, i, period);

      if (isSwingHigh) {
        const type = candles[i].high > lastHigh ? 'HH' : 'LH';
        lastHigh = candles[i].high;
        
        structure.push({
          type,
          price: candles[i].high,
          timestamp: candles[i].timestamp,
          candleIndex: i,
          direction: type === 'HH' ? 'bullish' : 'bearish',
        });
      }

      if (isSwingLow) {
        const type = candles[i].low > lastLow ? 'HL' : 'LL';
        lastLow = candles[i].low;
        
        structure.push({
          type,
          price: candles[i].low,
          timestamp: candles[i].timestamp,
          candleIndex: i,
          direction: type === 'HL' ? 'bullish' : 'bearish',
        });
      }

      this.detectBOSAndCHoCH(candles, i, structure, period);
    }

    return structure;
  }

  private isSwingHigh(candles: CandleData[], index: number, period: number): boolean {
    const currentHigh = candles[index].high;
    
    for (let i = index - period; i <= index + period; i++) {
      if (i === index) continue;
      if (candles[i].high >= currentHigh) return false;
    }
    
    return true;
  }

  private isSwingLow(candles: CandleData[], index: number, period: number): boolean {
    const currentLow = candles[index].low;
    
    for (let i = index - period; i <= index + period; i++) {
      if (i === index) continue;
      if (candles[i].low <= currentLow) return false;
    }
    
    return true;
  }

  private detectBOSAndCHoCH(
    candles: CandleData[],
    index: number,
    structure: MarketStructurePoint[],
    period: number
  ): void {
    if (index < period + 5) return;

    const currentHigh = candles[index].high;
    const currentLow = candles[index].low;

    const recentHighs = structure
      .filter(sp => sp.type === 'HH' || sp.type === 'LH')
      .slice(-3);
    
    const recentLows = structure
      .filter(sp => sp.type === 'HL' || sp.type === 'LL')
      .slice(-3);

    if (recentHighs.length >= 2) {
      const lastHigh = recentHighs[recentHighs.length - 1].price;
      const prevHigh = recentHighs[recentHighs.length - 2].price;

      if (currentHigh > lastHigh && lastHigh > prevHigh) {
        structure.push({
          type: 'BOS',
          price: currentHigh,
          timestamp: candles[index].timestamp,
          candleIndex: index,
          direction: 'bullish',
        });
      }
    }

    if (recentLows.length >= 2) {
      const lastLow = recentLows[recentLows.length - 1].price;
      const prevLow = recentLows[recentLows.length - 2].price;

      if (currentLow < lastLow && lastLow < prevLow) {
        structure.push({
          type: 'BOS',
          price: currentLow,
          timestamp: candles[index].timestamp,
          candleIndex: index,
          direction: 'bearish',
        });
      }
    }

    if (recentHighs.length >= 2) {
      const lastHigh = recentHighs[recentHighs.length - 1];
      const prevHigh = recentHighs[recentHighs.length - 2];

      if (candles[index].low < prevHigh.price && lastHigh.type === 'LH') {
        structure.push({
          type: 'CHoCH',
          price: candles[index].low,
          timestamp: candles[index].timestamp,
          candleIndex: index,
          direction: 'bearish',
        });
      }
    }

    if (recentLows.length >= 2) {
      const lastLow = recentLows[recentLows.length - 1];
      const prevLow = recentLows[recentLows.length - 2];

      if (candles[index].high > prevLow.price && lastLow.type === 'HL') {
        structure.push({
          type: 'CHoCH',
          price: candles[index].high,
          timestamp: candles[index].timestamp,
          candleIndex: index,
          direction: 'bullish',
        });
      }
    }
  }

  private determineTrend(recentStructure: MarketStructurePoint[]): 'BULLISH' | 'BEARISH' | 'RANGING' {
    if (recentStructure.length < 3) return 'RANGING';

    const last3 = recentStructure.slice(-3);
    const bullishSignals = last3.filter(sp => sp.direction === 'bullish').length;
    const bearishSignals = last3.filter(sp => sp.direction === 'bearish').length;

    if (bullishSignals > bearishSignals + 1) return 'BULLISH';
    if (bearishSignals > bullishSignals + 1) return 'BEARISH';

    return 'RANGING';
  }

  private determinePhase(recentStructure: MarketStructurePoint[]): 'impulse' | 'correction' | 'consolidation' {
    if (recentStructure.length < 3) return 'consolidation';

    const prices = recentStructure.map(sp => sp.price);
    const volatility = this.calculateVolatility(prices);
    const trendStrength = this.calculateTrendStrength(prices);

    if (volatility > 0.02) {
      return 'impulse';
    } else if (trendStrength > 0.01) {
      return 'correction';
    }

    return 'consolidation';
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
    
    return Math.sqrt(variance) / avg;
  }

  private calculateTrendStrength(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const first = prices[0];
    const last = prices[prices.length - 1];
    
    return Math.abs(last - first) / first;
  }

  private findLastBOS(structure: MarketStructurePoint[]): {
    type: 'bullish' | 'bearish' | null;
    price: number;
    timestamp: number;
  } {
    const bos = structure.filter(sp => sp.type === 'BOS');
    
    if (bos.length === 0) {
      return { type: null, price: 0, timestamp: 0 };
    }

    const lastBOS = bos[bos.length - 1];
    
    return {
      type: lastBOS.direction,
      price: lastBOS.price,
      timestamp: lastBOS.timestamp,
    };
  }

  private findLastCHoCH(structure: MarketStructurePoint[]): {
    type: 'bullish' | 'bearish' | null;
    price: number;
    timestamp: number;
  } {
    const choch = structure.filter(sp => sp.type === 'CHoCH');
    
    if (choch.length === 0) {
      return { type: null, price: 0, timestamp: 0 };
    }

    const lastCHoCH = choch[choch.length - 1];
    
    return {
      type: lastCHoCH.direction,
      price: lastCHoCH.price,
      timestamp: lastCHoCH.timestamp,
    };
  }
}

export const marketStructureService = new MarketStructureService();
