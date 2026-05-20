import { useState, useRef, useEffect, useContext, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Send, ImagePlus, X, Brain, Bot } from 'lucide-react'

function timestamp() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export default function AIChat() {
  const { apiFetch } = useContext(AuthContext)
  const { resolved } = useTheme()
  const isDark = resolved === 'dark'
  const [searchParams] = useSearchParams()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好！我是 Laplace Market AI。你可以：\n• 文字提问交易分析\n• 上传K线截图让我分析走势\n• 上传持仓截图让我评估风险\n• 点击下方按钮让我诊断你的交易行为', time: timestamp() },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const chatEnd = useRef(null)
  const fileRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setInput(q)
  }, [searchParams])

  const handleImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = (reader.result || '').split(',')[1]
      setImageBase64(b64)
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const clearImage = () => {
    setImagePreview(null); setImageBase64(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const addMessage = (role, content) => setMessages(m => [...m, { role, content, time: timestamp() }])

  const safeJson = async (res) => {
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { answer: '服务器错误，请稍后重试' } }
  }

  const send = async () => {
    if (!input.trim() && !imageBase64) return
    const displayText = input || '[上传了图片]'
    addMessage('user', displayText)
    setInput(''); setLoading(true)
    try {
      if (imageBase64) {
        const res = await apiFetch('/api/vision/analyze', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageBase64, prompt: input || undefined }),
        })
        const data = await safeJson(res)
        if (res.ok) addMessage('assistant', data.answer || '分析失败')
        else addMessage('assistant', '图片分析失败：' + (data.detail || '请检查 Vision API 配置'))
      } else {
        const res = await apiFetch('/api/ai/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: input }),
        })
        const data = await safeJson(res)
        if (res.ok) addMessage('assistant', data.answer || 'AI 无响应')
        else addMessage('assistant', data.answer || data.detail || 'AI 服务暂时不可用')
      }
    } catch {
      addMessage('assistant', 'AI 服务暂时不可用')
    }
    setLoading(false); clearImage()
  }

  const runDiagnosis = async () => {
    if (loading) return
    setLoading(true)
    addMessage('user', '诊断我的交易行为')
    try {
      const res = await apiFetch('/api/ai/diagnose', { method: 'POST' })
      const d = await safeJson(res)
      if (res.ok && !d.message) {
        let text = ''
        if (d.patterns) text += '## 行为诊断\n' + d.patterns + '\n\n'
        if (d.briefing) text += '## 风险简报\n' + d.briefing + '\n\n'
        if (d.questions?.length) text += '## 反思问题\n' + d.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
        addMessage('assistant', text || '暂无诊断结果')
      } else {
        addMessage('assistant', d.message || d.answer || '诊断暂不可用')
      }
    } catch {
      addMessage('assistant', 'AI 服务暂时不可用')
    }
    setLoading(false)
  }

  // Group consecutive messages from same sender
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
    <div className="h-[520px] flex flex-col rounded-xl overflow-hidden border"
      style={{ background: isDark ? '#1a1d24' : '#f0f2f5' }}>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 scrollbar-thin">
        {grouped.map((group, gi) => (
          <div key={gi} className={`flex gap-2 ${group.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* AI avatar — only on first message of group */}
            {group.role === 'assistant' && (
              <div className="shrink-0 mt-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{ background: isDark ? '#374151' : '#e5e7eb' }}>
                  <Bot size={16} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                </div>
              </div>
            )}
            {group.role === 'user' && <div className="w-8 shrink-0" />}

            <div className={`flex flex-col ${group.role === 'user' ? 'items-end' : 'items-start'}`}
              style={{ maxWidth: '75%' }}>
              {group.items.map((m, mi) => {
                const first = mi === 0
                const last = mi === group.items.length - 1
                const isUser = group.role === 'user'

                let borderRadius = '16px'
                if (group.items.length > 1) {
                  if (first && !last) borderRadius = isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'
                  else if (last && !first) borderRadius = isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px'
                  else if (!first && !last) borderRadius = isUser ? '16px 4px 4px 16px' : '4px 16px 16px 4px'
                }

                return (
                  <div key={mi} className="mb-0.5">
                    <div
                      style={{
                        background: isUser
                          ? (isDark ? '#3b82f6' : '#2b93f0')
                          : (isDark ? '#1f2937' : '#ffffff'),
                        color: isUser ? '#fff' : undefined,
                        borderRadius,
                        padding: '8px 14px',
                        maxWidth: '100%',
                        wordBreak: 'break-word',
                        fontSize: 13,
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                        boxShadow: isUser ? 'none' : (isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.06)'),
                        position: 'relative',
                      }}
                    >
                      {m.image && <img src={m.image} alt="uploaded" style={{ maxWidth: 200, borderRadius: 8, marginBottom: 6 }} />}
                      {m.content}
                      {/* Tail — Telegram-style small triangle */}
                      {last && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            [isUser ? 'right' : 'left']: -6,
                            width: 12,
                            height: 12,
                            background: isUser
                              ? (isDark ? '#3b82f6' : '#2b93f0')
                              : (isDark ? '#1f2937' : '#ffffff'),
                            clipPath: isUser
                              ? 'polygon(0 0, 100% 100%, 100% 0)'
                              : 'polygon(100% 0, 0 100%, 0 0)',
                            transform: 'translateY(50%)',
                          }}
                        />
                      )}
                    </div>
                    {/* Timestamp */}
                    {last && (
                      <div className={`text-[10px] mt-0.5 ${isUser ? 'text-right mr-1' : 'ml-1'}`}
                        style={{ color: isDark ? '#6b7280' : '#999' }}>
                        {m.time}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: isDark ? '#374151' : '#e5e7eb' }}>
              <Bot size={16} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
            </div>
            <div className="px-4 py-2.5 rounded-2xl text-sm" style={{
              background: isDark ? '#1f2937' : '#fff',
              boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
            }}>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={chatEnd} />
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="px-4 pb-1 relative inline-block">
          <img src={imagePreview} alt="preview" style={{ maxHeight: 80, borderRadius: 8, border: '1px solid #e5e7eb' }} />
          <button onClick={clearImage}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-0 cursor-pointer">
            <X size={11} color="#fff" />
          </button>
        </div>
      )}

      {/* Actions bar */}
      <div className="px-4 pb-2 flex gap-2">
        <Button variant="outline" size="sm" onClick={runDiagnosis} disabled={loading}
          className="text-xs border-brand-green/30 text-brand-green-dark hover:bg-brand-green/5">
          <Brain size={14} className="mr-1.5" />诊断我的交易行为
        </Button>
      </div>

      {/* Input bar */}
      <div className="px-4 pb-3 flex gap-2 items-end">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileRef.current?.click()} disabled={loading}>
          <ImagePlus size={17} className="text-muted-foreground" />
        </Button>
        <input type="file" accept="image/*" ref={fileRef} onChange={handleImage} style={{ display: 'none' }} />
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={imagePreview ? '描述图片内容（可选）...' : '输入消息...'}
          className="flex-1 h-9 text-sm rounded-xl border focus-visible:ring-0 focus-visible:border-brand-green/50"
        />
        <Button size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={send}
          disabled={loading || (!input.trim() && !imageBase64)}>
          <Send size={16} />
        </Button>
      </div>
    </div>
  )
}
