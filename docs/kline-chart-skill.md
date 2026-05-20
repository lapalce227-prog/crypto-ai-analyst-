---
name: kline-chart
description: Create professional TradingView K-line charts for crypto/stock trading. Use when user needs candlestick charts, technical indicators, or real-time price visualization.
---

# K-line Chart Skill

Create professional candlestick (K-line) charts using TradingView's lightweight-charts library.

## When to use
- User wants to display crypto/stock price charts
- User needs candlestick charts with technical indicators
- User mentions "K线", "K线图", "行情图", "candlestick", "price chart"

## Template: Single-file HTML with lightweight-charts

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>K-line Chart</title>
<style>
  body { margin: 0; padding: 16px; background: #131722; font-family: -apple-system, sans-serif; }
  #chart { width: 100%; height: 500px; }
  .toolbar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
  .toolbar button { padding: 6px 14px; border: 1px solid #2a2e39; border-radius: 6px; background: #1e222d; color: #d1d4dc; cursor: pointer; font-size: 12px; }
  .toolbar button.active { background: #2962ff; border-color: #2962ff; color: #fff; }
  .legend { display: flex; gap: 16px; margin-top: 8px; font-size: 12px; color: #787b86; }
  .legend .bull { color: #26a69a; } .legend .bear { color: #ef5350; }
</style>
</head>
<body>
<div class="toolbar">
  <button data-interval="1m">1分</button>
  <button data-interval="5m">5分</button>
  <button data-interval="15m">15分</button>
  <button data-interval="1h" class="active">1时</button>
  <button data-interval="4h">4时</button>
  <button data-interval="1d">日线</button>
</div>
<div id="chart"></div>
<div class="legend">
  <span>🕯️ K线图</span>
  <span class="bull">■ 阳线（涨）</span>
  <span class="bear">■ 阴线（跌）</span>
  <span id="price-info"></span>
</div>

<script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"></script>
<script>
const chart = LightweightCharts.createChart(document.getElementById('chart'), {
  layout: {
    background: { type: 'solid', color: '#131722' },
    textColor: '#d1d4dc',
  },
  grid: {
    vertLines: { color: '#1e222d' },
    horzLines: { color: '#1e222d' },
  },
  crosshair: { mode: 1 },
  timeScale: { borderColor: '#2a2e39', timeVisible: true },
  rightPriceScale: { borderColor: '#2a2e39' },
});

const candleSeries = chart.addCandlestickSeries({
  upColor: '#26a69a', downColor: '#ef5350',
  borderUpColor: '#26a69a', borderDownColor: '#ef5350',
  wickUpColor: '#26a69a', wickDownColor: '#ef5350',
});

// Volume series
const volumeSeries = chart.addHistogramSeries({
  color: '#26a69a40',
  priceFormat: { type: 'volume' },
  priceScaleId: '',
});
chart.priceScale('').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

// EMA indicators
const ema7 = chart.addLineSeries({ color: '#ff9800', lineWidth: 1, priceLineVisible: false });
const ema25 = chart.addLineSeries({ color: '#ab47bc', lineWidth: 1, priceLineVisible: false });

// Calculate EMA
function calcEMA(data, period) {
  const k = 2 / (period + 1);
  let ema = data[0].close;
  const result = [{ time: data[0].time, value: ema }];
  for (let i = 1; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result.push({ time: data[i].time, value: ema });
  }
  return result;
}

// 🔴 数据接口：替换这里的数据源
// 格式: [{ time: '2024-01-01', open: 100, high: 105, low: 98, close: 102, volume: 1000 }, ...]
let chartData = [];

// 从父页面或全局变量获取数据
if (window.tradeData) {
  chartData = window.tradeData;
} else {
  // 演示数据（替换为真实API调用）
  fetch('YOUR_API_ENDPOINT_HERE')
    .then(r => r.json())
    .then(data => {
      chartData = data;
      renderChart();
    });
}

function renderChart() {
  if (!chartData.length) return;
  candleSeries.setData(chartData);
  
  const volumes = chartData.map(d => ({
    time: d.time,
    value: d.volume || 0,
    color: d.close >= d.open ? '#26a69a40' : '#ef535040'
  }));
  volumeSeries.setData(volumes);
  
  ema7.setData(calcEMA(chartData, 7));
  ema25.setData(calcEMA(chartData, 25));
  
  const last = chartData[chartData.length - 1];
  document.getElementById('price-info').textContent = 
    `O:${last.open} H:${last.high} L:${last.low} C:${last.close}`;
  
  chart.timeScale().fitContent();
}

// Toolbar switching
document.querySelectorAll('.toolbar button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toolbar button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // 触发数据重新加载
    const interval = btn.dataset.interval;
    fetch(`YOUR_API?interval=${interval}`)
      .then(r => r.json())
      .then(data => { chartData = data; renderChart(); });
  });
});

// 监听数据更新
window.updateChart = function(newData) {
  chartData = newData;
  renderChart();
};

// 初始渲染
if (chartData.length) renderChart();
</script>
</body>
</html>
```

## Data Format (JSON)
```json
[
  {
    "time": "2024-01-01T08:00:00",
    "open": 43100.5,
    "high": 43250.0,
    "low": 43000.0,
    "close": 43180.0,
    "volume": 12345.67
  }
]
```

## Key parameters to customize
- `upColor/downColor`: 阳线/阴线颜色（默认绿涨红跌）
- `chart.layout.background.color`: 背景色
- `chart.height`: 图表高度
- Indicators: 可添加 MA, MACD, RSI, Bollinger Bands 等
- Data source: 替换 `YOUR_API_ENDPOINT_HERE` 为真实 API（Binance/OKX/TradingView）

## Integration with React
When embedding in React, use `useRef` + `useEffect` to mount the chart:
```jsx
const chartRef = useRef(null);
useEffect(() => {
  const chart = LightweightCharts.createChart(chartRef.current, { /* options */ });
  return () => chart.remove();
}, []);
```
