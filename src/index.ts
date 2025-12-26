import { Hono } from 'hono';
import tradingRouter from './routes/trading';

const app = new Hono();

app.get('/', (c) => {
  return c.json({
    name: 'Sentor Trade API',
    version: '1.0.0',
    description: 'AI-powered futures trading analysis platform',
    endpoints: {
      health: '/api/trading/health',
      analyze: '/api/trading/analyze',
      indicators: '/api/trading/indicators',
      price: '/api/trading/price',
    },
    docs: {
      analyze: 'GET /api/trading/analyze?symbol=BTCUSDT&timeframe=15m',
      indicators: 'GET /api/trading/indicators?symbol=BTCUSDT&timeframe=15m',
      price: 'GET /api/trading/price?symbol=BTCUSDT',
    },
  });
});

app.route('/api/trading', tradingRouter);

export default app;
