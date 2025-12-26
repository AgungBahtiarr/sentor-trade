import type { CandleData, FairValueGap } from '../../types/ict';

export class FVGService {
  detectFairValueGaps(candles: CandleData[]): FairValueGap[] {
    const fvgs: FairValueGap[] = [];
    
    if (candles.length < 3) return fvgs;

    for (let i = 2; i < candles.length; i++) {
      const candle1 = candles[i - 2];
      const candle2 = candles[i - 1];
      const candle3 = candles[i];

      const fvg = this.detectFVG(candle1, candle2, candle3, i);
      
      if (fvg) {
        fvgs.push(fvg);
      }
    }

    return this.markFilledFVGs(fvgs, candles);
  }

  private detectFVG(
    candle1: CandleData,
    candle2: CandleData,
    candle3: CandleData,
    index: number
  ): FairValueGap | null {
    let fvg: FairValueGap | null = null;

    if (this.isBullishFVG(candle1, candle2, candle3)) {
      const low = candle2.low;
      const high = candle1.high;
      
      if (high > low) {
        const gapSize = high - low;
        fvg = {
          type: 'bullish',
          high,
          low,
          mid: (high + low) / 2,
          timestamp: candle2.timestamp,
          filled: false,
          candleIndex: index,
          strength: this.calculateFVGStrength(gapSize, candle3.close - candle3.open),
        };
      }
    } else if (this.isBearishFVG(candle1, candle2, candle3)) {
      const high = candle2.high;
      const low = candle1.low;
      
      if (high > low) {
        const gapSize = high - low;
        fvg = {
          type: 'bearish',
          high,
          low,
          mid: (high + low) / 2,
          timestamp: candle2.timestamp,
          filled: false,
          candleIndex: index,
          strength: this.calculateFVGStrength(gapSize, candle3.open - candle3.close),
        };
      }
    }

    return fvg;
  }

  private isBullishFVG(candle1: CandleData, candle2: CandleData, candle3: CandleData): boolean {
    const candle1Bullish = candle1.close > candle1.open;
    const candle3Bullish = candle3.close > candle3.open;
    
    return candle1Bullish && candle3Bullish && candle1.high < candle3.low;
  }

  private isBearishFVG(candle1: CandleData, candle2: CandleData, candle3: CandleData): boolean {
    const candle1Bearish = candle1.close < candle1.open;
    const candle3Bearish = candle3.close < candle3.open;
    
    return candle1Bearish && candle3Bearish && candle1.low > candle3.high;
  }

  private calculateFVGStrength(gapSize: number, candleRange: number): 'weak' | 'moderate' | 'strong' {
    const ratio = gapSize / (candleRange || 1);
    
    if (ratio < 0.1) return 'weak';
    if (ratio < 0.3) return 'moderate';
    return 'strong';
  }

  private markFilledFVGs(fvgs: FairValueGap[], candles: CandleData[]): FairValueGap[] {
    for (const fvg of fvgs) {
      if (fvg.filled) continue;

      for (let i = fvg.candleIndex + 1; i < candles.length; i++) {
        const candle = candles[i];
        
        if (fvg.type === 'bullish' && candle.low <= fvg.low) {
          fvg.filled = true;
          fvg.filledTimestamp = candle.timestamp;
          break;
        }
        
        if (fvg.type === 'bearish' && candle.high >= fvg.high) {
          fvg.filled = true;
          fvg.filledTimestamp = candle.timestamp;
          break;
        }
      }
    }

    return fvgs;
  }

  getActiveFVGs(fvgs: FairValueGap[]): FairValueGap[] {
    return fvgs.filter(fvg => !fvg.filled);
  }

  getNearestFVG(fvgs: FairValueGap[], currentPrice: number): FairValueGap | null {
    const activeFVGs = this.getActiveFVGs(fvgs);
    
    if (activeFVGs.length === 0) return null;

    let nearest = activeFVGs[0];
    let nearestDistance = Math.abs(activeFVGs[0].mid - currentPrice);

    for (const fvg of activeFVGs) {
      const distance = Math.abs(fvg.mid - currentPrice);
      
      if (distance < nearestDistance) {
        nearest = fvg;
        nearestDistance = distance;
      }
    }

    return nearest;
  }
}

export const fvgService = new FVGService();
