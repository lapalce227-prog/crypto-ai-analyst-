import base64
import httpx
from app.core.config import settings

VISION_PROMPT = """你是一个专业的加密货币交易图表分析助手。请分析这张截图中的内容：

如果是K线图/走势图：
1. 当前趋势判断（上涨/下跌/盘整）
2. 关键支撑和阻力位
3. 技术指标信号（如果有可见的指标）
4. 成交量分析

如果是交易记录/持仓：
1. 总结盈亏情况
2. 指出最赚钱/最亏损的币种
3. 杠杆使用情况

如果是其他内容，请简要描述并给出交易相关的建议。

请简洁回答，不超过200字。"""


async def analyze_image(image_base64: str, prompt: str = "") -> str:
    """使用 OpenAI-compatible vision API 分析图片"""
    if not settings.vision_api_key:
        raise RuntimeError("未配置 Vision API Key，请在 .env 中设置 VISION_API_KEY")

    user_prompt = prompt or VISION_PROMPT
    messages = [
        {"role": "user", "content": [
            {"type": "text", "text": user_prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
        ]},
    ]

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.vision_base_url}/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.vision_api_key}"},
            json={"model": settings.vision_model, "messages": messages, "max_tokens": 500},
        )
        data = resp.json()
        if resp.status_code != 200:
            raise RuntimeError(f"Vision API 错误: {data.get('error', {}).get('message', str(data))}")
        return data["choices"][0]["message"]["content"]
