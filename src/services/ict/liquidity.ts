import type { CandleData, LiquidityPoint, LiquidityAnalysis } from '../../types/ict';

export class LiquidityService {
  analyzeLiquidity(candles: CandleData[]): LiquidityAnalysis {
    const swingPoints = this.identifySwingPoints(candles);
    
    const buySideLiquidity = swingPoints.filter(sp => sp.type === 'swingHigh');
    const sellSideLiquidity = swingPoints.filter(sp => sp.type === 'swingLow');

    const trackedLiquidity = this.trackSweeps(buySideLiquidity, sellSideLiquidity, candles);

    return {
      buySide: trackedLiquidity.buySide,
      sellSide: trackedLiquidity.sellSide,
      nearestBuySideLiquidity: this.findNearestLiquidity(trackedLiquidity.buySide, candles[candles.length - 1].high),
      nearestSellSideLiquidity: this.findNearestLiquidity(trackedLiquidity.sellSide, candles[candles.length - 1].low),
      lastSweep: this.detectLastSweep(trackedLiquidity.buySide, trackedLiquidity.sellSide),
      totalBuySideSwept: trackedLiquidity.buySide.filter(sp => sp.swept).length,
      totalSellSideSwept: trackedLiquidity.sellSide.filter(sp => sp.swept).length,
    };
  }

  private identifySwingPoints(candles: CandleData[]): LiquidityPoint[] {
    const swingPoints: LiquidityPoint[] = [];
    const period = 5;

    if (candles.length < period * 2 + 1) return swingPoints;

    for (let i = period; i < candles.length - period; i++) {
      const isSwingHigh = this.isSwingHigh(candles, i, period);
      const isSwingLow = this.isSwingLow(candles, i, period);

      if (isSwingHigh) {
        const distance = this.calculateSwingDistance(candles, i, 'high');
        swingPoints.push({
          price: candles[i].high,
          type: 'swingHigh',
          timestamp: candles[i].timestamp,
          candleIndex: i,
          swept: false,
          swingDistance: distance,
        });
      }

      if (isSwingLow) {
        const distance = this.calculateSwingDistance(candles, i, 'low');
        swingPoints.push({
          price: candles[i].low,
          type: 'swingLow',
          timestamp: candles[i].timestamp,
          candleIndex: i,
          swept: false,
          swingDistance: distance,
        });
      }
    }

    return swingPoints;
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

  private calculateSwingDistance(candles: CandleData[], index: number, type: 'high' | 'low'): number {
    let maxDistance = 0;
    const lookback = 20;
    const start = Math.max(0, index - lookback);
    const end = Math.min(candles.length - 1, index + lookback);

    for (let i = start; i <= end; i++) {
      if (i === index) continue;
      
      if (type === 'high') {
        const distance = Math.abs(candles[i].high - candles[index].high);
        if (distance > maxDistance) maxDistance = distance;
      } else {
        const distance = Math.abs(candles[i].low - candles[index].low);
        if (distance > maxDistance) maxDistance = distance;
      }
    }

    return maxDistance;
  }

  private trackSweeps(
    buySide: LiquidityPoint[],
    sellSide: LiquidityPoint[],
    candles: CandleData[]
  ): { buySide: LiquidityPoint[]; sellSide: LiquidityPoint[] } {
    const currentPrice = candles[candles.length - 1].close;

    for (const lp of buySide) {
      if (lp.swept) continue;
      
      for (let i = lp.candleIndex + 1; i < candles.length; i++) {
        if (candles[i].high > lp.price) {
          lp.swept = true;
          lp.sweptTimestamp = candles[i].timestamp;
          break;
        }
      }
    }

    for (const lp of sellSide) {
      if (lp.swept) continue;
      
      for (let i = lp.candleIndex + 1; i < candles.length; i++) {
        if (candles[i].low < lp.price) {
          lp.swept = true;
          lp.sweptTimestamp = candles[i].timestamp;
          break;
        }
      }
    }

    return { buySide, sellSide };
  }

  private detectLastSweep(
    buySide: LiquidityPoint[],
    sellSide: LiquidityPoint[]
  ): { type: 'buySide' | 'sellSide' | null; price: number; timestamp: number } {
    let lastBuySweep: LiquidityPoint | null = null;
    let lastSellSweep: LiquidityPoint | null = null;

    for (const lp of buySide) {
      if (lp.swept && (!lastBuySweep || lp.sweptTimestamp! > lastBuySweep.sweptTimestamp!)) {
        lastBuySweep = lp;
      }
    }

    for (const lp of sellSide) {
      if (lp.swept && (!lastSellSweep || lp.sweptTimestamp! > lastSellSweep.sweptTimestamp!)) {
        lastSellSweep = lp;
      }
    }

    if (!lastBuySweep && !lastSellSweep) {
      return { type: null, price: 0, timestamp: 0 };
    }

    if (lastBuySweep && !lastSellSweep) {
      return { type: 'buySide', price: lastBuySweep.price, timestamp: lastBuySweep.sweptTimestamp! };
    }

    if (!lastBuySweep && lastSellSweep) {
      return { type: 'sellSide', price: lastSellSweep.price, timestamp: lastSellSweep.sweptTimestamp! };
    }

    if (lastBuySweep!.sweptTimestamp! > lastSellSweep!.sweptTimestamp!) {
      return { type: 'buySide', price: lastBuySweep!.price, timestamp: lastBuySweep!.sweptTimestamp! };
    }

    return { type: 'sellSide', price: lastSellSweep!.price, timestamp: lastSellSweep!.sweptTimestamp! };
  }

  private findNearestLiquidity(liquidityPoints: LiquidityPoint[], currentPrice: number): LiquidityPoint | null {
    const unswept = liquidityPoints.filter(lp => !lp.swept);
    
    if (unswept.length === 0) return null;

    let nearest = unswept[0];
    let nearestDistance = Math.abs(unswept[0].price - currentPrice);

    for (const lp of unswept) {
      const distance = Math.abs(lp.price - currentPrice);
      if (distance < nearestDistance) {
        nearest = lp;
        nearestDistance = distance;
      }
    }

    return nearest;
  }
}

export const liquidityService = new LiquidityService();
