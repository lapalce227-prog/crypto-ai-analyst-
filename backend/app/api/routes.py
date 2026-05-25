from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from app.models.trade import TradeCreate, AIQuestion, AIResponse, ReviewRequest, DiagnoseResponse, OkxImportRequest, OkxConfigRequest, OkxHistoryRequest
import json
from app.services.trade_service import trade_service
from app.services.agent_tools import AGENT_TOOLS
from app.services.ai_service import ai_service
from app.services.agent_graph import agent_graph
from app.services.alert_service import alert_service
from app.services.agent_history_service import agent_history_service
from app.services.okx_service import okx_service
from app.services.pnl_calculator import pnl_calculator, PnLCalculator
from app.services.auth_service import get_current_user
from app.services.community_service import community_service
from app.services.blog_service import blog_service
from app.services.strategy_service import STRATEGIES
from app.core.config import settings

router = APIRouter()

# ===== 交易记录 =====

@router.post("/trades")
async def create_trade(trade: TradeCreate, user: dict = Depends(get_current_user)):
    saved = trade_service.add(user["id"], trade.model_dump())
    try:
        recent = trade_service.get_all(user["id"])[:11]  # include the one just saved
        insight = await ai_service.analyze_trade(saved, recent[1:])  # exclude current from context
        saved["ai_insight"] = insight
    except Exception:
        saved["ai_insight"] = None
    return saved

@router.get("/trades")
async def list_trades(user: dict = Depends(get_current_user)):
    return trade_service.get_all(user["id"])

@router.get("/trades/{trade_id}")
async def get_trade(trade_id: int, user: dict = Depends(get_current_user)):
    t = trade_service.get_by_id(user["id"], trade_id)
    if not t:
        raise HTTPException(404, "交易记录不存在")
    return t

# ===== AI 对话 =====

@router.post("/ai/chat", response_model=AIResponse)
async def ai_chat(req: AIQuestion, user: dict = Depends(get_current_user)):
    context = ""
    if req.context_trade_id:
        trade = trade_service.get_by_id(user["id"], req.context_trade_id)
        if trade:
            context = str(trade)
    try:
        answer = await ai_service.chat(req.question, context)
    except Exception:
        answer = "AI 服务暂时不可用，请稍后重试。"
    return AIResponse(answer=answer)

# ===== AI 复盘 =====

@router.post("/ai/review", response_model=AIResponse)
async def ai_review(req: ReviewRequest, user: dict = Depends(get_current_user)):
    trades = trade_service.get_all(user["id"])
    stats = trade_service.get_stats(user["id"])
    try:
        context = f"交易统计：{stats}\n详细记录：{trades}"
        prompt = f"""根据以下交易数据，生成一份{req.period}复盘报告。

{context}

请输出（不超过300字）：
1. 胜率统计
2. 亏损的共同特征（时间段、杠杆、情绪等）
3. 一条最关键的改进建议"""
        answer = await ai_service.chat(prompt)
    except Exception:
        answer = "AI 服务暂时不可用，请稍后重试。"
    return AIResponse(answer=answer)

# ===== AI 诊断 =====

@router.post("/ai/diagnose", response_model=DiagnoseResponse)
async def ai_diagnose(user: dict = Depends(get_current_user)):
    trades = trade_service.get_all(user["id"])
    if len(trades) < 3:
        return DiagnoseResponse(message="至少需要3笔交易才能进行行为诊断")
    stats = trade_service.get_stats(user["id"])
    try:
        result = await ai_service.diagnose(trades, stats)
        return DiagnoseResponse(**result)
    except Exception:
        return DiagnoseResponse(message="AI 服务暂时不可用")

# ===== Agent 对话（LangGraph + OpenAI tool calling）=====

@router.post("/ai/agent/chat")
async def agent_chat(data: dict, user: dict = Depends(get_current_user)):
    """Agent 对话（非流式）。消息格式: {messages: [{role, content}]}"""
    messages = data.get("messages", [])
    if not messages:
        raise HTTPException(400, "messages 为空")
    try:
        result = await agent_graph.chat(messages, session_id=str(user.get("id", "default")))
        return {"messages": result}
    except Exception as e:
        raise HTTPException(500, f"Agent 错误: {e}")


