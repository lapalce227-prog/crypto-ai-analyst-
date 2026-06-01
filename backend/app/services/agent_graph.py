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
- **analyze_image** — 分析用户上传的图片（K线图、交易截图等），当用户发送图片时自动调用此工具
- **get_crypto_news** — 获取最新加密货币新闻快讯，当用户问"最近有什么新闻"、"市场热点"时调用

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

    async def _analyze_image_internal(self, image_base64: str, question: str) -> str:
        """Call Qwen VL model to analyze an image, return text description."""
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.dash_api_key}"},
                json={
                    "model": "qwen-vl-plus",
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
                            {"type": "text", "text": question or "请详细描述这张图片的内容，包括所有可见的数字、文字和趋势"},
                        ]
                    }],
                    "max_tokens": 800,
                    "temperature": 0.3,
                },
            )
            data = resp.json()
            if resp.status_code != 200:
                error_msg = data.get("error", {}).get("message", str(data))
                return f"[图像分析失败: {error_msg}]"
            return data["choices"][0]["message"]["content"]

    @staticmethod
    def _extract_image_from_content(content) -> tuple:
        """Extract base64 image and text question from multimodal content.
        Returns (image_base64, text_question) or (None, None) if no image found.
        """
        if not isinstance(content, list):
            return None, None
        image_base64 = None
        text_parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "image_url":
                    url = block.get("image_url", {}).get("url", "")
                    if url.startswith("data:image"):
                        image_base64 = url.split(",", 1)[1] if "," in url else url
                    else:
                        image_base64 = url
                elif block.get("type") == "text":
                    text_parts.append(block.get("text", ""))
        if image_base64 is None:
            return None, None
        return image_base64, " ".join(text_parts)

    async def create_graph(self) -> CompiledStateGraph:
        if self._graph is None:
            builder = StateGraph(AgentState)

            async def chat_node(state: AgentState) -> Command:
                _, llm_with_tools = self._get_llm()
                current = list(state["messages"])
                if not any(isinstance(m, SystemMessage) for m in current):
                    current = [SystemMessage(content=SYSTEM_PROMPT)] + current

                # Preprocess: convert image messages to text for the text-only LLM
                last_user_idx = None
                for i in range(len(current) - 1, -1, -1):
                    if isinstance(current[i], HumanMessage):
                        last_user_idx = i
                        break

                for i, m in enumerate(current):
                    if isinstance(m, HumanMessage):
                        img_b64, question = self._extract_image_from_content(m.content)
                        if img_b64:
                            if i == last_user_idx:
                                analysis = await self._analyze_image_internal(img_b64, question)
                                text_content = f"[用户发送了一张图片，以下是图片识别结果]\n\n{analysis}\n\n请根据以上信息回答用户的问题。用户原文：{question}"
                            else:
                                text_content = f"[用户之前发送了一张图片：{question}]"
                            current[i] = HumanMessage(content=text_content)

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

    async def stream_chat(self, messages: list[dict], session_id: str = "default") -> AsyncGenerator[dict, None]:
        """Streaming agent chat — yields structured events: {type: text|tool_start|tool_end, ...}"""
        graph = await self._get_graph()
        config = {"configurable": {"thread_id": session_id}}
        input_content = messages[-1]["content"] if messages else ""
        input_payload = {"messages": [HumanMessage(content=input_content)]}

        try:
            async for event in graph.astream_events(input_payload, config, version="v2"):
                kind = event["event"]
                if kind == "on_chat_model_stream":
                    chunk = event["data"].get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        content = chunk.content
                        if isinstance(content, str) and content.strip():
                            yield {"type": "text", "content": content}
                        elif isinstance(content, list):
                            for block in content:
                                if isinstance(block, dict) and block.get("text"):
                                    yield {"type": "text", "content": block["text"]}
                elif kind == "on_tool_start":
                    tool_name = event["name"]
                    tool_input = event["data"].get("input", {})
                    # Sanitize: remove large base64 from args display
                    safe_args = {k: (v[:50] + "..." if isinstance(v, str) and len(v) > 50 else v) for k, v in tool_input.items()}
                    yield {"type": "tool_start", "tool": tool_name, "args": safe_args}
                elif kind == "on_tool_end":
                    yield {"type": "tool_end", "tool": event["name"]}
        except Exception:
            # Fallback: if astream_events fails, use simple stream
            async for token, _ in graph.astream(input_payload, config, stream_mode="messages"):
                if isinstance(token, AIMessageChunk):
                    content = token.content
                    if isinstance(content, str) and content:
                        yield {"type": "text", "content": content}
                    elif isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict) and block.get("text"):
                                yield {"type": "text", "content": block["text"]}

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
