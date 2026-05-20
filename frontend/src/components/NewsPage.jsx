import { useState, useEffect, useContext, useRef } from 'react'
import { AuthContext } from '../context/AuthContext'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { ScrollArea } from '../components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { MessageSquare, Heart, RefreshCw, FileText, Eye, Plus, ArrowLeft, Users, Hash, Trash2, Send, TrendingUp, ExternalLink } from 'lucide-react'

/* ===== 可滑动删除的消息行 ===== */
function SwipeableRow({ children, onDelete, canDelete }) {
  const startX = useRef(0)
  const [offset, setOffset] = useState(0)
  const [confirming, setConfirming] = useState(false)

  const onTouchStart = (e) => {
    startX.current = e.touches[0].clientX
    setConfirming(false)
    setOffset(0)
  }
  const onTouchMove = (e) => {
    const dx = startX.current - e.touches[0].clientX
    if (dx > 0) setOffset(Math.min(dx, 180))
  }
  const onTouchEnd = () => {
    if (offset > 120) {
      setConfirming(true)
      setOffset(160)
    } else {
      setOffset(0)
    }
  }

  if (!canDelete) return <>{children}</>

  return (
    <div className="relative overflow-hidden">
      {/* Delete button behind */}
      <div
        className={`absolute right-0 top-0 bottom-0 flex items-center px-4 rounded-r-lg transition-all cursor-pointer ${confirming ? 'bg-destructive' : 'bg-red-500/20'}`}
        style={{ width: confirming ? '100%' : 160, zIndex: 0 }}
        onClick={() => { if (confirming) onDelete() }}
      >
        <span className="text-xs font-medium text-white ml-auto">
          {confirming ? '确认删除' : <Trash2 size={14} />}
        </span>
      </div>
      {/* Content */}
      <div
        className="relative bg-card transition-transform duration-200"
        style={{ transform: `translateX(-${offset}px)`, zIndex: 1 }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}

/* ===== 社区 ===== */
function CommunityTab() {
  const { apiFetch, user } = useContext(AuthContext)
  const [posts, setPosts] = useState([])
  const [content, setContent] = useState('')
  const [activeChat, setActiveChat] = useState(null)   // null=列表, post=聊天室
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const chatEnd = useRef(null)

  const fetchPosts = async () => {
    const res = await apiFetch('/api/community/posts')
    if (res.ok) setPosts(await res.json())
  }

  useEffect(() => { fetchPosts() }, [])

  const submitReply = async () => {
    if (!content.trim() || !activeChat) return
    await apiFetch('/api/community/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, parent_id: activeChat.id }),
    })
    setContent(''); fetchPosts()
  }

  const createGroup = async () => {
    if (!groupName.trim()) return
    const topic = `# ${groupName}\n\n${groupDesc || '欢迎加入讨论'}\n\n---\n在下方回复参与讨论`
    await apiFetch('/api/community/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: topic }),
    })
    setGroupName(''); setGroupDesc(''); setShowGroupDialog(false); fetchPosts()
  }

  const toggleLike = async (postId) => {
    await apiFetch(`/api/community/posts/${postId}/like`, { method: 'POST' })
    fetchPosts()
  }

  const deletePost = async (postId) => {
    await apiFetch(`/api/community/posts/${postId}`, { method: 'DELETE' })
    fetchPosts()
  }

  const topPosts = posts.filter(p => !p.parent_id)
  const chatReplies = activeChat ? posts.filter(p => p.parent_id === activeChat.id) : []

  // 聊天室视图
  if (activeChat) {
    const isGroup = activeChat.content?.startsWith('# ')
    return (
      <Card className="flex flex-col h-[600px]">
        <CardHeader className="flex-row items-center gap-3 pb-3">
          <Button variant="ghost" size="sm" onClick={() => setActiveChat(null)} className="text-xs h-7 px-2">
            <ArrowLeft size={14} className="mr-1" />返回
          </Button>
          <div>
            <CardTitle className="text-sm flex items-center gap-1.5">
              {isGroup ? <Hash size={14} className="text-brand-green-dark" /> : null}
              {isGroup ? activeChat.content.split('\n')[0].replace('# ', '') : activeChat.username}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 p-0 px-5">
          <ScrollArea className="flex-1 pr-3">
            <div className="space-y-2 pb-2">
              {/* 主帖 */}
              <div className="p-3 rounded-xl bg-secondary">
                <span className="text-[11px] font-semibold text-foreground">{activeChat.username}</span>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap mt-1">
                  {isGroup ? activeChat.content.split('\n').slice(2).filter(l => l !== '---' && l !== '在下方回复参与讨论').join('\n') : activeChat.content}
                </p>
              </div>
              {/* 回复 */}
              {chatReplies.map(r => (
                <SwipeableRow key={r.id} canDelete={r.username === user?.username} onDelete={() => deletePost(r.id)}>
                  <div className="p-3 border-b">
                    <div className="flex justify-between">
                      <span className="text-[11px] font-semibold text-foreground">{r.username}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString('zh-CN')}</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed mt-1">{r.content}</p>
                  </div>
                </SwipeableRow>
              ))}
              <div ref={chatEnd} />
            </div>
          </ScrollArea>
          <div className="flex gap-2 py-3 border-t">
            <Input value={content} onChange={e => setContent(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitReply()}
              placeholder="输入消息..." className="flex-1 h-9 text-sm" />
            <Button size="icon" className="h-9 w-9 shrink-0" onClick={submitReply} disabled={!content.trim()}>
              <Send size={15} />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 列表视图
  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><MessageSquare size={15} />交易社区</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowGroupDialog(true)} className="text-xs h-7">
            <Users size={12} className="mr-1" />创建群
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchPosts}><RefreshCw size={13} /></Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0 px-5">
        <ScrollArea className="h-full pr-3">
          <div className="space-y-2 pb-4">
            {topPosts.map(p => {
              const isGroup = p.content?.startsWith('# ')
              const groupTitle = isGroup ? p.content.split('\n')[0].replace('# ', '') : null
              const replyCount = posts.filter(r => r.parent_id === p.id).length
              return (
                <SwipeableRow key={p.id} canDelete={p.username === user?.username} onDelete={() => deletePost(p.id)}>
                  <div
                    onClick={() => setActiveChat(p)}
                    className={`p-3 rounded-xl border bg-card cursor-pointer transition-colors hover:border-border ${isGroup ? 'border-l-2 border-l-brand-green' : ''}`}
                  >
                    {isGroup ? (
                      <>
                        <div className="flex justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <Hash size={13} className="text-brand-green-dark" />
                            <span className="text-sm font-semibold text-brand-green-dark">{groupTitle}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleString('zh-CN')}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                          <span>{p.username} 创建</span>
                          <span>{replyCount} 条讨论</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-semibold text-foreground">{p.username}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleString('zh-CN')}</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap line-clamp-3">{p.content}</p>
                        <div className="flex gap-3 mt-2">
                          <button onClick={e => { e.stopPropagation(); toggleLike(p.id) }} className="flex items-center gap-1 bg-transparent border-0 cursor-pointer text-[11px]"
                            style={{ color: p.liked_by?.includes(user?.id) ? '#ef4444' : '#8b949e' }}>
                            <Heart size={12} fill={p.liked_by?.includes(user?.id) ? '#ef4444' : 'none'} />{p.likes || 0}
                          </button>
                          <span className="text-[11px] text-muted-foreground">{replyCount} 条回复</span>
                        </div>
                      </>
                    )}
                  </div>
                </SwipeableRow>
              )
            })}
            {topPosts.length === 0 && <p className="text-muted py-8 text-center">暂无讨论，创建一个群开始吧。</p>}
          </div>
        </ScrollArea>
      </CardContent>

      {/* 创建群 Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><Users size={15} />创建讨论群</DialogTitle>
            <DialogDescription className="text-xs">创建一个新的讨论话题，其他人可以在下方回复。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">群名称</label>
              <Input value={groupName} onChange={e => setGroupName(e.target.value)}
                placeholder="例如：BTC 多军集结号" className="h-9 text-sm" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">简介（可选）</label>
              <Textarea value={groupDesc} onChange={e => setGroupDesc(e.target.value)}
                placeholder="描述这个群的讨论主题..." rows={2} className="text-sm resize-none" />
            </div>
            <Button onClick={createGroup} disabled={!groupName.trim()} size="sm" className="w-full">创建</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/* ===== 加密快讯 ===== */
function formatTimeAgo(iso) {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

const FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'important', label: '重要' },
  { value: 'hot', label: '重磅' },
]