@router.post("/ai/agent/chat/stream")
async def agent_chat_stream(data: dict, user: dict = Depends(get_current_user)):
    """Agent 对话（SSE 流式）。消息格式同上。"""
    messages = data.get("messages", [])
    if not messages:
        raise HTTPException(400, "messages 为空")

    async def event_gen():
        try:
            async for chunk in agent_graph.stream_chat(messages, session_id=str(user.get("id", "default"))):
                yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"
            yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'content': str(e), 'done': True, 'error': True})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")


# ===== 告警中心 =====

@router.get("/ai/alerts")
async def list_alerts(user: dict = Depends(get_current_user)):
    return alert_service.get_all(user.get("id", 0))


@router.post("/ai/alerts")
async def add_alert_endpoint(data: dict, user: dict = Depends(get_current_user)):
    """添加价格提醒。{symbol, condition: above/below, target_price}"""
    symbol = data.get("symbol", "").upper()
    condition = data.get("condition", "below")
    target_price = float(data.get("target_price", 0))
    if not symbol or target_price <= 0:
        raise HTTPException(400, "symbol 或 target_price 无效")
    return await alert_service.add(symbol, condition, target_price, user.get("id", 0))


@router.delete("/ai/alerts/{alert_id}")
async def dismiss_alert(alert_id: int, user: dict = Depends(get_current_user)):
    ok = alert_service.dismiss(alert_id)
    if not ok:
        raise HTTPException(404, "提醒不存在")
    return {"status": "dismissed"}


# ===== Agent 对话历史 =====

@router.get("/ai/agent/history")
async def list_agent_history(user: dict = Depends(get_current_user)):
    return agent_history_service.list(user.get("id", 0))


@router.get("/ai/agent/history/{history_id}")
async def load_agent_history(history_id: int, user: dict = Depends(get_current_user)):
    entry = agent_history_service.load(history_id)
    if not entry:
        raise HTTPException(404, "历史记录不存在")
    return entry


@router.post("/ai/agent/history")
async def save_agent_history(data: dict, user: dict = Depends(get_current_user)):
    """保存当前对话。{messages: [...], title?: string}"""
    messages = data.get("messages", [])
    title = data.get("title", "")
    if not messages:
        raise HTTPException(400, "messages 为空")
    return agent_history_service.save(messages, user.get("id", 0), title)


@router.delete("/ai/agent/history/{history_id}")
async def delete_agent_history(history_id: int, user: dict = Depends(get_current_user)):
    agent_history_service.delete(history_id)
    return {"status": "deleted"}


# ===== 统计概览 =====

@router.get("/stats")
async def get_stats(user: dict = Depends(get_current_user)):
    return trade_service.get_stats(user["id"])

# ===== P&L 计算 =====

@router.post("/pnl/batch")
async def batch_pnl(data: dict, user: dict = Depends(get_current_user)):
    """批量计算交易盈亏（含手续费）"""
    trades = data.get("trades", [])
    if not trades:
        raise HTTPException(400, "trades 为空")
    fee_rate = data.get("fee_rate", 0.0005)
    calc = PnLCalculator(fee_rate=fee_rate)
    return calc.calc_batch(trades)


@router.get("/pnl/analyze")
async def analyze_pnl(user: dict = Depends(get_current_user)):
    """分析当前用户所有已平仓交易"""
    trades = trade_service.get_all(user["id"])
    settled = [t for t in trades if t.get("exit_price") and t.get("entry_price")]
    if not settled:
        return {"summary": {"total_trades": len(trades), "settled": 0}, "message": "没有已平仓交易"}
    return pnl_calculator.calc_batch(settled)


# ===== OKX 导入 =====

@router.post("/import/okx")
async def import_okx_positions(data: dict, user: dict = Depends(get_current_user)):
    """手动粘贴 OKX 持仓 JSON 导入"""
    positions = data.get("positions", [])
    if not positions:
        raise HTTPException(400, "positions 为空")
    imported = []
    for pos in positions:
        trade = trade_service.add(user["id"], _okx_position_to_trade(pos, "从 OKX 粘贴导入"))
        imported.append(trade)
    return {"imported": len(imported), "trades": imported}


