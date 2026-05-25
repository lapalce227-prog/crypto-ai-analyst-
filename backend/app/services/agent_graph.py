"""LangGraph agent — two-node chat↔tool_call loop with Qwen via DashScope."""

import asyncio
from typing import Annotated, AsyncGenerator, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage, AIMessageChunk
from langgraph.graph import StateGraph, END
from langgraph.graph.state import Command, CompiledStateGraph
from langgraph.graph.message import add_messages
from langgraph.types import RetryPolicy
from typing_extensions import TypedDict

from app.core.config import settings
from app.services.agent_tools import AGENT_TOOLS


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]


SYSTEM_PROMPT = """你是 Laplace Agent，一个冷静、专业的加密货币交易分析助手。

## 你的能力
你可以调用工具获取实时数据：
- **get_kline** — K线/行情数据
- **get_funding_rate** — 资金费率
- **get_user_trades** — 用户交易记录与统计
- **get_coin_info** — 币种背景信息（市值、流通量等）

## 行为准则
1. 不喊单、不给买卖建议，只提供客观数据和分析
2. 当用户问"分析一下XX币"时，主动调用get_kline、get_funding_rate、get_coin_info获取全景数据
3. 当用户问"我的交易怎么样"时，调用get_user_trades获取交易记录
4. 用数字说话，引用工具返回的具体数据
5. 当用户情绪化时（比如连续亏损），温和提醒风险
6. 回答简洁有条理，重点数据用中文呈现
7. 如果数据不足或接口出错，如实说明，不要编造"""


class AgentGraph:
    def __init__(self):
        self._graph: Optional[CompiledStateGraph] = None
        self._tools_by_name = {t.name: t for t in AGENT_TOOLS}
        self._llm: Optional[tuple] = None

    def _get_llm(self):
        if self._llm is None:
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(
                model="qwen-plus",
                api_key=settings.dash_api_key or "none",
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                temperature=0.3,
                max_tokens=2000,
                timeout=30,
            )
            bound = llm.bind_tools(AGENT_TOOLS)
            self._llm = (llm, bound)
        return self._llm[0], self._llm[1]

    async def create_graph(self) -> CompiledStateGraph:
        if self._graph is None:
            builder = StateGraph(AgentState)

            async def chat_node(state: AgentState) -> Command:
                _, llm_with_tools = self._get_llm()
                current = list(state["messages"])
                if not any(isinstance(m, SystemMessage) for m in current):
                    current = [SystemMessage(content=SYSTEM_PROMPT)] + current

                response = await llm_with_tools.ainvoke(current)

                has_tools = isinstance(response, AIMessage) and bool(response.tool_calls)
                return Command(
                    update={"messages": [response]},
                    goto="tools" if has_tools else END,
                )

            async def tools_node(state: AgentState) -> Command:
                last_msg = state["messages"][-1]
                tool_calls = last_msg.tool_calls

                async def run_one(tc):
                    tool = self._tools_by_name.get(tc["name"])
                    if not tool:
                        return ToolMessage(content="未知工具", tool_call_id=tc["id"], name=tc["name"])
                    try:
                        result = await tool.ainvoke(tc["args"])
                        return ToolMessage(content=str(result), tool_call_id=tc["id"], name=tc["name"])
                    except Exception as e:
                        return ToolMessage(content=f"工具错误: {e}", tool_call_id=tc["id"], name=tc["name"])

                if len(tool_calls) == 1:
                    outputs = [await run_one(tool_calls[0])]
                else:
                    outputs = await asyncio.gather(*[run_one(tc) for tc in tool_calls])

                return Command(update={"messages": outputs}, goto="chat")

            builder.add_node("chat", chat_node)
            builder.add_node("tools", tools_node, retry_policy=RetryPolicy(max_attempts=2))
            builder.set_entry_point("chat")
            builder.set_finish_point("chat")

            self._graph = builder.compile()
        return self._graph

    async def _get_graph(self) -> CompiledStateGraph:
        if self._graph is None:
            await self.create_graph()
        return self._graph

    async def chat(self, messages: list[dict], session_id: str = "default") -> list[dict]:
        """Non-streaming agent chat."""
        graph = await self._get_graph()
        config = {"configurable": {"thread_id": session_id}}
        input_payload = {"messages": [HumanMessage(content=messages[-1]["content"])]}
        result = await graph.ainvoke(input_payload, config)
        return _extract_messages(result.get("messages", []))

    async def stream_chat(self, messages: list[dict], session_id: str = "default") -> AsyncGenerator[str, None]:
        """Streaming agent chat — yields content fragments as they arrive."""
        graph = await self._get_graph()
        config = {"configurable": {"thread_id": session_id}}
        input_content = messages[-1]["content"] if messages else ""
        input_payload = {"messages": [HumanMessage(content=input_content)]}

        async for token, _ in graph.astream(input_payload, config, stream_mode="messages"):
            if isinstance(token, AIMessageChunk):
                content = token.content
                if isinstance(content, str) and content:
                    yield content
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and "text" in block:
                            yield block["text"]

    async def add_alert(self, symbol: str, condition: str, target_price: float, user_id: int = 0) -> dict:
        from app.services.alert_service import alert_service
        return await alert_service.add(symbol, condition, target_price, user_id)


def _extract_messages(messages: list) -> list[dict]:
    result = []
    for m in messages:
        if isinstance(m, SystemMessage):
            continue
        if isinstance(m, AIMessage):
            content = m.content
            if isinstance(content, list):
                text_parts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("text")]
                content = "".join(text_parts)
            result.append({"role": "assistant", "content": str(content or "")})
        elif isinstance(m, HumanMessage):
            result.append({"role": "user", "content": str(m.content or "")})
    return result


agent_graph = AgentGraph()
