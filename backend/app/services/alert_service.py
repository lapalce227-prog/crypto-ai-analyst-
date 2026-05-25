"""Alert service — background monitoring + persistent alert storage."""

import asyncio
import os
import sqlite3
import json
import httpx
from datetime import datetime, timezone
from typing import Optional


DB = os.path.join(os.path.dirname(__file__), "..", "..", "trades.db")


class AlertService:
    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(DB)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 0,
                symbol TEXT NOT NULL,
                condition TEXT NOT NULL,
                target_price REAL NOT NULL,
                triggered INTEGER DEFAULT 0,
                triggered_at TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
        conn.close()

    async def add(self, symbol: str, condition: str, target_price: float, user_id: int = 0) -> dict:
        conn = sqlite3.connect(DB)
        cursor = conn.execute(
            "INSERT INTO alerts (user_id, symbol, condition, target_price, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, symbol.upper(), condition, target_price, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        alert_id = cursor.lastrowid
        conn.close()
        return {"id": alert_id, "symbol": symbol, "condition": condition, "target_price": target_price, "status": "active"}

    def get_all(self, user_id: int = 0) -> list[dict]:
        conn = sqlite3.connect(DB)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
            (user_id,),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_active(self) -> list[dict]:
        conn = sqlite3.connect(DB)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM alerts WHERE triggered = 0 ORDER BY created_at DESC"
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def dismiss(self, alert_id: int) -> bool:
        conn = sqlite3.connect(DB)
        conn.execute("DELETE FROM alerts WHERE id = ?", (alert_id,))
        conn.commit()
        conn.close()
        return True

    async def check_alerts(self):
        """Check all active alerts against current prices, trigger those that match."""
        active = self.get_active()
        if not active:
            return

        symbols = set(a["symbol"] for a in active)
        prices = {}
        async with httpx.AsyncClient(timeout=10) as client:
            for sym in symbols:
                try:
                    resp = await client.get(
                        f"https://www.okx.com/api/v5/market/ticker?instId={sym}-USDT"
                    )
                    data = resp.json()
                    if data.get("code") == "0" and data["data"]:
                        prices[sym] = float(data["data"][0]["last"])
                except Exception:
                    continue

        if not prices:
            return

        conn = sqlite3.connect(DB)
        now = datetime.now(timezone.utc).isoformat()
        for alert in active:
            sym = alert["symbol"]
            price = prices.get(sym)
            if price is None:
                continue
            triggered = False
            if alert["condition"] == "above" and price >= alert["target_price"]:
                triggered = True
            elif alert["condition"] == "below" and price <= alert["target_price"]:
                triggered = True

            if triggered:
                conn.execute(
                    "UPDATE alerts SET triggered = 1, triggered_at = ? WHERE id = ?",
                    (now, alert["id"]),
                )
        conn.commit()
        conn.close()

    async def start(self, interval_seconds: int = 60):
        """Start background alert checker."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(interval_seconds))

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _loop(self, interval: int):
        while self._running:
            try:
                await self.check_alerts()
            except Exception:
                pass
            await asyncio.sleep(interval)


alert_service = AlertService()
