import type { CandleData, MarketData } from '../../types/trading';

export interface IExchange {
  fetchCandles(
    symbol: string,
    timeframe: string,
  ): Promise<CandleData[]>;

  getMarketData(
    symbol: string,
    timeframe: string,
  ): Promise<MarketData>;

  getCurrentPrice(
    symbol: string,
  ): Promise<number>;

  getMultiTimeframeData(
    symbol: string,
    timeframes: string[],
  ): Promise<Record<string, CandleData[]>>;
}
