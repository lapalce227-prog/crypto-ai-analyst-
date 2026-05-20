import { createContext, useState, useEffect, useContext, useCallback } from 'react'
import { AuthContext } from './AuthContext'

export const TradeContext = createContext(null)

export function TradeProvider({ children }) {
  const { apiFetch } = useContext(AuthContext)
  const [trades, setTrades] = useState([])
  const [stats, setStats] = useState(null)

  const fetchTrades = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        apiFetch('/api/trades'),
        apiFetch('/api/stats'),
      ])
      if (tRes.ok) setTrades(await tRes.json())
      if (sRes.ok) setStats(await sRes.json())
    } catch {
      // offline fallback
    }
  }, [apiFetch])

  useEffect(() => { fetchTrades() }, [fetchTrades])

  const addTrade = async (trade) => {
    const res = await apiFetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade),
    })
    if (res.ok) {
      const newTrade = await res.json()
      setTrades(prev => [newTrade, ...prev])
      fetchTrades()
    }
  }

  return (
    <TradeContext.Provider value={{ trades, stats, fetchTrades, addTrade }}>
      {children}
    </TradeContext.Provider>
  )
}
