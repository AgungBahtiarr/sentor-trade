# AGENTS.md

This file provides guidelines for agentic coding assistants working in this repository.

## Project Overview

Sentor Trade is a futures trading analysis platform built with Bun, Hono, and TypeScript. The system fetches real-time candle data from Bybit via CCXT (with exchange abstraction layer), calculates technical indicators (RSI, MACD, EMA) using the TechnicalIndicators library, and sends processed data to OpenRouter (DeepSeek model) for AI-powered analysis using the Vercel AI SDK.

## Tech Stack

- **Runtime**: Bun (not Node.js - always use Bun APIs)
- **Web Framework**: Hono v4
- **Language**: TypeScript (strict mode enabled)
- **Integration Libraries**: CCXT, TechnicalIndicators, Vercel AI SDK
- **AI Provider**: OpenRouter with DeepSeek model

## Development Commands

```bash
# Install dependencies
bun install

# Start development server with hot reload
bun run dev

# Note: Currently no lint or test commands are configured.
# If you add linting or testing, update this file with the commands.
```

**Running a single test**: No test framework is currently configured. To add testing:
- Prefer Bun's built-in test runner (`bun test`) over Jest or Vitest
- Add test scripts to package.json when implementing

## Code Style Guidelines

### Imports

- Use default imports for packages: `import { Hono } from 'hono'`
- Group imports: external dependencies first, then internal modules
- Use named imports for functions/classes: `import { fetchCandles } from './ccxt'`

### Formatting

- Use 2-space indentation
- No trailing whitespace
- Use single quotes for strings
- Semicolons are required

### TypeScript

- Always use strict mode (already enabled)
- Use type inference when types are obvious
- Add explicit types for function parameters and return values
- Use `interface` for object shapes, `type` for unions/primitives
- Leverage Bun's native types: `Bun.serve`, `Bun.file`, etc.

### Naming Conventions

- **Files**: kebab-case (`trading-analyzer.ts`, `api-routes.ts`)
- **Variables/Functions**: camelCase (`calculateRSI`, `candleData`)
- **Constants**: UPPER_SNAKE_CASE (`EXCHANGE_PROVIDER`, `DEFAULT_SYMBOL`)
- **Classes/Types**: PascalCase (`CandleData`, `IndicatorResult`, `BybitExchange`)
- **Interfaces**: PascalCase with 'I' prefix for interfaces (`IExchange`)

### Error Handling

- Use try-catch blocks for async operations
- Throw descriptive errors with context: `throw new Error('Failed to fetch candles: ${error.message}')`
- Return proper HTTP status codes in Hono routes (400, 401, 500, etc.)
- Log errors appropriately for debugging

### API Routes (Hono)

- Organize routes by feature in separate files (`src/routes/trading.ts`)
- Use middleware for common functionality (authentication, logging)
- Keep route handlers concise - delegate business logic to services
- Use Zod or similar for request validation (when added)

### Data Processing

- Process candle data using TechnicalIndicators library
- Return typed data structures for indicator calculations
- Batch API calls when possible to improve performance
- Cache results when appropriate (e.g., frequent indicator calculations)

### AI Integration

- Use Vercel AI SDK for OpenRouter/DeepSeek calls
- Format technical data as structured prompts
- Parse AI responses to extract actionable trading signals
- Handle rate limits and API errors gracefully

### Project Structure

```
src/
  index.ts           # Entry point
  routes/            # API route handlers
  services/          # Business logic
    exchange/        # Exchange abstraction layer
  lib/               # Utility functions
  types/             # TypeScript type definitions
```

### Exchange Abstraction Layer

The project uses an exchange abstraction pattern to easily switch between different cryptocurrency exchanges:

- **Interface**: `IExchange` in `src/services/exchange/exchange-interface.ts` defines common methods
- **Implementations**: Each exchange implements `IExchange` (e.g., `BybitExchange`)
- **Provider**: `ExchangeProvider` in `src/services/exchange/exchange-provider.ts` creates the appropriate exchange instance based on config
- **Configuration**: Exchange provider is set in `src/lib/config.ts` under `exchange.provider`

When adding a new exchange:
1. Create a new class implementing `IExchange` in `src/services/exchange/[exchange-name].ts`
2. Add the exchange case to `ExchangeProvider.createExchange()` method
3. Update `CONFIG.exchange.provider` in `config.ts` to use the new exchange
4. Ensure all methods from `IExchange` are properly implemented

### Security

- Never commit API keys or secrets (use .env files, add to .gitignore)
- Validate all external inputs
- Sanitize AI responses before use
- Use environment variables for configuration

## Adding Dependencies

Always use Bun: `bun add <package>` (not npm or yarn)

## When to Update This File

- Adding new build/lint/test commands
- Changing the tech stack
- Establishing new coding conventions
- Adding important architectural decisions
