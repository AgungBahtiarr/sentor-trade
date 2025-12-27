import type { IExchange } from "./exchange-interface";
import type { CandleData, MarketData } from "../../types/trading";

interface HyperliquidCandle {
  T: number; // close time
  c: string; // close price
  h: string; // high
  l: string; // low
  o: string; // open
  v: string; // volume
  n: number; // number of trades
  s: string; // symbol
  t: number; // open time
}

export class HyperliquidExchange implements IExchange {
  private baseUrl = "https://api.hyperliquid.xyz/info";

  private toHyperliquidSymbol(symbol: string): string {
    if (symbol.endsWith("USDT")) {
      return symbol.slice(0, -4);
    }
    return symbol;
  }

  async fetchCandles(
    symbol: string = "BTC",
    timeframe: string = "15m",
  ): Promise<CandleData[]> {
    try {
      const now = Date.now();
      const startTime = now - (100 * 60 * 60 * 1000); // 100 hours ago for enough data

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "candleSnapshot",
          req: {
            coin: this.toHyperliquidSymbol(symbol),
            interval: timeframe,
            startTime,
            endTime: now,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: HyperliquidCandle[] = await response.json();

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((candle) => ({
        timestamp: candle.t,
        open: parseFloat(candle.o),
        high: parseFloat(candle.h),
        low: parseFloat(candle.l),
        close: parseFloat(candle.c),
        volume: parseFloat(candle.v),
      })).sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error(`Error fetching candles for ${symbol}:`, error);
      throw new Error(
        `Failed to fetch candles from Hyperliquid: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getMarketData(
    symbol: string = "BTC",
    timeframe: string = "15m",
  ): Promise<MarketData> {
    try {
      const [candles, prices] = await Promise.all([
        this.fetchCandles(symbol, timeframe),
        this.getAllPrices(),
      ]);

      const currentPrice = parseFloat(prices[this.toHyperliquidSymbol(symbol)] || "0");

      return {
        symbol,
        timeframe,
        candles,
        currentPrice,
        priceChange: 0, // Hyperliquid doesn't provide change in allMids
        priceChangePercent: 0,
      };
    } catch (error) {
      throw new Error(
        `Failed to get market data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getMultiTimeframeData(
    symbol: string = "BTC",
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

  async getCurrentPrice(symbol: string = "BTC"): Promise<number> {
    try {
      const prices = await this.getAllPrices();
      return parseFloat(prices[this.toHyperliquidSymbol(symbol)] || "0");
    } catch (error) {
      throw new Error(
        `Failed to get current price: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async getAllPrices(): Promise<Record<string, string>> {
    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "allMids",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: Record<string, string> = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching prices from Hyperliquid:", error);
      throw new Error(
        `Failed to fetch prices: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}