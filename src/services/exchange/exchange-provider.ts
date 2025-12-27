import { BybitExchange } from "./bybit";
import { HyperliquidExchange } from "./hyperliquid";
import type { IExchange } from "./exchange-interface";
import { CONFIG } from "../../lib/config";

export class ExchangeProvider {
  private static instance: IExchange | null = null;

  static getInstance(): IExchange {
    if (!ExchangeProvider.instance) {
      ExchangeProvider.instance = ExchangeProvider.createExchange();
    }

    return ExchangeProvider.instance;
  }

  private static createExchange(): IExchange {
    const provider = CONFIG.exchange.provider.toLowerCase();

    switch (provider) {
      case 'bybit':
        return new BybitExchange();
      case 'hyperliquid':
        return new HyperliquidExchange();

      default:
        console.warn(`Exchange provider "${provider}" not found, using Bybit as default`);
        return new BybitExchange();
    }
  }
}

export const exchangeService = ExchangeProvider.getInstance();
