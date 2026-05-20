import { NavLink, useLocation } from 'react-router-dom'
import { useContext } from 'react'
import { AuthContext } from '../../context/AuthContext'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Separator } from '../ui/separator'
import {
  CandlestickChart, ClipboardList,
  LayoutDashboard, Users, FileText, TrendingUp, Webhook, Brain, Newspaper
} from 'lucide-react'

const navItems = [
  { path: '/kline', label: '市场', icon: CandlestickChart },
  { path: '/journal', label: '记录交易', icon: ClipboardList },
  { path: '/ai', label: 'AI', icon: Brain },
  { path: '/backtest', label: '策略回测', icon: TrendingUp },
  { path: '/dashboard', label: '风险看板', icon: LayoutDashboard },
  { path: '/import', label: 'API', icon: Webhook },
  { path: '/news', label: '新闻', icon: Newspaper },
]

export default function Sidebar() {
  const { user } = useContext(AuthContext)
  const location = useLocation()

  const isActive = (path) => {
    return location.pathname.startsWith(path)
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] flex flex-col bg-card border-r z-20">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-brand-green" />
        <div>
          <div className="text-[15px] font-semibold text-foreground leading-tight">Laplace Market</div>
          <div className="text-[11px] text-muted-foreground">交易分析平台</div>
        </div>
      </div>

      <Separator />

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map(item => {
          const Icon = item.icon
          const active = isActive(item.path, item.end)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
                transition-all duration-150 group
                ${active
                  ? 'bg-secondary text-foreground font-semibold border-l-[3px] border-brand-green pl-[9px]'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground border-l-[3px] border-transparent pl-[9px]'
                }
              `}
            >
              <Icon size={16} className={active ? 'text-brand-green-dark' : 'text-muted-foreground group-hover:text-foreground transition-colors'} />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-3 border-t">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-secondary text-muted-foreground text-xs">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-[13px] font-medium text-foreground">{user?.username || '用户'}</div>
            <div className="text-[11px] text-muted-foreground">交易员</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
