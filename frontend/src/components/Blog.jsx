import { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { FileText, Eye, Plus, ArrowLeft } from 'lucide-react'

export default function Blog() {
  const { apiFetch, user } = useContext(AuthContext)
  const [articles, setArticles] = useState([])
  const [selected, setSelected] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const fetchArticles = async () => {
    const res = await apiFetch('/api/blog')
    if (res.ok) setArticles(await res.json())
  }

  useEffect(() => { fetchArticles() }, [])

  const handleView = async (id) => {
    const res = await apiFetch(`/api/blog/${id}`)
    if (res.ok) setSelected(await res.json())
  }

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) return
    await apiFetch('/api/blog', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    })
    setTitle(''); setContent(''); setShowEditor(false); fetchArticles()
  }

  if (selected) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4 text-xs">
            <ArrowLeft size={12} className="mr-1" />返回列表
          </Button>
          <h3 className="text-lg font-semibold mb-2">{selected.title}</h3>
          <div className="text-xs text-muted-foreground mb-4">
            {selected.username} · {new Date(selected.created_at).toLocaleString('zh-CN')} · {selected.views} 阅读
          </div>
          <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{selected.content}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><FileText size={15} />市场观察</CardTitle>
        <Button size="sm" onClick={() => setShowEditor(!showEditor)} className="text-xs h-7">
          <Plus size={12} className="mr-1" />写文章
        </Button>
      </CardHeader>
      <CardContent>
        {showEditor && (
          <div className="mb-4 p-3 bg-secondary border rounded-xl space-y-3">
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="文章标题" className="h-9 text-sm" />
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="写下你的市场见解..." rows={6} className="text-sm" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate}>发布</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowEditor(false)}>取消</Button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {articles.map(a => (
            <div key={a.id} onClick={() => handleView(a.id)}
              className="p-3.5 rounded-xl border border bg-card cursor-pointer transition-all duration-150 hover:border hover:shadow-sm"
            >
              <h4 className="text-sm font-semibold mb-1.5">{a.title}</h4>
              <div className="text-[11px] text-muted-foreground flex gap-3">
                <span>{a.username}</span>
                <span>{new Date(a.created_at).toLocaleString('zh-CN')}</span>
                <span><Eye size={10} className="inline mr-0.5" />{a.views || 0}</span>
              </div>
            </div>
          ))}
          {articles.length === 0 && <p className="text-muted py-8 text-center">还没有文章，来写第一篇市场观察吧。</p>}
        </div>
      </CardContent>
    </Card>
  )
}
