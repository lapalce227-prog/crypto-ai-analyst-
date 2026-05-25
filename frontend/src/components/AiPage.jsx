import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import AIChat from './AIChat'
import AgentChat from './AgentChat'
import AlertPanel from './AlertPanel'
import ReviewReport from './ReviewReport'
import { MessageSquare, BarChart3, Brain, Bell } from 'lucide-react'
import { useAgent } from '../context/AgentContext'

export default function AiPage() {
  const [tab, setTab] = useState('agent')
  const { messages, setMessages } = useAgent()

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-fit">
          <TabsTrigger value="agent" className="text-xs gap-1.5">
            <Brain size={13} />Agent
          </TabsTrigger>
          <TabsTrigger value="chat" className="text-xs gap-1.5">
            <MessageSquare size={13} />AI 对话
          </TabsTrigger>
          <TabsTrigger value="review" className="text-xs gap-1.5">
            <BarChart3 size={13} />复盘报告
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs gap-1.5">
            <Bell size={13} />预警
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Agent — always mounted, never unmounts */}
      <div style={{ display: tab === 'agent' ? 'block' : 'none' }}>
        <AgentChat messages={messages} setMessages={setMessages} />
      </div>

      {/* Other tabs — mount on demand */}
      {tab === 'chat' && <AIChat />}
      {tab === 'review' && <ReviewReport />}
      {tab === 'alerts' && <AlertPanel />}
    </div>
  )
}
