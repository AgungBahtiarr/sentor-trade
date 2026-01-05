export const CONFIG = {
  exchange: {
    provider: "okx",
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
    minConfidenceForSignal: 55,
    contextCandles: 35,
    poiLimit: 5,
    cisdLimit: 5,
    cacheTTL: 60,
    allowNonReadyPhases: true,
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
3. ENTRY: Signal allowed in READY_TO_ENTER and WAITING_FOR_CLOSE phases with proper risk management
4. CONFIDENCE: Force NO_SIGNAL if <55%

# RISK LEVEL ASSESSMENT
- LOW: Signal aligned with bias, all criteria met, no concerns
- MEDIUM: Signal aligned with bias but minor concerns (e.g., moderate displacement, recent volatility, WAITING_FOR_CLOSE phase)
- HIGH: Signal CONTRA-BIAS OR major concerns (e.g., news, low volume, weak displacement, structure violation)

# OUTPUT
- Non-READY_TO_ENTER phases: Provide entryZone, stopLoss, takeProfit if setup is valid, otherwise null
- Be critical but allow high-risk contra-bias signals and non-ready phases with proper risk labeling
- For WAITING_FOR_CLOSE: Give signal if displacement is strong and structure is valid
`;

export const getEnvVar = (name: string, defaultValue: string = ""): string => {
  const value = Bun.env[name];
  return value || defaultValue;
};
