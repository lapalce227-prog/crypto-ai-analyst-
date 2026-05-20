import { useState, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Line } from 'recharts'
import { Play, Loader2, TrendingUp, TrendingDown, BarChart3, Activity, DollarSign } from 'lucide-react'
import TokenSelector from './TokenSelector'

/* ---- 数据源配置 ---- */
const SYMBOLS = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'BNB-USDT', 'XRP-USDT',
  'DOGE-USDT', 'SUI-USDT', 'PEPE-USDT', 'LINK-USDT', 'ADA-USDT',
]

const TIMEFRAMES = [
  { label: '1时', bar: '1H', limit: 500 },
  { label: '4时', bar: '4H', limit: 500 },
  { label: '日线', bar: '1D', limit: 500 },
]

function todayStr() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000)
  return d.toISOString().slice(0, 10)
}

/* ---- 时间格式化 ---- */
function fmtTick(t) {
  if (!t) return ''
  // "2024-01-15 12:00" → 按周期精简
  if (t.length <= 10) return t.slice(5, 10)   // "01-15"
  const date = t.slice(5, 10)
  const time = t.slice(11, 16)
  if (time === '00:00') return date
  return `${date}\n${time}`
}

export default function StrategyBacktest() {
  const { apiFetch } = useContext(AuthContext)

  // 选择
  const [symbol, setSymbol] = useState('BTC-USDT')
  const [tfIdx, setTfIdx] = useState(2)  // default 日线
  const [dateStart, setDateStart] = useState(daysAgo(90))
  const [dateEnd, setDateEnd] = useState(todayStr())

  // 参数
  const [amount, setAmount] = useState(100)
  const [intervalK, setIntervalK] = useState(1)

  // 状态
  const [ohlcv, setOhlcv] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const tf = TIMEFRAMES[tfIdx]

  const fetchAndBacktest = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    let candles = ohlcv

    try {
      // 1. 获取数据
      if (!candles) {
        const res = await fetch(`/api/okx/candles?instId=${symbol}&bar=${tf.bar}&limit=${tf.limit}`)
        const json = await res.json()
        if (json.code !== '0' || !json.data?.length) {
          setError('数据获取失败')
          setLoading(false)
          return
        }
        const raw = [...json.data].reverse()
        candles = raw.map(d => ({
          time: new Date(Number(d[0])).toISOString().replace('T', ' ').slice(0, 16),
          open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]),
        }))
        setOhlcv(candles)
      }

      // 2. 日期筛选
      const filtered = candles.filter(c => {
        const ct = c.time.slice(0, 10)
        if (dateStart && ct < dateStart) return false
        if (dateEnd && ct > dateEnd) return false
        return true
      })

      if (filtered.length < 2) {
        setError('日期范围内数据不足（至少需要2根K线）')
        setLoading(false)
        return
      }

      // 3. 回测
      const res = await apiFetch('/api/strategy/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: 'dca',
          ohlcv: filtered,
          params: { amount, interval: intervalK, direction: 'long' },
        }),
      })
      const d = await res.json()
      if (res.ok) {
        // 为图表生成更短的时间标签
        const curve = d.equity_curve.map(p => ({
          ...p,
          label: fmtTick(p.time),
        }))
        setResult({ ...d, equity_curve: curve })
      } else {
        setError(d.detail || '回测失败')
      }
    } catch {
      setError('请求失败')
    }
    setLoading(false)
  }

  const statCards = result ? [
    { icon: DollarSign, label: '投入', value: `$${result.total_invested.toLocaleString()}`, color: 'text-gray-500' },
    { icon: DollarSign, label: '最终价值', value: `$${result.final_value.toLocaleString()}`, color: 'text-blue-500' },
    { icon: result.total_pnl >= 0 ? TrendingUp : TrendingDown, label: '总盈亏', value: `${result.total_pnl >= 0 ? '+' : ''}$${result.total_pnl.toLocaleString()}`, color: result.total_pnl >= 0 ? 'text-emerald-500' : 'text-red-500' },
    { icon: TrendingUp, label: 'ROI', value: `${result.roi_pct}%`, color: result.roi_pct >= 0 ? 'text-emerald-500' : 'text-red-500' },
    { icon: Activity, label: '最大回撤', value: `${result.max_drawdown_pct}%`, color: 'text-amber-500' },
    { icon: BarChart3, label: '买入次数', value: result.trade_count, color: 'text-purple-500' },
  ] : []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">策略回测</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 第1行：币种 + K线周期 + 定投参数 */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">币种</label>
                <TokenSelector
                  tokens={SYMBOLS}
                  value={symbol}
                  onChange={v => { setSymbol(v); setOhlcv(null); setResult(null) }}
                  labelFn={s => s.replace('-USDT', '')}
                />
              </div>

              <div className="flex gap-1">
                {TIMEFRAMES.map((t, i) => (
                  <button key={t.bar} onClick={() => { setTfIdx(i); setOhlcv(null); setResult(null) }}
                    className={`text-xs h-9 px-3 rounded-md border transition-all font-medium
                      ${tfIdx === i ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border hover:border'}`}
                  >{t.label}</button>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">每次金额 (USDT)</label>
                <Input type="number" step={10} min={1} value={amount}
                  onChange={e => { setAmount(parseFloat(e.target.value) || 0); setResult(null) }}
                  className="h-9 w-[130px] text-xs font-mono" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">间隔 (K线数)</label>
                <Input type="number" step={1} min={1} value={intervalK}
                  onChange={e => { setIntervalK(parseInt(e.target.value) || 1); setResult(null) }}
                  className="h-9 w-[110px] text-xs font-mono" />
              </div>
            </div>

            {/* 第2行：日期范围（集成在获取步骤中） */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">回测区间</span>
              <Input type="date" value={dateStart}
                onChange={e => { setDateStart(e.target.value); setOhlcv(null); setResult(null) }}
                className="h-8 w-[150px] text-xs" />
              <span className="text-xs text-muted-foreground">—</span>
              <Input type="date" value={dateEnd}
                onChange={e => { setDateEnd(e.target.value); setOhlcv(null); setResult(null) }}
                className="h-8 w-[150px] text-xs" />
              <Button onClick={fetchAndBacktest} disabled={loading} size="sm" className="text-xs h-8 ml-1">
                {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Play size={14} className="mr-1" />}
                开始回测
              </Button>
              {ohlcv && (
                <span className="text-[11px] text-muted-foreground">已缓存 {ohlcv.length} 根K线</span>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">{error}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---- 结果 ---- */}
      {result && (
        <>
          {/* 指标卡 */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {statCards.map((s, i) => (
              <Card key={i} className="text-center py-3 px-2">
                <s.icon size={15} className={`mx-auto mb-1.5 ${s.color}`} />
                <div className={`text-base font-bold font-mono tabular-nums ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{s.label}</div>
              </Card>
            ))}
          </div>

          {/* 资金曲线 */}
          <Card>
            <CardHeader><CardTitle className="text-sm">资金曲线</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={result.equity_curve} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={11} tick={{ fontSize: 11, fill: '#6b7280' }}
                    interval="preserveStartEnd" minTickGap={50} />
                  <YAxis fontSize={11} tick={{ fontSize: 11, fill: '#6b7280' }}
                    domain={['auto', 'auto']}
                    tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                    formatter={(v, name) => {
                      const val = `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      return [val, name === 'value' ? '市值' : '本金']
                    }}
                    labelFormatter={l => `时间: ${l}`}
                  />
                  {/* 本金曲线 — 灰色虚线 */}
                  <Line type="stepAfter" dataKey="principal" stroke="#94a3b8" strokeWidth={1.5}
                    strokeDasharray="6 3" dot={false} name="本金" />
                  {/* 市值曲线 — 蓝色面积 */}
                  <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={1.8}
                    fill="url(#eqGrad)" dot={false} name="市值" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 交易明细 */}
          <Card>
            <CardHeader><CardTitle className="text-sm">定投明细</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border text-muted-foreground">
                      <th className="text-left py-2 px-3 font-medium">时间</th>
                      <th className="text-right py-2 px-3 font-medium">价格</th>
                      <th className="text-right py-2 px-3 font-medium">买入金额</th>
                      <th className="text-right py-2 px-3 font-medium">获得数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i} className="border-b border hover:bg-muted/50">
                        <td className="py-2 px-3 font-mono text-[11px]">{t.time?.slice(0, 16) || ''}</td>
                        <td className="py-2 px-3 text-right font-mono">${t.price?.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono">${t.amount?.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono">{t.qty?.toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
