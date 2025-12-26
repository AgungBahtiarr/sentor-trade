# Sentor Trade

AI-powered futures trading analysis platform that fetches real-time market data from Binance, calculates technical indicators (RSI, MACD, EMA), and provides intelligent trading signals using DeepSeek AI.

## Features

- **Real-time Market Data**: Fetch candle data from Binance Futures API (public data, no API key required)
- **Technical Indicators**: Calculate RSI, MACD, and EMA indicators
- **AI-Powered Analysis**: Get trading signals, trend analysis, and support/resistance levels from DeepSeek
- **Support & Resistance**: Automatically identify key price levels
- **Trading Signals**: Buy/Sell/Hold recommendations with confidence levels

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
- AI-powered trading signal (BUY/SELL/HOLD)
- Trend analysis
- Support and resistance levels

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

Any Binance Futures trading pair (e.g., BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT)

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
- **Data Provider**: CCXT (Binance)
- **Indicators**: TechnicalIndicators library
- **AI**: Vercel AI SDK + OpenRouter (DeepSeek)

## Project Structure

```
src/
├── index.ts              # Main Hono app
├── routes/
│   └── trading.ts        # API route handlers
├── services/
│   ├── binance.ts        # Binance data fetching
│   ├── indicators.ts     # Technical indicator calculations
│   └── ai-analyzer.ts    # AI analysis with DeepSeek
├── types/
│   └── trading.ts        # TypeScript type definitions
└── lib/
    └── config.ts         # Configuration and constants
```

## Important Notes

- This is a trading analysis tool, not financial advice
- Always do your own research and risk management
- The AI-powered signals are based on technical analysis only
- Past performance does not guarantee future results

## License

MIT
