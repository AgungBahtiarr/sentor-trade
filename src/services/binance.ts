import ccxt from 'ccxt';
import { CONFIG } from '../lib/config';
import type { CandleData, MarketData } from '../types/trading';

export class BinanceService {
  private exchange: ccxt.binance;

  constructor() {
    this.exchange = new ccxt.binance({
      apiKey: undefined,
      secret: undefined,
      enableRateLimit: true,
      options: {
        defaultType: 'future',
      },
    });
  }

  async fetchCandles(symbol: string = CONFIG.binance.defaultSymbol, timeframe: string = CONFIG.binance.defaultTimeframe): Promise<CandleData[]> {
    try {
      const ohlcv = await this.exchange.fetchOHLCV(
        symbol,
        timeframe,
        undefined,
        CONFIG.binance.candleLimit
      );

      return ohlcv.map(([timestamp, open, high, low, close, volume]) => ({
        timestamp,
        open,
        high,
        low,
        close,
        volume,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch candles from Binance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getMarketData(symbol: string = CONFIG.binance.defaultSymbol, timeframe: string = CONFIG.binance.defaultTimeframe): Promise<MarketData> {
    try {
      const [candles, ticker] = await Promise.all([
        this.fetchCandles(symbol, timeframe),
        this.exchange.fetchTicker(symbol),
      ]);

      const currentPrice = ticker.last || candles[candles.length - 1].close;
      const priceChange = ticker.change || 0;
      const priceChangePercent = ticker.percentage || 0;

      return {
        symbol,
        timeframe,
        candles,
        currentPrice,
        priceChange,
        priceChangePercent,
      };
    } catch (error) {
      throw new Error(`Failed to get market data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCurrentPrice(symbol: string = CONFIG.binance.defaultSymbol): Promise<number> {
    try {
      const ticker = await this.exchange.fetchTicker(symbol);
      return ticker.last || 0;
    } catch (error) {
      throw new Error(`Failed to get current price: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const binanceService = new BinanceService();
