import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";
import { CONFIG, getEnvVar } from "../lib/config";
import type {
  MarketData,
  TechnicalIndicators,
  TradingSignal,
  TrendAnalysis,
} from "../types/trading";
import type { FractalData } from "./fractal";

const FractalAnalysisSchema = z.object({
  signal: z.enum(["BUY", "SELL", "NO_SIGNAL"]).describe("The trading decision"),
  confidence: z.number().min(0).max(100).describe("Confidence score 0-100%"),
  signalReasoning: z.string().describe("Explanation for the signal decision"),
  biasAnalysis: z.string().describe("Daily bias analysis and interpretation"),
  poiIdentified: z.string().describe("Point of Interest identified and why it matters"),
  structureValidation: z.string().describe("Validation of structure and timeframe alignment"),
  setupConfirmation: z.string().describe("Confirmation of Continuation Order Block setup"),
  setupPhase: z.enum(["WAITING_FOR_SWEEP", "WAITING_FOR_CLOSE", "READY_TO_ENTER"]).describe("Current phase of the setup"),
  entryZone: z.number().describe("Recommended entry price zone"),
  stopLoss: z.number().describe("Stop loss price level"),
  takeProfit: z.number().describe("Take profit price level"),
  riskConsiderations: z.string().describe("Risk factors to watch"),
  marketSummary: z.string().describe("Brief market overview"),
});

type FractalAnalysisResult = {
  signal: TradingSignal;
  biasAnalysis: string;
  poiIdentified: string;
  structureValidation: string;
  setupConfirmation: string;
  setupPhase: 'WAITING_FOR_SWEEP' | 'WAITING_FOR_CLOSE' | 'READY_TO_ENTER';
  entryZone: number;
  stopLoss: number;
  takeProfit: number;
  riskConsiderations: string;
  marketSummary: string;
};

type FractalSchemaOutput = z.infer<typeof FractalAnalysisSchema>;

// ==================== SERVICE ====================
export class AIAnalyzerService {
  private static instance: AIAnalyzerService;
  private modelInstance: any = null;

  private constructor() {
    this.validateConfig();
  }

  // Singleton pattern
  public static getInstance(): AIAnalyzerService {
    if (!AIAnalyzerService.instance) {
      AIAnalyzerService.instance = new AIAnalyzerService();
    }
    return AIAnalyzerService.instance;
  }

  // Config validation
  private validateConfig(): void {
    if (!CONFIG.ai?.model) {
      throw new Error("AI model not configured in CONFIG");
    }
    if (typeof CONFIG.ai?.minConfidenceForSignal !== "number") {
      throw new Error("minConfidenceForSignal not set in CONFIG");
    }
  }

  // Model initialization with caching
  private getModel() {
    if (!this.modelInstance) {
      const apiKey = getEnvVar("OPENROUTER_API_KEY");
      if (!apiKey) {
        throw new Error(
          "OPENROUTER_API_KEY is not set in environment variables",
        );
      }

      const openRouter = createOpenRouter({ apiKey });
      this.modelInstance = openRouter(CONFIG.ai.model);
    }
    return this.modelInstance;
  }

  // ==================== CONTEXT BUILDERS ====================
  private buildMarketContext(
    marketData: MarketData,
    indicators: TechnicalIndicators,
  ): string {
    const { symbol, timeframe, currentPrice, priceChangePercent, candles } =
      marketData;
    const { rsi, ema, macd } = indicators;

    const recentCandles = candles.slice(-5);

    return [
      "MARKET CONTEXT:",
      `Symbol: ${symbol} (${timeframe})`,
      `Price: ${currentPrice} (${priceChangePercent}%)`,
      "",
      "INDICATORS:",
      `RSI: ${rsi.toFixed(2)}`,
      `EMA: 9(${ema.ema9.toFixed(2)}) / 21(${ema.ema21.toFixed(2)}) / 50(${ema.ema50.toFixed(2)})`,
      `MACD: Hist ${macd.histogram.toFixed(2)}, Line ${macd.macdLine.toFixed(2)}`,
      "",
      "RECENT PRICE ACTION:",
      ...recentCandles.map(
        (c, i) =>
          `Candle ${i + 1}: O=${c.open}, H=${c.high}, L=${c.low}, C=${c.close}`,
      ),
    ].join("\n");
  }

