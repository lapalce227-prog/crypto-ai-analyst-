import { createContext, useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../lib/api'

export const AuthContext = createContext(null)

const TOKEN_KEY = 'auth_token'

async function safeJson(res) {
  const text = await res.text()
  try { return JSON.parse(text) }
  catch { throw new Error(`服务器错误 (${res.status})`) }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const apiFetch = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem(TOKEN_KEY)
    const headers = { ...options.headers }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${API_BASE}${url}`, { ...options, headers })
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      setUser(null)
    }
    return res
  }, [])

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { setLoading(false); return }
    apiFetch('/api/auth/me')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setUser(data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [apiFetch])

  const login = async (username, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await safeJson(res)
    if (!res.ok) throw new Error(data.detail || '登录失败')
    localStorage.setItem(TOKEN_KEY, data.access_token)
    setUser(data.user)
    return data
  }

  const register = async (username, password) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await safeJson(res)
    if (!res.ok) throw new Error(data.detail || '注册失败')
    localStorage.setItem(TOKEN_KEY, data.access_token)
    setUser(data.user)
    return data
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, register, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  )
}
