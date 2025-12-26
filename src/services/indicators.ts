import { SMA, EMA, RSI, MACD } from 'technicalindicators';
import { CONFIG } from '../lib/config';
import type { CandleData, TechnicalIndicators } from '../types/trading';

export class IndicatorsService {
  calculateRSI(candles: CandleData[], period: number = CONFIG.indicators.rsi.period): number {
    const closes = candles.map(c => c.close);
    const rsiInput = {
      values: closes,
      period,
    };
    const rsiValues = RSI.calculate(rsiInput);
    return rsiValues[rsiValues.length - 1] || 50;
  }

  calculateEMA(candles: CandleData[], period: number): number {
    const closes = candles.map(c => c.close);
    const emaInput = {
      values: closes,
      period,
    };
    const emaValues = EMA.calculate(emaInput);
    return emaValues[emaValues.length - 1] || candles[candles.length - 1].close;
  }

  calculateMACD(candles: CandleData[]): { macdLine: number; signalLine: number; histogram: number } {
    const closes = candles.map(c => c.close);
    const macdInput = {
      values: closes,
      fastPeriod: CONFIG.indicators.macd.fastPeriod,
      slowPeriod: CONFIG.indicators.macd.slowPeriod,
      signalPeriod: CONFIG.indicators.macd.signalPeriod,
    };
    const macdValues = MACD.calculate(macdInput);
    const latestMACD = macdValues[macdValues.length - 1];
    
    return {
      macdLine: latestMACD?.MACD || 0,
      signalLine: latestMACD?.signal || 0,
      histogram: latestMACD?.histogram || 0,
    };
  }

  calculateAllIndicators(candles: CandleData[]): TechnicalIndicators {
    const rsi = this.calculateRSI(candles);
    
    return {
      rsi,
      rsiPeriod: CONFIG.indicators.rsi.period,
      ema: {
        ema9: this.calculateEMA(candles, CONFIG.indicators.ema.short),
        ema21: this.calculateEMA(candles, CONFIG.indicators.ema.medium),
        ema50: this.calculateEMA(candles, CONFIG.indicators.ema.long),
      },
      macd: this.calculateMACD(candles),
    };
  }

  analyzeSupportResistance(candles: CandleData[]): {
    support: number[];
    resistance: number[];
    nearestSupport: number;
    nearestResistance: number;
  } {
    const currentPrice = candles[candles.length - 1].close;
    const swingPoints: number[] = [];
    
    const period = 5;
    for (let i = period; i < candles.length - period; i++) {
      const isSwingLow = candles.slice(i - period, i + period + 1).every(c => c.low >= candles[i].low);
      const isSwingHigh = candles.slice(i - period, i + period + 1).every(c => c.high <= candles[i].high);
      
      if (isSwingLow) swingPoints.push(candles[i].low);
      if (isSwingHigh) swingPoints.push(candles[i].high);
    }

    const support = swingPoints.filter(p => p < currentPrice).sort((a, b) => b - a);
    const resistance = swingPoints.filter(p => p > currentPrice).sort((a, b) => a - b);

    return {
      support: support.slice(0, 5),
      resistance: resistance.slice(0, 5),
      nearestSupport: support[0] || 0,
      nearestResistance: resistance[0] || 0,
    };
  }
}

export const indicatorsService = new IndicatorsService();
