import { useContext } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext } from './context/AuthContext'
import { TradeProvider } from './context/TradeContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Landing from './pages/Landing'
import KLineChart from './components/KLineChart'
import TradeInput from './components/TradeInput'
import TradeList from './components/TradeList'
import AiPage from './components/AiPage'
import RiskDashboard from './components/RiskDashboard'
import OkxImport from './components/OkxImport'
import NewsPage from './components/NewsPage'
import StrategyBacktest from './components/StrategyBacktest'
import { Loader2 } from 'lucide-react'

function TradeJournalPage() {
  return (
    <div className="space-y-4">
      <TradeInput />
      <TradeList />
    </div>
  )
}

function ProtectedLayout() {
  const { isAuthenticated } = useContext(AuthContext)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return (
    <TradeProvider>
      <AppLayout />
    </TradeProvider>
  )
}

function HomeRoute() {
  const { isAuthenticated } = useContext(AuthContext)
  if (isAuthenticated) {
    return (
      <TradeProvider>
        <AppLayout />
      </TradeProvider>
    )
  }
  return <Landing />
}

export default function App() {
  const { isAuthenticated, loading } = useContext(AuthContext)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <Register />} />
      <Route element={<ProtectedLayout />}>
        <Route path="kline" element={<KLineChart />} />
        <Route path="journal" element={<TradeJournalPage />} />
        <Route path="ai" element={<AiPage />} />
        <Route path="dashboard" element={<RiskDashboard />} />
        <Route path="import" element={<OkxImport />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="backtest" element={<StrategyBacktest />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
