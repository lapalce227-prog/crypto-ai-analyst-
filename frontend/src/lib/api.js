export const API_BASE = import.meta.env.DEV ? '' : 'https://crypto-ai-analyst-production.up.railway.app'

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('auth_token')
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = 'Bearer ' + token
  const res = await fetch(API_BASE + path, { ...options, headers })
  if (res.status === 401) { localStorage.removeItem('auth_token'); window.location.href = '/login'; throw new Error('登录已过期') }
  return res
}

export async function apiGet(path) {
  const res = await apiFetch(path)
  if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.detail || '请求失败') }
  return res.json()
}

export async function apiPost(path, body) {
  const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || '请求失败')
  return data
}
