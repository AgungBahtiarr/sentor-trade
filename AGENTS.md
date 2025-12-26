# AGENTS.md

This file provides guidelines for agentic coding assistants working in this repository.

## Project Overview

Sentor Trade is a futures trading analysis platform built with Bun, Hono, and TypeScript. The system fetches real-time candle data from Binance via CCXT, calculates technical indicators (RSI, MACD, EMA) using the TechnicalIndicators library, and sends processed data to OpenRouter (DeepSeek model) for AI-powered analysis using the Vercel AI SDK.

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
- **Constants**: UPPER_SNAKE_CASE (`BINANCE_API_URL`, `DEFAULT_SYMBOL`)
- **Classes/Types**: PascalCase (`CandleData`, `IndicatorResult`)
- **Interfaces**: PascalCase with 'I' prefix only if needed for clarity (`IMarketData`)

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
  lib/               # Utility functions
  types/             # TypeScript type definitions
```

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
