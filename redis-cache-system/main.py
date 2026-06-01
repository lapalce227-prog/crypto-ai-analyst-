"""High-concurrency article reading system with Redis multi-level caching.

Cache strategies demonstrated:
1. Cache-Aside (read-through + write-invalidate)
2. Bloom filter for penetration prevention
3. Mutex lock for hot-key breakdown prevention
4. Random TTL offset for avalanche prevention
"""

import asyncio
import json
import random
import time
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI, HTTPException
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel

from bloom_filter import BloomFilter

# ── Config ───────────────────────────────────────────
REDIS_URL = "redis://localhost:6379"
CACHE_TTL_BASE = 300          # base TTL in seconds
CACHE_TTL_JITTER = 120        # random jitter range
HOT_KEY_LOCK_TTL = 10         # mutex lock timeout
DB_QUERY_DELAY = 0.08         # simulated DB query latency (80ms)

# ── In-memory "Database" ─────────────────────────────
ARTICLES_DB: dict[int, dict] = {}
BLOOM: BloomFilter = None


def _seed_db(count: int = 500):
    """Populate mock articles for testing."""
    global ARTICLES_DB, BLOOM
    ARTICLES_DB = {}
    BLOOM = BloomFilter(expected_items=count, false_positive_rate=0.001)
    for i in range(1, count + 1):
        ARTICLES_DB[i] = {
            "id": i,
            "title": f"Article {i}: Deep Dive into Redis Caching",
            "author": "季宇飞",
            "views": random.randint(100, 100000),
            "content": f"Lorem ipsum dolor sit amet, consectetur adipiscing elit. "
                       f"Sed do eiusmod tempor incididunt ut labore. Article {i} content.",
        }
        BLOOM.add(f"article:{i}")
    print(f"[DB] Seeded {count} articles, Bloom filter ready")


# ── Redis helpers ────────────────────────────────────
class CacheManager:
    def __init__(self, client: aioredis.Redis):
        self.redis = client

    async def get(self, cache_key: str) -> dict | None:
        data = await self.redis.get(cache_key)
        return json.loads(data) if data else None

    async def set(self, cache_key: str, value: dict, ttl: int = None):
        if ttl is None:
            ttl = CACHE_TTL_BASE + random.randint(0, CACHE_TTL_JITTER)
        await self.redis.setex(cache_key, ttl, json.dumps(value, ensure_ascii=False))

    async def delete(self, cache_key: str):
        await self.redis.delete(cache_key)

    async def acquire_lock(self, lock_key: str) -> bool:
        """SETNX-based distributed mutex. Returns True if lock acquired."""
        acquired = await self.redis.setnx(lock_key, int(time.time()))
        if acquired:
            await self.redis.expire(lock_key, HOT_KEY_LOCK_TTL)
        return bool(acquired)

    async def release_lock(self, lock_key: str):
        await self.redis.delete(lock_key)

    async def get_stats(self) -> dict:
        info = await self.redis.info("stats")
        memory = await self.redis.info("memory")
        return {
            "hits": info.get("keyspace_hits", 0),
            "misses": info.get("keyspace_misses", 0),
            "hit_rate": round(
                info["keyspace_hits"] / max(1, info["keyspace_hits"] + info["keyspace_misses"]) * 100, 1
            ),
            "used_memory_mb": round(memory.get("used_memory", 0) / 1024 / 1024, 2),
            "connected_clients": (await self.redis.info("clients")).get("connected_clients", 0),
        }


# ── App ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_db(500)
    app.state.redis = aioredis.from_url(REDIS_URL, decode_responses=False)
    app.state.cache = CacheManager(app.state.redis)
    yield
    await app.state.redis.close()

app = FastAPI(title="High-Concurrency Cache System", version="1.0.0", lifespan=lifespan)
Instrumentator().instrument(app).expose(app)


# ── Models ───────────────────────────────────────────
class ArticleOut(BaseModel):
    id: int
    title: str
    author: str
    views: int
    content: str
    cached: bool = False

class ArticleCreate(BaseModel):
    title: str
    author: str
    content: str

class StatsOut(BaseModel):
    cache: dict
    bloom: dict
    db_size: int

# ── Core logic: Cache-Aside with full protection ─────
async def _get_article_with_cache(article_id: int) -> dict:
    cache_key = f"article:{article_id}"
    lock_key = f"lock:article:{article_id}"
    cache: CacheManager = app.state.cache

    # Step 1: Bloom filter check (penetration prevention)
    if not BLOOM.might_contain(cache_key):
        raise HTTPException(404, "Article not found (blocked by bloom filter)")

    # Step 2: Check cache
    cached = await cache.get(cache_key)
    if cached:
        cached["cached"] = True
        return cached

    # Step 3: Hot-key lock (breakdown prevention)
    locked = await cache.acquire_lock(lock_key)
    if not locked:
        # Another request is rebuilding — wait and retry
        await asyncio.sleep(0.05)
        cached = await cache.get(cache_key)
        if cached:
            cached["cached"] = True
            return cached
        # Double-check: try acquiring lock again
        locked = await cache.acquire_lock(lock_key)
        if not locked:
            raise HTTPException(503, "Cache rebuild in progress, please retry")

    try:
        # Step 4: Query "database"
        await asyncio.sleep(DB_QUERY_DELAY)  # simulate DB latency
        article = ARTICLES_DB.get(article_id)
        if not article:
            raise HTTPException(404, f"Article {article_id} not found")

        # Step 5: Write back to cache
        await cache.set(cache_key, article)
        article["cached"] = False
        return article
    finally:
        await cache.release_lock(lock_key)


# ── Routes ───────────────────────────────────────────
@app.get("/api/articles/{article_id}", response_model=ArticleOut)
async def get_article(article_id: int):
    return await _get_article_with_cache(article_id)


@app.post("/api/articles", response_model=ArticleOut)
async def create_article(body: ArticleCreate):
    global ARTICLES_DB
    new_id = max(ARTICLES_DB.keys(), default=0) + 1
    article = {"id": new_id, "title": body.title, "author": body.author,
               "views": 0, "content": body.content}
    ARTICLES_DB[new_id] = article
    BLOOM.add(f"article:{new_id}")
    # Cache-Aside: invalidate (not needed for new, but pattern: write DB then delete cache)
    return ArticleOut(**article, cached=False)


@app.put("/api/articles/{article_id}")
async def update_article(article_id: int, body: ArticleCreate):
    if article_id not in ARTICLES_DB:
        raise HTTPException(404, "Article not found")
    ARTICLES_DB[article_id].update(
        title=body.title, author=body.author, content=body.content
    )
    # Cache-Aside write pattern: update DB, then delete cache
    await app.state.cache.delete(f"article:{article_id}")
    return {"status": "updated", "id": article_id}


@app.get("/api/stats", response_model=StatsOut)
async def get_stats():
    cache: CacheManager = app.state.cache
    return {
        "cache": await cache.get_stats(),
        "bloom": BLOOM.stats,
        "db_size": len(ARTICLES_DB),
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}
