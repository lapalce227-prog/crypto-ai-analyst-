import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import AgentChat from '../AgentChat'
import { useAgent } from '../../context/AgentContext'

export default function AppLayout() {
  const location = useLocation()
  const [agentOpen, setAgentOpen] = useState(false)
  const { messages, setMessages } = useAgent()

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={`ml-[240px] transition-[margin] duration-200 ${agentOpen ? 'mr-[380px]' : 'mr-0'}`}>
        <TopBar agentOpen={agentOpen} onToggleAgent={() => setAgentOpen(o => !o)} />
        <main className="pt-14 p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Agent Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[380px] bg-card border-l z-30 flex flex-col transition-transform duration-200 ${
          agentOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <AgentChat
          messages={messages}
          setMessages={setMessages}
          compact
          onClose={() => setAgentOpen(false)}
        />
      </div>
    </div>
  )
}
