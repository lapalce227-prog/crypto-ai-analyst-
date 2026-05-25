import { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Bell, BellOff, Plus, X, TrendingUp, TrendingDown } from 'lucide-react'
import { API_BASE } from '../lib/api'

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'SUI', 'APT', 'AVAX', 'PEPE']

export default function AlertPanel() {
  const { apiFetch } = useContext(AuthContext)
  const [alerts, setAlerts] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ symbol: 'BTC', condition: 'above', price: '' })
  const [loading, setLoading] = useState(false)

  const loadAlerts = async () => {
    try {
      const res = await apiFetch('/api/ai/alerts')
      if (res.ok) setAlerts(await res.json())
    } catch {}
  }

  useEffect(() => { loadAlerts() }, [])

  const add = async () => {
    if (!form.price) return
    setLoading(true)
    try {
      const res = await apiFetch('/api/ai/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: form.symbol, condition: form.condition, target_price: parseFloat(form.price) }),
      })
      if (res.ok) {
        setForm({ symbol: 'BTC', condition: 'above', price: '' })
        setShowAdd(false)
        loadAlerts()
      }
    } catch {}
    setLoading(false)
  }

  const dismiss = async (id) => {
    try {
      await apiFetch(`/api/ai/alerts/${id}`, { method: 'DELETE' })
      loadAlerts()
    } catch {}
  }

  const activeAlerts = alerts.filter(a => !a.triggered)
  const triggeredAlerts = alerts.filter(a => a.triggered)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Bell size={15} className="text-amber-500" />
          价格预警
          {activeAlerts.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">{activeAlerts.length} 活跃</span>
          )}
        </h3>
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={12} className="mr-1" />添加
        </Button>
      </div>

      {showAdd && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border">
          <Select value={form.symbol} onValueChange={v => setForm(f => ({ ...f, symbol: v }))}>
            <SelectTrigger className="h-8 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYMBOLS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v }))}>
            <SelectTrigger className="h-8 text-xs w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="above">突破</SelectItem>
              <SelectItem value="below">跌破</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number" step="0.01" placeholder="价格"
            value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="h-8 text-xs w-24 font-mono"
          />
          <Button size="sm" className="h-8 text-xs" onClick={add} disabled={loading || !form.price}>
            {loading ? '...' : '确认'}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowAdd(false)}>
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Active alerts */}
      {activeAlerts.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground">暂无活跃预警。添加价格预警，Agent 会在价格触发时提醒你。</p>
      )}

      <div className="space-y-1.5">
        {activeAlerts.map(a => (
          <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold font-mono">{a.symbol}</span>
              <span className="text-[10px] text-muted-foreground">
                {a.condition === 'above' ? '突破' : '跌破'} ${Number(a.target_price).toLocaleString()}
              </span>
            </div>
            <button onClick={() => dismiss(a.id)} className="text-muted-foreground hover:text-red-500 transition-colors border-0 bg-transparent cursor-pointer">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Triggered */}
      {triggeredAlerts.length > 0 && (
        <>
          <h4 className="text-xs font-medium text-muted-foreground mt-4">已触发</h4>
          <div className="space-y-1.5 opacity-60">
            {triggeredAlerts.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/20 border border-border/30">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold font-mono line-through">{a.symbol}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {a.condition === 'above' ? '突破' : '跌破'} ${Number(a.target_price).toLocaleString()}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-500">已触发</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
