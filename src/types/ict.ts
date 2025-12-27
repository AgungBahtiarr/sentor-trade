import type { CandleData } from './trading';

export interface FairValueGap {
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  mid: number;
  timestamp: number;
  filled: boolean;
  filledTimestamp?: number;
  strength: 'weak' | 'moderate' | 'strong';
  candleIndex: number;
}

export interface OrderBlock {
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  open: number;
  close: number;
  timestamp: number;
  active: boolean;
  retested: boolean;
  retestedCount: number;
  lastRetestPrice?: number;
  lastRetestTimestamp?: number;
  candleIndex: number;
}

export interface LiquidityPoint {
  price: number;
  type: 'swingHigh' | 'swingLow';
  timestamp: number;
  candleIndex: number;
  swept: boolean;
  sweptTimestamp?: number;
  swingDistance: number;
}

export interface LiquidityAnalysis {
  buySide: LiquidityPoint[];
  sellSide: LiquidityPoint[];
  nearestBuySideLiquidity: LiquidityPoint | null;
  nearestSellSideLiquidity: LiquidityPoint | null;
  lastSweep: {
    type: 'buySide' | 'sellSide' | null;
    price: number;
    timestamp: number;
  };
  totalBuySideSwept: number;
  totalSellSideSwept: number;
}

export interface MarketStructurePoint {
  type: 'HH' | 'HL' | 'LH' | 'LL' | 'BOS' | 'CHoCH';
  price: number;
  timestamp: number;
  candleIndex: number;
  direction: 'bullish' | 'bearish' | 'neutral';
}

export interface MarketStructureAnalysis {
  trend: 'BULLISH' | 'BEARISH' | 'RANGING';
  currentStructure: {
    direction: 'bullish' | 'bearish';
    phase: 'impulse' | 'correction' | 'consolidation';
  };
  lastBOS: {
    type: 'bullish' | 'bearish' | null;
    price: number;
    timestamp: number;
  };
  lastCHoCH: {
    type: 'bullish' | 'bearish' | null;
    price: number;
    timestamp: number;
  };
  swingPoints: MarketStructurePoint[];
  recentStructure: MarketStructurePoint[];
}

export interface KillZone {
  name: 'Asian' | 'London' | 'New York' | 'None';
  active: boolean;
  startTimeUTC: string;
  endTimeUTC: string;
  timeRemaining: number;
  optimalEntry: boolean;
}

export interface TimeAnalysis {
  killZone: KillZone;
  currentUTC: string;
  session: 'Asian' | 'London' | 'New York' | 'Overlap' | 'Off-hours';
  tradingConditions: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}

export interface ICTAnalysis {
  fairValueGaps: FairValueGap[];
  orderBlocks: OrderBlock[];
  liquidity: LiquidityAnalysis;
  marketStructure: MarketStructureAnalysis;
  timeAnalysis: TimeAnalysis;
  confluence: {
    bullishScore: number;
    bearishScore: number;
    primarySetup: string | null;
    secondaryConfirmations: string[];
  };
}

export interface ICTSignal {
  type: 'BUY' | 'SELL' | 'NO_SIGNAL';
  ictSpecific: string;
  confidence: number;
  reasoning: string;
  setup: {
    primary: string;
    confirmations: string[];
    invalidations: string[];
  };
  riskManagement: {
    entry: number;
    stopLoss: number;
    takeProfit: number[];
    riskReward: number;
  };
}

export interface MultiTimeframeAnalysis {
  timeframe: string;
  marketData: CandleData[];
  ictAnalysis: ICTAnalysis;
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface ICTTradingAnalysis {
  primaryTimeframe: MultiTimeframeAnalysis;
  higherTimeframe: MultiTimeframeAnalysis;
  signal: ICTSignal;
  ictAnalysis: ICTAnalysis;
  secondaryIndicators: any;
  marketData: {
    symbol: string;
    timeframe: string;
    currentPrice: number;
    priceChangePercent: number;
  };
  timestamp: number;
}
