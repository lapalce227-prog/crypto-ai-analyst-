import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { TradeContext } from '../context/TradeContext'
import { AuthContext } from '../context/AuthContext'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Switch } from '../components/ui/switch'
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Target, Clock, Shield, Zap, Brain,
  MessageCircle, Loader2, AlertTriangle, BarChart3,
  Activity, DollarSign, Layers,
} from 'lucide-react'

const COLORS = {
  up: '#22c55e',
  down: '#ef4444',
  blue: '#2563eb',
  amber: '#f59e0b',
  purple: '#8b5cf6',
  gray: '#94a3b8',
}

export default function RiskDashboard() {
  const { stats, trades } = useContext(TradeContext)
  const { apiFetch } = useContext(AuthContext)
  const navigate = useNavigate()
  const [diagnosis, setDiagnosis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showEmotionCurve, setShowEmotionCurve] = useState(false)
  const [showPrincipalCurve, setShowPrincipalCurve] = useState(false)

  // Smooth emotion curve (SMA-3)
  const smoothedEmotion = stats.emotion_curve?.map((p, i, arr) => {
    const slice = arr.slice(Math.max(0, i - 2), i + 1)
    const avg = slice.reduce((s, x) => s + x.value, 0) / slice.length
    return { ...p, value: Math.round(avg * 10) / 10 }
  }) || []

  // Merge equity + emotion for dual-axis chart
  const mergedCurve = stats.equity_curve?.map((eq, i) => ({
    ...eq,
    emo: smoothedEmotion[i]?.value ?? null,
  })) || []

  useEffect(() => {
    if (!apiFetch || !trades || trades.length < 3) return
    setLoading(true)
    apiFetch('/api/ai/diagnose', { method: 'POST' })
      .then(async r => {
        const text = await r.text()
        try { return JSON.parse(text) } catch { return { message: '服务器错误' } }
      })
      .then(d => setDiagnosis(d))
      .catch(() => setDiagnosis({ message: 'AI 服务暂不可用' }))
      .finally(() => setLoading(false))
  }, [trades?.length])

  if (!stats || stats.total === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">风险看板</CardTitle></CardHeader>
        <CardContent><p className="text-muted">记录交易后，这里会展示风险分析。</p></CardContent>
      </Card>
    )
  }

  const statCards = [
    { icon: Target, label: '胜率', value: `${stats.win_rate}%`, sub: `${stats.wins}W / ${stats.losses}L`, color: stats.win_rate >= 50 ? 'text-emerald-500' : 'text-red-500' },
    { icon: DollarSign, label: '总盈亏', value: `${stats.total_pnl >= 0 ? '+' : ''}$${Math.abs(stats.total_pnl).toLocaleString()}`, sub: null, color: stats.total_pnl >= 0 ? 'text-emerald-500' : 'text-red-500' },
    { icon: Layers, label: '总仓位数', value: stats.total, sub: `${stats.open_positions} 未平仓`, color: 'text-blue-500' },
    { icon: Shield, label: '盈亏因子', value: stats.profit_factor, sub: `盈 $${stats.total_profit?.toLocaleString()} / 亏 $${stats.total_loss?.toLocaleString()}`, color: stats.profit_factor >= 1.5 ? 'text-emerald-500' : 'text-amber-500' },
    { icon: Zap, label: '风险回报比', value: `1:${stats.risk_reward_ratio}`, sub: '平均止盈 / 止损', color: stats.risk_reward_ratio >= 2 ? 'text-emerald-500' : 'text-amber-500' },
    { icon: TrendingUp, label: '平均盈亏', value: `${stats.avg_pnl >= 0 ? '+' : ''}$${Math.abs(stats.avg_pnl).toLocaleString()}`, sub: '每笔已平仓', color: stats.avg_pnl >= 0 ? 'text-emerald-500' : 'text-red-500' },
    { icon: Activity, label: '平均杠杆', value: `${stats.avg_leverage}x`, sub: null, color: stats.avg_leverage <= 10 ? 'text-emerald-500' : stats.avg_leverage <= 20 ? 'text-amber-500' : 'text-red-500' },
    { icon: Clock, label: '平均持仓时间', value: `${stats.avg_hold_hours}h`, sub: stats.avg_hold_hours > 0 ? `${(stats.avg_hold_hours / 24).toFixed(1)} 天` : null, color: 'text-purple-500' },
  ]

  const hasDiagnosis = diagnosis && !diagnosis.message

  return (
    <div className="space-y-4">
      {/* Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <Card key={i} className="py-3.5 px-4 hover:border transition-colors">
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.color.replace('text-', 'bg-')}/10`}>
                <s.icon size={14} className={s.color} />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{s.label}</span>
            </div>
            <div className={`text-lg font-bold font-mono tabular-nums ${s.color}`}>{s.value}</div>
            {s.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>}
          </Card>
        ))}
      </div>

      {/* Charts Row — Equity Curve (with toggles) + PnL Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Equity Curve — dual Y-axis */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp size={15} className="text-emerald-500" />盈亏曲线
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">本金</span>
                <Switch checked={showPrincipalCurve} onCheckedChange={setShowPrincipalCurve} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">情绪</span>
                <Switch checked={showEmotionCurve} onCheckedChange={setShowEmotionCurve} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={mergedCurve} margin={{ top: 5, right: showEmotionCurve ? 40 : 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" fontSize={10} tick={{ fontSize: 10, fill: '#94a3b8' }}
                  interval="preserveStartEnd" minTickGap={60} />
                {/* Left Y — PnL */}
                <YAxis yAxisId="left" fontSize={10} tick={{ fontSize: 10, fill: '#94a3b8' }}
                  domain={['auto', 'auto']}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                {/* Right Y — Emotion */}
                {showEmotionCurve && (
                  <YAxis yAxisId="right" orientation="right" fontSize={10}
                    tick={{ fontSize: 10, fill: '#8b5cf6' }}
                    domain={[0, 10]} ticks={[1, 3, 5, 7, 10]}
                    tickFormatter={v => v === 1 ? '冷静' : v === 5 ? '中性' : v === 10 ? '上头' : ''}
                    width={40} />
                )}
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  formatter={(v, name) => {
                    if (name === '累计盈亏') return [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, name]
                    if (name === '本金') return [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, name]
                    if (name === '情绪') return [v, name]
                    return [v, name]
                  }}
                />
                {/* 累计盈亏 — 绿色面积 */}
                <Area yAxisId="left" type="monotone" dataKey="value"
                  stroke="#22c55e" strokeWidth={2} fill="url(#pnlGrad)"
                  dot={false} name="累计盈亏" />
                {/* 零轴 */}
                <Line yAxisId="left" dataKey={() => 0} stroke="#e5e7eb"
                  strokeWidth={0.5} dot={false} name="零轴" />
                {/* 本金曲线 — toggle */}
                {showPrincipalCurve && (
                  <Line yAxisId="left" type="stepAfter" dataKey="principal"
                    stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 3"
                    dot={false} name="本金" />
                )}
                {/* 情绪曲线 (SMA-3平滑) — toggle */}
                {showEmotionCurve && (
                  <Line yAxisId="right" type="monotone" dataKey="emo"
                    stroke="#8b5cf6" strokeWidth={1.5} dot={false}
                    name="情绪" />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* PnL Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 size={15} className="text-blue-500" />单笔盈亏分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={stats.equity_curve} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" fontSize={10} tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" minTickGap={60} />
                <YAxis fontSize={10} tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                  formatter={(v) => [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, '单笔盈亏']}
                />
                <Bar dataKey="pnl" radius={[2, 2, 0, 0]} maxBarSize={14}
                  shape={(props) => {
                    const { x, y, width, height, payload } = props
                    if (height === undefined || !payload) return null
                    const pnlVal = payload.pnl ?? 0
                    const fill = pnlVal >= 0 ? '#22c55e' : '#ef4444'
                    return <rect x={x} y={y} width={width} height={height} rx={2} ry={2} fill={fill} opacity={0.7} />
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Third Row — Emotion Win Rate Pie + Best/Worst Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Emotion Win Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain size={15} className="text-amber-500" />情绪 vs 胜率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-[160px] h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: '冷静胜率', value: stats.emotion_low_win_rate },
                      { name: '上头胜率', value: stats.emotion_high_win_rate },
                    ]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={40}>
                      <Cell fill="#22c55e" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip formatter={v => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                  <span className="text-xs text-muted-foreground">低情绪 (≤4) 胜率</span>
                  <span className="text-sm font-bold font-mono text-emerald-500">{stats.emotion_low_win_rate}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-red-500" />
                  <span className="text-xs text-muted-foreground">高情绪 (≥7) 胜率</span>
                  <span className="text-sm font-bold font-mono text-red-500">{stats.emotion_high_win_rate}%</span>
                </div>
                {stats.emotion_high_win_rate < stats.emotion_low_win_rate && (
                  <p className="text-[11px] text-amber-500 bg-amber-500/10 rounded-lg p-2 leading-relaxed max-w-[200px]">
                    上头时胜率低 {stats.emotion_low_win_rate - stats.emotion_high_win_rate}%，冷静交易很重要。
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Worst Hour + AI Insight summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />交易时段分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.worst_hour != null ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-xl">
                  <Clock size={24} className="text-amber-500" />
                  <div>
                    <div className="text-sm font-semibold text-amber-400">
                      {stats.worst_hour}:00 左右是最差时段
                    </div>
                    <div className="text-xs text-amber-600">
                      累计亏损 ${Math.abs(stats.worst_pnl).toLocaleString()}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  建议避开 {stats.worst_hour}:00 前后交易，或在该时段降低仓位/杠杆以控制风险。
                </p>
              </div>
            ) : (
              <p className="text-muted">数据不足，无法分析。</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Diagnosis */}
      {loading && (
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <Loader2 size={16} className="animate-spin text-muted-foreground" />
            <span className="text-muted">AI 正在分析你的交易行为...</span>
          </CardContent>
        </Card>
      )}

      {hasDiagnosis && (
        <>
          {diagnosis.patterns && (
            <Card className="border-l-2 border-l-brand-green">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Brain size={16} className="text-purple-500" />AI 行为诊断</CardTitle>
              </CardHeader>
              <CardContent><p className="text-sm text-foreground leading-relaxed">{diagnosis.patterns}</p></CardContent>
            </Card>
          )}

          {diagnosis.briefing && (
            <Card className="border-l-2 border-l-amber-400">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" />风险简报</CardTitle>
              </CardHeader>
              <CardContent><p className="text-sm text-foreground leading-relaxed">{diagnosis.briefing}</p></CardContent>
            </Card>
          )}

          {diagnosis.questions && diagnosis.questions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><MessageCircle size={16} className="text-emerald-500" />AI 向你提问</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {diagnosis.questions.map((q, i) => (
                    <Button key={i} variant="outline" className="w-full justify-start text-left text-sm font-normal h-auto py-2.5 px-3 hover:border-brand-green/40 hover:bg-brand-green/5 hover:text-brand-green-dark transition-all"
                      onClick={() => navigate(`/ai?q=${encodeURIComponent(q)}`)}>
                      {q}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
