from typing import Optional
from app.core.database import get_db


class UserStore:
    def create(self, username: str, hashed_password: str) -> dict:
        db = get_db()
        try:
            cur = db.execute(
                "INSERT INTO users (username, hashed_password) VALUES (?, ?)",
                (username, hashed_password),
            )
            db.commit()
            user_id = cur.lastrowid
            row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return {"id": row["id"], "username": row["username"], "created_at": row["created_at"]}
        except Exception:
            db.rollback()
            raise ValueError("用户名已存在")

    def get_by_username(self, username: str) -> Optional[dict]:
        db = get_db()
        row = db.execute(
            "SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username,)
        ).fetchone()
        return dict(row) if row else None

    def get_by_id(self, user_id: int) -> Optional[dict]:
        db = get_db()
        row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


user_store = UserStore()
