import { Hono } from 'hono';
import tradingRouter from './routes/trading';

const app = new Hono();

app.get('/', (c) => {
  return c.json({
    name: 'Sentor Trade API',
    version: '2.0.0',
    description: 'ICT-powered AI futures trading analysis platform',
    endpoints: {
      health: '/api/trading/health',
      
      traditional: {
        analyze: '/api/trading/analyze',
        indicators: '/api/trading/indicators',
        price: '/api/trading/price',
      },
      
      ict: {
        analyze: '/api/trading/ict/analyze - Full ICT analysis with AI signals',
        fvg: '/api/trading/ict/fvg - Fair Value Gaps',
        orderblocks: '/api/trading/ict/orderblocks - Order Blocks',
        liquidity: '/api/trading/ict/liquidity - Liquidity analysis',
        structure: '/api/trading/ict/structure - Market Structure (BOS, CHoCH)',
        time: '/api/trading/ict/time - Kill Zones & Time analysis',
      },
    },
    docs: {
      traditional: {
        analyze: 'GET /api/trading/analyze?symbol=BTCUSDT&timeframe=15m',
        indicators: 'GET /api/trading/indicators?symbol=BTCUSDT&timeframe=15m',
        price: 'GET /api/trading/price?symbol=BTCUSDT',
      },
      ict: {
        full: 'GET /api/trading/ict/analyze?symbol=BTCUSDT&timeframe=15m&higherTimeframe=4h',
        fvg: 'GET /api/trading/ict/fvg?symbol=BTCUSDT&timeframe=15m',
        orderblocks: 'GET /api/trading/ict/orderblocks?symbol=BTCUSDT&timeframe=15m',
        liquidity: 'GET /api/trading/ict/liquidity?symbol=BTCUSDT&timeframe=15m',
        structure: 'GET /api/trading/ict/structure?symbol=BTCUSDT&timeframe=15m',
        time: 'GET /api/trading/ict/time',
      },
    },
  });
});

app.route('/api/trading', tradingRouter);

export default app;
