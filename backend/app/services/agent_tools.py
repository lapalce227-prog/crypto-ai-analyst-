"""Agent tools — pure functions the LLM can invoke to retrieve data."""

import json
import httpx
from langchain_core.tools import tool

OKX_API = "https://www.okx.com"
GATE_API = "https://api.gateio.ws/api/v4"
SYMBOLS = [
    "BTC-USDT", "ETH-USDT", "SOL-USDT", "BNB-USDT", "XRP-USDT",
    "DOGE-USDT", "SUI-USDT", "APT-USDT", "AVAX-USDT", "PEPE-USDT",
    "LINK-USDT", "NEAR-USDT", "OP-USDT", "ARB-USDT", "DOT-USDT",
    "LTC-USDT", "BCH-USDT", "FIL-USDT", "ATOM-USDT", "ADA-USDT",
]

KF_REVERSE = {"1m": "1m", "5m": "5m", "15m": "15m", "1H": "1h", "4H": "4h", "1D": "1d"}


@tool
async def get_kline(symbol: str, timeframe: str = "1H", limit: int = 100) -> str:
    """获取指定币种的K线（OHLCV）数据。symbol格式如BTC-USDT，timeframe可选1m/5m/15m/1H/4H/1D。

    Returns JSON: {symbol, timeframe, last_price, change_24h_pct, high_24h, low_24h, volume_24h, recent_candles: [...最近的{limit}根]}
    """
    pair = symbol.replace("-", "_")
    gate_tf = KF_REVERSE.get(timeframe, "1h")

    async with httpx.AsyncClient(timeout=10) as client:
        # Gate.io first (accessible from China)
        try:
            resp = await client.get(
                f"{GATE_API}/spot/candlesticks",
                params={"currency_pair": pair, "interval": gate_tf, "limit": limit},
            )
            if resp.status_code == 200:
                raw = resp.json()
                if isinstance(raw, list) and raw:
                    candles = []
                    for d in raw:
                        candles.append({
                            "time": int(float(d[0])),
                            "open": float(d[5]), "high": float(d[3]),
                            "low": float(d[4]), "close": float(d[2]),
                            "volume": float(d[1]),
                        })
                    last = candles[-1]["close"]
                    first = candles[0]["close"]
                    chg = (last - first) / first * 100 if first else 0
                    high_24h = max(c["high"] for c in candles[-min(limit, 96):])
                    low_24h = min(c["low"] for c in candles[-min(limit, 96):])
                    vol_24h = sum(c["volume"] for c in candles[-min(limit, 96):])
                    return json.dumps({
                        "symbol": symbol, "timeframe": timeframe,
                        "last_price": last, "change_24h_pct": round(chg, 2),
                        "high_24h": high_24h, "low_24h": low_24h,
                        "volume_24h": round(vol_24h, 2),
                        "recent_candles": candles,
                    }, ensure_ascii=False)
        except Exception:
            pass

        # Fallback to OKX
        try:
            resp = await client.get(
                f"{OKX_API}/api/v5/market/candles",
                params={"instId": symbol, "bar": timeframe, "limit": limit},
            )
            data = resp.json()
            if data.get("code") == "0":
                candles = []
                for d in reversed(data["data"]):
                    candles.append({
                        "time": int(d[0]),
                        "open": float(d[1]), "high": float(d[2]),
                        "low": float(d[3]), "close": float(d[4]),
                        "volume": float(d[5]),
                    })
                last = candles[-1]["close"]
                first = candles[0]["close"]
                chg = (last - first) / first * 100 if first else 0
                return json.dumps({
                    "symbol": symbol, "timeframe": timeframe,
                    "last_price": last, "change_24h_pct": round(chg, 2),
                    "high_24h": max(c["high"] for c in candles[-min(limit, 96):]),
                    "low_24h": min(c["low"] for c in candles[-min(limit, 96):]),
                    "volume_24h": sum(c["volume"] for c in candles[-min(limit, 96):]),
                    "recent_candles": candles,
                }, ensure_ascii=False)
        except Exception:
            pass

    return json.dumps({"error": "无法获取K线数据，数据源不可用"})


@tool
async def get_funding_rate(symbol: str) -> str:
    """获取永续合约当前资金费率及历史费率走势。symbol格式如BTC-USDT-SWAP。

    Returns JSON: {symbol, current_rate, predicted_rate, rate_history: [{time, rate}...5条], sentiment: 偏多/偏空/中性}
    """
    async with httpx.AsyncClient(timeout=8) as client:
        try:
            resp = await client.get(
                f"{OKX_API}/api/v5/public/funding-rate",
                params={"instId": symbol},
            )
            data = resp.json()
            if data.get("code") == "0" and data["data"]:
                rates = data["data"][:5]
                cur = float(rates[0]["fundingRate"])
                hist = [{"time": r["fundingTime"], "rate": f"{float(r['fundingRate']) * 100:.4f}%"} for r in rates]
                avg = sum(float(r["fundingRate"]) for r in rates) / len(rates)
                sentiment = "偏多" if avg < -0.001 else ("偏空" if avg > 0.001 else "中性")
                return json.dumps({
                    "symbol": symbol,
                    "current_rate": f"{cur * 100:.4f}%",
                    "predicted_rate": f"{float(rates[0].get('nextFundingRate', cur)) * 100:.4f}%",
                    "rate_history": hist,
                    "sentiment": sentiment,
                }, ensure_ascii=False)
        except Exception:
            pass
    return json.dumps({"error": "无法获取资金费率数据"})


