import type { CandleData, OrderBlock } from '../../types/ict';

export class OrderBlockService {
  detectOrderBlocks(candles: CandleData[]): OrderBlock[] {
    const orderBlocks: OrderBlock[] = [];
    
    if (candles.length < 5) return orderBlocks;

    const marketStructure = this.getMarketStructure(candles);

    for (let i = 1; i < candles.length - 1; i++) {
      const candle = candles[i];
      const candleIsBearish = candle.close < candle.open;
      const candleIsBullish = candle.close > candle.open;

      if (candleIsBearish) {
        const bullTrendAfter = this.checkBullishImpulse(candles, i + 1);
        
        if (bullTrendAfter && this.isValidBearishOB(candle, candles, i)) {
          orderBlocks.push({
            type: 'bullish',
            high: candle.high,
            low: candle.low,
            open: candle.open,
            close: candle.close,
            timestamp: candle.timestamp,
            active: true,
            retested: false,
            retestedCount: 0,
            candleIndex: i,
          });
        }
      }

      if (candleIsBullish) {
        const bearTrendAfter = this.checkBearishImpulse(candles, i + 1);
        
        if (bearTrendAfter && this.isValidBullishOB(candle, candles, i)) {
          orderBlocks.push({
            type: 'bearish',
            high: candle.high,
            low: candle.low,
            open: candle.open,
            close: candle.close,
            timestamp: candle.timestamp,
            active: true,
            retested: false,
            retestedCount: 0,
            candleIndex: i,
          });
        }
      }
    }

    return this.trackRetests(orderBlocks, candles);
  }

  private getMarketStructure(candles: CandleData[]): {
    highs: number[];
    lows: number[];
  } {
    const period = 5;
    const highs: number[] = [];
    const lows: number[] = [];

    for (let i = period; i < candles.length - period; i++) {
      const isSwingHigh = candles.slice(i - period, i + period + 1).every(
        c => c.high <= candles[i].high
      );
      const isSwingLow = candles.slice(i - period, i + period + 1).every(
        c => c.low >= candles[i].low
      );

      if (isSwingHigh) highs.push(candles[i].high);
      if (isSwingLow) lows.push(candles[i].low);
    }

    return { highs, lows };
  }

  private checkBullishImpulse(candles: CandleData[], startIndex: number): boolean {
    if (startIndex + 5 >= candles.length) return false;

    let higherHighs = 0;
    let higherLows = 0;
    let lastHigh = candles[startIndex].high;
    let lastLow = candles[startIndex].low;

    for (let i = startIndex; i < startIndex + 5; i++) {
      if (candles[i].high > lastHigh) higherHighs++;
      if (candles[i].low > lastLow) higherLows++;
      lastHigh = candles[i].high;
      lastLow = candles[i].low;
    }

    return higherHighs >= 3 && higherLows >= 3;
  }

  private checkBearishImpulse(candles: CandleData[], startIndex: number): boolean {
    if (startIndex + 5 >= candles.length) return false;

    let lowerHighs = 0;
    let lowerLows = 0;
    let lastHigh = candles[startIndex].high;
    let lastLow = candles[startIndex].low;

    for (let i = startIndex; i < startIndex + 5; i++) {
      if (candles[i].high < lastHigh) lowerHighs++;
      if (candles[i].low < lastLow) lowerLows++;
      lastHigh = candles[i].high;
      lastLow = candles[i].low;
    }

    return lowerHighs >= 3 && lowerLows >= 3;
  }

  private isValidBearishOB(candle: CandleData, candles: CandleData[], index: number): boolean {
    const range = candle.high - candle.low;
    const avgRange = this.getAverageRange(candles, Math.max(0, index - 10), index + 10);
    
    return range >= avgRange * 0.5;
  }

  private isValidBullishOB(candle: CandleData, candles: CandleData[], index: number): boolean {
    const range = candle.high - candle.low;
    const avgRange = this.getAverageRange(candles, Math.max(0, index - 10), index + 10);
    
    return range >= avgRange * 0.5;
  }

  private getAverageRange(candles: CandleData[], start: number, end: number): number {
    if (start >= end) return 0;
    
    const validCandles = candles.slice(start, end);
    const totalRange = validCandles.reduce((sum, c) => sum + (c.high - c.low), 0);
    
    return totalRange / validCandles.length || 0;
  }

  private trackRetests(orderBlocks: OrderBlock[], candles: CandleData[]): OrderBlock[] {
    for (const ob of orderBlocks) {
      for (let i = ob.candleIndex + 1; i < candles.length; i++) {
        const candle = candles[i];
        let retested = false;

        if (ob.type === 'bullish') {
          if (candle.low <= ob.high && candle.low >= ob.low) {
            retested = true;
          }
          if (candle.close < ob.low) {
            ob.active = false;
            break;
          }
        }

        if (ob.type === 'bearish') {
          if (candle.high >= ob.low && candle.high <= ob.high) {
            retested = true;
          }
          if (candle.close > ob.high) {
            ob.active = false;
            break;
          }
        }

        if (retested) {
          ob.retested = true;
          ob.retestedCount++;
          ob.lastRetestPrice = ob.type === 'bullish' ? candle.low : candle.high;
          ob.lastRetestTimestamp = candle.timestamp;
        }
      }
    }

    return orderBlocks;
  }

  getActiveOrderBlocks(orderBlocks: OrderBlock[]): OrderBlock[] {
    return orderBlocks.filter(ob => ob.active);
  }

  getNearestOrderBlock(orderBlocks: OrderBlock[], currentPrice: number): OrderBlock | null {
    const activeOBs = this.getActiveOrderBlocks(orderBlocks);
    
    if (activeOBs.length === 0) return null;

    let nearest = activeOBs[0];
    let nearestDistance = Math.min(
      Math.abs(activeOBs[0].high - currentPrice),
      Math.abs(activeOBs[0].low - currentPrice)
    );

    for (const ob of activeOBs) {
      const distance = Math.min(
        Math.abs(ob.high - currentPrice),
        Math.abs(ob.low - currentPrice)
      );
      
      if (distance < nearestDistance) {
        nearest = ob;
        nearestDistance = distance;
      }
    }

    return nearest;
  }
}

export const orderBlockService = new OrderBlockService();
