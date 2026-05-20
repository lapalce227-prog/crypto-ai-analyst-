import { useState, useContext } from 'react'
import { TradeContext } from '../context/TradeContext'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'DOGE/USDT', 'PEPE/USDT']

export default function TradeInput() {
  const { addTrade } = useContext(TradeContext)
  const [form, setForm] = useState({
    symbol: 'BTC/USDT', direction: 'long', leverage: 10,
    entry_price: '', amount: '', stop_loss: '', take_profit: '',
    emotion_level: 5, notes: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    addTrade({
      ...form,
      entry_price: parseFloat(form.entry_price),
      amount: parseFloat(form.amount),
      stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
      take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
      leverage: parseInt(form.leverage),
      emotion_level: parseInt(form.emotion_level),
      opened_at: new Date().toISOString(),
      direction: form.direction
    })
    setForm(f => ({ ...f, entry_price: '', amount: '', stop_loss: '', take_profit: '', notes: '' }))
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">记录一笔交易</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol + Direction row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">币种</label>
              <Select value={form.symbol} onValueChange={v => set('symbol', v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">方向</label>
              <div className="flex rounded-md border border-input p-0.5 bg-muted">
                <button type="button"
                  onClick={() => set('direction', 'long')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-sm text-xs font-medium transition-all duration-150
                    ${form.direction === 'long' ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <ArrowUpCircle size={13} />做多
                </button>
                <button type="button"
                  onClick={() => set('direction', 'short')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-sm text-xs font-medium transition-all duration-150
                    ${form.direction === 'short' ? 'bg-card text-red-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <ArrowDownCircle size={13} />做空
                </button>
              </div>
            </div>
          </div>

          {/* Numbers grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">杠杆</label>
              <Input type="number" value={form.leverage} onChange={e => set('leverage', e.target.value)} min={1} max={125} className="h-9 text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">入场价</label>
              <Input type="number" step="0.01" value={form.entry_price} onChange={e => set('entry_price', e.target.value)} required className="h-9 text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">金额 (USDT)</label>
              <Input type="number" step="0.1" value={form.amount} onChange={e => set('amount', e.target.value)} required className="h-9 text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">止损价</label>
              <Input type="number" step="0.01" value={form.stop_loss} onChange={e => set('stop_loss', e.target.value)} className="h-9 text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">止盈价</label>
              <Input type="number" step="0.01" value={form.take_profit} onChange={e => set('take_profit', e.target.value)} className="h-9 text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">情绪强度 ({form.emotion_level})</label>
              <input type="range" min={1} max={10} value={form.emotion_level} onChange={e => set('emotion_level', e.target.value)}
                className="w-full h-1.5 accent-brand-green cursor-pointer" />
              <p className="text-[11px] text-muted-foreground">
                {form.emotion_level >= 7 ? '上头了' : form.emotion_level <= 3 ? '冷静' : '正常'}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">备注</label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="为什么开这单？（比如：看到金叉、群里喊单、FOMO了...）" rows={2} className="text-xs resize-none" />
          </div>

          <Button type="submit" className="w-full" size="sm">记录这笔交易</Button>
        </form>
      </CardContent>
    </Card>
  )
}