@router.post("/import/okx/fetch")
async def fetch_from_okx(req: OkxConfigRequest, user: dict = Depends(get_current_user)):
    """使用 OKX API 自动拉取持仓"""
    settings.okx_api_key = req.api_key
    settings.okx_api_secret = req.api_secret
    settings.okx_api_passphrase = req.api_passphrase
    try:
        positions = await okx_service.fetch_positions()
        imported = []
        for pos in positions:
            trade = trade_service.add(user["id"], pos)
            imported.append(trade)
        return {"imported": len(imported), "trades": imported}
    except RuntimeError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"拉取失败：{e}")


@router.post("/import/okx/history")
async def fetch_okx_history(req: OkxHistoryRequest, user: dict = Depends(get_current_user)):
    """使用 OKX API 拉取历史已平仓仓位"""
    settings.okx_api_key = req.api_key
    settings.okx_api_secret = req.api_secret
    settings.okx_api_passphrase = req.api_passphrase
    try:
        orders = await okx_service.fetch_positions_history(
            limit=req.limit,
            begin=req.begin,
            end=req.end,
        )
        imported = []
        for order in orders:
            trade = trade_service.add(user["id"], order)
            imported.append(trade)
        return {"imported": len(imported), "trades": imported}
    except RuntimeError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"拉取历史失败：{e}")


@router.post("/import/okx/raw")
async def raw_okx_response(req: OkxHistoryRequest, user: dict = Depends(get_current_user)):
    """调试：返回 OKX API 原始数据"""
    import httpx
    from app.services.okx_service import _headers, _to_okx_ts
    settings.okx_api_key = req.api_key
    settings.okx_api_secret = req.api_secret
    settings.okx_api_passphrase = req.api_passphrase
    params = f"instType=SWAP&limit={req.limit}"
    if req.begin:
        params += f"&begin={_to_okx_ts(req.begin)}"
    if req.end:
        params += f"&end={_to_okx_ts(req.end)}"
    path = f"/api/v5/account/positions-history?{params}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://www.okx.com{path}",
                headers=_headers("GET", path, ""),
            )
        return resp.json()
    except Exception as e:
        raise HTTPException(502, f"无法连接 OKX：{e}")


@router.post("/import/okx/config")
async def save_okx_config(req: OkxConfigRequest, user: dict = Depends(get_current_user)):
    """保存 OKX API 配置到环境变量"""
    settings.okx_api_key = req.api_key
    settings.okx_api_secret = req.api_secret
    settings.okx_api_passphrase = req.api_passphrase
    return {"status": "ok", "message": "OKX 配置已保存（当前会话有效）"}


# ===== 图片识别 =====

@router.post("/vision/analyze")
async def analyze_chart_image(data: dict, user: dict = Depends(get_current_user)):
    from app.services.vision_service import analyze_image
    image = data.get("image", "")
    prompt = data.get("prompt", "")
    if not image:
        raise HTTPException(400, "缺少图片数据")
    try:
        result = await analyze_image(image, prompt)
        return {"answer": result}
    except RuntimeError as e:
        raise HTTPException(400, str(e))


