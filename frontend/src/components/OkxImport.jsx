import { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { TradeContext } from '../context/TradeContext'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { CloudDownload, ClipboardPaste, CheckCircle2, AlertCircle, History, Calendar, Save, Trash2 } from 'lucide-react'

const STORAGE_KEY = 'okx_api_config'

function loadConfig() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw) } catch {}
  return { apiKey: '', apiSecret: '', apiPassphrase: '' }
}

function saveConfig(config) { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)) }
function clearConfig() { localStorage.removeItem(STORAGE_KEY) }

export default function OkxImport() {
  const { apiFetch } = useContext(AuthContext)
  const { fetchTrades } = useContext(TradeContext)
  const [mode, setMode] = useState('api')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [apiPassphrase, setApiPassphrase] = useState('')
  const [dateBegin, setDateBegin] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [showDateRange, setShowDateRange] = useState(false)
  const [jsonText, setJsonText] = useState('')

  useEffect(() => {
    const cfg = loadConfig()
    if (cfg.apiKey) { setApiKey(cfg.apiKey); setApiSecret(cfg.apiSecret); setApiPassphrase(cfg.apiPassphrase); setSaved(true) }
  }, [])

  const creds = () => ({ api_key: apiKey, api_secret: apiSecret, api_passphrase: apiPassphrase })

  const handleSaveConfig = () => {
    if (!apiKey || !apiSecret || !apiPassphrase) return
    saveConfig({ apiKey, apiSecret, apiPassphrase })
    setSaved(true)
  }

  const handleClearConfig = () => {
    clearConfig(); setApiKey(''); setApiSecret(''); setApiPassphrase(''); setSaved(false)
  }

  const handleFetch = async (type) => {
    setLoading(type); setError(null); setResult(null)
    try {
      if (type === 'positions') {
        const res = await apiFetch('/api/import/okx/fetch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds()),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || '请求失败')
        setResult(data)
        fetchTrades()
      } else {
        const body = { ...creds(), begin: dateBegin ? dateBegin + 'T00:00:00' : '', end: dateEnd ? dateEnd + 'T23:59:59' : '', limit: 100 }
        const res = await apiFetch('/api/import/okx/history', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || '请求失败')
        setResult(data)
        fetchTrades()
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(null) }
  }

  const handlePaste = async () => {
    setLoading('paste'); setError(null); setResult(null)
    try {
      const parsed = JSON.parse(jsonText)
      if (!parsed.positions && !Array.isArray(parsed)) throw new Error('JSON 需要包含 positions 数组，或直接粘贴持仓数组')
      const positions = Array.isArray(parsed) ? parsed : parsed.positions
      const res = await apiFetch('/api/import/okx', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positions }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '请求失败')
      setResult(data)
      fetchTrades()
    } catch (e) { setError(e.message) }
    finally { setLoading(null) }
  }

  const sampleJson = JSON.stringify([{ instId: 'BTC-USDT-SWAP', posSide: 'long', lever: '10', avgPx: '67500', margin: '100', cTime: Date.now().toString() }], null, 2)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm">导入 OKX 数据</CardTitle>
          {saved && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]">已保存</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {/* Mode toggle */}
        <div className="flex rounded-lg bg-muted p-1 mb-5">
          <button
            onClick={() => { setMode('api'); setError(null); setResult(null) }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150
              ${mode === 'api' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <CloudDownload size={13} />API 拉取
          </button>
          <button
            onClick={() => { setMode('paste'); setError(null); setResult(null) }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150
              ${mode === 'paste' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <ClipboardPaste size={13} />粘贴 JSON
          </button>
        </div>

        {mode === 'api' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium">API Key</label>
              <Input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="OKX API Key" className="h-9 text-xs" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Secret Key</label>
              <Input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="OKX Secret Key" className="h-9 text-xs" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Passphrase</label>
              <Input type="password" value={apiPassphrase} onChange={e => setApiPassphrase(e.target.value)} placeholder="OKX API Passphrase" className="h-9 text-xs" />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSaveConfig} disabled={!apiKey} className="text-xs">
                <Save size={12} className="mr-1" />保存到本地
              </Button>
              {saved && (
                <Button variant="outline" size="sm" onClick={handleClearConfig} className="text-xs text-red-500 hover:text-red-600 hover:border-red-200">
                  <Trash2 size={12} className="mr-1" />清除
                </Button>
              )}
            </div>

            <div className="flex gap-3">
              <Button onClick={() => handleFetch('positions')} disabled={!!loading || !apiKey} className="flex-1 text-xs" size="sm">
                <CloudDownload size={13} className="mr-1" />{loading === 'positions' ? '拉取中...' : '当前持仓'}
              </Button>
              <Button variant="secondary" onClick={() => handleFetch('history')} disabled={!!loading || !apiKey} className="flex-1 text-xs" size="sm">
                <History size={13} className="mr-1" />{loading === 'history' ? '拉取中...' : '历史仓位'}
              </Button>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setShowDateRange(!showDateRange)} className="text-xs">
              <Calendar size={12} className="mr-1" />{showDateRange ? '收起时间筛选' : '按时间范围筛选'}
            </Button>
            {showDateRange && (
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-medium">开始日期</label>
                  <Input type="date" value={dateBegin} onChange={e => setDateBegin(e.target.value)} className="h-9 text-xs" />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-medium">结束日期</label>
                  <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-9 text-xs" />
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'paste' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium">粘贴 OKX 持仓 JSON</label>
              <Textarea value={jsonText} onChange={e => setJsonText(e.target.value)}
                placeholder={`示例格式：\n${sampleJson}`} rows={10} className="text-xs font-mono" />
            </div>
            <Button onClick={handlePaste} disabled={!!loading || !jsonText.trim()} size="sm">
              {loading === 'paste' ? '导入中...' : '解析并导入'}
            </Button>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
            <AlertCircle size={14} /><span>{error}</span>
          </div>
        )}
        {result && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs">
            <CheckCircle2 size={15} /><span>成功导入 {result.imported} 条交易记录</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
