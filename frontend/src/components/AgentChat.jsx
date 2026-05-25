import { useState, useRef, useEffect, useMemo, useContext } from 'react'
import { API_BASE } from '../lib/api'
import { useTheme } from '../context/ThemeContext'
import { AuthContext } from '../context/AuthContext'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Send, Bot, Brain, Loader2, Save, History, X, Trash2 } from 'lucide-react'
import { useAgent } from '../context/AgentContext'

function ts() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export default function AgentChat() {
  const { resolved } = useTheme()
  const isDark = resolved === 'dark'
  const { messages, setMessages } = useAgent()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [histories, setHistories] = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const chatEnd = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  // ---- API helpers ----
  async function api(method, path, body) {
    const token = localStorage.getItem('auth_token')
    const opts = { method, headers: { 'Authorization': `Bearer ${token}` } }
    if (body) {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
    const res = await fetch(`${API_BASE}${path}`, opts)
    if (res.status === 401) { localStorage.removeItem('auth_token'); window.location.href = '/login' }
    return res
  }

  // ---- Save ----
  const save = async () => {
    if (messages.length <= 1) return
    try {
      const res = await api('POST', '/api/ai/agent/history', {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      })
      if (res.ok) {
        const data = await res.json()
        // Show brief feedback
        setMessages(m => [...m.slice(0, -1),
          { ...m[m.length - 1], content: m[m.length - 1].content + '\n\n💾 已保存' }])
        setTimeout(() => {
          setMessages(m => {
            const copy = [...m]
            copy[copy.length - 1] = { ...copy[copy.length - 1],
              content: copy[copy.length - 1].content.replace('\n\n💾 已保存', '') }
            return copy
          })
        }, 1500)
      }
    } catch {}
  }

  // ---- Load history list ----
  const loadHistories = async () => {
    setHistLoading(true)
    try {
      const res = await api('GET', '/api/ai/agent/history')
      if (res.ok) setHistories(await res.json())
    } catch {}
    setHistLoading(false)
  }

  const openHistory = () => {
    setShowHistory(true)
    loadHistories()
  }

  // ---- Load a specific history ----
  const load = async (id) => {
    try {
      const res = await api('GET', `/api/ai/agent/history/${id}`)
      if (res.ok) {
        const data = await res.json()
        const msgs = data.messages || []
        setMessages(msgs.map(m => ({ ...m, time: ts() })))
        setShowHistory(false)
      }
    } catch {}
  }

  // ---- Delete ----
  const del = async (id) => {
    try {
      await api('DELETE', `/api/ai/agent/history/${id}`)
      setHistories(h => h.filter(x => x.id !== id))
    } catch {}
  }

  // ---- Send message ----
  const send = async () => {
    if (!input.trim() || loading) return
    const q = input
    setInput('')
    setMessages(m => [...m, { role: 'user', content: q, time: ts() }])
    setLoading(true)
    setThinking(true)

    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${API_BASE}/api/ai/agent/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: q }].map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      let buffer = ''
      let assistantAdded = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.error) { full += data.content; break }
            if (data.done) { setThinking(false); break }
            if (data.content) {
              setThinking(false)
              if (!assistantAdded) {
                setMessages(m => [...m, { role: 'assistant', content: '', time: ts() }])
                assistantAdded = true
              }
              full += data.content
              setMessages(m => {
                const copy = [...m]
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: full }
                return copy
              })
            }
          } catch {}
        }
      }
      if (!full) setMessages(m => [...m, { role: 'assistant', content: 'Agent 未返回响应', time: ts() }])
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Agent 服务不可用: ' + e.message, time: ts() }])
    }
    setLoading(false)
    setThinking(false)
  }

  const grouped = useMemo(() => {
    const groups = []
    for (const m of messages) {
      const prev = groups[groups.length - 1]
      if (prev && prev.role === m.role) {
        prev.items.push(m)
      } else {
        groups.push({ role: m.role, items: [m] })
      }
    }
    return groups
  }, [messages])

  return (
    <div className="flex flex-col rounded-xl overflow-hidden border h-[520px]"
      style={{ background: isDark ? '#1a1d24' : '#f0f2f5' }}>

      {/* Header */}
      <div className="px-4 py-2.5 border-b flex items-center justify-between"
        style={{ borderColor: isDark ? '#2a2e38' : '#e5e7eb', background: isDark ? '#0B0E11' : '#fafafa' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,255,79,0.1)' }}>
            <Brain size={14} className="text-brand-green" />
          </div>
          <div>
            <span className="text-xs font-semibold" style={{ color: isDark ? '#d4d4d8' : '#333' }}>Laplace Agent</span>
            <span className="text-[10px] ml-1.5 text-muted-foreground">Qwen + LangGraph</span>
          </div>
          {thinking && (
            <span className="flex items-center gap-1 text-[10px] text-amber-500">
              <Loader2 size={10} className="animate-spin" />思考中
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={save} disabled={messages.length <= 1}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border-0 cursor-pointer transition-colors"
            style={{ color: isDark ? '#848E9C' : '#999', background: 'transparent' }}
            title="保存对话">
            <Save size={12} />保存
          </button>
          <button onClick={openHistory}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border-0 cursor-pointer transition-colors"
            style={{ color: isDark ? '#848E9C' : '#999', background: 'transparent' }}
            title="历史记录">
            <History size={12} />历史
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 scrollbar-thin">
        {grouped.map((group, gi) => (
          <div key={gi} className={`flex gap-2 ${group.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {group.role === 'assistant' && (
              <div className="shrink-0 mt-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: isDark ? '#374151' : '#e5e7eb' }}>
                  <Bot size={14} className={isDark ? 'text-brand-green' : 'text-emerald-600'} />
                </div>
              </div>
            )}
            {group.role === 'user' && <div className="w-7 shrink-0" />}

            <div className={`flex flex-col ${group.role === 'user' ? 'items-end' : 'items-start'}`} style={{ maxWidth: '80%' }}>
              {group.items.map((m, mi) => {
                const last = mi === group.items.length - 1
                const isUser = group.role === 'user'
                return (
                  <div key={mi} className="mb-0.5">
                    <div style={{
                      background: isUser ? (isDark ? '#3b82f6' : '#2b93f0') : (isDark ? '#1f2937' : '#ffffff'),
                      color: isUser ? '#fff' : undefined,
                      borderRadius: '16px', padding: '7px 12px',
                      maxWidth: '100%', wordBreak: 'break-word',
                      fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                      boxShadow: isUser ? 'none' : (isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.06)'),
                    }}>
                      {m.content}
                    </div>
                    {last && (
                      <div className={`text-[10px] mt-0.5 ${isUser ? 'text-right mr-1' : 'ml-1'}`}
                        style={{ color: isDark ? '#6b7280' : '#999' }}>{m.time}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
              style={{ background: isDark ? '#374151' : '#e5e7eb' }}>
              <Brain size={13} className="text-amber-500 animate-pulse" />
            </div>
            <div className="px-4 py-2.5 rounded-2xl text-sm flex items-center gap-2"
              style={{ background: isDark ? '#1f2937' : '#fff', boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.06)' }}>
              <Loader2 size={13} className="animate-spin text-amber-500" />
              <span style={{ color: isDark ? '#9ca3af' : '#666', fontSize: 13 }}>思考中...</span>
            </div>
          </div>
        )}

        <div ref={chatEnd} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t flex gap-2 items-end" style={{ borderColor: isDark ? '#2a2e38' : '#e5e7eb' }}>
        <Input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="问 Agent 任何交易分析问题..."
          disabled={loading}
          className="flex-1 h-9 text-sm rounded-xl border focus-visible:ring-0 focus-visible:border-brand-green/50"
        />
        <Button size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={send} disabled={loading || !input.trim()}>
          <Send size={15} />
        </Button>
      </div>

      {/* History Panel Overlay */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowHistory(false)}>
          <div className="rounded-xl overflow-hidden shadow-2xl w-[380px] max-h-[420px] flex flex-col"
            style={{ background: isDark ? '#1a1d24' : '#fff' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: isDark ? '#2a2e38' : '#e5e7eb' }}>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <History size={14} />对话历史
              </h3>
              <button onClick={() => setShowHistory(false)} className="border-0 bg-transparent cursor-pointer"
                style={{ color: isDark ? '#848E9C' : '#999' }}>
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {histLoading && (
                <p className="text-xs text-center py-8 text-muted-foreground">加载中...</p>
              )}
              {!histLoading && histories.length === 0 && (
                <p className="text-xs text-center py-8 text-muted-foreground">暂无保存的对话</p>
              )}
              {histories.map(h => (
                <div key={h.id} className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors group">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => load(h.id)}>
                    <div className="text-xs font-medium truncate" style={{ color: isDark ? '#d4d4d8' : '#333' }}>
                      {h.title}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {h.message_count} 条消息 · {h.created_at?.slice(0, 10)}
                    </div>
                  </div>
                  <button onClick={() => del(h.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity border-0 bg-transparent cursor-pointer p-1"
                    style={{ color: isDark ? '#848E9C' : '#999' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
