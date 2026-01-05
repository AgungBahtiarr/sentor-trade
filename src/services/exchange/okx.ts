import ccxt from "ccxt";
import { CONFIG } from "../../lib/config";
import type { IExchange } from "./exchange-interface";
import type { CandleData, MarketData } from "../../types/trading";

export class OkxExchange implements IExchange {
  private exchange: ccxt.okx;

  constructor() {
    this.exchange = new ccxt.okx({
      apiKey: undefined,
      secret: undefined,
      enableRateLimit: true,
      timeout: 10000,
      options: {
        defaultType: "swap",
      },
    });
  }

  private toOkxSymbol(symbol: string): string {
    if (!symbol.includes("-") && symbol.endsWith("USDT")) {
      const base = symbol.slice(0, -5);
      return `${base}-USDT`;
    }
    return symbol;
  }

  async fetchCandles(
    symbol: string = CONFIG.exchange.defaultSymbol,
    timeframe: string = CONFIG.exchange.defaultTimeframe,
  ): Promise<CandleData[]> {
    try {
      const okxSymbol = this.toOkxSymbol(symbol);

      const ohlcv = await this.exchange.fetchOHLCV(
        okxSymbol,
        timeframe,
        undefined,
        CONFIG.exchange.candleLimit,
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
        `Failed to fetch candles from OKX: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getMarketData(
    symbol: string = CONFIG.exchange.defaultSymbol,
    timeframe: string = CONFIG.exchange.defaultTimeframe,
  ): Promise<MarketData> {
    try {
      const okxSymbol = this.toOkxSymbol(symbol);

      const [candles, ticker] = await Promise.all([
        this.fetchCandles(symbol, timeframe),
        this.exchange.fetchTicker(okxSymbol),
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
    symbol: string = CONFIG.exchange.defaultSymbol,
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
    symbol: string = CONFIG.exchange.defaultSymbol,
  ): Promise<number> {
    try {
      const okxSymbol = this.toOkxSymbol(symbol);
      const ticker = await this.exchange.fetchTicker(okxSymbol);
      return ticker.last || 0;
    } catch (error) {
      throw new Error(
        `Failed to get current price: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
