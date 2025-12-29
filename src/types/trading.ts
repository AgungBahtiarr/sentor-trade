export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi: number;
  rsiPeriod: number;
  ema: {
    ema9: number;
    ema21: number;
    ema50: number;
  };
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
  };
}

export interface MarketData {
  symbol: string;
  timeframe: string;
  candles: CandleData[];
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
}

export interface TradingSignal {
  signal: 'BUY' | 'SELL' | 'NO_SIGNAL';
  confidence: number;
  reasoning: string;
}

export interface TrendAnalysis {
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  description: string;
}

export interface SupportResistance {
  support: number[];
  resistance: number[];
  nearestSupport: number;
  nearestResistance: number;
}

export type AnalysisMode = 'STANDARD' | 'ICT' | 'FIGHTER';

export interface TradingAnalysis {
  marketData: MarketData;
  indicators: TechnicalIndicators;
  signal: TradingSignal;
  trend: TrendAnalysis;
  supportResistance: SupportResistance;
  timestamp: number;
}
