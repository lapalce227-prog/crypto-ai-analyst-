import { useState, useContext } from 'react'
import { TradeContext } from '../context/TradeContext'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

function TradeInsight({ insight }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="mt-2 p-2.5 bg-brand-green/5 border-l-2 border-brand-green rounded-r cursor-pointer flex gap-2 items-start transition-colors hover:bg-brand-green/10"
    >
      <span className="text-[10px] font-bold text-brand-green-dark bg-brand-green/15 px-1.5 py-0.5 rounded shrink-0 mt-px">AI</span>
      <span className="text-xs text-muted-foreground leading-relaxed">
        {expanded ? insight : insight.slice(0, 60) + (insight.length > 60 ? '...' : '')}
      </span>
    </div>
  )
}

export default function TradeList() {
  const { trades } = useContext(TradeContext)

  if (trades.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted">还没有交易记录，去记录你的第一笔交易吧。</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">交易记录 ({trades.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {trades.map(t => (
            <div key={t.id} className="p-3.5 rounded-lg border border bg-card hover:border-border transition-colors duration-150">
              <div className="flex items-center gap-2.5">
                <Badge variant="outline" className={`text-[10px] uppercase tracking-wide px-1.5 py-0 ${t.direction === 'long' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-red-50 text-red-500 border-red-200'}`}>
                  {t.direction === 'long' ? '做多' : '做空'}
                </Badge>
                <span className="font-semibold text-sm tabular-nums">{t.symbol}</span>
                <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-500 font-mono tabular-nums">{t.leverage}x</Badge>
                {t.pnl != null && (
                  <span className={`ml-auto text-sm font-semibold font-mono tabular-nums ${t.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {t.pnl >= 0 ? '+' : ''}{t.pnl} USDT ({t.pnl_percent}%)
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground flex gap-3 flex-wrap">
                <span>入场 {t.entry_price} | 金额 {t.amount}U</span>
                {t.emotion_level >= 7 && <span className="text-amber-500 font-medium">情绪上头</span>}
              </div>
              {t.notes && <div className="mt-1 text-xs text-muted-foreground italic">{t.notes}</div>}
              {t.ai_insight && <TradeInsight insight={t.ai_insight} />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
