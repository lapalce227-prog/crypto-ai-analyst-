import { useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Avatar, AvatarFallback } from '../ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import { LogOut, ChevronDown, Sun, Moon, Brain } from 'lucide-react'

const pageTitles = {
  '/journal': '交易记录',
  '/': '首页',
  '/kline': '市场',
  '/ai': 'AI',
  '/backtest': '策略回测',
  '/dashboard': '风险看板',
  '/import': 'API 配置',
  '/news': '新闻',
}

export default function TopBar({ agentOpen, onToggleAgent }) {
  const { user, logout } = useContext(AuthContext)
  const { mode, resolved, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const title = pageTitles[location.pathname] || ''

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="fixed top-0 left-[240px] right-0 h-14 bg-card border-b flex items-center justify-between px-6 z-10">
      <div>
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Agent toggle */}
        <button
          onClick={onToggleAgent}
          className={`h-8 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 border-0 cursor-pointer transition-all ${
            agentOpen
              ? 'bg-brand-green/10 text-brand-green border border-brand-green/30'
              : 'bg-secondary text-muted-foreground hover:text-foreground border border-transparent'
          }`}
        >
          <Brain size={14} />
          Agent
        </button>
        {/* Theme toggle */}
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          onClick={toggle}
          title={mode === 'auto' ? `自动 (${resolved === 'dark' ? '夜间' : '白天'})` : mode === 'dark' ? '夜间模式' : '白天模式'}
        >
          {resolved === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
        </Button>
        {/* Search placeholder */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border text-muted-foreground">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <span className="text-xs">搜索...</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity outline-none">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-secondary text-muted-foreground text-[11px]">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="text-[13px] font-medium text-foreground hidden sm:block">{user?.username}</span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <div className="px-2 py-1.5">
              <div className="text-sm font-medium">{user?.username}</div>
              <div className="text-xs text-muted-foreground">交易员</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-500 focus:text-red-500">
              <LogOut size={14} className="mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
