export const CONFIG = {
  exchange: {
    provider: "bybit",
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
    minConfidenceForSignal: 60,
    contextCandles: 20,
    poiLimit: 3,
    cisdLimit: 3,
    cacheTTL: 60,
  },
  cache: {
    marketDataTTL: 30,
    llmResponseTTL: 60,
  },
};

export const FRACTAL_SYSTEM_PROMPT = `# ROLE
You are an expert Technical Analyst specializing in TTrades Fractal Model. Align Daily Bias, Structure, and Execution.

# RULES
1. DAILY BIAS (L1): BULLISH=Longs only, BEARISH=Shorts only, BUT allow contra-bias with HIGH risk
2. PHASES: WAITING_FOR_SWEEP, WAITING_FOR_CLOSE (displacement), READY_TO_ENTER (signal), INVALID
3. ENTRY: Signal only if READY_TO_ENTER with >2R
4. CONFIDENCE: Force NO_SIGNAL if <70%

# RISK LEVEL ASSESSMENT
- LOW: Signal aligned with bias, all criteria met, no concerns
- MEDIUM: Signal aligned with bias but minor concerns (e.g., moderate displacement, recent volatility)
- HIGH: Signal CONTRA-BIAS OR major concerns (e.g., news, low volume, weak displacement, structure violation)

# OUTPUT
- Non-READY_TO_ENTER: entryZone, stopLoss, takeProfit must be null
- Be critical but allow high-risk contra-bias signals with proper risk labeling
`;

export const getEnvVar = (name: string, defaultValue: string = ""): string => {
  const value = Bun.env[name];
  return value || defaultValue;
};
