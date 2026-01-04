import type { CandleData } from '../types/trading';

export interface FractalPOI {
  type: 'FVG' | 'SWING_HIGH' | 'SWING_LOW' | 'ORDER_BLOCK';
  price: number;
  timeframe: string;
  strength: 'HIGH' | 'MEDIUM' | 'LOW';
  active: boolean;
}

export interface DailyBias {
  type: 'BULLISH_CONTINUATION' | 'BEARISH_CONTINUATION' | 'BULLISH_REVERSAL' | 'BEARISH_REVERSAL' | 'NEUTRAL';
  previousDay: {
    high: number;
    low: number;
    close: number;
  };
  currentDay: {
    high: number;
    low: number;
    close: number;
  };
  description: string;
}

export interface SwingPoint {
  type: 'HIGH' | 'LOW';
  price: number;
  index: number;
  timeframe: string;
}

export interface ChangeInStateDelivery {
  hasChange: boolean;
  type: 'BULLISH' | 'BEARISH' | null;
  timeframe: string;
  candleIndex: number;
  description: string;
}

export interface FractalData {
  dailyBias: DailyBias;
  swingPoints: SwingPoint[];
  pois: FractalPOI[];
  cisds: ChangeInStateDelivery[];
}

export class FractalService {
  private findSwingPoints(candles: CandleData[], period: number = 3): SwingPoint[] {
    const swingPoints: SwingPoint[] = [];
    
    for (let i = period; i < candles.length - period; i++) {
      const current = candles[i];
      const leftCandles = candles.slice(i - period, i);
      const rightCandles = candles.slice(i + 1, i + period + 1);
      
      const isSwingHigh = leftCandles.every(c => c.high <= current.high) && 
                          rightCandles.every(c => c.high < current.high);
      
      const isSwingLow = leftCandles.every(c => c.low >= current.low) && 
                         rightCandles.every(c => c.low > current.low);
      
      if (isSwingHigh) {
        swingPoints.push({
          type: 'HIGH',
          price: current.high,
          index: i,
          timeframe: 'current',
        });
      }
      
      if (isSwingLow) {
        swingPoints.push({
          type: 'LOW',
          price: current.low,
          index: i,
          timeframe: 'current',
        });
      }
    }
    
    return swingPoints;
  }

  private detectFVG(candles: CandleData[]): FractalPOI[] {
    const fvgs: FractalPOI[] = [];
    
    for (let i = 1; i < candles.length - 1; i++) {
      const prevCandle = candles[i - 1];
      const currCandle = candles[i];
      const nextCandle = candles[i + 1];
      
      const top = Math.min(currCandle.high, nextCandle.high);
      const bottom = Math.max(currCandle.low, nextCandle.low);
      
      if (top > prevCandle.low) {
        fvgs.push({
          type: 'FVG',
          price: (top + bottom) / 2,
          timeframe: 'current',
          strength: 'HIGH',
          active: true,
        });
      }
      
      if (bottom < prevCandle.high) {
        fvgs.push({
          type: 'FVG',
          price: (top + bottom) / 2,
          timeframe: 'current',
          strength: 'HIGH',
          active: true,
        });
      }
    }
    
    return fvgs;
  }

  private detectOrderBlocks(candles: CandleData[]): FractalPOI[] {
    const obs: FractalPOI[] = [];
    
    for (let i = 1; i < candles.length; i++) {
      const prevCandle = candles[i - 1];
      const currCandle = candles[i];
      
      const prevIsBullish = prevCandle.close > prevCandle.open;
      const currIsBearish = currCandle.close < currCandle.open;
      
      if (prevIsBullish && currIsBearish && currCandle.close < prevCandle.open) {
        obs.push({
          type: 'ORDER_BLOCK',
          price: prevCandle.close,
          timeframe: 'current',
          strength: 'HIGH',
          active: true,
        });
      }
      
      const prevIsBearish = prevCandle.close < prevCandle.open;
      const currIsBullish = currCandle.close > currCandle.open;
      
      if (prevIsBearish && currIsBullish && currCandle.close > prevCandle.open) {
        obs.push({
          type: 'ORDER_BLOCK',
          price: prevCandle.close,
          timeframe: 'current',
          strength: 'HIGH',
          active: true,
        });
      }
    }
    
    return obs;
  }

