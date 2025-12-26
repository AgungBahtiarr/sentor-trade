import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { CONFIG } from '../lib/config';
import { getEnvVar } from '../lib/config';
import type { MarketData, TechnicalIndicators, TradingSignal, TrendAnalysis } from '../types/trading';
import type { ICTAnalysis } from '../types/ict';

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
- Give a clear trading signal: **BUY**, **SELL**, or **NO_SIGNAL**
- Provide confidence level (0-100%) based on indicator alignment and confluence
- **CRITICAL**: Only give BUY or SELL signal when there is CLEAR trading potential with strong confluence (multiple indicators aligning)
- Use **NO_SIGNAL** if:
  * Indicators are mixed or conflicting
  * Market is ranging or showing no clear direction
  * Confidence level is below 70%
  * Risk-reward ratio is unfavorable
  * Market conditions are too uncertain or volatile
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

Provide your analysis in following JSON format (strictly valid JSON):

\`\`\`json
{
  "signal": "BUY|SELL|NO_SIGNAL",
  "confidence": 0-100,
  "signalReasoning": "Brief explanation of the trading signal (or why NO_SIGNAL was given)",
  "trend": "BULLISH|BEARISH|NEUTRAL",
  "trendStrength": "STRONG|MODERATE|WEAK",
  "trendDescription": "Detailed trend analysis based on indicators and price action",
  "supportLevel": number,
  "resistanceLevel": number,
  "levelReasoning": "Explanation of why these support/resistance levels are significant",
  "riskConsiderations": "Key risks or warning signs to be aware of",
  "marketSummary": "Brief 2-3 sentence summary of overall market condition"
}
\`\`\`

**IMPORTANT**: 
- Return "NO_SIGNAL" with confidence below 50% when there's no clear trading opportunity
- Return "BUY" or "SELL" only with confidence 70%+ when multiple indicators strongly align
- Be conservative - it's better to miss an opportunity than to give a false signal
- Ensure your response is valid JSON without any additional text or formatting outside the JSON structure. Be objective, analytical, and provide actionable insights based on the technical data provided.`;
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

      const minConfidenceForSignal = CONFIG.ai.minConfidenceForSignal;
      let finalSignal = aiResponse.signal;
      let finalReasoning = aiResponse.signalReasoning;
      
      if ((finalSignal === 'BUY' || finalSignal === 'SELL') && aiResponse.confidence < minConfidenceForSignal) {
        finalSignal = 'NO_SIGNAL';
        finalReasoning = `${aiResponse.signalReasoning} However, confidence (${aiResponse.confidence}%) is below the minimum threshold of ${minConfidenceForSignal}%, so no trading signal is provided.`;
      }

      return {
        signal: {
          signal: finalSignal,
          confidence: aiResponse.confidence,
          reasoning: finalReasoning,
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

  private buildICTAnalysisPrompt(
    marketData: MarketData,
    indicators: TechnicalIndicators,
    ictAnalysis: ICTAnalysis
  ): string {
    const { symbol, timeframe, currentPrice, priceChangePercent } = marketData;
    const { rsi, ema, macd } = indicators;
    const { fairValueGaps, orderBlocks, liquidity, marketStructure, timeAnalysis, confluence } = ictAnalysis;

    const activeBullishFVGs = fairValueGaps.filter(fvg => fvg.type === 'bullish' && !fvg.filled);
    const activeBearishFVGs = fairValueGaps.filter(fvg => fvg.type === 'bearish' && !fvg.filled);
    const activeBullishOBs = orderBlocks.filter(ob => ob.type === 'bullish' && ob.active);
    const activeBearishOBs = orderBlocks.filter(ob => ob.type === 'bearish' && ob.active);

    return `You are an expert ICT (Inner Circle Trader) analyst with deep understanding of Smart Money Concepts, institutional order flow, and price action manipulation. Analyze the provided market data and ICT analysis to generate high-probability trading signals.

## PRIMARY ANALYSIS: ICT SMART MONEY CONCEPTS

### ICT Setup Analysis (PRIMARY - MUST USE FOR SIGNAL GENERATION)

#### Fair Value Gaps (FVG)
- Active Bullish FVGs: ${activeBullishFVGs.length}
  ${activeBullishFVGs.slice(0, 2).map(fvg => `  * Level: ${fvg.mid.toFixed(2)} (Range: ${fvg.low.toFixed(2)}-${fvg.high.toFixed(2)}), Strength: ${fvg.strength}`).join('\n')}
- Active Bearish FVGs: ${activeBearishFVGs.length}
  ${activeBearishFVGs.slice(0, 2).map(fvg => `  * Level: ${fvg.mid.toFixed(2)} (Range: ${fvg.low.toFixed(2)}-${fvg.high.toFixed(2)}), Strength: ${fvg.strength}`).join('\n')}

#### Order Blocks
- Active Bullish Order Blocks: ${activeBullishOBs.length}
  ${activeBullishOBs.filter(ob => ob.retested).slice(0, 2).map(ob => `  * Level: ${ob.close.toFixed(2)} (High-Low: ${ob.high.toFixed(2)}-${ob.low.toFixed(2)}), Retested: ${ob.retestedCount}x`).join('\n')}
- Active Bearish Order Blocks: ${activeBearishOBs.length}
  ${activeBearishOBs.filter(ob => ob.retested).slice(0, 2).map(ob => `  * Level: ${ob.close.toFixed(2)} (High-Low: ${ob.high.toFixed(2)}-${ob.low.toFixed(2)}), Retested: ${ob.retestedCount}x`).join('\n')}

#### Liquidity Analysis
- Last Sweep: ${liquidity.lastSweep.type || 'None'} ${liquidity.lastSweep.price ? `at ${liquidity.lastSweep.price.toFixed(2)}` : ''}
- Buy-side Liquidity Swept: ${liquidity.totalBuySideSwept}
- Sell-side Liquidity Swept: ${liquidity.totalSellSideSwept}
- Nearest Buy-side Liquidity: ${liquidity.nearestBuySideLiquidity?.price.toFixed(2) || 'None'}
- Nearest Sell-side Liquidity: ${liquidity.nearestSellSideLiquidity?.price.toFixed(2) || 'None'}

#### Market Structure
- Current Trend: ${marketStructure.trend}
- Current Phase: ${marketStructure.currentStructure.phase}
- Last Break of Structure (BOS): ${marketStructure.lastBOS.type} at ${marketStructure.lastBOS.price.toFixed(2)}
- Last Change of Character (CHoCH): ${marketStructure.lastCHoCH.type} at ${marketStructure.lastCHoCH.price.toFixed(2)}

#### Time Analysis (Kill Zones)
- Current Session: ${timeAnalysis.session}
- Kill Zone Active: ${timeAnalysis.killZone.active ? `YES - ${timeAnalysis.killZone.name}` : 'NO'}
- Trading Conditions: ${timeAnalysis.tradingConditions}

### ICT Confluence Score
- Bullish Score: ${confluence.bullishScore}/100
- Bearish Score: ${confluence.bearishScore}/100
- Primary Setup: ${confluence.primarySetup || 'None'}
- Key Confirmations:
  ${confluence.secondaryConfirmations.map(c => `  * ${c}`).join('\n')}

## SECONDARY ANALYSIS: TECHNICAL INDICATORS (CONFIRMATION ONLY)

### Traditional Technical Indicators
- RSI (14): ${rsi.toFixed(2)} ${rsi > 70 ? '(Overbought)' : rsi < 30 ? '(Oversold)' : ''}
- EMA Alignment: ${ema.ema9.toFixed(2)} / ${ema.ema21.toFixed(2)} / ${ema.ema50.toFixed(2)}
- MACD: ${macd.macdLine.toFixed(2)} (Signal: ${macd.signalLine.toFixed(2)}, Hist: ${macd.histogram.toFixed(2)})

## MARKET DATA
- Symbol: ${symbol}
- Timeframe: ${timeframe}
- Current Price: $${currentPrice.toFixed(2)}
- 24h Change: ${priceChangePercent.toFixed(2)}%

## ANALYSIS REQUIREMENTS

### PRIMARY SIGNAL GENERATION (ICT-Based)

**CRITICAL - Use ICT Concepts as PRIMARY driver for signals:**

1. **BUY Signal Requirements (ICT-First):**
   - Primary: Bullish Order Block retest OR Bullish FVG filled OR Buy-side liquidity sweep
   - Confirmations: Market structure bullish, Bullish BOS/CHoCH, In kill zone
   - Minimum ICT confluence score: 70+
   - Secondary: Traditional indicators support bullish move (optional but helpful)

2. **SELL Signal Requirements (ICT-First):**
   - Primary: Bearish Order Block retest OR Bearish FVG filled OR Sell-side liquidity sweep
   - Confirmations: Market structure bearish, Bearish BOS/CHoCH, In kill zone
   - Minimum ICT confluence score: 70+
   - Secondary: Traditional indicators support bearish move (optional but helpful)

3. **NO_SIGNAL Conditions:**
   - ICT confluence score < 70 (primary reason)
   - Conflicting ICT signals
   - No active order blocks, FVGs, or recent liquidity sweeps
   - Market structure unclear
   - Outside kill zones with low volatility
   - Even if traditional indicators align, if ICT setup is weak, give NO_SIGNAL

### ICT-WEIGHTED CONFIDENCE CALCULATION

Confidence should be primarily based on ICT confluence:
- ICT Primary Setup (OB retest, FVG fill, liquidity sweep): +40 points
- ICT Secondary Confirmations (BOS, CHoCH, Structure): +20 points
- Kill Zone Active: +15 points  
- Traditional Indicators Alignment: +10 points (secondary, not primary)
- Market Trend Alignment: +15 points

Maximum Confidence: 100

**IMPORTANT TRADING GUIDELINES:**

1. **ICT-First Approach**: Smart Money Concepts are your PRIMARY analysis. Traditional indicators (RSI, MACD, EMA) are ONLY secondary confirmations. If ICT says NO, traditional indicators cannot override it.

2. **Confluence is King**: Look for multiple ICT concepts aligning:
   - FVG + Order Block retest + Liquidity sweep = VERY STRONG
   - Order Block retest + BOS = STRONG
   - Single ICT element = WEAK (consider NO_SIGNAL)

3. **Kill Zone Trading**: Signals in Kill Zones are much more reliable than outside. Add +20% confidence for kill zone entries.

4. **Order Block Retests**: Prefer setups where price has already retested an OB once and rejected (shows institutional interest).

5. **Liquidity Sweeps**: A sweep followed by sharp reversal is one of the strongest ICT signals.

6. **Market Structure Alignment**: Only take signals in direction of market structure trend. Counter-structure trades are low probability.

7. **Fair Value Gaps**: Strong when unfilled and combined with other ICT elements. Weak as standalone setup.

## RESPONSE FORMAT

Return in this exact JSON format:

\`\`\`json
{
  "signal": "BUY|SELL|NO_SIGNAL",
  "ictSpecific": "ICT-specific signal description (e.g., 'Bullish Order Block retest + Buy-side liquidity sweep in NY Kill Zone')",
  "confidence": 0-100,
  "reasoning": "Detailed reasoning based primarily on ICT analysis with secondary confirmation from traditional indicators",
  "setup": {
    "primary": "Primary ICT setup (e.g., 'Bullish Order Block retest', 'Bearish FVG filled', 'Liquidity sweep')",
    "confirmations": ["ICT confirmation 1", "ICT confirmation 2", "Optional: Traditional indicator confirmation"],
    "invalidations": ["Potential invalidation factors", "e.g., 'No liquidity sweep', 'Outside kill zone', 'Conflicting structure'"]
  },
  "trend": "BULLISH|BEARISH|NEUTRAL",
  "trendStrength": "STRONG|MODERATE|WEAK",
  "trendDescription": "Trend description based on ICT market structure",
  "supportLevel": number,
  "resistanceLevel": number,
  "levelReasoning": "Support/resistance based on order blocks and liquidity",
  "riskConsiderations": "Key risks including potential invalidation factors",
  "marketSummary": "2-3 sentence summary of overall ICT market condition"
}
\`\`\`

**CRITICAL INSTRUCTIONS:**
- ICT concepts are PRIMARY - they carry 80% weight in your decision
- Traditional indicators are SECONDARY - they carry only 20% weight
- If ICT confluence is weak (<70), give NO_SIGNAL regardless of traditional indicators
- Only give BUY/SELL when multiple ICT concepts align strongly
- Always explain the ICT setup clearly in "ictSpecific" field
- Ensure valid JSON response with no extra text
- Be conservative - missing a trade is better than a false signal`;
  }

  async analyzeICTMarket(
    marketData: MarketData,
    indicators: TechnicalIndicators,
    ictAnalysis: ICTAnalysis
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
    ictSpecific: string;
  }> {
    if (!this.openRouter) {
      throw new Error('OpenRouter API key not configured. Please set OPENROUTER_API_KEY environment variable.');
    }

    try {
      const prompt = this.buildICTAnalysisPrompt(marketData, indicators, ictAnalysis);
      
      const result = await generateText({
        model: this.openRouter.chat(CONFIG.ai.model),
        prompt,
        temperature: CONFIG.ai.temperature,
        maxTokens: 1500,
      });

      const aiResponse = JSON.parse(result.text.trim());

      const minConfidenceForSignal = CONFIG.ai.minConfidenceForSignal;
      let finalSignal = aiResponse.signal;
      let finalReasoning = aiResponse.reasoning;
      
      if ((finalSignal === 'BUY' || finalSignal === 'SELL') && aiResponse.confidence < minConfidenceForSignal) {
        finalSignal = 'NO_SIGNAL';
        finalReasoning = `${aiResponse.reasoning} However, confidence (${aiResponse.confidence}%) is below minimum threshold of ${minConfidenceForSignal}%, so no trading signal is provided.`;
      }

      return {
        signal: {
          signal: finalSignal,
          confidence: aiResponse.confidence,
          reasoning: finalReasoning,
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
        ictSpecific: aiResponse.ictSpecific,
      };
    } catch (error) {
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const aiAnalyzerService = new AIAnalyzerService();