@router.get("/okx/candles")
async def proxy_okx_candles(instId: str = "BTC-USDT", bar: str = "1H", limit: int = 300):
    """代理 K线数据 — Gate.io 优先（国内可达），OKX 兜底"""
    import httpx

    pair = instId.replace("-", "_")
    tf_map = {"1s": "1s", "15s": "15s", "1m": "1m", "5m": "5m", "15m": "15m", "1H": "1h", "4H": "4h", "1D": "1d"}
    gate_tf = tf_map.get(bar, "1h")

    # 先试 Gate.io（国内可用）
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"https://api.gateio.ws/api/v4/spot/candlesticks",
                params={"currency_pair": pair, "interval": gate_tf, "limit": limit},
            )
            if resp.status_code == 200:
                raw = resp.json()
                if isinstance(raw, list) and len(raw) > 0:
                    candles = []
                    for d in raw:
                        candles.append([
                            str(int(float(d[0])) * 1000),  # seconds -> ms
                            d[5], d[3], d[4], d[2], d[1],  # open, high, low, close, vol
                        ])
                    return {"code": "0", "data": candles}
        except Exception:
            pass

    # Gate.io 失败 → OKX
    async with httpx.AsyncClient(timeout=5) as client:
        try:
            resp = await client.get(
                f"https://www.okx.com/api/v5/market/candles",
                params={"instId": instId, "bar": bar, "limit": limit},
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "0":
                    return data
        except Exception:
            pass

    return {"code": "1", "msg": "数据源不可用", "data": []}


@router.get("/index/candles")
async def proxy_index_candles(symbol: str = "IXIC", interval: str = "1h", range: str = "7d"):
    """代理指数K线数据 — 美股用东方财富，A股用新浪"""
    import httpx
    import subprocess, json as _json, tempfile, os

    # A股 → 新浪
    if symbol.endswith(".SS") or symbol.endswith(".SZ"):
        code = symbol.replace(".SS", "").replace(".SZ", "")
        prefix = "sh" if ".SS" in symbol else "sz"
        scale_map = {"1m": "5", "5m": "15", "15m": "30", "1h": "60", "4h": "60", "1d": "240"}
        try:
            async with httpx.AsyncClient(timeout=10, http2=False) as client:
                resp = await client.get(
                    "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData",
                    params={"symbol": f"{prefix}{code}", "scale": scale_map.get(interval, "60"), "ma": "no", "datalen": 300},
                )
            raw = resp.json()
            candles = []
            for item in raw[-300:]:
                candles.append([
                    item.get("day", ""), item.get("open", "0"), item.get("high", "0"),
                    item.get("low", "0"), item.get("close", "0"), item.get("volume", "0"),
                ])
            return {"code": "0", "data": candles}
        except Exception:
            return {"code": "1", "msg": "A股数据获取失败", "data": []}

    # 美股 → 腾讯财经
    secid_map = {"IXIC": "usNDX", "NDX": "usNDX", "DJIA": "usDJI", "SPX": "usSPX", "GSPC": "usSPX"}
    qq_code = secid_map.get(symbol, f"us{symbol}")
    url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={qq_code},day,2024-01-01,,300,qfq"
    try:
        result = subprocess.run(
            ["curl", "-s", "--max-time", "8", "-L", "-H", "User-Agent: Mozilla/5.0", url],
            capture_output=True, text=True, timeout=10,
        )
        data = _json.loads(result.stdout)
        klines = data.get("data", {}).get(qq_code, {}).get("day") or []
        candles = []
        for k in klines:
            if len(k) < 6:
                continue
            dt = k[0]
            ts = str(int(__import__("datetime").datetime.strptime(dt, "%Y-%m-%d").timestamp())) + "000"
            # Tencent: [date, open, close, high, low, volume]
            candles.append([ts, k[1], k[3], k[4], k[2], k[5]])
        return {"code": "0", "data": candles}
    except Exception:
        return {"code": "1", "msg": "美股数据不可用", "data": []}


def _okx_position_to_trade(pos: dict, notes: str) -> dict:
    from datetime import datetime, timezone
    ctime = pos.get("cTime", "")
    try:
        opened_at = datetime.fromtimestamp(int(str(ctime)) / 1000, tz=timezone.utc).isoformat() if ctime else datetime.now(timezone.utc).isoformat()
    except (ValueError, TypeError):
        opened_at = datetime.now(timezone.utc).isoformat()
    return {
        "symbol": pos.get("instId", "UNKNOWN"),
        "direction": "long" if pos.get("posSide") == "long" else "short",
        "leverage": int(float(pos.get("lever", 10))),
        "entry_price": float(pos.get("avgPx", 0)),
        "exit_price": None,
        "amount": float(pos.get("margin", 0)),
        "opened_at": opened_at,
        "notes": notes,
    }


# ===== 社区聊天 =====

@router.get("/community/posts")
async def list_community_posts(limit: int = 50, user: dict = Depends(get_current_user)):
    return community_service.get_posts(limit)


@router.post("/community/posts")
async def create_community_post(data: dict, user: dict = Depends(get_current_user)):
    content = data.get("content", "").strip()
    if not content or len(content) > 500:
        raise HTTPException(400, "内容为空或超过500字")
    return community_service.add_post(user["id"], user["username"], content, data.get("parent_id"))


@router.post("/community/posts/{post_id}/like")
async def like_post(post_id: int, user: dict = Depends(get_current_user)):
    return community_service.toggle_like(post_id, user["id"])


@router.delete("/community/posts/{post_id}")
async def delete_post(post_id: int, user: dict = Depends(get_current_user)):
    ok = community_service.delete_post(post_id, user["id"])
    if not ok:
        raise HTTPException(404, "帖子不存在或无权删除")
    return {"status": "deleted"}


# ===== 博客 =====

@router.get("/blog")
async def list_blog_articles():
    return blog_service.get_all()


@router.get("/blog/{article_id}")
async def get_blog_article(article_id: int):
    a = blog_service.get_by_id(article_id)
    if not a:
        raise HTTPException(404, "文章不存在")
    return a


@router.post("/blog")
async def create_blog_article(data: dict, user: dict = Depends(get_current_user)):
    title = data.get("title", "").strip()
    content = data.get("content", "").strip()
    if not title or not content:
        raise HTTPException(400, "标题或内容为空")
    return blog_service.create(user["id"], user["username"], title, content)


# ===== 策略回测 =====

@router.post("/strategy/backtest")
async def strategy_backtest(data: dict, user: dict = Depends(get_current_user)):
    """
    策略回测
    请求体: { "strategy": "dca", "ohlcv": [...], "params": {...} }
    """
    strategy_name = data.get("strategy", "").lower()
    if strategy_name not in STRATEGIES:
        raise HTTPException(400, f"不支持的策略: {strategy_name}，可选: {', '.join(STRATEGIES.keys())}")

    ohlcv = data.get("ohlcv", [])
    if not ohlcv:
        raise HTTPException(400, "ohlcv 数据为空")

    params = data.get("params", {})
    try:
        result = STRATEGIES[strategy_name](ohlcv, params)
    except Exception as e:
        raise HTTPException(500, f"回测计算失败: {e}")

    return result


# ===== 加密新闻 =====

@router.get("/news")
async def crypto_news(limit: int = 30):
    """聚合 RSS 新闻源（免费，无需 API key）"""
    import httpx
    import xml.etree.ElementTree as ET
    from datetime import datetime, timezone

    FEEDS = [
        ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
        ("CoinTelegraph", "https://cointelegraph.com/rss"),
        ("Decrypt", "https://decrypt.co/feed"),
    ]

    TIER1_SOURCES = {"CoinDesk", "CoinTelegraph"}
    results = []

    async with httpx.AsyncClient(timeout=12) as client:
        for source_name, url in FEEDS:
            try:
                resp = await client.get(url, headers={"User-Agent": "Laplace/1.0"})
                if resp.status_code != 200:
                    continue
                root = ET.fromstring(resp.text)
                for item in root.iter("item"):
                    title = item.findtext("title", "").strip()
                    link = item.findtext("link", "").strip()
                    pub_date = item.findtext("pubDate", "") or item.findtext("dc:date", "") or item.findtext("published", "")
                    if not title or not link:
                        continue
                    # Parse pubDate
                    try:
                        from email.utils import parsedate_to_datetime
                        dt = parsedate_to_datetime(pub_date)
                    except Exception:
                        dt = datetime.now(timezone.utc)
                    results.append({
                        "id": link,
                        "title": title,
                        "url": link,
                        "published_at": dt.isoformat(),
                        "source": {"title": source_name},
                        "votes": {"positive": 1},
                        "important": source_name in TIER1_SOURCES,
                    })
            except Exception:
                continue

    # Sort by date desc
    results.sort(key=lambda r: r["published_at"], reverse=True)

    # Mark top 5 newest from tier-1 as "hot" (重磅)
    for r in results:
        if r["important"]:
            r["votes"]["positive"] = 30
    hot_count = 0
    for r in results:
        if r["important"] and hot_count < 5:
            r["votes"]["positive"] = 60
            hot_count += 1

    return {"results": results[:limit]}
