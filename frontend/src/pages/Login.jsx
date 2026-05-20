import { useState, useContext } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { LogIn, AlertCircle, Loader2, TrendingUp, BarChart3, Shield, Zap, Brain } from 'lucide-react'

const features = [
  { icon: BarChart3, title: '交易复盘', desc: '记录每笔交易，分析盈亏原因' },
  { icon: Brain, title: 'AI 分析', desc: '智能诊断交易行为，发现模式' },
  { icon: TrendingUp, title: '策略回测', desc: '验证交易策略的历史表现' },
  { icon: Shield, title: '风险看板', desc: '实时监控交易风险指标' },
  { icon: Zap, title: 'OKX 接入', desc: 'API 一键导入持仓数据' },
]

export default function Login() {
  const { login } = useContext(AuthContext)
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* 左侧 — 品牌展示 */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] bg-gray-900 flex-col justify-between p-10 relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 30% 20%, #7CFF4F 1px, transparent 1px), radial-gradient(circle at 70% 60%, #7CFF4F 1px, transparent 1px), radial-gradient(circle at 50% 80%, #7CFF4F 1px, transparent 1px)',
            backgroundSize: '80px 80px, 120px 120px, 60px 60px',
          }} />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-brand-green/15 border border-brand-green/30 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-green shadow-[0_0_12px_rgba(124,255,79,0.4)]" />
            </div>
            <div>
              <div className="text-white text-lg font-semibold tracking-tight">Laplace Market</div>
              <div className="text-gray-500 text-xs">交易分析平台</div>
            </div>
          </div>

          {/* 主标语 */}
          <h2 className="text-white text-2xl font-semibold leading-tight mb-3 tracking-tight">
            看清每一笔<br />交易的真相
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-12 max-w-sm">
            从数据中认识自己。不只是记流水账，而是通过 AI 诊断、策略回测、风险分析，发现你交易中的模式与盲区。
          </p>

          {/* 功能列表 */}
          <div className="space-y-5">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0 group-hover:bg-gray-700 transition-colors">
                  <f.icon size={15} className="text-gray-400 group-hover:text-gray-300 transition-colors" />
                </div>
                <div>
                  <div className="text-gray-300 text-sm font-medium">{f.title}</div>
                  <div className="text-gray-500 text-xs">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部 */}
        <div className="relative z-10 text-gray-600 text-[11px]">
          &copy; {new Date().getFullYear()} Laplace Agent
        </div>
      </div>

      {/* 右侧 — 登录表单 */}
      <div className="flex-1 flex items-center justify-center px-6 bg-background">
        <div className="w-full max-w-[360px]">
          {/* 移动端显示 logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-brand-green" />
              <span className="text-sm text-muted-foreground font-medium">Laplace Market</span>
            </div>
          </div>

          <h1 className="text-xl font-semibold text-foreground mb-1">欢迎回来</h1>
          <p className="text-sm text-muted-foreground mb-6">登录你的账户继续分析</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">用户名</label>
              <Input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="输入用户名" required autoFocus className="h-10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">密码</label>
              <Input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="输入密码" required className="h-10"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                <AlertCircle size={14} /><span>{error}</span>
              </div>
            )}
            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <LogIn size={16} className="mr-1.5" />}
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>

          <p className="text-center mt-6 text-xs text-muted-foreground">
            还没有账户？<Link to="/register" className="text-brand-green-dark hover:underline font-medium">立即注册</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
