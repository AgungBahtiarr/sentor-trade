# Sentor Trade

AI-powered futures trading analysis platform that fetches real-time market data from Bybit, calculates technical indicators (RSI, MACD, EMA), and provides intelligent trading signals using DeepSeek AI.

## Features

- **Real-time Market Data**: Fetch candle data from Bybit Futures API (public data, no API key required)
- **Technical Indicators**: Calculate RSI, MACD, and EMA indicators
- **AI-Powered Analysis**: Get trading signals, trend analysis, and support/resistance levels from DeepSeek
- **Support & Resistance**: Automatically identify key price levels
- **Conservative Trading Signals**: Buy/Sell recommendations only when confidence is 70%+, otherwise returns NO_SIGNAL
- **High-Quality Signals**: Multiple indicator confluence required before generating a trading signal

## Installation

```bash
bun install
```

## Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Add your OpenRouter API key:

```
OPENROUTER_API_KEY=your-openrouter-api-key-here
```

Get your API key from [OpenRouter](https://openrouter.ai/keys)

## Running the Server

```bash
bun run dev
```

The server will start at `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /api/trading/health
```

### Full Market Analysis
```
GET /api/trading/analyze?symbol=BTCUSDT&timeframe=15m
```

Response includes:
- Market data (current price, price change, candles)
- Technical indicators (RSI, MACD, EMA)
- AI-powered trading signal (BUY/SELL/NO_SIGNAL)
- Trend analysis
- Support and resistance levels
- Risk considerations and market summary

### Technical Indicators Only
```
GET /api/trading/indicators?symbol=BTCUSDT&timeframe=15m
```

Response includes RSI, MACD, EMA values and support/resistance levels.

### Current Price
```
GET /api/trading/price?symbol=BTCUSDT
```

Response includes current price for the specified symbol.

## Supported Timeframes

- 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M

## Supported Symbols

Any Bybit Futures trading pair (e.g., BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT)

## Example Usage

```bash
# Analyze BTC/USDT on 15m timeframe
curl "http://localhost:3000/api/trading/analyze?symbol=BTCUSDT&timeframe=15m"

# Get indicators for ETH/USDT on 1h timeframe
curl "http://localhost:3000/api/trading/indicators?symbol=ETHUSDT&timeframe=1h"

# Get current price for SOL/USDT
curl "http://localhost:3000/api/trading/price?symbol=SOLUSDT"
```

## Technical Stack

- **Runtime**: Bun
- **Framework**: Hono v4
- **Language**: TypeScript
- **Data Provider**: CCXT (Bybit) - with exchange abstraction layer
- **Indicators**: TechnicalIndicators library
- **AI**: Vercel AI SDK + OpenRouter (DeepSeek)

## Project Structure

```
src/
├── index.ts              # Main Hono app
├── routes/
│   └── trading.ts        # API route handlers
├── services/
│   ├── exchange/         # Exchange abstraction layer
│   │   ├── exchange-interface.ts  # Exchange interface definition
│   │   ├── bybit.ts               # Bybit implementation
│   │   └── exchange-provider.ts   # Exchange factory
│   ├── indicators.ts     # Technical indicator calculations
│   └── ai-analyzer.ts    # AI analysis with DeepSeek
├── types/
│   └── trading.ts        # TypeScript type definitions
└── lib/
    └── config.ts         # Configuration and constants
```

## Switching Exchanges

To switch between exchanges, update the `src/lib/config.ts` file:

```typescript
exchange: {
  provider: "bybit",  // Change to "binance", "okx", etc. when implemented
  defaultSymbol: "BTCUSDT",
  defaultTimeframe: "15m",
  candleLimit: 100,
}
```

To add a new exchange:
1. Create a new class implementing `IExchange` in `src/services/exchange/`
2. Add the exchange name to the `ExchangeProvider.createExchange()` method
3. Update the config to use the new exchange provider

## Trading Signal Logic

The platform uses a conservative approach to signal generation:

- **BUY or SELL signals** are only generated when:
  * Multiple technical indicators align in the same direction
  * Confidence level is 70% or higher
  * Clear confluence exists between RSI, EMA, and MACD

- **NO_SIGNAL** is returned when:
  * Indicators are mixed or conflicting
  * Market is showing no clear direction
  * Confidence level is below 70%
  * Risk-reward ratio is unfavorable
  * Market conditions are too uncertain

This conservative approach ensures that only high-quality trading opportunities are presented, reducing the risk of false signals.

## Important Notes

- This is a trading analysis tool, not financial advice
- Always do your own research and risk management
- The AI-powered signals are based on technical analysis only
- Past performance does not guarantee future results
- Signals are conservative - NO_SIGNAL is preferred over low-confidence signals
- Always use proper risk management (stop-loss, position sizing) when trading

## License

MIT
