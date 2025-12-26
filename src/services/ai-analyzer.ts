import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { CONFIG } from '../lib/config';
import { getEnvVar } from '../lib/config';
import type { MarketData, TechnicalIndicators, TradingSignal, TrendAnalysis } from '../types/trading';

export class AIAnalyzerService {
  private openRouter;

  constructor() {
    const apiKey = getEnvVar('OPENROUTER_API_KEY');
    if (apiKey) {
      this.openRouter = createOpenRouter({
        apiKey,
      });
    }
  }

  private buildAnalysisPrompt(marketData: MarketData, indicators: TechnicalIndicators): string {
    const { symbol, timeframe, currentPrice, priceChangePercent, candles } = marketData;
    const { rsi, ema, macd } = indicators;
    
    const recentCandles = candles.slice(-5).map(c => ({
      open: c.open.toFixed(2),
      high: c.high.toFixed(2),
      low: c.low.toFixed(2),
      close: c.close.toFixed(2),
    }));

    return `You are an expert cryptocurrency futures trader and technical analyst with deep knowledge of market dynamics, price action, and risk management. Analyze the provided market data and provide a comprehensive trading analysis for ${symbol} on ${timeframe} timeframe.

## MARKET DATA

### Current Market State
- Symbol: ${symbol}
- Timeframe: ${timeframe}
- Current Price: $${currentPrice.toFixed(2)}
- 24h Price Change: ${priceChangePercent.toFixed(2)}%

### Recent Price Action (Last 5 Candles)
${recentCandles.map((c, i) => `Candle ${i + 1}: O=${c.open}, H=${c.high}, L=${c.low}, C=${c.close}`).join('\n')}

### Technical Indicators

#### RSI (Relative Strength Index)
- Current RSI: ${rsi.toFixed(2)}
- Period: ${indicators.rsiPeriod}
- Overbought Zone: >70
- Oversold Zone: <30

#### EMA (Exponential Moving Average)
- EMA 9 (Short-term): ${ema.ema9.toFixed(2)}
- EMA 21 (Medium-term): ${ema.ema21.toFixed(2)}
- EMA 50 (Long-term): ${ema.ema50.toFixed(2)}
- Price vs EMA9: ${currentPrice > ema.ema9 ? 'Above (Bullish)' : 'Below (Bearish)'}
- Price vs EMA21: ${currentPrice > ema.ema21 ? 'Above (Bullish)' : 'Below (Bearish)'}
- Price vs EMA50: ${currentPrice > ema.ema50 ? 'Above (Bullish)' : 'Below (Bearish)'}

#### MACD (Moving Average Convergence Divergence)
- MACD Line: ${macd.macdLine.toFixed(2)}
- Signal Line: ${macd.signalLine.toFixed(2)}
- Histogram: ${macd.histogram.toFixed(2)}
- MACD Signal: ${macd.histogram > 0 ? 'Bullish (Above Zero)' : 'Bearish (Below Zero)'}
- MACD Crossover: ${macd.macdLine > macd.signalLine ? 'Bullish Crossover' : 'Bearish Crossover'}

## ANALYSIS REQUIREMENTS

Provide a comprehensive analysis that includes:

### 1. TRADING SIGNAL
- Give a clear trading signal: **BUY**, **SELL**, or **HOLD**
- Provide confidence level (0-100%) based on indicator alignment and confluence
- Explain the reasoning behind the signal in 2-3 sentences

### 2. TREND ANALYSIS
- Determine the overall trend direction: **BULLISH**, **BEARISH**, or **NEUTRAL**
- Assess trend strength: **STRONG**, **MODERATE**, or **WEAK**
- Describe the trend characteristics based on:
  * EMA alignment (price above/below EMAs, EMAs bullish/bearish stacking)
  * RSI momentum
  * MACD trend confirmation
  * Recent price action patterns

### 3. SUPPORT AND RESISTANCE LEVELS
- Identify the nearest support level (price where buyers may enter)
- Identify the nearest resistance level (price where sellers may enter)
- Explain why these levels are significant based on recent price action

### 4. RISK CONSIDERATIONS
- Highlight potential risks or warning signs
- Note any divergences or conflicting signals
- Suggest stop-loss levels if applicable

## IMPORTANT ANALYSIS GUIDELINES

1. **Confluence Principle**: Look for multiple indicators pointing in the same direction
2. **Trend is Your Friend**: Prioritize trend-following signals over counter-trend signals unless strong divergence exists
3. **RSI Interpretation**: 
   - Overbought (>70) can signal continuation in strong uptrends or reversal
   - Oversold (<30) can signal continuation in strong downtrends or reversal
   - Consider RSI direction and momentum, not just absolute value
4. **EMA Analysis**:
   - Bullish alignment: EMA9 > EMA21 > EMA50 and price above EMA9
   - Bearish alignment: EMA9 < EMA21 < EMA50 and price below EMA9
   - Crossovers can signal trend changes
5. **MACD Analysis**:
   - Histogram direction indicates momentum strength
   - MACD/Signal crossovers provide entry/exit signals
   - Divergences between price and MACD signal potential reversals

## RESPONSE FORMAT

Provide your analysis in the following JSON format (strictly valid JSON):

\`\`\`json
{
  "signal": "BUY|SELL|HOLD",
  "confidence": 0-100,
  "signalReasoning": "Brief explanation of the trading signal",
  "trend": "BULLISH|BEARISH|NEUTRAL",
  "trendStrength": "STRONG|MODERATE|WEAK",
  "trendDescription": "Detailed trend analysis based on indicators and price action",
  "supportLevel": number,
  "resistanceLevel": number,
  "levelReasoning": "Explanation of why these support/resistance levels are significant",
  "riskConsiderations": "Key risks or warning signs to be aware of",
  "marketSummary": "Brief 2-3 sentence summary of the overall market condition"
}
\`\`\`

Ensure your response is valid JSON without any additional text or formatting outside the JSON structure. Be objective, analytical, and provide actionable insights based on the technical data provided.`;
  }

  async analyzeMarket(
    marketData: MarketData,
    indicators: TechnicalIndicators
  ): Promise<{
    signal: TradingSignal;
    trend: TrendAnalysis;
    supportResistance: {
      supportLevel: number;
      resistanceLevel: number;
      reasoning: string;
    };
    riskConsiderations: string;
    marketSummary: string;
  }> {
    if (!this.openRouter) {
      throw new Error('OpenRouter API key not configured. Please set OPENROUTER_API_KEY environment variable.');
    }

    try {
      const prompt = this.buildAnalysisPrompt(marketData, indicators);
      
      const result = await generateText({
        model: this.openRouter.chat(CONFIG.ai.model),
        prompt,
        temperature: CONFIG.ai.temperature,
        maxTokens: CONFIG.ai.maxTokens,
      });

      const aiResponse = JSON.parse(result.text.trim());

      return {
        signal: {
          signal: aiResponse.signal,
          confidence: aiResponse.confidence,
          reasoning: aiResponse.signalReasoning,
        },
        trend: {
          trend: aiResponse.trend,
          strength: aiResponse.trendStrength,
          description: aiResponse.trendDescription,
        },
        supportResistance: {
          supportLevel: aiResponse.supportLevel,
          resistanceLevel: aiResponse.resistanceLevel,
          reasoning: aiResponse.levelReasoning,
        },
        riskConsiderations: aiResponse.riskConsiderations,
        marketSummary: aiResponse.marketSummary,
      };
    } catch (error) {
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const aiAnalyzerService = new AIAnalyzerService();
