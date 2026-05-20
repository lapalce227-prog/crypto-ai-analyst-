import { useState, useEffect, useContext, useRef } from 'react'
import { AuthContext } from '../context/AuthContext'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { ScrollArea } from '../components/ui/scroll-area'
import { MessageSquare, Heart, Send, RefreshCw } from 'lucide-react'

export default function Community() {
  const { apiFetch, user } = useContext(AuthContext)
  const [posts, setPosts] = useState([])
  const [content, setContent] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const chatEnd = useRef(null)

  const fetchPosts = async () => {
    const res = await apiFetch('/api/community/posts')
    if (res.ok) setPosts(await res.json())
  }

  useEffect(() => { fetchPosts() }, [])

  const submitPost = async () => {
    if (!content.trim()) return
    await apiFetch('/api/community/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, parent_id: replyingTo }),
    })
    setContent(''); setReplyingTo(null); fetchPosts()
  }

  const toggleLike = async (postId) => {
    await apiFetch(`/api/community/posts/${postId}/like`, { method: 'POST' })
    fetchPosts()
  }

  const topPosts = posts.filter(p => !p.parent_id)
  const replies = (pid) => posts.filter(p => p.parent_id === pid)

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><MessageSquare size={15} />交易社区</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchPosts}><RefreshCw size={13} /></Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 p-0 px-5">
        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-2 pb-2">
            {topPosts.map(p => (
              <div key={p.id} className="p-3 rounded-xl border border bg-card">
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-semibold text-brand-green-dark">{p.username}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleString('zh-CN')}</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{p.content}</p>
                <div className="flex gap-3 mt-2">
                  <button onClick={() => toggleLike(p.id)} className="flex items-center gap-1 bg-transparent border-0 cursor-pointer text-[11px]"
                    style={{ color: p.liked_by?.includes(user?.id) ? '#ef4444' : '#8b949e' }}>
                    <Heart size={12} fill={p.liked_by?.includes(user?.id) ? '#ef4444' : 'none'} />{p.likes || 0}
                  </button>
                  <button onClick={() => setReplyingTo(replyingTo === p.id ? null : p.id)}
                    className="bg-transparent border-0 cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                    回复 ({replies(p.id).length})
                  </button>
                </div>
                {replies(p.id).map(r => (
                  <div key={r.id} className="mt-2 ml-4 p-2.5 bg-secondary rounded-lg border-l-2 border">
                    <span className="text-[11px] font-semibold text-brand-green-dark">{r.username}</span>
                    <span className="text-xs text-foreground ml-2">{r.content}</span>
                  </div>
                ))}
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
        </ScrollArea>

        <div className="pt-3 border-t border pb-2">
          {replyingTo && (
            <div className="text-[11px] text-amber-500 mb-1.5">
              回复 #{replyingTo} <button onClick={() => setReplyingTo(null)} className="bg-transparent border-0 text-muted-foreground cursor-pointer ml-1">取消</button>
            </div>
          )}
          <div className="flex gap-2">
            <Input value={content} onChange={e => setContent(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitPost()}
              placeholder="分享你的交易心得..." className="flex-1 h-9 text-sm" />
            <Button size="icon" className="h-9 w-9 shrink-0" onClick={submitPost} disabled={!content.trim()}>
              <Send size={15} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
