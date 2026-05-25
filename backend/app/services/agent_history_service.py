"""Agent chat history — persistent storage in SQLite."""

import json
import os
import sqlite3
from datetime import datetime, timezone

DB = os.path.join(os.path.dirname(__file__), "..", "..", "trades.db")


class AgentHistoryService:
    def __init__(self):
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(DB)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 0,
                title TEXT NOT NULL,
                messages TEXT NOT NULL,
                message_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
        conn.close()

    def save(self, messages: list[dict], user_id: int = 0, title: str = "") -> dict:
        if not messages:
            return {"error": "无消息"}

        if not title:
            first_user = next((m["content"] for m in messages if m.get("role") == "user"), None)
            title = (first_user or "对话")[:40]

        conn = sqlite3.connect(DB)
        cursor = conn.execute(
            "INSERT INTO agent_history (user_id, title, messages, message_count, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, title, json.dumps(messages, ensure_ascii=False), len(messages),
             datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        hid = cursor.lastrowid
        conn.close()
        return {"id": hid, "title": title, "message_count": len(messages), "status": "saved"}

    def list(self, user_id: int = 0) -> list[dict]:
        conn = sqlite3.connect(DB)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, title, message_count, created_at FROM agent_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
            (user_id,),
        ).fetchall()
        conn.close()
        return [{"id": r["id"], "title": r["title"], "message_count": r["message_count"],
                 "created_at": r["created_at"]} for r in rows]

    def load(self, history_id: int) -> dict | None:
        conn = sqlite3.connect(DB)
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM agent_history WHERE id = ?", (history_id,)).fetchone()
        conn.close()
        if not row:
            return None
        try:
            messages = json.loads(row["messages"])
        except json.JSONDecodeError:
            messages = []
        return {"id": row["id"], "title": row["title"], "messages": messages,
                "message_count": row["message_count"], "created_at": row["created_at"]}

    def delete(self, history_id: int) -> bool:
        conn = sqlite3.connect(DB)
        conn.execute("DELETE FROM agent_history WHERE id = ?", (history_id,))
        conn.commit()
        conn.close()
        return True


agent_history_service = AgentHistoryService()