  private async analyzeWithSchema<
    T extends { signal: string; confidence: number },
  >(
    schema: z.ZodSchema<T>,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<T> {
    const { output } = await generateText({
      model: this.getModel(),
      output: Output.object({ schema }),
      system: systemPrompt,
      prompt: userPrompt,
    });

    // Auto-downgrade logic for low confidence
    const minConfidence = CONFIG.ai.minConfidenceForSignal;
    if (output.signal !== "NO_SIGNAL" && output.confidence < minConfidence) {
      const reasoningKey =
        "reasoning" in output ? "reasoning" : "signalReasoning";
      const originalReasoning = (output as any)[reasoningKey] || "";

      return {
        ...output,
        signal: "NO_SIGNAL" as any,
        [reasoningKey]: `[AUTO-DOWNGRADE] Confidence (${output.confidence}%) below threshold (${minConfidence}%). Original: ${originalReasoning}`,
      };
    }

    return output;
  }

  private buildFractalContext(
    marketData: MarketData,
    fractalData: FractalData,
  ): string {
    const { symbol, timeframe, currentPrice, candles } = marketData;
    const { dailyBias, swingPoints, pois, cisds } = fractalData;

    const recentCandles = candles.slice(-5);
    const recentPOIs = pois.slice(0, 3);
    const recentCISDs = cisds.slice(-3);
    const currentTime = new Date().toISOString();
    const currentHour = new Date().getUTCHours();

    return [
      "FRACTAL MARKET CONTEXT:",
      `Symbol: ${symbol} (${timeframe})`,
      `Price: ${currentPrice}`,
      `Current Time: ${currentTime} (UTC ${currentHour}:00)`,
      "",
      "DAILY BIAS:",
      `Type: ${dailyBias.type}`,
      `Description: ${dailyBias.description}`,
      `Previous Day: H=${dailyBias.previousDay.high} L=${dailyBias.previousDay.low} C=${dailyBias.previousDay.close}`,
      `Current Day: H=${dailyBias.currentDay.high} L=${dailyBias.currentDay.low} C=${dailyBias.currentDay.close}`,
      "",
      "POINTS OF INTEREST (POI):",
      ...recentPOIs.map(
        (poi) => `- ${poi.type}: ${poi.price.toFixed(4)} (${poi.strength} strength)`,
      ),
      "",
      "SWING POINTS:",
      ...swingPoints.slice(-5).map(
        (sp) => `- ${sp.type}: ${sp.price.toFixed(4)}`,
      ),
      "",
      "CHANGE IN STATE DELIVERY (CISD):",
      ...recentCISDs.map(
        (cisd) => `- ${cisd.type}: ${cisd.description}`,
      ),
      "",
      "RECENT PRICE ACTION:",
      ...recentCandles.map(
        (c, i) =>
          `Candle ${i + 1}: O=${c.open}, H=${c.high}, L=${c.low}, C=${c.close}`,
      ),
    ].join("\n");
  }

  async analyzeFractalMarket(
    marketData: MarketData,
    indicators: TechnicalIndicators,
    fractalData: FractalData,
  ): Promise<FractalAnalysisResult> {
    try {
      const systemPrompt = `# ROLE
Bertindaklah sebagai Ahli Analisa Teknikal yang berspesialisasi dalam "Fractal Model" dari TTrades. Tugasmu adalah menganalisa grafik harga menggunakan pendekatan top-down (dari timeframe besar ke kecil) untuk menemukan setup trading dengan probabilitas tinggi.

# KONSEP INTI
Harga bergerak dalam fraktal. Harga tidak bisa berbalik arah (reverse) tanpa membentuk Swing Point. Kamu harus mencari penyelarasan (alignment) antara Bias Timeframe Besar, Struktur Timeframe Menengah, dan Eksekusi Timeframe Kecil.

# ATURAN ANALISA (STEP-BY-STEP)

## LANGKAH 1: Tentukan Bias Harian (Daily Bias)
Analisa candle penutupan hari sebelumnya (Previous Day Close) relatif terhadap rentang hari sebelumnya (Previous Day Range):
1. **Bullish Continuation:** Harga ditutup DI ATAS High hari sebelumnya. (Ekspektasi: Lanjut naik).
2. **Bearish Continuation:** Harga ditutup DI BAWAH Low hari sebelumnya. (Ekspektasi: Lanjut turun).
3. **Bullish Reversal:** Harga menyapu (sweep) Low hari sebelumnya, tapi DITUTUP KEMBALI di dalam range (di atas Low tersebut).
4. **Bearish Reversal:** Harga menyapu (sweep) High hari sebelumnya, tapi DITUTUP KEMBALI di dalam range (di bawah High tersebut).

## LANGKAH 2: Identifikasi Point of Interest (POI)
Pada timeframe menengah (misal: H1 jika bias Daily), identifikasi area di mana harga kemungkinan bereaksi:
- Fair Value Gaps (FVG).
- Old Swing Highs/Lows.
- Order Blocks.
*Tunggu harga masuk ke POI ini sebelum mencari konfirmasi.*

## LANGKAH 3: Konfirmasi Struktur & Timeframe Alignment
Gunakan pasangan timeframe berikut:
- Monthly (Bias) -> Daily (Struktur) -> Hourly (Entry)
- Daily (Bias) -> Hourly (Struktur) -> 5-Minute (Entry)
- 4-Hour (Bias) -> 15-Minute (Struktur) -> 1-Minute (Entry)

Cari "Change in State of Delivery" (CISD) pada timeframe struktur setelah POI tersentuh.

## LANGKAH 4: Pola Entri (The Setup)
JANGAN masuk hanya karena struktur berubah. Cari pola spesifik "CONTINUATION ORDER BLOCK" pada timeframe eksekusi (Entry Timeframe):
1. **Sweep:** Harga harus mengambil likuiditas internal (menyapu high/low jangka pendek).
2. **Displacement:** Setelah sweep, harga harus berbalik dan DITUTUP (Close) melewati serangkaian candle yang berlawanan.
   - *Bullish Entry:* Sweep Low -> Close kuat di atas candle bearish terakhir.
   - *Bearish Entry:* Sweep High -> Close kuat di bawah candle bullish terakhir.
3. **Entry Trigger:** Masuk saat candle close tersebut atau saat retest ke area sapuan likuiditas (sweep area).

## LANGKAH 5: Manajemen Risiko
- **Stop Loss:** Di tempatkan di atas/bawah "Protected High/Low" (Swing point yang baru terbentuk setelah sweep).
- **Take Profit:** Targetkan likuiditas eksternal (Previous Day High/Low) atau FVG di timeframe besar. Pastikan TP memberikan Risk:Reward minimal 2:1.

## LANGKAH 6: Tentukan Setup Phase
Identifikasi fase setup saat ini:
- **WAITING_FOR_SWEEP:** Harga belum masuk ke POI atau belum menyapu likuiditas
- **WAITING_FOR_CLOSE:** Sudah terjadi sweep, menunggu konfirmasi close (displacement)
- **READY_TO_ENTER:** Semua kondisi terpenuhi, siap masuk posisi

**OUTPUT QUALITY:**
- Confidence MUST be >70% for BUY/SELL signals
- Take Profit harus memberikan Risk:Reward minimal 2:1 (akan dihitung oleh sistem)
- Default to NO_SIGNAL ketika setup tidak lengkap atau probabilitas rendah
- Jika setupPhase adalah WAITING_FOR_SWEEP atau WAITING_FOR_CLOSE, signal harus NO_SIGNAL
- Signal BUY/SELL hanya diberikan ketika setupPhase adalah READY_TO_ENTER
- Tambahkan warning untuk low confidence: Jika confidence 70-80%, include "⚠️ LOW CONFIDENCE: Higher risk, monitor closely"
- Hanya berikan signal ketika SEMUA kondisi fraktal terpenuhi
- JANGAN menghitung Risk:Reward ratio secara manual - sistem akan menghitungnya`;

      const userPrompt = `Analyze this fractal market data:\n${this.buildFractalContext(marketData, fractalData)}

**YOUR ANALYSIS STEPS:**
1. Determine Daily Bias type and interpret implications
2. Identify nearest Point of Interest (POI) and its strength
3. Validate structure and timeframe alignment
4. Confirm Continuation Order Block setup if exists
5. Determine setup phase (WAITING_FOR_SWEEP, WAITING_FOR_CLOSE, or READY_TO_ENTER)
6. If valid setup and READY_TO_ENTER, provide precise entry zone, stop loss, and take profit (ensure TP gives >= 2:1 RR)
7. Give actionable recommendation with confidence score`;

      const output = await this.analyzeWithSchema<FractalSchemaOutput>(
        FractalAnalysisSchema,
        systemPrompt,
        userPrompt,
      );

      return {
        signal: {
          signal: output.signal,
          confidence: output.confidence,
          reasoning: output.signalReasoning,
        },
        biasAnalysis: output.biasAnalysis,
        poiIdentified: output.poiIdentified,
        structureValidation: output.structureValidation,
        setupConfirmation: output.setupConfirmation,
        setupPhase: output.setupPhase,
        entryZone: output.entryZone,
        stopLoss: output.stopLoss,
        takeProfit: output.takeProfit,
        riskConsiderations: output.riskConsiderations,
        marketSummary: output.marketSummary,
      };
    } catch (error) {
      console.error("❌ Fractal AI analysis error:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        signal: {
          signal: "NO_SIGNAL",
          confidence: 0,
          reasoning: `Analysis failed: ${errorMsg}`,
        },
        biasAnalysis: "Analysis error",
        poiIdentified: "None",
        structureValidation: "Failed to validate",
        setupConfirmation: "Setup analysis failed",
        setupPhase: "WAITING_FOR_SWEEP",
        entryZone: 0,
        stopLoss: 0,
        takeProfit: 0,
        riskConsiderations: "⚠️ System error - avoid trading until resolved",
        marketSummary: `Analysis Error: ${errorMsg}`,
      };
    }
  }

  async testLLM(prompt: string): Promise<string> {
    try {
      const { text } = await generateText({
        model: this.getModel(),
        prompt,
      });
      return text;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`LLM test failed: ${errorMsg}`);
    }
  }
}

// Export singleton instance
export const aiAnalyzerService = AIAnalyzerService.getInstance();