  private detectCISD(candles: CandleData[]): ChangeInStateDelivery[] {
    const cisds: ChangeInStateDelivery[] = [];
    
    for (let i = 3; i < candles.length; i++) {
      const recentCandles = candles.slice(i - 3, i + 1);
      
      const lastCandle = recentCandles[3];
      const prevCandle = recentCandles[2];
      
      const lastIsBullish = lastCandle.close > lastCandle.open;
      const prevIsBearish = prevCandle.close < prevCandle.open;
      
      if (lastIsBullish && prevIsBearish && lastCandle.close > prevCandle.high) {
        cisds.push({
          hasChange: true,
          type: 'BULLISH',
          timeframe: 'current',
          candleIndex: i,
          description: 'Bullish change in state - close above previous bearish candle',
        });
      }
      
      const lastIsBearish = lastCandle.close < lastCandle.open;
      const prevIsBullish = prevCandle.close > prevCandle.open;
      
      if (lastIsBearish && prevIsBullish && lastCandle.close < prevCandle.low) {
        cisds.push({
          hasChange: true,
          type: 'BEARISH',
          timeframe: 'current',
          candleIndex: i,
          description: 'Bearish change in state - close below previous bullish candle',
        });
      }
    }
    
    return cisds;
  }

  analyzeDailyBias(dailyCandles: CandleData[]): DailyBias {
    if (dailyCandles.length < 2) {
      return {
        type: 'NEUTRAL',
        previousDay: { high: 0, low: 0, close: 0 },
        currentDay: { high: 0, low: 0, close: 0 },
        description: 'Not enough daily data',
      };
    }

    const prevDay = dailyCandles[dailyCandles.length - 2];
    const currentDay = dailyCandles[dailyCandles.length - 1];

    const prevHigh = prevDay.high;
    const prevLow = prevDay.low;
    const currentClose = currentDay.close;

    if (currentClose > prevHigh) {
      return {
        type: 'BULLISH_CONTINUATION',
        previousDay: { high: prevHigh, low: prevLow, close: prevDay.close },
        currentDay: { high: currentDay.high, low: currentDay.low, close: currentDay.close },
        description: `Bullish Continuation: Close (${currentClose}) above previous day high (${prevHigh})`,
      };
    }

    if (currentClose < prevLow) {
      return {
        type: 'BEARISH_CONTINUATION',
        previousDay: { high: prevHigh, low: prevLow, close: prevDay.close },
        currentDay: { high: currentDay.high, low: currentDay.low, close: currentDay.close },
        description: `Bearish Continuation: Close (${currentClose}) below previous day low (${prevLow})`,
      };
    }

    const sweptLow = currentDay.low < prevLow && currentClose > prevLow;
    const sweptHigh = currentDay.high > prevHigh && currentClose < prevHigh;

    if (sweptLow) {
      return {
        type: 'BULLISH_REVERSAL',
        previousDay: { high: prevHigh, low: prevLow, close: prevDay.close },
        currentDay: { high: currentDay.high, low: currentDay.low, close: currentDay.close },
        description: `Bullish Reversal: Swept low (${prevLow}) but closed back above it at ${currentClose}`,
      };
    }

    if (sweptHigh) {
      return {
        type: 'BEARISH_REVERSAL',
        previousDay: { high: prevHigh, low: prevLow, close: prevDay.close },
        currentDay: { high: currentDay.high, low: currentDay.low, close: currentDay.close },
        description: `Bearish Reversal: Swept high (${prevHigh}) but closed back below it at ${currentClose}`,
      };
    }

    return {
      type: 'NEUTRAL',
      previousDay: { high: prevHigh, low: prevLow, close: prevDay.close },
      currentDay: { high: currentDay.high, low: currentDay.low, close: currentDay.close },
      description: `Neutral: Close (${currentClose}) within previous day range (${prevLow} - ${prevHigh})`,
    };
  }

  analyzeFractal(
    dailyCandles: CandleData[],
    structureCandles: CandleData[],
    entryCandles: CandleData[],
  ): FractalData {
    const dailyBias = this.analyzeDailyBias(dailyCandles);
    
    const structureSwingPoints = this.findSwingPoints(structureCandles, 3);
    const structureFVGs = this.detectFVG(structureCandles);
    const structureOBs = this.detectOrderBlocks(structureCandles);
    
    const entryCISDs = this.detectCISD(entryCandles);
    const entrySwingPoints = this.findSwingPoints(entryCandles, 2);

    const pois: FractalPOI[] = [
      ...structureFVGs.map((fvg, i) => ({ ...fvg, timeframe: 'structure', strength: i === 0 ? 'HIGH' : 'MEDIUM' })),
      ...structureOBs.map((ob, i) => ({ ...ob, timeframe: 'structure', strength: i === 0 ? 'HIGH' : 'MEDIUM' })),
      ...structureSwingPoints.slice(-3).map(sp => ({
        type: sp.type === 'HIGH' ? 'SWING_HIGH' : 'SWING_LOW',
        price: sp.price,
        timeframe: 'structure',
        strength: 'HIGH',
        active: true,
      })),
    ];

    return {
      dailyBias,
      swingPoints: [...structureSwingPoints, ...entrySwingPoints],
      pois,
      cisds: entryCISDs,
    };
  }
}

export const fractalService = new FractalService();
