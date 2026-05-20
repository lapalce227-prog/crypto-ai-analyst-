import hmac
import base64
import json
from datetime import datetime, timezone
from typing import Optional
import httpx
from app.core.config import settings


def _sign(timestamp: str, method: str, path: str, body: str = "") -> str:
    message = timestamp + method + path + body
    mac = hmac.new(
        settings.okx_api_secret.encode(),
        message.encode(),
        digestmod="sha256",
    )
    return base64.b64encode(mac.digest()).decode()


def _okx_timestamp() -> str:
    """OKX 要求 ISO 8601 格式: 2025-05-19T12:34:56.789Z"""
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def _headers(method: str, path: str, body: str = "") -> dict:
    ts = _okx_timestamp()
    return {
        "OK-ACCESS-KEY": settings.okx_api_key,
        "OK-ACCESS-SIGN": _sign(ts, method, path, body),
        "OK-ACCESS-TIMESTAMP": ts,
        "OK-ACCESS-PASSPHRASE": settings.okx_api_passphrase,
        "Content-Type": "application/json",
    }


def _api_error(data: dict, status_code: int) -> str:
    return f"OKX API [{status_code}] code={data.get('code')}: {data.get('msg', 'unknown')}"


class OkxService:
    BASE = "https://www.okx.com"

    async def fetch_positions(self, inst_type: str = "SWAP") -> list[dict]:
        """拉取当前持仓"""
        path = f"/api/v5/account/positions?instType={inst_type}"
        body = ""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE}{path}",
                    headers=_headers("GET", path, body),
                )
            data = resp.json()
        except httpx.TimeoutException:
            raise RuntimeError("连接 OKX 超时，请检查网络或使用 VPN")
        except Exception as e:
            raise RuntimeError(f"无法连接 OKX 服务器：{e}")
        if data.get("code") != "0":
            raise RuntimeError(_api_error(data, resp.status_code))
        trades = []
        for pos in data.get("data", []):
            avg_px = float(pos.get("avgPx", 0))
            margin = float(pos.get("margin", 0))
            if avg_px == 0 or margin == 0:
                continue
            trades.append({
                "symbol": pos.get("instId", "UNKNOWN"),
                "direction": "long" if pos.get("posSide") == "long" else "short",
                "leverage": int(float(pos.get("lever", 10))),
                "entry_price": avg_px,
                "exit_price": None,
                "amount": margin,
                "opened_at": _parse_okx_time(pos.get("cTime")),
                "notes": "从 OKX 自动导入",
            })
        return trades

    async def fetch_positions_history(self, limit: int = 100, begin: str = "", end: str = "", inst_type: str = "SWAP") -> list[dict]:
        """拉取历史已平仓仓位"""
        params = f"instType={inst_type}&limit={limit}"
        if begin:
            params += f"&begin={_to_okx_ts(begin)}"
        if end:
            params += f"&end={_to_okx_ts(end)}"
        path = f"/api/v5/account/positions-history?{params}"
        body = ""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE}{path}",
                    headers=_headers("GET", path, body),
                )
            data = resp.json()
        except httpx.TimeoutException:
            raise RuntimeError("连接 OKX 超时，请检查网络或使用 VPN")
        except Exception as e:
            raise RuntimeError(f"无法连接 OKX 服务器：{e}")
        if data.get("code") != "0":
            raise RuntimeError(_api_error(data, resp.status_code))
        trades = []
        for pos in data.get("data", []):
            open_px = float(pos.get("openAvgPx", 0))
            close_px = float(pos.get("closeAvgPx", 0))
            lever = int(float(pos.get("lever", 10)))
            close_qty = float(pos.get("closeTotalPos", 0))
            if open_px == 0 or close_qty == 0:
                continue
            # closeTotalPos 是合约张数，1张 BTC-USDT-SWAP = 0.01 BTC
            # 保证金 = 张数 × 合约面值 × 开仓均价 / 杠杆
            # 合约面值从 instId 推断: BTC=0.01, ETH=0.1, SOL=1, 默认 1
            ct_val = _contract_value(pos.get("instId", ""))
            margin = round(close_qty * ct_val * open_px / lever, 2)
            trades.append({
                "symbol": pos.get("instId", "UNKNOWN"),
                "direction": "long" if pos.get("posSide") == "long" else "short",
                "leverage": lever,
                "entry_price": open_px,
                "exit_price": close_px,
                "amount": margin,
                "opened_at": _parse_okx_time(pos.get("cTime")),
                "closed_at": _parse_okx_time(pos.get("uTime")),
                "notes": f"从 OKX 历史导入 (PnL: {pos.get('pnl', '0')} USDT)",
            })
        return trades


def _parse_okx_time(ts: Optional[str]) -> str:
    if not ts:
        return datetime.now(timezone.utc).isoformat()
    try:
        return datetime.fromtimestamp(int(ts) / 1000, tz=timezone.utc).isoformat()
    except (ValueError, TypeError):
        return datetime.now(timezone.utc).isoformat()


def _to_okx_ts(iso_str: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_str)
        return str(int(dt.timestamp() * 1000))
    except (ValueError, TypeError):
        return ""


def _contract_value(inst_id: str) -> float:
    """根据交易对推断合约面值（USDT本位永续）"""
    base = inst_id.split("-")[0].upper() if "-" in inst_id else ""
    mapping = {
        "BTC": 0.01,
        "ETH": 0.1,
        "SOL": 1,
        "DOGE": 1000,
        "PEPE": 1000000,
        "XRP": 10,
        "SUI": 10,
        "APT": 10,
        "ARB": 100,
        "OP": 10,
        "AVAX": 1,
        "LINK": 10,
        "BCH": 0.1,
        "LTC": 1,
        "DOT": 10,
        "ADA": 100,
        "ATOM": 10,
        "FIL": 10,
        "NEAR": 10,
        "MATIC": 100,
    }
    return mapping.get(base, 1)


okx_service = OkxService()
