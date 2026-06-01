# 季宇飞

Python / 全栈开发工程师（实习） · 大三在读 · 2027 届

📧 1719679329@qq.com | 📱 17816840191 | 🏫 浙江农林大学 · 计算机科学与技术

🔗 [github.com/lapalce227-prog](https://github.com/lapalce227-prog) | 🌐 [laplace-market](https://crypto-ai-analyst-production.up.railway.app)

---

## 技术能力

| 分级 | 技术栈 |
|------|--------|
| **熟练使用** | Python, FastAPI, Pydantic v2, React 18, TypeScript, Tailwind CSS, SQLite |
| **熟悉** | LangGraph, LangChain, LLM Tool Calling, SSE 流式输出, Prompt Engineering, Redis, shadcn/ui, GSAP (ScrollTrigger / SplitText), Framer Motion, Git, Vite, JWT + bcrypt, RESTful API |
| **了解** | Node.js, PostgreSQL, Docker, SQLAlchemy, Nginx, CI/CD (GitHub Actions), Railway, Cloudflare Pages, JMeter, Prometheus + Grafana |

---

## 项目经历

### Laplace Market — 多源实时数据智能分析平台

独立开发 | 2025.05 - 至今 | [在线 Demo](https://crypto-ai-analyst-production.up.railway.app) | [GitHub](https://github.com/lapalce227-prog/crypto-ai-analyst)

- 独立完成全栈架构设计，涵盖用户认证、实时行情数据（多数据源三级容错）、LangGraph Agent 对话、数据复盘、策略回测、社区博客 6 大模块，总计 40+ API 端点，Railway + Cloudflare Pages 生产部署
- 用 LangGraph StateGraph 构建双节点 Agent 系统（chat <> tools 循环），集成千问 Function Calling，开发 5 个数据工具（行情数据 / 市场指标 / 用户记录 / 资产信息 / 行业快讯 + 千问 VL 图片识别），asyncio.gather 并发将多工具调用耗时从串行 1.2s 降至 0.4s
- 基于 astream_events 实现 SSE 流式输出，实时推送 LLM 逐 token 文本 + tool_start / tool_end 事件，前端逐字打字机效果 + 工具调用状态条，首 token 延迟 ≤ 1.5s；对话历史 SQLite 持久化，支持保存/加载/删除
- 设计三级数据源容错链路（多数据源 REST + WebSocket 双通道实时推送），行情数据可用率从约 85% 提升至 99%+；监控面板基于 Prometheus + Grafana 可视化
- 实现数据告警后台轮询（asyncio.Task，60s 间隔）、JWT + bcrypt 认证体系、交易所 API 签名集成、PnL 自动计算（含 0.05% 手续费模型），策略回测引擎支持 DCA 定投和马丁格尔两种策略
- 前端 React 18 + Vite + Tailwind CSS：lightweight-charts v5 渲染 K 线图（MACD / RSI / EMA / 布林带 4 类技术指标），Recharts 权益曲线仪表盘；Landing Page 基于 GSAP ScrollTrigger + SplitText 实现逐字动画、滚动叙事、光标跟随光斑

### 高并发缓存系统 — Redis 缓存深度优化实战

独立开发 | 2026.04 - 2026.05 | [GitHub](https://github.com/lapalce227-prog/crypto-ai-analyst-/tree/main/redis-cache-system)

- 基于 FastAPI + Redis 构建高并发文章阅读系统，用 JMeter 压测定位瓶颈：单请求延迟 89ms（模拟 DB 查询 80ms）；引入 Cache-Aside 模式后降至 0.8ms，10 并发下 QPS 从 270 提升至 1400+，P99 延迟从 90ms 降至 24ms
- 用布隆过滤器拦截不存在文章的恶意查询，误判率 0.1%，缓存穿透请求占比从 35% 降至 0；热点文章设置互斥锁防止缓存击穿，同一时间仅 1 个请求重建缓存
- 设计多级过期策略（热点 key 续期 + 随机偏移量防雪崩），缓存命中率稳定在 92%+；Redis Sentinel 三节点高可用，主从切换时间 ≤ 3s
- 实现缓存全量监控面板：命中率时序图、key 空间分布、慢查询 Top 10、内存碎片率告警，Prometheus + Grafana 可视化

---

## 教育背景

**浙江农林大学** | 计算机科学与技术 · 本科 | 2023.09 - 2027.06 | 大三在读

主修课程：数据结构 · 操作系统 · 计算机网络 · 数据库 · 软件工程

---

## 自我评价

我能独立完成从数据库设计到前端交互动效的全链路开发，在 LLM Agent 和缓存架构两个方向具备完整的工程落地能力（LangGraph Tool Calling → SSE 流式输出 → Redis 多级缓存 → 生产部署）。在校期间从零构建了多源数据分析平台和高并发缓存系统并上线运行。期望在实习中深入真实产品的后端或全栈开发，在高并发、分布式系统等工程挑战中快速成长。
