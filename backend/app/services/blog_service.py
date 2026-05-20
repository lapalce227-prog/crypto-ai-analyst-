import json
import os
from datetime import datetime, timezone
from typing import Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
FILE = os.path.join(DATA_DIR, "blog.json")


def _load():
    if not os.path.exists(FILE):
        return {"articles": []}
    with open(FILE) as f:
        return json.load(f)


def _save(data):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


class BlogService:
    def create(self, user_id: int, username: str, title: str, content: str) -> dict:
        data = _load()
        article = {
            "id": len(data["articles"]) + 1,
            "user_id": user_id,
            "username": username,
            "title": title,
            "content": content,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "views": 0,
        }
        data["articles"].append(article)
        _save(data)
        return article

    def get_all(self) -> list[dict]:
        data = _load()
        return sorted(data["articles"], key=lambda a: a["id"], reverse=True)

    def get_by_id(self, article_id: int) -> Optional[dict]:
        data = _load()
        for a in data["articles"]:
            if a["id"] == article_id:
                a["views"] = a.get("views", 0) + 1
                _save(data)
                return a
        return None


blog_service = BlogService()
