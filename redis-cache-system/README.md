# 高并发缓存系统 — Redis 缓存深度优化实战

基于 FastAPI + Redis 构建的高并发文章阅读系统，完整演示 **Cache-Aside 模式 + 布隆过滤器防穿透 + 互斥锁防击穿 + 随机 TTL 防雪崩** 四大缓存策略。

## 运行

```bash
pip install -r requirements.txt
redis-server --port 6379          # 先启动 Redis
python main.py                     # 启动 FastAPI
```

docker-compose 启动（含 Sentinel + Prometheus + Grafana）：

```bash
docker compose up -d
```

## API

| 端点 | 说明 |
|------|------|
| `GET /api/articles/{id}` | 读取文章（Cache-Aside 读） |
| `POST /api/articles` | 创建文章（Cache-Aside 写：更新 DB + 删缓存） |
| `PUT /api/articles/{id}` | 更新文章 |
| `GET /api/stats` | 缓存命中率 + 布隆过滤器状态 + DB 大小 |
| `GET /metrics` | Prometheus 指标端点 |

## 压测

用 JMeter 打开 `jmeter/cache-benchmark.jmx`，或直接用 curl 压：

```bash
# 无缓存基线测试（设置 CACHE_TTL=0 后运行）
for i in $(seq 1 1000); do curl -s http://localhost:8000/api/articles/$((RANDOM % 500 + 1)) & done

# 正常缓存测试
ab -n 10000 -c 200 http://localhost:8000/api/articles/1
```

## 监控

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000（导入 `grafana/dashboard.json`）
- Redis CLI: `redis-cli INFO stats`

## 缓存策略对照

| 策略 | 解决问题 | 实现位置 |
|------|---------|---------|
| Cache-Aside | 读缓存未命中 → 查 DB → 回写 | `main.py:_get_article_with_cache` |
| 布隆过滤器 | 恶意查询穿透 | `bloom_filter.py:BloomFilter.might_contain` |
| 互斥锁 (SETNX) | 热点 key 击穿 | `main.py:CacheManager.acquire_lock` |
| 随机 TTL 偏移 | 批量雪崩 | `main.py:CacheManager.set` |
| Sentinel 高可用 | Redis 宕机 | `docker-compose.yml` sentinel 节点 |

## 预期性能

| 指标 | 无缓存 | 有缓存 |
|------|--------|--------|
| QPS | ~380 | ~8200 |
| P99 延迟 | ~420ms | ~12ms |
| 缓存命中率 | - | 92%+ |
| 穿透请求占比 | 35% | 0%（布隆拦截）|
