import { Hono } from 'hono';
import { html, raw } from 'hono/html';

const uiRouter = new Hono();

const timeframeOptions = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'];
const modeOptions = [
  { value: 'normal', label: 'Normal', params: ['symbol', 'timeframe'] },
  { value: 'ict', label: 'ICT', params: ['symbol', 'timeframe', 'higherTimeframe'] },
];

function generateTimeframeOptionsHTML() {
  return raw(timeframeOptions.map(tf => `<option value="${tf}">${tf}</option>`).join('\n'));
}

function generateModeOptionsHTML() {
  return raw(modeOptions.map(mode => `<option value="${mode.value}">${mode.label}</option>`).join('\n'));
}

function generateHigherTimeframeOptionsHTML() {
  return raw(timeframeOptions.map(tf => `<option value="${tf}" ${tf === '4h' ? 'selected' : ''}>${tf}</option>`).join('\n'));
}

const UIPage = html`<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sentor Trade - AI Trading Analysis</title>
  <link href="https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css" rel="stylesheet" type="text/css" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .loading-spinner {
      display: inline-block;
      width: 1rem;
      height: 1rem;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body class="min-h-screen bg-base-200">
  <div class="container mx-auto px-4 py-8 max-w-6xl">
    <div class="text-center mb-8">
      <h1 class="text-4xl font-bold text-primary mb-2">Sentor Trade</h1>
      <p class="text-base-content/70">AI-Powered ICT Trading Analysis Platform</p>
    </div>

    <div class="card bg-base-100 shadow-xl mb-8">
      <div class="card-body">
        <h2 class="card-title text-2xl mb-4">Trading Analysis</h2>
        
        <div class="grid gap-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">Symbol</span>
            </label>
            <input 
              type="text" 
              id="symbol" 
              placeholder="BTCUSDT" 
              value="BTCUSDT"
              class="input input-bordered w-full" 
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">Mode</span>
            </label>
            <select id="mode" class="select select-bordered w-full">
              ${generateModeOptionsHTML()}
            </select>
          </div>

          <div id="timeframeContainer" class="form-control">
            <label class="label">
              <span class="label-text font-semibold">Timeframe</span>
            </label>
            <select id="timeframe" class="select select-bordered w-full">
              ${generateTimeframeOptionsHTML()}
            </select>
          </div>

          <div id="higherTimeframeContainer" class="form-control hidden">
            <label class="label">
              <span class="label-text font-semibold">Higher Timeframe</span>
            </label>
            <select id="higherTimeframe" class="select select-bordered w-full">
              ${generateHigherTimeframeOptionsHTML()}
            </select>
          </div>

          <button id="analyzeBtn" class="btn btn-primary btn-lg w-full">
            Analyze
          </button>
        </div>
      </div>
    </div>

    <div id="results" class="hidden">
      <div id="loading" class="card bg-base-100 shadow-xl">
        <div class="card-body text-center">
          <div class="loading-spinner loading-lg"></div>
          <p class="mt-4">Analyzing market data...</p>
        </div>
      </div>

      <div id="resultsContent"></div>
    </div>
  </div>

  <script>
    const modeSelect = document.getElementById('mode');
    const timeframeContainer = document.getElementById('timeframeContainer');
    const higherTimeframeContainer = document.getElementById('higherTimeframeContainer');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    const resultsContent = document.getElementById('resultsContent');

    modeSelect.addEventListener('change', function() {
      const mode = this.value;

      if (mode === 'ict') {
        higherTimeframeContainer.classList.remove('hidden');
      } else {
        higherTimeframeContainer.classList.add('hidden');
      }
    });

    analyzeBtn.addEventListener('click', async function() {
      const symbol = document.getElementById('symbol').value.toUpperCase() || 'BTCUSDT';
      const mode = modeSelect.value;
      const timeframe = document.getElementById('timeframe').value;
      const higherTimeframe = document.getElementById('higherTimeframe').value;

      resultsDiv.classList.remove('hidden');
      loadingDiv.classList.remove('hidden');
      resultsContent.innerHTML = '';
      analyzeBtn.disabled = true;

      try {
        let endpoint = '';
        const params = new URLSearchParams();
        params.append('symbol', symbol);

        switch (mode) {
          case 'normal':
            endpoint = '/api/trading/analyze';
            params.append('timeframe', timeframe);
            break;
          case 'ict':
            endpoint = '/api/trading/ict/analyze';
            params.append('timeframe', timeframe);
            params.append('higherTimeframe', higherTimeframe);
            break;
        }

        const response = await fetch(endpoint + '?' + params.toString());
        const result = await response.json();

        loadingDiv.classList.add('hidden');

        if (result.success) {
          displayResults(mode, result.data);
        } else {
          resultsContent.innerHTML = \`
            <div class="alert alert-error shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>\${result.error || 'Failed to fetch data'}</span>
            </div>
          \`;
        }
      } catch (error) {
        loadingDiv.classList.add('hidden');
        resultsContent.innerHTML = \`
          <div class="alert alert-error shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Error: \${error.message}</span>
          </div>
        \`;
      } finally {
        analyzeBtn.disabled = false;
      }
    });

    function displayResults(mode, data) {
      let html = '';

      switch (mode) {
        case 'normal':
          html = displayNormalResults(data);
          break;
        case 'ict':
          html = displayICTResults(data);
          break;
      }

      resultsContent.innerHTML = html;
    }

    function displayNormalResults(data) {
      const signalClass = data.signal.signal === 'BUY' ? 'badge-success' : 
                         data.signal.signal === 'SELL' ? 'badge-error' : 'badge-neutral';
      
      return \`
        <div class="card bg-base-100 shadow-xl mt-4">
          <div class="card-body">
            <h2 class="card-title">Market Analysis - \${data.marketData.symbol}</h2>
            
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div class="stat">
                <div class="stat-title">Current Price</div>
                <div class="stat-value text-2xl">\${data.marketData.currentPrice.toLocaleString()}</div>
                <div class="stat-desc">\${data.marketData.priceChangePercent > 0 ? '+' : ''}\${data.marketData.priceChangePercent.toFixed(2)}%</div>
              </div>

              <div class="stat">
                <div class="stat-title">Signal</div>
                <div class="stat-value text-2xl"><span class="badge \${signalClass} badge-lg">\${data.signal.signal}</span></div>
                <div class="stat-desc">Confidence: \${(data.signal.confidence * 100).toFixed(1)}%</div>
              </div>

              <div class="stat">
                <div class="stat-title">Trend</div>
                <div class="stat-value text-2xl">\${data.trend.trend}</div>
                <div class="stat-desc">\${data.trend.strength}</div>
              </div>
            </div>

            <div class="divider"></div>

            <h3 class="text-xl font-semibold mb-2">Technical Indicators</h3>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="card bg-base-200">
                <div class="card-body p-4">
                  <h4 class="font-semibold">RSI</h4>
                  <p class="text-2xl">\${data.indicators.rsi.toFixed(2)}</p>
                </div>
              </div>
              <div class="card bg-base-200">
                <div class="card-body p-4">
                  <h4 class="font-semibold">MACD</h4>
                  <p>Line: \${data.indicators.macd.macdLine.toFixed(4)}</p>
                  <p>Signal: \${data.indicators.macd.signalLine.toFixed(4)}</p>
                  <p>Histogram: \${data.indicators.macd.histogram.toFixed(4)}</p>
                </div>
              </div>
              <div class="card bg-base-200">
                <div class="card-body p-4">
                  <h4 class="font-semibold">EMA</h4>
                  <p>EMA 9: \${data.indicators.ema.ema9.toFixed(2)}</p>
                  <p>EMA 21: \${data.indicators.ema.ema21.toFixed(2)}</p>
                  <p>EMA 50: \${data.indicators.ema.ema50.toFixed(2)}</p>
                </div>
              </div>
              <div class="card bg-base-200">
                <div class="card-body p-4">
                  <h4 class="font-semibold">Support & Resistance</h4>
                  <p>Nearest Support: \${data.supportResistance.nearestSupport.toFixed(2)}</p>
                  <p>Nearest Resistance: \${data.supportResistance.nearestResistance.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div class="divider"></div>

            <h3 class="text-xl font-semibold mb-2">AI Reasoning</h3>
            <div class="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>\${data.signal.reasoning}</span>
            </div>
          </div>
        </div>
      \`;
    }

    function displayICTResults(data) {
      const signalClass = data.signal.type === 'BUY' ? 'badge-success' : 
                         data.signal.type === 'SELL' ? 'badge-error' : 'badge-neutral';
      
      return \`
        <div class="card bg-base-100 shadow-xl mt-4">
          <div class="card-body">
            <h2 class="card-title">ICT Analysis - \${data.marketData.symbol}</h2>
            
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div class="stat">
                <div class="stat-title">Current Price</div>
                <div class="stat-value text-2xl">\${data.marketData.currentPrice.toLocaleString()}</div>
                <div class="stat-desc">\${data.marketData.priceChangePercent > 0 ? '+' : ''}\${data.marketData.priceChangePercent.toFixed(2)}%</div>
              </div>

              <div class="stat">
                <div class="stat-title">Signal</div>
                <div class="stat-value text-2xl"><span class="badge \${signalClass} badge-lg">\${data.signal.type}</span></div>
                <div class="stat-desc">Confidence: \${(data.signal.confidence * 100).toFixed(1)}%</div>
              </div>

              <div class="stat">
                <div class="stat-title">Risk/Reward</div>
                <div class="stat-value text-2xl">\${data.signal.riskManagement.riskReward.toFixed(2)}</div>
              </div>
            </div>

            <div class="divider"></div>

            <h3 class="text-xl font-semibold mb-2">Risk Management</h3>
            <div class="grid gap-4 md:grid-cols-3">
              <div class="card bg-base-200">
                <div class="card-body p-4">
                  <h4 class="font-semibold">Entry</h4>
                  <p class="text-2xl">\${data.signal.riskManagement.entry.toFixed(2)}</p>
                </div>
              </div>
              <div class="card bg-base-200">
                <div class="card-body p-4">
                  <h4 class="font-semibold">Stop Loss</h4>
                  <p class="text-2xl">\${data.signal.riskManagement.stopLoss.toFixed(2)}</p>
                </div>
              </div>
              <div class="card bg-base-200">
                <div class="card-body p-4">
                  <h4 class="font-semibold">Take Profit</h4>
                  <p class="text-2xl">\${data.signal.riskManagement.takeProfit.map(tp => tp.toFixed(2)).join(', ')}</p>
                </div>
              </div>
            </div>

            <div class="divider"></div>

            <h3 class="text-xl font-semibold mb-2">ICT Components</h3>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="card bg-base-200">
                <div class="card-body p-4">
                  <h4 class="font-semibold">Fair Value Gaps</h4>
                  <p>Total: \${data.ictAnalysis.fairValueGaps.length}</p>
                  <p>Active: \${data.ictAnalysis.fairValueGaps.filter(fvg => !fvg.filled).length}</p>
                </div>
              </div>
              <div class="card bg-base-200">
                <div class="card-body p-4">
                  <h4 class="font-semibold">Order Blocks</h4>
                  <p>Total: \${data.ictAnalysis.orderBlocks.length}</p>
                  <p>Active: \${data.ictAnalysis.orderBlocks.filter(ob => ob.active).length}</p>
                </div>
              </div>
              <div class="card bg-base-200">
                <div class="card-body p-4">
                  <h4 class="font-semibold">Market Structure</h4>
                  <p>Trend: \${data.ictAnalysis.marketStructure.trend}</p>
                  <p>Phase: \${data.ictAnalysis.marketStructure.currentStructure.phase}</p>
                </div>
              </div>
              <div class="card bg-base-200">
                <div class="card-body p-4">
                  <h4 class="font-semibold">Confluence Score</h4>
                  <p>Bullish: \${data.ictAnalysis.confluence.bullishScore}</p>
                  <p>Bearish: \${data.ictAnalysis.confluence.bearishScore}</p>
                </div>
              </div>
            </div>

            <div class="divider"></div>

            <h3 class="text-xl font-semibold mb-2">AI Reasoning</h3>
            <div class="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>\${data.signal.reasoning}</span>
            </div>

            <div class="divider"></div>

            <h3 class="text-xl font-semibold mb-2">Primary Setup</h3>
            <div class="alert alert-success">
              <span>\${data.signal.setup.primary}</span>
            </div>

            <h3 class="text-xl font-semibold mb-2">Confirmations</h3>
            <ul class="list-disc list-inside">
              \${data.signal.setup.confirmations.map(c => \`<li>\${c}</li>\`).join('')}
            </ul>

            <h3 class="text-xl font-semibold mb-2 mt-4">Invalidations</h3>
            <ul class="list-disc list-inside">
              \${data.signal.setup.invalidations.map(i => \`<li>\${i}</li>\`).join('')}
            </ul>
          </div>
        </div>
      \`;
    }
  </script>
</body>
</html>`;

uiRouter.get('/', (c) => {
  return c.html(UIPage);
});

export default uiRouter;