function CryptoNewsTab() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('important')
  const [error, setError] = useState(null)

  const fetchNews = async (f) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/news?limit=30&filter=${f}`)
      const data = await res.json()
      if (data.error) { setError(data.error); setPosts([]) }
      else setPosts(data.results || [])
    } catch {
      setError('网络请求失败')
      setPosts([])
    }
    setLoading(false)
  }

  useEffect(() => { fetchNews(filter) }, [filter])

  const getBadge = (p) => {
    const votes = p.votes?.positive || 0
    const isHot = votes > 50 || p.important
    const isImportant = votes > 20
    if (isHot) return { label: '重磅', color: 'bg-red-500', anim: true }
    if (isImportant) return { label: '重要', color: 'bg-orange-500', anim: false }
    return { label: '资讯', color: 'bg-muted', anim: false }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><TrendingUp size={15} />加密快讯</CardTitle>
        <div className="flex gap-1">
          {FILTER_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setFilter(o.value)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors font-medium
                ${filter === o.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            >{o.label}</button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-xl bg-secondary animate-pulse">
                <div className="w-12 h-5 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="py-8 text-center text-muted">
            <p>新闻服务暂不可用</p>
            <p className="text-[11px] mt-1">请检查 CRYPTOPANIC_TOKEN 配置</p>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="py-8 text-center text-muted">暂无新闻</div>
        )}

        {!loading && posts.length > 0 && (
          <div className="space-y-2">
            {posts.map((p, i) => {
              const badge = getBadge(p)
              return (
                <a key={p.id || i} href={p.url} target="_blank" rel="noopener noreferrer"
                  className="flex gap-3 p-3 rounded-xl border bg-card cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm hover:border-border group"
                >
                  <div className="shrink-0 pt-0.5">
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold text-white ${badge.color}
                      ${badge.anim ? 'animate-pulse' : ''}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold leading-snug line-clamp-2 text-foreground group-hover:text-brand-green-dark transition-colors">
                      {p.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {p.source?.title && (
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                          {p.source.title}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{formatTimeAgo(p.published_at || p.created_at)}</span>
                      <ExternalLink size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ===== 新闻 ===== */
function BlogTab() {
  const { apiFetch } = useContext(AuthContext)
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
          <div className="mb-4 p-3 bg-secondary rounded-xl space-y-3">
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
              className="p-3.5 rounded-xl border bg-card cursor-pointer transition-all duration-150 hover:border-border hover:shadow-sm"
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

export default function NewsPage() {
  return (
    <Tabs defaultValue="community" className="space-y-4">
      <TabsList className="w-fit">
        <TabsTrigger value="community" className="text-xs gap-1.5">
          <MessageSquare size={13} />社区
        </TabsTrigger>
        <TabsTrigger value="crypto" className="text-xs gap-1.5">
          <TrendingUp size={13} />快讯
        </TabsTrigger>
        <TabsTrigger value="blog" className="text-xs gap-1.5">
          <FileText size={13} />观察
        </TabsTrigger>
      </TabsList>
      <TabsContent value="community"><CommunityTab /></TabsContent>
      <TabsContent value="crypto"><CryptoNewsTab /></TabsContent>
      <TabsContent value="blog"><BlogTab /></TabsContent>
    </Tabs>
  )
}
