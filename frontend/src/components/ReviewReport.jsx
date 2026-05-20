import { useState, useContext } from 'react'
import { TradeContext } from '../context/TradeContext'
import { AuthContext } from '../context/AuthContext'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { RefreshCw, Loader2 } from 'lucide-react'

export default function ReviewReport() {
  const { stats } = useContext(TradeContext)
  const { apiFetch } = useContext(AuthContext)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)

  const generateReport = async (period) => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      })
      const data = await res.json()
      if (res.ok) { setReport(data.answer) }
      else { throw new Error(data.detail) }
    } catch {
      if (!stats || stats.total === 0) {
        setReport('还没有交易数据，先去记录几笔交易再来生成复盘报告。')
      } else {
        const lines = [
          `复盘报告（共 ${stats.total} 笔交易）`,
          '',
          `胜率：${stats.win_rate}%（${stats.wins} 胜 / ${stats.losses} 负）`,
          `总盈亏：${stats.total_pnl >= 0 ? '+' : ''}${stats.total_pnl} USDT`,
          `平均杠杆：${stats.avg_leverage}x`,
          '',
          stats.emotion_high_win_rate > 0
            ? `情绪上头(≥7分)时胜率 ${stats.emotion_high_win_rate}%，低于低情绪时的 ${stats.emotion_low_win_rate}%——情绪是你的最大敌人。`
            : '',
          stats.worst_hour != null
            ? `最差交易时段：${stats.worst_hour}:00 左右，累计亏损 ${stats.worst_pnl} USDT。`
            : '',
        ].filter(Boolean).join('\n')
        setReport(lines)
      }
    }
    setLoading(false)
  }

  const periods = [
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
    { key: 'all', label: '全部' },
  ]

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm">AI 复盘报告</CardTitle>
        <div className="flex gap-1.5">
          {periods.map(p => (
            <Button key={p.key} variant="ghost" size="sm" onClick={() => generateReport(p.key)} disabled={loading} className="text-xs h-7">
              <RefreshCw size={11} className="mr-1" />{p.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-3 py-4">
            <Loader2 size={16} className="animate-spin text-muted-foreground" />
            <span className="text-muted">AI 正在分析你的交易数据...</span>
          </div>
        )}
        {report && (
          <pre className="p-4 bg-secondary border rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap font-mono text-foreground">
            {report}
          </pre>
        )}
        {!report && !loading && <p className="text-muted py-4">点击上方按钮生成 AI 复盘报告。</p>}
      </CardContent>
    </Card>
  )
}