@tool
async def get_user_trades(user_id: int = 0) -> str:
    """查询用户的交易记录和盈亏统计。user_id为0时使用默认导入。

    Returns JSON: {total_trades, win_rate, total_pnl, avg_leverage, recent_trades: [...最近10笔], emotion_analysis: {...}}
    """
    from app.services.trade_service import trade_service
    try:
        trades = trade_service.get_all(user_id) if user_id else _load_all_trades()
        stats = trade_service.get_stats(user_id) if user_id else _calc_stats(trades)
        recent = trades[:10]
        return json.dumps({
            "total_trades": stats.get("total", len(trades)),
            "win_rate": f"{stats.get('win_rate', 0)}%",
            "total_pnl": stats.get("total_pnl", 0),
            "avg_leverage": f"{stats.get('avg_leverage', 0)}x",
            "profit_factor": stats.get("profit_factor", 0),
            "risk_reward_ratio": stats.get("risk_reward_ratio", 0),
            "avg_hold_hours": stats.get("avg_hold_hours", 0),
            "emotion_low_win_rate": stats.get("emotion_low_win_rate", 0),
            "emotion_high_win_rate": stats.get("emotion_high_win_rate", 0),
            "recent_trades": [
                {"symbol": t.get("symbol"), "direction": t.get("direction"),
                 "leverage": t.get("leverage"), "pnl": t.get("pnl"),
                 "emotion_level": t.get("emotion_level"),
                 "opened_at": str(t.get("opened_at", ""))[:10]}
                for t in recent
            ],
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": f"无法获取交易数据: {e}"})


@tool
async def get_coin_info(symbol: str) -> str:
    """获取币种背景信息，包括市值排名、流通量、历史高点等。symbol格式如BTC。

    Returns JSON: {symbol, name, market_cap_rank, current_price, market_cap, volume_24h, high_24h, low_24h, circulating_supply, ath, atl, description}
    """
    base = symbol.split("-")[0].lower()
    async with httpx.AsyncClient(timeout=8) as client:
        try:
            resp = await client.get(
                f"https://api.coingecko.com/api/v3/coins/{base}",
                params={"localization": "false", "tickers": "false", "community_data": "false", "developer_data": "false"},
            )
            if resp.status_code == 200:
                d = resp.json()
                market = d.get("market_data", {})
                return json.dumps({
                    "symbol": d.get("symbol", base).upper(),
                    "name": d.get("name", base),
                    "market_cap_rank": d.get("market_cap_rank"),
                    "current_price": market.get("current_price", {}).get("usd"),
                    "market_cap": market.get("market_cap", {}).get("usd"),
                    "volume_24h": market.get("total_volume", {}).get("usd"),
                    "high_24h": market.get("high_24h", {}).get("usd"),
                    "low_24h": market.get("low_24h", {}).get("usd"),
                    "circulating_supply": market.get("circulating_supply"),
                    "ath": market.get("ath", {}).get("usd"),
                    "atl": market.get("atl", {}).get("usd"),
                    "description": (d.get("description", {}).get("en") or "")[:500],
                }, ensure_ascii=False)
        except Exception:
            pass

    # Fallback: basic info from OKX ticker
    async with httpx.AsyncClient(timeout=5) as client:
        try:
            resp = await client.get(f"{OKX_API}/api/v5/market/ticker?instId={symbol}-USDT")
            data = resp.json()
            if data.get("code") == "0" and data["data"]:
                t = data["data"][0]
                return json.dumps({
                    "symbol": symbol,
                    "name": symbol,
                    "last_price": t.get("last"),
                    "high_24h": t.get("high24h"),
                    "low_24h": t.get("low24h"),
                    "volume_24h": t.get("vol24h"),
                    "change_24h_pct": f"{float(t.get('sodUtc8', 0)) * 100:.2f}%",
                    "note": "OKX ticker数据，无市值/排名信息",
                }, ensure_ascii=False)
        except Exception:
            pass

    return json.dumps({"error": f"无法获取 {symbol} 的背景信息"})


def _load_all_trades() -> list:
    import sqlite3, os
    db = os.path.join(os.path.dirname(__file__), "..", "..", "trades.db")
    if not os.path.exists(db):
        return []
    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM trades ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _calc_stats(trades: list) -> dict:
    if not trades:
        return {}
    wins = [t for t in trades if (t.get("pnl") or 0) > 0]
    losses = [t for t in trades if (t.get("pnl") or 0) < 0]
    return {
        "total": len(trades),
        "wins": len(wins), "losses": len(losses),
        "win_rate": round(len(wins) / len(trades) * 100, 1) if trades else 0,
        "total_pnl": round(sum(t.get("pnl", 0) for t in trades), 2),
        "avg_leverage": round(sum(t.get("leverage", 0) for t in trades) / len(trades), 1),
        "profit_factor": round(sum(t.get("pnl", 0) for t in wins) / abs(sum(t.get("pnl", 0) for t in losses)), 2) if losses else 999,
        "risk_reward_ratio": 0,
        "avg_hold_hours": 0,
        "emotion_low_win_rate": 0,
        "emotion_high_win_rate": 0,
        "total_profit": round(sum(t.get("pnl", 0) for t in wins), 2),
        "total_loss": round(abs(sum(t.get("pnl", 0) for t in losses)), 2),
    }


AGENT_TOOLS = [get_kline, get_funding_rate, get_user_trades, get_coin_info]
