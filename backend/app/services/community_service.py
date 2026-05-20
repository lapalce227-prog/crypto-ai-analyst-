import json
import os
from datetime import datetime, timezone
from typing import Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
FILE = os.path.join(DATA_DIR, "community.json")


def _load():
    if not os.path.exists(FILE):
        return {"posts": []}
    with open(FILE) as f:
        return json.load(f)


def _save(data):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


class CommunityService:
    def add_post(self, user_id: int, username: str, content: str, parent_id: Optional[int] = None) -> dict:
        data = _load()
        post = {
            "id": len(data["posts"]) + 1,
            "user_id": user_id,
            "username": username,
            "content": content,
            "parent_id": parent_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "likes": 0,
            "liked_by": [],
        }
        data["posts"].append(post)
        _save(data)
        return post

    def get_posts(self, limit: int = 50) -> list[dict]:
        data = _load()
        return sorted(data["posts"], key=lambda p: p["id"], reverse=True)[:limit]

    def toggle_like(self, post_id: int, user_id: int) -> dict:
        data = _load()
        for p in data["posts"]:
            if p["id"] == post_id:
                if user_id in p.get("liked_by", []):
                    p["liked_by"].remove(user_id)
                    p["likes"] = max(0, p["likes"] - 1)
                else:
                    p["liked_by"].append(user_id)
                    p["likes"] += 1
                _save(data)
                return p
        return {}

    def delete_post(self, post_id: int, user_id: int) -> bool:
        data = _load()
        for i, p in enumerate(data["posts"]):
            if p["id"] == post_id and p["user_id"] == user_id:
                data["posts"].pop(i)
                _save(data)
                return True
        return False


community_service = CommunityService()
