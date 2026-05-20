import { useState, useContext } from 'react'
import { TradeContext } from '../context/TradeContext'
import { AuthContext } from '../context/AuthContext'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import AIChat from './AIChat'
import ReviewReport from './ReviewReport'
import { MessageSquare, BarChart3 } from 'lucide-react'

export default function AiPage() {
  return (
    <Tabs defaultValue="chat" className="space-y-4">
      <TabsList className="w-fit">
        <TabsTrigger value="chat" className="text-xs gap-1.5">
          <MessageSquare size={13} />AI 对话
        </TabsTrigger>
        <TabsTrigger value="review" className="text-xs gap-1.5">
          <BarChart3 size={13} />复盘报告
        </TabsTrigger>
      </TabsList>
      <TabsContent value="chat">
        <AIChat />
      </TabsContent>
      <TabsContent value="review">
        <ReviewReport />
      </TabsContent>
    </Tabs>
  )
}
