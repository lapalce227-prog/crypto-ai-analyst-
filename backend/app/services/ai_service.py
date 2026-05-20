import httpx
from app.core.config import settings

SYSTEM_PROMPT = """你是 Laplace Agent，一个冷静、专业的加密货币交易分析助手。你的定位：
1. 不喊单、不给买卖建议，只提供客观分析
2. 帮用户看清事实——盈亏规律、风险指标、行为模式
3. 当用户情绪化时，温和提醒风险数据
4. 回答简洁，不超过200字，必要时用数字说话

你的核心功能：
- 分析交易记录，找出盈亏规律
- 回答行情相关问题
- 做复盘总结
- 展示风险概率数据"""


class AIService:
    async def _call(self, messages: list[dict], temperature: float = 0.3) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.deepseek_base_url}/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.deepseek_api_key}"},
                json={"model": "deepseek-chat", "messages": messages, "temperature": temperature},
            )
            data = resp.json()
            if "choices" not in data:
                raise RuntimeError(data.get("error", {}).get("message", "AI API 错误"))
            return data["choices"][0]["message"]["content"]

    async def chat(self, question: str, context: str = "") -> str:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if context:
            messages.append({"role": "system", "content": f"当前用户交易数据：\n{context}"})
        messages.append({"role": "user", "content": question})
        return await self._call(messages)

    async def analyze_trade(self, trade: dict, recent_trades: list[dict] = None) -> str:
        context = ""
        if recent_trades and len(recent_trades) > 1:
            wins = [t for t in recent_trades if (t.get("pnl") or 0) > 0]
            total_pnl = sum(t.get("pnl", 0) for t in recent_trades)
            avg_lev = sum(t.get("leverage", 0) for t in recent_trades) / len(recent_trades)
            context = (
                f"该用户最近{len(recent_trades)}笔："
                f"胜率{round(len(wins) / len(recent_trades) * 100)}%，"
                f"累计盈亏{round(total_pnl, 1)}U，"
                f"平均杠杆{round(avg_lev, 1)}x。"
            )

        prompt = f"""分析这笔刚录入的交易：
- 币种：{trade.get('symbol')}
- 方向：{trade.get('direction')}
- 杠杆：{trade.get('leverage')}x
- 入场价：{trade.get('entry_price')}
- 出场价：{trade.get('exit_price', '未平仓')}
- 金额：{trade.get('amount')} USDT
- 开仓情绪(1-10)：{trade.get('emotion_level', '未知')}
- 备注：{trade.get('notes', '无')}
{context}

请用1-2句话点评这笔交易（不超过80字）。指出最明显的一个风险点或行为模式。语气冷静客观，用数字说话。"""
        return await self.chat(prompt)

    async def diagnose(self, trades: list[dict], stats: dict) -> dict:
        trade_summary = []
        for t in trades[:20]:
            trade_summary.append(
                f"{t.get('symbol')} {t.get('direction')} {t.get('leverage')}x "
                f"情绪{t.get('emotion_level', '?')}/10 "
                f"盈亏{t.get('pnl', '?')}"
            )
        recent = "\n".join(trade_summary) if trade_summary else "无交易"

        prompt = f"""你是交易行为诊断专家。根据以下用户数据，诊断其交易行为问题。

统计：共{stats['total']}笔，胜率{stats['win_rate']}%，总盈亏{stats['total_pnl']}U，平均杠杆{stats['avg_leverage']}x
情绪：低情绪(≤4)胜率{stats['emotion_low_win_rate']}%，高情绪(≥7)胜率{stats['emotion_high_win_rate']}%
最差时段：{stats.get('worst_hour', '未知')}时（累计亏{stats.get('worst_pnl', 0)}U）

最近交易：
{recent}

请按以下格式输出（严格遵守，每段用 --- 分隔）：

[PATTERNS]
用2-3句话描述用户最突出的交易行为缺陷。结合具体数字。

[BRIEFING]
用1句话概括用户当前最需要关注的风险指标。不超过50字。

[QUESTIONS]
提出2个引导用户反思的问题，每行一个。问题要有数据支撑，能促使用户自己发现问题。"""

        text = await self._call(
            [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
            temperature=0.5,
        )

        patterns = ""
        briefing = ""
        questions = []

        section = None
        for line in text.split("\n"):
            line = line.strip()
            if "[PATTERNS]" in line:
                section = "patterns"
            elif "[BRIEFING]" in line:
                section = "briefing"
            elif "[QUESTIONS]" in line:
                section = "questions"
            elif line and section == "patterns":
                patterns += line
            elif line and section == "briefing":
                briefing += line
            elif line and section == "questions":
                q = line.lstrip("0123456789.、- ").strip()
                if q and len(q) > 5:
                    questions.append(q)

        return {"patterns": patterns.strip(), "briefing": briefing.strip(), "questions": questions[:2]}

    async def review_report(self, trades: list[dict], period: str) -> str:
        summary = str(trades)
        prompt = f"""用户最近{period}的交易记录：
{summary[:3000]}

请输出一份复盘报告（不超过300字），包括：
1. 胜率统计
2. 亏损的共同特征（时间段、杠杆、情绪状态等）
3. 一条最关键的改进建议"""
        return await self.chat(prompt)


ai_service = AIService()
