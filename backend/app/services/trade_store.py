from typing import Optional
from app.core.database import get_db

FIELDS = [
    "user_id", "symbol", "direction", "leverage", "entry_price", "exit_price",
    "amount", "stop_loss", "take_profit", "notes", "opened_at", "closed_at",
    "emotion_level", "pnl", "pnl_percent", "total_fee", "created_at",
]


class TradeStore:
    def add(self, trade_data: dict) -> dict:
        db = get_db()
        values = {f: trade_data.get(f) for f in FIELDS}
        placeholders = ", ".join("?" * len(FIELDS))
        columns = ", ".join(FIELDS)
        cur = db.execute(
            f"INSERT INTO trades ({columns}) VALUES ({placeholders})",
            [values[f] for f in FIELDS],
        )
        db.commit()
        trade_data["id"] = cur.lastrowid
        return trade_data

    def get_all(self, user_id: int) -> list[dict]:
        db = get_db()
        rows = db.execute(
            "SELECT * FROM trades WHERE user_id = ? ORDER BY opened_at DESC", (user_id,)
        ).fetchall()
        return [dict(r) for r in rows]

    def get_by_id(self, user_id: int, trade_id: int) -> Optional[dict]:
        db = get_db()
        row = db.execute(
            "SELECT * FROM trades WHERE id = ? AND user_id = ?", (trade_id, user_id)
        ).fetchone()
        return dict(row) if row else None


trade_store = TradeStore()
