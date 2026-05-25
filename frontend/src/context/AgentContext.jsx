import { createContext, useState, useContext, useCallback } from 'react'

const AgentContext = createContext(null)

function ts() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const WELCOME = { role: 'assistant', content: '我是 Laplace Agent。我可以查看实时行情、资金费率、你的交易记录，帮你分析数据。试试问我："分析一下BTC" 或 "我的交易怎么样？"', time: ts() }

export function AgentProvider({ children }) {
  const [messages, setMessages] = useState([WELCOME])

  const addMessage = useCallback((msg) => {
    setMessages(m => [...m, { ...msg, time: msg.time || ts() }])
  }, [])

  const updateLastMessage = useCallback((content) => {
    setMessages(m => {
      const copy = [...m]
      if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
        copy[copy.length - 1] = { ...copy[copy.length - 1], content }
      } else {
        copy.push({ role: 'assistant', content, time: ts() })
      }
      return copy
    })
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([WELCOME])
  }, [])

  return (
    <AgentContext.Provider value={{ messages, setMessages, addMessage, updateLastMessage, clearMessages }}>
      {children}
    </AgentContext.Provider>
  )
}

export function useAgent() {
  return useContext(AgentContext)
}
