export const CONFIG = {
  bybit: {
    apiUrl: "https://api.bybit.com",
    defaultSymbol: "BTCUSDT",
    defaultTimeframe: "15m",
    candleLimit: 100,
  },
  indicators: {
    rsi: {
      period: 14,
      overbought: 70,
      oversold: 30,
    },
    ema: {
      short: 9,
      medium: 21,
      long: 50,
    },
    macd: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    },
  },
  ai: {
    model: "nex-agi/deepseek-v3.1-nex-n1:free",
    temperature: 0.7,
    maxTokens: 1000,
    minConfidenceForSignal: 70,
  },
};

export const getEnvVar = (name: string, defaultValue: string = ""): string => {
  const value = process.env[name];
  return value || defaultValue;
};
