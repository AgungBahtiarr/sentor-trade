import ccxt from "ccxt";
import { CONFIG } from "../lib/config";
import type { CandleData, MarketData } from "../types/trading";

export class BinanceService {
  private exchange: ccxt.binance;

  constructor() {
    this.exchange = new ccxt.binance({
      apiKey: undefined,
      secret: undefined,
      enableRateLimit: true,
      timeout: 10000,
      options: {
        defaultType: "future",
      },
    });
  }

  async fetchCandles(
    symbol: string = CONFIG.binance.defaultSymbol,
    timeframe: string = CONFIG.binance.defaultTimeframe,
  ): Promise<CandleData[]> {
    try {
      const ohlcv = await this.exchange.fetchOHLCV(
        symbol,
        timeframe,
        undefined,
        CONFIG.binance.candleLimit,
      );

      if (!ohlcv || !Array.isArray(ohlcv)) {
        return [];
      }

      return ohlcv.map((candle) => ({
        timestamp: candle[0] || 0,
        open: candle[1] || 0,
        high: candle[2] || 0,
        low: candle[3] || 0,
        close: candle[4] || 0,
        volume: candle[5] || 0,
      }));
    } catch (error) {
      console.error(`Error fetching candles for ${symbol}:`, error);
      throw new Error(
        `Failed to fetch candles from Binance: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getMarketData(
    symbol: string = CONFIG.binance.defaultSymbol,
    timeframe: string = CONFIG.binance.defaultTimeframe,
  ): Promise<MarketData> {
    try {
      const [candles, ticker] = await Promise.all([
        this.fetchCandles(symbol, timeframe),
        this.exchange.fetchTicker(symbol),
      ]);

      const currentPrice =
        ticker?.last || candles[candles.length - 1]?.close || 0;

      return {
        symbol,
        timeframe,
        candles,
        currentPrice,
        priceChange: ticker?.change || 0,
        priceChangePercent: ticker?.percentage || 0,
      };
    } catch (error) {
      throw new Error(
        `Failed to get market data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getMultiTimeframeData(
    symbol: string = CONFIG.binance.defaultSymbol,
    timeframes: string[] = ["1h", "4h"],
  ): Promise<Record<string, CandleData[]>> {
    try {
      const promises = timeframes.map((tf) => this.fetchCandles(symbol, tf));
      const results = await Promise.all(promises);

      return timeframes.reduce(
        (acc, tf, index) => {
          acc[tf] = results[index];
          return acc;
        },
        {} as Record<string, CandleData[]>,
      );
    } catch (error) {
      throw new Error(
        `Failed to get multi-timeframe data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getCurrentPrice(
    symbol: string = CONFIG.binance.defaultSymbol,
  ): Promise<number> {
    try {
      const ticker = await this.exchange.fetchTicker(symbol);
      return ticker.last || 0;
    } catch (error) {
      throw new Error(
        `Failed to get current price: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export const binanceService = new BinanceService();
